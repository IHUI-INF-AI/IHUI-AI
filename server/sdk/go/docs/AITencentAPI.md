# \AITencentAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet**](AITencentAPI.md#GetActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet) | **Get** /api/v1/ai/tencent/hunyuan3d/active-jobs | 查看当前活跃任务
[**QueryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet**](AITencentAPI.md#QueryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet) | **Get** /api/v1/ai/tencent/hunyuan3d/task/{task_id} | 查询混元3D任务状态
[**QueryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost**](AITencentAPI.md#QueryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost) | **Post** /api/v1/ai/tencent/hunyuan3d/query | 查询混元3D任务状态
[**SubmitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost**](AITencentAPI.md#SubmitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost) | **Post** /api/v1/ai/tencent/hunyuan3d/submit | 提交混元3D任务



## GetActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet

> interface{} GetActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet(ctx).Execute()

查看当前活跃任务



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
	resp, r, err := apiClient.AITencentAPI.GetActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AITencentAPI.GetActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AITencentAPI.GetActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetActiveJobsApiV1AiTencentHunyuan3dActiveJobsGetRequest struct via the builder pattern


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


## QueryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet

> interface{} QueryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet(ctx, taskId).Execute()

查询混元3D任务状态



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
	resp, r, err := apiClient.AITencentAPI.QueryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet(context.Background(), taskId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AITencentAPI.QueryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `QueryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AITencentAPI.QueryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**taskId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiQueryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGetRequest struct via the builder pattern


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


## QueryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost

> interface{} QueryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost(ctx).QueryHunyuan3DRequest(queryHunyuan3DRequest).Execute()

查询混元3D任务状态



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
	queryHunyuan3DRequest := *openapiclient.NewQueryHunyuan3DRequest("JobId_example") // QueryHunyuan3DRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AITencentAPI.QueryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost(context.Background()).QueryHunyuan3DRequest(queryHunyuan3DRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AITencentAPI.QueryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `QueryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AITencentAPI.QueryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiQueryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **queryHunyuan3DRequest** | [**QueryHunyuan3DRequest**](QueryHunyuan3DRequest.md) |  | 

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


## SubmitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost

> interface{} SubmitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost(ctx).SubmitHunyuan3DRequest(submitHunyuan3DRequest).Execute()

提交混元3D任务



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
	submitHunyuan3DRequest := *openapiclient.NewSubmitHunyuan3DRequest() // SubmitHunyuan3DRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AITencentAPI.SubmitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost(context.Background()).SubmitHunyuan3DRequest(submitHunyuan3DRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AITencentAPI.SubmitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SubmitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AITencentAPI.SubmitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSubmitHunyuan3dApiV1AiTencentHunyuan3dSubmitPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **submitHunyuan3DRequest** | [**SubmitHunyuan3DRequest**](SubmitHunyuan3DRequest.md) |  | 

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

