# \AskAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddCategoryApiV1AskCategoryPost**](AskAPI.md#AddCategoryApiV1AskCategoryPost) | **Post** /api/v1/ask/category | 添加分类
[**AdoptAnswerApiV1AskAnswerAdoptPut**](AskAPI.md#AdoptAnswerApiV1AskAnswerAdoptPut) | **Put** /api/v1/ask/answer/adopt | 采纳回答
[**AskCategoryAdminList**](AskAPI.md#AskCategoryAdminList) | **Get** /api/v1/ask/category/admin/list | 分类列表(管理员)
[**AskQuestionAddComment**](AskAPI.md#AskQuestionAddComment) | **Post** /api/v1/ask/question/comment | 发表评论
[**AskQuestionToggleFavorite**](AskAPI.md#AskQuestionToggleFavorite) | **Post** /api/v1/ask/question/favorite | 收藏/取消收藏
[**AskQuestionToggleLike**](AskAPI.md#AskQuestionToggleLike) | **Post** /api/v1/ask/question/like | 点赞/取消点赞
[**ChangeShowApiV1AskCategoryIsShowPut**](AskAPI.md#ChangeShowApiV1AskCategoryIsShowPut) | **Put** /api/v1/ask/category/is-show | 修改显示状态
[**ChangeShowIndexApiV1AskCategoryIsShowIndexPut**](AskAPI.md#ChangeShowIndexApiV1AskCategoryIsShowIndexPut) | **Put** /api/v1/ask/category/is-show-index | 修改首页显示状态
[**CreateAnswerApiV1AskAnswerPost**](AskAPI.md#CreateAnswerApiV1AskAnswerPost) | **Post** /api/v1/ask/answer | 提出回答
[**CreateQuestionApiV1AskQuestionPost**](AskAPI.md#CreateQuestionApiV1AskQuestionPost) | **Post** /api/v1/ask/question | 提出问题
[**DeleteAnswerApiV1AskAnswerDelete**](AskAPI.md#DeleteAnswerApiV1AskAnswerDelete) | **Delete** /api/v1/ask/answer | 删除回答
[**DeleteCategoryApiV1AskCategoryCatIdDelete**](AskAPI.md#DeleteCategoryApiV1AskCategoryCatIdDelete) | **Delete** /api/v1/ask/category/{cat_id} | 删除分类
[**DeleteQuestionApiV1AskQuestionDelete**](AskAPI.md#DeleteQuestionApiV1AskQuestionDelete) | **Delete** /api/v1/ask/question | 删除问题
[**GetAnswerApiV1AskAnswerPublicApiGet**](AskAPI.md#GetAnswerApiV1AskAnswerPublicApiGet) | **Get** /api/v1/ask/answer/public-api | 回答详情
[**GetCategoryApiV1AskCategoryCatIdGet**](AskAPI.md#GetCategoryApiV1AskCategoryCatIdGet) | **Get** /api/v1/ask/category/{cat_id} | 分类详情
[**GetQuestionApiV1AskQuestionPublicApiGet**](AskAPI.md#GetQuestionApiV1AskQuestionPublicApiGet) | **Get** /api/v1/ask/question/public-api | 问题详情
[**ListAnswersApiV1AskAnswerListGet**](AskAPI.md#ListAnswersApiV1AskAnswerListGet) | **Get** /api/v1/ask/answer/list | 回答列表(需权限)
[**ListQuestionsApiV1AskQuestionListGet**](AskAPI.md#ListQuestionsApiV1AskQuestionListGet) | **Get** /api/v1/ask/question/list | 问题列表(需权限)
[**MemberAnswerCountApiV1AskAnswerPublicApiMemberCountGet**](AskAPI.md#MemberAnswerCountApiV1AskAnswerPublicApiMemberCountGet) | **Get** /api/v1/ask/answer/public-api/member/count | 会员回答数
[**MemberQuestionCountApiV1AskQuestionPublicApiMemberCountGet**](AskAPI.md#MemberQuestionCountApiV1AskQuestionPublicApiMemberCountGet) | **Get** /api/v1/ask/question/public-api/member/count | 会员问题数
[**PublicListAnswersApiV1AskAnswerPublicApiListGet**](AskAPI.md#PublicListAnswersApiV1AskAnswerPublicApiListGet) | **Get** /api/v1/ask/answer/public-api/list | 回答列表(公开)
[**PublicListApiV1AskCategoryPublicApiListGet**](AskAPI.md#PublicListApiV1AskCategoryPublicApiListGet) | **Get** /api/v1/ask/category/public-api/list | 分类列表(公开)
[**PublicListQuestionsApiV1AskQuestionPublicApiListGet**](AskAPI.md#PublicListQuestionsApiV1AskQuestionPublicApiListGet) | **Get** /api/v1/ask/question/public-api/list | 问题列表(公开)
[**UpdateAnswerApiV1AskAnswerPut**](AskAPI.md#UpdateAnswerApiV1AskAnswerPut) | **Put** /api/v1/ask/answer | 修改回答
[**UpdateCategoryApiV1AskCategoryPut**](AskAPI.md#UpdateCategoryApiV1AskCategoryPut) | **Put** /api/v1/ask/category | 修改分类
[**UpdateQuestionApiV1AskQuestionPut**](AskAPI.md#UpdateQuestionApiV1AskQuestionPut) | **Put** /api/v1/ask/question | 修改问题



## AddCategoryApiV1AskCategoryPost

> interface{} AddCategoryApiV1AskCategoryPost(ctx).CategoryCreate(categoryCreate).Execute()

添加分类

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
	categoryCreate := *openapiclient.NewCategoryCreate("Name_example") // CategoryCreate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskAPI.AddCategoryApiV1AskCategoryPost(context.Background()).CategoryCreate(categoryCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.AddCategoryApiV1AskCategoryPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddCategoryApiV1AskCategoryPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.AddCategoryApiV1AskCategoryPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAddCategoryApiV1AskCategoryPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **categoryCreate** | [**CategoryCreate**](CategoryCreate.md) |  | 

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


## AdoptAnswerApiV1AskAnswerAdoptPut

> interface{} AdoptAnswerApiV1AskAnswerAdoptPut(ctx).Id(id).Execute()

采纳回答

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
	resp, r, err := apiClient.AskAPI.AdoptAnswerApiV1AskAnswerAdoptPut(context.Background()).Id(id).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.AdoptAnswerApiV1AskAnswerAdoptPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AdoptAnswerApiV1AskAnswerAdoptPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.AdoptAnswerApiV1AskAnswerAdoptPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAdoptAnswerApiV1AskAnswerAdoptPutRequest struct via the builder pattern


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


## AskCategoryAdminList

> interface{} AskCategoryAdminList(ctx).IsShow(isShow).IsShowIndex(isShowIndex).Execute()

分类列表(管理员)

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
	isShow := true // bool |  (optional)
	isShowIndex := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskAPI.AskCategoryAdminList(context.Background()).IsShow(isShow).IsShowIndex(isShowIndex).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.AskCategoryAdminList``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AskCategoryAdminList`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.AskCategoryAdminList`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAskCategoryAdminListRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **isShow** | **bool** |  | 
 **isShowIndex** | **bool** |  | 

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
	resp, r, err := apiClient.AskAPI.AskQuestionAddComment(context.Background()).AppSchemasAskCommentCreate(appSchemasAskCommentCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.AskQuestionAddComment``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AskQuestionAddComment`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.AskQuestionAddComment`: %v\n", resp)
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
	resp, r, err := apiClient.AskAPI.AskQuestionToggleFavorite(context.Background()).TargetType(targetType).TargetId(targetId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.AskQuestionToggleFavorite``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AskQuestionToggleFavorite`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.AskQuestionToggleFavorite`: %v\n", resp)
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
	resp, r, err := apiClient.AskAPI.AskQuestionToggleLike(context.Background()).TargetType(targetType).TargetId(targetId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.AskQuestionToggleLike``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AskQuestionToggleLike`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.AskQuestionToggleLike`: %v\n", resp)
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


## ChangeShowApiV1AskCategoryIsShowPut

> interface{} ChangeShowApiV1AskCategoryIsShowPut(ctx).Id(id).IsShow(isShow).Execute()

修改显示状态

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
	isShow := true // bool | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskAPI.ChangeShowApiV1AskCategoryIsShowPut(context.Background()).Id(id).IsShow(isShow).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.ChangeShowApiV1AskCategoryIsShowPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ChangeShowApiV1AskCategoryIsShowPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.ChangeShowApiV1AskCategoryIsShowPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiChangeShowApiV1AskCategoryIsShowPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **int32** |  | 
 **isShow** | **bool** |  | 

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


## ChangeShowIndexApiV1AskCategoryIsShowIndexPut

> interface{} ChangeShowIndexApiV1AskCategoryIsShowIndexPut(ctx).Id(id).IsShowIndex(isShowIndex).Execute()

修改首页显示状态

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
	isShowIndex := true // bool | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskAPI.ChangeShowIndexApiV1AskCategoryIsShowIndexPut(context.Background()).Id(id).IsShowIndex(isShowIndex).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.ChangeShowIndexApiV1AskCategoryIsShowIndexPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ChangeShowIndexApiV1AskCategoryIsShowIndexPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.ChangeShowIndexApiV1AskCategoryIsShowIndexPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiChangeShowIndexApiV1AskCategoryIsShowIndexPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **int32** |  | 
 **isShowIndex** | **bool** |  | 

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


## CreateAnswerApiV1AskAnswerPost

> interface{} CreateAnswerApiV1AskAnswerPost(ctx).AnswerCreate(answerCreate).Execute()

提出回答

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
	answerCreate := *openapiclient.NewAnswerCreate(int32(123), "Content_example") // AnswerCreate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskAPI.CreateAnswerApiV1AskAnswerPost(context.Background()).AnswerCreate(answerCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.CreateAnswerApiV1AskAnswerPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateAnswerApiV1AskAnswerPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.CreateAnswerApiV1AskAnswerPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateAnswerApiV1AskAnswerPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **answerCreate** | [**AnswerCreate**](AnswerCreate.md) |  | 

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
	resp, r, err := apiClient.AskAPI.CreateQuestionApiV1AskQuestionPost(context.Background()).QuestionCreate(questionCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.CreateQuestionApiV1AskQuestionPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateQuestionApiV1AskQuestionPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.CreateQuestionApiV1AskQuestionPost`: %v\n", resp)
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


## DeleteAnswerApiV1AskAnswerDelete

> interface{} DeleteAnswerApiV1AskAnswerDelete(ctx).Id(id).Execute()

删除回答

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
	resp, r, err := apiClient.AskAPI.DeleteAnswerApiV1AskAnswerDelete(context.Background()).Id(id).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.DeleteAnswerApiV1AskAnswerDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteAnswerApiV1AskAnswerDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.DeleteAnswerApiV1AskAnswerDelete`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteAnswerApiV1AskAnswerDeleteRequest struct via the builder pattern


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


## DeleteCategoryApiV1AskCategoryCatIdDelete

> interface{} DeleteCategoryApiV1AskCategoryCatIdDelete(ctx, catId).Execute()

删除分类

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
	catId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskAPI.DeleteCategoryApiV1AskCategoryCatIdDelete(context.Background(), catId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.DeleteCategoryApiV1AskCategoryCatIdDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteCategoryApiV1AskCategoryCatIdDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.DeleteCategoryApiV1AskCategoryCatIdDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**catId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteCategoryApiV1AskCategoryCatIdDeleteRequest struct via the builder pattern


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
	resp, r, err := apiClient.AskAPI.DeleteQuestionApiV1AskQuestionDelete(context.Background()).Id(id).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.DeleteQuestionApiV1AskQuestionDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteQuestionApiV1AskQuestionDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.DeleteQuestionApiV1AskQuestionDelete`: %v\n", resp)
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


## GetAnswerApiV1AskAnswerPublicApiGet

> interface{} GetAnswerApiV1AskAnswerPublicApiGet(ctx).Id(id).Execute()

回答详情

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
	resp, r, err := apiClient.AskAPI.GetAnswerApiV1AskAnswerPublicApiGet(context.Background()).Id(id).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.GetAnswerApiV1AskAnswerPublicApiGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetAnswerApiV1AskAnswerPublicApiGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.GetAnswerApiV1AskAnswerPublicApiGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetAnswerApiV1AskAnswerPublicApiGetRequest struct via the builder pattern


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


## GetCategoryApiV1AskCategoryCatIdGet

> interface{} GetCategoryApiV1AskCategoryCatIdGet(ctx, catId).Execute()

分类详情

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
	catId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskAPI.GetCategoryApiV1AskCategoryCatIdGet(context.Background(), catId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.GetCategoryApiV1AskCategoryCatIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetCategoryApiV1AskCategoryCatIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.GetCategoryApiV1AskCategoryCatIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**catId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetCategoryApiV1AskCategoryCatIdGetRequest struct via the builder pattern


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
	resp, r, err := apiClient.AskAPI.GetQuestionApiV1AskQuestionPublicApiGet(context.Background()).Id(id).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.GetQuestionApiV1AskQuestionPublicApiGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetQuestionApiV1AskQuestionPublicApiGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.GetQuestionApiV1AskQuestionPublicApiGet`: %v\n", resp)
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


## ListAnswersApiV1AskAnswerListGet

> interface{} ListAnswersApiV1AskAnswerListGet(ctx).Page(page).Limit(limit).QuestionId(questionId).MemberId(memberId).Execute()

回答列表(需权限)

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
	questionId := int32(56) // int32 |  (optional)
	memberId := "memberId_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskAPI.ListAnswersApiV1AskAnswerListGet(context.Background()).Page(page).Limit(limit).QuestionId(questionId).MemberId(memberId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.ListAnswersApiV1AskAnswerListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListAnswersApiV1AskAnswerListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.ListAnswersApiV1AskAnswerListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListAnswersApiV1AskAnswerListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 10]
 **questionId** | **int32** |  | 
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
	resp, r, err := apiClient.AskAPI.ListQuestionsApiV1AskQuestionListGet(context.Background()).Page(page).Limit(limit).Keyword(keyword).Status(status).Cid(cid).MemberId(memberId).OrderColumn(orderColumn).OrderDirection(orderDirection).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.ListQuestionsApiV1AskQuestionListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListQuestionsApiV1AskQuestionListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.ListQuestionsApiV1AskQuestionListGet`: %v\n", resp)
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


## MemberAnswerCountApiV1AskAnswerPublicApiMemberCountGet

> interface{} MemberAnswerCountApiV1AskAnswerPublicApiMemberCountGet(ctx).MemberId(memberId).Execute()

会员回答数

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
	resp, r, err := apiClient.AskAPI.MemberAnswerCountApiV1AskAnswerPublicApiMemberCountGet(context.Background()).MemberId(memberId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.MemberAnswerCountApiV1AskAnswerPublicApiMemberCountGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MemberAnswerCountApiV1AskAnswerPublicApiMemberCountGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.MemberAnswerCountApiV1AskAnswerPublicApiMemberCountGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiMemberAnswerCountApiV1AskAnswerPublicApiMemberCountGetRequest struct via the builder pattern


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
	resp, r, err := apiClient.AskAPI.MemberQuestionCountApiV1AskQuestionPublicApiMemberCountGet(context.Background()).MemberId(memberId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.MemberQuestionCountApiV1AskQuestionPublicApiMemberCountGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MemberQuestionCountApiV1AskQuestionPublicApiMemberCountGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.MemberQuestionCountApiV1AskQuestionPublicApiMemberCountGet`: %v\n", resp)
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


## PublicListAnswersApiV1AskAnswerPublicApiListGet

> interface{} PublicListAnswersApiV1AskAnswerPublicApiListGet(ctx).Page(page).Limit(limit).QuestionId(questionId).Execute()

回答列表(公开)

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
	questionId := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskAPI.PublicListAnswersApiV1AskAnswerPublicApiListGet(context.Background()).Page(page).Limit(limit).QuestionId(questionId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.PublicListAnswersApiV1AskAnswerPublicApiListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PublicListAnswersApiV1AskAnswerPublicApiListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.PublicListAnswersApiV1AskAnswerPublicApiListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPublicListAnswersApiV1AskAnswerPublicApiListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 10]
 **questionId** | **int32** |  | 

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


## PublicListApiV1AskCategoryPublicApiListGet

> interface{} PublicListApiV1AskCategoryPublicApiListGet(ctx).IsShow(isShow).IsShowIndex(isShowIndex).Execute()

分类列表(公开)

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
	isShow := true // bool |  (optional)
	isShowIndex := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskAPI.PublicListApiV1AskCategoryPublicApiListGet(context.Background()).IsShow(isShow).IsShowIndex(isShowIndex).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.PublicListApiV1AskCategoryPublicApiListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PublicListApiV1AskCategoryPublicApiListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.PublicListApiV1AskCategoryPublicApiListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPublicListApiV1AskCategoryPublicApiListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **isShow** | **bool** |  | 
 **isShowIndex** | **bool** |  | 

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
	resp, r, err := apiClient.AskAPI.PublicListQuestionsApiV1AskQuestionPublicApiListGet(context.Background()).Page(page).Limit(limit).Keyword(keyword).Cid(cid).OrderColumn(orderColumn).OrderDirection(orderDirection).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.PublicListQuestionsApiV1AskQuestionPublicApiListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PublicListQuestionsApiV1AskQuestionPublicApiListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.PublicListQuestionsApiV1AskQuestionPublicApiListGet`: %v\n", resp)
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


## UpdateAnswerApiV1AskAnswerPut

> interface{} UpdateAnswerApiV1AskAnswerPut(ctx).AnswerUpdate(answerUpdate).Execute()

修改回答

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
	answerUpdate := *openapiclient.NewAnswerUpdate(int32(123)) // AnswerUpdate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskAPI.UpdateAnswerApiV1AskAnswerPut(context.Background()).AnswerUpdate(answerUpdate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.UpdateAnswerApiV1AskAnswerPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateAnswerApiV1AskAnswerPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.UpdateAnswerApiV1AskAnswerPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateAnswerApiV1AskAnswerPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **answerUpdate** | [**AnswerUpdate**](AnswerUpdate.md) |  | 

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


## UpdateCategoryApiV1AskCategoryPut

> interface{} UpdateCategoryApiV1AskCategoryPut(ctx).CategoryUpdate(categoryUpdate).Execute()

修改分类

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
	categoryUpdate := *openapiclient.NewCategoryUpdate(int32(123)) // CategoryUpdate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskAPI.UpdateCategoryApiV1AskCategoryPut(context.Background()).CategoryUpdate(categoryUpdate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.UpdateCategoryApiV1AskCategoryPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateCategoryApiV1AskCategoryPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.UpdateCategoryApiV1AskCategoryPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateCategoryApiV1AskCategoryPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **categoryUpdate** | [**CategoryUpdate**](CategoryUpdate.md) |  | 

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
	resp, r, err := apiClient.AskAPI.UpdateQuestionApiV1AskQuestionPut(context.Background()).QuestionUpdate(questionUpdate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAPI.UpdateQuestionApiV1AskQuestionPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateQuestionApiV1AskQuestionPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAPI.UpdateQuestionApiV1AskQuestionPut`: %v\n", resp)
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

