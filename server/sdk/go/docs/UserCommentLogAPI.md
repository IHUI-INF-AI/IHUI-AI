# \UserCommentLogAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**RecordLogApiV1UserCommentLogRecordPost**](UserCommentLogAPI.md#RecordLogApiV1UserCommentLogRecordPost) | **Post** /api/v1/user-comment-log/record | 记录评论日志
[**RecordLogApiV1UserCommentLogRecordPost_0**](UserCommentLogAPI.md#RecordLogApiV1UserCommentLogRecordPost_0) | **Post** /api/v1/user-comment-log/record | 记录评论日志
[**UserCommentLogList**](UserCommentLogAPI.md#UserCommentLogList) | **Get** /api/v1/user-comment-log/list | 评论日志
[**UserCommentLogList_0**](UserCommentLogAPI.md#UserCommentLogList_0) | **Get** /api/v1/user-comment-log/list | 评论日志



## RecordLogApiV1UserCommentLogRecordPost

> interface{} RecordLogApiV1UserCommentLogRecordPost(ctx).TargetType(targetType).TargetId(targetId).CommentId(commentId).Content(content).Action(action).Ip(ip).Execute()

记录评论日志

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
	targetType := "targetType_example" // string | 
	targetId := int32(56) // int32 | 
	commentId := int32(56) // int32 | 
	content := "content_example" // string | 
	action := "action_example" // string |  (optional) (default to "add")
	ip := "ip_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserCommentLogAPI.RecordLogApiV1UserCommentLogRecordPost(context.Background()).TargetType(targetType).TargetId(targetId).CommentId(commentId).Content(content).Action(action).Ip(ip).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserCommentLogAPI.RecordLogApiV1UserCommentLogRecordPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RecordLogApiV1UserCommentLogRecordPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserCommentLogAPI.RecordLogApiV1UserCommentLogRecordPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRecordLogApiV1UserCommentLogRecordPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **targetType** | **string** |  | 
 **targetId** | **int32** |  | 
 **commentId** | **int32** |  | 
 **content** | **string** |  | 
 **action** | **string** |  | [default to &quot;add&quot;]
 **ip** | **string** |  | 

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


## RecordLogApiV1UserCommentLogRecordPost_0

> interface{} RecordLogApiV1UserCommentLogRecordPost_0(ctx).TargetType(targetType).TargetId(targetId).CommentId(commentId).Content(content).Action(action).Ip(ip).Execute()

记录评论日志

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
	targetType := "targetType_example" // string | 
	targetId := int32(56) // int32 | 
	commentId := int32(56) // int32 | 
	content := "content_example" // string | 
	action := "action_example" // string |  (optional) (default to "add")
	ip := "ip_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserCommentLogAPI.RecordLogApiV1UserCommentLogRecordPost_0(context.Background()).TargetType(targetType).TargetId(targetId).CommentId(commentId).Content(content).Action(action).Ip(ip).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserCommentLogAPI.RecordLogApiV1UserCommentLogRecordPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RecordLogApiV1UserCommentLogRecordPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserCommentLogAPI.RecordLogApiV1UserCommentLogRecordPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRecordLogApiV1UserCommentLogRecordPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **targetType** | **string** |  | 
 **targetId** | **int32** |  | 
 **commentId** | **int32** |  | 
 **content** | **string** |  | 
 **action** | **string** |  | [default to &quot;add&quot;]
 **ip** | **string** |  | 

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


## UserCommentLogList

> interface{} UserCommentLogList(ctx).Page(page).Limit(limit).UserId(userId).TargetType(targetType).Action(action).Execute()

评论日志

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
	userId := "userId_example" // string |  (optional)
	targetType := "targetType_example" // string |  (optional)
	action := "action_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserCommentLogAPI.UserCommentLogList(context.Background()).Page(page).Limit(limit).UserId(userId).TargetType(targetType).Action(action).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserCommentLogAPI.UserCommentLogList``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UserCommentLogList`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserCommentLogAPI.UserCommentLogList`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUserCommentLogListRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **userId** | **string** |  | 
 **targetType** | **string** |  | 
 **action** | **string** |  | 

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


## UserCommentLogList_0

> interface{} UserCommentLogList_0(ctx).Page(page).Limit(limit).UserId(userId).TargetType(targetType).Action(action).Execute()

评论日志

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
	userId := "userId_example" // string |  (optional)
	targetType := "targetType_example" // string |  (optional)
	action := "action_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserCommentLogAPI.UserCommentLogList_0(context.Background()).Page(page).Limit(limit).UserId(userId).TargetType(targetType).Action(action).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserCommentLogAPI.UserCommentLogList_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UserCommentLogList_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserCommentLogAPI.UserCommentLogList_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUserCommentLogList_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **userId** | **string** |  | 
 **targetType** | **string** |  | 
 **action** | **string** |  | 

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

