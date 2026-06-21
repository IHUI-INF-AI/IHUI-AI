# \AgentsAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**DeleteApiV1AgentsAgentIdDelete**](AgentsAPI.md#DeleteApiV1AgentsAgentIdDelete) | **Delete** /api/v1/agents/{agent_id} | Delete agent
[**GetDetailApiV1AgentsAgentIdGet**](AgentsAPI.md#GetDetailApiV1AgentsAgentIdGet) | **Get** /api/v1/agents/{agent_id} | Get agent detail
[**UpdateApiV1AgentsAgentIdPut**](AgentsAPI.md#UpdateApiV1AgentsAgentIdPut) | **Put** /api/v1/agents/{agent_id} | Update agent



## DeleteApiV1AgentsAgentIdDelete

> interface{} DeleteApiV1AgentsAgentIdDelete(ctx, agentId).Execute()

Delete agent

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
	resp, r, err := apiClient.AgentsAPI.DeleteApiV1AgentsAgentIdDelete(context.Background(), agentId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentsAPI.DeleteApiV1AgentsAgentIdDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteApiV1AgentsAgentIdDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentsAPI.DeleteApiV1AgentsAgentIdDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**agentId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteApiV1AgentsAgentIdDeleteRequest struct via the builder pattern


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


## GetDetailApiV1AgentsAgentIdGet

> interface{} GetDetailApiV1AgentsAgentIdGet(ctx, agentId).Execute()

Get agent detail

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
	resp, r, err := apiClient.AgentsAPI.GetDetailApiV1AgentsAgentIdGet(context.Background(), agentId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentsAPI.GetDetailApiV1AgentsAgentIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetDetailApiV1AgentsAgentIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentsAPI.GetDetailApiV1AgentsAgentIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**agentId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetDetailApiV1AgentsAgentIdGetRequest struct via the builder pattern


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


## UpdateApiV1AgentsAgentIdPut

> interface{} UpdateApiV1AgentsAgentIdPut(ctx, agentId).AgentName(agentName).AgentPrompt(agentPrompt).PublishStatus(publishStatus).Execute()

Update agent

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
	agentName := "agentName_example" // string |  (optional)
	agentPrompt := "agentPrompt_example" // string |  (optional)
	publishStatus := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentsAPI.UpdateApiV1AgentsAgentIdPut(context.Background(), agentId).AgentName(agentName).AgentPrompt(agentPrompt).PublishStatus(publishStatus).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentsAPI.UpdateApiV1AgentsAgentIdPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateApiV1AgentsAgentIdPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentsAPI.UpdateApiV1AgentsAgentIdPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**agentId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateApiV1AgentsAgentIdPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **agentName** | **string** |  | 
 **agentPrompt** | **string** |  | 
 **publishStatus** | **int32** |  | 

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

