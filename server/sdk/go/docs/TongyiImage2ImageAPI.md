# \TongyiImage2ImageAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost**](TongyiImage2ImageAPI.md#BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost) | **Post** /api/v1/tongyi-image2image/background-generation | 通义背景生成
[**BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0**](TongyiImage2ImageAPI.md#BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0) | **Post** /api/v1/tongyi-image2image/background-generation | 通义背景生成
[**ImageToImageApiV1TongyiImage2imageImageToImagePost**](TongyiImage2ImageAPI.md#ImageToImageApiV1TongyiImage2imageImageToImagePost) | **Post** /api/v1/tongyi-image2image/image-to-image | 通义图生图
[**ImageToImageApiV1TongyiImage2imageImageToImagePost_0**](TongyiImage2ImageAPI.md#ImageToImageApiV1TongyiImage2imageImageToImagePost_0) | **Post** /api/v1/tongyi-image2image/image-to-image | 通义图生图
[**StyleTransferApiV1TongyiImage2imageStyleTransferPost**](TongyiImage2ImageAPI.md#StyleTransferApiV1TongyiImage2imageStyleTransferPost) | **Post** /api/v1/tongyi-image2image/style-transfer | 通义风格迁移
[**StyleTransferApiV1TongyiImage2imageStyleTransferPost_0**](TongyiImage2ImageAPI.md#StyleTransferApiV1TongyiImage2imageStyleTransferPost_0) | **Post** /api/v1/tongyi-image2image/style-transfer | 通义风格迁移
[**TongyiImage2imageListModels**](TongyiImage2ImageAPI.md#TongyiImage2imageListModels) | **Get** /api/v1/tongyi-image2image/models | 通义图生图可用模型
[**TongyiImage2imageListModels_0**](TongyiImage2ImageAPI.md#TongyiImage2imageListModels_0) | **Get** /api/v1/tongyi-image2image/models | 通义图生图可用模型
[**VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost**](TongyiImage2ImageAPI.md#VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost) | **Post** /api/v1/tongyi-image2image/virtual-try-on | 通义虚拟试衣
[**VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0**](TongyiImage2ImageAPI.md#VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0) | **Post** /api/v1/tongyi-image2image/virtual-try-on | 通义虚拟试衣



## BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost

> interface{} BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost(ctx).BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost(bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost).ApiKey(apiKey).Execute()

通义背景生成

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
	bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost := *openapiclient.NewBodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost("ImageUrl_example") // BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TongyiImage2ImageAPI.BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost(context.Background()).BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost(bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TongyiImage2ImageAPI.BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TongyiImage2ImageAPI.BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost** | [**BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost**](BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost.md) |  | 
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


## BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0

> interface{} BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0(ctx).BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost(bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost).ApiKey(apiKey).Execute()

通义背景生成

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
	bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost := *openapiclient.NewBodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost("ImageUrl_example") // BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TongyiImage2ImageAPI.BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0(context.Background()).BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost(bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TongyiImage2ImageAPI.BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TongyiImage2ImageAPI.BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost** | [**BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost**](BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost.md) |  | 
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


## ImageToImageApiV1TongyiImage2imageImageToImagePost

> interface{} ImageToImageApiV1TongyiImage2imageImageToImagePost(ctx).BodyImageToImageApiV1TongyiImage2imageImageToImagePost(bodyImageToImageApiV1TongyiImage2imageImageToImagePost).ApiKey(apiKey).Execute()

通义图生图

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
	bodyImageToImageApiV1TongyiImage2imageImageToImagePost := *openapiclient.NewBodyImageToImageApiV1TongyiImage2imageImageToImagePost("ImageUrl_example", "Prompt_example") // BodyImageToImageApiV1TongyiImage2imageImageToImagePost | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TongyiImage2ImageAPI.ImageToImageApiV1TongyiImage2imageImageToImagePost(context.Background()).BodyImageToImageApiV1TongyiImage2imageImageToImagePost(bodyImageToImageApiV1TongyiImage2imageImageToImagePost).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TongyiImage2ImageAPI.ImageToImageApiV1TongyiImage2imageImageToImagePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ImageToImageApiV1TongyiImage2imageImageToImagePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TongyiImage2ImageAPI.ImageToImageApiV1TongyiImage2imageImageToImagePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiImageToImageApiV1TongyiImage2imageImageToImagePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyImageToImageApiV1TongyiImage2imageImageToImagePost** | [**BodyImageToImageApiV1TongyiImage2imageImageToImagePost**](BodyImageToImageApiV1TongyiImage2imageImageToImagePost.md) |  | 
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


## ImageToImageApiV1TongyiImage2imageImageToImagePost_0

> interface{} ImageToImageApiV1TongyiImage2imageImageToImagePost_0(ctx).BodyImageToImageApiV1TongyiImage2imageImageToImagePost(bodyImageToImageApiV1TongyiImage2imageImageToImagePost).ApiKey(apiKey).Execute()

通义图生图

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
	bodyImageToImageApiV1TongyiImage2imageImageToImagePost := *openapiclient.NewBodyImageToImageApiV1TongyiImage2imageImageToImagePost("ImageUrl_example", "Prompt_example") // BodyImageToImageApiV1TongyiImage2imageImageToImagePost | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TongyiImage2ImageAPI.ImageToImageApiV1TongyiImage2imageImageToImagePost_0(context.Background()).BodyImageToImageApiV1TongyiImage2imageImageToImagePost(bodyImageToImageApiV1TongyiImage2imageImageToImagePost).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TongyiImage2ImageAPI.ImageToImageApiV1TongyiImage2imageImageToImagePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ImageToImageApiV1TongyiImage2imageImageToImagePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TongyiImage2ImageAPI.ImageToImageApiV1TongyiImage2imageImageToImagePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiImageToImageApiV1TongyiImage2imageImageToImagePost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyImageToImageApiV1TongyiImage2imageImageToImagePost** | [**BodyImageToImageApiV1TongyiImage2imageImageToImagePost**](BodyImageToImageApiV1TongyiImage2imageImageToImagePost.md) |  | 
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


## StyleTransferApiV1TongyiImage2imageStyleTransferPost

> interface{} StyleTransferApiV1TongyiImage2imageStyleTransferPost(ctx).BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost(bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost).ApiKey(apiKey).Execute()

通义风格迁移

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
	bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost := *openapiclient.NewBodyStyleTransferApiV1TongyiImage2imageStyleTransferPost("ImageUrl_example", "StyleRefUrl_example") // BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TongyiImage2ImageAPI.StyleTransferApiV1TongyiImage2imageStyleTransferPost(context.Background()).BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost(bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TongyiImage2ImageAPI.StyleTransferApiV1TongyiImage2imageStyleTransferPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StyleTransferApiV1TongyiImage2imageStyleTransferPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TongyiImage2ImageAPI.StyleTransferApiV1TongyiImage2imageStyleTransferPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiStyleTransferApiV1TongyiImage2imageStyleTransferPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost** | [**BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost**](BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost.md) |  | 
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


## StyleTransferApiV1TongyiImage2imageStyleTransferPost_0

> interface{} StyleTransferApiV1TongyiImage2imageStyleTransferPost_0(ctx).BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost(bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost).ApiKey(apiKey).Execute()

通义风格迁移

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
	bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost := *openapiclient.NewBodyStyleTransferApiV1TongyiImage2imageStyleTransferPost("ImageUrl_example", "StyleRefUrl_example") // BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TongyiImage2ImageAPI.StyleTransferApiV1TongyiImage2imageStyleTransferPost_0(context.Background()).BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost(bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TongyiImage2ImageAPI.StyleTransferApiV1TongyiImage2imageStyleTransferPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StyleTransferApiV1TongyiImage2imageStyleTransferPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TongyiImage2ImageAPI.StyleTransferApiV1TongyiImage2imageStyleTransferPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiStyleTransferApiV1TongyiImage2imageStyleTransferPost_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost** | [**BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost**](BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost.md) |  | 
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


## TongyiImage2imageListModels

> interface{} TongyiImage2imageListModels(ctx).Execute()

通义图生图可用模型

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
	resp, r, err := apiClient.TongyiImage2ImageAPI.TongyiImage2imageListModels(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TongyiImage2ImageAPI.TongyiImage2imageListModels``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TongyiImage2imageListModels`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TongyiImage2ImageAPI.TongyiImage2imageListModels`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiTongyiImage2imageListModelsRequest struct via the builder pattern


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


## TongyiImage2imageListModels_0

> interface{} TongyiImage2imageListModels_0(ctx).Execute()

通义图生图可用模型

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
	resp, r, err := apiClient.TongyiImage2ImageAPI.TongyiImage2imageListModels_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TongyiImage2ImageAPI.TongyiImage2imageListModels_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TongyiImage2imageListModels_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TongyiImage2ImageAPI.TongyiImage2imageListModels_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiTongyiImage2imageListModels_4Request struct via the builder pattern


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


## VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost

> interface{} VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost(ctx).BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost(bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost).ApiKey(apiKey).Execute()

通义虚拟试衣

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
	bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost := *openapiclient.NewBodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost("PersonImageUrl_example") // BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TongyiImage2ImageAPI.VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost(context.Background()).BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost(bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TongyiImage2ImageAPI.VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TongyiImage2ImageAPI.VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost** | [**BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost**](BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost.md) |  | 
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


## VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0

> interface{} VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0(ctx).BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost(bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost).ApiKey(apiKey).Execute()

通义虚拟试衣

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
	bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost := *openapiclient.NewBodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost("PersonImageUrl_example") // BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TongyiImage2ImageAPI.VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0(context.Background()).BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost(bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TongyiImage2ImageAPI.VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TongyiImage2ImageAPI.VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost** | [**BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost**](BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost.md) |  | 
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

