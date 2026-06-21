# \AuthAlipayAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AliPcWxCodeApiV1AuthLoginAliPcWxCodeGet**](AuthAlipayAPI.md#AliPcWxCodeApiV1AuthLoginAliPcWxCodeGet) | **Get** /api/v1/auth/login/ali/pc/wxCode | Ali Pc Wx Code
[**AliWebWxCodeApiV1AuthLoginAliWebWxCodeGet**](AuthAlipayAPI.md#AliWebWxCodeApiV1AuthLoginAliWebWxCodeGet) | **Get** /api/v1/auth/login/ali/web/wxCode | Ali Web Wx Code



## AliPcWxCodeApiV1AuthLoginAliPcWxCodeGet

> interface{} AliPcWxCodeApiV1AuthLoginAliPcWxCodeGet(ctx).Code(code).Execute()

Ali Pc Wx Code

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
	code := "code_example" // string | Alipay auth code

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthAlipayAPI.AliPcWxCodeApiV1AuthLoginAliPcWxCodeGet(context.Background()).Code(code).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthAlipayAPI.AliPcWxCodeApiV1AuthLoginAliPcWxCodeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AliPcWxCodeApiV1AuthLoginAliPcWxCodeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthAlipayAPI.AliPcWxCodeApiV1AuthLoginAliPcWxCodeGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAliPcWxCodeApiV1AuthLoginAliPcWxCodeGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** | Alipay auth code | 

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


## AliWebWxCodeApiV1AuthLoginAliWebWxCodeGet

> interface{} AliWebWxCodeApiV1AuthLoginAliWebWxCodeGet(ctx).AuthCode(authCode).Execute()

Ali Web Wx Code

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
	authCode := "authCode_example" // string | Alipay web auth code

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthAlipayAPI.AliWebWxCodeApiV1AuthLoginAliWebWxCodeGet(context.Background()).AuthCode(authCode).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthAlipayAPI.AliWebWxCodeApiV1AuthLoginAliWebWxCodeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AliWebWxCodeApiV1AuthLoginAliWebWxCodeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthAlipayAPI.AliWebWxCodeApiV1AuthLoginAliWebWxCodeGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAliWebWxCodeApiV1AuthLoginAliWebWxCodeGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **authCode** | **string** | Alipay web auth code | 

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

