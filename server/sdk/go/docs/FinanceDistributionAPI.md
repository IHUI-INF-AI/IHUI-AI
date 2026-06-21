# \FinanceDistributionAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CommissionDetailApiV1FinanceCommissionDetailGet**](FinanceDistributionAPI.md#CommissionDetailApiV1FinanceCommissionDetailGet) | **Get** /api/v1/finance/commission-detail | 佣金明细
[**InviteeOrderStatsApiV1FinanceInviteeOrderStatsGet**](FinanceDistributionAPI.md#InviteeOrderStatsApiV1FinanceInviteeOrderStatsGet) | **Get** /api/v1/finance/invitee-order-stats | 下级用户订单统计
[**InviteeStatsApiV1FinanceInviteeStatsGet**](FinanceDistributionAPI.md#InviteeStatsApiV1FinanceInviteeStatsGet) | **Get** /api/v1/finance/invitee-stats | 邀请统计
[**ListSubordinatesApiV1FinanceSubordinatesGet**](FinanceDistributionAPI.md#ListSubordinatesApiV1FinanceSubordinatesGet) | **Get** /api/v1/finance/subordinates | 我的下级用户列表
[**ListTeamApiV1FinanceTeamGet**](FinanceDistributionAPI.md#ListTeamApiV1FinanceTeamGet) | **Get** /api/v1/finance/team | 我的团队（下属列表+搜索排序）
[**OperatorDataCardApiV1FinanceOperatorCardGet**](FinanceDistributionAPI.md#OperatorDataCardApiV1FinanceOperatorCardGet) | **Get** /api/v1/finance/operator-card | 操盘手数据卡片统计
[**TeamCenterApiV1FinanceTeamCenterGet**](FinanceDistributionAPI.md#TeamCenterApiV1FinanceTeamCenterGet) | **Get** /api/v1/finance/team/center | 个人中心我的团队（概要）
[**UserAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet**](FinanceDistributionAPI.md#UserAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet) | **Get** /api/v1/finance/user-and-children-orders | 用户及下级的订单列表



## CommissionDetailApiV1FinanceCommissionDetailGet

> interface{} CommissionDetailApiV1FinanceCommissionDetailGet(ctx).Page(page).Limit(limit).Execute()

佣金明细

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceDistributionAPI.CommissionDetailApiV1FinanceCommissionDetailGet(context.Background()).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceDistributionAPI.CommissionDetailApiV1FinanceCommissionDetailGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CommissionDetailApiV1FinanceCommissionDetailGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceDistributionAPI.CommissionDetailApiV1FinanceCommissionDetailGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCommissionDetailApiV1FinanceCommissionDetailGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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


## InviteeOrderStatsApiV1FinanceInviteeOrderStatsGet

> interface{} InviteeOrderStatsApiV1FinanceInviteeOrderStatsGet(ctx).Page(page).Limit(limit).Execute()

下级用户订单统计



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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceDistributionAPI.InviteeOrderStatsApiV1FinanceInviteeOrderStatsGet(context.Background()).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceDistributionAPI.InviteeOrderStatsApiV1FinanceInviteeOrderStatsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `InviteeOrderStatsApiV1FinanceInviteeOrderStatsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceDistributionAPI.InviteeOrderStatsApiV1FinanceInviteeOrderStatsGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiInviteeOrderStatsApiV1FinanceInviteeOrderStatsGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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


## InviteeStatsApiV1FinanceInviteeStatsGet

> interface{} InviteeStatsApiV1FinanceInviteeStatsGet(ctx).Execute()

邀请统计

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
	resp, r, err := apiClient.FinanceDistributionAPI.InviteeStatsApiV1FinanceInviteeStatsGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceDistributionAPI.InviteeStatsApiV1FinanceInviteeStatsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `InviteeStatsApiV1FinanceInviteeStatsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceDistributionAPI.InviteeStatsApiV1FinanceInviteeStatsGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiInviteeStatsApiV1FinanceInviteeStatsGetRequest struct via the builder pattern


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


## ListSubordinatesApiV1FinanceSubordinatesGet

> interface{} ListSubordinatesApiV1FinanceSubordinatesGet(ctx).Page(page).Limit(limit).Execute()

我的下级用户列表

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceDistributionAPI.ListSubordinatesApiV1FinanceSubordinatesGet(context.Background()).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceDistributionAPI.ListSubordinatesApiV1FinanceSubordinatesGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListSubordinatesApiV1FinanceSubordinatesGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceDistributionAPI.ListSubordinatesApiV1FinanceSubordinatesGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListSubordinatesApiV1FinanceSubordinatesGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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


## ListTeamApiV1FinanceTeamGet

> interface{} ListTeamApiV1FinanceTeamGet(ctx).Page(page).Limit(limit).Keyword(keyword).SortBy(sortBy).SortOrder(sortOrder).Execute()

我的团队（下属列表+搜索排序）

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
	keyword := "keyword_example" // string | 搜索关键词（昵称/UUID） (optional)
	sortBy := "sortBy_example" // string | 排序字段: created_at / is_vip (optional) (default to "created_at")
	sortOrder := "sortOrder_example" // string | 排序方向: asc / desc (optional) (default to "desc")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceDistributionAPI.ListTeamApiV1FinanceTeamGet(context.Background()).Page(page).Limit(limit).Keyword(keyword).SortBy(sortBy).SortOrder(sortOrder).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceDistributionAPI.ListTeamApiV1FinanceTeamGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListTeamApiV1FinanceTeamGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceDistributionAPI.ListTeamApiV1FinanceTeamGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListTeamApiV1FinanceTeamGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **keyword** | **string** | 搜索关键词（昵称/UUID） | 
 **sortBy** | **string** | 排序字段: created_at / is_vip | [default to &quot;created_at&quot;]
 **sortOrder** | **string** | 排序方向: asc / desc | [default to &quot;desc&quot;]

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


## OperatorDataCardApiV1FinanceOperatorCardGet

> interface{} OperatorDataCardApiV1FinanceOperatorCardGet(ctx).Execute()

操盘手数据卡片统计



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
	resp, r, err := apiClient.FinanceDistributionAPI.OperatorDataCardApiV1FinanceOperatorCardGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceDistributionAPI.OperatorDataCardApiV1FinanceOperatorCardGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `OperatorDataCardApiV1FinanceOperatorCardGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceDistributionAPI.OperatorDataCardApiV1FinanceOperatorCardGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiOperatorDataCardApiV1FinanceOperatorCardGetRequest struct via the builder pattern


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


## TeamCenterApiV1FinanceTeamCenterGet

> interface{} TeamCenterApiV1FinanceTeamCenterGet(ctx).Execute()

个人中心我的团队（概要）

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
	resp, r, err := apiClient.FinanceDistributionAPI.TeamCenterApiV1FinanceTeamCenterGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceDistributionAPI.TeamCenterApiV1FinanceTeamCenterGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TeamCenterApiV1FinanceTeamCenterGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceDistributionAPI.TeamCenterApiV1FinanceTeamCenterGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiTeamCenterApiV1FinanceTeamCenterGetRequest struct via the builder pattern


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


## UserAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet

> interface{} UserAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet(ctx).Page(page).Limit(limit).Execute()

用户及下级的订单列表



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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceDistributionAPI.UserAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet(context.Background()).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceDistributionAPI.UserAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UserAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceDistributionAPI.UserAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUserAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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

