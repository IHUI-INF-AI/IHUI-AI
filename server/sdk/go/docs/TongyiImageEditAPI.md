# \TongyiImageEditAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**TextToImageApiV1TongyiImageEditTextToImagePost**](TongyiImageEditAPI.md#TextToImageApiV1TongyiImageEditTextToImagePost) | **Post** /api/v1/tongyi-image-edit/text-to-image | 通义文生图
[**TextToImageApiV1TongyiImageEditTextToImagePost_0**](TongyiImageEditAPI.md#TextToImageApiV1TongyiImageEditTextToImagePost_0) | **Post** /api/v1/tongyi-image-edit/text-to-image | 通义文生图
[**TongyiImageEdit**](TongyiImageEditAPI.md#TongyiImageEdit) | **Post** /api/v1/tongyi-image-edit/image-edit | 通义图像编辑
[**TongyiImageEditListModels**](TongyiImageEditAPI.md#TongyiImageEditListModels) | **Get** /api/v1/tongyi-image-edit/models | 通义可用模型
[**TongyiImageEditListModels_0**](TongyiImageEditAPI.md#TongyiImageEditListModels_0) | **Get** /api/v1/tongyi-image-edit/models | 通义可用模型
[**TongyiImageEdit_0**](TongyiImageEditAPI.md#TongyiImageEdit_0) | **Post** /api/v1/tongyi-image-edit/image-edit | 通义图像编辑



## TextToImageApiV1TongyiImageEditTextToImagePost

> interface{} TextToImageApiV1TongyiImageEditTextToImagePost(ctx).BodyTextToImageApiV1TongyiImageEditTextToImagePost(bodyTextToImageApiV1TongyiImageEditTextToImagePost).ApiKey(apiKey).Execute()

通义文生图

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
	bodyTextToImageApiV1TongyiImageEditTextToImagePost := *openapiclient.NewBodyTextToImageApiV1TongyiImageEditTextToImagePost("Prompt_example") // BodyTextToImageApiV1TongyiImageEditTextToImagePost | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TongyiImageEditAPI.TextToImageApiV1TongyiImageEditTextToImagePost(context.Background()).BodyTextToImageApiV1TongyiImageEditTextToImagePost(bodyTextToImageApiV1TongyiImageEditTextToImagePost).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TongyiImageEditAPI.TextToImageApiV1TongyiImageEditTextToImagePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TextToImageApiV1TongyiImageEditTextToImagePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TongyiImageEditAPI.TextToImageApiV1TongyiImageEditTextToImagePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTextToImageApiV1TongyiImageEditTextToImagePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyTextToImageApiV1TongyiImageEditTextToImagePost** | [**BodyTextToImageApiV1TongyiImageEditTextToImagePost**](BodyTextToImageApiV1TongyiImageEditTextToImagePost.md) |  | 
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


## TextToImageApiV1TongyiImageEditTextToImagePost_0

> interface{} TextToImageApiV1TongyiImageEditTextToImagePost_0(ctx).BodyTextToImageApiV1TongyiImageEditTextToImagePost(bodyTextToImageApiV1TongyiImageEditTextToImagePost).ApiKey(apiKey).Execute()

通义文生图

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
	bodyTextToImageApiV1TongyiImageEditTextToImagePost := *openapiclient.NewBodyTextToImageApiV1TongyiImageEditTextToImagePost("Prompt_example") // BodyTextToImageApiV1TongyiImageEditTextToImagePost | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TongyiImageEditAPI.TextToImageApiV1TongyiImageEditTextToImagePost_0(context.Background()).BodyTextToImageApiV1TongyiImageEditTextToImagePost(bodyTextToImageApiV1TongyiImageEditTextToImagePost).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TongyiImageEditAPI.TextToImageApiV1TongyiImageEditTextToImagePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TextToImageApiV1TongyiImageEditTextToImagePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TongyiImageEditAPI.TextToImageApiV1TongyiImageEditTextToImagePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTextToImageApiV1TongyiImageEditTextToImagePost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyTextToImageApiV1TongyiImageEditTextToImagePost** | [**BodyTextToImageApiV1TongyiImageEditTextToImagePost**](BodyTextToImageApiV1TongyiImageEditTextToImagePost.md) |  | 
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


## TongyiImageEdit

> interface{} TongyiImageEdit(ctx).BodyTongyiImageEdit(bodyTongyiImageEdit).ApiKey(apiKey).Execute()

通义图像编辑

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
	bodyTongyiImageEdit := *openapiclient.NewBodyTongyiImageEdit("Prompt_example") // BodyTongyiImageEdit | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TongyiImageEditAPI.TongyiImageEdit(context.Background()).BodyTongyiImageEdit(bodyTongyiImageEdit).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TongyiImageEditAPI.TongyiImageEdit``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TongyiImageEdit`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TongyiImageEditAPI.TongyiImageEdit`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTongyiImageEditRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyTongyiImageEdit** | [**BodyTongyiImageEdit**](BodyTongyiImageEdit.md) |  | 
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


## TongyiImageEditListModels

> interface{} TongyiImageEditListModels(ctx).Execute()

通义可用模型

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
	resp, r, err := apiClient.TongyiImageEditAPI.TongyiImageEditListModels(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TongyiImageEditAPI.TongyiImageEditListModels``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TongyiImageEditListModels`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TongyiImageEditAPI.TongyiImageEditListModels`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiTongyiImageEditListModelsRequest struct via the builder pattern


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


## TongyiImageEditListModels_0

> interface{} TongyiImageEditListModels_0(ctx).Execute()

通义可用模型

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
	resp, r, err := apiClient.TongyiImageEditAPI.TongyiImageEditListModels_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TongyiImageEditAPI.TongyiImageEditListModels_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TongyiImageEditListModels_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TongyiImageEditAPI.TongyiImageEditListModels_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiTongyiImageEditListModels_2Request struct via the builder pattern


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


## TongyiImageEdit_0

> interface{} TongyiImageEdit_0(ctx).BodyTongyiImageEdit(bodyTongyiImageEdit).ApiKey(apiKey).Execute()

通义图像编辑

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
	bodyTongyiImageEdit := *openapiclient.NewBodyTongyiImageEdit("Prompt_example") // BodyTongyiImageEdit | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TongyiImageEditAPI.TongyiImageEdit_0(context.Background()).BodyTongyiImageEdit(bodyTongyiImageEdit).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TongyiImageEditAPI.TongyiImageEdit_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TongyiImageEdit_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TongyiImageEditAPI.TongyiImageEdit_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTongyiImageEdit_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyTongyiImageEdit** | [**BodyTongyiImageEdit**](BodyTongyiImageEdit.md) |  | 
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

