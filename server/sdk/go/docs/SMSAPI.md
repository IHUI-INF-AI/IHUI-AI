# \SMSAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**SendCodeApiV1AuthSmsSendPost**](SMSAPI.md#SendCodeApiV1AuthSmsSendPost) | **Post** /api/v1/auth/sms/send | Send SMS code
[**SendCodeApiV1AuthSmsSendPost_0**](SMSAPI.md#SendCodeApiV1AuthSmsSendPost_0) | **Post** /api/v1/auth/sms/send | Send SMS code
[**VerifyCodeApiV1AuthSmsVerifyPost**](SMSAPI.md#VerifyCodeApiV1AuthSmsVerifyPost) | **Post** /api/v1/auth/sms/verify | Verify SMS code
[**VerifyCodeApiV1AuthSmsVerifyPost_0**](SMSAPI.md#VerifyCodeApiV1AuthSmsVerifyPost_0) | **Post** /api/v1/auth/sms/verify | Verify SMS code



## SendCodeApiV1AuthSmsSendPost

> interface{} SendCodeApiV1AuthSmsSendPost(ctx).Phone(phone).Execute()

Send SMS code

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
	phone := "phone_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SMSAPI.SendCodeApiV1AuthSmsSendPost(context.Background()).Phone(phone).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SMSAPI.SendCodeApiV1AuthSmsSendPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SendCodeApiV1AuthSmsSendPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SMSAPI.SendCodeApiV1AuthSmsSendPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSendCodeApiV1AuthSmsSendPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **string** |  | 

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


## SendCodeApiV1AuthSmsSendPost_0

> interface{} SendCodeApiV1AuthSmsSendPost_0(ctx).Phone(phone).Execute()

Send SMS code

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
	phone := "phone_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SMSAPI.SendCodeApiV1AuthSmsSendPost_0(context.Background()).Phone(phone).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SMSAPI.SendCodeApiV1AuthSmsSendPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SendCodeApiV1AuthSmsSendPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SMSAPI.SendCodeApiV1AuthSmsSendPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSendCodeApiV1AuthSmsSendPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **string** |  | 

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


## VerifyCodeApiV1AuthSmsVerifyPost

> interface{} VerifyCodeApiV1AuthSmsVerifyPost(ctx).Phone(phone).Code(code).Execute()

Verify SMS code

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
	phone := "phone_example" // string | 
	code := "code_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SMSAPI.VerifyCodeApiV1AuthSmsVerifyPost(context.Background()).Phone(phone).Code(code).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SMSAPI.VerifyCodeApiV1AuthSmsVerifyPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `VerifyCodeApiV1AuthSmsVerifyPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SMSAPI.VerifyCodeApiV1AuthSmsVerifyPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiVerifyCodeApiV1AuthSmsVerifyPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **string** |  | 
 **code** | **string** |  | 

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


## VerifyCodeApiV1AuthSmsVerifyPost_0

> interface{} VerifyCodeApiV1AuthSmsVerifyPost_0(ctx).Phone(phone).Code(code).Execute()

Verify SMS code

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
	phone := "phone_example" // string | 
	code := "code_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SMSAPI.VerifyCodeApiV1AuthSmsVerifyPost_0(context.Background()).Phone(phone).Code(code).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SMSAPI.VerifyCodeApiV1AuthSmsVerifyPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `VerifyCodeApiV1AuthSmsVerifyPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SMSAPI.VerifyCodeApiV1AuthSmsVerifyPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiVerifyCodeApiV1AuthSmsVerifyPost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **string** |  | 
 **code** | **string** |  | 

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

