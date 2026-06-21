# \AIDashScopeAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AudioModelsApiV1AiDashscopeAudioModelsGet**](AIDashScopeAPI.md#AudioModelsApiV1AiDashscopeAudioModelsGet) | **Get** /api/v1/ai/dashscope/audio/models | List supported ASR models
[**AudioRecognizeApiV1AiDashscopeAudioRecognizePost**](AIDashScopeAPI.md#AudioRecognizeApiV1AiDashscopeAudioRecognizePost) | **Post** /api/v1/ai/dashscope/audio/recognize | Audio speech recognition
[**DashscopeChatApiV1AiDashscopeChatPost**](AIDashScopeAPI.md#DashscopeChatApiV1AiDashscopeChatPost) | **Post** /api/v1/ai/dashscope/chat | DashScope chat completion
[**DashscopeStreamApiV1AiDashscopeChatStreamPost**](AIDashScopeAPI.md#DashscopeStreamApiV1AiDashscopeChatStreamPost) | **Post** /api/v1/ai/dashscope/chat/stream | DashScope streaming chat
[**ImageEditApiV1AiDashscopeImageEditPost**](AIDashScopeAPI.md#ImageEditApiV1AiDashscopeImageEditPost) | **Post** /api/v1/ai/dashscope/image/edit | DashScope image editing (standard)
[**ImageEditSimpleApiV1AiDashscopeImageEditSimplePost**](AIDashScopeAPI.md#ImageEditSimpleApiV1AiDashscopeImageEditSimplePost) | **Post** /api/v1/ai/dashscope/image/edit/simple | Simple DashScope image editing
[**ImageGenerateApiV1AiDashscopeImageGenerateModelPost**](AIDashScopeAPI.md#ImageGenerateApiV1AiDashscopeImageGenerateModelPost) | **Post** /api/v1/ai/dashscope/image/generate/{model} | DashScope image generation
[**ImageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet**](AIDashScopeAPI.md#ImageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet) | **Get** /api/v1/ai/dashscope/image/task/{task_id} | Query image generation task status
[**ImageToImageApiV1AiDashscopeImageToImagePost**](AIDashScopeAPI.md#ImageToImageApiV1AiDashscopeImageToImagePost) | **Post** /api/v1/ai/dashscope/image-to-image | DashScope image-to-image
[**VideoSynthesisApiV1AiDashscopeVideoSynthesisPost**](AIDashScopeAPI.md#VideoSynthesisApiV1AiDashscopeVideoSynthesisPost) | **Post** /api/v1/ai/dashscope/video/synthesis | Submit video synthesis task
[**VideoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet**](AIDashScopeAPI.md#VideoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet) | **Get** /api/v1/ai/dashscope/video/tasks/{task_id} | Query video synthesis task status
[**VisionChatApiV1AiDashscopeVisionChatPost**](AIDashScopeAPI.md#VisionChatApiV1AiDashscopeVisionChatPost) | **Post** /api/v1/ai/dashscope/vision/chat | Vision multi-modal chat



## AudioModelsApiV1AiDashscopeAudioModelsGet

> interface{} AudioModelsApiV1AiDashscopeAudioModelsGet(ctx).Execute()

List supported ASR models



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
	resp, r, err := apiClient.AIDashScopeAPI.AudioModelsApiV1AiDashscopeAudioModelsGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIDashScopeAPI.AudioModelsApiV1AiDashscopeAudioModelsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AudioModelsApiV1AiDashscopeAudioModelsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIDashScopeAPI.AudioModelsApiV1AiDashscopeAudioModelsGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiAudioModelsApiV1AiDashscopeAudioModelsGetRequest struct via the builder pattern


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


## AudioRecognizeApiV1AiDashscopeAudioRecognizePost

> interface{} AudioRecognizeApiV1AiDashscopeAudioRecognizePost(ctx).AudioRecognizeRequest(audioRecognizeRequest).Execute()

Audio speech recognition



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
	audioRecognizeRequest := *openapiclient.NewAudioRecognizeRequest("AudioUrl_example") // AudioRecognizeRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIDashScopeAPI.AudioRecognizeApiV1AiDashscopeAudioRecognizePost(context.Background()).AudioRecognizeRequest(audioRecognizeRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIDashScopeAPI.AudioRecognizeApiV1AiDashscopeAudioRecognizePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AudioRecognizeApiV1AiDashscopeAudioRecognizePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIDashScopeAPI.AudioRecognizeApiV1AiDashscopeAudioRecognizePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAudioRecognizeApiV1AiDashscopeAudioRecognizePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **audioRecognizeRequest** | [**AudioRecognizeRequest**](AudioRecognizeRequest.md) |  | 

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


## DashscopeChatApiV1AiDashscopeChatPost

> interface{} DashscopeChatApiV1AiDashscopeChatPost(ctx).Message(message).Model(model).Execute()

DashScope chat completion

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
	model := "model_example" // string |  (optional) (default to "qwen-turbo")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIDashScopeAPI.DashscopeChatApiV1AiDashscopeChatPost(context.Background()).Message(message).Model(model).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIDashScopeAPI.DashscopeChatApiV1AiDashscopeChatPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DashscopeChatApiV1AiDashscopeChatPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIDashScopeAPI.DashscopeChatApiV1AiDashscopeChatPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDashscopeChatApiV1AiDashscopeChatPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **message** | **string** |  | 
 **model** | **string** |  | [default to &quot;qwen-turbo&quot;]

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


## DashscopeStreamApiV1AiDashscopeChatStreamPost

> interface{} DashscopeStreamApiV1AiDashscopeChatStreamPost(ctx).Message(message).Model(model).Execute()

DashScope streaming chat

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
	model := "model_example" // string |  (optional) (default to "qwen-turbo")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIDashScopeAPI.DashscopeStreamApiV1AiDashscopeChatStreamPost(context.Background()).Message(message).Model(model).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIDashScopeAPI.DashscopeStreamApiV1AiDashscopeChatStreamPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DashscopeStreamApiV1AiDashscopeChatStreamPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIDashScopeAPI.DashscopeStreamApiV1AiDashscopeChatStreamPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDashscopeStreamApiV1AiDashscopeChatStreamPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **message** | **string** |  | 
 **model** | **string** |  | [default to &quot;qwen-turbo&quot;]

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


## ImageEditApiV1AiDashscopeImageEditPost

> interface{} ImageEditApiV1AiDashscopeImageEditPost(ctx).ImageEditBody(imageEditBody).Execute()

DashScope image editing (standard)



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
	imageEditBody := *openapiclient.NewImageEditBody("BaseImageUrl_example", "Prompt_example") // ImageEditBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIDashScopeAPI.ImageEditApiV1AiDashscopeImageEditPost(context.Background()).ImageEditBody(imageEditBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIDashScopeAPI.ImageEditApiV1AiDashscopeImageEditPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ImageEditApiV1AiDashscopeImageEditPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIDashScopeAPI.ImageEditApiV1AiDashscopeImageEditPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiImageEditApiV1AiDashscopeImageEditPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **imageEditBody** | [**ImageEditBody**](ImageEditBody.md) |  | 

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


## ImageEditSimpleApiV1AiDashscopeImageEditSimplePost

> interface{} ImageEditSimpleApiV1AiDashscopeImageEditSimplePost(ctx).SimpleEditBody(simpleEditBody).Execute()

Simple DashScope image editing



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
	simpleEditBody := *openapiclient.NewSimpleEditBody("Images_example", "Prompt_example") // SimpleEditBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIDashScopeAPI.ImageEditSimpleApiV1AiDashscopeImageEditSimplePost(context.Background()).SimpleEditBody(simpleEditBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIDashScopeAPI.ImageEditSimpleApiV1AiDashscopeImageEditSimplePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ImageEditSimpleApiV1AiDashscopeImageEditSimplePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIDashScopeAPI.ImageEditSimpleApiV1AiDashscopeImageEditSimplePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiImageEditSimpleApiV1AiDashscopeImageEditSimplePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **simpleEditBody** | [**SimpleEditBody**](SimpleEditBody.md) |  | 

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


## ImageGenerateApiV1AiDashscopeImageGenerateModelPost

> interface{} ImageGenerateApiV1AiDashscopeImageGenerateModelPost(ctx, model).AppApiV1AiDashscopeRouteImageGenerateBody(appApiV1AiDashscopeRouteImageGenerateBody).Execute()

DashScope image generation



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
	model := "model_example" // string | 
	appApiV1AiDashscopeRouteImageGenerateBody := *openapiclient.NewAppApiV1AiDashscopeRouteImageGenerateBody("Prompt_example") // AppApiV1AiDashscopeRouteImageGenerateBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIDashScopeAPI.ImageGenerateApiV1AiDashscopeImageGenerateModelPost(context.Background(), model).AppApiV1AiDashscopeRouteImageGenerateBody(appApiV1AiDashscopeRouteImageGenerateBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIDashScopeAPI.ImageGenerateApiV1AiDashscopeImageGenerateModelPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ImageGenerateApiV1AiDashscopeImageGenerateModelPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIDashScopeAPI.ImageGenerateApiV1AiDashscopeImageGenerateModelPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**model** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiImageGenerateApiV1AiDashscopeImageGenerateModelPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **appApiV1AiDashscopeRouteImageGenerateBody** | [**AppApiV1AiDashscopeRouteImageGenerateBody**](AppApiV1AiDashscopeRouteImageGenerateBody.md) |  | 

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


## ImageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet

> interface{} ImageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet(ctx, taskId).Execute()

Query image generation task status



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
	taskId := "taskId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIDashScopeAPI.ImageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet(context.Background(), taskId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIDashScopeAPI.ImageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ImageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIDashScopeAPI.ImageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**taskId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiImageTaskStatusApiV1AiDashscopeImageTaskTaskIdGetRequest struct via the builder pattern


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


## ImageToImageApiV1AiDashscopeImageToImagePost

> interface{} ImageToImageApiV1AiDashscopeImageToImagePost(ctx).ImageToImageBody(imageToImageBody).Execute()

DashScope image-to-image



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
	imageToImageBody := *openapiclient.NewImageToImageBody("InputImageUrl_example", "Prompt_example") // ImageToImageBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIDashScopeAPI.ImageToImageApiV1AiDashscopeImageToImagePost(context.Background()).ImageToImageBody(imageToImageBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIDashScopeAPI.ImageToImageApiV1AiDashscopeImageToImagePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ImageToImageApiV1AiDashscopeImageToImagePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIDashScopeAPI.ImageToImageApiV1AiDashscopeImageToImagePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiImageToImageApiV1AiDashscopeImageToImagePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **imageToImageBody** | [**ImageToImageBody**](ImageToImageBody.md) |  | 

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


## VideoSynthesisApiV1AiDashscopeVideoSynthesisPost

> interface{} VideoSynthesisApiV1AiDashscopeVideoSynthesisPost(ctx).VideoSynthesisRequest(videoSynthesisRequest).Execute()

Submit video synthesis task



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
	videoSynthesisRequest := *openapiclient.NewVideoSynthesisRequest("Prompt_example") // VideoSynthesisRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIDashScopeAPI.VideoSynthesisApiV1AiDashscopeVideoSynthesisPost(context.Background()).VideoSynthesisRequest(videoSynthesisRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIDashScopeAPI.VideoSynthesisApiV1AiDashscopeVideoSynthesisPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `VideoSynthesisApiV1AiDashscopeVideoSynthesisPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIDashScopeAPI.VideoSynthesisApiV1AiDashscopeVideoSynthesisPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiVideoSynthesisApiV1AiDashscopeVideoSynthesisPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **videoSynthesisRequest** | [**VideoSynthesisRequest**](VideoSynthesisRequest.md) |  | 

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


## VideoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet

> interface{} VideoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet(ctx, taskId).Execute()

Query video synthesis task status



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
	taskId := "taskId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIDashScopeAPI.VideoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet(context.Background(), taskId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIDashScopeAPI.VideoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `VideoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIDashScopeAPI.VideoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**taskId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiVideoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGetRequest struct via the builder pattern


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


## VisionChatApiV1AiDashscopeVisionChatPost

> interface{} VisionChatApiV1AiDashscopeVisionChatPost(ctx).VisionChatRequest(visionChatRequest).Execute()

Vision multi-modal chat



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
	visionChatRequest := *openapiclient.NewVisionChatRequest([]openapiclient.VisionImageInfo{*openapiclient.NewVisionImageInfo("ImageUrl_example")}, "Prompt_example") // VisionChatRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIDashScopeAPI.VisionChatApiV1AiDashscopeVisionChatPost(context.Background()).VisionChatRequest(visionChatRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIDashScopeAPI.VisionChatApiV1AiDashscopeVisionChatPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `VisionChatApiV1AiDashscopeVisionChatPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIDashScopeAPI.VisionChatApiV1AiDashscopeVisionChatPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiVisionChatApiV1AiDashscopeVisionChatPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **visionChatRequest** | [**VisionChatRequest**](VisionChatRequest.md) |  | 

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

