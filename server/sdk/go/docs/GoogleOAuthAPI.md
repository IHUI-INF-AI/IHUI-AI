# \GoogleOAuthAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AndroidWxCodeApiV1AuthGoogleAndroidWxCodeGet**](GoogleOAuthAPI.md#AndroidWxCodeApiV1AuthGoogleAndroidWxCodeGet) | **Get** /api/v1/auth/google/android/wxCode | Google Android 登录 (id_token 直接登录)
[**GoogleConfigStatusApiV1AuthGoogleConfigGet**](GoogleOAuthAPI.md#GoogleConfigStatusApiV1AuthGoogleConfigGet) | **Get** /api/v1/auth/google/config | 返回当前 Google OAuth 配置 (脱敏)
[**PcWxCodeApiV1AuthGooglePcWxCodeGet**](GoogleOAuthAPI.md#PcWxCodeApiV1AuthGooglePcWxCodeGet) | **Get** /api/v1/auth/google/pc/wxCode | Google PC 登录 (用 code 换 token)



## AndroidWxCodeApiV1AuthGoogleAndroidWxCodeGet

> interface{} AndroidWxCodeApiV1AuthGoogleAndroidWxCodeGet(ctx).IdToken(idToken).Execute()

Google Android 登录 (id_token 直接登录)



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
	idToken := "idToken_example" // string | Google id_token

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.GoogleOAuthAPI.AndroidWxCodeApiV1AuthGoogleAndroidWxCodeGet(context.Background()).IdToken(idToken).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `GoogleOAuthAPI.AndroidWxCodeApiV1AuthGoogleAndroidWxCodeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AndroidWxCodeApiV1AuthGoogleAndroidWxCodeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `GoogleOAuthAPI.AndroidWxCodeApiV1AuthGoogleAndroidWxCodeGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAndroidWxCodeApiV1AuthGoogleAndroidWxCodeGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **idToken** | **string** | Google id_token | 

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


## GoogleConfigStatusApiV1AuthGoogleConfigGet

> interface{} GoogleConfigStatusApiV1AuthGoogleConfigGet(ctx).Execute()

返回当前 Google OAuth 配置 (脱敏)



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
	resp, r, err := apiClient.GoogleOAuthAPI.GoogleConfigStatusApiV1AuthGoogleConfigGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `GoogleOAuthAPI.GoogleConfigStatusApiV1AuthGoogleConfigGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GoogleConfigStatusApiV1AuthGoogleConfigGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `GoogleOAuthAPI.GoogleConfigStatusApiV1AuthGoogleConfigGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGoogleConfigStatusApiV1AuthGoogleConfigGetRequest struct via the builder pattern


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


## PcWxCodeApiV1AuthGooglePcWxCodeGet

> interface{} PcWxCodeApiV1AuthGooglePcWxCodeGet(ctx).Code(code).Execute()

Google PC 登录 (用 code 换 token)



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
	code := "code_example" // string | Google 授权码

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.GoogleOAuthAPI.PcWxCodeApiV1AuthGooglePcWxCodeGet(context.Background()).Code(code).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `GoogleOAuthAPI.PcWxCodeApiV1AuthGooglePcWxCodeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PcWxCodeApiV1AuthGooglePcWxCodeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `GoogleOAuthAPI.PcWxCodeApiV1AuthGooglePcWxCodeGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPcWxCodeApiV1AuthGooglePcWxCodeGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** | Google 授权码 | 

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

