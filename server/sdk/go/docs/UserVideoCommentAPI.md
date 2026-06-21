# \UserVideoCommentAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddCommentApiV1UserVideoCommentPost**](UserVideoCommentAPI.md#AddCommentApiV1UserVideoCommentPost) | **Post** /api/v1/user-video-comment | 发表视频评论
[**AddCommentApiV1UserVideoCommentPost_0**](UserVideoCommentAPI.md#AddCommentApiV1UserVideoCommentPost_0) | **Post** /api/v1/user-video-comment | 发表视频评论
[**DeleteCommentApiV1UserVideoCommentCidDelete**](UserVideoCommentAPI.md#DeleteCommentApiV1UserVideoCommentCidDelete) | **Delete** /api/v1/user-video-comment/{cid} | 删除视频评论
[**DeleteCommentApiV1UserVideoCommentCidDelete_0**](UserVideoCommentAPI.md#DeleteCommentApiV1UserVideoCommentCidDelete_0) | **Delete** /api/v1/user-video-comment/{cid} | 删除视频评论
[**ListCommentsApiV1UserVideoCommentListGet**](UserVideoCommentAPI.md#ListCommentsApiV1UserVideoCommentListGet) | **Get** /api/v1/user-video-comment/list | 视频评论列表
[**ListCommentsApiV1UserVideoCommentListGet_0**](UserVideoCommentAPI.md#ListCommentsApiV1UserVideoCommentListGet_0) | **Get** /api/v1/user-video-comment/list | 视频评论列表



## AddCommentApiV1UserVideoCommentPost

> interface{} AddCommentApiV1UserVideoCommentPost(ctx).VideoId(videoId).Content(content).Pid(pid).ReplyUserId(replyUserId).ReplyUserName(replyUserName).Execute()

发表视频评论

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
	videoId := int32(56) // int32 | 
	content := "content_example" // string | 
	pid := int32(56) // int32 |  (optional) (default to 0)
	replyUserId := "replyUserId_example" // string |  (optional)
	replyUserName := "replyUserName_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserVideoCommentAPI.AddCommentApiV1UserVideoCommentPost(context.Background()).VideoId(videoId).Content(content).Pid(pid).ReplyUserId(replyUserId).ReplyUserName(replyUserName).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserVideoCommentAPI.AddCommentApiV1UserVideoCommentPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddCommentApiV1UserVideoCommentPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserVideoCommentAPI.AddCommentApiV1UserVideoCommentPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAddCommentApiV1UserVideoCommentPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **videoId** | **int32** |  | 
 **content** | **string** |  | 
 **pid** | **int32** |  | [default to 0]
 **replyUserId** | **string** |  | 
 **replyUserName** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## AddCommentApiV1UserVideoCommentPost_0

> interface{} AddCommentApiV1UserVideoCommentPost_0(ctx).VideoId(videoId).Content(content).Pid(pid).ReplyUserId(replyUserId).ReplyUserName(replyUserName).Execute()

发表视频评论

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
	videoId := int32(56) // int32 | 
	content := "content_example" // string | 
	pid := int32(56) // int32 |  (optional) (default to 0)
	replyUserId := "replyUserId_example" // string |  (optional)
	replyUserName := "replyUserName_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserVideoCommentAPI.AddCommentApiV1UserVideoCommentPost_0(context.Background()).VideoId(videoId).Content(content).Pid(pid).ReplyUserId(replyUserId).ReplyUserName(replyUserName).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserVideoCommentAPI.AddCommentApiV1UserVideoCommentPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddCommentApiV1UserVideoCommentPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserVideoCommentAPI.AddCommentApiV1UserVideoCommentPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAddCommentApiV1UserVideoCommentPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **videoId** | **int32** |  | 
 **content** | **string** |  | 
 **pid** | **int32** |  | [default to 0]
 **replyUserId** | **string** |  | 
 **replyUserName** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DeleteCommentApiV1UserVideoCommentCidDelete

> interface{} DeleteCommentApiV1UserVideoCommentCidDelete(ctx, cid).Execute()

删除视频评论

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
	cid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserVideoCommentAPI.DeleteCommentApiV1UserVideoCommentCidDelete(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserVideoCommentAPI.DeleteCommentApiV1UserVideoCommentCidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteCommentApiV1UserVideoCommentCidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserVideoCommentAPI.DeleteCommentApiV1UserVideoCommentCidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteCommentApiV1UserVideoCommentCidDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DeleteCommentApiV1UserVideoCommentCidDelete_0

> interface{} DeleteCommentApiV1UserVideoCommentCidDelete_0(ctx, cid).Execute()

删除视频评论

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
	cid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserVideoCommentAPI.DeleteCommentApiV1UserVideoCommentCidDelete_0(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserVideoCommentAPI.DeleteCommentApiV1UserVideoCommentCidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteCommentApiV1UserVideoCommentCidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserVideoCommentAPI.DeleteCommentApiV1UserVideoCommentCidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteCommentApiV1UserVideoCommentCidDelete_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListCommentsApiV1UserVideoCommentListGet

> interface{} ListCommentsApiV1UserVideoCommentListGet(ctx).VideoId(videoId).Page(page).Limit(limit).Execute()

视频评论列表

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
	videoId := int32(56) // int32 | 
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserVideoCommentAPI.ListCommentsApiV1UserVideoCommentListGet(context.Background()).VideoId(videoId).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserVideoCommentAPI.ListCommentsApiV1UserVideoCommentListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListCommentsApiV1UserVideoCommentListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserVideoCommentAPI.ListCommentsApiV1UserVideoCommentListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListCommentsApiV1UserVideoCommentListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **videoId** | **int32** |  | 
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListCommentsApiV1UserVideoCommentListGet_0

> interface{} ListCommentsApiV1UserVideoCommentListGet_0(ctx).VideoId(videoId).Page(page).Limit(limit).Execute()

视频评论列表

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
	videoId := int32(56) // int32 | 
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserVideoCommentAPI.ListCommentsApiV1UserVideoCommentListGet_0(context.Background()).VideoId(videoId).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserVideoCommentAPI.ListCommentsApiV1UserVideoCommentListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListCommentsApiV1UserVideoCommentListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserVideoCommentAPI.ListCommentsApiV1UserVideoCommentListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListCommentsApiV1UserVideoCommentListGet_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **videoId** | **int32** |  | 
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

