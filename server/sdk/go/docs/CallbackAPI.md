# \CallbackAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CallCallbackApiV1CallbackCallPost**](CallbackAPI.md#CallCallbackApiV1CallbackCallPost) | **Post** /api/v1/callback/call | 外呼回调
[**CallCallbackApiV1CallbackCallPost_0**](CallbackAPI.md#CallCallbackApiV1CallbackCallPost_0) | **Post** /api/v1/callback/call | 外呼回调
[**CallbackLogList**](CallbackAPI.md#CallbackLogList) | **Get** /api/v1/callback/log/list | 回调日志
[**CallbackLogList_0**](CallbackAPI.md#CallbackLogList_0) | **Get** /api/v1/callback/log/list | 回调日志
[**LogDetailApiV1CallbackLogLidGet**](CallbackAPI.md#LogDetailApiV1CallbackLogLidGet) | **Get** /api/v1/callback/log/{lid} | 回调详情
[**LogDetailApiV1CallbackLogLidGet_0**](CallbackAPI.md#LogDetailApiV1CallbackLogLidGet_0) | **Get** /api/v1/callback/log/{lid} | 回调详情
[**PaymentCallbackApiV1CallbackPaymentPost**](CallbackAPI.md#PaymentCallbackApiV1CallbackPaymentPost) | **Post** /api/v1/callback/payment | 支付回调
[**PaymentCallbackApiV1CallbackPaymentPost_0**](CallbackAPI.md#PaymentCallbackApiV1CallbackPaymentPost_0) | **Post** /api/v1/callback/payment | 支付回调
[**SmsCallbackApiV1CallbackSmsPost**](CallbackAPI.md#SmsCallbackApiV1CallbackSmsPost) | **Post** /api/v1/callback/sms | 短信回调
[**SmsCallbackApiV1CallbackSmsPost_0**](CallbackAPI.md#SmsCallbackApiV1CallbackSmsPost_0) | **Post** /api/v1/callback/sms | 短信回调



## CallCallbackApiV1CallbackCallPost

> interface{} CallCallbackApiV1CallbackCallPost(ctx).BizId(bizId).BizType(bizType).Source(source).BodyCallCallbackApiV1CallbackCallPost(bodyCallCallbackApiV1CallbackCallPost).Execute()

外呼回调

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
	bizId := "bizId_example" // string |  (optional)
	bizType := "bizType_example" // string |  (optional) (default to "call")
	source := "source_example" // string |  (optional)
	bodyCallCallbackApiV1CallbackCallPost := *openapiclient.NewBodyCallCallbackApiV1CallbackCallPost() // BodyCallCallbackApiV1CallbackCallPost |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CallbackAPI.CallCallbackApiV1CallbackCallPost(context.Background()).BizId(bizId).BizType(bizType).Source(source).BodyCallCallbackApiV1CallbackCallPost(bodyCallCallbackApiV1CallbackCallPost).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CallbackAPI.CallCallbackApiV1CallbackCallPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CallCallbackApiV1CallbackCallPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CallbackAPI.CallCallbackApiV1CallbackCallPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCallCallbackApiV1CallbackCallPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bizId** | **string** |  | 
 **bizType** | **string** |  | [default to &quot;call&quot;]
 **source** | **string** |  | 
 **bodyCallCallbackApiV1CallbackCallPost** | [**BodyCallCallbackApiV1CallbackCallPost**](BodyCallCallbackApiV1CallbackCallPost.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CallCallbackApiV1CallbackCallPost_0

> interface{} CallCallbackApiV1CallbackCallPost_0(ctx).BizId(bizId).BizType(bizType).Source(source).BodyCallCallbackApiV1CallbackCallPost(bodyCallCallbackApiV1CallbackCallPost).Execute()

外呼回调

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
	bizId := "bizId_example" // string |  (optional)
	bizType := "bizType_example" // string |  (optional) (default to "call")
	source := "source_example" // string |  (optional)
	bodyCallCallbackApiV1CallbackCallPost := *openapiclient.NewBodyCallCallbackApiV1CallbackCallPost() // BodyCallCallbackApiV1CallbackCallPost |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CallbackAPI.CallCallbackApiV1CallbackCallPost_0(context.Background()).BizId(bizId).BizType(bizType).Source(source).BodyCallCallbackApiV1CallbackCallPost(bodyCallCallbackApiV1CallbackCallPost).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CallbackAPI.CallCallbackApiV1CallbackCallPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CallCallbackApiV1CallbackCallPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CallbackAPI.CallCallbackApiV1CallbackCallPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCallCallbackApiV1CallbackCallPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bizId** | **string** |  | 
 **bizType** | **string** |  | [default to &quot;call&quot;]
 **source** | **string** |  | 
 **bodyCallCallbackApiV1CallbackCallPost** | [**BodyCallCallbackApiV1CallbackCallPost**](BodyCallCallbackApiV1CallbackCallPost.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CallbackLogList

> interface{} CallbackLogList(ctx).Page(page).Limit(limit).BizType(bizType).Source(source).Status(status).Execute()

回调日志

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
	bizType := "bizType_example" // string |  (optional)
	source := "source_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CallbackAPI.CallbackLogList(context.Background()).Page(page).Limit(limit).BizType(bizType).Source(source).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CallbackAPI.CallbackLogList``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CallbackLogList`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CallbackAPI.CallbackLogList`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCallbackLogListRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **bizType** | **string** |  | 
 **source** | **string** |  | 
 **status** | **int32** |  | 

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


## CallbackLogList_0

> interface{} CallbackLogList_0(ctx).Page(page).Limit(limit).BizType(bizType).Source(source).Status(status).Execute()

回调日志

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
	bizType := "bizType_example" // string |  (optional)
	source := "source_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CallbackAPI.CallbackLogList_0(context.Background()).Page(page).Limit(limit).BizType(bizType).Source(source).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CallbackAPI.CallbackLogList_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CallbackLogList_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CallbackAPI.CallbackLogList_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCallbackLogList_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **bizType** | **string** |  | 
 **source** | **string** |  | 
 **status** | **int32** |  | 

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


## LogDetailApiV1CallbackLogLidGet

> interface{} LogDetailApiV1CallbackLogLidGet(ctx, lid).Execute()

回调详情

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
	lid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CallbackAPI.LogDetailApiV1CallbackLogLidGet(context.Background(), lid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CallbackAPI.LogDetailApiV1CallbackLogLidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LogDetailApiV1CallbackLogLidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CallbackAPI.LogDetailApiV1CallbackLogLidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**lid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiLogDetailApiV1CallbackLogLidGetRequest struct via the builder pattern


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


## LogDetailApiV1CallbackLogLidGet_0

> interface{} LogDetailApiV1CallbackLogLidGet_0(ctx, lid).Execute()

回调详情

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
	lid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CallbackAPI.LogDetailApiV1CallbackLogLidGet_0(context.Background(), lid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CallbackAPI.LogDetailApiV1CallbackLogLidGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LogDetailApiV1CallbackLogLidGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CallbackAPI.LogDetailApiV1CallbackLogLidGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**lid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiLogDetailApiV1CallbackLogLidGet_3Request struct via the builder pattern


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


## PaymentCallbackApiV1CallbackPaymentPost

> interface{} PaymentCallbackApiV1CallbackPaymentPost(ctx).BizId(bizId).BodyPaymentCallbackApiV1CallbackPaymentPost(bodyPaymentCallbackApiV1CallbackPaymentPost).Execute()

支付回调

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
	bizId := "bizId_example" // string |  (optional)
	bodyPaymentCallbackApiV1CallbackPaymentPost := *openapiclient.NewBodyPaymentCallbackApiV1CallbackPaymentPost() // BodyPaymentCallbackApiV1CallbackPaymentPost |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CallbackAPI.PaymentCallbackApiV1CallbackPaymentPost(context.Background()).BizId(bizId).BodyPaymentCallbackApiV1CallbackPaymentPost(bodyPaymentCallbackApiV1CallbackPaymentPost).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CallbackAPI.PaymentCallbackApiV1CallbackPaymentPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PaymentCallbackApiV1CallbackPaymentPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CallbackAPI.PaymentCallbackApiV1CallbackPaymentPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPaymentCallbackApiV1CallbackPaymentPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bizId** | **string** |  | 
 **bodyPaymentCallbackApiV1CallbackPaymentPost** | [**BodyPaymentCallbackApiV1CallbackPaymentPost**](BodyPaymentCallbackApiV1CallbackPaymentPost.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## PaymentCallbackApiV1CallbackPaymentPost_0

> interface{} PaymentCallbackApiV1CallbackPaymentPost_0(ctx).BizId(bizId).BodyPaymentCallbackApiV1CallbackPaymentPost(bodyPaymentCallbackApiV1CallbackPaymentPost).Execute()

支付回调

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
	bizId := "bizId_example" // string |  (optional)
	bodyPaymentCallbackApiV1CallbackPaymentPost := *openapiclient.NewBodyPaymentCallbackApiV1CallbackPaymentPost() // BodyPaymentCallbackApiV1CallbackPaymentPost |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CallbackAPI.PaymentCallbackApiV1CallbackPaymentPost_0(context.Background()).BizId(bizId).BodyPaymentCallbackApiV1CallbackPaymentPost(bodyPaymentCallbackApiV1CallbackPaymentPost).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CallbackAPI.PaymentCallbackApiV1CallbackPaymentPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PaymentCallbackApiV1CallbackPaymentPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CallbackAPI.PaymentCallbackApiV1CallbackPaymentPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPaymentCallbackApiV1CallbackPaymentPost_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bizId** | **string** |  | 
 **bodyPaymentCallbackApiV1CallbackPaymentPost** | [**BodyPaymentCallbackApiV1CallbackPaymentPost**](BodyPaymentCallbackApiV1CallbackPaymentPost.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## SmsCallbackApiV1CallbackSmsPost

> interface{} SmsCallbackApiV1CallbackSmsPost(ctx).BizId(bizId).BodySmsCallbackApiV1CallbackSmsPost(bodySmsCallbackApiV1CallbackSmsPost).Execute()

短信回调

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
	bizId := "bizId_example" // string |  (optional)
	bodySmsCallbackApiV1CallbackSmsPost := *openapiclient.NewBodySmsCallbackApiV1CallbackSmsPost() // BodySmsCallbackApiV1CallbackSmsPost |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CallbackAPI.SmsCallbackApiV1CallbackSmsPost(context.Background()).BizId(bizId).BodySmsCallbackApiV1CallbackSmsPost(bodySmsCallbackApiV1CallbackSmsPost).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CallbackAPI.SmsCallbackApiV1CallbackSmsPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SmsCallbackApiV1CallbackSmsPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CallbackAPI.SmsCallbackApiV1CallbackSmsPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSmsCallbackApiV1CallbackSmsPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bizId** | **string** |  | 
 **bodySmsCallbackApiV1CallbackSmsPost** | [**BodySmsCallbackApiV1CallbackSmsPost**](BodySmsCallbackApiV1CallbackSmsPost.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## SmsCallbackApiV1CallbackSmsPost_0

> interface{} SmsCallbackApiV1CallbackSmsPost_0(ctx).BizId(bizId).BodySmsCallbackApiV1CallbackSmsPost(bodySmsCallbackApiV1CallbackSmsPost).Execute()

短信回调

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
	bizId := "bizId_example" // string |  (optional)
	bodySmsCallbackApiV1CallbackSmsPost := *openapiclient.NewBodySmsCallbackApiV1CallbackSmsPost() // BodySmsCallbackApiV1CallbackSmsPost |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CallbackAPI.SmsCallbackApiV1CallbackSmsPost_0(context.Background()).BizId(bizId).BodySmsCallbackApiV1CallbackSmsPost(bodySmsCallbackApiV1CallbackSmsPost).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CallbackAPI.SmsCallbackApiV1CallbackSmsPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SmsCallbackApiV1CallbackSmsPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CallbackAPI.SmsCallbackApiV1CallbackSmsPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSmsCallbackApiV1CallbackSmsPost_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bizId** | **string** |  | 
 **bodySmsCallbackApiV1CallbackSmsPost** | [**BodySmsCallbackApiV1CallbackSmsPost**](BodySmsCallbackApiV1CallbackSmsPost.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

