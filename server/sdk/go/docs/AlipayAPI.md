# \AlipayAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AlipayQueryApiV1PaymentsAlipayQueryPost**](AlipayAPI.md#AlipayQueryApiV1PaymentsAlipayQueryPost) | **Post** /api/v1/payments/alipay/query | Query Alipay order
[**AlipayRefundApiV1PaymentsAlipayRefundPost**](AlipayAPI.md#AlipayRefundApiV1PaymentsAlipayRefundPost) | **Post** /api/v1/payments/alipay/refund | Alipay 退款（调用 alipay.trade.refund）
[**CreateAlipayApiV1PaymentsAlipayCreatePost**](AlipayAPI.md#CreateAlipayApiV1PaymentsAlipayCreatePost) | **Post** /api/v1/payments/alipay/create | Create Alipay PC / H5 page pay
[**CreateAlipayAppApiV1PaymentsAlipayAppCreatePost**](AlipayAPI.md#CreateAlipayAppApiV1PaymentsAlipayAppCreatePost) | **Post** /api/v1/payments/alipay/app/create | Create Alipay order for mobile app



## AlipayQueryApiV1PaymentsAlipayQueryPost

> interface{} AlipayQueryApiV1PaymentsAlipayQueryPost(ctx).OutTradeNo(outTradeNo).Execute()

Query Alipay order

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
	outTradeNo := "outTradeNo_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AlipayAPI.AlipayQueryApiV1PaymentsAlipayQueryPost(context.Background()).OutTradeNo(outTradeNo).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AlipayAPI.AlipayQueryApiV1PaymentsAlipayQueryPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AlipayQueryApiV1PaymentsAlipayQueryPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AlipayAPI.AlipayQueryApiV1PaymentsAlipayQueryPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAlipayQueryApiV1PaymentsAlipayQueryPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **outTradeNo** | **string** |  | 

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


## AlipayRefundApiV1PaymentsAlipayRefundPost

> interface{} AlipayRefundApiV1PaymentsAlipayRefundPost(ctx).OutTradeNo(outTradeNo).RefundAmount(refundAmount).Reason(reason).Execute()

Alipay 退款（调用 alipay.trade.refund）

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
	outTradeNo := "outTradeNo_example" // string | 
	refundAmount := float32(8.14) // float32 | 退款金额（元）
	reason := "reason_example" // string |  (optional) (default to "用户申请退款")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AlipayAPI.AlipayRefundApiV1PaymentsAlipayRefundPost(context.Background()).OutTradeNo(outTradeNo).RefundAmount(refundAmount).Reason(reason).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AlipayAPI.AlipayRefundApiV1PaymentsAlipayRefundPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AlipayRefundApiV1PaymentsAlipayRefundPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AlipayAPI.AlipayRefundApiV1PaymentsAlipayRefundPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAlipayRefundApiV1PaymentsAlipayRefundPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **outTradeNo** | **string** |  | 
 **refundAmount** | **float32** | 退款金额（元） | 
 **reason** | **string** |  | [default to &quot;用户申请退款&quot;]

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


## CreateAlipayApiV1PaymentsAlipayCreatePost

> interface{} CreateAlipayApiV1PaymentsAlipayCreatePost(ctx).Amount(amount).ProductId(productId).OrderType(orderType).Subject(subject).Execute()

Create Alipay PC / H5 page pay

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
	amount := float32(8.14) // float32 | 金额（元）
	productId := "productId_example" // string |  (optional)
	orderType := int32(56) // int32 |  (optional) (default to 0)
	subject := "subject_example" // string |  (optional) (default to "订单支付")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AlipayAPI.CreateAlipayApiV1PaymentsAlipayCreatePost(context.Background()).Amount(amount).ProductId(productId).OrderType(orderType).Subject(subject).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AlipayAPI.CreateAlipayApiV1PaymentsAlipayCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateAlipayApiV1PaymentsAlipayCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AlipayAPI.CreateAlipayApiV1PaymentsAlipayCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateAlipayApiV1PaymentsAlipayCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **float32** | 金额（元） | 
 **productId** | **string** |  | 
 **orderType** | **int32** |  | [default to 0]
 **subject** | **string** |  | [default to &quot;订单支付&quot;]

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


## CreateAlipayAppApiV1PaymentsAlipayAppCreatePost

> interface{} CreateAlipayAppApiV1PaymentsAlipayAppCreatePost(ctx).Amount(amount).ProductId(productId).OrderType(orderType).Subject(subject).Execute()

Create Alipay order for mobile app

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
	amount := float32(8.14) // float32 | 
	productId := "productId_example" // string |  (optional)
	orderType := int32(56) // int32 |  (optional) (default to 0)
	subject := "subject_example" // string |  (optional) (default to "订单支付")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AlipayAPI.CreateAlipayAppApiV1PaymentsAlipayAppCreatePost(context.Background()).Amount(amount).ProductId(productId).OrderType(orderType).Subject(subject).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AlipayAPI.CreateAlipayAppApiV1PaymentsAlipayAppCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateAlipayAppApiV1PaymentsAlipayAppCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AlipayAPI.CreateAlipayAppApiV1PaymentsAlipayAppCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateAlipayAppApiV1PaymentsAlipayAppCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **float32** |  | 
 **productId** | **string** |  | 
 **orderType** | **int32** |  | [default to 0]
 **subject** | **string** |  | [default to &quot;订单支付&quot;]

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

