# \AISora2API

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GenerateVideoApiV1AiSora2GenerateVideoPost**](AISora2API.md#GenerateVideoApiV1AiSora2GenerateVideoPost) | **Post** /api/v1/ai/sora2/generate/video | Sora2/Veo AI 视频生成
[**QueryVideoApiV1AiSora2VideoTaskIdGet**](AISora2API.md#QueryVideoApiV1AiSora2VideoTaskIdGet) | **Get** /api/v1/ai/sora2/video/{task_id} | 查询Sora2视频生成任务状态



## GenerateVideoApiV1AiSora2GenerateVideoPost

> interface{} GenerateVideoApiV1AiSora2GenerateVideoPost(ctx).GenerateVideoRequest(generateVideoRequest).Execute()

Sora2/Veo AI 视频生成



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
	generateVideoRequest := *openapiclient.NewGenerateVideoRequest("Prompt_example") // GenerateVideoRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AISora2API.GenerateVideoApiV1AiSora2GenerateVideoPost(context.Background()).GenerateVideoRequest(generateVideoRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AISora2API.GenerateVideoApiV1AiSora2GenerateVideoPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GenerateVideoApiV1AiSora2GenerateVideoPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AISora2API.GenerateVideoApiV1AiSora2GenerateVideoPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGenerateVideoApiV1AiSora2GenerateVideoPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **generateVideoRequest** | [**GenerateVideoRequest**](GenerateVideoRequest.md) |  | 

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


## QueryVideoApiV1AiSora2VideoTaskIdGet

> interface{} QueryVideoApiV1AiSora2VideoTaskIdGet(ctx, taskId).Execute()

查询Sora2视频生成任务状态



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
	resp, r, err := apiClient.AISora2API.QueryVideoApiV1AiSora2VideoTaskIdGet(context.Background(), taskId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AISora2API.QueryVideoApiV1AiSora2VideoTaskIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `QueryVideoApiV1AiSora2VideoTaskIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AISora2API.QueryVideoApiV1AiSora2VideoTaskIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**taskId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiQueryVideoApiV1AiSora2VideoTaskIdGetRequest struct via the builder pattern


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

