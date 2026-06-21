# \BotChatAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ChatWithBotApiV1BotsSendPost**](BotChatAPI.md#ChatWithBotApiV1BotsSendPost) | **Post** /api/v1/bots/send | Send message to bot
[**ListConversationsApiV1BotsConversationsGet**](BotChatAPI.md#ListConversationsApiV1BotsConversationsGet) | **Get** /api/v1/bots/conversations | List conversations
[**ListMessagesApiV1BotsMessagesPost**](BotChatAPI.md#ListMessagesApiV1BotsMessagesPost) | **Post** /api/v1/bots/messages | 消息列表
[**MessageFeedbackApiV1BotsMessagesFeedbackPost**](BotChatAPI.md#MessageFeedbackApiV1BotsMessagesFeedbackPost) | **Post** /api/v1/bots/messages/feedback | 消息反馈
[**RetrieveConversationApiV1BotsRetrievePost**](BotChatAPI.md#RetrieveConversationApiV1BotsRetrievePost) | **Post** /api/v1/bots/retrieve | 检索会话



## ChatWithBotApiV1BotsSendPost

> interface{} ChatWithBotApiV1BotsSendPost(ctx).BotId(botId).Message(message).ConversationId(conversationId).Execute()

Send message to bot

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
	botId := "botId_example" // string | 
	message := "message_example" // string | 
	conversationId := "conversationId_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BotChatAPI.ChatWithBotApiV1BotsSendPost(context.Background()).BotId(botId).Message(message).ConversationId(conversationId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BotChatAPI.ChatWithBotApiV1BotsSendPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ChatWithBotApiV1BotsSendPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `BotChatAPI.ChatWithBotApiV1BotsSendPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiChatWithBotApiV1BotsSendPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **botId** | **string** |  | 
 **message** | **string** |  | 
 **conversationId** | **string** |  | 

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


## ListConversationsApiV1BotsConversationsGet

> interface{} ListConversationsApiV1BotsConversationsGet(ctx).BotId(botId).Page(page).Size(size).Execute()

List conversations

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
	botId := "botId_example" // string | 
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BotChatAPI.ListConversationsApiV1BotsConversationsGet(context.Background()).BotId(botId).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BotChatAPI.ListConversationsApiV1BotsConversationsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListConversationsApiV1BotsConversationsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `BotChatAPI.ListConversationsApiV1BotsConversationsGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListConversationsApiV1BotsConversationsGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **botId** | **string** |  | 
 **page** | **int32** |  | [default to 1]
 **size** | **int32** |  | [default to 20]

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


## ListMessagesApiV1BotsMessagesPost

> interface{} ListMessagesApiV1BotsMessagesPost(ctx).ConversationId(conversationId).BotId(botId).Page(page).Size(size).Execute()

消息列表



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
	conversationId := "conversationId_example" // string | 
	botId := "botId_example" // string |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BotChatAPI.ListMessagesApiV1BotsMessagesPost(context.Background()).ConversationId(conversationId).BotId(botId).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BotChatAPI.ListMessagesApiV1BotsMessagesPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListMessagesApiV1BotsMessagesPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `BotChatAPI.ListMessagesApiV1BotsMessagesPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListMessagesApiV1BotsMessagesPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **conversationId** | **string** |  | 
 **botId** | **string** |  | 
 **page** | **int32** |  | [default to 1]
 **size** | **int32** |  | [default to 20]

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


## MessageFeedbackApiV1BotsMessagesFeedbackPost

> interface{} MessageFeedbackApiV1BotsMessagesFeedbackPost(ctx).MessageId(messageId).ConversationId(conversationId).FeedbackType(feedbackType).Content(content).Execute()

消息反馈



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
	messageId := "messageId_example" // string | 
	conversationId := "conversationId_example" // string | 
	feedbackType := "feedbackType_example" // string | like / dislike
	content := "content_example" // string | 反馈内容 (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BotChatAPI.MessageFeedbackApiV1BotsMessagesFeedbackPost(context.Background()).MessageId(messageId).ConversationId(conversationId).FeedbackType(feedbackType).Content(content).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BotChatAPI.MessageFeedbackApiV1BotsMessagesFeedbackPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MessageFeedbackApiV1BotsMessagesFeedbackPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `BotChatAPI.MessageFeedbackApiV1BotsMessagesFeedbackPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiMessageFeedbackApiV1BotsMessagesFeedbackPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **messageId** | **string** |  | 
 **conversationId** | **string** |  | 
 **feedbackType** | **string** | like / dislike | 
 **content** | **string** | 反馈内容 | [default to &quot;&quot;]

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


## RetrieveConversationApiV1BotsRetrievePost

> interface{} RetrieveConversationApiV1BotsRetrievePost(ctx).ConversationId(conversationId).Execute()

检索会话



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
	conversationId := "conversationId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BotChatAPI.RetrieveConversationApiV1BotsRetrievePost(context.Background()).ConversationId(conversationId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BotChatAPI.RetrieveConversationApiV1BotsRetrievePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RetrieveConversationApiV1BotsRetrievePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `BotChatAPI.RetrieveConversationApiV1BotsRetrievePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRetrieveConversationApiV1BotsRetrievePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **conversationId** | **string** |  | 

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

