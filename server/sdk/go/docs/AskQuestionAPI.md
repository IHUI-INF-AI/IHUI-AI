# \AskQuestionAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AskQuestionAddComment**](AskQuestionAPI.md#AskQuestionAddComment) | **Post** /api/v1/ask/question/comment | 发表评论
[**AskQuestionToggleFavorite**](AskQuestionAPI.md#AskQuestionToggleFavorite) | **Post** /api/v1/ask/question/favorite | 收藏/取消收藏
[**AskQuestionToggleLike**](AskQuestionAPI.md#AskQuestionToggleLike) | **Post** /api/v1/ask/question/like | 点赞/取消点赞
[**CreateQuestionApiV1AskQuestionPost**](AskQuestionAPI.md#CreateQuestionApiV1AskQuestionPost) | **Post** /api/v1/ask/question | 提出问题
[**DeleteQuestionApiV1AskQuestionDelete**](AskQuestionAPI.md#DeleteQuestionApiV1AskQuestionDelete) | **Delete** /api/v1/ask/question | 删除问题
[**GetQuestionApiV1AskQuestionPublicApiGet**](AskQuestionAPI.md#GetQuestionApiV1AskQuestionPublicApiGet) | **Get** /api/v1/ask/question/public-api | 问题详情
[**ListQuestionsApiV1AskQuestionListGet**](AskQuestionAPI.md#ListQuestionsApiV1AskQuestionListGet) | **Get** /api/v1/ask/question/list | 问题列表(需权限)
[**MemberQuestionCountApiV1AskQuestionPublicApiMemberCountGet**](AskQuestionAPI.md#MemberQuestionCountApiV1AskQuestionPublicApiMemberCountGet) | **Get** /api/v1/ask/question/public-api/member/count | 会员问题数
[**PublicListQuestionsApiV1AskQuestionPublicApiListGet**](AskQuestionAPI.md#PublicListQuestionsApiV1AskQuestionPublicApiListGet) | **Get** /api/v1/ask/question/public-api/list | 问题列表(公开)
[**UpdateQuestionApiV1AskQuestionPut**](AskQuestionAPI.md#UpdateQuestionApiV1AskQuestionPut) | **Put** /api/v1/ask/question | 修改问题



## AskQuestionAddComment

> interface{} AskQuestionAddComment(ctx).AppSchemasAskCommentCreate(appSchemasAskCommentCreate).Execute()

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
	appSchemasAskCommentCreate := *openapiclient.NewAppSchemasAskCommentCreate("TargetType_example", int32(123), "Content_example") // AppSchemasAskCommentCreate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskQuestionAPI.AskQuestionAddComment(context.Background()).AppSchemasAskCommentCreate(appSchemasAskCommentCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskQuestionAPI.AskQuestionAddComment``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AskQuestionAddComment`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskQuestionAPI.AskQuestionAddComment`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAskQuestionAddCommentRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **appSchemasAskCommentCreate** | [**AppSchemasAskCommentCreate**](AppSchemasAskCommentCreate.md) |  | 

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


## AskQuestionToggleFavorite

> interface{} AskQuestionToggleFavorite(ctx).TargetType(targetType).TargetId(targetId).Execute()

收藏/取消收藏

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskQuestionAPI.AskQuestionToggleFavorite(context.Background()).TargetType(targetType).TargetId(targetId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskQuestionAPI.AskQuestionToggleFavorite``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AskQuestionToggleFavorite`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskQuestionAPI.AskQuestionToggleFavorite`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAskQuestionToggleFavoriteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **targetType** | **string** |  | 
 **targetId** | **int32** |  | 

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


## AskQuestionToggleLike

> interface{} AskQuestionToggleLike(ctx).TargetType(targetType).TargetId(targetId).Execute()

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
	targetType := "targetType_example" // string | 
	targetId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskQuestionAPI.AskQuestionToggleLike(context.Background()).TargetType(targetType).TargetId(targetId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskQuestionAPI.AskQuestionToggleLike``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AskQuestionToggleLike`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskQuestionAPI.AskQuestionToggleLike`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAskQuestionToggleLikeRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **targetType** | **string** |  | 
 **targetId** | **int32** |  | 

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


## CreateQuestionApiV1AskQuestionPost

> interface{} CreateQuestionApiV1AskQuestionPost(ctx).QuestionCreate(questionCreate).Execute()

提出问题

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
	questionCreate := *openapiclient.NewQuestionCreate("Title_example", "Content_example") // QuestionCreate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskQuestionAPI.CreateQuestionApiV1AskQuestionPost(context.Background()).QuestionCreate(questionCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskQuestionAPI.CreateQuestionApiV1AskQuestionPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateQuestionApiV1AskQuestionPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskQuestionAPI.CreateQuestionApiV1AskQuestionPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateQuestionApiV1AskQuestionPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **questionCreate** | [**QuestionCreate**](QuestionCreate.md) |  | 

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


## DeleteQuestionApiV1AskQuestionDelete

> interface{} DeleteQuestionApiV1AskQuestionDelete(ctx).Id(id).Execute()

删除问题

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
	id := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskQuestionAPI.DeleteQuestionApiV1AskQuestionDelete(context.Background()).Id(id).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskQuestionAPI.DeleteQuestionApiV1AskQuestionDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteQuestionApiV1AskQuestionDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskQuestionAPI.DeleteQuestionApiV1AskQuestionDelete`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteQuestionApiV1AskQuestionDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **int32** |  | 

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


## GetQuestionApiV1AskQuestionPublicApiGet

> interface{} GetQuestionApiV1AskQuestionPublicApiGet(ctx).Id(id).Execute()

问题详情

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
	id := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskQuestionAPI.GetQuestionApiV1AskQuestionPublicApiGet(context.Background()).Id(id).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskQuestionAPI.GetQuestionApiV1AskQuestionPublicApiGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetQuestionApiV1AskQuestionPublicApiGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskQuestionAPI.GetQuestionApiV1AskQuestionPublicApiGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetQuestionApiV1AskQuestionPublicApiGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **int32** |  | 

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


## ListQuestionsApiV1AskQuestionListGet

> interface{} ListQuestionsApiV1AskQuestionListGet(ctx).Page(page).Limit(limit).Keyword(keyword).Status(status).Cid(cid).MemberId(memberId).OrderColumn(orderColumn).OrderDirection(orderDirection).Execute()

问题列表(需权限)

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
	limit := int32(56) // int32 |  (optional) (default to 10)
	keyword := "keyword_example" // string |  (optional)
	status := "status_example" // string |  (optional)
	cid := int32(56) // int32 |  (optional)
	memberId := "memberId_example" // string |  (optional)
	orderColumn := "orderColumn_example" // string |  (optional)
	orderDirection := "orderDirection_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskQuestionAPI.ListQuestionsApiV1AskQuestionListGet(context.Background()).Page(page).Limit(limit).Keyword(keyword).Status(status).Cid(cid).MemberId(memberId).OrderColumn(orderColumn).OrderDirection(orderDirection).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskQuestionAPI.ListQuestionsApiV1AskQuestionListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListQuestionsApiV1AskQuestionListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskQuestionAPI.ListQuestionsApiV1AskQuestionListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListQuestionsApiV1AskQuestionListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 10]
 **keyword** | **string** |  | 
 **status** | **string** |  | 
 **cid** | **int32** |  | 
 **memberId** | **string** |  | 
 **orderColumn** | **string** |  | 
 **orderDirection** | **string** |  | 

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


## MemberQuestionCountApiV1AskQuestionPublicApiMemberCountGet

> interface{} MemberQuestionCountApiV1AskQuestionPublicApiMemberCountGet(ctx).MemberId(memberId).Execute()

会员问题数

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
	memberId := "memberId_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskQuestionAPI.MemberQuestionCountApiV1AskQuestionPublicApiMemberCountGet(context.Background()).MemberId(memberId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskQuestionAPI.MemberQuestionCountApiV1AskQuestionPublicApiMemberCountGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MemberQuestionCountApiV1AskQuestionPublicApiMemberCountGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskQuestionAPI.MemberQuestionCountApiV1AskQuestionPublicApiMemberCountGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiMemberQuestionCountApiV1AskQuestionPublicApiMemberCountGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **memberId** | **string** |  | 

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


## PublicListQuestionsApiV1AskQuestionPublicApiListGet

> interface{} PublicListQuestionsApiV1AskQuestionPublicApiListGet(ctx).Page(page).Limit(limit).Keyword(keyword).Cid(cid).OrderColumn(orderColumn).OrderDirection(orderDirection).Execute()

问题列表(公开)

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
	limit := int32(56) // int32 |  (optional) (default to 10)
	keyword := "keyword_example" // string |  (optional)
	cid := int32(56) // int32 |  (optional)
	orderColumn := "orderColumn_example" // string |  (optional)
	orderDirection := "orderDirection_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskQuestionAPI.PublicListQuestionsApiV1AskQuestionPublicApiListGet(context.Background()).Page(page).Limit(limit).Keyword(keyword).Cid(cid).OrderColumn(orderColumn).OrderDirection(orderDirection).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskQuestionAPI.PublicListQuestionsApiV1AskQuestionPublicApiListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PublicListQuestionsApiV1AskQuestionPublicApiListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskQuestionAPI.PublicListQuestionsApiV1AskQuestionPublicApiListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPublicListQuestionsApiV1AskQuestionPublicApiListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 10]
 **keyword** | **string** |  | 
 **cid** | **int32** |  | 
 **orderColumn** | **string** |  | 
 **orderDirection** | **string** |  | 

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


## UpdateQuestionApiV1AskQuestionPut

> interface{} UpdateQuestionApiV1AskQuestionPut(ctx).QuestionUpdate(questionUpdate).Execute()

修改问题

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
	questionUpdate := *openapiclient.NewQuestionUpdate(int32(123)) // QuestionUpdate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskQuestionAPI.UpdateQuestionApiV1AskQuestionPut(context.Background()).QuestionUpdate(questionUpdate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskQuestionAPI.UpdateQuestionApiV1AskQuestionPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateQuestionApiV1AskQuestionPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskQuestionAPI.UpdateQuestionApiV1AskQuestionPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateQuestionApiV1AskQuestionPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **questionUpdate** | [**QuestionUpdate**](QuestionUpdate.md) |  | 

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

