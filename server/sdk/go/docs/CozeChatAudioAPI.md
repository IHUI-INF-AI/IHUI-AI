# \CozeChatAudioAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost**](CozeChatAudioAPI.md#OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost) | **Post** /api/v1/coze/chat-audio/chat-audio/one-to-one | One To One Audio
[**OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0**](CozeChatAudioAPI.md#OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0) | **Post** /api/v1/coze/chat-audio/chat-audio/one-to-one | One To One Audio
[**PluginAudioChatApiV1CozeChatAudioChatAudioPluginPost**](CozeChatAudioAPI.md#PluginAudioChatApiV1CozeChatAudioChatAudioPluginPost) | **Post** /api/v1/coze/chat-audio/chat-audio/plugin | Plugin Audio Chat
[**PluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0**](CozeChatAudioAPI.md#PluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0) | **Post** /api/v1/coze/chat-audio/chat-audio/plugin | Plugin Audio Chat
[**SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost**](CozeChatAudioAPI.md#SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost) | **Post** /api/v1/coze/chat-audio/chat-audio/simple | Simple Audio Chat
[**SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0**](CozeChatAudioAPI.md#SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0) | **Post** /api/v1/coze/chat-audio/chat-audio/simple | Simple Audio Chat



## OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost

> interface{} OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost(ctx).OneToOneAudioReq(oneToOneAudioReq).Execute()

One To One Audio

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
	oneToOneAudioReq := *openapiclient.NewOneToOneAudioReq("BotId_example", "UserId_example", "AudioData_example") // OneToOneAudioReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeChatAudioAPI.OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost(context.Background()).OneToOneAudioReq(oneToOneAudioReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeChatAudioAPI.OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeChatAudioAPI.OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiOneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **oneToOneAudioReq** | [**OneToOneAudioReq**](OneToOneAudioReq.md) |  | 

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


## OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0

> interface{} OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0(ctx).OneToOneAudioReq(oneToOneAudioReq).Execute()

One To One Audio

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
	oneToOneAudioReq := *openapiclient.NewOneToOneAudioReq("BotId_example", "UserId_example", "AudioData_example") // OneToOneAudioReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeChatAudioAPI.OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0(context.Background()).OneToOneAudioReq(oneToOneAudioReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeChatAudioAPI.OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeChatAudioAPI.OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiOneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **oneToOneAudioReq** | [**OneToOneAudioReq**](OneToOneAudioReq.md) |  | 

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


## PluginAudioChatApiV1CozeChatAudioChatAudioPluginPost

> interface{} PluginAudioChatApiV1CozeChatAudioChatAudioPluginPost(ctx).PluginAudioReq(pluginAudioReq).Execute()

Plugin Audio Chat

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
	pluginAudioReq := *openapiclient.NewPluginAudioReq("BotId_example", "PluginId_example", "AudioData_example") // PluginAudioReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeChatAudioAPI.PluginAudioChatApiV1CozeChatAudioChatAudioPluginPost(context.Background()).PluginAudioReq(pluginAudioReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeChatAudioAPI.PluginAudioChatApiV1CozeChatAudioChatAudioPluginPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PluginAudioChatApiV1CozeChatAudioChatAudioPluginPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeChatAudioAPI.PluginAudioChatApiV1CozeChatAudioChatAudioPluginPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPluginAudioChatApiV1CozeChatAudioChatAudioPluginPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pluginAudioReq** | [**PluginAudioReq**](PluginAudioReq.md) |  | 

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


## PluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0

> interface{} PluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0(ctx).PluginAudioReq(pluginAudioReq).Execute()

Plugin Audio Chat

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
	pluginAudioReq := *openapiclient.NewPluginAudioReq("BotId_example", "PluginId_example", "AudioData_example") // PluginAudioReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeChatAudioAPI.PluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0(context.Background()).PluginAudioReq(pluginAudioReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeChatAudioAPI.PluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeChatAudioAPI.PluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pluginAudioReq** | [**PluginAudioReq**](PluginAudioReq.md) |  | 

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


## SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost

> interface{} SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost(ctx).SimpleAudioReq(simpleAudioReq).Execute()

Simple Audio Chat

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
	simpleAudioReq := *openapiclient.NewSimpleAudioReq("BotId_example", "AudioData_example") // SimpleAudioReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeChatAudioAPI.SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost(context.Background()).SimpleAudioReq(simpleAudioReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeChatAudioAPI.SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeChatAudioAPI.SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSimpleAudioChatApiV1CozeChatAudioChatAudioSimplePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **simpleAudioReq** | [**SimpleAudioReq**](SimpleAudioReq.md) |  | 

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


## SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0

> interface{} SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0(ctx).SimpleAudioReq(simpleAudioReq).Execute()

Simple Audio Chat

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
	simpleAudioReq := *openapiclient.NewSimpleAudioReq("BotId_example", "AudioData_example") // SimpleAudioReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeChatAudioAPI.SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0(context.Background()).SimpleAudioReq(simpleAudioReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeChatAudioAPI.SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeChatAudioAPI.SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **simpleAudioReq** | [**SimpleAudioReq**](SimpleAudioReq.md) |  | 

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

