# \FileUploadAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**UploadBase64FileApiV1CozeZhsApiFileUploadBase64Post**](FileUploadAPI.md#UploadBase64FileApiV1CozeZhsApiFileUploadBase64Post) | **Post** /api/v1/cozeZhsApi/file/upload/base64 | Upload base64 file
[**UploadFormFileApiV1CozeZhsApiFileUploadFormPost**](FileUploadAPI.md#UploadFormFileApiV1CozeZhsApiFileUploadFormPost) | **Post** /api/v1/cozeZhsApi/file/upload/form | Upload file via form-data
[**UploadOctetFileApiV1CozeZhsApiFileUploadOctetPost**](FileUploadAPI.md#UploadOctetFileApiV1CozeZhsApiFileUploadOctetPost) | **Post** /api/v1/cozeZhsApi/file/upload/octet | Upload file via octet-stream



## UploadBase64FileApiV1CozeZhsApiFileUploadBase64Post

> interface{} UploadBase64FileApiV1CozeZhsApiFileUploadBase64Post(ctx).Base64UploadRequest(base64UploadRequest).Execute()

Upload base64 file



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
	base64UploadRequest := *openapiclient.NewBase64UploadRequest("FileName_example", "Base64_example") // Base64UploadRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FileUploadAPI.UploadBase64FileApiV1CozeZhsApiFileUploadBase64Post(context.Background()).Base64UploadRequest(base64UploadRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FileUploadAPI.UploadBase64FileApiV1CozeZhsApiFileUploadBase64Post``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UploadBase64FileApiV1CozeZhsApiFileUploadBase64Post`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FileUploadAPI.UploadBase64FileApiV1CozeZhsApiFileUploadBase64Post`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUploadBase64FileApiV1CozeZhsApiFileUploadBase64PostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **base64UploadRequest** | [**Base64UploadRequest**](Base64UploadRequest.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## UploadFormFileApiV1CozeZhsApiFileUploadFormPost

> interface{} UploadFormFileApiV1CozeZhsApiFileUploadFormPost(ctx).File(file).Execute()

Upload file via form-data



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
	resp, r, err := apiClient.FileUploadAPI.UploadFormFileApiV1CozeZhsApiFileUploadFormPost(context.Background()).File(file).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FileUploadAPI.UploadFormFileApiV1CozeZhsApiFileUploadFormPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UploadFormFileApiV1CozeZhsApiFileUploadFormPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FileUploadAPI.UploadFormFileApiV1CozeZhsApiFileUploadFormPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUploadFormFileApiV1CozeZhsApiFileUploadFormPostRequest struct via the builder pattern


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


## UploadOctetFileApiV1CozeZhsApiFileUploadOctetPost

> interface{} UploadOctetFileApiV1CozeZhsApiFileUploadOctetPost(ctx).FileName(fileName).Execute()

Upload file via octet-stream



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
	fileName := "fileName_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FileUploadAPI.UploadOctetFileApiV1CozeZhsApiFileUploadOctetPost(context.Background()).FileName(fileName).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FileUploadAPI.UploadOctetFileApiV1CozeZhsApiFileUploadOctetPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UploadOctetFileApiV1CozeZhsApiFileUploadOctetPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FileUploadAPI.UploadOctetFileApiV1CozeZhsApiFileUploadOctetPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUploadOctetFileApiV1CozeZhsApiFileUploadOctetPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fileName** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

