# \AgentRulesAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AcceptNeedTaskApiV1AgentsNeedTaskAcceptPost**](AgentRulesAPI.md#AcceptNeedTaskApiV1AgentsNeedTaskAcceptPost) | **Post** /api/v1/agents/need-task/accept | 接单需求任务
[**CompleteNeedTaskApiV1AgentsNeedTaskCompletePost**](AgentRulesAPI.md#CompleteNeedTaskApiV1AgentsNeedTaskCompletePost) | **Post** /api/v1/agents/need-task/complete | 完成需求任务
[**CreateNeedTaskApiV1AgentsNeedTaskCreatePost**](AgentRulesAPI.md#CreateNeedTaskApiV1AgentsNeedTaskCreatePost) | **Post** /api/v1/agents/need-task/create | 创建需求任务
[**ListNeedTasksApiV1AgentsNeedTaskListGet**](AgentRulesAPI.md#ListNeedTasksApiV1AgentsNeedTaskListGet) | **Get** /api/v1/agents/need-task/list | 需求任务列表
[**ToggleRuleApiV1AgentsTogglePost**](AgentRulesAPI.md#ToggleRuleApiV1AgentsTogglePost) | **Post** /api/v1/agents/toggle | 启用/禁用规则



## AcceptNeedTaskApiV1AgentsNeedTaskAcceptPost

> interface{} AcceptNeedTaskApiV1AgentsNeedTaskAcceptPost(ctx).TaskId(taskId).Execute()

接单需求任务

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
	taskId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentRulesAPI.AcceptNeedTaskApiV1AgentsNeedTaskAcceptPost(context.Background()).TaskId(taskId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentRulesAPI.AcceptNeedTaskApiV1AgentsNeedTaskAcceptPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AcceptNeedTaskApiV1AgentsNeedTaskAcceptPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentRulesAPI.AcceptNeedTaskApiV1AgentsNeedTaskAcceptPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAcceptNeedTaskApiV1AgentsNeedTaskAcceptPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **taskId** | **int32** |  | 

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


## CompleteNeedTaskApiV1AgentsNeedTaskCompletePost

> interface{} CompleteNeedTaskApiV1AgentsNeedTaskCompletePost(ctx).TaskId(taskId).Execute()

完成需求任务

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
	taskId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentRulesAPI.CompleteNeedTaskApiV1AgentsNeedTaskCompletePost(context.Background()).TaskId(taskId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentRulesAPI.CompleteNeedTaskApiV1AgentsNeedTaskCompletePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CompleteNeedTaskApiV1AgentsNeedTaskCompletePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentRulesAPI.CompleteNeedTaskApiV1AgentsNeedTaskCompletePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCompleteNeedTaskApiV1AgentsNeedTaskCompletePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **taskId** | **int32** |  | 

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


## CreateNeedTaskApiV1AgentsNeedTaskCreatePost

> interface{} CreateNeedTaskApiV1AgentsNeedTaskCreatePost(ctx).TaskName(taskName).TaskDesc(taskDesc).AgentId(agentId).RewardTokens(rewardTokens).Deadline(deadline).Execute()

创建需求任务

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
	taskName := "taskName_example" // string | 
	taskDesc := "taskDesc_example" // string |  (optional) (default to "")
	agentId := "agentId_example" // string |  (optional) (default to "")
	rewardTokens := int32(56) // int32 |  (optional) (default to 0)
	deadline := "deadline_example" // string | ISO 时间字符串 (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentRulesAPI.CreateNeedTaskApiV1AgentsNeedTaskCreatePost(context.Background()).TaskName(taskName).TaskDesc(taskDesc).AgentId(agentId).RewardTokens(rewardTokens).Deadline(deadline).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentRulesAPI.CreateNeedTaskApiV1AgentsNeedTaskCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateNeedTaskApiV1AgentsNeedTaskCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentRulesAPI.CreateNeedTaskApiV1AgentsNeedTaskCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateNeedTaskApiV1AgentsNeedTaskCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **taskName** | **string** |  | 
 **taskDesc** | **string** |  | [default to &quot;&quot;]
 **agentId** | **string** |  | [default to &quot;&quot;]
 **rewardTokens** | **int32** |  | [default to 0]
 **deadline** | **string** | ISO 时间字符串 | 

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


## ListNeedTasksApiV1AgentsNeedTaskListGet

> interface{} ListNeedTasksApiV1AgentsNeedTaskListGet(ctx).Page(page).Limit(limit).Status(status).Execute()

需求任务列表

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
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentRulesAPI.ListNeedTasksApiV1AgentsNeedTaskListGet(context.Background()).Page(page).Limit(limit).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentRulesAPI.ListNeedTasksApiV1AgentsNeedTaskListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListNeedTasksApiV1AgentsNeedTaskListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentRulesAPI.ListNeedTasksApiV1AgentsNeedTaskListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListNeedTasksApiV1AgentsNeedTaskListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **status** | **int32** |  | 

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


## ToggleRuleApiV1AgentsTogglePost

> interface{} ToggleRuleApiV1AgentsTogglePost(ctx).RuleId(ruleId).Status(status).Execute()

启用/禁用规则

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
	ruleId := int32(56) // int32 | 
	status := int32(56) // int32 | 0 禁用 1 启用

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentRulesAPI.ToggleRuleApiV1AgentsTogglePost(context.Background()).RuleId(ruleId).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentRulesAPI.ToggleRuleApiV1AgentsTogglePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ToggleRuleApiV1AgentsTogglePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentRulesAPI.ToggleRuleApiV1AgentsTogglePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiToggleRuleApiV1AgentsTogglePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ruleId** | **int32** |  | 
 **status** | **int32** | 0 禁用 1 启用 | 

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

