/*
  The MIT License (MIT)

  Copyright (c) 2015 Christian Adam

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
*/

/**
  @overview Provides a module that let's you interact with Artifactory API
  @author Christian Adam
*/

var _ = require('underscore'),
  Q = require('q'),
  request = require('request'),
  path = require('path'),
  fs = require('fs'),
  md5File = require('md5-file');

/**
  Creates a new Artifactory API instance
  @class
*/
function ArtifactoryAPI(url, basicHttpAuth) {
  this.url_ = url;
  this.basicHttpAuth_ = basicHttpAuth;
}

/**
  @prop {object} API - General API sections
  @static
*/
ArtifactoryAPI.API = {
  storage: '/artifactory/api/storage/'
};

/**
  @prop {object} ACTIONS - The ACTIONS listed here represent well-known paths for
  common artifactory actions.
  @static
*/
ArtifactoryAPI.ACTIONS = {
  'getFileInfo': ArtifactoryAPI.API.storage + '<%= repoKey %><%= filePath %>',
  'filePath': '/artifactory/' + '<%= repoKey %><%= filePath %>'
};

/** Get file info from Artifactory server. The result is provided in a json object.
 * @param   {string} repoKey  The key of the repo where the file is stored.
 * @param   {string} remotefilePath The path to the file inside the repo.
 * @returns {object} A QPromise to a json object with the file's info as specified in the {@link http://www.jfrog.com/confluence/display/RTF/Artifactory+REST+API#ArtifactoryRESTAPI-FileInfo|FileInfo} Artifactory API.
 */
ArtifactoryAPI.prototype.getFileInfo = function (repoKey, remotefilePath) {
  var deferred = Q.defer();

  var compiled = _.template(ArtifactoryAPI.ACTIONS.getFileInfo);

  var actionPath = compiled({
    repoKey: repoKey,
    filePath: remotefilePath
  });

  var options = {
    url: this.url_ + actionPath,
    headers: {
      'Authorization': 'Basic ' + this.basicHttpAuth_
    },
    strictSSL: false
  };

  request.get(options, function (error, response) {
    if (error) {
      deferred.reject(error.message);
      return;
    }
    //We expect an OK return code.
    if (response.statusCode !== 200) {
      deferred.reject(response.statusCode);
      return;
    }
    deferred.resolve(JSON.parse(response.body));
  });

  return deferred.promise;
};

/**
 * Checks if the file exists.
 * @param   {string} repoKey  The key of the repo where the file is stored.
 * @param   {string} remotefilePath The path to the file inside the repo.
 * @returns {object} A QPromise to a boolean value
 */
ArtifactoryAPI.prototype.fileExists = function (repoKey, remotefilePath) {
  var deferred = Q.defer(),
    compiled = _.template(ArtifactoryAPI.ACTIONS.filePath),
    actionPath = compiled({
      repoKey: repoKey,
      filePath: remotefilePath
    }),
    options = {
      url: this.url_ + actionPath,
      headers: {
        'Authorization': 'Basic ' + this.basicHttpAuth_
      },
      strictSSL: false
    };

  request.head(options, function (error, response) {
    switch (response.statusCode) {
    case 200:
      deferred.resolve(true);
      break;
    case 404:
      deferred.resolve(false);
      break;
    default:
      deferred.reject(response.statusCode);
      break;
    }
  });

  return deferred.promise;
};

/**
 * Uploads a file to artifactory. The uploading file needs to exist!
 * @param   {string} repoKey  The key of the repo where the file is stored.
 * @param   {string} remotefilePath The path to the file inside the repo. (in the server)
 * @param   {string} localfilePath Absolute or relative path to the file to upload.
 * @param   {boolean} [forceUpload=false] Flag indicating if the file should be upload if it already exists.
 * @returns {object} A QPromise to a json object with creation info as specified in the {@link http://www.jfrog.com/confluence/display/RTF/Artifactory+REST+API#ArtifactoryRESTAPI-DeployArtifact|DeployArtifact} Artifactory API.
 */
