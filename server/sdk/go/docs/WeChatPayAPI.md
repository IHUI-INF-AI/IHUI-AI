# \WeChatPayAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CheckStatusApiV1PaymentsWechatStatusOutTradeNoGet**](WeChatPayAPI.md#CheckStatusApiV1PaymentsWechatStatusOutTradeNoGet) | **Get** /api/v1/payments/wechat/status/{out_trade_no} | Check payment status
[**ConsecutiveProductApiV1PaymentsWechatConsecutiveProductGet**](WeChatPayAPI.md#ConsecutiveProductApiV1PaymentsWechatConsecutiveProductGet) | **Get** /api/v1/payments/wechat/consecutive/product | Query consecutive subscription products
[**CreateWxPayAndroidApiV1PaymentsWechatAndroidCreatePost**](WeChatPayAPI.md#CreateWxPayAndroidApiV1PaymentsWechatAndroidCreatePost) | **Post** /api/v1/payments/wechat/android/create | Create WeChat Pay order (Android app)
[**CreateWxPayApiV1PaymentsWechatCreatePost**](WeChatPayAPI.md#CreateWxPayApiV1PaymentsWechatCreatePost) | **Post** /api/v1/payments/wechat/create | Create WeChat Pay order (JSAPI / mini program)
[**CreateWxPayCourseApiV1PaymentsWechatCourseCreatePost**](WeChatPayAPI.md#CreateWxPayCourseApiV1PaymentsWechatCourseCreatePost) | **Post** /api/v1/payments/wechat/course/create | Create WeChat Pay order (course)
[**QueryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost**](WeChatPayAPI.md#QueryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost) | **Post** /api/v1/payments/wechat/query/by-trade-no | Query by merchant trade number
[**WxPayCloseApiV1PaymentsWechatClosePost**](WeChatPayAPI.md#WxPayCloseApiV1PaymentsWechatClosePost) | **Post** /api/v1/payments/wechat/close | Close WeChat Pay order
[**WxPayNotifyApiV1PaymentsWechatNotifyPost**](WeChatPayAPI.md#WxPayNotifyApiV1PaymentsWechatNotifyPost) | **Post** /api/v1/payments/wechat/notify | WeChat Pay V3 async callback
[**WxPayQueryApiV1PaymentsWechatQueryPost**](WeChatPayAPI.md#WxPayQueryApiV1PaymentsWechatQueryPost) | **Post** /api/v1/payments/wechat/query | Query WeChat Pay order
[**WxPayRefundApiV1PaymentsWechatRefundPost**](WeChatPayAPI.md#WxPayRefundApiV1PaymentsWechatRefundPost) | **Post** /api/v1/payments/wechat/refund | Refund WeChat Pay order
[**WxRefundNotifyApiV1PaymentsWechatNotifyRefundPost**](WeChatPayAPI.md#WxRefundNotifyApiV1PaymentsWechatNotifyRefundPost) | **Post** /api/v1/payments/wechat/notify/refund | WeChat Pay refund callback
[**WxTransferNotifyApiV1PaymentsWechatNotifyTransferPost**](WeChatPayAPI.md#WxTransferNotifyApiV1PaymentsWechatNotifyTransferPost) | **Post** /api/v1/payments/wechat/notify/transfer | WeChat Pay transfer callback



## CheckStatusApiV1PaymentsWechatStatusOutTradeNoGet

> interface{} CheckStatusApiV1PaymentsWechatStatusOutTradeNoGet(ctx, outTradeNo).Execute()

Check payment status

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
	resp, r, err := apiClient.WeChatPayAPI.CheckStatusApiV1PaymentsWechatStatusOutTradeNoGet(context.Background(), outTradeNo).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatPayAPI.CheckStatusApiV1PaymentsWechatStatusOutTradeNoGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CheckStatusApiV1PaymentsWechatStatusOutTradeNoGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatPayAPI.CheckStatusApiV1PaymentsWechatStatusOutTradeNoGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**outTradeNo** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiCheckStatusApiV1PaymentsWechatStatusOutTradeNoGetRequest struct via the builder pattern


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


## ConsecutiveProductApiV1PaymentsWechatConsecutiveProductGet

> interface{} ConsecutiveProductApiV1PaymentsWechatConsecutiveProductGet(ctx).Execute()

Query consecutive subscription products



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
	resp, r, err := apiClient.WeChatPayAPI.ConsecutiveProductApiV1PaymentsWechatConsecutiveProductGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatPayAPI.ConsecutiveProductApiV1PaymentsWechatConsecutiveProductGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ConsecutiveProductApiV1PaymentsWechatConsecutiveProductGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatPayAPI.ConsecutiveProductApiV1PaymentsWechatConsecutiveProductGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiConsecutiveProductApiV1PaymentsWechatConsecutiveProductGetRequest struct via the builder pattern


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


## CreateWxPayAndroidApiV1PaymentsWechatAndroidCreatePost

> interface{} CreateWxPayAndroidApiV1PaymentsWechatAndroidCreatePost(ctx).Amount(amount).ProductId(productId).OrderType(orderType).Description(description).Execute()

Create WeChat Pay order (Android app)



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
	amount := int32(56) // int32 | 
	productId := "productId_example" // string |  (optional)
	orderType := int32(56) // int32 |  (optional) (default to 0)
	description := "description_example" // string |  (optional) (default to "Purchase")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WeChatPayAPI.CreateWxPayAndroidApiV1PaymentsWechatAndroidCreatePost(context.Background()).Amount(amount).ProductId(productId).OrderType(orderType).Description(description).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatPayAPI.CreateWxPayAndroidApiV1PaymentsWechatAndroidCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateWxPayAndroidApiV1PaymentsWechatAndroidCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatPayAPI.CreateWxPayAndroidApiV1PaymentsWechatAndroidCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateWxPayAndroidApiV1PaymentsWechatAndroidCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **int32** |  | 
 **productId** | **string** |  | 
 **orderType** | **int32** |  | [default to 0]
 **description** | **string** |  | [default to &quot;Purchase&quot;]

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


## CreateWxPayApiV1PaymentsWechatCreatePost

> interface{} CreateWxPayApiV1PaymentsWechatCreatePost(ctx).Amount(amount).OpenId(openId).ProductId(productId).OrderType(orderType).Description(description).Execute()

Create WeChat Pay order (JSAPI / mini program)



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
	amount := int32(56) // int32 | Amount in fen
	openId := "openId_example" // string | WeChat openid
	productId := "productId_example" // string |  (optional)
	orderType := int32(56) // int32 | 0=token,1=activity,2=identity,3=agent (optional) (default to 0)
	description := "description_example" // string |  (optional) (default to "Purchase")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WeChatPayAPI.CreateWxPayApiV1PaymentsWechatCreatePost(context.Background()).Amount(amount).OpenId(openId).ProductId(productId).OrderType(orderType).Description(description).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatPayAPI.CreateWxPayApiV1PaymentsWechatCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateWxPayApiV1PaymentsWechatCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatPayAPI.CreateWxPayApiV1PaymentsWechatCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateWxPayApiV1PaymentsWechatCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **int32** | Amount in fen | 
 **openId** | **string** | WeChat openid | 
 **productId** | **string** |  | 
 **orderType** | **int32** | 0&#x3D;token,1&#x3D;activity,2&#x3D;identity,3&#x3D;agent | [default to 0]
 **description** | **string** |  | [default to &quot;Purchase&quot;]

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


## CreateWxPayCourseApiV1PaymentsWechatCourseCreatePost

> interface{} CreateWxPayCourseApiV1PaymentsWechatCourseCreatePost(ctx).Amount(amount).CourseId(courseId).Execute()

Create WeChat Pay order (course)



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
	amount := int32(56) // int32 | 
	courseId := "courseId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WeChatPayAPI.CreateWxPayCourseApiV1PaymentsWechatCourseCreatePost(context.Background()).Amount(amount).CourseId(courseId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatPayAPI.CreateWxPayCourseApiV1PaymentsWechatCourseCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateWxPayCourseApiV1PaymentsWechatCourseCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatPayAPI.CreateWxPayCourseApiV1PaymentsWechatCourseCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateWxPayCourseApiV1PaymentsWechatCourseCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **int32** |  | 
 **courseId** | **string** |  | 

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


## QueryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost

> interface{} QueryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost(ctx).OutTradeNo(outTradeNo).Execute()

Query by merchant trade number



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
	resp, r, err := apiClient.WeChatPayAPI.QueryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost(context.Background()).OutTradeNo(outTradeNo).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatPayAPI.QueryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `QueryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatPayAPI.QueryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiQueryByTradeNoApiV1PaymentsWechatQueryByTradeNoPostRequest struct via the builder pattern


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


## WxPayCloseApiV1PaymentsWechatClosePost

> interface{} WxPayCloseApiV1PaymentsWechatClosePost(ctx).OutTradeNo(outTradeNo).Execute()

Close WeChat Pay order



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
	resp, r, err := apiClient.WeChatPayAPI.WxPayCloseApiV1PaymentsWechatClosePost(context.Background()).OutTradeNo(outTradeNo).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatPayAPI.WxPayCloseApiV1PaymentsWechatClosePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `WxPayCloseApiV1PaymentsWechatClosePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatPayAPI.WxPayCloseApiV1PaymentsWechatClosePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiWxPayCloseApiV1PaymentsWechatClosePostRequest struct via the builder pattern


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


## WxPayNotifyApiV1PaymentsWechatNotifyPost

> interface{} WxPayNotifyApiV1PaymentsWechatNotifyPost(ctx).WechatpaySerial(wechatpaySerial).WechatpaySignature(wechatpaySignature).WechatpayTimestamp(wechatpayTimestamp).WechatpayNonce(wechatpayNonce).Execute()

WeChat Pay V3 async callback



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
	wechatpaySerial := "wechatpaySerial_example" // string |  (optional)
	wechatpaySignature := "wechatpaySignature_example" // string |  (optional)
	wechatpayTimestamp := "wechatpayTimestamp_example" // string |  (optional)
	wechatpayNonce := "wechatpayNonce_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WeChatPayAPI.WxPayNotifyApiV1PaymentsWechatNotifyPost(context.Background()).WechatpaySerial(wechatpaySerial).WechatpaySignature(wechatpaySignature).WechatpayTimestamp(wechatpayTimestamp).WechatpayNonce(wechatpayNonce).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatPayAPI.WxPayNotifyApiV1PaymentsWechatNotifyPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `WxPayNotifyApiV1PaymentsWechatNotifyPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatPayAPI.WxPayNotifyApiV1PaymentsWechatNotifyPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiWxPayNotifyApiV1PaymentsWechatNotifyPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **wechatpaySerial** | **string** |  | 
 **wechatpaySignature** | **string** |  | 
 **wechatpayTimestamp** | **string** |  | 
 **wechatpayNonce** | **string** |  | 

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


## WxPayQueryApiV1PaymentsWechatQueryPost

> interface{} WxPayQueryApiV1PaymentsWechatQueryPost(ctx).OutTradeNo(outTradeNo).Execute()

Query WeChat Pay order

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
	resp, r, err := apiClient.WeChatPayAPI.WxPayQueryApiV1PaymentsWechatQueryPost(context.Background()).OutTradeNo(outTradeNo).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatPayAPI.WxPayQueryApiV1PaymentsWechatQueryPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `WxPayQueryApiV1PaymentsWechatQueryPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatPayAPI.WxPayQueryApiV1PaymentsWechatQueryPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiWxPayQueryApiV1PaymentsWechatQueryPostRequest struct via the builder pattern


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


## WxPayRefundApiV1PaymentsWechatRefundPost

> interface{} WxPayRefundApiV1PaymentsWechatRefundPost(ctx).OutTradeNo(outTradeNo).RefundAmount(refundAmount).Reason(reason).Execute()

Refund WeChat Pay order



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
	refundAmount := int32(56) // int32 | Refund amount in fen
	reason := "reason_example" // string |  (optional) (default to "User requested refund")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WeChatPayAPI.WxPayRefundApiV1PaymentsWechatRefundPost(context.Background()).OutTradeNo(outTradeNo).RefundAmount(refundAmount).Reason(reason).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatPayAPI.WxPayRefundApiV1PaymentsWechatRefundPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `WxPayRefundApiV1PaymentsWechatRefundPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatPayAPI.WxPayRefundApiV1PaymentsWechatRefundPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiWxPayRefundApiV1PaymentsWechatRefundPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **outTradeNo** | **string** |  | 
 **refundAmount** | **int32** | Refund amount in fen | 
 **reason** | **string** |  | [default to &quot;User requested refund&quot;]

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


## WxRefundNotifyApiV1PaymentsWechatNotifyRefundPost

> interface{} WxRefundNotifyApiV1PaymentsWechatNotifyRefundPost(ctx).WechatpaySerial(wechatpaySerial).WechatpaySignature(wechatpaySignature).WechatpayTimestamp(wechatpayTimestamp).WechatpayNonce(wechatpayNonce).Execute()

WeChat Pay refund callback



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
	wechatpaySerial := "wechatpaySerial_example" // string |  (optional)
	wechatpaySignature := "wechatpaySignature_example" // string |  (optional)
	wechatpayTimestamp := "wechatpayTimestamp_example" // string |  (optional)
	wechatpayNonce := "wechatpayNonce_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WeChatPayAPI.WxRefundNotifyApiV1PaymentsWechatNotifyRefundPost(context.Background()).WechatpaySerial(wechatpaySerial).WechatpaySignature(wechatpaySignature).WechatpayTimestamp(wechatpayTimestamp).WechatpayNonce(wechatpayNonce).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatPayAPI.WxRefundNotifyApiV1PaymentsWechatNotifyRefundPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `WxRefundNotifyApiV1PaymentsWechatNotifyRefundPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatPayAPI.WxRefundNotifyApiV1PaymentsWechatNotifyRefundPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiWxRefundNotifyApiV1PaymentsWechatNotifyRefundPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **wechatpaySerial** | **string** |  | 
 **wechatpaySignature** | **string** |  | 
 **wechatpayTimestamp** | **string** |  | 
 **wechatpayNonce** | **string** |  | 

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


## WxTransferNotifyApiV1PaymentsWechatNotifyTransferPost

> interface{} WxTransferNotifyApiV1PaymentsWechatNotifyTransferPost(ctx).WechatpaySerial(wechatpaySerial).WechatpaySignature(wechatpaySignature).WechatpayTimestamp(wechatpayTimestamp).WechatpayNonce(wechatpayNonce).Execute()

WeChat Pay transfer callback



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
	wechatpaySerial := "wechatpaySerial_example" // string |  (optional)
	wechatpaySignature := "wechatpaySignature_example" // string |  (optional)
	wechatpayTimestamp := "wechatpayTimestamp_example" // string |  (optional)
	wechatpayNonce := "wechatpayNonce_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WeChatPayAPI.WxTransferNotifyApiV1PaymentsWechatNotifyTransferPost(context.Background()).WechatpaySerial(wechatpaySerial).WechatpaySignature(wechatpaySignature).WechatpayTimestamp(wechatpayTimestamp).WechatpayNonce(wechatpayNonce).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatPayAPI.WxTransferNotifyApiV1PaymentsWechatNotifyTransferPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `WxTransferNotifyApiV1PaymentsWechatNotifyTransferPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatPayAPI.WxTransferNotifyApiV1PaymentsWechatNotifyTransferPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiWxTransferNotifyApiV1PaymentsWechatNotifyTransferPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **wechatpaySerial** | **string** |  | 
 **wechatpaySignature** | **string** |  | 
 **wechatpayTimestamp** | **string** |  | 
 **wechatpayNonce** | **string** |  | 

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

