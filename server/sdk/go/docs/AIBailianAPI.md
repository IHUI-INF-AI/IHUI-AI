# \AIBailianAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**BailianChatApiV1AiBailianChatPost**](AIBailianAPI.md#BailianChatApiV1AiBailianChatPost) | **Post** /api/v1/ai/bailian/chat | 百炼应用对话



## BailianChatApiV1AiBailianChatPost

> interface{} BailianChatApiV1AiBailianChatPost(ctx).BailianChatRequest(bailianChatRequest).Execute()

百炼应用对话



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
	bailianChatRequest := *openapiclient.NewBailianChatRequest("Prompt_example") // BailianChatRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIBailianAPI.BailianChatApiV1AiBailianChatPost(context.Background()).BailianChatRequest(bailianChatRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIBailianAPI.BailianChatApiV1AiBailianChatPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BailianChatApiV1AiBailianChatPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIBailianAPI.BailianChatApiV1AiBailianChatPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiBailianChatApiV1AiBailianChatPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bailianChatRequest** | [**BailianChatRequest**](BailianChatRequest.md) |  | 

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

