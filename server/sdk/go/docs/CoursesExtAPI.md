# \CoursesExtAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**BatchCreateVideosApiV1CoursesVideosBatchPost**](CoursesExtAPI.md#BatchCreateVideosApiV1CoursesVideosBatchPost) | **Post** /api/v1/courses/videos/batch | 批量创建视频
[**BindUserPlatformApiV1CoursesUserPlatformBindPost**](CoursesExtAPI.md#BindUserPlatformApiV1CoursesUserPlatformBindPost) | **Post** /api/v1/courses/user-platform/bind | 用户绑定教育平台
[**CreateCommentApiV1CoursesCommentsCreatePost**](CoursesExtAPI.md#CreateCommentApiV1CoursesCommentsCreatePost) | **Post** /api/v1/courses/comments/create | 提交课程评论
[**CreatePlatformApiV1CoursesPlatformsCreatePost**](CoursesExtAPI.md#CreatePlatformApiV1CoursesPlatformsCreatePost) | **Post** /api/v1/courses/platforms/create | 创建教育平台
[**CreateVideoApiV1CoursesVideosCreatePost**](CoursesExtAPI.md#CreateVideoApiV1CoursesVideosCreatePost) | **Post** /api/v1/courses/videos/create | 创建视频
[**CreateVideoLogApiV1CoursesVideoLogPost**](CoursesExtAPI.md#CreateVideoLogApiV1CoursesVideoLogPost) | **Post** /api/v1/courses/video-log | 记录用户视频观看日志
[**DeleteCommentApiV1CoursesCommentsCommentIdDelete**](CoursesExtAPI.md#DeleteCommentApiV1CoursesCommentsCommentIdDelete) | **Delete** /api/v1/courses/comments/{comment_id} | 删除评论（软删除）
[**DeletePlatformApiV1CoursesPlatformsPlatformIdDelete**](CoursesExtAPI.md#DeletePlatformApiV1CoursesPlatformsPlatformIdDelete) | **Delete** /api/v1/courses/platforms/{platform_id} | 删除教育平台（软删除）
[**DeleteVideoApiV1CoursesVideosVideoIdDelete**](CoursesExtAPI.md#DeleteVideoApiV1CoursesVideosVideoIdDelete) | **Delete** /api/v1/courses/videos/{video_id} | 删除视频
[**GetCategoryParentApiV1CoursesCategoriesCategoryIdParentGet**](CoursesExtAPI.md#GetCategoryParentApiV1CoursesCategoriesCategoryIdParentGet) | **Get** /api/v1/courses/categories/{category_id}/parent | 查询分类的父级链
[**GetCommentParentApiV1CoursesCommentsParentGet**](CoursesExtAPI.md#GetCommentParentApiV1CoursesCommentsParentGet) | **Get** /api/v1/courses/comments/parent | 查询评论的父级评论
[**GetPlatformApiV1CoursesPlatformsCodeGet**](CoursesExtAPI.md#GetPlatformApiV1CoursesPlatformsCodeGet) | **Get** /api/v1/courses/platforms/{code} | 教育平台详情
[**GetVideoApiV1CoursesVideosVideoIdGet**](CoursesExtAPI.md#GetVideoApiV1CoursesVideosVideoIdGet) | **Get** /api/v1/courses/videos/{video_id} | 视频详情
[**IssueVideoApiV1CoursesVideosVideoIdIssuePost**](CoursesExtAPI.md#IssueVideoApiV1CoursesVideosVideoIdIssuePost) | **Post** /api/v1/courses/videos/{video_id}/issue | 视频发布/下架
[**ListCategoriesApiV1CoursesCategoriesGet**](CoursesExtAPI.md#ListCategoriesApiV1CoursesCategoriesGet) | **Get** /api/v1/courses/categories | 课程分类列表
[**ListCommentsApiV1CoursesCommentsGet**](CoursesExtAPI.md#ListCommentsApiV1CoursesCommentsGet) | **Get** /api/v1/courses/comments | 课程评论列表
[**ListOperateLogsApiV1CoursesOperateListGet**](CoursesExtAPI.md#ListOperateLogsApiV1CoursesOperateListGet) | **Get** /api/v1/courses/operate/list | 用户操作日志列表
[**ListPayLogsApiV1CoursesPayLogsGet**](CoursesExtAPI.md#ListPayLogsApiV1CoursesPayLogsGet) | **Get** /api/v1/courses/pay-logs | 课程支付日志列表
[**ListPlatformLogsApiV1CoursesPlatformLogsGet**](CoursesExtAPI.md#ListPlatformLogsApiV1CoursesPlatformLogsGet) | **Get** /api/v1/courses/platform-logs | 平台操作日志列表
[**ListPlatformsApiV1CoursesPlatformsGet**](CoursesExtAPI.md#ListPlatformsApiV1CoursesPlatformsGet) | **Get** /api/v1/courses/platforms | 教育平台列表
[**ListVideoLogsApiV1CoursesVideoLogListGet**](CoursesExtAPI.md#ListVideoLogsApiV1CoursesVideoLogListGet) | **Get** /api/v1/courses/video-log/list | 用户视频观看日志列表
[**ListVideosApiV1CoursesVideosGet**](CoursesExtAPI.md#ListVideosApiV1CoursesVideosGet) | **Get** /api/v1/courses/videos | 课程视频列表
[**MoveVideoApiV1CoursesVideosVideoIdMovePost**](CoursesExtAPI.md#MoveVideoApiV1CoursesVideosVideoIdMovePost) | **Post** /api/v1/courses/videos/{video_id}/move | 移动视频到其他课程
[**MyPlatformsApiV1CoursesUserPlatformMyGet**](CoursesExtAPI.md#MyPlatformsApiV1CoursesUserPlatformMyGet) | **Get** /api/v1/courses/user-platform/my | 我的平台绑定列表
[**MyVideosApiV1CoursesVideosMyGet**](CoursesExtAPI.md#MyVideosApiV1CoursesVideosMyGet) | **Get** /api/v1/courses/videos/my | 我创建的视频
[**PayCourseApiV1CoursesPayPost**](CoursesExtAPI.md#PayCourseApiV1CoursesPayPost) | **Post** /api/v1/courses/pay | 课程支付（先用 token 扣减）
[**UnbindUserPlatformApiV1CoursesUserPlatformUnbindDelete**](CoursesExtAPI.md#UnbindUserPlatformApiV1CoursesUserPlatformUnbindDelete) | **Delete** /api/v1/courses/user-platform/unbind | 用户解绑教育平台
[**UpdatePlatformApiV1CoursesPlatformsPlatformIdPut**](CoursesExtAPI.md#UpdatePlatformApiV1CoursesPlatformsPlatformIdPut) | **Put** /api/v1/courses/platforms/{platform_id} | 更新教育平台
[**UpdateVideoApiV1CoursesVideosVideoIdPut**](CoursesExtAPI.md#UpdateVideoApiV1CoursesVideosVideoIdPut) | **Put** /api/v1/courses/videos/{video_id} | 更新视频



## BatchCreateVideosApiV1CoursesVideosBatchPost

> interface{} BatchCreateVideosApiV1CoursesVideosBatchPost(ctx).VideoBatchCreate(videoBatchCreate).Execute()

批量创建视频

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
	videoBatchCreate := *openapiclient.NewVideoBatchCreate(int32(123), []openapiclient.VideoCreate{*openapiclient.NewVideoCreate(int32(123), "Title_example", "VideoPath_example")}) // VideoBatchCreate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.BatchCreateVideosApiV1CoursesVideosBatchPost(context.Background()).VideoBatchCreate(videoBatchCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.BatchCreateVideosApiV1CoursesVideosBatchPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BatchCreateVideosApiV1CoursesVideosBatchPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.BatchCreateVideosApiV1CoursesVideosBatchPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiBatchCreateVideosApiV1CoursesVideosBatchPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **videoBatchCreate** | [**VideoBatchCreate**](VideoBatchCreate.md) |  | 

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


## BindUserPlatformApiV1CoursesUserPlatformBindPost

> interface{} BindUserPlatformApiV1CoursesUserPlatformBindPost(ctx).UserPlatformBind(userPlatformBind).Execute()

用户绑定教育平台

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
	userPlatformBind := *openapiclient.NewUserPlatformBind(int32(123)) // UserPlatformBind | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.BindUserPlatformApiV1CoursesUserPlatformBindPost(context.Background()).UserPlatformBind(userPlatformBind).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.BindUserPlatformApiV1CoursesUserPlatformBindPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BindUserPlatformApiV1CoursesUserPlatformBindPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.BindUserPlatformApiV1CoursesUserPlatformBindPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiBindUserPlatformApiV1CoursesUserPlatformBindPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **userPlatformBind** | [**UserPlatformBind**](UserPlatformBind.md) |  | 

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


## CreateCommentApiV1CoursesCommentsCreatePost

> interface{} CreateCommentApiV1CoursesCommentsCreatePost(ctx).AppApiV1CoursesCoursesExtCommentCreate(appApiV1CoursesCoursesExtCommentCreate).Execute()

提交课程评论

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
	appApiV1CoursesCoursesExtCommentCreate := *openapiclient.NewAppApiV1CoursesCoursesExtCommentCreate(int32(123), "Content_example") // AppApiV1CoursesCoursesExtCommentCreate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.CreateCommentApiV1CoursesCommentsCreatePost(context.Background()).AppApiV1CoursesCoursesExtCommentCreate(appApiV1CoursesCoursesExtCommentCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.CreateCommentApiV1CoursesCommentsCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateCommentApiV1CoursesCommentsCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.CreateCommentApiV1CoursesCommentsCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateCommentApiV1CoursesCommentsCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **appApiV1CoursesCoursesExtCommentCreate** | [**AppApiV1CoursesCoursesExtCommentCreate**](AppApiV1CoursesCoursesExtCommentCreate.md) |  | 

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


## CreatePlatformApiV1CoursesPlatformsCreatePost

> interface{} CreatePlatformApiV1CoursesPlatformsCreatePost(ctx).PlatformCreate(platformCreate).Execute()

创建教育平台

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
	platformCreate := *openapiclient.NewPlatformCreate("Code_example", "Name_example") // PlatformCreate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.CreatePlatformApiV1CoursesPlatformsCreatePost(context.Background()).PlatformCreate(platformCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.CreatePlatformApiV1CoursesPlatformsCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreatePlatformApiV1CoursesPlatformsCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.CreatePlatformApiV1CoursesPlatformsCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreatePlatformApiV1CoursesPlatformsCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platformCreate** | [**PlatformCreate**](PlatformCreate.md) |  | 

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


## CreateVideoApiV1CoursesVideosCreatePost

> interface{} CreateVideoApiV1CoursesVideosCreatePost(ctx).VideoCreate(videoCreate).Execute()

创建视频

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
	videoCreate := *openapiclient.NewVideoCreate(int32(123), "Title_example", "VideoPath_example") // VideoCreate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.CreateVideoApiV1CoursesVideosCreatePost(context.Background()).VideoCreate(videoCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.CreateVideoApiV1CoursesVideosCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateVideoApiV1CoursesVideosCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.CreateVideoApiV1CoursesVideosCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateVideoApiV1CoursesVideosCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **videoCreate** | [**VideoCreate**](VideoCreate.md) |  | 

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


## CreateVideoLogApiV1CoursesVideoLogPost

> interface{} CreateVideoLogApiV1CoursesVideoLogPost(ctx).VideoId(videoId).CourseId(courseId).Progress(progress).Duration(duration).Execute()

记录用户视频观看日志

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
	courseId := int32(56) // int32 | 
	progress := int32(56) // int32 | 观看进度(秒) (optional) (default to 0)
	duration := int32(56) // int32 | 视频总时长(秒) (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.CreateVideoLogApiV1CoursesVideoLogPost(context.Background()).VideoId(videoId).CourseId(courseId).Progress(progress).Duration(duration).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.CreateVideoLogApiV1CoursesVideoLogPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateVideoLogApiV1CoursesVideoLogPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.CreateVideoLogApiV1CoursesVideoLogPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateVideoLogApiV1CoursesVideoLogPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **videoId** | **int32** |  | 
 **courseId** | **int32** |  | 
 **progress** | **int32** | 观看进度(秒) | [default to 0]
 **duration** | **int32** | 视频总时长(秒) | [default to 0]

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


## DeleteCommentApiV1CoursesCommentsCommentIdDelete

> interface{} DeleteCommentApiV1CoursesCommentsCommentIdDelete(ctx, commentId).Execute()

删除评论（软删除）

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
	commentId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.DeleteCommentApiV1CoursesCommentsCommentIdDelete(context.Background(), commentId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.DeleteCommentApiV1CoursesCommentsCommentIdDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteCommentApiV1CoursesCommentsCommentIdDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.DeleteCommentApiV1CoursesCommentsCommentIdDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**commentId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteCommentApiV1CoursesCommentsCommentIdDeleteRequest struct via the builder pattern


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


## DeletePlatformApiV1CoursesPlatformsPlatformIdDelete

> interface{} DeletePlatformApiV1CoursesPlatformsPlatformIdDelete(ctx, platformId).Execute()

删除教育平台（软删除）

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
	platformId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.DeletePlatformApiV1CoursesPlatformsPlatformIdDelete(context.Background(), platformId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.DeletePlatformApiV1CoursesPlatformsPlatformIdDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeletePlatformApiV1CoursesPlatformsPlatformIdDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.DeletePlatformApiV1CoursesPlatformsPlatformIdDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**platformId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeletePlatformApiV1CoursesPlatformsPlatformIdDeleteRequest struct via the builder pattern


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


## DeleteVideoApiV1CoursesVideosVideoIdDelete

> interface{} DeleteVideoApiV1CoursesVideosVideoIdDelete(ctx, videoId).Execute()

删除视频

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.DeleteVideoApiV1CoursesVideosVideoIdDelete(context.Background(), videoId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.DeleteVideoApiV1CoursesVideosVideoIdDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteVideoApiV1CoursesVideosVideoIdDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.DeleteVideoApiV1CoursesVideosVideoIdDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**videoId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteVideoApiV1CoursesVideosVideoIdDeleteRequest struct via the builder pattern


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


## GetCategoryParentApiV1CoursesCategoriesCategoryIdParentGet

> interface{} GetCategoryParentApiV1CoursesCategoriesCategoryIdParentGet(ctx, categoryId).Execute()

查询分类的父级链



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
	categoryId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.GetCategoryParentApiV1CoursesCategoriesCategoryIdParentGet(context.Background(), categoryId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.GetCategoryParentApiV1CoursesCategoriesCategoryIdParentGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetCategoryParentApiV1CoursesCategoriesCategoryIdParentGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.GetCategoryParentApiV1CoursesCategoriesCategoryIdParentGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**categoryId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetCategoryParentApiV1CoursesCategoriesCategoryIdParentGetRequest struct via the builder pattern


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


## GetCommentParentApiV1CoursesCommentsParentGet

> interface{} GetCommentParentApiV1CoursesCommentsParentGet(ctx).CommentId(commentId).Execute()

查询评论的父级评论



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
	commentId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.GetCommentParentApiV1CoursesCommentsParentGet(context.Background()).CommentId(commentId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.GetCommentParentApiV1CoursesCommentsParentGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetCommentParentApiV1CoursesCommentsParentGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.GetCommentParentApiV1CoursesCommentsParentGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetCommentParentApiV1CoursesCommentsParentGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **commentId** | **int32** |  | 

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


## GetPlatformApiV1CoursesPlatformsCodeGet

> interface{} GetPlatformApiV1CoursesPlatformsCodeGet(ctx, code).Execute()

教育平台详情

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
	code := "code_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.GetPlatformApiV1CoursesPlatformsCodeGet(context.Background(), code).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.GetPlatformApiV1CoursesPlatformsCodeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetPlatformApiV1CoursesPlatformsCodeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.GetPlatformApiV1CoursesPlatformsCodeGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**code** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetPlatformApiV1CoursesPlatformsCodeGetRequest struct via the builder pattern


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


## GetVideoApiV1CoursesVideosVideoIdGet

> interface{} GetVideoApiV1CoursesVideosVideoIdGet(ctx, videoId).Execute()

视频详情

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.GetVideoApiV1CoursesVideosVideoIdGet(context.Background(), videoId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.GetVideoApiV1CoursesVideosVideoIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetVideoApiV1CoursesVideosVideoIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.GetVideoApiV1CoursesVideosVideoIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**videoId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetVideoApiV1CoursesVideosVideoIdGetRequest struct via the builder pattern


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


## IssueVideoApiV1CoursesVideosVideoIdIssuePost

> interface{} IssueVideoApiV1CoursesVideosVideoIdIssuePost(ctx, videoId).Execute()

视频发布/下架

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.IssueVideoApiV1CoursesVideosVideoIdIssuePost(context.Background(), videoId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.IssueVideoApiV1CoursesVideosVideoIdIssuePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `IssueVideoApiV1CoursesVideosVideoIdIssuePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.IssueVideoApiV1CoursesVideosVideoIdIssuePost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**videoId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiIssueVideoApiV1CoursesVideosVideoIdIssuePostRequest struct via the builder pattern


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


## ListCategoriesApiV1CoursesCategoriesGet

> interface{} ListCategoriesApiV1CoursesCategoriesGet(ctx).Status(status).Execute()

课程分类列表

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
	status := int32(56) // int32 | 0 禁用 1 启用 (optional) (default to 1)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.ListCategoriesApiV1CoursesCategoriesGet(context.Background()).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.ListCategoriesApiV1CoursesCategoriesGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListCategoriesApiV1CoursesCategoriesGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.ListCategoriesApiV1CoursesCategoriesGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListCategoriesApiV1CoursesCategoriesGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **status** | **int32** | 0 禁用 1 启用 | [default to 1]

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


## ListCommentsApiV1CoursesCommentsGet

> interface{} ListCommentsApiV1CoursesCommentsGet(ctx).CourseId(courseId).ParentId(parentId).Page(page).Limit(limit).Execute()

课程评论列表

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
	courseId := int32(56) // int32 | 
	parentId := int32(56) // int32 | 父评论 ID，不传则只查顶级 (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.ListCommentsApiV1CoursesCommentsGet(context.Background()).CourseId(courseId).ParentId(parentId).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.ListCommentsApiV1CoursesCommentsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListCommentsApiV1CoursesCommentsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.ListCommentsApiV1CoursesCommentsGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListCommentsApiV1CoursesCommentsGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **courseId** | **int32** |  | 
 **parentId** | **int32** | 父评论 ID，不传则只查顶级 | 
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


## ListOperateLogsApiV1CoursesOperateListGet

> interface{} ListOperateLogsApiV1CoursesOperateListGet(ctx).Type_(type_).UserId(userId).Page(page).Limit(limit).Execute()

用户操作日志列表

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
	type_ := "type__example" // string | 操作类型: comment / pay / video 等 (optional)
	userId := "userId_example" // string |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.ListOperateLogsApiV1CoursesOperateListGet(context.Background()).Type_(type_).UserId(userId).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.ListOperateLogsApiV1CoursesOperateListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListOperateLogsApiV1CoursesOperateListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.ListOperateLogsApiV1CoursesOperateListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListOperateLogsApiV1CoursesOperateListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type_** | **string** | 操作类型: comment / pay / video 等 | 
 **userId** | **string** |  | 
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


## ListPayLogsApiV1CoursesPayLogsGet

> interface{} ListPayLogsApiV1CoursesPayLogsGet(ctx).CourseId(courseId).UserId(userId).Page(page).Limit(limit).Execute()

课程支付日志列表

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
	courseId := int32(56) // int32 |  (optional)
	userId := "userId_example" // string |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.ListPayLogsApiV1CoursesPayLogsGet(context.Background()).CourseId(courseId).UserId(userId).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.ListPayLogsApiV1CoursesPayLogsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListPayLogsApiV1CoursesPayLogsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.ListPayLogsApiV1CoursesPayLogsGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListPayLogsApiV1CoursesPayLogsGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **courseId** | **int32** |  | 
 **userId** | **string** |  | 
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


## ListPlatformLogsApiV1CoursesPlatformLogsGet

> interface{} ListPlatformLogsApiV1CoursesPlatformLogsGet(ctx).PlatformId(platformId).UserId(userId).Page(page).Limit(limit).Execute()

平台操作日志列表

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
	platformId := int32(56) // int32 |  (optional)
	userId := "userId_example" // string |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.ListPlatformLogsApiV1CoursesPlatformLogsGet(context.Background()).PlatformId(platformId).UserId(userId).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.ListPlatformLogsApiV1CoursesPlatformLogsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListPlatformLogsApiV1CoursesPlatformLogsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.ListPlatformLogsApiV1CoursesPlatformLogsGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListPlatformLogsApiV1CoursesPlatformLogsGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platformId** | **int32** |  | 
 **userId** | **string** |  | 
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


## ListPlatformsApiV1CoursesPlatformsGet

> interface{} ListPlatformsApiV1CoursesPlatformsGet(ctx).Status(status).Page(page).Limit(limit).Execute()

教育平台列表

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
	status := int32(56) // int32 |  (optional) (default to 1)
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 100)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.ListPlatformsApiV1CoursesPlatformsGet(context.Background()).Status(status).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.ListPlatformsApiV1CoursesPlatformsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListPlatformsApiV1CoursesPlatformsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.ListPlatformsApiV1CoursesPlatformsGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListPlatformsApiV1CoursesPlatformsGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **status** | **int32** |  | [default to 1]
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 100]

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


## ListVideoLogsApiV1CoursesVideoLogListGet

> interface{} ListVideoLogsApiV1CoursesVideoLogListGet(ctx).CourseId(courseId).Page(page).Limit(limit).Execute()

用户视频观看日志列表

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
	courseId := int32(56) // int32 |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.ListVideoLogsApiV1CoursesVideoLogListGet(context.Background()).CourseId(courseId).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.ListVideoLogsApiV1CoursesVideoLogListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListVideoLogsApiV1CoursesVideoLogListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.ListVideoLogsApiV1CoursesVideoLogListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListVideoLogsApiV1CoursesVideoLogListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **courseId** | **int32** |  | 
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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


## ListVideosApiV1CoursesVideosGet

> interface{} ListVideosApiV1CoursesVideosGet(ctx).CourseId(courseId).IsPay(isPay).Page(page).Limit(limit).Execute()

课程视频列表

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
	courseId := int32(56) // int32 | 
	isPay := int32(56) // int32 | 0 免费 1 付费 (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.ListVideosApiV1CoursesVideosGet(context.Background()).CourseId(courseId).IsPay(isPay).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.ListVideosApiV1CoursesVideosGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListVideosApiV1CoursesVideosGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.ListVideosApiV1CoursesVideosGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListVideosApiV1CoursesVideosGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **courseId** | **int32** |  | 
 **isPay** | **int32** | 0 免费 1 付费 | 
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


## MoveVideoApiV1CoursesVideosVideoIdMovePost

> interface{} MoveVideoApiV1CoursesVideosVideoIdMovePost(ctx, videoId).TargetCourseId(targetCourseId).Execute()

移动视频到其他课程

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
	targetCourseId := int32(56) // int32 | 目标课程 ID

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.MoveVideoApiV1CoursesVideosVideoIdMovePost(context.Background(), videoId).TargetCourseId(targetCourseId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.MoveVideoApiV1CoursesVideosVideoIdMovePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MoveVideoApiV1CoursesVideosVideoIdMovePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.MoveVideoApiV1CoursesVideosVideoIdMovePost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**videoId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiMoveVideoApiV1CoursesVideosVideoIdMovePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **targetCourseId** | **int32** | 目标课程 ID | 

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


## MyPlatformsApiV1CoursesUserPlatformMyGet

> interface{} MyPlatformsApiV1CoursesUserPlatformMyGet(ctx).Execute()

我的平台绑定列表

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
	resp, r, err := apiClient.CoursesExtAPI.MyPlatformsApiV1CoursesUserPlatformMyGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.MyPlatformsApiV1CoursesUserPlatformMyGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MyPlatformsApiV1CoursesUserPlatformMyGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.MyPlatformsApiV1CoursesUserPlatformMyGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiMyPlatformsApiV1CoursesUserPlatformMyGetRequest struct via the builder pattern


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


## MyVideosApiV1CoursesVideosMyGet

> interface{} MyVideosApiV1CoursesVideosMyGet(ctx).Page(page).Limit(limit).Execute()

我创建的视频

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.MyVideosApiV1CoursesVideosMyGet(context.Background()).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.MyVideosApiV1CoursesVideosMyGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MyVideosApiV1CoursesVideosMyGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.MyVideosApiV1CoursesVideosMyGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiMyVideosApiV1CoursesVideosMyGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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


## PayCourseApiV1CoursesPayPost

> interface{} PayCourseApiV1CoursesPayPost(ctx).CourseId(courseId).CostTokens(costTokens).PayType(payType).Execute()

课程支付（先用 token 扣减）

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
	courseId := int32(56) // int32 | 
	costTokens := int32(56) // int32 | 所需 token
	payType := int32(56) // int32 | 0 token 1 微信 2 支付宝 (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.PayCourseApiV1CoursesPayPost(context.Background()).CourseId(courseId).CostTokens(costTokens).PayType(payType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.PayCourseApiV1CoursesPayPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PayCourseApiV1CoursesPayPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.PayCourseApiV1CoursesPayPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPayCourseApiV1CoursesPayPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **courseId** | **int32** |  | 
 **costTokens** | **int32** | 所需 token | 
 **payType** | **int32** | 0 token 1 微信 2 支付宝 | [default to 0]

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


## UnbindUserPlatformApiV1CoursesUserPlatformUnbindDelete

> interface{} UnbindUserPlatformApiV1CoursesUserPlatformUnbindDelete(ctx).PlatformId(platformId).Execute()

用户解绑教育平台

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
	platformId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.UnbindUserPlatformApiV1CoursesUserPlatformUnbindDelete(context.Background()).PlatformId(platformId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.UnbindUserPlatformApiV1CoursesUserPlatformUnbindDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UnbindUserPlatformApiV1CoursesUserPlatformUnbindDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.UnbindUserPlatformApiV1CoursesUserPlatformUnbindDelete`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUnbindUserPlatformApiV1CoursesUserPlatformUnbindDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platformId** | **int32** |  | 

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


## UpdatePlatformApiV1CoursesPlatformsPlatformIdPut

> interface{} UpdatePlatformApiV1CoursesPlatformsPlatformIdPut(ctx, platformId).PlatformUpdate(platformUpdate).Execute()

更新教育平台

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
	platformId := int32(56) // int32 | 
	platformUpdate := *openapiclient.NewPlatformUpdate() // PlatformUpdate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.UpdatePlatformApiV1CoursesPlatformsPlatformIdPut(context.Background(), platformId).PlatformUpdate(platformUpdate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.UpdatePlatformApiV1CoursesPlatformsPlatformIdPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdatePlatformApiV1CoursesPlatformsPlatformIdPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.UpdatePlatformApiV1CoursesPlatformsPlatformIdPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**platformId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdatePlatformApiV1CoursesPlatformsPlatformIdPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **platformUpdate** | [**PlatformUpdate**](PlatformUpdate.md) |  | 

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


## UpdateVideoApiV1CoursesVideosVideoIdPut

> interface{} UpdateVideoApiV1CoursesVideosVideoIdPut(ctx, videoId).VideoUpdate(videoUpdate).Execute()

更新视频

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
	videoUpdate := *openapiclient.NewVideoUpdate() // VideoUpdate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesExtAPI.UpdateVideoApiV1CoursesVideosVideoIdPut(context.Background(), videoId).VideoUpdate(videoUpdate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesExtAPI.UpdateVideoApiV1CoursesVideosVideoIdPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateVideoApiV1CoursesVideosVideoIdPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesExtAPI.UpdateVideoApiV1CoursesVideosVideoIdPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**videoId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateVideoApiV1CoursesVideosVideoIdPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **videoUpdate** | [**VideoUpdate**](VideoUpdate.md) |  | 

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

