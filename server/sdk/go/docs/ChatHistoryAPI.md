# \ChatHistoryAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateChatApiV1ChatCreatePost**](ChatHistoryAPI.md#CreateChatApiV1ChatCreatePost) | **Post** /api/v1/chat/create | Create a chat record
[**DeleteChatApiV1ChatChatIdDelete**](ChatHistoryAPI.md#DeleteChatApiV1ChatChatIdDelete) | **Delete** /api/v1/chat/{chat_id} | Delete a chat record
[**QueryChatsApiV1ChatQueryPost**](ChatHistoryAPI.md#QueryChatsApiV1ChatQueryPost) | **Post** /api/v1/chat/query | Query chat records
[**UpdateChatMarkApiV1ChatChatIdMarkPut**](ChatHistoryAPI.md#UpdateChatMarkApiV1ChatChatIdMarkPut) | **Put** /api/v1/chat/{chat_id}/mark | Update chat mark/label



## CreateChatApiV1ChatCreatePost

> interface{} CreateChatApiV1ChatCreatePost(ctx).ChatCreateBody(chatCreateBody).Execute()

Create a chat record



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
	chatCreateBody := *openapiclient.NewChatCreateBody("ModelName_example") // ChatCreateBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ChatHistoryAPI.CreateChatApiV1ChatCreatePost(context.Background()).ChatCreateBody(chatCreateBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatHistoryAPI.CreateChatApiV1ChatCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateChatApiV1ChatCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatHistoryAPI.CreateChatApiV1ChatCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateChatApiV1ChatCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **chatCreateBody** | [**ChatCreateBody**](ChatCreateBody.md) |  | 

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


## DeleteChatApiV1ChatChatIdDelete

> interface{} DeleteChatApiV1ChatChatIdDelete(ctx, chatId).Execute()

Delete a chat record



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
	chatId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ChatHistoryAPI.DeleteChatApiV1ChatChatIdDelete(context.Background(), chatId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatHistoryAPI.DeleteChatApiV1ChatChatIdDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteChatApiV1ChatChatIdDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatHistoryAPI.DeleteChatApiV1ChatChatIdDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**chatId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteChatApiV1ChatChatIdDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## QueryChatsApiV1ChatQueryPost

> interface{} QueryChatsApiV1ChatQueryPost(ctx).ChatQueryBody(chatQueryBody).Page(page).Limit(limit).Execute()

Query chat records



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
	chatQueryBody := *openapiclient.NewChatQueryBody() // ChatQueryBody | 
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ChatHistoryAPI.QueryChatsApiV1ChatQueryPost(context.Background()).ChatQueryBody(chatQueryBody).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatHistoryAPI.QueryChatsApiV1ChatQueryPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `QueryChatsApiV1ChatQueryPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatHistoryAPI.QueryChatsApiV1ChatQueryPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiQueryChatsApiV1ChatQueryPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **chatQueryBody** | [**ChatQueryBody**](ChatQueryBody.md) |  | 
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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


## UpdateChatMarkApiV1ChatChatIdMarkPut

> interface{} UpdateChatMarkApiV1ChatChatIdMarkPut(ctx, chatId).ChatMarkBody(chatMarkBody).Execute()

Update chat mark/label



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
	chatId := int32(56) // int32 | 
	chatMarkBody := *openapiclient.NewChatMarkBody("Mark_example") // ChatMarkBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ChatHistoryAPI.UpdateChatMarkApiV1ChatChatIdMarkPut(context.Background(), chatId).ChatMarkBody(chatMarkBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ChatHistoryAPI.UpdateChatMarkApiV1ChatChatIdMarkPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateChatMarkApiV1ChatChatIdMarkPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ChatHistoryAPI.UpdateChatMarkApiV1ChatChatIdMarkPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**chatId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateChatMarkApiV1ChatChatIdMarkPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **chatMarkBody** | [**ChatMarkBody**](ChatMarkBody.md) |  | 

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

