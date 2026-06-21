# \AIN8NAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddAgentApiV1AiN8nAddAgentPost**](AIN8NAPI.md#AddAgentApiV1AiN8nAddAgentPost) | **Post** /api/v1/ai/n8n/addAgent | 通过N8N接口新增智能体
[**GetN8nWorkflowsApiV1AiN8nWorkflowsPost**](AIN8NAPI.md#GetN8nWorkflowsApiV1AiN8nWorkflowsPost) | **Post** /api/v1/ai/n8n/workflows | 查询N8N工作流列表
[**RunWorkflowApiV1AiN8nWorkflowRunPost**](AIN8NAPI.md#RunWorkflowApiV1AiN8nWorkflowRunPost) | **Post** /api/v1/ai/n8n/workflow/run | 运行N8N工作流



## AddAgentApiV1AiN8nAddAgentPost

> interface{} AddAgentApiV1AiN8nAddAgentPost(ctx).AddAgentRequest(addAgentRequest).Execute()

通过N8N接口新增智能体



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
	addAgentRequest := *openapiclient.NewAddAgentRequest("AgentName_example", "AgentDescription_example", "ConnectorUserId_example", map[string]interface{}{"key": interface{}(123)}, "AgentModel_example") // AddAgentRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIN8NAPI.AddAgentApiV1AiN8nAddAgentPost(context.Background()).AddAgentRequest(addAgentRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIN8NAPI.AddAgentApiV1AiN8nAddAgentPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddAgentApiV1AiN8nAddAgentPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIN8NAPI.AddAgentApiV1AiN8nAddAgentPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAddAgentApiV1AiN8nAddAgentPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **addAgentRequest** | [**AddAgentRequest**](AddAgentRequest.md) |  | 

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


## GetN8nWorkflowsApiV1AiN8nWorkflowsPost

> interface{} GetN8nWorkflowsApiV1AiN8nWorkflowsPost(ctx).N8NWorkflowsRequest(n8NWorkflowsRequest).Execute()

查询N8N工作流列表



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
	n8NWorkflowsRequest := *openapiclient.NewN8NWorkflowsRequest("N8nDomain_example", "ApiKey_example") // N8NWorkflowsRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIN8NAPI.GetN8nWorkflowsApiV1AiN8nWorkflowsPost(context.Background()).N8NWorkflowsRequest(n8NWorkflowsRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIN8NAPI.GetN8nWorkflowsApiV1AiN8nWorkflowsPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetN8nWorkflowsApiV1AiN8nWorkflowsPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIN8NAPI.GetN8nWorkflowsApiV1AiN8nWorkflowsPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetN8nWorkflowsApiV1AiN8nWorkflowsPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **n8NWorkflowsRequest** | [**N8NWorkflowsRequest**](N8NWorkflowsRequest.md) |  | 

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


## RunWorkflowApiV1AiN8nWorkflowRunPost

> interface{} RunWorkflowApiV1AiN8nWorkflowRunPost(ctx).WorkflowRunRequest(workflowRunRequest).Execute()

运行N8N工作流



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
	workflowRunRequest := *openapiclient.NewWorkflowRunRequest() // WorkflowRunRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIN8NAPI.RunWorkflowApiV1AiN8nWorkflowRunPost(context.Background()).WorkflowRunRequest(workflowRunRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIN8NAPI.RunWorkflowApiV1AiN8nWorkflowRunPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RunWorkflowApiV1AiN8nWorkflowRunPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIN8NAPI.RunWorkflowApiV1AiN8nWorkflowRunPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRunWorkflowApiV1AiN8nWorkflowRunPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflowRunRequest** | [**WorkflowRunRequest**](WorkflowRunRequest.md) |  | 

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

