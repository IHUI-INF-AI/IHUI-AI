# \FundOperationsAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateFundOrderApiV1PaymentsCreateOrderPost**](FundOperationsAPI.md#CreateFundOrderApiV1PaymentsCreateOrderPost) | **Post** /api/v1/payments/createOrder | 创建基金充值订单
[**FundTransferApiV1PaymentsTransferPost**](FundOperationsAPI.md#FundTransferApiV1PaymentsTransferPost) | **Post** /api/v1/payments/transfer | 银行转账
[**FundWechatPayApiV1PaymentsWechatPayPost**](FundOperationsAPI.md#FundWechatPayApiV1PaymentsWechatPayPost) | **Post** /api/v1/payments/wechatPay | 基金微信支付
[**FundWithdrawalApiV1PaymentsWithdrawalPost**](FundOperationsAPI.md#FundWithdrawalApiV1PaymentsWithdrawalPost) | **Post** /api/v1/payments/withdrawal | 基金提现



## CreateFundOrderApiV1PaymentsCreateOrderPost

> interface{} CreateFundOrderApiV1PaymentsCreateOrderPost(ctx).Amount(amount).ProductId(productId).OrderType(orderType).Execute()

创建基金充值订单



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
	amount := float32(8.14) // float32 | 充值金额（元）
	productId := "productId_example" // string |  (optional)
	orderType := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FundOperationsAPI.CreateFundOrderApiV1PaymentsCreateOrderPost(context.Background()).Amount(amount).ProductId(productId).OrderType(orderType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FundOperationsAPI.CreateFundOrderApiV1PaymentsCreateOrderPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateFundOrderApiV1PaymentsCreateOrderPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FundOperationsAPI.CreateFundOrderApiV1PaymentsCreateOrderPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateFundOrderApiV1PaymentsCreateOrderPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **float32** | 充值金额（元） | 
 **productId** | **string** |  | 
 **orderType** | **int32** |  | [default to 0]

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


## FundTransferApiV1PaymentsTransferPost

> interface{} FundTransferApiV1PaymentsTransferPost(ctx).Amount(amount).BankAccount(bankAccount).BankName(bankName).Execute()

银行转账



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
	amount := int32(56) // int32 | 转账金额（分）
	bankAccount := "bankAccount_example" // string | 收款账号
	bankName := "bankName_example" // string | 收款银行 (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FundOperationsAPI.FundTransferApiV1PaymentsTransferPost(context.Background()).Amount(amount).BankAccount(bankAccount).BankName(bankName).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FundOperationsAPI.FundTransferApiV1PaymentsTransferPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `FundTransferApiV1PaymentsTransferPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FundOperationsAPI.FundTransferApiV1PaymentsTransferPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiFundTransferApiV1PaymentsTransferPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **int32** | 转账金额（分） | 
 **bankAccount** | **string** | 收款账号 | 
 **bankName** | **string** | 收款银行 | [default to &quot;&quot;]

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


## FundWechatPayApiV1PaymentsWechatPayPost

> interface{} FundWechatPayApiV1PaymentsWechatPayPost(ctx).OutTradeNo(outTradeNo).TotalFee(totalFee).Execute()

基金微信支付



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
	outTradeNo := "outTradeNo_example" // string | 订单号
	totalFee := int32(56) // int32 | 金额（分）

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FundOperationsAPI.FundWechatPayApiV1PaymentsWechatPayPost(context.Background()).OutTradeNo(outTradeNo).TotalFee(totalFee).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FundOperationsAPI.FundWechatPayApiV1PaymentsWechatPayPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `FundWechatPayApiV1PaymentsWechatPayPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FundOperationsAPI.FundWechatPayApiV1PaymentsWechatPayPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiFundWechatPayApiV1PaymentsWechatPayPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **outTradeNo** | **string** | 订单号 | 
 **totalFee** | **int32** | 金额（分） | 

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


## FundWithdrawalApiV1PaymentsWithdrawalPost

> interface{} FundWithdrawalApiV1PaymentsWithdrawalPost(ctx).Amount(amount).Execute()

基金提现



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
	resp, r, err := apiClient.FundOperationsAPI.FundWithdrawalApiV1PaymentsWithdrawalPost(context.Background()).Amount(amount).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FundOperationsAPI.FundWithdrawalApiV1PaymentsWithdrawalPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `FundWithdrawalApiV1PaymentsWithdrawalPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FundOperationsAPI.FundWithdrawalApiV1PaymentsWithdrawalPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiFundWithdrawalApiV1PaymentsWithdrawalPostRequest struct via the builder pattern


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

