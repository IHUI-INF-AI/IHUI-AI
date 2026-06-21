# \AlipayFundAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AlipayFundNotify**](AlipayFundAPI.md#AlipayFundNotify) | **Post** /api/v1/payments/alipay/notify | Alipay Notify
[**AlipayFundNotify_0**](AlipayFundAPI.md#AlipayFundNotify_0) | **Post** /api/v1/payments/alipay/notify | Alipay Notify
[**AlipayReturnApiV1PaymentsAlipayReturnGet**](AlipayFundAPI.md#AlipayReturnApiV1PaymentsAlipayReturnGet) | **Get** /api/v1/payments/alipay/return | Alipay Return
[**AlipayReturnApiV1PaymentsAlipayReturnGet_0**](AlipayFundAPI.md#AlipayReturnApiV1PaymentsAlipayReturnGet_0) | **Get** /api/v1/payments/alipay/return | Alipay Return
[**CreatePayApiV1PaymentsCreatePost**](AlipayFundAPI.md#CreatePayApiV1PaymentsCreatePost) | **Post** /api/v1/payments/create | Create Pay
[**CreatePayApiV1PaymentsCreatePost_0**](AlipayFundAPI.md#CreatePayApiV1PaymentsCreatePost_0) | **Post** /api/v1/payments/create | Create Pay
[**CreatePayJsonApiV1PaymentsCreate2Post**](AlipayFundAPI.md#CreatePayJsonApiV1PaymentsCreate2Post) | **Post** /api/v1/payments/create2 | Create Pay Json
[**CreatePayJsonApiV1PaymentsCreate2Post_0**](AlipayFundAPI.md#CreatePayJsonApiV1PaymentsCreate2Post_0) | **Post** /api/v1/payments/create2 | Create Pay Json
[**PayFailApiV1PaymentsFailGet**](AlipayFundAPI.md#PayFailApiV1PaymentsFailGet) | **Get** /api/v1/payments/fail | Pay Fail
[**PayFailApiV1PaymentsFailGet_0**](AlipayFundAPI.md#PayFailApiV1PaymentsFailGet_0) | **Get** /api/v1/payments/fail | Pay Fail
[**PaySuccessApiV1PaymentsSuccessGet**](AlipayFundAPI.md#PaySuccessApiV1PaymentsSuccessGet) | **Get** /api/v1/payments/success | Pay Success
[**PaySuccessApiV1PaymentsSuccessGet_0**](AlipayFundAPI.md#PaySuccessApiV1PaymentsSuccessGet_0) | **Get** /api/v1/payments/success | Pay Success



## AlipayFundNotify

> interface{} AlipayFundNotify(ctx).Execute()

Alipay Notify

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
	resp, r, err := apiClient.AlipayFundAPI.AlipayFundNotify(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AlipayFundAPI.AlipayFundNotify``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AlipayFundNotify`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AlipayFundAPI.AlipayFundNotify`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiAlipayFundNotifyRequest struct via the builder pattern


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


## AlipayFundNotify_0

> interface{} AlipayFundNotify_0(ctx).Execute()

Alipay Notify

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
	resp, r, err := apiClient.AlipayFundAPI.AlipayFundNotify_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AlipayFundAPI.AlipayFundNotify_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AlipayFundNotify_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AlipayFundAPI.AlipayFundNotify_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiAlipayFundNotify_1Request struct via the builder pattern


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


## AlipayReturnApiV1PaymentsAlipayReturnGet

> interface{} AlipayReturnApiV1PaymentsAlipayReturnGet(ctx).Execute()

Alipay Return

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
	resp, r, err := apiClient.AlipayFundAPI.AlipayReturnApiV1PaymentsAlipayReturnGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AlipayFundAPI.AlipayReturnApiV1PaymentsAlipayReturnGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AlipayReturnApiV1PaymentsAlipayReturnGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AlipayFundAPI.AlipayReturnApiV1PaymentsAlipayReturnGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiAlipayReturnApiV1PaymentsAlipayReturnGetRequest struct via the builder pattern


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


## AlipayReturnApiV1PaymentsAlipayReturnGet_0

> interface{} AlipayReturnApiV1PaymentsAlipayReturnGet_0(ctx).Execute()

Alipay Return

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
	resp, r, err := apiClient.AlipayFundAPI.AlipayReturnApiV1PaymentsAlipayReturnGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AlipayFundAPI.AlipayReturnApiV1PaymentsAlipayReturnGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AlipayReturnApiV1PaymentsAlipayReturnGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AlipayFundAPI.AlipayReturnApiV1PaymentsAlipayReturnGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiAlipayReturnApiV1PaymentsAlipayReturnGet_2Request struct via the builder pattern


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


## CreatePayApiV1PaymentsCreatePost

> interface{} CreatePayApiV1PaymentsCreatePost(ctx).Execute()

Create Pay

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
	resp, r, err := apiClient.AlipayFundAPI.CreatePayApiV1PaymentsCreatePost(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AlipayFundAPI.CreatePayApiV1PaymentsCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreatePayApiV1PaymentsCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AlipayFundAPI.CreatePayApiV1PaymentsCreatePost`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCreatePayApiV1PaymentsCreatePostRequest struct via the builder pattern


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


## CreatePayApiV1PaymentsCreatePost_0

> interface{} CreatePayApiV1PaymentsCreatePost_0(ctx).Execute()

Create Pay

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
	resp, r, err := apiClient.AlipayFundAPI.CreatePayApiV1PaymentsCreatePost_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AlipayFundAPI.CreatePayApiV1PaymentsCreatePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreatePayApiV1PaymentsCreatePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AlipayFundAPI.CreatePayApiV1PaymentsCreatePost_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCreatePayApiV1PaymentsCreatePost_3Request struct via the builder pattern


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


## CreatePayJsonApiV1PaymentsCreate2Post

> interface{} CreatePayJsonApiV1PaymentsCreate2Post(ctx).Execute()

Create Pay Json

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
	resp, r, err := apiClient.AlipayFundAPI.CreatePayJsonApiV1PaymentsCreate2Post(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AlipayFundAPI.CreatePayJsonApiV1PaymentsCreate2Post``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreatePayJsonApiV1PaymentsCreate2Post`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AlipayFundAPI.CreatePayJsonApiV1PaymentsCreate2Post`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCreatePayJsonApiV1PaymentsCreate2PostRequest struct via the builder pattern


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


## CreatePayJsonApiV1PaymentsCreate2Post_0

> interface{} CreatePayJsonApiV1PaymentsCreate2Post_0(ctx).Execute()

Create Pay Json

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
	resp, r, err := apiClient.AlipayFundAPI.CreatePayJsonApiV1PaymentsCreate2Post_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AlipayFundAPI.CreatePayJsonApiV1PaymentsCreate2Post_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreatePayJsonApiV1PaymentsCreate2Post_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AlipayFundAPI.CreatePayJsonApiV1PaymentsCreate2Post_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCreatePayJsonApiV1PaymentsCreate2Post_4Request struct via the builder pattern


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


## PayFailApiV1PaymentsFailGet

> interface{} PayFailApiV1PaymentsFailGet(ctx).Execute()

Pay Fail

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
	resp, r, err := apiClient.AlipayFundAPI.PayFailApiV1PaymentsFailGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AlipayFundAPI.PayFailApiV1PaymentsFailGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PayFailApiV1PaymentsFailGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AlipayFundAPI.PayFailApiV1PaymentsFailGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiPayFailApiV1PaymentsFailGetRequest struct via the builder pattern


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


## PayFailApiV1PaymentsFailGet_0

> interface{} PayFailApiV1PaymentsFailGet_0(ctx).Execute()

Pay Fail

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
	resp, r, err := apiClient.AlipayFundAPI.PayFailApiV1PaymentsFailGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AlipayFundAPI.PayFailApiV1PaymentsFailGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PayFailApiV1PaymentsFailGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AlipayFundAPI.PayFailApiV1PaymentsFailGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiPayFailApiV1PaymentsFailGet_5Request struct via the builder pattern


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


## PaySuccessApiV1PaymentsSuccessGet

> interface{} PaySuccessApiV1PaymentsSuccessGet(ctx).OrderNo(orderNo).Execute()

Pay Success

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
	orderNo := "orderNo_example" // string | order number (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AlipayFundAPI.PaySuccessApiV1PaymentsSuccessGet(context.Background()).OrderNo(orderNo).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AlipayFundAPI.PaySuccessApiV1PaymentsSuccessGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PaySuccessApiV1PaymentsSuccessGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AlipayFundAPI.PaySuccessApiV1PaymentsSuccessGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPaySuccessApiV1PaymentsSuccessGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orderNo** | **string** | order number | [default to &quot;&quot;]

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


## PaySuccessApiV1PaymentsSuccessGet_0

> interface{} PaySuccessApiV1PaymentsSuccessGet_0(ctx).OrderNo(orderNo).Execute()

Pay Success

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
	orderNo := "orderNo_example" // string | order number (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AlipayFundAPI.PaySuccessApiV1PaymentsSuccessGet_0(context.Background()).OrderNo(orderNo).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AlipayFundAPI.PaySuccessApiV1PaymentsSuccessGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PaySuccessApiV1PaymentsSuccessGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AlipayFundAPI.PaySuccessApiV1PaymentsSuccessGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPaySuccessApiV1PaymentsSuccessGet_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orderNo** | **string** | order number | [default to &quot;&quot;]

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

