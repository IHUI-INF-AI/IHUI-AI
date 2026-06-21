# \AIJimengAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**Jimeng4ImageApiV1AiJimeng4Post**](AIJimengAPI.md#Jimeng4ImageApiV1AiJimeng4Post) | **Post** /api/v1/ai/jimeng4 | 即梦 4.0 文字生成图片（兼容旧路径）



## Jimeng4ImageApiV1AiJimeng4Post

> interface{} Jimeng4ImageApiV1AiJimeng4Post(ctx).Jimeng4ImageRequest(jimeng4ImageRequest).Execute()

即梦 4.0 文字生成图片（兼容旧路径）



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
	jimeng4ImageRequest := *openapiclient.NewJimeng4ImageRequest("Prompt_example") // Jimeng4ImageRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIJimengAPI.Jimeng4ImageApiV1AiJimeng4Post(context.Background()).Jimeng4ImageRequest(jimeng4ImageRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIJimengAPI.Jimeng4ImageApiV1AiJimeng4Post``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `Jimeng4ImageApiV1AiJimeng4Post`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIJimengAPI.Jimeng4ImageApiV1AiJimeng4Post`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiJimeng4ImageApiV1AiJimeng4PostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **jimeng4ImageRequest** | [**Jimeng4ImageRequest**](Jimeng4ImageRequest.md) |  | 

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

