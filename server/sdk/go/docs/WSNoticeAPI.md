# \WSNoticeAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**PushNoticeWsNoticePushPost**](WSNoticeAPI.md#PushNoticeWsNoticePushPost) | **Post** /ws/notice/push | 推送实时通知到订阅者



## PushNoticeWsNoticePushPost

> interface{} PushNoticeWsNoticePushPost(ctx).NoticePushReq(noticePushReq).Execute()

推送实时通知到订阅者



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
	noticePushReq := *openapiclient.NewNoticePushReq() // NoticePushReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WSNoticeAPI.PushNoticeWsNoticePushPost(context.Background()).NoticePushReq(noticePushReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSNoticeAPI.PushNoticeWsNoticePushPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PushNoticeWsNoticePushPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSNoticeAPI.PushNoticeWsNoticePushPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPushNoticeWsNoticePushPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **noticePushReq** | [**NoticePushReq**](NoticePushReq.md) |  | 

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

