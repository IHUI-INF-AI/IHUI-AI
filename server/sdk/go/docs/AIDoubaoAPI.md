# \AIDoubaoAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**DoubaoChatApiV1AiDoubaoChatPost**](AIDoubaoAPI.md#DoubaoChatApiV1AiDoubaoChatPost) | **Post** /api/v1/ai/doubao/chat | Doubao chat completion
[**DoubaoImageEditApiV1AiDoubaoImageEditPost**](AIDoubaoAPI.md#DoubaoImageEditApiV1AiDoubaoImageEditPost) | **Post** /api/v1/ai/doubao/image/edit | 豆包图片编辑
[**DoubaoImageGenerateApiV1AiDoubaoImageGeneratePost**](AIDoubaoAPI.md#DoubaoImageGenerateApiV1AiDoubaoImageGeneratePost) | **Post** /api/v1/ai/doubao/image/generate | 豆包图片生成 (即梦 jimeng_t2i_v40)
[**DoubaoSeedreamApiV1AiDoubaoImageSeedreamPost**](AIDoubaoAPI.md#DoubaoSeedreamApiV1AiDoubaoImageSeedreamPost) | **Post** /api/v1/ai/doubao/image/seedream | Seedream 图片生成
[**DoubaoStreamApiV1AiDoubaoChatStreamPost**](AIDoubaoAPI.md#DoubaoStreamApiV1AiDoubaoChatStreamPost) | **Post** /api/v1/ai/doubao/chat/stream | Doubao streaming chat
[**DoubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost**](AIDoubaoAPI.md#DoubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost) | **Post** /api/v1/ai/doubao/video/generate | 豆包视频生成 (Seedance, async)



## DoubaoChatApiV1AiDoubaoChatPost

> interface{} DoubaoChatApiV1AiDoubaoChatPost(ctx).Message(message).Model(model).Execute()

Doubao chat completion

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
	message := "message_example" // string | 
	model := "model_example" // string |  (optional) (default to "doubao-pro-32k")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIDoubaoAPI.DoubaoChatApiV1AiDoubaoChatPost(context.Background()).Message(message).Model(model).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIDoubaoAPI.DoubaoChatApiV1AiDoubaoChatPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DoubaoChatApiV1AiDoubaoChatPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIDoubaoAPI.DoubaoChatApiV1AiDoubaoChatPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDoubaoChatApiV1AiDoubaoChatPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **message** | **string** |  | 
 **model** | **string** |  | [default to &quot;doubao-pro-32k&quot;]

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


## DoubaoImageEditApiV1AiDoubaoImageEditPost

> interface{} DoubaoImageEditApiV1AiDoubaoImageEditPost(ctx).Prompt(prompt).Image(image).Mask(mask).Model(model).Size(size).N(n).Strength(strength).ResponseFormat(responseFormat).Execute()

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
	prompt := "prompt_example" // string | 编辑指令 prompt
	image := os.NewFile(1234, "some_file") // *os.File | 待编辑的原始图片
	mask := os.NewFile(1234, "some_file") // *os.File | 遮罩图片（可选），标记需要编辑的区域 (optional)
	model := "model_example" // string | 图片编辑模型名称 (optional) (default to "doubao-seedream-3-0-i2i-250415")
	size := "size_example" // string | 输出图片尺寸 (optional) (default to "1024x1024")
	n := int32(56) // int32 | 生成数量 (optional) (default to 1)
	strength := float32(8.14) // float32 | 编辑强度，0-1 (optional) (default to 0.8)
	responseFormat := "responseFormat_example" // string | 返回格式: url / b64_json (optional) (default to "url")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIDoubaoAPI.DoubaoImageEditApiV1AiDoubaoImageEditPost(context.Background()).Prompt(prompt).Image(image).Mask(mask).Model(model).Size(size).N(n).Strength(strength).ResponseFormat(responseFormat).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIDoubaoAPI.DoubaoImageEditApiV1AiDoubaoImageEditPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DoubaoImageEditApiV1AiDoubaoImageEditPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIDoubaoAPI.DoubaoImageEditApiV1AiDoubaoImageEditPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDoubaoImageEditApiV1AiDoubaoImageEditPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **prompt** | **string** | 编辑指令 prompt | 
 **image** | ***os.File** | 待编辑的原始图片 | 
 **mask** | ***os.File** | 遮罩图片（可选），标记需要编辑的区域 | 
 **model** | **string** | 图片编辑模型名称 | [default to &quot;doubao-seedream-3-0-i2i-250415&quot;]
 **size** | **string** | 输出图片尺寸 | [default to &quot;1024x1024&quot;]
 **n** | **int32** | 生成数量 | [default to 1]
 **strength** | **float32** | 编辑强度，0-1 | [default to 0.8]
 **responseFormat** | **string** | 返回格式: url / b64_json | [default to &quot;url&quot;]

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DoubaoImageGenerateApiV1AiDoubaoImageGeneratePost

> interface{} DoubaoImageGenerateApiV1AiDoubaoImageGeneratePost(ctx).DoubaoImageRequest(doubaoImageRequest).Execute()

豆包图片生成 (即梦 jimeng_t2i_v40)



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
	doubaoImageRequest := *openapiclient.NewDoubaoImageRequest("Prompt_example", "UserUuid_example") // DoubaoImageRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIDoubaoAPI.DoubaoImageGenerateApiV1AiDoubaoImageGeneratePost(context.Background()).DoubaoImageRequest(doubaoImageRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIDoubaoAPI.DoubaoImageGenerateApiV1AiDoubaoImageGeneratePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DoubaoImageGenerateApiV1AiDoubaoImageGeneratePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIDoubaoAPI.DoubaoImageGenerateApiV1AiDoubaoImageGeneratePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDoubaoImageGenerateApiV1AiDoubaoImageGeneratePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **doubaoImageRequest** | [**DoubaoImageRequest**](DoubaoImageRequest.md) |  | 

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


## DoubaoSeedreamApiV1AiDoubaoImageSeedreamPost

> interface{} DoubaoSeedreamApiV1AiDoubaoImageSeedreamPost(ctx).SeedreamImageRequest(seedreamImageRequest).Execute()

Seedream 图片生成



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
	seedreamImageRequest := *openapiclient.NewSeedreamImageRequest("Prompt_example", "UserUuid_example") // SeedreamImageRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIDoubaoAPI.DoubaoSeedreamApiV1AiDoubaoImageSeedreamPost(context.Background()).SeedreamImageRequest(seedreamImageRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIDoubaoAPI.DoubaoSeedreamApiV1AiDoubaoImageSeedreamPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DoubaoSeedreamApiV1AiDoubaoImageSeedreamPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIDoubaoAPI.DoubaoSeedreamApiV1AiDoubaoImageSeedreamPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDoubaoSeedreamApiV1AiDoubaoImageSeedreamPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **seedreamImageRequest** | [**SeedreamImageRequest**](SeedreamImageRequest.md) |  | 

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


## DoubaoStreamApiV1AiDoubaoChatStreamPost

> interface{} DoubaoStreamApiV1AiDoubaoChatStreamPost(ctx).Message(message).Model(model).Execute()

Doubao streaming chat

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
	message := "message_example" // string | 
	model := "model_example" // string |  (optional) (default to "doubao-pro-32k")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIDoubaoAPI.DoubaoStreamApiV1AiDoubaoChatStreamPost(context.Background()).Message(message).Model(model).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIDoubaoAPI.DoubaoStreamApiV1AiDoubaoChatStreamPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DoubaoStreamApiV1AiDoubaoChatStreamPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIDoubaoAPI.DoubaoStreamApiV1AiDoubaoChatStreamPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDoubaoStreamApiV1AiDoubaoChatStreamPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **message** | **string** |  | 
 **model** | **string** |  | [default to &quot;doubao-pro-32k&quot;]

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


## DoubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost

> interface{} DoubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost(ctx).VideoGenerateRequest(videoGenerateRequest).Execute()

豆包视频生成 (Seedance, async)



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
	videoGenerateRequest := *openapiclient.NewVideoGenerateRequest("Prompt_example", "UserUuid_example") // VideoGenerateRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIDoubaoAPI.DoubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost(context.Background()).VideoGenerateRequest(videoGenerateRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIDoubaoAPI.DoubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DoubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIDoubaoAPI.DoubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDoubaoVideoGenerateApiV1AiDoubaoVideoGeneratePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **videoGenerateRequest** | [**VideoGenerateRequest**](VideoGenerateRequest.md) |  | 

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

