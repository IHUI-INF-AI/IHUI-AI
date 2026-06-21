# \ContentFileStorageAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**DeleteFileApiV1ContentFilesFileIdDelete**](ContentFileStorageAPI.md#DeleteFileApiV1ContentFilesFileIdDelete) | **Delete** /api/v1/content/files/{file_id} | 删除文件
[**ListFilesApiV1ContentFilesListGet**](ContentFileStorageAPI.md#ListFilesApiV1ContentFilesListGet) | **Get** /api/v1/content/files/list | 文件列表
[**UploadFileApiV1ContentFilesUploadPost**](ContentFileStorageAPI.md#UploadFileApiV1ContentFilesUploadPost) | **Post** /api/v1/content/files/upload | 上传文件记录



## DeleteFileApiV1ContentFilesFileIdDelete

> interface{} DeleteFileApiV1ContentFilesFileIdDelete(ctx, fileId).Execute()

删除文件

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	fileId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentFileStorageAPI.DeleteFileApiV1ContentFilesFileIdDelete(context.Background(), fileId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentFileStorageAPI.DeleteFileApiV1ContentFilesFileIdDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteFileApiV1ContentFilesFileIdDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentFileStorageAPI.DeleteFileApiV1ContentFilesFileIdDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**fileId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteFileApiV1ContentFilesFileIdDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListFilesApiV1ContentFilesListGet

> interface{} ListFilesApiV1ContentFilesListGet(ctx).Page(page).Limit(limit).FileType(fileType).Execute()

文件列表

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)
	fileType := "fileType_example" // string | 按文件类型过滤 (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentFileStorageAPI.ListFilesApiV1ContentFilesListGet(context.Background()).Page(page).Limit(limit).FileType(fileType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentFileStorageAPI.ListFilesApiV1ContentFilesListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListFilesApiV1ContentFilesListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentFileStorageAPI.ListFilesApiV1ContentFilesListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListFilesApiV1ContentFilesListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **fileType** | **string** | 按文件类型过滤 | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## UploadFileApiV1ContentFilesUploadPost

> interface{} UploadFileApiV1ContentFilesUploadPost(ctx).FileUploadBody(fileUploadBody).Execute()

上传文件记录

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	fileUploadBody := *openapiclient.NewFileUploadBody("FileName_example", "FilePath_example") // FileUploadBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentFileStorageAPI.UploadFileApiV1ContentFilesUploadPost(context.Background()).FileUploadBody(fileUploadBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentFileStorageAPI.UploadFileApiV1ContentFilesUploadPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UploadFileApiV1ContentFilesUploadPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentFileStorageAPI.UploadFileApiV1ContentFilesUploadPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUploadFileApiV1ContentFilesUploadPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fileUploadBody** | [**FileUploadBody**](FileUploadBody.md) |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

