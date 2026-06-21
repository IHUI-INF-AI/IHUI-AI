# \AIVideoTasksAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetVideoTaskApiV1AiTaskIdGet**](AIVideoTasksAPI.md#GetVideoTaskApiV1AiTaskIdGet) | **Get** /api/v1/ai/{task_id} | 任务详情
[**ListVideoTasksApiV1AiListGet**](AIVideoTasksAPI.md#ListVideoTasksApiV1AiListGet) | **Get** /api/v1/ai/list | 视频任务列表



## GetVideoTaskApiV1AiTaskIdGet

> interface{} GetVideoTaskApiV1AiTaskIdGet(ctx, taskId).Execute()

任务详情

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
	resp, r, err := apiClient.AIVideoTasksAPI.GetVideoTaskApiV1AiTaskIdGet(context.Background(), taskId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIVideoTasksAPI.GetVideoTaskApiV1AiTaskIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetVideoTaskApiV1AiTaskIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIVideoTasksAPI.GetVideoTaskApiV1AiTaskIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**taskId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetVideoTaskApiV1AiTaskIdGetRequest struct via the builder pattern


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


## ListVideoTasksApiV1AiListGet

> interface{} ListVideoTasksApiV1AiListGet(ctx).Page(page).Limit(limit).Status(status).Execute()

视频任务列表

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
	status := "status_example" // string | 任务状态过滤: accepted / processing / completed / failed (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIVideoTasksAPI.ListVideoTasksApiV1AiListGet(context.Background()).Page(page).Limit(limit).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIVideoTasksAPI.ListVideoTasksApiV1AiListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListVideoTasksApiV1AiListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIVideoTasksAPI.ListVideoTasksApiV1AiListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListVideoTasksApiV1AiListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **status** | **string** | 任务状态过滤: accepted / processing / completed / failed | 

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

