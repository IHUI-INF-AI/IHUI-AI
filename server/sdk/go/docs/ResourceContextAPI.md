# \ResourceContextAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetAgentWithDeductionApiV1ResourceContextAgentAgentIdGet**](ResourceContextAPI.md#GetAgentWithDeductionApiV1ResourceContextAgentAgentIdGet) | **Get** /api/v1/resource/context/agent/{agent_id} | 获取Agent调用（含token扣除）
[**GetContextApiV1ResourceContextGetGet**](ResourceContextAPI.md#GetContextApiV1ResourceContextGetGet) | **Get** /api/v1/resource/context/get | 获取用户上下文
[**GetFieldApiV1ResourceContextFieldGet**](ResourceContextAPI.md#GetFieldApiV1ResourceContextFieldGet) | **Get** /api/v1/resource/context/field | 获取指定字段值
[**GetSampleContextApiV1ResourceContextSampleGet**](ResourceContextAPI.md#GetSampleContextApiV1ResourceContextSampleGet) | **Get** /api/v1/resource/context/sample | Get sample context data
[**GetUsageHistoryApiV1ResourceContextHistoryPost**](ResourceContextAPI.md#GetUsageHistoryApiV1ResourceContextHistoryPost) | **Post** /api/v1/resource/context/history | Query usage history
[**QueryContextRawApiV1ResourceContextQueryPost**](ResourceContextAPI.md#QueryContextRawApiV1ResourceContextQueryPost) | **Post** /api/v1/resource/context/query | Query user agent context (raw SQL)
[**RemoveFieldApiV1ResourceContextRemoveFieldPost**](ResourceContextAPI.md#RemoveFieldApiV1ResourceContextRemoveFieldPost) | **Post** /api/v1/resource/context/remove/field | 删除指定字段
[**SaveContextApiV1ResourceContextSavePost**](ResourceContextAPI.md#SaveContextApiV1ResourceContextSavePost) | **Post** /api/v1/resource/context/save | 保存用户上下文



## GetAgentWithDeductionApiV1ResourceContextAgentAgentIdGet

> interface{} GetAgentWithDeductionApiV1ResourceContextAgentAgentIdGet(ctx, agentId).Execute()

获取Agent调用（含token扣除）

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
	resp, r, err := apiClient.ResourceContextAPI.GetAgentWithDeductionApiV1ResourceContextAgentAgentIdGet(context.Background(), agentId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceContextAPI.GetAgentWithDeductionApiV1ResourceContextAgentAgentIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetAgentWithDeductionApiV1ResourceContextAgentAgentIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceContextAPI.GetAgentWithDeductionApiV1ResourceContextAgentAgentIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**agentId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetAgentWithDeductionApiV1ResourceContextAgentAgentIdGetRequest struct via the builder pattern


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


## GetContextApiV1ResourceContextGetGet

> interface{} GetContextApiV1ResourceContextGetGet(ctx).AgentId(agentId).ContextKey(contextKey).Execute()

获取用户上下文

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
	agentId := "agentId_example" // string | Agent ID
	contextKey := "contextKey_example" // string | Context key (optional filter) (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceContextAPI.GetContextApiV1ResourceContextGetGet(context.Background()).AgentId(agentId).ContextKey(contextKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceContextAPI.GetContextApiV1ResourceContextGetGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetContextApiV1ResourceContextGetGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceContextAPI.GetContextApiV1ResourceContextGetGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetContextApiV1ResourceContextGetGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** | Agent ID | 
 **contextKey** | **string** | Context key (optional filter) | 

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


## GetFieldApiV1ResourceContextFieldGet

> interface{} GetFieldApiV1ResourceContextFieldGet(ctx).AgentId(agentId).FieldName(fieldName).Execute()

获取指定字段值

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
	fieldName := "fieldName_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceContextAPI.GetFieldApiV1ResourceContextFieldGet(context.Background()).AgentId(agentId).FieldName(fieldName).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceContextAPI.GetFieldApiV1ResourceContextFieldGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetFieldApiV1ResourceContextFieldGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceContextAPI.GetFieldApiV1ResourceContextFieldGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetFieldApiV1ResourceContextFieldGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **fieldName** | **string** |  | 

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


## GetSampleContextApiV1ResourceContextSampleGet

> interface{} GetSampleContextApiV1ResourceContextSampleGet(ctx).Limit(limit).Execute()

Get sample context data



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
	limit := int32(56) // int32 | Number of rows (optional) (default to 5)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceContextAPI.GetSampleContextApiV1ResourceContextSampleGet(context.Background()).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceContextAPI.GetSampleContextApiV1ResourceContextSampleGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetSampleContextApiV1ResourceContextSampleGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceContextAPI.GetSampleContextApiV1ResourceContextSampleGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetSampleContextApiV1ResourceContextSampleGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **int32** | Number of rows | [default to 5]

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


## GetUsageHistoryApiV1ResourceContextHistoryPost

> interface{} GetUsageHistoryApiV1ResourceContextHistoryPost(ctx).HistoryRequest(historyRequest).Execute()

Query usage history



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
	historyRequest := *openapiclient.NewHistoryRequest() // HistoryRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceContextAPI.GetUsageHistoryApiV1ResourceContextHistoryPost(context.Background()).HistoryRequest(historyRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceContextAPI.GetUsageHistoryApiV1ResourceContextHistoryPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetUsageHistoryApiV1ResourceContextHistoryPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceContextAPI.GetUsageHistoryApiV1ResourceContextHistoryPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetUsageHistoryApiV1ResourceContextHistoryPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **historyRequest** | [**HistoryRequest**](HistoryRequest.md) |  | 

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


## QueryContextRawApiV1ResourceContextQueryPost

> interface{} QueryContextRawApiV1ResourceContextQueryPost(ctx).RawContextRequest(rawContextRequest).Execute()

Query user agent context (raw SQL)



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
	rawContextRequest := *openapiclient.NewRawContextRequest("ModelName_example", "ChatId_example") // RawContextRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceContextAPI.QueryContextRawApiV1ResourceContextQueryPost(context.Background()).RawContextRequest(rawContextRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceContextAPI.QueryContextRawApiV1ResourceContextQueryPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `QueryContextRawApiV1ResourceContextQueryPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceContextAPI.QueryContextRawApiV1ResourceContextQueryPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiQueryContextRawApiV1ResourceContextQueryPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **rawContextRequest** | [**RawContextRequest**](RawContextRequest.md) |  | 

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


## RemoveFieldApiV1ResourceContextRemoveFieldPost

> interface{} RemoveFieldApiV1ResourceContextRemoveFieldPost(ctx).FieldRemoveRequest(fieldRemoveRequest).Execute()

删除指定字段

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
	fieldRemoveRequest := *openapiclient.NewFieldRemoveRequest("AgentId_example", "FieldName_example") // FieldRemoveRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceContextAPI.RemoveFieldApiV1ResourceContextRemoveFieldPost(context.Background()).FieldRemoveRequest(fieldRemoveRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceContextAPI.RemoveFieldApiV1ResourceContextRemoveFieldPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RemoveFieldApiV1ResourceContextRemoveFieldPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceContextAPI.RemoveFieldApiV1ResourceContextRemoveFieldPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRemoveFieldApiV1ResourceContextRemoveFieldPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fieldRemoveRequest** | [**FieldRemoveRequest**](FieldRemoveRequest.md) |  | 

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


## SaveContextApiV1ResourceContextSavePost

> interface{} SaveContextApiV1ResourceContextSavePost(ctx).ContextSaveRequest(contextSaveRequest).Execute()

保存用户上下文

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
	contextSaveRequest := *openapiclient.NewContextSaveRequest("AgentId_example", "ContextKey_example", "ContextValue_example") // ContextSaveRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceContextAPI.SaveContextApiV1ResourceContextSavePost(context.Background()).ContextSaveRequest(contextSaveRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceContextAPI.SaveContextApiV1ResourceContextSavePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SaveContextApiV1ResourceContextSavePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceContextAPI.SaveContextApiV1ResourceContextSavePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSaveContextApiV1ResourceContextSavePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **contextSaveRequest** | [**ContextSaveRequest**](ContextSaveRequest.md) |  | 

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

