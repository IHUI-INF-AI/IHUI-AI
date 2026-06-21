# \EnterpriseWeChatAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**EnterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost**](EnterpriseWeChatAPI.md#EnterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost) | **Post** /api/v1/auth/login/enterprise/pc/callback | Enterprise Pc Callback
[**EnterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet**](EnterpriseWeChatAPI.md#EnterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet) | **Get** /api/v1/auth/login/enterprise/pc/wxCode | Enterprise Pc Wx Code



## EnterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost

> interface{} EnterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost(ctx).MsgSignature(msgSignature).Timestamp(timestamp).Nonce(nonce).Execute()

Enterprise Pc Callback

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
	msgSignature := "msgSignature_example" // string |  (optional) (default to "")
	timestamp := "timestamp_example" // string |  (optional) (default to "")
	nonce := "nonce_example" // string |  (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.EnterpriseWeChatAPI.EnterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost(context.Background()).MsgSignature(msgSignature).Timestamp(timestamp).Nonce(nonce).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `EnterpriseWeChatAPI.EnterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `EnterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `EnterpriseWeChatAPI.EnterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiEnterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **msgSignature** | **string** |  | [default to &quot;&quot;]
 **timestamp** | **string** |  | [default to &quot;&quot;]
 **nonce** | **string** |  | [default to &quot;&quot;]

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


## EnterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet

> interface{} EnterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet(ctx).Code(code).Execute()

Enterprise Pc Wx Code

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
	code := "code_example" // string | WeCom js_code

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.EnterpriseWeChatAPI.EnterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet(context.Background()).Code(code).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `EnterpriseWeChatAPI.EnterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `EnterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `EnterpriseWeChatAPI.EnterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiEnterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** | WeCom js_code | 

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

