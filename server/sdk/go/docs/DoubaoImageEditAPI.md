# \DoubaoImageEditAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**DoubaoImageEdit**](DoubaoImageEditAPI.md#DoubaoImageEdit) | **Post** /api/v1/doubao-image-edit/image-edit | 豆包图片编辑
[**DoubaoImageEditListModels**](DoubaoImageEditAPI.md#DoubaoImageEditListModels) | **Get** /api/v1/doubao-image-edit/models | 豆包可用模型
[**DoubaoImageEditListModels_0**](DoubaoImageEditAPI.md#DoubaoImageEditListModels_0) | **Get** /api/v1/doubao-image-edit/models | 豆包可用模型
[**DoubaoImageEdit_0**](DoubaoImageEditAPI.md#DoubaoImageEdit_0) | **Post** /api/v1/doubao-image-edit/image-edit | 豆包图片编辑
[**ImageGenerateApiV1DoubaoImageEditImageGeneratePost**](DoubaoImageEditAPI.md#ImageGenerateApiV1DoubaoImageEditImageGeneratePost) | **Post** /api/v1/doubao-image-edit/image-generate | 豆包文生图
[**ImageGenerateApiV1DoubaoImageEditImageGeneratePost_0**](DoubaoImageEditAPI.md#ImageGenerateApiV1DoubaoImageEditImageGeneratePost_0) | **Post** /api/v1/doubao-image-edit/image-generate | 豆包文生图



## DoubaoImageEdit

> interface{} DoubaoImageEdit(ctx).BodyDoubaoImageEdit(bodyDoubaoImageEdit).ApiKey(apiKey).Execute()

豆包图片编辑

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
	bodyDoubaoImageEdit := *openapiclient.NewBodyDoubaoImageEdit("Prompt_example") // BodyDoubaoImageEdit | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.DoubaoImageEditAPI.DoubaoImageEdit(context.Background()).BodyDoubaoImageEdit(bodyDoubaoImageEdit).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `DoubaoImageEditAPI.DoubaoImageEdit``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DoubaoImageEdit`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `DoubaoImageEditAPI.DoubaoImageEdit`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDoubaoImageEditRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyDoubaoImageEdit** | [**BodyDoubaoImageEdit**](BodyDoubaoImageEdit.md) |  | 
 **apiKey** | **string** |  | 

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


## DoubaoImageEditListModels

> interface{} DoubaoImageEditListModels(ctx).Execute()

豆包可用模型

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.DoubaoImageEditAPI.DoubaoImageEditListModels(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `DoubaoImageEditAPI.DoubaoImageEditListModels``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DoubaoImageEditListModels`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `DoubaoImageEditAPI.DoubaoImageEditListModels`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiDoubaoImageEditListModelsRequest struct via the builder pattern


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


## DoubaoImageEditListModels_0

> interface{} DoubaoImageEditListModels_0(ctx).Execute()

豆包可用模型

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.DoubaoImageEditAPI.DoubaoImageEditListModels_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `DoubaoImageEditAPI.DoubaoImageEditListModels_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DoubaoImageEditListModels_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `DoubaoImageEditAPI.DoubaoImageEditListModels_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiDoubaoImageEditListModels_1Request struct via the builder pattern


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


## DoubaoImageEdit_0

> interface{} DoubaoImageEdit_0(ctx).BodyDoubaoImageEdit(bodyDoubaoImageEdit).ApiKey(apiKey).Execute()

豆包图片编辑

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
	bodyDoubaoImageEdit := *openapiclient.NewBodyDoubaoImageEdit("Prompt_example") // BodyDoubaoImageEdit | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.DoubaoImageEditAPI.DoubaoImageEdit_0(context.Background()).BodyDoubaoImageEdit(bodyDoubaoImageEdit).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `DoubaoImageEditAPI.DoubaoImageEdit_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DoubaoImageEdit_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `DoubaoImageEditAPI.DoubaoImageEdit_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDoubaoImageEdit_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyDoubaoImageEdit** | [**BodyDoubaoImageEdit**](BodyDoubaoImageEdit.md) |  | 
 **apiKey** | **string** |  | 

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


## ImageGenerateApiV1DoubaoImageEditImageGeneratePost

> interface{} ImageGenerateApiV1DoubaoImageEditImageGeneratePost(ctx).BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost(bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost).ApiKey(apiKey).Execute()

豆包文生图

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
	bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost := *openapiclient.NewBodyImageGenerateApiV1DoubaoImageEditImageGeneratePost("Prompt_example") // BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.DoubaoImageEditAPI.ImageGenerateApiV1DoubaoImageEditImageGeneratePost(context.Background()).BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost(bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `DoubaoImageEditAPI.ImageGenerateApiV1DoubaoImageEditImageGeneratePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ImageGenerateApiV1DoubaoImageEditImageGeneratePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `DoubaoImageEditAPI.ImageGenerateApiV1DoubaoImageEditImageGeneratePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiImageGenerateApiV1DoubaoImageEditImageGeneratePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost** | [**BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost**](BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost.md) |  | 
 **apiKey** | **string** |  | 

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


## ImageGenerateApiV1DoubaoImageEditImageGeneratePost_0

> interface{} ImageGenerateApiV1DoubaoImageEditImageGeneratePost_0(ctx).BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost(bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost).ApiKey(apiKey).Execute()

豆包文生图

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
	bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost := *openapiclient.NewBodyImageGenerateApiV1DoubaoImageEditImageGeneratePost("Prompt_example") // BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.DoubaoImageEditAPI.ImageGenerateApiV1DoubaoImageEditImageGeneratePost_0(context.Background()).BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost(bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `DoubaoImageEditAPI.ImageGenerateApiV1DoubaoImageEditImageGeneratePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ImageGenerateApiV1DoubaoImageEditImageGeneratePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `DoubaoImageEditAPI.ImageGenerateApiV1DoubaoImageEditImageGeneratePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiImageGenerateApiV1DoubaoImageEditImageGeneratePost_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost** | [**BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost**](BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost.md) |  | 
 **apiKey** | **string** |  | 

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

