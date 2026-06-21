# \AgentIdentityAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateIdentityOrderApiV1AgentsCreatePost**](AgentIdentityAPI.md#CreateIdentityOrderApiV1AgentsCreatePost) | **Post** /api/v1/agents/create | 创建身份订单
[**CreateProportionApiV1AgentsProportionCreatePost**](AgentIdentityAPI.md#CreateProportionApiV1AgentsProportionCreatePost) | **Post** /api/v1/agents/proportion/create | 创建比例配置
[**ListIdentityOrdersApiV1AgentsListGet**](AgentIdentityAPI.md#ListIdentityOrdersApiV1AgentsListGet) | **Get** /api/v1/agents/list | 身份订单列表
[**ListProportionsApiV1AgentsProportionListGet**](AgentIdentityAPI.md#ListProportionsApiV1AgentsProportionListGet) | **Get** /api/v1/agents/proportion/list | 身份比例列表
[**UpdateProportionApiV1AgentsProportionProportionIdPut**](AgentIdentityAPI.md#UpdateProportionApiV1AgentsProportionProportionIdPut) | **Put** /api/v1/agents/proportion/{proportion_id} | 修改比例



## CreateIdentityOrderApiV1AgentsCreatePost

> interface{} CreateIdentityOrderApiV1AgentsCreatePost(ctx).IdentityId(identityId).PayType(payType).Execute()

创建身份订单

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
	identityId := "identityId_example" // string | 产品身份ID
	payType := "payType_example" // string | 支付方式: wechat / alipay (optional) (default to "wechat")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentIdentityAPI.CreateIdentityOrderApiV1AgentsCreatePost(context.Background()).IdentityId(identityId).PayType(payType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentIdentityAPI.CreateIdentityOrderApiV1AgentsCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateIdentityOrderApiV1AgentsCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentIdentityAPI.CreateIdentityOrderApiV1AgentsCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateIdentityOrderApiV1AgentsCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **identityId** | **string** | 产品身份ID | 
 **payType** | **string** | 支付方式: wechat / alipay | [default to &quot;wechat&quot;]

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


## CreateProportionApiV1AgentsProportionCreatePost

> interface{} CreateProportionApiV1AgentsProportionCreatePost(ctx).IdentityProportionBody(identityProportionBody).Execute()

创建比例配置

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
	identityProportionBody := *openapiclient.NewIdentityProportionBody() // IdentityProportionBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentIdentityAPI.CreateProportionApiV1AgentsProportionCreatePost(context.Background()).IdentityProportionBody(identityProportionBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentIdentityAPI.CreateProportionApiV1AgentsProportionCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateProportionApiV1AgentsProportionCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentIdentityAPI.CreateProportionApiV1AgentsProportionCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateProportionApiV1AgentsProportionCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **identityProportionBody** | [**IdentityProportionBody**](IdentityProportionBody.md) |  | 

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


## ListIdentityOrdersApiV1AgentsListGet

> interface{} ListIdentityOrdersApiV1AgentsListGet(ctx).Page(page).Limit(limit).Status(status).OrderType(orderType).Execute()

身份订单列表

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
	status := int32(56) // int32 | 订单状态 0=待支付 1=已支付 2=已退款 3=已取消 (optional)
	orderType := int32(56) // int32 | 订单类型, 默认2=身份订单 (optional) (default to 2)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentIdentityAPI.ListIdentityOrdersApiV1AgentsListGet(context.Background()).Page(page).Limit(limit).Status(status).OrderType(orderType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentIdentityAPI.ListIdentityOrdersApiV1AgentsListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListIdentityOrdersApiV1AgentsListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentIdentityAPI.ListIdentityOrdersApiV1AgentsListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListIdentityOrdersApiV1AgentsListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **status** | **int32** | 订单状态 0&#x3D;待支付 1&#x3D;已支付 2&#x3D;已退款 3&#x3D;已取消 | 
 **orderType** | **int32** | 订单类型, 默认2&#x3D;身份订单 | [default to 2]

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


## ListProportionsApiV1AgentsProportionListGet

> interface{} ListProportionsApiV1AgentsProportionListGet(ctx).Page(page).Limit(limit).Status(status).Execute()

身份比例列表

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
	status := int32(56) // int32 | 0=stopped 1=active (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentIdentityAPI.ListProportionsApiV1AgentsProportionListGet(context.Background()).Page(page).Limit(limit).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentIdentityAPI.ListProportionsApiV1AgentsProportionListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListProportionsApiV1AgentsProportionListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentIdentityAPI.ListProportionsApiV1AgentsProportionListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListProportionsApiV1AgentsProportionListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **status** | **int32** | 0&#x3D;stopped 1&#x3D;active | 

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


## UpdateProportionApiV1AgentsProportionProportionIdPut

> interface{} UpdateProportionApiV1AgentsProportionProportionIdPut(ctx, proportionId).IdentityProportionBody(identityProportionBody).Execute()

修改比例

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
	proportionId := "proportionId_example" // string | 
	identityProportionBody := *openapiclient.NewIdentityProportionBody() // IdentityProportionBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentIdentityAPI.UpdateProportionApiV1AgentsProportionProportionIdPut(context.Background(), proportionId).IdentityProportionBody(identityProportionBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentIdentityAPI.UpdateProportionApiV1AgentsProportionProportionIdPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateProportionApiV1AgentsProportionProportionIdPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentIdentityAPI.UpdateProportionApiV1AgentsProportionProportionIdPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**proportionId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateProportionApiV1AgentsProportionProportionIdPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **identityProportionBody** | [**IdentityProportionBody**](IdentityProportionBody.md) |  | 

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