ArtifactoryAPI.prototype.uploadFile = function (repoKey, remotefilePath, localfilePath, forceUpload) {
  var deferred = Q.defer(),
    overwriteFileInServer = forceUpload || false,
    fileToUpload = path.resolve(localfilePath);

  /*
    Check the file to upload does exist!
  */
  if (!fs.existsSync(fileToUpload)) {
    deferred.reject('The file to upload ' + fileToUpload + ' does not exist');
    return deferred.promise;
  }

  /*
    Create everything for doing the request
  */
  var compiled = _.template(ArtifactoryAPI.ACTIONS.filePath),
    actionPath = compiled({
      repoKey: repoKey,
      filePath: remotefilePath
    }),
    options = {
      url: this.url_ + actionPath,
      headers: {
        'Authorization': 'Basic ' + this.basicHttpAuth_
      },
      strictSSL: false
    };

  //Check if file exists..
  this.fileExists(repoKey, remotefilePath).then(function (fileExists) {
    if (fileExists && !overwriteFileInServer) {
      deferred.reject('File already exists and forceUpload flag was not provided with a TRUE value.');
      return;
    }
    //In any other case then proceed with *upload*
    fs.createReadStream(fileToUpload).pipe(request.put(options, function (error, response) {
      if (error) {
        deferred.reject(error.message);
        return;
      }
      //We expect a CREATED return code.
      if (response.statusCode !== 201) {
        deferred.reject('HTTP Status Code from server was: ' + response.statusCode);
        return;
      }
      deferred.resolve(JSON.parse(response.body));
    }));
  }).fail(function (err) {
    deferred.reject(err);
  });

  return deferred.promise;
};

/** Downloads an artifactory artifact to a specified file path. The folder where the file will be created MUST exist.
 * @param   {string} repoKey  The key of the repo where the file is stored.
 * @param   {string} remotefilePath The path to the file inside the repo. (in the server)
 * @param   {string} destinationFile Absolute or relative path to the destination file. The folder that will contain the destination file must exist.
 * @param   {boolean} [checkChecksum=false] A flag indicating if a checksum verification should be done as part of the download.
 * @returns {object} A QPromise to a string containing the result.
 */
ArtifactoryAPI.prototype.downloadFile = function (repoKey, remotefilePath, destinationFile, checkChecksum) {
  var deferred = Q.defer(),
    checkFileIntegrity = checkChecksum || false,
    self = this,
    destinationPath = path.resolve(destinationFile);

  if (!fs.existsSync(path.dirname(destinationPath))) {
    deferred.reject('The destination folder ' + path.dirname(destinationPath) + ' does not exist.');
    return deferred.promise;
  }

  var compiled = _.template(ArtifactoryAPI.ACTIONS.filePath);

  var actionPath = compiled({
    repoKey: repoKey,
    filePath: remotefilePath
  });

  var options = {
    url: this.url_ + actionPath,
    headers: {
      'Authorization': 'Basic ' + this.basicHttpAuth_
    },
    strictSSL: false
  };

  var req = request.get(options);
  req.on('response', function (resp) {
    if (resp.statusCode === 200) {
      var stream = req.pipe(fs.createWriteStream(destinationPath));
      stream.on('finish', function () {
        if (checkFileIntegrity) {
          self.getFileInfo(repoKey, remotefilePath).then(function (fileInfo) {
            md5File(destinationPath, function (err, sum) {
              if (err) {
                deferred.reject('Error while calculating MD5: ' + err.toString());
                return;
              }
              if (sum === fileInfo.checksums.md5) {
                deferred.resolve('Download was SUCCESSFUL even checking expected checksum MD5 (' + fileInfo.checksums.md5 + ')');
              } else {
                deferred.reject('Error downloading file ' + options.url + '. Checksum (MD5) validation failed. Expected: ' +
                  fileInfo.checksums.md5 + ' - Actual downloaded: ' + sum);
              }
            });
          }).fail(function (err) {
            deferred.reject(err);
          });
        } else {
          deferred.resolve('Download was SUCCESSFUL');
        }
      });
    } else {
      deferred.reject('Server returned ' + resp.statusCode);
    }
  });

  return deferred.promise;
};

module.exports = ArtifactoryAPI;
