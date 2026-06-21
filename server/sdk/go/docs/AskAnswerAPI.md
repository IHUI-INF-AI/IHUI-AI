# \AskAnswerAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AdoptAnswerApiV1AskAnswerAdoptPut**](AskAnswerAPI.md#AdoptAnswerApiV1AskAnswerAdoptPut) | **Put** /api/v1/ask/answer/adopt | 采纳回答
[**CreateAnswerApiV1AskAnswerPost**](AskAnswerAPI.md#CreateAnswerApiV1AskAnswerPost) | **Post** /api/v1/ask/answer | 提出回答
[**DeleteAnswerApiV1AskAnswerDelete**](AskAnswerAPI.md#DeleteAnswerApiV1AskAnswerDelete) | **Delete** /api/v1/ask/answer | 删除回答
[**GetAnswerApiV1AskAnswerPublicApiGet**](AskAnswerAPI.md#GetAnswerApiV1AskAnswerPublicApiGet) | **Get** /api/v1/ask/answer/public-api | 回答详情
[**ListAnswersApiV1AskAnswerListGet**](AskAnswerAPI.md#ListAnswersApiV1AskAnswerListGet) | **Get** /api/v1/ask/answer/list | 回答列表(需权限)
[**MemberAnswerCountApiV1AskAnswerPublicApiMemberCountGet**](AskAnswerAPI.md#MemberAnswerCountApiV1AskAnswerPublicApiMemberCountGet) | **Get** /api/v1/ask/answer/public-api/member/count | 会员回答数
[**PublicListAnswersApiV1AskAnswerPublicApiListGet**](AskAnswerAPI.md#PublicListAnswersApiV1AskAnswerPublicApiListGet) | **Get** /api/v1/ask/answer/public-api/list | 回答列表(公开)
[**UpdateAnswerApiV1AskAnswerPut**](AskAnswerAPI.md#UpdateAnswerApiV1AskAnswerPut) | **Put** /api/v1/ask/answer | 修改回答



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
	resp, r, err := apiClient.AskAnswerAPI.AdoptAnswerApiV1AskAnswerAdoptPut(context.Background()).Id(id).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAnswerAPI.AdoptAnswerApiV1AskAnswerAdoptPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AdoptAnswerApiV1AskAnswerAdoptPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAnswerAPI.AdoptAnswerApiV1AskAnswerAdoptPut`: %v\n", resp)
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
	resp, r, err := apiClient.AskAnswerAPI.CreateAnswerApiV1AskAnswerPost(context.Background()).AnswerCreate(answerCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAnswerAPI.CreateAnswerApiV1AskAnswerPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateAnswerApiV1AskAnswerPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAnswerAPI.CreateAnswerApiV1AskAnswerPost`: %v\n", resp)
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
	resp, r, err := apiClient.AskAnswerAPI.DeleteAnswerApiV1AskAnswerDelete(context.Background()).Id(id).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAnswerAPI.DeleteAnswerApiV1AskAnswerDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteAnswerApiV1AskAnswerDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAnswerAPI.DeleteAnswerApiV1AskAnswerDelete`: %v\n", resp)
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
	resp, r, err := apiClient.AskAnswerAPI.GetAnswerApiV1AskAnswerPublicApiGet(context.Background()).Id(id).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAnswerAPI.GetAnswerApiV1AskAnswerPublicApiGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetAnswerApiV1AskAnswerPublicApiGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAnswerAPI.GetAnswerApiV1AskAnswerPublicApiGet`: %v\n", resp)
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
	resp, r, err := apiClient.AskAnswerAPI.ListAnswersApiV1AskAnswerListGet(context.Background()).Page(page).Limit(limit).QuestionId(questionId).MemberId(memberId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAnswerAPI.ListAnswersApiV1AskAnswerListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListAnswersApiV1AskAnswerListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAnswerAPI.ListAnswersApiV1AskAnswerListGet`: %v\n", resp)
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
	resp, r, err := apiClient.AskAnswerAPI.MemberAnswerCountApiV1AskAnswerPublicApiMemberCountGet(context.Background()).MemberId(memberId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAnswerAPI.MemberAnswerCountApiV1AskAnswerPublicApiMemberCountGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MemberAnswerCountApiV1AskAnswerPublicApiMemberCountGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAnswerAPI.MemberAnswerCountApiV1AskAnswerPublicApiMemberCountGet`: %v\n", resp)
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
	resp, r, err := apiClient.AskAnswerAPI.PublicListAnswersApiV1AskAnswerPublicApiListGet(context.Background()).Page(page).Limit(limit).QuestionId(questionId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAnswerAPI.PublicListAnswersApiV1AskAnswerPublicApiListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PublicListAnswersApiV1AskAnswerPublicApiListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAnswerAPI.PublicListAnswersApiV1AskAnswerPublicApiListGet`: %v\n", resp)
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
	resp, r, err := apiClient.AskAnswerAPI.UpdateAnswerApiV1AskAnswerPut(context.Background()).AnswerUpdate(answerUpdate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskAnswerAPI.UpdateAnswerApiV1AskAnswerPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateAnswerApiV1AskAnswerPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskAnswerAPI.UpdateAnswerApiV1AskAnswerPut`: %v\n", resp)
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

