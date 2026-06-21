# \AgentHeatStatsAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AgentHeatApiV1AgentsAgentAgentIdGet**](AgentHeatStatsAPI.md#AgentHeatApiV1AgentsAgentAgentIdGet) | **Get** /api/v1/agents/agent/{agent_id} | 查询 Agent 热度（按日聚合）
[**HitApiV1AgentsHitPost**](AgentHeatStatsAPI.md#HitApiV1AgentsHitPost) | **Post** /api/v1/agents/hit | 记录一次 Agent 命中（内部调用）
[**TopAgentsApiV1AgentsTopGet**](AgentHeatStatsAPI.md#TopAgentsApiV1AgentsTopGet) | **Get** /api/v1/agents/top | 热度 TOP 榜



## AgentHeatApiV1AgentsAgentAgentIdGet

> interface{} AgentHeatApiV1AgentsAgentAgentIdGet(ctx, agentId).Days(days).Execute()

查询 Agent 热度（按日聚合）

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
	agentId := "agentId_example" // string | 
	days := int32(56) // int32 |  (optional) (default to 7)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentHeatStatsAPI.AgentHeatApiV1AgentsAgentAgentIdGet(context.Background(), agentId).Days(days).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentHeatStatsAPI.AgentHeatApiV1AgentsAgentAgentIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AgentHeatApiV1AgentsAgentAgentIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentHeatStatsAPI.AgentHeatApiV1AgentsAgentAgentIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**agentId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiAgentHeatApiV1AgentsAgentAgentIdGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **days** | **int32** |  | [default to 7]

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


## HitApiV1AgentsHitPost

> interface{} HitApiV1AgentsHitPost(ctx).AgentId(agentId).Execute()

记录一次 Agent 命中（内部调用）



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
	agentId := "agentId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentHeatStatsAPI.HitApiV1AgentsHitPost(context.Background()).AgentId(agentId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentHeatStatsAPI.HitApiV1AgentsHitPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `HitApiV1AgentsHitPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentHeatStatsAPI.HitApiV1AgentsHitPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiHitApiV1AgentsHitPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 

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


## TopAgentsApiV1AgentsTopGet

> interface{} TopAgentsApiV1AgentsTopGet(ctx).Days(days).Limit(limit).Execute()

热度 TOP 榜

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
	days := int32(56) // int32 |  (optional) (default to 7)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentHeatStatsAPI.TopAgentsApiV1AgentsTopGet(context.Background()).Days(days).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentHeatStatsAPI.TopAgentsApiV1AgentsTopGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TopAgentsApiV1AgentsTopGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentHeatStatsAPI.TopAgentsApiV1AgentsTopGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTopAgentsApiV1AgentsTopGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **days** | **int32** |  | [default to 7]
 **limit** | **int32** |  | [default to 20]

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

