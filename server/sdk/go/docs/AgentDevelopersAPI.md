# \AgentDevelopersAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**BindCozeApiV1AgentsCozeLinkBindPost**](AgentDevelopersAPI.md#BindCozeApiV1AgentsCozeLinkBindPost) | **Post** /api/v1/agents/coze-link/bind | 绑定 Coze 账号
[**BindDeveloperApiV1AgentsBindPost**](AgentDevelopersAPI.md#BindDeveloperApiV1AgentsBindPost) | **Post** /api/v1/agents/bind | 绑定 Agent 到当前用户（成为开发者）
[**CozeLinkApiV1AgentsCozeLinkGet**](AgentDevelopersAPI.md#CozeLinkApiV1AgentsCozeLinkGet) | **Get** /api/v1/agents/coze-link | 查询 Coze 账号绑定
[**GetDeveloperApiV1AgentsRecordIdGet**](AgentDevelopersAPI.md#GetDeveloperApiV1AgentsRecordIdGet) | **Get** /api/v1/agents/{record_id} | 开发者记录详情
[**MyDeveloperAgentsApiV1AgentsMyGet**](AgentDevelopersAPI.md#MyDeveloperAgentsApiV1AgentsMyGet) | **Get** /api/v1/agents/my | 我作为开发者的所有 Agent
[**UpdatePriceApiV1AgentsUpdatePricePost**](AgentDevelopersAPI.md#UpdatePriceApiV1AgentsUpdatePricePost) | **Post** /api/v1/agents/update-price | 更新开发者价格



## BindCozeApiV1AgentsCozeLinkBindPost

> interface{} BindCozeApiV1AgentsCozeLinkBindPost(ctx).CozeAccountId(cozeAccountId).CozeAccountName(cozeAccountName).Execute()

绑定 Coze 账号

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
	cozeAccountId := "cozeAccountId_example" // string | 
	cozeAccountName := "cozeAccountName_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentDevelopersAPI.BindCozeApiV1AgentsCozeLinkBindPost(context.Background()).CozeAccountId(cozeAccountId).CozeAccountName(cozeAccountName).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentDevelopersAPI.BindCozeApiV1AgentsCozeLinkBindPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BindCozeApiV1AgentsCozeLinkBindPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentDevelopersAPI.BindCozeApiV1AgentsCozeLinkBindPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiBindCozeApiV1AgentsCozeLinkBindPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cozeAccountId** | **string** |  | 
 **cozeAccountName** | **string** |  | 

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


## BindDeveloperApiV1AgentsBindPost

> interface{} BindDeveloperApiV1AgentsBindPost(ctx).AgentId(agentId).Price(price).Execute()

绑定 Agent 到当前用户（成为开发者）

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
	price := float32(8.14) // float32 | 开发者价格 (optional) (default to 0.0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentDevelopersAPI.BindDeveloperApiV1AgentsBindPost(context.Background()).AgentId(agentId).Price(price).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentDevelopersAPI.BindDeveloperApiV1AgentsBindPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BindDeveloperApiV1AgentsBindPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentDevelopersAPI.BindDeveloperApiV1AgentsBindPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiBindDeveloperApiV1AgentsBindPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **price** | **float32** | 开发者价格 | [default to 0.0]

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


## CozeLinkApiV1AgentsCozeLinkGet

> interface{} CozeLinkApiV1AgentsCozeLinkGet(ctx).Execute()

查询 Coze 账号绑定

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
	resp, r, err := apiClient.AgentDevelopersAPI.CozeLinkApiV1AgentsCozeLinkGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentDevelopersAPI.CozeLinkApiV1AgentsCozeLinkGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CozeLinkApiV1AgentsCozeLinkGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentDevelopersAPI.CozeLinkApiV1AgentsCozeLinkGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCozeLinkApiV1AgentsCozeLinkGetRequest struct via the builder pattern


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


## GetDeveloperApiV1AgentsRecordIdGet

> interface{} GetDeveloperApiV1AgentsRecordIdGet(ctx, recordId).Execute()

开发者记录详情



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
	recordId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentDevelopersAPI.GetDeveloperApiV1AgentsRecordIdGet(context.Background(), recordId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentDevelopersAPI.GetDeveloperApiV1AgentsRecordIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetDeveloperApiV1AgentsRecordIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentDevelopersAPI.GetDeveloperApiV1AgentsRecordIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**recordId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetDeveloperApiV1AgentsRecordIdGetRequest struct via the builder pattern


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


## MyDeveloperAgentsApiV1AgentsMyGet

> interface{} MyDeveloperAgentsApiV1AgentsMyGet(ctx).Execute()

我作为开发者的所有 Agent

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
	resp, r, err := apiClient.AgentDevelopersAPI.MyDeveloperAgentsApiV1AgentsMyGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentDevelopersAPI.MyDeveloperAgentsApiV1AgentsMyGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MyDeveloperAgentsApiV1AgentsMyGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentDevelopersAPI.MyDeveloperAgentsApiV1AgentsMyGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiMyDeveloperAgentsApiV1AgentsMyGetRequest struct via the builder pattern


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


## UpdatePriceApiV1AgentsUpdatePricePost

> interface{} UpdatePriceApiV1AgentsUpdatePricePost(ctx).AgentId(agentId).Price(price).Execute()

更新开发者价格

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
	price := float32(8.14) // float32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentDevelopersAPI.UpdatePriceApiV1AgentsUpdatePricePost(context.Background()).AgentId(agentId).Price(price).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentDevelopersAPI.UpdatePriceApiV1AgentsUpdatePricePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdatePriceApiV1AgentsUpdatePricePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentDevelopersAPI.UpdatePriceApiV1AgentsUpdatePricePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdatePriceApiV1AgentsUpdatePricePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **price** | **float32** |  | 

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

