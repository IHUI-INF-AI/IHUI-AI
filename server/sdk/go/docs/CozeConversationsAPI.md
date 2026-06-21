# \CozeConversationsAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost**](CozeConversationsAPI.md#CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost) | **Post** /api/v1/coze/conversations/conversations/messages/feedback | Create Feedback
[**CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0**](CozeConversationsAPI.md#CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0) | **Post** /api/v1/coze/conversations/conversations/messages/feedback | Create Feedback
[**ListConversationsApiV1CozeConversationsConversationsPost**](CozeConversationsAPI.md#ListConversationsApiV1CozeConversationsConversationsPost) | **Post** /api/v1/coze/conversations/conversations | List Conversations
[**ListConversationsApiV1CozeConversationsConversationsPost_0**](CozeConversationsAPI.md#ListConversationsApiV1CozeConversationsConversationsPost_0) | **Post** /api/v1/coze/conversations/conversations | List Conversations
[**ListMessagesApiV1CozeConversationsConversationsMessagesPost**](CozeConversationsAPI.md#ListMessagesApiV1CozeConversationsConversationsMessagesPost) | **Post** /api/v1/coze/conversations/conversations/messages | List Messages
[**ListMessagesApiV1CozeConversationsConversationsMessagesPost_0**](CozeConversationsAPI.md#ListMessagesApiV1CozeConversationsConversationsMessagesPost_0) | **Post** /api/v1/coze/conversations/conversations/messages | List Messages
[**RetrieveConversationApiV1CozeConversationsConversationsRetrievePost**](CozeConversationsAPI.md#RetrieveConversationApiV1CozeConversationsConversationsRetrievePost) | **Post** /api/v1/coze/conversations/conversations/retrieve | Retrieve Conversation
[**RetrieveConversationApiV1CozeConversationsConversationsRetrievePost_0**](CozeConversationsAPI.md#RetrieveConversationApiV1CozeConversationsConversationsRetrievePost_0) | **Post** /api/v1/coze/conversations/conversations/retrieve | Retrieve Conversation



## CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost

> interface{} CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost(ctx).FeedbackReq(feedbackReq).Execute()

Create Feedback

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
	feedbackReq := *openapiclient.NewFeedbackReq("MessageId_example", "ConversationId_example", "FeedbackType_example") // FeedbackReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeConversationsAPI.CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost(context.Background()).FeedbackReq(feedbackReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeConversationsAPI.CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeConversationsAPI.CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **feedbackReq** | [**FeedbackReq**](FeedbackReq.md) |  | 

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


## CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0

> interface{} CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0(ctx).FeedbackReq(feedbackReq).Execute()

Create Feedback

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
	feedbackReq := *openapiclient.NewFeedbackReq("MessageId_example", "ConversationId_example", "FeedbackType_example") // FeedbackReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeConversationsAPI.CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0(context.Background()).FeedbackReq(feedbackReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeConversationsAPI.CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeConversationsAPI.CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **feedbackReq** | [**FeedbackReq**](FeedbackReq.md) |  | 

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


## ListConversationsApiV1CozeConversationsConversationsPost

> interface{} ListConversationsApiV1CozeConversationsConversationsPost(ctx).ListConvReq(listConvReq).Execute()

List Conversations

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
	listConvReq := *openapiclient.NewListConvReq("BotId_example", "UserId_example") // ListConvReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeConversationsAPI.ListConversationsApiV1CozeConversationsConversationsPost(context.Background()).ListConvReq(listConvReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeConversationsAPI.ListConversationsApiV1CozeConversationsConversationsPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListConversationsApiV1CozeConversationsConversationsPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeConversationsAPI.ListConversationsApiV1CozeConversationsConversationsPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListConversationsApiV1CozeConversationsConversationsPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **listConvReq** | [**ListConvReq**](ListConvReq.md) |  | 

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


## ListConversationsApiV1CozeConversationsConversationsPost_0

> interface{} ListConversationsApiV1CozeConversationsConversationsPost_0(ctx).ListConvReq(listConvReq).Execute()

List Conversations

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
	listConvReq := *openapiclient.NewListConvReq("BotId_example", "UserId_example") // ListConvReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeConversationsAPI.ListConversationsApiV1CozeConversationsConversationsPost_0(context.Background()).ListConvReq(listConvReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeConversationsAPI.ListConversationsApiV1CozeConversationsConversationsPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListConversationsApiV1CozeConversationsConversationsPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeConversationsAPI.ListConversationsApiV1CozeConversationsConversationsPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListConversationsApiV1CozeConversationsConversationsPost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **listConvReq** | [**ListConvReq**](ListConvReq.md) |  | 

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


## ListMessagesApiV1CozeConversationsConversationsMessagesPost

> interface{} ListMessagesApiV1CozeConversationsConversationsMessagesPost(ctx).ListMsgReq(listMsgReq).Execute()

List Messages

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
	listMsgReq := *openapiclient.NewListMsgReq("ConversationId_example") // ListMsgReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeConversationsAPI.ListMessagesApiV1CozeConversationsConversationsMessagesPost(context.Background()).ListMsgReq(listMsgReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeConversationsAPI.ListMessagesApiV1CozeConversationsConversationsMessagesPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListMessagesApiV1CozeConversationsConversationsMessagesPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeConversationsAPI.ListMessagesApiV1CozeConversationsConversationsMessagesPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListMessagesApiV1CozeConversationsConversationsMessagesPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **listMsgReq** | [**ListMsgReq**](ListMsgReq.md) |  | 

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


## ListMessagesApiV1CozeConversationsConversationsMessagesPost_0

> interface{} ListMessagesApiV1CozeConversationsConversationsMessagesPost_0(ctx).ListMsgReq(listMsgReq).Execute()

List Messages

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
	listMsgReq := *openapiclient.NewListMsgReq("ConversationId_example") // ListMsgReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeConversationsAPI.ListMessagesApiV1CozeConversationsConversationsMessagesPost_0(context.Background()).ListMsgReq(listMsgReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeConversationsAPI.ListMessagesApiV1CozeConversationsConversationsMessagesPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListMessagesApiV1CozeConversationsConversationsMessagesPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeConversationsAPI.ListMessagesApiV1CozeConversationsConversationsMessagesPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListMessagesApiV1CozeConversationsConversationsMessagesPost_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **listMsgReq** | [**ListMsgReq**](ListMsgReq.md) |  | 

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


## RetrieveConversationApiV1CozeConversationsConversationsRetrievePost

> interface{} RetrieveConversationApiV1CozeConversationsConversationsRetrievePost(ctx).RetrieveReq(retrieveReq).Execute()

Retrieve Conversation

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
	retrieveReq := *openapiclient.NewRetrieveReq("ConversationId_example") // RetrieveReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeConversationsAPI.RetrieveConversationApiV1CozeConversationsConversationsRetrievePost(context.Background()).RetrieveReq(retrieveReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeConversationsAPI.RetrieveConversationApiV1CozeConversationsConversationsRetrievePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RetrieveConversationApiV1CozeConversationsConversationsRetrievePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeConversationsAPI.RetrieveConversationApiV1CozeConversationsConversationsRetrievePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRetrieveConversationApiV1CozeConversationsConversationsRetrievePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **retrieveReq** | [**RetrieveReq**](RetrieveReq.md) |  | 

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


## RetrieveConversationApiV1CozeConversationsConversationsRetrievePost_0

> interface{} RetrieveConversationApiV1CozeConversationsConversationsRetrievePost_0(ctx).RetrieveReq(retrieveReq).Execute()

Retrieve Conversation

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
	retrieveReq := *openapiclient.NewRetrieveReq("ConversationId_example") // RetrieveReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeConversationsAPI.RetrieveConversationApiV1CozeConversationsConversationsRetrievePost_0(context.Background()).RetrieveReq(retrieveReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeConversationsAPI.RetrieveConversationApiV1CozeConversationsConversationsRetrievePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RetrieveConversationApiV1CozeConversationsConversationsRetrievePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeConversationsAPI.RetrieveConversationApiV1CozeConversationsConversationsRetrievePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRetrieveConversationApiV1CozeConversationsConversationsRetrievePost_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **retrieveReq** | [**RetrieveReq**](RetrieveReq.md) |  | 

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

