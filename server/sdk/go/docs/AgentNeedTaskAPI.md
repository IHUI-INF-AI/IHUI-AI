# \AgentNeedTaskAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AcceptTaskApiV1AgentNeedTaskTidAcceptPost**](AgentNeedTaskAPI.md#AcceptTaskApiV1AgentNeedTaskTidAcceptPost) | **Post** /api/v1/agent-need-task/{tid}/accept | 开发者认领
[**AcceptTaskApiV1AgentNeedTaskTidAcceptPost_0**](AgentNeedTaskAPI.md#AcceptTaskApiV1AgentNeedTaskTidAcceptPost_0) | **Post** /api/v1/agent-need-task/{tid}/accept | 开发者认领
[**BidTaskApiV1AgentNeedTaskTidBidPost**](AgentNeedTaskAPI.md#BidTaskApiV1AgentNeedTaskTidBidPost) | **Post** /api/v1/agent-need-task/{tid}/bid | 开发者报价
[**BidTaskApiV1AgentNeedTaskTidBidPost_0**](AgentNeedTaskAPI.md#BidTaskApiV1AgentNeedTaskTidBidPost_0) | **Post** /api/v1/agent-need-task/{tid}/bid | 开发者报价
[**CreateTaskApiV1AgentNeedTaskPost**](AgentNeedTaskAPI.md#CreateTaskApiV1AgentNeedTaskPost) | **Post** /api/v1/agent-need-task | 发布需求
[**CreateTaskApiV1AgentNeedTaskPost_0**](AgentNeedTaskAPI.md#CreateTaskApiV1AgentNeedTaskPost_0) | **Post** /api/v1/agent-need-task | 发布需求
[**DeleteTaskApiV1AgentNeedTaskTidDelete**](AgentNeedTaskAPI.md#DeleteTaskApiV1AgentNeedTaskTidDelete) | **Delete** /api/v1/agent-need-task/{tid} | 删除需求
[**DeleteTaskApiV1AgentNeedTaskTidDelete_0**](AgentNeedTaskAPI.md#DeleteTaskApiV1AgentNeedTaskTidDelete_0) | **Delete** /api/v1/agent-need-task/{tid} | 删除需求
[**GetTaskApiV1AgentNeedTaskTidGet**](AgentNeedTaskAPI.md#GetTaskApiV1AgentNeedTaskTidGet) | **Get** /api/v1/agent-need-task/{tid} | 需求详情
[**GetTaskApiV1AgentNeedTaskTidGet_0**](AgentNeedTaskAPI.md#GetTaskApiV1AgentNeedTaskTidGet_0) | **Get** /api/v1/agent-need-task/{tid} | 需求详情
[**ListBidsApiV1AgentNeedTaskTidBidsGet**](AgentNeedTaskAPI.md#ListBidsApiV1AgentNeedTaskTidBidsGet) | **Get** /api/v1/agent-need-task/{tid}/bids | 任务报价列表
[**ListBidsApiV1AgentNeedTaskTidBidsGet_0**](AgentNeedTaskAPI.md#ListBidsApiV1AgentNeedTaskTidBidsGet_0) | **Get** /api/v1/agent-need-task/{tid}/bids | 任务报价列表
[**ListTasksApiV1AgentNeedTaskListGet**](AgentNeedTaskAPI.md#ListTasksApiV1AgentNeedTaskListGet) | **Get** /api/v1/agent-need-task/list | 需求列表
[**ListTasksApiV1AgentNeedTaskListGet_0**](AgentNeedTaskAPI.md#ListTasksApiV1AgentNeedTaskListGet_0) | **Get** /api/v1/agent-need-task/list | 需求列表
[**UpdateTaskApiV1AgentNeedTaskTidPut**](AgentNeedTaskAPI.md#UpdateTaskApiV1AgentNeedTaskTidPut) | **Put** /api/v1/agent-need-task/{tid} | 修改需求
[**UpdateTaskApiV1AgentNeedTaskTidPut_0**](AgentNeedTaskAPI.md#UpdateTaskApiV1AgentNeedTaskTidPut_0) | **Put** /api/v1/agent-need-task/{tid} | 修改需求



## AcceptTaskApiV1AgentNeedTaskTidAcceptPost

> interface{} AcceptTaskApiV1AgentNeedTaskTidAcceptPost(ctx, tid).Execute()

开发者认领

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
	tid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentNeedTaskAPI.AcceptTaskApiV1AgentNeedTaskTidAcceptPost(context.Background(), tid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentNeedTaskAPI.AcceptTaskApiV1AgentNeedTaskTidAcceptPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AcceptTaskApiV1AgentNeedTaskTidAcceptPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentNeedTaskAPI.AcceptTaskApiV1AgentNeedTaskTidAcceptPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**tid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiAcceptTaskApiV1AgentNeedTaskTidAcceptPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## AcceptTaskApiV1AgentNeedTaskTidAcceptPost_0

> interface{} AcceptTaskApiV1AgentNeedTaskTidAcceptPost_0(ctx, tid).Execute()

开发者认领

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
	tid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentNeedTaskAPI.AcceptTaskApiV1AgentNeedTaskTidAcceptPost_0(context.Background(), tid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentNeedTaskAPI.AcceptTaskApiV1AgentNeedTaskTidAcceptPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AcceptTaskApiV1AgentNeedTaskTidAcceptPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentNeedTaskAPI.AcceptTaskApiV1AgentNeedTaskTidAcceptPost_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**tid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiAcceptTaskApiV1AgentNeedTaskTidAcceptPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## BidTaskApiV1AgentNeedTaskTidBidPost

> interface{} BidTaskApiV1AgentNeedTaskTidBidPost(ctx, tid).Bid(bid).Remark(remark).Execute()

开发者报价

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
	tid := int32(56) // int32 | 
	bid := int32(56) // int32 | 
	remark := "remark_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentNeedTaskAPI.BidTaskApiV1AgentNeedTaskTidBidPost(context.Background(), tid).Bid(bid).Remark(remark).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentNeedTaskAPI.BidTaskApiV1AgentNeedTaskTidBidPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BidTaskApiV1AgentNeedTaskTidBidPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentNeedTaskAPI.BidTaskApiV1AgentNeedTaskTidBidPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**tid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiBidTaskApiV1AgentNeedTaskTidBidPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **bid** | **int32** |  | 
 **remark** | **string** |  | 

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


## BidTaskApiV1AgentNeedTaskTidBidPost_0

> interface{} BidTaskApiV1AgentNeedTaskTidBidPost_0(ctx, tid).Bid(bid).Remark(remark).Execute()

开发者报价

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
	tid := int32(56) // int32 | 
	bid := int32(56) // int32 | 
	remark := "remark_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentNeedTaskAPI.BidTaskApiV1AgentNeedTaskTidBidPost_0(context.Background(), tid).Bid(bid).Remark(remark).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentNeedTaskAPI.BidTaskApiV1AgentNeedTaskTidBidPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BidTaskApiV1AgentNeedTaskTidBidPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentNeedTaskAPI.BidTaskApiV1AgentNeedTaskTidBidPost_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**tid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiBidTaskApiV1AgentNeedTaskTidBidPost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **bid** | **int32** |  | 
 **remark** | **string** |  | 

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


## CreateTaskApiV1AgentNeedTaskPost

> interface{} CreateTaskApiV1AgentNeedTaskPost(ctx).Title(title).Description(description).Type_(type_).AgentId(agentId).AgentName(agentName).Priority(priority).Budget(budget).Deadline(deadline).Execute()

发布需求

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
    "time"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	title := "title_example" // string | 
	description := "description_example" // string | 
	type_ := "type__example" // string |  (optional) (default to "develop")
	agentId := "agentId_example" // string |  (optional)
	agentName := "agentName_example" // string |  (optional)
	priority := int32(56) // int32 |  (optional) (default to 1)
	budget := int32(56) // int32 |  (optional) (default to 0)
	deadline := time.Now() // time.Time |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentNeedTaskAPI.CreateTaskApiV1AgentNeedTaskPost(context.Background()).Title(title).Description(description).Type_(type_).AgentId(agentId).AgentName(agentName).Priority(priority).Budget(budget).Deadline(deadline).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentNeedTaskAPI.CreateTaskApiV1AgentNeedTaskPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateTaskApiV1AgentNeedTaskPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentNeedTaskAPI.CreateTaskApiV1AgentNeedTaskPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateTaskApiV1AgentNeedTaskPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **description** | **string** |  | 
 **type_** | **string** |  | [default to &quot;develop&quot;]
 **agentId** | **string** |  | 
 **agentName** | **string** |  | 
 **priority** | **int32** |  | [default to 1]
 **budget** | **int32** |  | [default to 0]
 **deadline** | **time.Time** |  | 

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


## CreateTaskApiV1AgentNeedTaskPost_0

> interface{} CreateTaskApiV1AgentNeedTaskPost_0(ctx).Title(title).Description(description).Type_(type_).AgentId(agentId).AgentName(agentName).Priority(priority).Budget(budget).Deadline(deadline).Execute()

发布需求

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
    "time"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	title := "title_example" // string | 
	description := "description_example" // string | 
	type_ := "type__example" // string |  (optional) (default to "develop")
	agentId := "agentId_example" // string |  (optional)
	agentName := "agentName_example" // string |  (optional)
	priority := int32(56) // int32 |  (optional) (default to 1)
	budget := int32(56) // int32 |  (optional) (default to 0)
	deadline := time.Now() // time.Time |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentNeedTaskAPI.CreateTaskApiV1AgentNeedTaskPost_0(context.Background()).Title(title).Description(description).Type_(type_).AgentId(agentId).AgentName(agentName).Priority(priority).Budget(budget).Deadline(deadline).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentNeedTaskAPI.CreateTaskApiV1AgentNeedTaskPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateTaskApiV1AgentNeedTaskPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentNeedTaskAPI.CreateTaskApiV1AgentNeedTaskPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateTaskApiV1AgentNeedTaskPost_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **description** | **string** |  | 
 **type_** | **string** |  | [default to &quot;develop&quot;]
 **agentId** | **string** |  | 
 **agentName** | **string** |  | 
 **priority** | **int32** |  | [default to 1]
 **budget** | **int32** |  | [default to 0]
 **deadline** | **time.Time** |  | 

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


## DeleteTaskApiV1AgentNeedTaskTidDelete

> interface{} DeleteTaskApiV1AgentNeedTaskTidDelete(ctx, tid).Execute()

删除需求

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
	tid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentNeedTaskAPI.DeleteTaskApiV1AgentNeedTaskTidDelete(context.Background(), tid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentNeedTaskAPI.DeleteTaskApiV1AgentNeedTaskTidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteTaskApiV1AgentNeedTaskTidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentNeedTaskAPI.DeleteTaskApiV1AgentNeedTaskTidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**tid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteTaskApiV1AgentNeedTaskTidDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## DeleteTaskApiV1AgentNeedTaskTidDelete_0

> interface{} DeleteTaskApiV1AgentNeedTaskTidDelete_0(ctx, tid).Execute()

删除需求

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
	tid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentNeedTaskAPI.DeleteTaskApiV1AgentNeedTaskTidDelete_0(context.Background(), tid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentNeedTaskAPI.DeleteTaskApiV1AgentNeedTaskTidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteTaskApiV1AgentNeedTaskTidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentNeedTaskAPI.DeleteTaskApiV1AgentNeedTaskTidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**tid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteTaskApiV1AgentNeedTaskTidDelete_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## GetTaskApiV1AgentNeedTaskTidGet

> interface{} GetTaskApiV1AgentNeedTaskTidGet(ctx, tid).Execute()

需求详情

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
	tid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentNeedTaskAPI.GetTaskApiV1AgentNeedTaskTidGet(context.Background(), tid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentNeedTaskAPI.GetTaskApiV1AgentNeedTaskTidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetTaskApiV1AgentNeedTaskTidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentNeedTaskAPI.GetTaskApiV1AgentNeedTaskTidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**tid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetTaskApiV1AgentNeedTaskTidGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## GetTaskApiV1AgentNeedTaskTidGet_0

> interface{} GetTaskApiV1AgentNeedTaskTidGet_0(ctx, tid).Execute()

需求详情

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
	tid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentNeedTaskAPI.GetTaskApiV1AgentNeedTaskTidGet_0(context.Background(), tid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentNeedTaskAPI.GetTaskApiV1AgentNeedTaskTidGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetTaskApiV1AgentNeedTaskTidGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentNeedTaskAPI.GetTaskApiV1AgentNeedTaskTidGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**tid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetTaskApiV1AgentNeedTaskTidGet_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## ListBidsApiV1AgentNeedTaskTidBidsGet

> interface{} ListBidsApiV1AgentNeedTaskTidBidsGet(ctx, tid).Execute()

任务报价列表

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
	tid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentNeedTaskAPI.ListBidsApiV1AgentNeedTaskTidBidsGet(context.Background(), tid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentNeedTaskAPI.ListBidsApiV1AgentNeedTaskTidBidsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListBidsApiV1AgentNeedTaskTidBidsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentNeedTaskAPI.ListBidsApiV1AgentNeedTaskTidBidsGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**tid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiListBidsApiV1AgentNeedTaskTidBidsGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## ListBidsApiV1AgentNeedTaskTidBidsGet_0

> interface{} ListBidsApiV1AgentNeedTaskTidBidsGet_0(ctx, tid).Execute()

任务报价列表

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
	tid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentNeedTaskAPI.ListBidsApiV1AgentNeedTaskTidBidsGet_0(context.Background(), tid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentNeedTaskAPI.ListBidsApiV1AgentNeedTaskTidBidsGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListBidsApiV1AgentNeedTaskTidBidsGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentNeedTaskAPI.ListBidsApiV1AgentNeedTaskTidBidsGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**tid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiListBidsApiV1AgentNeedTaskTidBidsGet_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## ListTasksApiV1AgentNeedTaskListGet

> interface{} ListTasksApiV1AgentNeedTaskListGet(ctx).Page(page).Limit(limit).Status(status).Type_(type_).UserId(userId).DeveloperId(developerId).Keyword(keyword).Execute()

需求列表

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
	type_ := "type__example" // string |  (optional)
	userId := "userId_example" // string |  (optional)
	developerId := "developerId_example" // string |  (optional)
	keyword := "keyword_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentNeedTaskAPI.ListTasksApiV1AgentNeedTaskListGet(context.Background()).Page(page).Limit(limit).Status(status).Type_(type_).UserId(userId).DeveloperId(developerId).Keyword(keyword).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentNeedTaskAPI.ListTasksApiV1AgentNeedTaskListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListTasksApiV1AgentNeedTaskListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentNeedTaskAPI.ListTasksApiV1AgentNeedTaskListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListTasksApiV1AgentNeedTaskListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **status** | **int32** |  | 
 **type_** | **string** |  | 
 **userId** | **string** |  | 
 **developerId** | **string** |  | 
 **keyword** | **string** |  | 

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


## ListTasksApiV1AgentNeedTaskListGet_0

> interface{} ListTasksApiV1AgentNeedTaskListGet_0(ctx).Page(page).Limit(limit).Status(status).Type_(type_).UserId(userId).DeveloperId(developerId).Keyword(keyword).Execute()

需求列表

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
	type_ := "type__example" // string |  (optional)
	userId := "userId_example" // string |  (optional)
	developerId := "developerId_example" // string |  (optional)
	keyword := "keyword_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentNeedTaskAPI.ListTasksApiV1AgentNeedTaskListGet_0(context.Background()).Page(page).Limit(limit).Status(status).Type_(type_).UserId(userId).DeveloperId(developerId).Keyword(keyword).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentNeedTaskAPI.ListTasksApiV1AgentNeedTaskListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListTasksApiV1AgentNeedTaskListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentNeedTaskAPI.ListTasksApiV1AgentNeedTaskListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListTasksApiV1AgentNeedTaskListGet_7Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **status** | **int32** |  | 
 **type_** | **string** |  | 
 **userId** | **string** |  | 
 **developerId** | **string** |  | 
 **keyword** | **string** |  | 

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


## UpdateTaskApiV1AgentNeedTaskTidPut

> interface{} UpdateTaskApiV1AgentNeedTaskTidPut(ctx, tid).Title(title).Description(description).Priority(priority).Budget(budget).Status(status).Deliverable(deliverable).Remark(remark).Execute()

修改需求

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
	tid := int32(56) // int32 | 
	title := "title_example" // string |  (optional)
	description := "description_example" // string |  (optional)
	priority := int32(56) // int32 |  (optional)
	budget := int32(56) // int32 |  (optional)
	status := int32(56) // int32 |  (optional)
	deliverable := "deliverable_example" // string |  (optional)
	remark := "remark_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentNeedTaskAPI.UpdateTaskApiV1AgentNeedTaskTidPut(context.Background(), tid).Title(title).Description(description).Priority(priority).Budget(budget).Status(status).Deliverable(deliverable).Remark(remark).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentNeedTaskAPI.UpdateTaskApiV1AgentNeedTaskTidPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateTaskApiV1AgentNeedTaskTidPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentNeedTaskAPI.UpdateTaskApiV1AgentNeedTaskTidPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**tid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateTaskApiV1AgentNeedTaskTidPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **title** | **string** |  | 
 **description** | **string** |  | 
 **priority** | **int32** |  | 
 **budget** | **int32** |  | 
 **status** | **int32** |  | 
 **deliverable** | **string** |  | 
 **remark** | **string** |  | 

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


## UpdateTaskApiV1AgentNeedTaskTidPut_0

> interface{} UpdateTaskApiV1AgentNeedTaskTidPut_0(ctx, tid).Title(title).Description(description).Priority(priority).Budget(budget).Status(status).Deliverable(deliverable).Remark(remark).Execute()

修改需求

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
	tid := int32(56) // int32 | 
	title := "title_example" // string |  (optional)
	description := "description_example" // string |  (optional)
	priority := int32(56) // int32 |  (optional)
	budget := int32(56) // int32 |  (optional)
	status := int32(56) // int32 |  (optional)
	deliverable := "deliverable_example" // string |  (optional)
	remark := "remark_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentNeedTaskAPI.UpdateTaskApiV1AgentNeedTaskTidPut_0(context.Background(), tid).Title(title).Description(description).Priority(priority).Budget(budget).Status(status).Deliverable(deliverable).Remark(remark).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentNeedTaskAPI.UpdateTaskApiV1AgentNeedTaskTidPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateTaskApiV1AgentNeedTaskTidPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentNeedTaskAPI.UpdateTaskApiV1AgentNeedTaskTidPut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**tid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateTaskApiV1AgentNeedTaskTidPut_8Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **title** | **string** |  | 
 **description** | **string** |  | 
 **priority** | **int32** |  | 
 **budget** | **int32** |  | 
 **status** | **int32** |  | 
 **deliverable** | **string** |  | 
 **remark** | **string** |  | 

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

