# \CozeAsyncWorkflowsAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**RunWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost**](CozeAsyncWorkflowsAPI.md#RunWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost) | **Post** /api/v1/coze/workflows/async/workflows/async | Run Workflow Async
[**StreamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost**](CozeAsyncWorkflowsAPI.md#StreamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost) | **Post** /api/v1/coze/workflows/async/workflows/async/stream | Stream Workflow Async
[**WorkflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost**](CozeAsyncWorkflowsAPI.md#WorkflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost) | **Post** /api/v1/coze/workflows/async/workflows/async/chat | Workflow Chat



## RunWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost

> interface{} RunWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost(ctx).AsyncWorkflowReq(asyncWorkflowReq).Execute()

Run Workflow Async

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
	asyncWorkflowReq := *openapiclient.NewAsyncWorkflowReq("WorkflowId_example", "UserId_example") // AsyncWorkflowReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAsyncWorkflowsAPI.RunWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost(context.Background()).AsyncWorkflowReq(asyncWorkflowReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAsyncWorkflowsAPI.RunWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RunWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAsyncWorkflowsAPI.RunWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRunWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **asyncWorkflowReq** | [**AsyncWorkflowReq**](AsyncWorkflowReq.md) |  | 

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


## StreamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost

> interface{} StreamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost(ctx).AsyncWorkflowStreamReq(asyncWorkflowStreamReq).Execute()

Stream Workflow Async

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
	asyncWorkflowStreamReq := *openapiclient.NewAsyncWorkflowStreamReq("WorkflowId_example", "UserId_example") // AsyncWorkflowStreamReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAsyncWorkflowsAPI.StreamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost(context.Background()).AsyncWorkflowStreamReq(asyncWorkflowStreamReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAsyncWorkflowsAPI.StreamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StreamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAsyncWorkflowsAPI.StreamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiStreamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **asyncWorkflowStreamReq** | [**AsyncWorkflowStreamReq**](AsyncWorkflowStreamReq.md) |  | 

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


## WorkflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost

> interface{} WorkflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost(ctx).AsyncWorkflowStreamReq(asyncWorkflowStreamReq).Execute()

Workflow Chat

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
	asyncWorkflowStreamReq := *openapiclient.NewAsyncWorkflowStreamReq("WorkflowId_example", "UserId_example") // AsyncWorkflowStreamReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAsyncWorkflowsAPI.WorkflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost(context.Background()).AsyncWorkflowStreamReq(asyncWorkflowStreamReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAsyncWorkflowsAPI.WorkflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `WorkflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAsyncWorkflowsAPI.WorkflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiWorkflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **asyncWorkflowStreamReq** | [**AsyncWorkflowStreamReq**](AsyncWorkflowStreamReq.md) |  | 

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

