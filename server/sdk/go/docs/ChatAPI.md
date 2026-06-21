# \ChatAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ChatWithBillingApiV1ChatChatWithBillingPost**](ChatAPI.md#ChatWithBillingApiV1ChatChatWithBillingPost) | **Post** /api/v1/chat/chat-with-billing | Chat with token billing
[**CreateConversationApiV1ChatConversationCreatePost**](ChatAPI.md#CreateConversationApiV1ChatConversationCreatePost) | **Post** /api/v1/chat/conversation/create | Create Coze conversation
[**CreateDatasetApiV1ChatDatasetsCreatePost**](ChatAPI.md#CreateDatasetApiV1ChatDatasetsCreatePost) | **Post** /api/v1/chat/datasets/create | Create Coze dataset
[**ListConversationsApiV1ChatConversationsListPost**](ChatAPI.md#ListConversationsApiV1ChatConversationsListPost) | **Post** /api/v1/chat/conversations/list | List Coze conversations
[**ListDatasetsApiV1ChatDatasetsListPost**](ChatAPI.md#ListDatasetsApiV1ChatDatasetsListPost) | **Post** /api/v1/chat/datasets/list | List Coze datasets
[**ListDocumentsApiV1ChatDocumentsListPost**](ChatAPI.md#ListDocumentsApiV1ChatDocumentsListPost) | **Post** /api/v1/chat/documents/list | List Coze dataset documents
[**ListMessagesApiV1ChatMessagesListPost**](ChatAPI.md#ListMessagesApiV1ChatMessagesListPost) | **Post** /api/v1/chat/messages/list | List Coze conversation messages
[**MessageFeedbackApiV1ChatMessagesFeedbackPost**](ChatAPI.md#MessageFeedbackApiV1ChatMessagesFeedbackPost) | **Post** /api/v1/chat/messages/feedback | Coze message feedback
[**ResumeWorkflowApiV1ChatWorkflowRunResumePost**](ChatAPI.md#ResumeWorkflowApiV1ChatWorkflowRunResumePost) | **Post** /api/v1/chat/workflow/run/resume | Resume interrupted Coze workflow
[**ResumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost**](ChatAPI.md#ResumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost) | **Post** /api/v1/chat/workflow/run/resume/stream | Resume interrupted Coze workflow (stream)
[**RetrieveConversationApiV1ChatConversationsRetrievePost**](ChatAPI.md#RetrieveConversationApiV1ChatConversationsRetrievePost) | **Post** /api/v1/chat/conversations/retrieve | Retrieve Coze conversation
[**RunWorkflowApiV1ChatWorkflowRunPost**](ChatAPI.md#RunWorkflowApiV1ChatWorkflowRunPost) | **Post** /api/v1/chat/workflow/run | Run Coze workflow (sync)
[**RunWorkflowStreamApiV1ChatWorkflowRunStreamPost**](ChatAPI.md#RunWorkflowStreamApiV1ChatWorkflowRunStreamPost) | **Post** /api/v1/chat/workflow/run/stream | Run Coze workflow (stream)
[**SendMessageApiV1ChatMessagePost**](ChatAPI.md#SendMessageApiV1ChatMessagePost) | **Post** /api/v1/chat/message | Send chat message via Coze (sync)
[**SendMessageStreamApiV1ChatMessageStreamPost**](ChatAPI.md#SendMessageStreamApiV1ChatMessageStreamPost) | **Post** /api/v1/chat/message/stream | Send chat message via Coze (SSE stream)
[**UploadDocumentApiV1ChatDocumentsUploadPost**](ChatAPI.md#UploadDocumentApiV1ChatDocumentsUploadPost) | **Post** /api/v1/chat/documents/upload | Upload document to Coze dataset (multipart)
[**WorkflowHistoryApiV1ChatWorkflowRunHistoryPost**](ChatAPI.md#WorkflowHistoryApiV1ChatWorkflowRunHistoryPost) | **Post** /api/v1/chat/workflow/run/history | Get Coze workflow run history



## ChatWithBillingApiV1ChatChatWithBillingPost

> interface{} ChatWithBillingApiV1ChatChatWithBillingPost(ctx).BotId(botId).Message(message).CostTokens(costTokens).Execute()

Chat with token billing



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
	costTokens := int32(56) // int32 | 本次聊天扣减 token 数 (optional) (default to 100)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ChatAPI.ChatWithBillingApiV1ChatChatWithBillingPost(context.Background()).BotId(botId).Message(message).CostTokens(costTokens).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatAPI.ChatWithBillingApiV1ChatChatWithBillingPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ChatWithBillingApiV1ChatChatWithBillingPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatAPI.ChatWithBillingApiV1ChatChatWithBillingPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiChatWithBillingApiV1ChatChatWithBillingPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **botId** | **string** |  | 
 **message** | **string** |  | 
 **costTokens** | **int32** | 本次聊天扣减 token 数 | [default to 100]

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


## CreateConversationApiV1ChatConversationCreatePost

> interface{} CreateConversationApiV1ChatConversationCreatePost(ctx).BotId(botId).Execute()

Create Coze conversation

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ChatAPI.CreateConversationApiV1ChatConversationCreatePost(context.Background()).BotId(botId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatAPI.CreateConversationApiV1ChatConversationCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateConversationApiV1ChatConversationCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatAPI.CreateConversationApiV1ChatConversationCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateConversationApiV1ChatConversationCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **botId** | **string** |  | 

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


## CreateDatasetApiV1ChatDatasetsCreatePost

> interface{} CreateDatasetApiV1ChatDatasetsCreatePost(ctx).Name(name).SpaceId(spaceId).Execute()

Create Coze dataset



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
	name := "name_example" // string | 
	spaceId := "spaceId_example" // string | Workspace ID, defaults to configured account (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ChatAPI.CreateDatasetApiV1ChatDatasetsCreatePost(context.Background()).Name(name).SpaceId(spaceId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatAPI.CreateDatasetApiV1ChatDatasetsCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateDatasetApiV1ChatDatasetsCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatAPI.CreateDatasetApiV1ChatDatasetsCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateDatasetApiV1ChatDatasetsCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **spaceId** | **string** | Workspace ID, defaults to configured account | [default to &quot;&quot;]

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


## ListConversationsApiV1ChatConversationsListPost

> interface{} ListConversationsApiV1ChatConversationsListPost(ctx).BotId(botId).UserId(userId).Page(page).Size(size).Execute()

List Coze conversations



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
	userId := "userId_example" // string | 
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ChatAPI.ListConversationsApiV1ChatConversationsListPost(context.Background()).BotId(botId).UserId(userId).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatAPI.ListConversationsApiV1ChatConversationsListPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListConversationsApiV1ChatConversationsListPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatAPI.ListConversationsApiV1ChatConversationsListPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListConversationsApiV1ChatConversationsListPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **botId** | **string** |  | 
 **userId** | **string** |  | 
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


## ListDatasetsApiV1ChatDatasetsListPost

> interface{} ListDatasetsApiV1ChatDatasetsListPost(ctx).SpaceId(spaceId).Page(page).Size(size).Execute()

List Coze datasets



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
	spaceId := "spaceId_example" // string | Workspace ID (optional) (default to "")
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ChatAPI.ListDatasetsApiV1ChatDatasetsListPost(context.Background()).SpaceId(spaceId).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatAPI.ListDatasetsApiV1ChatDatasetsListPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDatasetsApiV1ChatDatasetsListPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatAPI.ListDatasetsApiV1ChatDatasetsListPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDatasetsApiV1ChatDatasetsListPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **spaceId** | **string** | Workspace ID | [default to &quot;&quot;]
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


## ListDocumentsApiV1ChatDocumentsListPost

> interface{} ListDocumentsApiV1ChatDocumentsListPost(ctx).DatasetId(datasetId).Page(page).Size(size).Execute()

List Coze dataset documents



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
	datasetId := "datasetId_example" // string | 
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ChatAPI.ListDocumentsApiV1ChatDocumentsListPost(context.Background()).DatasetId(datasetId).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatAPI.ListDocumentsApiV1ChatDocumentsListPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDocumentsApiV1ChatDocumentsListPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatAPI.ListDocumentsApiV1ChatDocumentsListPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDocumentsApiV1ChatDocumentsListPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **datasetId** | **string** |  | 
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


## ListMessagesApiV1ChatMessagesListPost

> interface{} ListMessagesApiV1ChatMessagesListPost(ctx).ConversationId(conversationId).BotId(botId).Page(page).Size(size).Execute()

List Coze conversation messages



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
	botId := "botId_example" // string |  (optional) (default to "")
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ChatAPI.ListMessagesApiV1ChatMessagesListPost(context.Background()).ConversationId(conversationId).BotId(botId).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatAPI.ListMessagesApiV1ChatMessagesListPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListMessagesApiV1ChatMessagesListPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatAPI.ListMessagesApiV1ChatMessagesListPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListMessagesApiV1ChatMessagesListPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **conversationId** | **string** |  | 
 **botId** | **string** |  | [default to &quot;&quot;]
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


## MessageFeedbackApiV1ChatMessagesFeedbackPost

> interface{} MessageFeedbackApiV1ChatMessagesFeedbackPost(ctx).MessageId(messageId).ConversationId(conversationId).FeedbackType(feedbackType).Content(content).Execute()

Coze message feedback



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
	content := "content_example" // string |  (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ChatAPI.MessageFeedbackApiV1ChatMessagesFeedbackPost(context.Background()).MessageId(messageId).ConversationId(conversationId).FeedbackType(feedbackType).Content(content).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatAPI.MessageFeedbackApiV1ChatMessagesFeedbackPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MessageFeedbackApiV1ChatMessagesFeedbackPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatAPI.MessageFeedbackApiV1ChatMessagesFeedbackPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiMessageFeedbackApiV1ChatMessagesFeedbackPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **messageId** | **string** |  | 
 **conversationId** | **string** |  | 
 **feedbackType** | **string** | like / dislike | 
 **content** | **string** |  | [default to &quot;&quot;]

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


## ResumeWorkflowApiV1ChatWorkflowRunResumePost

> interface{} ResumeWorkflowApiV1ChatWorkflowRunResumePost(ctx).WorkflowId(workflowId).EventId(eventId).InterruptType(interruptType).ResumeData(resumeData).Execute()

Resume interrupted Coze workflow



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
	workflowId := "workflowId_example" // string | 
	eventId := "eventId_example" // string | 
	interruptType := "interruptType_example" // string | 
	resumeData := "resumeData_example" // string | JSON string (optional) (default to "{}")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ChatAPI.ResumeWorkflowApiV1ChatWorkflowRunResumePost(context.Background()).WorkflowId(workflowId).EventId(eventId).InterruptType(interruptType).ResumeData(resumeData).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatAPI.ResumeWorkflowApiV1ChatWorkflowRunResumePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ResumeWorkflowApiV1ChatWorkflowRunResumePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatAPI.ResumeWorkflowApiV1ChatWorkflowRunResumePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiResumeWorkflowApiV1ChatWorkflowRunResumePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflowId** | **string** |  | 
 **eventId** | **string** |  | 
 **interruptType** | **string** |  | 
 **resumeData** | **string** | JSON string | [default to &quot;{}&quot;]

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


## ResumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost

> interface{} ResumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost(ctx).WorkflowId(workflowId).EventId(eventId).InterruptType(interruptType).ResumeData(resumeData).Execute()

Resume interrupted Coze workflow (stream)



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
	workflowId := "workflowId_example" // string | 
	eventId := "eventId_example" // string | 
	interruptType := "interruptType_example" // string | 
	resumeData := "resumeData_example" // string | JSON string (optional) (default to "{}")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ChatAPI.ResumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost(context.Background()).WorkflowId(workflowId).EventId(eventId).InterruptType(interruptType).ResumeData(resumeData).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatAPI.ResumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ResumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatAPI.ResumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiResumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflowId** | **string** |  | 
 **eventId** | **string** |  | 
 **interruptType** | **string** |  | 
 **resumeData** | **string** | JSON string | [default to &quot;{}&quot;]

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


## RetrieveConversationApiV1ChatConversationsRetrievePost

> interface{} RetrieveConversationApiV1ChatConversationsRetrievePost(ctx).ConversationId(conversationId).Execute()

Retrieve Coze conversation



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
	resp, r, err := apiClient.ChatAPI.RetrieveConversationApiV1ChatConversationsRetrievePost(context.Background()).ConversationId(conversationId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatAPI.RetrieveConversationApiV1ChatConversationsRetrievePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RetrieveConversationApiV1ChatConversationsRetrievePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatAPI.RetrieveConversationApiV1ChatConversationsRetrievePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRetrieveConversationApiV1ChatConversationsRetrievePostRequest struct via the builder pattern


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


## RunWorkflowApiV1ChatWorkflowRunPost

> interface{} RunWorkflowApiV1ChatWorkflowRunPost(ctx).WorkflowId(workflowId).Parameters(parameters).Execute()

Run Coze workflow (sync)

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
	workflowId := "workflowId_example" // string | 
	parameters := "parameters_example" // string | JSON 字符串 (optional) (default to "{}")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ChatAPI.RunWorkflowApiV1ChatWorkflowRunPost(context.Background()).WorkflowId(workflowId).Parameters(parameters).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatAPI.RunWorkflowApiV1ChatWorkflowRunPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RunWorkflowApiV1ChatWorkflowRunPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatAPI.RunWorkflowApiV1ChatWorkflowRunPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRunWorkflowApiV1ChatWorkflowRunPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflowId** | **string** |  | 
 **parameters** | **string** | JSON 字符串 | [default to &quot;{}&quot;]

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


## RunWorkflowStreamApiV1ChatWorkflowRunStreamPost

> interface{} RunWorkflowStreamApiV1ChatWorkflowRunStreamPost(ctx).WorkflowId(workflowId).Parameters(parameters).Execute()

Run Coze workflow (stream)

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
	workflowId := "workflowId_example" // string | 
	parameters := "parameters_example" // string |  (optional) (default to "{}")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ChatAPI.RunWorkflowStreamApiV1ChatWorkflowRunStreamPost(context.Background()).WorkflowId(workflowId).Parameters(parameters).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatAPI.RunWorkflowStreamApiV1ChatWorkflowRunStreamPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RunWorkflowStreamApiV1ChatWorkflowRunStreamPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatAPI.RunWorkflowStreamApiV1ChatWorkflowRunStreamPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRunWorkflowStreamApiV1ChatWorkflowRunStreamPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflowId** | **string** |  | 
 **parameters** | **string** |  | [default to &quot;{}&quot;]

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


## SendMessageApiV1ChatMessagePost

> interface{} SendMessageApiV1ChatMessagePost(ctx).BotId(botId).Message(message).ConversationId(conversationId).Execute()

Send chat message via Coze (sync)

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
	resp, r, err := apiClient.ChatAPI.SendMessageApiV1ChatMessagePost(context.Background()).BotId(botId).Message(message).ConversationId(conversationId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatAPI.SendMessageApiV1ChatMessagePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SendMessageApiV1ChatMessagePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatAPI.SendMessageApiV1ChatMessagePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSendMessageApiV1ChatMessagePostRequest struct via the builder pattern


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


## SendMessageStreamApiV1ChatMessageStreamPost

> interface{} SendMessageStreamApiV1ChatMessageStreamPost(ctx).BotId(botId).Message(message).ConversationId(conversationId).Execute()

Send chat message via Coze (SSE stream)



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
	resp, r, err := apiClient.ChatAPI.SendMessageStreamApiV1ChatMessageStreamPost(context.Background()).BotId(botId).Message(message).ConversationId(conversationId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatAPI.SendMessageStreamApiV1ChatMessageStreamPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SendMessageStreamApiV1ChatMessageStreamPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatAPI.SendMessageStreamApiV1ChatMessageStreamPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSendMessageStreamApiV1ChatMessageStreamPostRequest struct via the builder pattern


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


## UploadDocumentApiV1ChatDocumentsUploadPost

> interface{} UploadDocumentApiV1ChatDocumentsUploadPost(ctx).DatasetId(datasetId).DocumentName(documentName).Upload(upload).Execute()

Upload document to Coze dataset (multipart)



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
	datasetId := "datasetId_example" // string | 
	documentName := "documentName_example" // string | 
	upload := os.NewFile(1234, "some_file") // *os.File | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ChatAPI.UploadDocumentApiV1ChatDocumentsUploadPost(context.Background()).DatasetId(datasetId).DocumentName(documentName).Upload(upload).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatAPI.UploadDocumentApiV1ChatDocumentsUploadPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UploadDocumentApiV1ChatDocumentsUploadPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatAPI.UploadDocumentApiV1ChatDocumentsUploadPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUploadDocumentApiV1ChatDocumentsUploadPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **datasetId** | **string** |  | 
 **documentName** | **string** |  | 
 **upload** | ***os.File** |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## WorkflowHistoryApiV1ChatWorkflowRunHistoryPost

> interface{} WorkflowHistoryApiV1ChatWorkflowRunHistoryPost(ctx).WorkflowId(workflowId).ExecuteId(executeId).Execute()

Get Coze workflow run history



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
	workflowId := "workflowId_example" // string | 
	executeId := "executeId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ChatAPI.WorkflowHistoryApiV1ChatWorkflowRunHistoryPost(context.Background()).WorkflowId(workflowId).ExecuteId(executeId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatAPI.WorkflowHistoryApiV1ChatWorkflowRunHistoryPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `WorkflowHistoryApiV1ChatWorkflowRunHistoryPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatAPI.WorkflowHistoryApiV1ChatWorkflowRunHistoryPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiWorkflowHistoryApiV1ChatWorkflowRunHistoryPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflowId** | **string** |  | 
 **executeId** | **string** |  | 

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

