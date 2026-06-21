# \CozeFilesAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**UploadFileApiV1CozeFilesFilesUploadPost**](CozeFilesAPI.md#UploadFileApiV1CozeFilesFilesUploadPost) | **Post** /api/v1/coze/files/files/upload | Upload File
[**UploadFileApiV1CozeFilesFilesUploadPost_0**](CozeFilesAPI.md#UploadFileApiV1CozeFilesFilesUploadPost_0) | **Post** /api/v1/coze/files/files/upload | Upload File



## UploadFileApiV1CozeFilesFilesUploadPost

> interface{} UploadFileApiV1CozeFilesFilesUploadPost(ctx).File(file).Execute()

Upload File

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
	file := os.NewFile(1234, "some_file") // *os.File | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeFilesAPI.UploadFileApiV1CozeFilesFilesUploadPost(context.Background()).File(file).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeFilesAPI.UploadFileApiV1CozeFilesFilesUploadPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UploadFileApiV1CozeFilesFilesUploadPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeFilesAPI.UploadFileApiV1CozeFilesFilesUploadPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUploadFileApiV1CozeFilesFilesUploadPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file** | ***os.File** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## UploadFileApiV1CozeFilesFilesUploadPost_0

> interface{} UploadFileApiV1CozeFilesFilesUploadPost_0(ctx).File(file).Execute()

Upload File

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
	file := os.NewFile(1234, "some_file") // *os.File | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeFilesAPI.UploadFileApiV1CozeFilesFilesUploadPost_0(context.Background()).File(file).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeFilesAPI.UploadFileApiV1CozeFilesFilesUploadPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UploadFileApiV1CozeFilesFilesUploadPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeFilesAPI.UploadFileApiV1CozeFilesFilesUploadPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUploadFileApiV1CozeFilesFilesUploadPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file** | ***os.File** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

