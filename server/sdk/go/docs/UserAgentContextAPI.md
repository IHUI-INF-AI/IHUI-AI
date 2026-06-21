# \UserAgentContextAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddContextApiV1UserAgentContextPost**](UserAgentContextAPI.md#AddContextApiV1UserAgentContextPost) | **Post** /api/v1/user-agent-context | 添加上下文消息
[**AddContextApiV1UserAgentContextPost_0**](UserAgentContextAPI.md#AddContextApiV1UserAgentContextPost_0) | **Post** /api/v1/user-agent-context | 添加上下文消息
[**ClearContextApiV1UserAgentContextDelete**](UserAgentContextAPI.md#ClearContextApiV1UserAgentContextDelete) | **Delete** /api/v1/user-agent-context | 清空上下文
[**ClearContextApiV1UserAgentContextDelete_0**](UserAgentContextAPI.md#ClearContextApiV1UserAgentContextDelete_0) | **Delete** /api/v1/user-agent-context | 清空上下文
[**ListContextApiV1UserAgentContextListGet**](UserAgentContextAPI.md#ListContextApiV1UserAgentContextListGet) | **Get** /api/v1/user-agent-context/list | 获取上下文
[**ListContextApiV1UserAgentContextListGet_0**](UserAgentContextAPI.md#ListContextApiV1UserAgentContextListGet_0) | **Get** /api/v1/user-agent-context/list | 获取上下文
[**ListSummariesApiV1UserAgentContextSummaryListGet**](UserAgentContextAPI.md#ListSummariesApiV1UserAgentContextSummaryListGet) | **Get** /api/v1/user-agent-context/summary/list | 总结列表
[**ListSummariesApiV1UserAgentContextSummaryListGet_0**](UserAgentContextAPI.md#ListSummariesApiV1UserAgentContextSummaryListGet_0) | **Get** /api/v1/user-agent-context/summary/list | 总结列表
[**SummarizeContextApiV1UserAgentContextSummaryPost**](UserAgentContextAPI.md#SummarizeContextApiV1UserAgentContextSummaryPost) | **Post** /api/v1/user-agent-context/summary | 总结上下文
[**SummarizeContextApiV1UserAgentContextSummaryPost_0**](UserAgentContextAPI.md#SummarizeContextApiV1UserAgentContextSummaryPost_0) | **Post** /api/v1/user-agent-context/summary | 总结上下文



## AddContextApiV1UserAgentContextPost

> interface{} AddContextApiV1UserAgentContextPost(ctx).AgentId(agentId).SessionId(sessionId).Role(role).Content(content).ContentType(contentType).Tokens(tokens).Model(model).Execute()

添加上下文消息

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
	sessionId := "sessionId_example" // string | 
	role := "role_example" // string | 
	content := "content_example" // string | 
	contentType := "contentType_example" // string |  (optional) (default to "text")
	tokens := int32(56) // int32 |  (optional) (default to 0)
	model := "model_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserAgentContextAPI.AddContextApiV1UserAgentContextPost(context.Background()).AgentId(agentId).SessionId(sessionId).Role(role).Content(content).ContentType(contentType).Tokens(tokens).Model(model).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserAgentContextAPI.AddContextApiV1UserAgentContextPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddContextApiV1UserAgentContextPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserAgentContextAPI.AddContextApiV1UserAgentContextPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAddContextApiV1UserAgentContextPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **sessionId** | **string** |  | 
 **role** | **string** |  | 
 **content** | **string** |  | 
 **contentType** | **string** |  | [default to &quot;text&quot;]
 **tokens** | **int32** |  | [default to 0]
 **model** | **string** |  | 

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


## AddContextApiV1UserAgentContextPost_0

> interface{} AddContextApiV1UserAgentContextPost_0(ctx).AgentId(agentId).SessionId(sessionId).Role(role).Content(content).ContentType(contentType).Tokens(tokens).Model(model).Execute()

添加上下文消息

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
	sessionId := "sessionId_example" // string | 
	role := "role_example" // string | 
	content := "content_example" // string | 
	contentType := "contentType_example" // string |  (optional) (default to "text")
	tokens := int32(56) // int32 |  (optional) (default to 0)
	model := "model_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserAgentContextAPI.AddContextApiV1UserAgentContextPost_0(context.Background()).AgentId(agentId).SessionId(sessionId).Role(role).Content(content).ContentType(contentType).Tokens(tokens).Model(model).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserAgentContextAPI.AddContextApiV1UserAgentContextPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddContextApiV1UserAgentContextPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserAgentContextAPI.AddContextApiV1UserAgentContextPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAddContextApiV1UserAgentContextPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **sessionId** | **string** |  | 
 **role** | **string** |  | 
 **content** | **string** |  | 
 **contentType** | **string** |  | [default to &quot;text&quot;]
 **tokens** | **int32** |  | [default to 0]
 **model** | **string** |  | 

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


## ClearContextApiV1UserAgentContextDelete

> interface{} ClearContextApiV1UserAgentContextDelete(ctx).AgentId(agentId).SessionId(sessionId).Execute()

清空上下文

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
	sessionId := "sessionId_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserAgentContextAPI.ClearContextApiV1UserAgentContextDelete(context.Background()).AgentId(agentId).SessionId(sessionId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserAgentContextAPI.ClearContextApiV1UserAgentContextDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ClearContextApiV1UserAgentContextDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserAgentContextAPI.ClearContextApiV1UserAgentContextDelete`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiClearContextApiV1UserAgentContextDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **sessionId** | **string** |  | 

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


## ClearContextApiV1UserAgentContextDelete_0

> interface{} ClearContextApiV1UserAgentContextDelete_0(ctx).AgentId(agentId).SessionId(sessionId).Execute()

清空上下文

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
	sessionId := "sessionId_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserAgentContextAPI.ClearContextApiV1UserAgentContextDelete_0(context.Background()).AgentId(agentId).SessionId(sessionId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserAgentContextAPI.ClearContextApiV1UserAgentContextDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ClearContextApiV1UserAgentContextDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserAgentContextAPI.ClearContextApiV1UserAgentContextDelete_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiClearContextApiV1UserAgentContextDelete_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **sessionId** | **string** |  | 

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


## ListContextApiV1UserAgentContextListGet

> interface{} ListContextApiV1UserAgentContextListGet(ctx).AgentId(agentId).SessionId(sessionId).Limit(limit).Execute()

获取上下文

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
	sessionId := "sessionId_example" // string |  (optional)
	limit := int32(56) // int32 |  (optional) (default to 50)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserAgentContextAPI.ListContextApiV1UserAgentContextListGet(context.Background()).AgentId(agentId).SessionId(sessionId).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserAgentContextAPI.ListContextApiV1UserAgentContextListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListContextApiV1UserAgentContextListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserAgentContextAPI.ListContextApiV1UserAgentContextListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListContextApiV1UserAgentContextListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **sessionId** | **string** |  | 
 **limit** | **int32** |  | [default to 50]

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


## ListContextApiV1UserAgentContextListGet_0

> interface{} ListContextApiV1UserAgentContextListGet_0(ctx).AgentId(agentId).SessionId(sessionId).Limit(limit).Execute()

获取上下文

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
	sessionId := "sessionId_example" // string |  (optional)
	limit := int32(56) // int32 |  (optional) (default to 50)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserAgentContextAPI.ListContextApiV1UserAgentContextListGet_0(context.Background()).AgentId(agentId).SessionId(sessionId).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserAgentContextAPI.ListContextApiV1UserAgentContextListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListContextApiV1UserAgentContextListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserAgentContextAPI.ListContextApiV1UserAgentContextListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListContextApiV1UserAgentContextListGet_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **sessionId** | **string** |  | 
 **limit** | **int32** |  | [default to 50]

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


## ListSummariesApiV1UserAgentContextSummaryListGet

> interface{} ListSummariesApiV1UserAgentContextSummaryListGet(ctx).AgentId(agentId).Limit(limit).Execute()

总结列表

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
	limit := int32(56) // int32 |  (optional) (default to 10)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserAgentContextAPI.ListSummariesApiV1UserAgentContextSummaryListGet(context.Background()).AgentId(agentId).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserAgentContextAPI.ListSummariesApiV1UserAgentContextSummaryListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListSummariesApiV1UserAgentContextSummaryListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserAgentContextAPI.ListSummariesApiV1UserAgentContextSummaryListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListSummariesApiV1UserAgentContextSummaryListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **limit** | **int32** |  | [default to 10]

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


## ListSummariesApiV1UserAgentContextSummaryListGet_0

> interface{} ListSummariesApiV1UserAgentContextSummaryListGet_0(ctx).AgentId(agentId).Limit(limit).Execute()

总结列表

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
	limit := int32(56) // int32 |  (optional) (default to 10)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserAgentContextAPI.ListSummariesApiV1UserAgentContextSummaryListGet_0(context.Background()).AgentId(agentId).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserAgentContextAPI.ListSummariesApiV1UserAgentContextSummaryListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListSummariesApiV1UserAgentContextSummaryListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserAgentContextAPI.ListSummariesApiV1UserAgentContextSummaryListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListSummariesApiV1UserAgentContextSummaryListGet_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **limit** | **int32** |  | [default to 10]

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


## SummarizeContextApiV1UserAgentContextSummaryPost

> interface{} SummarizeContextApiV1UserAgentContextSummaryPost(ctx).AgentId(agentId).Summary(summary).SessionId(sessionId).StartId(startId).EndId(endId).Tokens(tokens).Execute()

总结上下文

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
	summary := "summary_example" // string | 
	sessionId := "sessionId_example" // string |  (optional)
	startId := int32(56) // int32 |  (optional) (default to 0)
	endId := int32(56) // int32 |  (optional) (default to 0)
	tokens := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserAgentContextAPI.SummarizeContextApiV1UserAgentContextSummaryPost(context.Background()).AgentId(agentId).Summary(summary).SessionId(sessionId).StartId(startId).EndId(endId).Tokens(tokens).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserAgentContextAPI.SummarizeContextApiV1UserAgentContextSummaryPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SummarizeContextApiV1UserAgentContextSummaryPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserAgentContextAPI.SummarizeContextApiV1UserAgentContextSummaryPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSummarizeContextApiV1UserAgentContextSummaryPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **summary** | **string** |  | 
 **sessionId** | **string** |  | 
 **startId** | **int32** |  | [default to 0]
 **endId** | **int32** |  | [default to 0]
 **tokens** | **int32** |  | [default to 0]

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


## SummarizeContextApiV1UserAgentContextSummaryPost_0

> interface{} SummarizeContextApiV1UserAgentContextSummaryPost_0(ctx).AgentId(agentId).Summary(summary).SessionId(sessionId).StartId(startId).EndId(endId).Tokens(tokens).Execute()

总结上下文

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
	summary := "summary_example" // string | 
	sessionId := "sessionId_example" // string |  (optional)
	startId := int32(56) // int32 |  (optional) (default to 0)
	endId := int32(56) // int32 |  (optional) (default to 0)
	tokens := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserAgentContextAPI.SummarizeContextApiV1UserAgentContextSummaryPost_0(context.Background()).AgentId(agentId).Summary(summary).SessionId(sessionId).StartId(startId).EndId(endId).Tokens(tokens).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserAgentContextAPI.SummarizeContextApiV1UserAgentContextSummaryPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SummarizeContextApiV1UserAgentContextSummaryPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserAgentContextAPI.SummarizeContextApiV1UserAgentContextSummaryPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSummarizeContextApiV1UserAgentContextSummaryPost_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **summary** | **string** |  | 
 **sessionId** | **string** |  | 
 **startId** | **int32** |  | [default to 0]
 **endId** | **int32** |  | [default to 0]
 **tokens** | **int32** |  | [default to 0]

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

