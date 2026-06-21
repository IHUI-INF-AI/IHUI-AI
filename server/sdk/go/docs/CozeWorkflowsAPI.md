# \CozeWorkflowsAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost**](CozeWorkflowsAPI.md#CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost) | **Post** /api/v1/coze/workflows/workflows/runs | Create Workflow Run
[**CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0**](CozeWorkflowsAPI.md#CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0) | **Post** /api/v1/coze/workflows/workflows/runs | Create Workflow Run
[**GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost**](CozeWorkflowsAPI.md#GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost) | **Post** /api/v1/coze/workflows/workflows/runs/execute-nodes | Get Node History
[**GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0**](CozeWorkflowsAPI.md#GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0) | **Post** /api/v1/coze/workflows/workflows/runs/execute-nodes | Get Node History
[**GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost**](CozeWorkflowsAPI.md#GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost) | **Post** /api/v1/coze/workflows/workflows/runs/history | Get Run History
[**GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0**](CozeWorkflowsAPI.md#GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0) | **Post** /api/v1/coze/workflows/workflows/runs/history | Get Run History
[**ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost**](CozeWorkflowsAPI.md#ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost) | **Post** /api/v1/coze/workflows/workflows/runs/resume | Resume Workflow
[**ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0**](CozeWorkflowsAPI.md#ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0) | **Post** /api/v1/coze/workflows/workflows/runs/resume | Resume Workflow
[**SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost**](CozeWorkflowsAPI.md#SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost) | **Post** /api/v1/coze/workflows/workflows/search/model/workflow/run | Search Model Workflow
[**SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0**](CozeWorkflowsAPI.md#SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0) | **Post** /api/v1/coze/workflows/workflows/search/model/workflow/run | Search Model Workflow
[**StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost**](CozeWorkflowsAPI.md#StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost) | **Post** /api/v1/coze/workflows/workflows/runs/stream | Stream Workflow
[**StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0**](CozeWorkflowsAPI.md#StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0) | **Post** /api/v1/coze/workflows/workflows/runs/stream | Stream Workflow



## CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost

> interface{} CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost(ctx).WorkflowRunReq(workflowRunReq).Execute()

Create Workflow Run

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
	workflowRunReq := *openapiclient.NewWorkflowRunReq("WorkflowId_example") // WorkflowRunReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeWorkflowsAPI.CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost(context.Background()).WorkflowRunReq(workflowRunReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeWorkflowsAPI.CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeWorkflowsAPI.CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflowRunReq** | [**WorkflowRunReq**](WorkflowRunReq.md) |  | 

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


## CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0

> interface{} CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0(ctx).WorkflowRunReq(workflowRunReq).Execute()

Create Workflow Run

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
	workflowRunReq := *openapiclient.NewWorkflowRunReq("WorkflowId_example") // WorkflowRunReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeWorkflowsAPI.CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0(context.Background()).WorkflowRunReq(workflowRunReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeWorkflowsAPI.CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeWorkflowsAPI.CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflowRunReq** | [**WorkflowRunReq**](WorkflowRunReq.md) |  | 

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


## GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost

> interface{} GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost(ctx).WorkflowNodeExecuteReq(workflowNodeExecuteReq).Execute()

Get Node History

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
	workflowNodeExecuteReq := *openapiclient.NewWorkflowNodeExecuteReq("WorkflowId_example", "ExecuteId_example", "NodeExecuteUuid_example") // WorkflowNodeExecuteReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeWorkflowsAPI.GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost(context.Background()).WorkflowNodeExecuteReq(workflowNodeExecuteReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeWorkflowsAPI.GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeWorkflowsAPI.GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflowNodeExecuteReq** | [**WorkflowNodeExecuteReq**](WorkflowNodeExecuteReq.md) |  | 

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


## GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0

> interface{} GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0(ctx).WorkflowNodeExecuteReq(workflowNodeExecuteReq).Execute()

Get Node History

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
	workflowNodeExecuteReq := *openapiclient.NewWorkflowNodeExecuteReq("WorkflowId_example", "ExecuteId_example", "NodeExecuteUuid_example") // WorkflowNodeExecuteReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeWorkflowsAPI.GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0(context.Background()).WorkflowNodeExecuteReq(workflowNodeExecuteReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeWorkflowsAPI.GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeWorkflowsAPI.GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflowNodeExecuteReq** | [**WorkflowNodeExecuteReq**](WorkflowNodeExecuteReq.md) |  | 

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


## GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost

> interface{} GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost(ctx).WorkflowRunHistoryReq(workflowRunHistoryReq).Execute()

Get Run History

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
	workflowRunHistoryReq := *openapiclient.NewWorkflowRunHistoryReq("WorkflowId_example", "ExecuteId_example") // WorkflowRunHistoryReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeWorkflowsAPI.GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost(context.Background()).WorkflowRunHistoryReq(workflowRunHistoryReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeWorkflowsAPI.GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeWorkflowsAPI.GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflowRunHistoryReq** | [**WorkflowRunHistoryReq**](WorkflowRunHistoryReq.md) |  | 

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


## GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0

> interface{} GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0(ctx).WorkflowRunHistoryReq(workflowRunHistoryReq).Execute()

Get Run History

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
	workflowRunHistoryReq := *openapiclient.NewWorkflowRunHistoryReq("WorkflowId_example", "ExecuteId_example") // WorkflowRunHistoryReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeWorkflowsAPI.GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0(context.Background()).WorkflowRunHistoryReq(workflowRunHistoryReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeWorkflowsAPI.GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeWorkflowsAPI.GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflowRunHistoryReq** | [**WorkflowRunHistoryReq**](WorkflowRunHistoryReq.md) |  | 

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


## ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost

> interface{} ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost(ctx).WorkflowResumeReq(workflowResumeReq).Execute()

Resume Workflow

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
	workflowResumeReq := *openapiclient.NewWorkflowResumeReq("WorkflowId_example", "EventId_example", "ResumeData_example", "InterruptType_example") // WorkflowResumeReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeWorkflowsAPI.ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost(context.Background()).WorkflowResumeReq(workflowResumeReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeWorkflowsAPI.ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeWorkflowsAPI.ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflowResumeReq** | [**WorkflowResumeReq**](WorkflowResumeReq.md) |  | 

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


## ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0

> interface{} ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0(ctx).WorkflowResumeReq(workflowResumeReq).Execute()

Resume Workflow

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
	workflowResumeReq := *openapiclient.NewWorkflowResumeReq("WorkflowId_example", "EventId_example", "ResumeData_example", "InterruptType_example") // WorkflowResumeReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeWorkflowsAPI.ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0(context.Background()).WorkflowResumeReq(workflowResumeReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeWorkflowsAPI.ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeWorkflowsAPI.ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflowResumeReq** | [**WorkflowResumeReq**](WorkflowResumeReq.md) |  | 

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


## SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost

> interface{} SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost(ctx).ModelSearchReq(modelSearchReq).Execute()

Search Model Workflow

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
	modelSearchReq := *openapiclient.NewModelSearchReq("UserUuid_example", "Content_example") // ModelSearchReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeWorkflowsAPI.SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost(context.Background()).ModelSearchReq(modelSearchReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeWorkflowsAPI.SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeWorkflowsAPI.SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **modelSearchReq** | [**ModelSearchReq**](ModelSearchReq.md) |  | 

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


## SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0

> interface{} SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0(ctx).ModelSearchReq(modelSearchReq).Execute()

Search Model Workflow

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
	modelSearchReq := *openapiclient.NewModelSearchReq("UserUuid_example", "Content_example") // ModelSearchReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeWorkflowsAPI.SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0(context.Background()).ModelSearchReq(modelSearchReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeWorkflowsAPI.SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeWorkflowsAPI.SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **modelSearchReq** | [**ModelSearchReq**](ModelSearchReq.md) |  | 

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


## StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost

> interface{} StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost(ctx).WorkflowRunReq(workflowRunReq).Execute()

Stream Workflow

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
	workflowRunReq := *openapiclient.NewWorkflowRunReq("WorkflowId_example") // WorkflowRunReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeWorkflowsAPI.StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost(context.Background()).WorkflowRunReq(workflowRunReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeWorkflowsAPI.StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeWorkflowsAPI.StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiStreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflowRunReq** | [**WorkflowRunReq**](WorkflowRunReq.md) |  | 

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


## StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0

> interface{} StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0(ctx).WorkflowRunReq(workflowRunReq).Execute()

Stream Workflow

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
	workflowRunReq := *openapiclient.NewWorkflowRunReq("WorkflowId_example") // WorkflowRunReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeWorkflowsAPI.StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0(context.Background()).WorkflowRunReq(workflowRunReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeWorkflowsAPI.StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeWorkflowsAPI.StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiStreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflowRunReq** | [**WorkflowRunReq**](WorkflowRunReq.md) |  | 

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

