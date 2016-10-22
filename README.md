# Artifactory API
The Artifactory API module provides you a friendly way of interacting with [Artifactory REST API](http://www.jfrog.com/confluence/display/RTF/Artifactory+REST+API)

## Authentication
You need to provide basic http credentials when creating a new instance. Just provide username:password in base 64.
* Hint: you can quickly obtain the base64 of any string by opening a Chrome browser and typing this in the developer console:

  ```javascript
  btoa('user:password') //prints: "dXNlcjpwYXNzd29yZA=="
  ```

  Usage example:

  ```javascript
  var artifactory = new ArtifactoryAPI('https:<myServerURL>', "dXNlcjpwYXNzd29yZA==");
  ```

## Actions
All actions return a [Q Promise](https://github.com/kriskowal/q).

### getFileInfo(repoKey, remotefilePath)
Provides all the info related to a file in a json object. You need to provide the repoKey and the path to the file.

API: [FileInfo](http://www.jfrog.com/confluence/display/RTF/Artifactory+REST+API#ArtifactoryRESTAPI-FileInfo)

  Usage example:

  ```javascript
  var artifactory = new ArtifactoryAPI('http://localhost:8080', "dXNlcjpwYXNzd29yZA==");
  artifactory.getFileInfo('libs-release-local','/org/acme/lib/ver/lib-ver.pom').then(function(fileInfoJson){
    console.log(JSON.stringify(fileInfoJson));
  });
  ```

  That would print to console something like this:

  ```json
  {
    "uri": "http://localhost:8080/artifactory/api/storage/libs-release-local/org/acme/lib/ver/lib-ver.pom",
    "downloadUri": "http://localhost:8080/artifactory/libs-release-local/org/acme/lib/ver/lib-ver.pom",
    "repo": "libs-release-local",
    "path": "/org/acme/lib/ver/lib-ver.pom",
    "remoteUrl": "http://some-remote-repo/mvn/org/acme/lib/ver/lib-ver.pom",
    "created": ISO8601 (yyyy-MM-dd'T'HH:mm:ss.SSSZ),
    "createdBy": "userY",
    "lastModified": ISO8601 (yyyy-MM-dd'T'HH:mm:ss.SSSZ),
    "modifiedBy": "userX",
    "lastUpdated": ISO8601 (yyyy-MM-dd'T'HH:mm:ss.SSSZ),
    "size": "1024", //bytes
    "mimeType": "application/pom+xml",
    "checksums": {
      "md5" : string,
      "sha1" : string
    },
    "originalChecksums":{
      "md5" : string,
      "sha1" : string
    }
  }
  ```
  All this info will be available in the *fileInfoJson* object that is returned as part of the promise resolution.

### uploadFile(repoKey, remotefilePath, fileToUploadPath, forceUpload, checksums)
Uploads a file to artifactory. All you need to provide is the repoKey, the remote path where you want to upload the file and the local path of the file you want to upload. If the file already exists in the server it will fail unless you provide the forceUpload flag with a true value. In that case, it will overwite the file in the server.

API: [DeployArtifact](http://www.jfrog.com/confluence/display/RTF/Artifactory+REST+API#ArtifactoryRESTAPI-DeployArtifact)

Usage example:

```javascript
var artifactory = new ArtifactoryAPI('http://localhost:8080', "dXNlcjpwYXNzd29yZA==");
artifactory.uploadFile('libs-release-local', '/my/jar/1.0/jar-1.0.jar', '/Users/user/artifacts/jar-1.0.jar').then(function (uploadInfo) {
  console.log('UPLOAD INFO IS: ' + JSON.stringify(uploadInfo));
}).fail(function (err) {
  console.log('ERROR: ' + err);
});
```
This would print to console the creation info:

```json
{
"uri": "http://localhost:8080/artifactory/libs-release-local/my/jar/1.0/jar-1.0.jar",
"downloadUri": "http://localhost:8080/artifactory/libs-release-local/my/jar/1.0/jar-1.0.jar",
"repo": "libs-release-local",
"path": "/my/jar/1.0/jar-1.0.jar",
"created": ISO8601 (yyyy-MM-dd'T'HH:mm:ss.SSSZ),
"createdBy": "userY",
"size": "1024", //bytes
"mimeType": "application/java-archive",
"checksums":
{
        "md5" : string,
        "sha1" : string
    },
"originalChecksums":{
        "md5" : string,
        "sha1" : string
    }
}
```
All this info will be available in the *uploadInfo* object that is returned as part of the promise resolution.

### downloadFile(repoKey, remotefilePath, destinationFile, checkChecksum)
Downloads a file from a given repository/path into a specific file. You need to provide the repoKey, the remote path where the file is located and a destination file. The folder that will contain the destination file must exist! Additionally you can indicate whether you want to perform a checksum verification as part of the download or not.

API: [RetrieveArtifact](http://www.jfrog.com/confluence/display/RTF/Artifactory+REST+API#ArtifactoryRESTAPI-RetrieveArtifact)

Usage example:

```javascript
var artifactory = new ArtifactoryAPI('http://localhost:8080', "dXNlcjpwYXNzd29yZA==");
artifactory.downloadFile('libs-release-local', '/my/jar/1.0/jar-1.0.jar', '/Users/user/Downloads/myJar.jar', true).then(function (result) {
  console.log(result);
}).fail(function (err) {
  console.log('ERROR: ' + err);
});
```
The result object returned as part of the promise resolution is just a string indicating the final result of the operation.

### fileExists(repoKey, remotefilePath)
Verifies if the file exists in the server. You need to provide the repoKey and the path to the file in the server.

API: [RetrieveArtifact](http://www.jfrog.com/confluence/display/RTF/Artifactory+REST+API#ArtifactoryRESTAPI-RetrieveArtifact) but only asking for the **HEAD** instead of doing a **GET**.

Usage example:
```javascript
var artifactory = new ArtifactoryAPI('http://localhost:8080', "dXNlcjpwYXNzd29yZA==");
artifactory.fileExists('libs-release-local', '/my/jar/1.0/jar-1.0.jar').then(function (exists) {
  if(exists){
    console.log('YES, file exists!');
  }
  console.log('NO, it\'s not there');
}).fail(function (err) {
  console.log('ERROR: ' + err);
});
```

### uploadBuild(buildInfo)
Uploads build information to the server. You must provide the build.json object as a parameter.

API: [BuildUpload](https://www.jfrog.com/confluence/display/RTF/Artifactory+REST+API#ArtifactoryRESTAPI-BuildUpload)

[Extra build.json Documentation](https://github.com/JFrogDev/build-info#build-info-json-format)

Usage example:
```javascript
var artifactory = new ArtifactoryAPI('http://localhost:8080', 'dXNlcjpwYXNzd29yZA==');
artifactory.uploadBuild({version: '1.0.1', 'name': 'myBuild', 'number': 1234})
  .then(function () {
    console.log('It Worked!'); // There is no content returned from this call if it passes.
  })
  .fail(function (err) {
    console.log('ERROR: ' + err);
  });
```
