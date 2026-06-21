# \CirclePostAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddCommentApiV1CirclePostPidCommentPost**](CirclePostAPI.md#AddCommentApiV1CirclePostPidCommentPost) | **Post** /api/v1/circle/post/{pid}/comment | 发表评论
[**CreatePostApiV1CirclePostPost**](CirclePostAPI.md#CreatePostApiV1CirclePostPost) | **Post** /api/v1/circle/post | 发布帖子
[**DeletePostApiV1CirclePostPidDelete**](CirclePostAPI.md#DeletePostApiV1CirclePostPidDelete) | **Delete** /api/v1/circle/post/{pid} | 删除帖子
[**GetPostApiV1CirclePostPidGet**](CirclePostAPI.md#GetPostApiV1CirclePostPidGet) | **Get** /api/v1/circle/post/{pid} | 帖子详情
[**ListCommentsApiV1CirclePostPidCommentsGet**](CirclePostAPI.md#ListCommentsApiV1CirclePostPidCommentsGet) | **Get** /api/v1/circle/post/{pid}/comments | 评论列表
[**ListPostsApiV1CirclePostListGet**](CirclePostAPI.md#ListPostsApiV1CirclePostListGet) | **Get** /api/v1/circle/post/list | 帖子列表
[**ToggleLikeApiV1CirclePostPidLikePost**](CirclePostAPI.md#ToggleLikeApiV1CirclePostPidLikePost) | **Post** /api/v1/circle/post/{pid}/like | 点赞/取消点赞
[**UpdatePostApiV1CirclePostPidPut**](CirclePostAPI.md#UpdatePostApiV1CirclePostPidPut) | **Put** /api/v1/circle/post/{pid} | 修改帖子



## AddCommentApiV1CirclePostPidCommentPost

> interface{} AddCommentApiV1CirclePostPidCommentPost(ctx, pid).Content(content).Pid2(pid2).ReplyUserId(replyUserId).ReplyUserName(replyUserName).Execute()

发表评论

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
	pid := int32(56) // int32 | 
	content := "content_example" // string | 
	pid2 := int32(56) // int32 |  (optional) (default to 0)
	replyUserId := "replyUserId_example" // string |  (optional)
	replyUserName := "replyUserName_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CirclePostAPI.AddCommentApiV1CirclePostPidCommentPost(context.Background(), pid).Content(content).Pid2(pid2).ReplyUserId(replyUserId).ReplyUserName(replyUserName).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CirclePostAPI.AddCommentApiV1CirclePostPidCommentPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddCommentApiV1CirclePostPidCommentPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CirclePostAPI.AddCommentApiV1CirclePostPidCommentPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiAddCommentApiV1CirclePostPidCommentPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **content** | **string** |  | 
 **pid2** | **int32** |  | [default to 0]
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


## CreatePostApiV1CirclePostPost

> interface{} CreatePostApiV1CirclePostPost(ctx).CircleId(circleId).Content(content).Images(images).Video(video).Execute()

发布帖子

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
	circleId := int32(56) // int32 | 
	content := "content_example" // string | 
	images := "images_example" // string |  (optional)
	video := "video_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CirclePostAPI.CreatePostApiV1CirclePostPost(context.Background()).CircleId(circleId).Content(content).Images(images).Video(video).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CirclePostAPI.CreatePostApiV1CirclePostPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreatePostApiV1CirclePostPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CirclePostAPI.CreatePostApiV1CirclePostPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreatePostApiV1CirclePostPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **circleId** | **int32** |  | 
 **content** | **string** |  | 
 **images** | **string** |  | 
 **video** | **string** |  | 

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


## DeletePostApiV1CirclePostPidDelete

> interface{} DeletePostApiV1CirclePostPidDelete(ctx, pid).Execute()

删除帖子

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
	pid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CirclePostAPI.DeletePostApiV1CirclePostPidDelete(context.Background(), pid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CirclePostAPI.DeletePostApiV1CirclePostPidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeletePostApiV1CirclePostPidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CirclePostAPI.DeletePostApiV1CirclePostPidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeletePostApiV1CirclePostPidDeleteRequest struct via the builder pattern


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


## GetPostApiV1CirclePostPidGet

> interface{} GetPostApiV1CirclePostPidGet(ctx, pid).Execute()

帖子详情

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
	pid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CirclePostAPI.GetPostApiV1CirclePostPidGet(context.Background(), pid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CirclePostAPI.GetPostApiV1CirclePostPidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetPostApiV1CirclePostPidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CirclePostAPI.GetPostApiV1CirclePostPidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetPostApiV1CirclePostPidGetRequest struct via the builder pattern


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


## ListCommentsApiV1CirclePostPidCommentsGet

> interface{} ListCommentsApiV1CirclePostPidCommentsGet(ctx, pid).Page(page).Limit(limit).Execute()

评论列表

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
	pid := int32(56) // int32 | 
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CirclePostAPI.ListCommentsApiV1CirclePostPidCommentsGet(context.Background(), pid).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CirclePostAPI.ListCommentsApiV1CirclePostPidCommentsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListCommentsApiV1CirclePostPidCommentsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CirclePostAPI.ListCommentsApiV1CirclePostPidCommentsGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiListCommentsApiV1CirclePostPidCommentsGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

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


## ListPostsApiV1CirclePostListGet

> interface{} ListPostsApiV1CirclePostListGet(ctx).Page(page).Limit(limit).CircleId(circleId).UserId(userId).Keyword(keyword).OrderBy(orderBy).Execute()

帖子列表

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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)
	circleId := int32(56) // int32 |  (optional)
	userId := "userId_example" // string |  (optional)
	keyword := "keyword_example" // string |  (optional)
	orderBy := "orderBy_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CirclePostAPI.ListPostsApiV1CirclePostListGet(context.Background()).Page(page).Limit(limit).CircleId(circleId).UserId(userId).Keyword(keyword).OrderBy(orderBy).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CirclePostAPI.ListPostsApiV1CirclePostListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListPostsApiV1CirclePostListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CirclePostAPI.ListPostsApiV1CirclePostListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListPostsApiV1CirclePostListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **circleId** | **int32** |  | 
 **userId** | **string** |  | 
 **keyword** | **string** |  | 
 **orderBy** | **string** |  | 

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


## ToggleLikeApiV1CirclePostPidLikePost

> interface{} ToggleLikeApiV1CirclePostPidLikePost(ctx, pid).Execute()

点赞/取消点赞

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
	pid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CirclePostAPI.ToggleLikeApiV1CirclePostPidLikePost(context.Background(), pid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CirclePostAPI.ToggleLikeApiV1CirclePostPidLikePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ToggleLikeApiV1CirclePostPidLikePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CirclePostAPI.ToggleLikeApiV1CirclePostPidLikePost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiToggleLikeApiV1CirclePostPidLikePostRequest struct via the builder pattern


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


## UpdatePostApiV1CirclePostPidPut

> interface{} UpdatePostApiV1CirclePostPidPut(ctx, pid).Content(content).Images(images).Video(video).Execute()

修改帖子

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
	pid := int32(56) // int32 | 
	content := "content_example" // string |  (optional)
	images := "images_example" // string |  (optional)
	video := "video_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CirclePostAPI.UpdatePostApiV1CirclePostPidPut(context.Background(), pid).Content(content).Images(images).Video(video).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CirclePostAPI.UpdatePostApiV1CirclePostPidPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdatePostApiV1CirclePostPidPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CirclePostAPI.UpdatePostApiV1CirclePostPidPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdatePostApiV1CirclePostPidPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **content** | **string** |  | 
 **images** | **string** |  | 
 **video** | **string** |  | 

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

