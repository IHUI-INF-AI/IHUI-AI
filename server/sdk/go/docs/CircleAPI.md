# \CircleAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddCommentApiV1CirclePostPidCommentPost**](CircleAPI.md#AddCommentApiV1CirclePostPidCommentPost) | **Post** /api/v1/circle/post/{pid}/comment | 发表评论
[**CircleCategoryList**](CircleAPI.md#CircleCategoryList) | **Get** /api/v1/circle/category/list | 圈子分类列表
[**CreateCircleApiV1CirclePost**](CircleAPI.md#CreateCircleApiV1CirclePost) | **Post** /api/v1/circle | 创建圈子
[**CreatePostApiV1CirclePostPost**](CircleAPI.md#CreatePostApiV1CirclePostPost) | **Post** /api/v1/circle/post | 发布帖子
[**DeleteCircleApiV1CircleCidDelete**](CircleAPI.md#DeleteCircleApiV1CircleCidDelete) | **Delete** /api/v1/circle/{cid} | 删除圈子
[**DeletePostApiV1CirclePostPidDelete**](CircleAPI.md#DeletePostApiV1CirclePostPidDelete) | **Delete** /api/v1/circle/post/{pid} | 删除帖子
[**GetCircleApiV1CircleCidGet**](CircleAPI.md#GetCircleApiV1CircleCidGet) | **Get** /api/v1/circle/{cid} | 圈子详情
[**GetPostApiV1CirclePostPidGet**](CircleAPI.md#GetPostApiV1CirclePostPidGet) | **Get** /api/v1/circle/post/{pid} | 帖子详情
[**JoinCircleApiV1CircleCidJoinPost**](CircleAPI.md#JoinCircleApiV1CircleCidJoinPost) | **Post** /api/v1/circle/{cid}/join | 加入圈子
[**ListCirclesApiV1CircleListGet**](CircleAPI.md#ListCirclesApiV1CircleListGet) | **Get** /api/v1/circle/list | 圈子列表
[**ListCommentsApiV1CirclePostPidCommentsGet**](CircleAPI.md#ListCommentsApiV1CirclePostPidCommentsGet) | **Get** /api/v1/circle/post/{pid}/comments | 评论列表
[**ListMembersApiV1CircleCidMembersGet**](CircleAPI.md#ListMembersApiV1CircleCidMembersGet) | **Get** /api/v1/circle/{cid}/members | 成员列表
[**ListPostsApiV1CirclePostListGet**](CircleAPI.md#ListPostsApiV1CirclePostListGet) | **Get** /api/v1/circle/post/list | 帖子列表
[**QuitCircleApiV1CircleCidQuitPost**](CircleAPI.md#QuitCircleApiV1CircleCidQuitPost) | **Post** /api/v1/circle/{cid}/quit | 退出圈子
[**ToggleLikeApiV1CirclePostPidLikePost**](CircleAPI.md#ToggleLikeApiV1CirclePostPidLikePost) | **Post** /api/v1/circle/post/{pid}/like | 点赞/取消点赞
[**UpdateCircleApiV1CircleCidPut**](CircleAPI.md#UpdateCircleApiV1CircleCidPut) | **Put** /api/v1/circle/{cid} | 修改圈子
[**UpdatePostApiV1CirclePostPidPut**](CircleAPI.md#UpdatePostApiV1CirclePostPidPut) | **Put** /api/v1/circle/post/{pid} | 修改帖子



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
	resp, r, err := apiClient.CircleAPI.AddCommentApiV1CirclePostPidCommentPost(context.Background(), pid).Content(content).Pid2(pid2).ReplyUserId(replyUserId).ReplyUserName(replyUserName).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleAPI.AddCommentApiV1CirclePostPidCommentPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddCommentApiV1CirclePostPidCommentPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleAPI.AddCommentApiV1CirclePostPidCommentPost`: %v\n", resp)
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


## CircleCategoryList

> interface{} CircleCategoryList(ctx).Execute()

圈子分类列表

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
	resp, r, err := apiClient.CircleAPI.CircleCategoryList(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleAPI.CircleCategoryList``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CircleCategoryList`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleAPI.CircleCategoryList`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCircleCategoryListRequest struct via the builder pattern


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


## CreateCircleApiV1CirclePost

> interface{} CreateCircleApiV1CirclePost(ctx).Name(name).Description(description).CategoryId(categoryId).Avatar(avatar).Cover(cover).Execute()

创建圈子

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
	description := "description_example" // string |  (optional)
	categoryId := int32(56) // int32 |  (optional)
	avatar := "avatar_example" // string |  (optional)
	cover := "cover_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CircleAPI.CreateCircleApiV1CirclePost(context.Background()).Name(name).Description(description).CategoryId(categoryId).Avatar(avatar).Cover(cover).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleAPI.CreateCircleApiV1CirclePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateCircleApiV1CirclePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleAPI.CreateCircleApiV1CirclePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateCircleApiV1CirclePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **description** | **string** |  | 
 **categoryId** | **int32** |  | 
 **avatar** | **string** |  | 
 **cover** | **string** |  | 

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
	resp, r, err := apiClient.CircleAPI.CreatePostApiV1CirclePostPost(context.Background()).CircleId(circleId).Content(content).Images(images).Video(video).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleAPI.CreatePostApiV1CirclePostPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreatePostApiV1CirclePostPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleAPI.CreatePostApiV1CirclePostPost`: %v\n", resp)
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


## DeleteCircleApiV1CircleCidDelete

> interface{} DeleteCircleApiV1CircleCidDelete(ctx, cid).Execute()

删除圈子

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
	resp, r, err := apiClient.CircleAPI.DeleteCircleApiV1CircleCidDelete(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleAPI.DeleteCircleApiV1CircleCidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteCircleApiV1CircleCidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleAPI.DeleteCircleApiV1CircleCidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteCircleApiV1CircleCidDeleteRequest struct via the builder pattern


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
	resp, r, err := apiClient.CircleAPI.DeletePostApiV1CirclePostPidDelete(context.Background(), pid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleAPI.DeletePostApiV1CirclePostPidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeletePostApiV1CirclePostPidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleAPI.DeletePostApiV1CirclePostPidDelete`: %v\n", resp)
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


## GetCircleApiV1CircleCidGet

> interface{} GetCircleApiV1CircleCidGet(ctx, cid).Execute()

圈子详情

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
	resp, r, err := apiClient.CircleAPI.GetCircleApiV1CircleCidGet(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleAPI.GetCircleApiV1CircleCidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetCircleApiV1CircleCidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleAPI.GetCircleApiV1CircleCidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetCircleApiV1CircleCidGetRequest struct via the builder pattern


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
	resp, r, err := apiClient.CircleAPI.GetPostApiV1CirclePostPidGet(context.Background(), pid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleAPI.GetPostApiV1CirclePostPidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetPostApiV1CirclePostPidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleAPI.GetPostApiV1CirclePostPidGet`: %v\n", resp)
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


## JoinCircleApiV1CircleCidJoinPost

> interface{} JoinCircleApiV1CircleCidJoinPost(ctx, cid).Execute()

加入圈子

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
	resp, r, err := apiClient.CircleAPI.JoinCircleApiV1CircleCidJoinPost(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleAPI.JoinCircleApiV1CircleCidJoinPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `JoinCircleApiV1CircleCidJoinPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleAPI.JoinCircleApiV1CircleCidJoinPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiJoinCircleApiV1CircleCidJoinPostRequest struct via the builder pattern


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


## ListCirclesApiV1CircleListGet

> interface{} ListCirclesApiV1CircleListGet(ctx).Page(page).Limit(limit).CategoryId(categoryId).Keyword(keyword).IsOfficial(isOfficial).Execute()

圈子列表

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
	categoryId := int32(56) // int32 |  (optional)
	keyword := "keyword_example" // string |  (optional)
	isOfficial := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CircleAPI.ListCirclesApiV1CircleListGet(context.Background()).Page(page).Limit(limit).CategoryId(categoryId).Keyword(keyword).IsOfficial(isOfficial).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleAPI.ListCirclesApiV1CircleListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListCirclesApiV1CircleListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleAPI.ListCirclesApiV1CircleListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListCirclesApiV1CircleListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **categoryId** | **int32** |  | 
 **keyword** | **string** |  | 
 **isOfficial** | **bool** |  | 

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
	resp, r, err := apiClient.CircleAPI.ListCommentsApiV1CirclePostPidCommentsGet(context.Background(), pid).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleAPI.ListCommentsApiV1CirclePostPidCommentsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListCommentsApiV1CirclePostPidCommentsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleAPI.ListCommentsApiV1CirclePostPidCommentsGet`: %v\n", resp)
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


## ListMembersApiV1CircleCidMembersGet

> interface{} ListMembersApiV1CircleCidMembersGet(ctx, cid).Page(page).Limit(limit).Execute()

成员列表

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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CircleAPI.ListMembersApiV1CircleCidMembersGet(context.Background(), cid).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleAPI.ListMembersApiV1CircleCidMembersGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListMembersApiV1CircleCidMembersGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleAPI.ListMembersApiV1CircleCidMembersGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiListMembersApiV1CircleCidMembersGetRequest struct via the builder pattern


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
	resp, r, err := apiClient.CircleAPI.ListPostsApiV1CirclePostListGet(context.Background()).Page(page).Limit(limit).CircleId(circleId).UserId(userId).Keyword(keyword).OrderBy(orderBy).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleAPI.ListPostsApiV1CirclePostListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListPostsApiV1CirclePostListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleAPI.ListPostsApiV1CirclePostListGet`: %v\n", resp)
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


## QuitCircleApiV1CircleCidQuitPost

> interface{} QuitCircleApiV1CircleCidQuitPost(ctx, cid).Execute()

退出圈子

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
	resp, r, err := apiClient.CircleAPI.QuitCircleApiV1CircleCidQuitPost(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleAPI.QuitCircleApiV1CircleCidQuitPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `QuitCircleApiV1CircleCidQuitPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleAPI.QuitCircleApiV1CircleCidQuitPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiQuitCircleApiV1CircleCidQuitPostRequest struct via the builder pattern


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
	resp, r, err := apiClient.CircleAPI.ToggleLikeApiV1CirclePostPidLikePost(context.Background(), pid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleAPI.ToggleLikeApiV1CirclePostPidLikePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ToggleLikeApiV1CirclePostPidLikePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleAPI.ToggleLikeApiV1CirclePostPidLikePost`: %v\n", resp)
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


## UpdateCircleApiV1CircleCidPut

> interface{} UpdateCircleApiV1CircleCidPut(ctx, cid).Name(name).Description(description).Avatar(avatar).Cover(cover).Execute()

修改圈子

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
	name := "name_example" // string |  (optional)
	description := "description_example" // string |  (optional)
	avatar := "avatar_example" // string |  (optional)
	cover := "cover_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CircleAPI.UpdateCircleApiV1CircleCidPut(context.Background(), cid).Name(name).Description(description).Avatar(avatar).Cover(cover).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleAPI.UpdateCircleApiV1CircleCidPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateCircleApiV1CircleCidPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleAPI.UpdateCircleApiV1CircleCidPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateCircleApiV1CircleCidPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **name** | **string** |  | 
 **description** | **string** |  | 
 **avatar** | **string** |  | 
 **cover** | **string** |  | 

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
	resp, r, err := apiClient.CircleAPI.UpdatePostApiV1CirclePostPidPut(context.Background(), pid).Content(content).Images(images).Video(video).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleAPI.UpdatePostApiV1CirclePostPidPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdatePostApiV1CirclePostPidPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleAPI.UpdatePostApiV1CirclePostPidPut`: %v\n", resp)
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

