# \MultiModelChatAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ListVendorsApiV1ChatVendorsGet**](MultiModelChatAPI.md#ListVendorsApiV1ChatVendorsGet) | **Get** /api/v1/chat/vendors | 列出支持的 AI 厂商
[**MultiVendorChatApiV1ChatMultiPost**](MultiModelChatAPI.md#MultiVendorChatApiV1ChatMultiPost) | **Post** /api/v1/chat/multi | 同时调用多个厂商并返回结果列表（用于对比评测）
[**VendorChatApiV1ChatVendorChatPost**](MultiModelChatAPI.md#VendorChatApiV1ChatVendorChatPost) | **Post** /api/v1/chat/{vendor}/chat | 多厂商同步聊天
[**VendorChatStreamApiV1ChatVendorChatStreamPost**](MultiModelChatAPI.md#VendorChatStreamApiV1ChatVendorChatStreamPost) | **Post** /api/v1/chat/{vendor}/chat/stream | 多厂商流式聊天（SSE）



## ListVendorsApiV1ChatVendorsGet

> interface{} ListVendorsApiV1ChatVendorsGet(ctx).Execute()

列出支持的 AI 厂商

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
	resp, r, err := apiClient.MultiModelChatAPI.ListVendorsApiV1ChatVendorsGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MultiModelChatAPI.ListVendorsApiV1ChatVendorsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListVendorsApiV1ChatVendorsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MultiModelChatAPI.ListVendorsApiV1ChatVendorsGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListVendorsApiV1ChatVendorsGetRequest struct via the builder pattern


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


## MultiVendorChatApiV1ChatMultiPost

> interface{} MultiVendorChatApiV1ChatMultiPost(ctx).Vendors(vendors).Message(message).Model(model).Execute()

同时调用多个厂商并返回结果列表（用于对比评测）

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
	vendors := "vendors_example" // string | 逗号分隔的厂商列表，如 zhipu,openrouter
	message := "message_example" // string | 
	model := "model_example" // string |  (optional) (default to "gpt-3.5-turbo")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MultiModelChatAPI.MultiVendorChatApiV1ChatMultiPost(context.Background()).Vendors(vendors).Message(message).Model(model).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MultiModelChatAPI.MultiVendorChatApiV1ChatMultiPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MultiVendorChatApiV1ChatMultiPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MultiModelChatAPI.MultiVendorChatApiV1ChatMultiPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiMultiVendorChatApiV1ChatMultiPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **vendors** | **string** | 逗号分隔的厂商列表，如 zhipu,openrouter | 
 **message** | **string** |  | 
 **model** | **string** |  | [default to &quot;gpt-3.5-turbo&quot;]

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


## VendorChatApiV1ChatVendorChatPost

> interface{} VendorChatApiV1ChatVendorChatPost(ctx, vendor).Model(model).Message(message).Execute()

多厂商同步聊天

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
	vendor := "vendor_example" // string | 
	model := "model_example" // string | 
	message := "message_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MultiModelChatAPI.VendorChatApiV1ChatVendorChatPost(context.Background(), vendor).Model(model).Message(message).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MultiModelChatAPI.VendorChatApiV1ChatVendorChatPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `VendorChatApiV1ChatVendorChatPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MultiModelChatAPI.VendorChatApiV1ChatVendorChatPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**vendor** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiVendorChatApiV1ChatVendorChatPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **model** | **string** |  | 
 **message** | **string** |  | 

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


## VendorChatStreamApiV1ChatVendorChatStreamPost

> interface{} VendorChatStreamApiV1ChatVendorChatStreamPost(ctx, vendor).Model(model).Message(message).Execute()

多厂商流式聊天（SSE）

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
	vendor := "vendor_example" // string | 
	model := "model_example" // string | 
	message := "message_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MultiModelChatAPI.VendorChatStreamApiV1ChatVendorChatStreamPost(context.Background(), vendor).Model(model).Message(message).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MultiModelChatAPI.VendorChatStreamApiV1ChatVendorChatStreamPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `VendorChatStreamApiV1ChatVendorChatStreamPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MultiModelChatAPI.VendorChatStreamApiV1ChatVendorChatStreamPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**vendor** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiVendorChatStreamApiV1ChatVendorChatStreamPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **model** | **string** |  | 
 **message** | **string** |  | 

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

