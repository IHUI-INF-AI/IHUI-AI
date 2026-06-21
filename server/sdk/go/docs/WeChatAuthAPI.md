# \WeChatAuthAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetWechatPhoneApiV1AuthAuthWechatMiniPhonePost**](WeChatAuthAPI.md#GetWechatPhoneApiV1AuthAuthWechatMiniPhonePost) | **Post** /api/v1/auth/auth/wechat/mini/phone | Get WeChat phone number
[**GetWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0**](WeChatAuthAPI.md#GetWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0) | **Post** /api/v1/auth/auth/wechat/mini/phone | Get WeChat phone number
[**GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet**](WeChatAuthAPI.md#GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet) | **Get** /api/v1/auth/auth/wechat/mini/qrcode | Get WeChat mini-program QR code
[**GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0**](WeChatAuthAPI.md#GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0) | **Get** /api/v1/auth/auth/wechat/mini/qrcode | Get WeChat mini-program QR code
[**WechatMiniLoginApiV1AuthAuthWechatMiniLoginGet**](WeChatAuthAPI.md#WechatMiniLoginApiV1AuthAuthWechatMiniLoginGet) | **Get** /api/v1/auth/auth/wechat/mini/login | WeChat mini-program login
[**WechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0**](WeChatAuthAPI.md#WechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0) | **Get** /api/v1/auth/auth/wechat/mini/login | WeChat mini-program login
[**WechatRebindApiV1AuthAuthWechatMiniRebindPost**](WeChatAuthAPI.md#WechatRebindApiV1AuthAuthWechatMiniRebindPost) | **Post** /api/v1/auth/auth/wechat/mini/rebind | Rebind WeChat mini-program account
[**WechatRebindApiV1AuthAuthWechatMiniRebindPost_0**](WeChatAuthAPI.md#WechatRebindApiV1AuthAuthWechatMiniRebindPost_0) | **Post** /api/v1/auth/auth/wechat/mini/rebind | Rebind WeChat mini-program account
[**WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost**](WeChatAuthAPI.md#WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost) | **Post** /api/v1/auth/auth/wechat/mini/rebind_by_phone | Rebind WeChat by phone number
[**WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0**](WeChatAuthAPI.md#WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0) | **Post** /api/v1/auth/auth/wechat/mini/rebind_by_phone | Rebind WeChat by phone number



## GetWechatPhoneApiV1AuthAuthWechatMiniPhonePost

> interface{} GetWechatPhoneApiV1AuthAuthWechatMiniPhonePost(ctx).Code(code).Execute()

Get WeChat phone number



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
	code := "code_example" // string | Code from wx.getPhoneNumber component

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WeChatAuthAPI.GetWechatPhoneApiV1AuthAuthWechatMiniPhonePost(context.Background()).Code(code).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatAuthAPI.GetWechatPhoneApiV1AuthAuthWechatMiniPhonePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetWechatPhoneApiV1AuthAuthWechatMiniPhonePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatAuthAPI.GetWechatPhoneApiV1AuthAuthWechatMiniPhonePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetWechatPhoneApiV1AuthAuthWechatMiniPhonePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** | Code from wx.getPhoneNumber component | 

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


## GetWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0

> interface{} GetWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0(ctx).Code(code).Execute()

Get WeChat phone number



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
	code := "code_example" // string | Code from wx.getPhoneNumber component

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WeChatAuthAPI.GetWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0(context.Background()).Code(code).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatAuthAPI.GetWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatAuthAPI.GetWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetWechatPhoneApiV1AuthAuthWechatMiniPhonePost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** | Code from wx.getPhoneNumber component | 

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


## GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet

> interface{} GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet(ctx).Scene(scene).Page(page).Execute()

Get WeChat mini-program QR code



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
	scene := "scene_example" // string | Scene string for QR code
	page := "page_example" // string | Mini-program page path (optional) (default to "pages/index/index")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WeChatAuthAPI.GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet(context.Background()).Scene(scene).Page(page).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatAuthAPI.GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatAuthAPI.GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **scene** | **string** | Scene string for QR code | 
 **page** | **string** | Mini-program page path | [default to &quot;pages/index/index&quot;]

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


## GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0

> interface{} GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0(ctx).Scene(scene).Page(page).Execute()

Get WeChat mini-program QR code



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
	scene := "scene_example" // string | Scene string for QR code
	page := "page_example" // string | Mini-program page path (optional) (default to "pages/index/index")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WeChatAuthAPI.GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0(context.Background()).Scene(scene).Page(page).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatAuthAPI.GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatAuthAPI.GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **scene** | **string** | Scene string for QR code | 
 **page** | **string** | Mini-program page path | [default to &quot;pages/index/index&quot;]

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


## WechatMiniLoginApiV1AuthAuthWechatMiniLoginGet

> interface{} WechatMiniLoginApiV1AuthAuthWechatMiniLoginGet(ctx).Code(code).ParentId(parentId).Execute()

WeChat mini-program login



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
	code := "code_example" // string | 
	parentId := "parentId_example" // string | Parent invite code for referral (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WeChatAuthAPI.WechatMiniLoginApiV1AuthAuthWechatMiniLoginGet(context.Background()).Code(code).ParentId(parentId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatAuthAPI.WechatMiniLoginApiV1AuthAuthWechatMiniLoginGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `WechatMiniLoginApiV1AuthAuthWechatMiniLoginGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatAuthAPI.WechatMiniLoginApiV1AuthAuthWechatMiniLoginGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiWechatMiniLoginApiV1AuthAuthWechatMiniLoginGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** |  | 
 **parentId** | **string** | Parent invite code for referral | [default to &quot;&quot;]

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


## WechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0

> interface{} WechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0(ctx).Code(code).ParentId(parentId).Execute()

WeChat mini-program login



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
	code := "code_example" // string | 
	parentId := "parentId_example" // string | Parent invite code for referral (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WeChatAuthAPI.WechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0(context.Background()).Code(code).ParentId(parentId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatAuthAPI.WechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `WechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatAuthAPI.WechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiWechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** |  | 
 **parentId** | **string** | Parent invite code for referral | [default to &quot;&quot;]

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


## WechatRebindApiV1AuthAuthWechatMiniRebindPost

> interface{} WechatRebindApiV1AuthAuthWechatMiniRebindPost(ctx).Code(code).Execute()

Rebind WeChat mini-program account



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
	code := "code_example" // string | New WeChat login code

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WeChatAuthAPI.WechatRebindApiV1AuthAuthWechatMiniRebindPost(context.Background()).Code(code).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatAuthAPI.WechatRebindApiV1AuthAuthWechatMiniRebindPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `WechatRebindApiV1AuthAuthWechatMiniRebindPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatAuthAPI.WechatRebindApiV1AuthAuthWechatMiniRebindPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiWechatRebindApiV1AuthAuthWechatMiniRebindPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** | New WeChat login code | 

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


## WechatRebindApiV1AuthAuthWechatMiniRebindPost_0

> interface{} WechatRebindApiV1AuthAuthWechatMiniRebindPost_0(ctx).Code(code).Execute()

Rebind WeChat mini-program account



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
	code := "code_example" // string | New WeChat login code

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WeChatAuthAPI.WechatRebindApiV1AuthAuthWechatMiniRebindPost_0(context.Background()).Code(code).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatAuthAPI.WechatRebindApiV1AuthAuthWechatMiniRebindPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `WechatRebindApiV1AuthAuthWechatMiniRebindPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatAuthAPI.WechatRebindApiV1AuthAuthWechatMiniRebindPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiWechatRebindApiV1AuthAuthWechatMiniRebindPost_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** | New WeChat login code | 

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


## WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost

> interface{} WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost(ctx).Phone(phone).OpenId(openId).Execute()

Rebind WeChat by phone number



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
	phone := "phone_example" // string | User phone number
	openId := "openId_example" // string | New WeChat open_id to bind

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WeChatAuthAPI.WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost(context.Background()).Phone(phone).OpenId(openId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatAuthAPI.WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatAuthAPI.WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiWechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **string** | User phone number | 
 **openId** | **string** | New WeChat open_id to bind | 

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


## WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0

> interface{} WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0(ctx).Phone(phone).OpenId(openId).Execute()

Rebind WeChat by phone number



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
	phone := "phone_example" // string | User phone number
	openId := "openId_example" // string | New WeChat open_id to bind

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WeChatAuthAPI.WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0(context.Background()).Phone(phone).OpenId(openId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WeChatAuthAPI.WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WeChatAuthAPI.WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiWechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **string** | User phone number | 
 **openId** | **string** | New WeChat open_id to bind | 

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

