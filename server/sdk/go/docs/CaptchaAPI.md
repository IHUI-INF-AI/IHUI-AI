# \CaptchaAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetCaptchaApiV1AuthCaptchaGet**](CaptchaAPI.md#GetCaptchaApiV1AuthCaptchaGet) | **Get** /api/v1/auth/captcha | 获取验证码图片
[**VerifyCaptchaEndpointApiV1AuthCaptchaVerifyPost**](CaptchaAPI.md#VerifyCaptchaEndpointApiV1AuthCaptchaVerifyPost) | **Post** /api/v1/auth/captcha/verify | 校验验证码



## GetCaptchaApiV1AuthCaptchaGet

> interface{} GetCaptchaApiV1AuthCaptchaGet(ctx).Execute()

获取验证码图片



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
	resp, r, err := apiClient.CaptchaAPI.GetCaptchaApiV1AuthCaptchaGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CaptchaAPI.GetCaptchaApiV1AuthCaptchaGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetCaptchaApiV1AuthCaptchaGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CaptchaAPI.GetCaptchaApiV1AuthCaptchaGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetCaptchaApiV1AuthCaptchaGetRequest struct via the builder pattern


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


## VerifyCaptchaEndpointApiV1AuthCaptchaVerifyPost

> interface{} VerifyCaptchaEndpointApiV1AuthCaptchaVerifyPost(ctx).CaptchaVerifyRequest(captchaVerifyRequest).Execute()

校验验证码



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
	captchaVerifyRequest := *openapiclient.NewCaptchaVerifyRequest("CaptchaKey_example", "Code_example") // CaptchaVerifyRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CaptchaAPI.VerifyCaptchaEndpointApiV1AuthCaptchaVerifyPost(context.Background()).CaptchaVerifyRequest(captchaVerifyRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CaptchaAPI.VerifyCaptchaEndpointApiV1AuthCaptchaVerifyPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `VerifyCaptchaEndpointApiV1AuthCaptchaVerifyPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CaptchaAPI.VerifyCaptchaEndpointApiV1AuthCaptchaVerifyPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiVerifyCaptchaEndpointApiV1AuthCaptchaVerifyPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **captchaVerifyRequest** | [**CaptchaVerifyRequest**](CaptchaVerifyRequest.md) |  | 

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

