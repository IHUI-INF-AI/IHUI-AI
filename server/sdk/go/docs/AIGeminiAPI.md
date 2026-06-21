# \AIGeminiAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GeminiChatApiV1AiGeminiChatPost**](AIGeminiAPI.md#GeminiChatApiV1AiGeminiChatPost) | **Post** /api/v1/ai/gemini/chat | Gemini AI 对话 (直接API)
[**GeminiProxyChatApiV1AiGeminiChatCompletionsPost**](AIGeminiAPI.md#GeminiProxyChatApiV1AiGeminiChatCompletionsPost) | **Post** /api/v1/ai/gemini/chat/completions | Gemini AI 对话 (OpenAI兼容代理)



## GeminiChatApiV1AiGeminiChatPost

> interface{} GeminiChatApiV1AiGeminiChatPost(ctx).GeminiChatRequest(geminiChatRequest).Execute()

Gemini AI 对话 (直接API)



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
	geminiChatRequest := *openapiclient.NewGeminiChatRequest([]openapiclient.ChatMessage{*openapiclient.NewChatMessage("Role_example", []map[string]interface{}{map[string]interface{}{"key": interface{}(123)}})}) // GeminiChatRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIGeminiAPI.GeminiChatApiV1AiGeminiChatPost(context.Background()).GeminiChatRequest(geminiChatRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIGeminiAPI.GeminiChatApiV1AiGeminiChatPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GeminiChatApiV1AiGeminiChatPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIGeminiAPI.GeminiChatApiV1AiGeminiChatPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGeminiChatApiV1AiGeminiChatPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **geminiChatRequest** | [**GeminiChatRequest**](GeminiChatRequest.md) |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GeminiProxyChatApiV1AiGeminiChatCompletionsPost

> interface{} GeminiProxyChatApiV1AiGeminiChatCompletionsPost(ctx).Execute()

Gemini AI 对话 (OpenAI兼容代理)



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
	resp, r, err := apiClient.AIGeminiAPI.GeminiProxyChatApiV1AiGeminiChatCompletionsPost(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIGeminiAPI.GeminiProxyChatApiV1AiGeminiChatCompletionsPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GeminiProxyChatApiV1AiGeminiChatCompletionsPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIGeminiAPI.GeminiProxyChatApiV1AiGeminiChatCompletionsPost`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGeminiProxyChatApiV1AiGeminiChatCompletionsPostRequest struct via the builder pattern


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

