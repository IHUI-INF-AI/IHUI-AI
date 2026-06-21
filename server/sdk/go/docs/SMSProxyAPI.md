# \SMSProxyAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetProxyConfigApiV1ApiSmsProxyConfigGet**](SMSProxyAPI.md#GetProxyConfigApiV1ApiSmsProxyConfigGet) | **Get** /api/v1/api/sms-proxy/config | Get Proxy Config
[**QuickRegisterApiV1ApiSmsProxyRegisterPost**](SMSProxyAPI.md#QuickRegisterApiV1ApiSmsProxyRegisterPost) | **Post** /api/v1/api/sms-proxy/register | Quick Register
[**SendSmsCodeApiV1ApiSmsProxySendPost**](SMSProxyAPI.md#SendSmsCodeApiV1ApiSmsProxySendPost) | **Post** /api/v1/api/sms-proxy/send | Send Sms Code
[**VerifySmsCodeApiV1ApiSmsProxyVerifyPost**](SMSProxyAPI.md#VerifySmsCodeApiV1ApiSmsProxyVerifyPost) | **Post** /api/v1/api/sms-proxy/verify | Verify Sms Code



## GetProxyConfigApiV1ApiSmsProxyConfigGet

> interface{} GetProxyConfigApiV1ApiSmsProxyConfigGet(ctx).Execute()

Get Proxy Config



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
	resp, r, err := apiClient.SMSProxyAPI.GetProxyConfigApiV1ApiSmsProxyConfigGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SMSProxyAPI.GetProxyConfigApiV1ApiSmsProxyConfigGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetProxyConfigApiV1ApiSmsProxyConfigGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SMSProxyAPI.GetProxyConfigApiV1ApiSmsProxyConfigGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetProxyConfigApiV1ApiSmsProxyConfigGetRequest struct via the builder pattern


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


## QuickRegisterApiV1ApiSmsProxyRegisterPost

> interface{} QuickRegisterApiV1ApiSmsProxyRegisterPost(ctx).RegisterRequest(registerRequest).Execute()

Quick Register



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
	registerRequest := *openapiclient.NewRegisterRequest("Phone_example", "Code_example") // RegisterRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SMSProxyAPI.QuickRegisterApiV1ApiSmsProxyRegisterPost(context.Background()).RegisterRequest(registerRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SMSProxyAPI.QuickRegisterApiV1ApiSmsProxyRegisterPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `QuickRegisterApiV1ApiSmsProxyRegisterPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SMSProxyAPI.QuickRegisterApiV1ApiSmsProxyRegisterPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiQuickRegisterApiV1ApiSmsProxyRegisterPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **registerRequest** | [**RegisterRequest**](RegisterRequest.md) |  | 

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


## SendSmsCodeApiV1ApiSmsProxySendPost

> interface{} SendSmsCodeApiV1ApiSmsProxySendPost(ctx).SmsVerifyRequest(smsVerifyRequest).Execute()

Send Sms Code



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
	smsVerifyRequest := *openapiclient.NewSmsVerifyRequest("Phone_example") // SmsVerifyRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SMSProxyAPI.SendSmsCodeApiV1ApiSmsProxySendPost(context.Background()).SmsVerifyRequest(smsVerifyRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SMSProxyAPI.SendSmsCodeApiV1ApiSmsProxySendPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SendSmsCodeApiV1ApiSmsProxySendPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SMSProxyAPI.SendSmsCodeApiV1ApiSmsProxySendPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSendSmsCodeApiV1ApiSmsProxySendPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **smsVerifyRequest** | [**SmsVerifyRequest**](SmsVerifyRequest.md) |  | 

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


## VerifySmsCodeApiV1ApiSmsProxyVerifyPost

> interface{} VerifySmsCodeApiV1ApiSmsProxyVerifyPost(ctx).SmsCodeVerifyRequest(smsCodeVerifyRequest).Execute()

Verify Sms Code



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
	smsCodeVerifyRequest := *openapiclient.NewSmsCodeVerifyRequest("Phone_example", "Code_example") // SmsCodeVerifyRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SMSProxyAPI.VerifySmsCodeApiV1ApiSmsProxyVerifyPost(context.Background()).SmsCodeVerifyRequest(smsCodeVerifyRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SMSProxyAPI.VerifySmsCodeApiV1ApiSmsProxyVerifyPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `VerifySmsCodeApiV1ApiSmsProxyVerifyPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SMSProxyAPI.VerifySmsCodeApiV1ApiSmsProxyVerifyPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiVerifySmsCodeApiV1ApiSmsProxyVerifyPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **smsCodeVerifyRequest** | [**SmsCodeVerifyRequest**](SmsCodeVerifyRequest.md) |  | 

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

