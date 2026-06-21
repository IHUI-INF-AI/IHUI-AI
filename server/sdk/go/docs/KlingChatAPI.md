# \KlingChatAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**KlingImageGenerateApiV1ChatImageGeneratePost**](KlingChatAPI.md#KlingImageGenerateApiV1ChatImageGeneratePost) | **Post** /api/v1/chat/image/generate | Kling text-to-image generation
[**KlingImageToVideoApiV1ChatVideoImageToVideoPost**](KlingChatAPI.md#KlingImageToVideoApiV1ChatVideoImageToVideoPost) | **Post** /api/v1/chat/video/image-to-video | Kling image-to-video generation
[**KlingLipSyncApiV1ChatVideoLipSyncPost**](KlingChatAPI.md#KlingLipSyncApiV1ChatVideoLipSyncPost) | **Post** /api/v1/chat/video/lip-sync | Kling lip-sync video creation
[**KlingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost**](KlingChatAPI.md#KlingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost) | **Post** /api/v1/chat/video/lip-sync/one-shot | Kling one-shot lip-sync
[**KlingQueryTaskApiV1ChatTaskTaskIdGet**](KlingChatAPI.md#KlingQueryTaskApiV1ChatTaskTaskIdGet) | **Get** /api/v1/chat/task/{task_id} | Query Kling task status
[**KlingVideoGenerateApiV1ChatVideoGeneratePost**](KlingChatAPI.md#KlingVideoGenerateApiV1ChatVideoGeneratePost) | **Post** /api/v1/chat/video/generate | Kling text-to-video generation
[**KlingVideoIdentifyApiV1ChatVideoIdentifyPost**](KlingChatAPI.md#KlingVideoIdentifyApiV1ChatVideoIdentifyPost) | **Post** /api/v1/chat/video/identify | Kling face identification



## KlingImageGenerateApiV1ChatImageGeneratePost

> interface{} KlingImageGenerateApiV1ChatImageGeneratePost(ctx).AppApiV1ChatKlingImageGenerateBody(appApiV1ChatKlingImageGenerateBody).Execute()

Kling text-to-image generation



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
	appApiV1ChatKlingImageGenerateBody := *openapiclient.NewAppApiV1ChatKlingImageGenerateBody("Prompt_example") // AppApiV1ChatKlingImageGenerateBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.KlingChatAPI.KlingImageGenerateApiV1ChatImageGeneratePost(context.Background()).AppApiV1ChatKlingImageGenerateBody(appApiV1ChatKlingImageGenerateBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `KlingChatAPI.KlingImageGenerateApiV1ChatImageGeneratePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `KlingImageGenerateApiV1ChatImageGeneratePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `KlingChatAPI.KlingImageGenerateApiV1ChatImageGeneratePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiKlingImageGenerateApiV1ChatImageGeneratePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **appApiV1ChatKlingImageGenerateBody** | [**AppApiV1ChatKlingImageGenerateBody**](AppApiV1ChatKlingImageGenerateBody.md) |  | 

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


## KlingImageToVideoApiV1ChatVideoImageToVideoPost

> interface{} KlingImageToVideoApiV1ChatVideoImageToVideoPost(ctx).ImageToVideoBody(imageToVideoBody).Execute()

Kling image-to-video generation



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
	imageToVideoBody := *openapiclient.NewImageToVideoBody("Image_example") // ImageToVideoBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.KlingChatAPI.KlingImageToVideoApiV1ChatVideoImageToVideoPost(context.Background()).ImageToVideoBody(imageToVideoBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `KlingChatAPI.KlingImageToVideoApiV1ChatVideoImageToVideoPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `KlingImageToVideoApiV1ChatVideoImageToVideoPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `KlingChatAPI.KlingImageToVideoApiV1ChatVideoImageToVideoPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiKlingImageToVideoApiV1ChatVideoImageToVideoPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **imageToVideoBody** | [**ImageToVideoBody**](ImageToVideoBody.md) |  | 

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


## KlingLipSyncApiV1ChatVideoLipSyncPost

> interface{} KlingLipSyncApiV1ChatVideoLipSyncPost(ctx).LipSyncBody(lipSyncBody).Execute()

Kling lip-sync video creation



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
	lipSyncBody := *openapiclient.NewLipSyncBody("UserUuid_example", interface{}(123)) // LipSyncBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.KlingChatAPI.KlingLipSyncApiV1ChatVideoLipSyncPost(context.Background()).LipSyncBody(lipSyncBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `KlingChatAPI.KlingLipSyncApiV1ChatVideoLipSyncPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `KlingLipSyncApiV1ChatVideoLipSyncPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `KlingChatAPI.KlingLipSyncApiV1ChatVideoLipSyncPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiKlingLipSyncApiV1ChatVideoLipSyncPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **lipSyncBody** | [**LipSyncBody**](LipSyncBody.md) |  | 

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


## KlingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost

> interface{} KlingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost(ctx).LipSyncOneShotBody(lipSyncOneShotBody).Execute()

Kling one-shot lip-sync



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
	lipSyncOneShotBody := *openapiclient.NewLipSyncOneShotBody("UserUuid_example", int32(123), int32(123), int32(123)) // LipSyncOneShotBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.KlingChatAPI.KlingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost(context.Background()).LipSyncOneShotBody(lipSyncOneShotBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `KlingChatAPI.KlingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `KlingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `KlingChatAPI.KlingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiKlingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **lipSyncOneShotBody** | [**LipSyncOneShotBody**](LipSyncOneShotBody.md) |  | 

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


## KlingQueryTaskApiV1ChatTaskTaskIdGet

> interface{} KlingQueryTaskApiV1ChatTaskTaskIdGet(ctx, taskId).TaskType(taskType).Execute()

Query Kling task status



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
	taskType := "taskType_example" // string |  (optional) (default to "video")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.KlingChatAPI.KlingQueryTaskApiV1ChatTaskTaskIdGet(context.Background(), taskId).TaskType(taskType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `KlingChatAPI.KlingQueryTaskApiV1ChatTaskTaskIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `KlingQueryTaskApiV1ChatTaskTaskIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `KlingChatAPI.KlingQueryTaskApiV1ChatTaskTaskIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**taskId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiKlingQueryTaskApiV1ChatTaskTaskIdGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **taskType** | **string** |  | [default to &quot;video&quot;]

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


## KlingVideoGenerateApiV1ChatVideoGeneratePost

> interface{} KlingVideoGenerateApiV1ChatVideoGeneratePost(ctx).VideoGenerateBody(videoGenerateBody).Execute()

Kling text-to-video generation



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
	videoGenerateBody := *openapiclient.NewVideoGenerateBody("Prompt_example") // VideoGenerateBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.KlingChatAPI.KlingVideoGenerateApiV1ChatVideoGeneratePost(context.Background()).VideoGenerateBody(videoGenerateBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `KlingChatAPI.KlingVideoGenerateApiV1ChatVideoGeneratePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `KlingVideoGenerateApiV1ChatVideoGeneratePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `KlingChatAPI.KlingVideoGenerateApiV1ChatVideoGeneratePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiKlingVideoGenerateApiV1ChatVideoGeneratePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **videoGenerateBody** | [**VideoGenerateBody**](VideoGenerateBody.md) |  | 

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


## KlingVideoIdentifyApiV1ChatVideoIdentifyPost

> interface{} KlingVideoIdentifyApiV1ChatVideoIdentifyPost(ctx).Execute()

Kling face identification



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
	resp, r, err := apiClient.KlingChatAPI.KlingVideoIdentifyApiV1ChatVideoIdentifyPost(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `KlingChatAPI.KlingVideoIdentifyApiV1ChatVideoIdentifyPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `KlingVideoIdentifyApiV1ChatVideoIdentifyPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `KlingChatAPI.KlingVideoIdentifyApiV1ChatVideoIdentifyPost`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiKlingVideoIdentifyApiV1ChatVideoIdentifyPostRequest struct via the builder pattern


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

