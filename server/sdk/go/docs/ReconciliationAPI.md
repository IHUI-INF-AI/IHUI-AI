# \ReconciliationAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AlipayReconcileApiV1PaymentsAlipayGet**](ReconciliationAPI.md#AlipayReconcileApiV1PaymentsAlipayGet) | **Get** /api/v1/payments/alipay | 拉取支付宝某天账单并对账
[**AllReconcileApiV1PaymentsAllGet**](ReconciliationAPI.md#AllReconcileApiV1PaymentsAllGet) | **Get** /api/v1/payments/all | 拉取支付宝 + 微信双边对账
[**AutoReconcileApiV1PaymentsAutoPost**](ReconciliationAPI.md#AutoReconcileApiV1PaymentsAutoPost) | **Post** /api/v1/payments/auto | 手动触发自动对账（昨天）
[**CloseExpiredApiV1PaymentsCloseExpiredPost**](ReconciliationAPI.md#CloseExpiredApiV1PaymentsCloseExpiredPost) | **Post** /api/v1/payments/close_expired | 关闭 30 分钟未支付订单
[**ListPendingApiV1PaymentsPendingGet**](ReconciliationAPI.md#ListPendingApiV1PaymentsPendingGet) | **Get** /api/v1/payments/pending | 查询超时未支付订单
[**WechatReconcileApiV1PaymentsWechatGet**](ReconciliationAPI.md#WechatReconcileApiV1PaymentsWechatGet) | **Get** /api/v1/payments/wechat | 拉取微信某天账单并对账



## AlipayReconcileApiV1PaymentsAlipayGet

> interface{} AlipayReconcileApiV1PaymentsAlipayGet(ctx).BillDate(billDate).Execute()

拉取支付宝某天账单并对账

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
	billDate := "billDate_example" // string | yyyy-MM-dd，默认昨天 (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ReconciliationAPI.AlipayReconcileApiV1PaymentsAlipayGet(context.Background()).BillDate(billDate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ReconciliationAPI.AlipayReconcileApiV1PaymentsAlipayGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AlipayReconcileApiV1PaymentsAlipayGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ReconciliationAPI.AlipayReconcileApiV1PaymentsAlipayGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAlipayReconcileApiV1PaymentsAlipayGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **billDate** | **string** | yyyy-MM-dd，默认昨天 | 

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


## AllReconcileApiV1PaymentsAllGet

> interface{} AllReconcileApiV1PaymentsAllGet(ctx).BillDate(billDate).Execute()

拉取支付宝 + 微信双边对账

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
	billDate := "billDate_example" // string | yyyy-MM-dd，默认昨天 (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ReconciliationAPI.AllReconcileApiV1PaymentsAllGet(context.Background()).BillDate(billDate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ReconciliationAPI.AllReconcileApiV1PaymentsAllGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AllReconcileApiV1PaymentsAllGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ReconciliationAPI.AllReconcileApiV1PaymentsAllGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAllReconcileApiV1PaymentsAllGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **billDate** | **string** | yyyy-MM-dd，默认昨天 | 

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


## AutoReconcileApiV1PaymentsAutoPost

> interface{} AutoReconcileApiV1PaymentsAutoPost(ctx).Execute()

手动触发自动对账（昨天）

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
	resp, r, err := apiClient.ReconciliationAPI.AutoReconcileApiV1PaymentsAutoPost(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ReconciliationAPI.AutoReconcileApiV1PaymentsAutoPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AutoReconcileApiV1PaymentsAutoPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ReconciliationAPI.AutoReconcileApiV1PaymentsAutoPost`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiAutoReconcileApiV1PaymentsAutoPostRequest struct via the builder pattern


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


## CloseExpiredApiV1PaymentsCloseExpiredPost

> interface{} CloseExpiredApiV1PaymentsCloseExpiredPost(ctx).Execute()

关闭 30 分钟未支付订单

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
	resp, r, err := apiClient.ReconciliationAPI.CloseExpiredApiV1PaymentsCloseExpiredPost(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ReconciliationAPI.CloseExpiredApiV1PaymentsCloseExpiredPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CloseExpiredApiV1PaymentsCloseExpiredPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ReconciliationAPI.CloseExpiredApiV1PaymentsCloseExpiredPost`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCloseExpiredApiV1PaymentsCloseExpiredPostRequest struct via the builder pattern


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


## ListPendingApiV1PaymentsPendingGet

> interface{} ListPendingApiV1PaymentsPendingGet(ctx).Execute()

查询超时未支付订单

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
	resp, r, err := apiClient.ReconciliationAPI.ListPendingApiV1PaymentsPendingGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ReconciliationAPI.ListPendingApiV1PaymentsPendingGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListPendingApiV1PaymentsPendingGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ReconciliationAPI.ListPendingApiV1PaymentsPendingGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListPendingApiV1PaymentsPendingGetRequest struct via the builder pattern


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


## WechatReconcileApiV1PaymentsWechatGet

> interface{} WechatReconcileApiV1PaymentsWechatGet(ctx).BillDate(billDate).Execute()

拉取微信某天账单并对账

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
	billDate := "billDate_example" // string | yyyy-MM-dd，默认昨天 (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ReconciliationAPI.WechatReconcileApiV1PaymentsWechatGet(context.Background()).BillDate(billDate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ReconciliationAPI.WechatReconcileApiV1PaymentsWechatGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `WechatReconcileApiV1PaymentsWechatGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ReconciliationAPI.WechatReconcileApiV1PaymentsWechatGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiWechatReconcileApiV1PaymentsWechatGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **billDate** | **string** | yyyy-MM-dd，默认昨天 | 

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

