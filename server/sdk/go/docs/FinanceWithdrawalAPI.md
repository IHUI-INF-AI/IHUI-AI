# \FinanceWithdrawalAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ApplyAgentWithdrawalApiV1FinanceAgentApplyPost**](FinanceWithdrawalAPI.md#ApplyAgentWithdrawalApiV1FinanceAgentApplyPost) | **Post** /api/v1/finance/agent/apply | Agent 收益提现申请
[**ApplyWithdrawalApiV1FinanceApplyPost**](FinanceWithdrawalAPI.md#ApplyWithdrawalApiV1FinanceApplyPost) | **Post** /api/v1/finance/apply | 申请提现
[**AvailableBalanceApiV1FinanceAvailableGet**](FinanceWithdrawalAPI.md#AvailableBalanceApiV1FinanceAvailableGet) | **Get** /api/v1/finance/available | 个人可收款查询
[**ListAgentWithdrawalsApiV1FinanceAgentListGet**](FinanceWithdrawalAPI.md#ListAgentWithdrawalsApiV1FinanceAgentListGet) | **Get** /api/v1/finance/agent/list | Agent 提现记录
[**ListWithdrawalsApiV1FinanceListGet**](FinanceWithdrawalAPI.md#ListWithdrawalsApiV1FinanceListGet) | **Get** /api/v1/finance/list | 我的提现记录
[**WithdrawalSummaryApiV1FinanceSummaryGet**](FinanceWithdrawalAPI.md#WithdrawalSummaryApiV1FinanceSummaryGet) | **Get** /api/v1/finance/summary | 提现详情面板数据（总提现/待审核/已到账）



## ApplyAgentWithdrawalApiV1FinanceAgentApplyPost

> interface{} ApplyAgentWithdrawalApiV1FinanceAgentApplyPost(ctx).Amount(amount).Execute()

Agent 收益提现申请

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
	amount := int32(56) // int32 | 提现金额（分）

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceWithdrawalAPI.ApplyAgentWithdrawalApiV1FinanceAgentApplyPost(context.Background()).Amount(amount).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceWithdrawalAPI.ApplyAgentWithdrawalApiV1FinanceAgentApplyPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ApplyAgentWithdrawalApiV1FinanceAgentApplyPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceWithdrawalAPI.ApplyAgentWithdrawalApiV1FinanceAgentApplyPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiApplyAgentWithdrawalApiV1FinanceAgentApplyPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **int32** | 提现金额（分） | 

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


## ApplyWithdrawalApiV1FinanceApplyPost

> interface{} ApplyWithdrawalApiV1FinanceApplyPost(ctx).Amount(amount).Execute()

申请提现

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
	amount := int32(56) // int32 | 提现金额（分）

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceWithdrawalAPI.ApplyWithdrawalApiV1FinanceApplyPost(context.Background()).Amount(amount).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceWithdrawalAPI.ApplyWithdrawalApiV1FinanceApplyPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ApplyWithdrawalApiV1FinanceApplyPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceWithdrawalAPI.ApplyWithdrawalApiV1FinanceApplyPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiApplyWithdrawalApiV1FinanceApplyPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **int32** | 提现金额（分） | 

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


## AvailableBalanceApiV1FinanceAvailableGet

> interface{} AvailableBalanceApiV1FinanceAvailableGet(ctx).Execute()

个人可收款查询

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
	resp, r, err := apiClient.FinanceWithdrawalAPI.AvailableBalanceApiV1FinanceAvailableGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceWithdrawalAPI.AvailableBalanceApiV1FinanceAvailableGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AvailableBalanceApiV1FinanceAvailableGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceWithdrawalAPI.AvailableBalanceApiV1FinanceAvailableGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiAvailableBalanceApiV1FinanceAvailableGetRequest struct via the builder pattern


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


## ListAgentWithdrawalsApiV1FinanceAgentListGet

> interface{} ListAgentWithdrawalsApiV1FinanceAgentListGet(ctx).Page(page).Limit(limit).Execute()

Agent 提现记录

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
	resp, r, err := apiClient.FinanceWithdrawalAPI.ListAgentWithdrawalsApiV1FinanceAgentListGet(context.Background()).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceWithdrawalAPI.ListAgentWithdrawalsApiV1FinanceAgentListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListAgentWithdrawalsApiV1FinanceAgentListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceWithdrawalAPI.ListAgentWithdrawalsApiV1FinanceAgentListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListAgentWithdrawalsApiV1FinanceAgentListGetRequest struct via the builder pattern


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


## ListWithdrawalsApiV1FinanceListGet

> interface{} ListWithdrawalsApiV1FinanceListGet(ctx).Page(page).Limit(limit).Execute()

我的提现记录

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
	resp, r, err := apiClient.FinanceWithdrawalAPI.ListWithdrawalsApiV1FinanceListGet(context.Background()).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceWithdrawalAPI.ListWithdrawalsApiV1FinanceListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListWithdrawalsApiV1FinanceListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceWithdrawalAPI.ListWithdrawalsApiV1FinanceListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListWithdrawalsApiV1FinanceListGetRequest struct via the builder pattern


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


## WithdrawalSummaryApiV1FinanceSummaryGet

> interface{} WithdrawalSummaryApiV1FinanceSummaryGet(ctx).Execute()

提现详情面板数据（总提现/待审核/已到账）

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
	resp, r, err := apiClient.FinanceWithdrawalAPI.WithdrawalSummaryApiV1FinanceSummaryGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceWithdrawalAPI.WithdrawalSummaryApiV1FinanceSummaryGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `WithdrawalSummaryApiV1FinanceSummaryGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceWithdrawalAPI.WithdrawalSummaryApiV1FinanceSummaryGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiWithdrawalSummaryApiV1FinanceSummaryGetRequest struct via the builder pattern


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

