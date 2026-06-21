# \FinanceMarginAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AdminAdjustBalanceApiV1FinanceTargetUserUuidPut**](FinanceMarginAPI.md#AdminAdjustBalanceApiV1FinanceTargetUserUuidPut) | **Put** /api/v1/finance/{target_user_uuid} | 管理员直接调整用户 Token 余额
[**CheckBalanceApiV1FinanceCheckGet**](FinanceMarginAPI.md#CheckBalanceApiV1FinanceCheckGet) | **Get** /api/v1/finance/check | 检查余额是否充足
[**DeductApiV1FinanceDeductPost**](FinanceMarginAPI.md#DeductApiV1FinanceDeductPost) | **Post** /api/v1/finance/deduct | 扣减用户 token（内部调用）
[**ExpireApiV1FinanceExpirePost**](FinanceMarginAPI.md#ExpireApiV1FinanceExpirePost) | **Post** /api/v1/finance/expire | 过期清零（管理员/定时任务）
[**GetBalanceApiV1FinanceBalanceGet**](FinanceMarginAPI.md#GetBalanceApiV1FinanceBalanceGet) | **Get** /api/v1/finance/balance | 查询用户 token 余额（Redis 缓存 5 分钟）
[**GrantCommissionApiV1FinanceCommissionPost**](FinanceMarginAPI.md#GrantCommissionApiV1FinanceCommissionPost) | **Post** /api/v1/finance/commission | 佣金入账（邀请分成）
[**ListFlowsApiV1FinanceFlowsGet**](FinanceMarginAPI.md#ListFlowsApiV1FinanceFlowsGet) | **Get** /api/v1/finance/flows | 用户 token 流水（支持按类型过滤）
[**ListTokenFlowAdminApiV1FinanceFlowListGet**](FinanceMarginAPI.md#ListTokenFlowAdminApiV1FinanceFlowListGet) | **Get** /api/v1/finance/flow/list | Token 操作流水列表（管理员）
[**RechargeApiV1FinanceRechargePost**](FinanceMarginAPI.md#RechargeApiV1FinanceRechargePost) | **Post** /api/v1/finance/recharge | 充值 token（与支付订单配合使用）
[**RefundTokenApiV1FinanceRefundPost**](FinanceMarginAPI.md#RefundTokenApiV1FinanceRefundPost) | **Post** /api/v1/finance/refund | Token 回退（退还指定数量 token 到用户余额）



## AdminAdjustBalanceApiV1FinanceTargetUserUuidPut

> interface{} AdminAdjustBalanceApiV1FinanceTargetUserUuidPut(ctx, targetUserUuid).Quantity(quantity).Reason(reason).Execute()

管理员直接调整用户 Token 余额



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
	targetUserUuid := "targetUserUuid_example" // string | 
	quantity := int32(56) // int32 | 调整数量（正数增加/负数扣减）
	reason := "reason_example" // string | 操作原因 (optional) (default to "管理员调整")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceMarginAPI.AdminAdjustBalanceApiV1FinanceTargetUserUuidPut(context.Background(), targetUserUuid).Quantity(quantity).Reason(reason).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceMarginAPI.AdminAdjustBalanceApiV1FinanceTargetUserUuidPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AdminAdjustBalanceApiV1FinanceTargetUserUuidPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceMarginAPI.AdminAdjustBalanceApiV1FinanceTargetUserUuidPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**targetUserUuid** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiAdminAdjustBalanceApiV1FinanceTargetUserUuidPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **quantity** | **int32** | 调整数量（正数增加/负数扣减） | 
 **reason** | **string** | 操作原因 | [default to &quot;管理员调整&quot;]

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


## CheckBalanceApiV1FinanceCheckGet

> interface{} CheckBalanceApiV1FinanceCheckGet(ctx).MinTokens(minTokens).Execute()

检查余额是否充足

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
	minTokens := int32(56) // int32 | 所需 token 数

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceMarginAPI.CheckBalanceApiV1FinanceCheckGet(context.Background()).MinTokens(minTokens).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceMarginAPI.CheckBalanceApiV1FinanceCheckGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CheckBalanceApiV1FinanceCheckGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceMarginAPI.CheckBalanceApiV1FinanceCheckGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCheckBalanceApiV1FinanceCheckGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **minTokens** | **int32** | 所需 token 数 | 

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


## DeductApiV1FinanceDeductPost

> interface{} DeductApiV1FinanceDeductPost(ctx).Quantity(quantity).Remark(remark).Execute()

扣减用户 token（内部调用）

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
	quantity := int32(56) // int32 | 扣减数量
	remark := "remark_example" // string | 操作描述 (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceMarginAPI.DeductApiV1FinanceDeductPost(context.Background()).Quantity(quantity).Remark(remark).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceMarginAPI.DeductApiV1FinanceDeductPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeductApiV1FinanceDeductPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceMarginAPI.DeductApiV1FinanceDeductPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeductApiV1FinanceDeductPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **quantity** | **int32** | 扣减数量 | 
 **remark** | **string** | 操作描述 | [default to &quot;&quot;]

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


## ExpireApiV1FinanceExpirePost

> interface{} ExpireApiV1FinanceExpirePost(ctx).Quantity(quantity).Source(source).Execute()

过期清零（管理员/定时任务）

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
	quantity := int32(56) // int32 | 过期数量
	source := "source_example" // string |  (optional) (default to "到期清零")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceMarginAPI.ExpireApiV1FinanceExpirePost(context.Background()).Quantity(quantity).Source(source).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceMarginAPI.ExpireApiV1FinanceExpirePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExpireApiV1FinanceExpirePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceMarginAPI.ExpireApiV1FinanceExpirePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiExpireApiV1FinanceExpirePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **quantity** | **int32** | 过期数量 | 
 **source** | **string** |  | [default to &quot;到期清零&quot;]

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


## GetBalanceApiV1FinanceBalanceGet

> interface{} GetBalanceApiV1FinanceBalanceGet(ctx).Execute()

查询用户 token 余额（Redis 缓存 5 分钟）

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
	resp, r, err := apiClient.FinanceMarginAPI.GetBalanceApiV1FinanceBalanceGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceMarginAPI.GetBalanceApiV1FinanceBalanceGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetBalanceApiV1FinanceBalanceGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceMarginAPI.GetBalanceApiV1FinanceBalanceGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetBalanceApiV1FinanceBalanceGetRequest struct via the builder pattern


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


## GrantCommissionApiV1FinanceCommissionPost

> interface{} GrantCommissionApiV1FinanceCommissionPost(ctx).Quantity(quantity).InvitedUserId(invitedUserId).Source(source).Execute()

佣金入账（邀请分成）

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
	quantity := int32(56) // int32 | 佣金数量
	invitedUserId := "invitedUserId_example" // string | 被邀请人 uuid (optional) (default to "")
	source := "source_example" // string | 来源 (optional) (default to "invite")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceMarginAPI.GrantCommissionApiV1FinanceCommissionPost(context.Background()).Quantity(quantity).InvitedUserId(invitedUserId).Source(source).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceMarginAPI.GrantCommissionApiV1FinanceCommissionPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GrantCommissionApiV1FinanceCommissionPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceMarginAPI.GrantCommissionApiV1FinanceCommissionPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGrantCommissionApiV1FinanceCommissionPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **quantity** | **int32** | 佣金数量 | 
 **invitedUserId** | **string** | 被邀请人 uuid | [default to &quot;&quot;]
 **source** | **string** | 来源 | [default to &quot;invite&quot;]

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


## ListFlowsApiV1FinanceFlowsGet

> interface{} ListFlowsApiV1FinanceFlowsGet(ctx).Page(page).Limit(limit).OpType(opType).Execute()

用户 token 流水（支持按类型过滤）

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
	opType := int32(56) // int32 | 0=充值 1=扣减 2=过期 3=退款 4=佣金 (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceMarginAPI.ListFlowsApiV1FinanceFlowsGet(context.Background()).Page(page).Limit(limit).OpType(opType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceMarginAPI.ListFlowsApiV1FinanceFlowsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListFlowsApiV1FinanceFlowsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceMarginAPI.ListFlowsApiV1FinanceFlowsGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListFlowsApiV1FinanceFlowsGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **opType** | **int32** | 0&#x3D;充值 1&#x3D;扣减 2&#x3D;过期 3&#x3D;退款 4&#x3D;佣金 | 

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


## ListTokenFlowAdminApiV1FinanceFlowListGet

> interface{} ListTokenFlowAdminApiV1FinanceFlowListGet(ctx).Page(page).Limit(limit).UserId(userId).OpType(opType).Execute()

Token 操作流水列表（管理员）

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
	userId := "userId_example" // string | 按用户 UUID 过滤 (optional)
	opType := int32(56) // int32 | 操作类型过滤 (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceMarginAPI.ListTokenFlowAdminApiV1FinanceFlowListGet(context.Background()).Page(page).Limit(limit).UserId(userId).OpType(opType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceMarginAPI.ListTokenFlowAdminApiV1FinanceFlowListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListTokenFlowAdminApiV1FinanceFlowListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceMarginAPI.ListTokenFlowAdminApiV1FinanceFlowListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListTokenFlowAdminApiV1FinanceFlowListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **userId** | **string** | 按用户 UUID 过滤 | 
 **opType** | **int32** | 操作类型过滤 | 

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


## RechargeApiV1FinanceRechargePost

> interface{} RechargeApiV1FinanceRechargePost(ctx).Quantity(quantity).OutTradeNo(outTradeNo).Execute()

充值 token（与支付订单配合使用）

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
	quantity := int32(56) // int32 | 充值数量
	outTradeNo := "outTradeNo_example" // string | 支付订单号

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceMarginAPI.RechargeApiV1FinanceRechargePost(context.Background()).Quantity(quantity).OutTradeNo(outTradeNo).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceMarginAPI.RechargeApiV1FinanceRechargePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RechargeApiV1FinanceRechargePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceMarginAPI.RechargeApiV1FinanceRechargePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRechargeApiV1FinanceRechargePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **quantity** | **int32** | 充值数量 | 
 **outTradeNo** | **string** | 支付订单号 | 

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


## RefundTokenApiV1FinanceRefundPost

> interface{} RefundTokenApiV1FinanceRefundPost(ctx).Quantity(quantity).Remark(remark).Execute()

Token 回退（退还指定数量 token 到用户余额）

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
	quantity := int32(56) // int32 | 回退数量
	remark := "remark_example" // string | 操作说明 (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceMarginAPI.RefundTokenApiV1FinanceRefundPost(context.Background()).Quantity(quantity).Remark(remark).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceMarginAPI.RefundTokenApiV1FinanceRefundPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RefundTokenApiV1FinanceRefundPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceMarginAPI.RefundTokenApiV1FinanceRefundPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRefundTokenApiV1FinanceRefundPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **quantity** | **int32** | 回退数量 | 
 **remark** | **string** | 操作说明 | [default to &quot;&quot;]

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

