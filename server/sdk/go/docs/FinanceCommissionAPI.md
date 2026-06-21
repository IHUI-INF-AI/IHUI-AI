# \FinanceCommissionAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ListOrdersApiV1FinanceOrdersGet**](FinanceCommissionAPI.md#ListOrdersApiV1FinanceOrdersGet) | **Get** /api/v1/finance/orders | 我的订单列表（分页+筛选）
[**SettleCommissionApiV1FinanceSettleCommissionIdPost**](FinanceCommissionAPI.md#SettleCommissionApiV1FinanceSettleCommissionIdPost) | **Post** /api/v1/finance/settle/{commission_id} | 手动结算佣金流水



## ListOrdersApiV1FinanceOrdersGet

> interface{} ListOrdersApiV1FinanceOrdersGet(ctx).Page(page).Limit(limit).OrderType(orderType).Status(status).Execute()

我的订单列表（分页+筛选）

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
	orderType := int32(56) // int32 | 订单类型：0=token 1=activity 2=identity 3=agent (optional)
	status := int32(56) // int32 | 订单状态：0=待支付 1=已支付 2=已退款 3=已取消 (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceCommissionAPI.ListOrdersApiV1FinanceOrdersGet(context.Background()).Page(page).Limit(limit).OrderType(orderType).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceCommissionAPI.ListOrdersApiV1FinanceOrdersGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListOrdersApiV1FinanceOrdersGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceCommissionAPI.ListOrdersApiV1FinanceOrdersGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListOrdersApiV1FinanceOrdersGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **orderType** | **int32** | 订单类型：0&#x3D;token 1&#x3D;activity 2&#x3D;identity 3&#x3D;agent | 
 **status** | **int32** | 订单状态：0&#x3D;待支付 1&#x3D;已支付 2&#x3D;已退款 3&#x3D;已取消 | 

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


## SettleCommissionApiV1FinanceSettleCommissionIdPost

> interface{} SettleCommissionApiV1FinanceSettleCommissionIdPost(ctx, commissionId).Execute()

手动结算佣金流水



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
	commissionId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceCommissionAPI.SettleCommissionApiV1FinanceSettleCommissionIdPost(context.Background(), commissionId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceCommissionAPI.SettleCommissionApiV1FinanceSettleCommissionIdPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SettleCommissionApiV1FinanceSettleCommissionIdPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceCommissionAPI.SettleCommissionApiV1FinanceSettleCommissionIdPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**commissionId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiSettleCommissionApiV1FinanceSettleCommissionIdPostRequest struct via the builder pattern


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

