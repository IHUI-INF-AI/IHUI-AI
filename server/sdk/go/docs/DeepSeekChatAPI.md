# \DeepSeekChatAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**DeepseekChatApiV1ChatChatPost**](DeepSeekChatAPI.md#DeepseekChatApiV1ChatChatPost) | **Post** /api/v1/chat/chat | DeepSeek 同步聊天
[**DeepseekChatStreamApiV1ChatChatStreamPost**](DeepSeekChatAPI.md#DeepseekChatStreamApiV1ChatChatStreamPost) | **Post** /api/v1/chat/chat/stream | DeepSeek 流式聊天（SSE）



## DeepseekChatApiV1ChatChatPost

> interface{} DeepseekChatApiV1ChatChatPost(ctx).Message(message).Model(model).Execute()

DeepSeek 同步聊天

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
	message := "message_example" // string | 
	model := "model_example" // string |  (optional) (default to "deepseek-chat")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.DeepSeekChatAPI.DeepseekChatApiV1ChatChatPost(context.Background()).Message(message).Model(model).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `DeepSeekChatAPI.DeepseekChatApiV1ChatChatPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeepseekChatApiV1ChatChatPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `DeepSeekChatAPI.DeepseekChatApiV1ChatChatPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeepseekChatApiV1ChatChatPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **message** | **string** |  | 
 **model** | **string** |  | [default to &quot;deepseek-chat&quot;]

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


## DeepseekChatStreamApiV1ChatChatStreamPost

> interface{} DeepseekChatStreamApiV1ChatChatStreamPost(ctx).Message(message).Model(model).Execute()

DeepSeek 流式聊天（SSE）

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
	message := "message_example" // string | 
	model := "model_example" // string |  (optional) (default to "deepseek-chat")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.DeepSeekChatAPI.DeepseekChatStreamApiV1ChatChatStreamPost(context.Background()).Message(message).Model(model).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `DeepSeekChatAPI.DeepseekChatStreamApiV1ChatChatStreamPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeepseekChatStreamApiV1ChatChatStreamPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `DeepSeekChatAPI.DeepseekChatStreamApiV1ChatChatStreamPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeepseekChatStreamApiV1ChatChatStreamPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **message** | **string** |  | 
 **model** | **string** |  | [default to &quot;deepseek-chat&quot;]

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

