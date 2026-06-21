# \ExamAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreatePaperApiV1ExamPaperPost**](ExamAPI.md#CreatePaperApiV1ExamPaperPost) | **Post** /api/v1/exam/paper | 创建试卷
[**CreatePaperApiV1ExamPaperPost_0**](ExamAPI.md#CreatePaperApiV1ExamPaperPost_0) | **Post** /api/v1/exam/paper | 创建试卷
[**CreateQuestionApiV1ExamQuestionPost**](ExamAPI.md#CreateQuestionApiV1ExamQuestionPost) | **Post** /api/v1/exam/question | 新增题目
[**CreateQuestionApiV1ExamQuestionPost_0**](ExamAPI.md#CreateQuestionApiV1ExamQuestionPost_0) | **Post** /api/v1/exam/question | 新增题目
[**DeletePaperApiV1ExamPaperPidDelete**](ExamAPI.md#DeletePaperApiV1ExamPaperPidDelete) | **Delete** /api/v1/exam/paper/{pid} | 删除试卷
[**DeletePaperApiV1ExamPaperPidDelete_0**](ExamAPI.md#DeletePaperApiV1ExamPaperPidDelete_0) | **Delete** /api/v1/exam/paper/{pid} | 删除试卷
[**DeleteQuestionApiV1ExamQuestionQidDelete**](ExamAPI.md#DeleteQuestionApiV1ExamQuestionQidDelete) | **Delete** /api/v1/exam/question/{qid} | 删除题目
[**DeleteQuestionApiV1ExamQuestionQidDelete_0**](ExamAPI.md#DeleteQuestionApiV1ExamQuestionQidDelete_0) | **Delete** /api/v1/exam/question/{qid} | 删除题目
[**ExamPaperCategoryList**](ExamAPI.md#ExamPaperCategoryList) | **Get** /api/v1/exam/category/list | 考试分类列表
[**ExamPaperCategoryList_0**](ExamAPI.md#ExamPaperCategoryList_0) | **Get** /api/v1/exam/category/list | 考试分类列表
[**GetPaperApiV1ExamPaperPidGet**](ExamAPI.md#GetPaperApiV1ExamPaperPidGet) | **Get** /api/v1/exam/paper/{pid} | 试卷详情
[**GetPaperApiV1ExamPaperPidGet_0**](ExamAPI.md#GetPaperApiV1ExamPaperPidGet_0) | **Get** /api/v1/exam/paper/{pid} | 试卷详情
[**GetRecordApiV1ExamRecordRidGet**](ExamAPI.md#GetRecordApiV1ExamRecordRidGet) | **Get** /api/v1/exam/record/{rid} | 考试记录详情
[**GetRecordApiV1ExamRecordRidGet_0**](ExamAPI.md#GetRecordApiV1ExamRecordRidGet_0) | **Get** /api/v1/exam/record/{rid} | 考试记录详情
[**ListPapersApiV1ExamPaperListGet**](ExamAPI.md#ListPapersApiV1ExamPaperListGet) | **Get** /api/v1/exam/paper/list | 试卷列表
[**ListPapersApiV1ExamPaperListGet_0**](ExamAPI.md#ListPapersApiV1ExamPaperListGet_0) | **Get** /api/v1/exam/paper/list | 试卷列表
[**ListQuestionsApiV1ExamQuestionListGet**](ExamAPI.md#ListQuestionsApiV1ExamQuestionListGet) | **Get** /api/v1/exam/question/list | 题目列表
[**ListQuestionsApiV1ExamQuestionListGet_0**](ExamAPI.md#ListQuestionsApiV1ExamQuestionListGet_0) | **Get** /api/v1/exam/question/list | 题目列表
[**ListRecordsApiV1ExamRecordListGet**](ExamAPI.md#ListRecordsApiV1ExamRecordListGet) | **Get** /api/v1/exam/record/list | 考试记录列表
[**ListRecordsApiV1ExamRecordListGet_0**](ExamAPI.md#ListRecordsApiV1ExamRecordListGet_0) | **Get** /api/v1/exam/record/list | 考试记录列表
[**MarkMasteredApiV1ExamWrongWidMasterPut**](ExamAPI.md#MarkMasteredApiV1ExamWrongWidMasterPut) | **Put** /api/v1/exam/wrong/{wid}/master | 标记错题为已掌握
[**MarkMasteredApiV1ExamWrongWidMasterPut_0**](ExamAPI.md#MarkMasteredApiV1ExamWrongWidMasterPut_0) | **Put** /api/v1/exam/wrong/{wid}/master | 标记错题为已掌握
[**StartExamApiV1ExamRecordStartPost**](ExamAPI.md#StartExamApiV1ExamRecordStartPost) | **Post** /api/v1/exam/record/start | 开始考试
[**StartExamApiV1ExamRecordStartPost_0**](ExamAPI.md#StartExamApiV1ExamRecordStartPost_0) | **Post** /api/v1/exam/record/start | 开始考试
[**SubmitExamApiV1ExamRecordSubmitPost**](ExamAPI.md#SubmitExamApiV1ExamRecordSubmitPost) | **Post** /api/v1/exam/record/submit | 提交答卷
[**SubmitExamApiV1ExamRecordSubmitPost_0**](ExamAPI.md#SubmitExamApiV1ExamRecordSubmitPost_0) | **Post** /api/v1/exam/record/submit | 提交答卷
[**UpdatePaperApiV1ExamPaperPidPut**](ExamAPI.md#UpdatePaperApiV1ExamPaperPidPut) | **Put** /api/v1/exam/paper/{pid} | 修改试卷
[**UpdatePaperApiV1ExamPaperPidPut_0**](ExamAPI.md#UpdatePaperApiV1ExamPaperPidPut_0) | **Put** /api/v1/exam/paper/{pid} | 修改试卷
[**UpdateQuestionApiV1ExamQuestionQidPut**](ExamAPI.md#UpdateQuestionApiV1ExamQuestionQidPut) | **Put** /api/v1/exam/question/{qid} | 修改题目
[**UpdateQuestionApiV1ExamQuestionQidPut_0**](ExamAPI.md#UpdateQuestionApiV1ExamQuestionQidPut_0) | **Put** /api/v1/exam/question/{qid} | 修改题目
[**WrongListApiV1ExamWrongListGet**](ExamAPI.md#WrongListApiV1ExamWrongListGet) | **Get** /api/v1/exam/wrong/list | 错题本
[**WrongListApiV1ExamWrongListGet_0**](ExamAPI.md#WrongListApiV1ExamWrongListGet_0) | **Get** /api/v1/exam/wrong/list | 错题本



## CreatePaperApiV1ExamPaperPost

> interface{} CreatePaperApiV1ExamPaperPost(ctx).Title(title).Description(description).CategoryId(categoryId).CourseId(courseId).Cover(cover).TotalScore(totalScore).PassScore(passScore).Duration(duration).Type_(type_).Difficulty(difficulty).IsFree(isFree).Price(price).Execute()

创建试卷

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
	title := "title_example" // string | 
	description := "description_example" // string |  (optional)
	categoryId := int32(56) // int32 |  (optional)
	courseId := int32(56) // int32 |  (optional)
	cover := "cover_example" // string |  (optional)
	totalScore := float32(8.14) // float32 |  (optional) (default to 100)
	passScore := float32(8.14) // float32 |  (optional) (default to 60)
	duration := int32(56) // int32 |  (optional) (default to 60)
	type_ := int32(56) // int32 |  (optional) (default to 1)
	difficulty := int32(56) // int32 |  (optional) (default to 1)
	isFree := true // bool |  (optional) (default to true)
	price := float32(8.14) // float32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.CreatePaperApiV1ExamPaperPost(context.Background()).Title(title).Description(description).CategoryId(categoryId).CourseId(courseId).Cover(cover).TotalScore(totalScore).PassScore(passScore).Duration(duration).Type_(type_).Difficulty(difficulty).IsFree(isFree).Price(price).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.CreatePaperApiV1ExamPaperPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreatePaperApiV1ExamPaperPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.CreatePaperApiV1ExamPaperPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreatePaperApiV1ExamPaperPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **description** | **string** |  | 
 **categoryId** | **int32** |  | 
 **courseId** | **int32** |  | 
 **cover** | **string** |  | 
 **totalScore** | **float32** |  | [default to 100]
 **passScore** | **float32** |  | [default to 60]
 **duration** | **int32** |  | [default to 60]
 **type_** | **int32** |  | [default to 1]
 **difficulty** | **int32** |  | [default to 1]
 **isFree** | **bool** |  | [default to true]
 **price** | **float32** |  | [default to 0]

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


## CreatePaperApiV1ExamPaperPost_0

> interface{} CreatePaperApiV1ExamPaperPost_0(ctx).Title(title).Description(description).CategoryId(categoryId).CourseId(courseId).Cover(cover).TotalScore(totalScore).PassScore(passScore).Duration(duration).Type_(type_).Difficulty(difficulty).IsFree(isFree).Price(price).Execute()

创建试卷

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
	title := "title_example" // string | 
	description := "description_example" // string |  (optional)
	categoryId := int32(56) // int32 |  (optional)
	courseId := int32(56) // int32 |  (optional)
	cover := "cover_example" // string |  (optional)
	totalScore := float32(8.14) // float32 |  (optional) (default to 100)
	passScore := float32(8.14) // float32 |  (optional) (default to 60)
	duration := int32(56) // int32 |  (optional) (default to 60)
	type_ := int32(56) // int32 |  (optional) (default to 1)
	difficulty := int32(56) // int32 |  (optional) (default to 1)
	isFree := true // bool |  (optional) (default to true)
	price := float32(8.14) // float32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.CreatePaperApiV1ExamPaperPost_0(context.Background()).Title(title).Description(description).CategoryId(categoryId).CourseId(courseId).Cover(cover).TotalScore(totalScore).PassScore(passScore).Duration(duration).Type_(type_).Difficulty(difficulty).IsFree(isFree).Price(price).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.CreatePaperApiV1ExamPaperPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreatePaperApiV1ExamPaperPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.CreatePaperApiV1ExamPaperPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreatePaperApiV1ExamPaperPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **description** | **string** |  | 
 **categoryId** | **int32** |  | 
 **courseId** | **int32** |  | 
 **cover** | **string** |  | 
 **totalScore** | **float32** |  | [default to 100]
 **passScore** | **float32** |  | [default to 60]
 **duration** | **int32** |  | [default to 60]
 **type_** | **int32** |  | [default to 1]
 **difficulty** | **int32** |  | [default to 1]
 **isFree** | **bool** |  | [default to true]
 **price** | **float32** |  | [default to 0]

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


## CreateQuestionApiV1ExamQuestionPost

> interface{} CreateQuestionApiV1ExamQuestionPost(ctx).PaperId(paperId).Type_(type_).Content(content).Answer(answer).Options(options).Analysis(analysis).Score(score).Difficulty(difficulty).SortOrder(sortOrder).Execute()

新增题目

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
	paperId := int32(56) // int32 | 
	type_ := int32(56) // int32 | 
	content := "content_example" // string | 
	answer := "answer_example" // string | 
	options := "options_example" // string |  (optional)
	analysis := "analysis_example" // string |  (optional)
	score := float32(8.14) // float32 |  (optional) (default to 1)
	difficulty := int32(56) // int32 |  (optional) (default to 1)
	sortOrder := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.CreateQuestionApiV1ExamQuestionPost(context.Background()).PaperId(paperId).Type_(type_).Content(content).Answer(answer).Options(options).Analysis(analysis).Score(score).Difficulty(difficulty).SortOrder(sortOrder).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.CreateQuestionApiV1ExamQuestionPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateQuestionApiV1ExamQuestionPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.CreateQuestionApiV1ExamQuestionPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateQuestionApiV1ExamQuestionPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **paperId** | **int32** |  | 
 **type_** | **int32** |  | 
 **content** | **string** |  | 
 **answer** | **string** |  | 
 **options** | **string** |  | 
 **analysis** | **string** |  | 
 **score** | **float32** |  | [default to 1]
 **difficulty** | **int32** |  | [default to 1]
 **sortOrder** | **int32** |  | [default to 0]

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


## CreateQuestionApiV1ExamQuestionPost_0

> interface{} CreateQuestionApiV1ExamQuestionPost_0(ctx).PaperId(paperId).Type_(type_).Content(content).Answer(answer).Options(options).Analysis(analysis).Score(score).Difficulty(difficulty).SortOrder(sortOrder).Execute()

新增题目

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
	paperId := int32(56) // int32 | 
	type_ := int32(56) // int32 | 
	content := "content_example" // string | 
	answer := "answer_example" // string | 
	options := "options_example" // string |  (optional)
	analysis := "analysis_example" // string |  (optional)
	score := float32(8.14) // float32 |  (optional) (default to 1)
	difficulty := int32(56) // int32 |  (optional) (default to 1)
	sortOrder := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.CreateQuestionApiV1ExamQuestionPost_0(context.Background()).PaperId(paperId).Type_(type_).Content(content).Answer(answer).Options(options).Analysis(analysis).Score(score).Difficulty(difficulty).SortOrder(sortOrder).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.CreateQuestionApiV1ExamQuestionPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateQuestionApiV1ExamQuestionPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.CreateQuestionApiV1ExamQuestionPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateQuestionApiV1ExamQuestionPost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **paperId** | **int32** |  | 
 **type_** | **int32** |  | 
 **content** | **string** |  | 
 **answer** | **string** |  | 
 **options** | **string** |  | 
 **analysis** | **string** |  | 
 **score** | **float32** |  | [default to 1]
 **difficulty** | **int32** |  | [default to 1]
 **sortOrder** | **int32** |  | [default to 0]

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


## DeletePaperApiV1ExamPaperPidDelete

> interface{} DeletePaperApiV1ExamPaperPidDelete(ctx, pid).Execute()

删除试卷

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
	resp, r, err := apiClient.ExamAPI.DeletePaperApiV1ExamPaperPidDelete(context.Background(), pid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.DeletePaperApiV1ExamPaperPidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeletePaperApiV1ExamPaperPidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.DeletePaperApiV1ExamPaperPidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeletePaperApiV1ExamPaperPidDeleteRequest struct via the builder pattern


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


## DeletePaperApiV1ExamPaperPidDelete_0

> interface{} DeletePaperApiV1ExamPaperPidDelete_0(ctx, pid).Execute()

删除试卷

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
	resp, r, err := apiClient.ExamAPI.DeletePaperApiV1ExamPaperPidDelete_0(context.Background(), pid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.DeletePaperApiV1ExamPaperPidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeletePaperApiV1ExamPaperPidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.DeletePaperApiV1ExamPaperPidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeletePaperApiV1ExamPaperPidDelete_3Request struct via the builder pattern


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


## DeleteQuestionApiV1ExamQuestionQidDelete

> interface{} DeleteQuestionApiV1ExamQuestionQidDelete(ctx, qid).Execute()

删除题目

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
	qid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.DeleteQuestionApiV1ExamQuestionQidDelete(context.Background(), qid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.DeleteQuestionApiV1ExamQuestionQidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteQuestionApiV1ExamQuestionQidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.DeleteQuestionApiV1ExamQuestionQidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**qid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteQuestionApiV1ExamQuestionQidDeleteRequest struct via the builder pattern


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


## DeleteQuestionApiV1ExamQuestionQidDelete_0

> interface{} DeleteQuestionApiV1ExamQuestionQidDelete_0(ctx, qid).Execute()

删除题目

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
	qid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.DeleteQuestionApiV1ExamQuestionQidDelete_0(context.Background(), qid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.DeleteQuestionApiV1ExamQuestionQidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteQuestionApiV1ExamQuestionQidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.DeleteQuestionApiV1ExamQuestionQidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**qid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteQuestionApiV1ExamQuestionQidDelete_4Request struct via the builder pattern


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


## ExamPaperCategoryList

> interface{} ExamPaperCategoryList(ctx).Execute()

考试分类列表

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
	resp, r, err := apiClient.ExamAPI.ExamPaperCategoryList(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.ExamPaperCategoryList``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExamPaperCategoryList`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.ExamPaperCategoryList`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiExamPaperCategoryListRequest struct via the builder pattern


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


## ExamPaperCategoryList_0

> interface{} ExamPaperCategoryList_0(ctx).Execute()

考试分类列表

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
	resp, r, err := apiClient.ExamAPI.ExamPaperCategoryList_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.ExamPaperCategoryList_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExamPaperCategoryList_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.ExamPaperCategoryList_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiExamPaperCategoryList_5Request struct via the builder pattern


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


## GetPaperApiV1ExamPaperPidGet

> interface{} GetPaperApiV1ExamPaperPidGet(ctx, pid).Execute()

试卷详情

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
	resp, r, err := apiClient.ExamAPI.GetPaperApiV1ExamPaperPidGet(context.Background(), pid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.GetPaperApiV1ExamPaperPidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetPaperApiV1ExamPaperPidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.GetPaperApiV1ExamPaperPidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetPaperApiV1ExamPaperPidGetRequest struct via the builder pattern


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


## GetPaperApiV1ExamPaperPidGet_0

> interface{} GetPaperApiV1ExamPaperPidGet_0(ctx, pid).Execute()

试卷详情

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
	resp, r, err := apiClient.ExamAPI.GetPaperApiV1ExamPaperPidGet_0(context.Background(), pid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.GetPaperApiV1ExamPaperPidGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetPaperApiV1ExamPaperPidGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.GetPaperApiV1ExamPaperPidGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetPaperApiV1ExamPaperPidGet_6Request struct via the builder pattern


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


## GetRecordApiV1ExamRecordRidGet

> interface{} GetRecordApiV1ExamRecordRidGet(ctx, rid).Execute()

考试记录详情

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
	rid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.GetRecordApiV1ExamRecordRidGet(context.Background(), rid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.GetRecordApiV1ExamRecordRidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetRecordApiV1ExamRecordRidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.GetRecordApiV1ExamRecordRidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**rid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetRecordApiV1ExamRecordRidGetRequest struct via the builder pattern


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


## GetRecordApiV1ExamRecordRidGet_0

> interface{} GetRecordApiV1ExamRecordRidGet_0(ctx, rid).Execute()

考试记录详情

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
	rid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.GetRecordApiV1ExamRecordRidGet_0(context.Background(), rid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.GetRecordApiV1ExamRecordRidGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetRecordApiV1ExamRecordRidGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.GetRecordApiV1ExamRecordRidGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**rid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetRecordApiV1ExamRecordRidGet_7Request struct via the builder pattern


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


## ListPapersApiV1ExamPaperListGet

> interface{} ListPapersApiV1ExamPaperListGet(ctx).Page(page).Limit(limit).CategoryId(categoryId).Keyword(keyword).Difficulty(difficulty).IsFree(isFree).Execute()

试卷列表

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
	difficulty := int32(56) // int32 |  (optional)
	isFree := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.ListPapersApiV1ExamPaperListGet(context.Background()).Page(page).Limit(limit).CategoryId(categoryId).Keyword(keyword).Difficulty(difficulty).IsFree(isFree).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.ListPapersApiV1ExamPaperListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListPapersApiV1ExamPaperListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.ListPapersApiV1ExamPaperListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListPapersApiV1ExamPaperListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **categoryId** | **int32** |  | 
 **keyword** | **string** |  | 
 **difficulty** | **int32** |  | 
 **isFree** | **bool** |  | 

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


## ListPapersApiV1ExamPaperListGet_0

> interface{} ListPapersApiV1ExamPaperListGet_0(ctx).Page(page).Limit(limit).CategoryId(categoryId).Keyword(keyword).Difficulty(difficulty).IsFree(isFree).Execute()

试卷列表

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
	difficulty := int32(56) // int32 |  (optional)
	isFree := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.ListPapersApiV1ExamPaperListGet_0(context.Background()).Page(page).Limit(limit).CategoryId(categoryId).Keyword(keyword).Difficulty(difficulty).IsFree(isFree).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.ListPapersApiV1ExamPaperListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListPapersApiV1ExamPaperListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.ListPapersApiV1ExamPaperListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListPapersApiV1ExamPaperListGet_8Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **categoryId** | **int32** |  | 
 **keyword** | **string** |  | 
 **difficulty** | **int32** |  | 
 **isFree** | **bool** |  | 

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


## ListQuestionsApiV1ExamQuestionListGet

> interface{} ListQuestionsApiV1ExamQuestionListGet(ctx).PaperId(paperId).Execute()

题目列表

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
	paperId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.ListQuestionsApiV1ExamQuestionListGet(context.Background()).PaperId(paperId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.ListQuestionsApiV1ExamQuestionListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListQuestionsApiV1ExamQuestionListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.ListQuestionsApiV1ExamQuestionListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListQuestionsApiV1ExamQuestionListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **paperId** | **int32** |  | 

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


## ListQuestionsApiV1ExamQuestionListGet_0

> interface{} ListQuestionsApiV1ExamQuestionListGet_0(ctx).PaperId(paperId).Execute()

题目列表

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
	paperId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.ListQuestionsApiV1ExamQuestionListGet_0(context.Background()).PaperId(paperId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.ListQuestionsApiV1ExamQuestionListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListQuestionsApiV1ExamQuestionListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.ListQuestionsApiV1ExamQuestionListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListQuestionsApiV1ExamQuestionListGet_9Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **paperId** | **int32** |  | 

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


## ListRecordsApiV1ExamRecordListGet

> interface{} ListRecordsApiV1ExamRecordListGet(ctx).Page(page).Limit(limit).UserId(userId).PaperId(paperId).Execute()

考试记录列表

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
	paperId := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.ListRecordsApiV1ExamRecordListGet(context.Background()).Page(page).Limit(limit).UserId(userId).PaperId(paperId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.ListRecordsApiV1ExamRecordListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListRecordsApiV1ExamRecordListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.ListRecordsApiV1ExamRecordListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListRecordsApiV1ExamRecordListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **userId** | **string** |  | 
 **paperId** | **int32** |  | 

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


## ListRecordsApiV1ExamRecordListGet_0

> interface{} ListRecordsApiV1ExamRecordListGet_0(ctx).Page(page).Limit(limit).UserId(userId).PaperId(paperId).Execute()

考试记录列表

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
	paperId := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.ListRecordsApiV1ExamRecordListGet_0(context.Background()).Page(page).Limit(limit).UserId(userId).PaperId(paperId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.ListRecordsApiV1ExamRecordListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListRecordsApiV1ExamRecordListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.ListRecordsApiV1ExamRecordListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListRecordsApiV1ExamRecordListGet_10Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **userId** | **string** |  | 
 **paperId** | **int32** |  | 

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


## MarkMasteredApiV1ExamWrongWidMasterPut

> interface{} MarkMasteredApiV1ExamWrongWidMasterPut(ctx, wid).Execute()

标记错题为已掌握

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
	wid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.MarkMasteredApiV1ExamWrongWidMasterPut(context.Background(), wid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.MarkMasteredApiV1ExamWrongWidMasterPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MarkMasteredApiV1ExamWrongWidMasterPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.MarkMasteredApiV1ExamWrongWidMasterPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**wid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiMarkMasteredApiV1ExamWrongWidMasterPutRequest struct via the builder pattern


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


## MarkMasteredApiV1ExamWrongWidMasterPut_0

> interface{} MarkMasteredApiV1ExamWrongWidMasterPut_0(ctx, wid).Execute()

标记错题为已掌握

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
	wid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.MarkMasteredApiV1ExamWrongWidMasterPut_0(context.Background(), wid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.MarkMasteredApiV1ExamWrongWidMasterPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MarkMasteredApiV1ExamWrongWidMasterPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.MarkMasteredApiV1ExamWrongWidMasterPut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**wid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiMarkMasteredApiV1ExamWrongWidMasterPut_11Request struct via the builder pattern


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


## StartExamApiV1ExamRecordStartPost

> interface{} StartExamApiV1ExamRecordStartPost(ctx).PaperId(paperId).Execute()

开始考试

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
	paperId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.StartExamApiV1ExamRecordStartPost(context.Background()).PaperId(paperId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.StartExamApiV1ExamRecordStartPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StartExamApiV1ExamRecordStartPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.StartExamApiV1ExamRecordStartPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiStartExamApiV1ExamRecordStartPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **paperId** | **int32** |  | 

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


## StartExamApiV1ExamRecordStartPost_0

> interface{} StartExamApiV1ExamRecordStartPost_0(ctx).PaperId(paperId).Execute()

开始考试

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
	paperId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.StartExamApiV1ExamRecordStartPost_0(context.Background()).PaperId(paperId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.StartExamApiV1ExamRecordStartPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StartExamApiV1ExamRecordStartPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.StartExamApiV1ExamRecordStartPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiStartExamApiV1ExamRecordStartPost_12Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **paperId** | **int32** |  | 

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


## SubmitExamApiV1ExamRecordSubmitPost

> interface{} SubmitExamApiV1ExamRecordSubmitPost(ctx).RecordId(recordId).Answers(answers).Execute()

提交答卷

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
	recordId := int32(56) // int32 | 
	answers := "answers_example" // string | 答案JSON

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.SubmitExamApiV1ExamRecordSubmitPost(context.Background()).RecordId(recordId).Answers(answers).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.SubmitExamApiV1ExamRecordSubmitPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SubmitExamApiV1ExamRecordSubmitPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.SubmitExamApiV1ExamRecordSubmitPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSubmitExamApiV1ExamRecordSubmitPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **recordId** | **int32** |  | 
 **answers** | **string** | 答案JSON | 

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


## SubmitExamApiV1ExamRecordSubmitPost_0

> interface{} SubmitExamApiV1ExamRecordSubmitPost_0(ctx).RecordId(recordId).Answers(answers).Execute()

提交答卷

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
	recordId := int32(56) // int32 | 
	answers := "answers_example" // string | 答案JSON

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.SubmitExamApiV1ExamRecordSubmitPost_0(context.Background()).RecordId(recordId).Answers(answers).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.SubmitExamApiV1ExamRecordSubmitPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SubmitExamApiV1ExamRecordSubmitPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.SubmitExamApiV1ExamRecordSubmitPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSubmitExamApiV1ExamRecordSubmitPost_13Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **recordId** | **int32** |  | 
 **answers** | **string** | 答案JSON | 

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


## UpdatePaperApiV1ExamPaperPidPut

> interface{} UpdatePaperApiV1ExamPaperPidPut(ctx, pid).Title(title).Description(description).TotalScore(totalScore).PassScore(passScore).Duration(duration).Difficulty(difficulty).Price(price).IsFree(isFree).Status(status).Execute()

修改试卷

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
	title := "title_example" // string |  (optional)
	description := "description_example" // string |  (optional)
	totalScore := float32(8.14) // float32 |  (optional)
	passScore := float32(8.14) // float32 |  (optional)
	duration := int32(56) // int32 |  (optional)
	difficulty := int32(56) // int32 |  (optional)
	price := float32(8.14) // float32 |  (optional)
	isFree := true // bool |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.UpdatePaperApiV1ExamPaperPidPut(context.Background(), pid).Title(title).Description(description).TotalScore(totalScore).PassScore(passScore).Duration(duration).Difficulty(difficulty).Price(price).IsFree(isFree).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.UpdatePaperApiV1ExamPaperPidPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdatePaperApiV1ExamPaperPidPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.UpdatePaperApiV1ExamPaperPidPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdatePaperApiV1ExamPaperPidPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **title** | **string** |  | 
 **description** | **string** |  | 
 **totalScore** | **float32** |  | 
 **passScore** | **float32** |  | 
 **duration** | **int32** |  | 
 **difficulty** | **int32** |  | 
 **price** | **float32** |  | 
 **isFree** | **bool** |  | 
 **status** | **int32** |  | 

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


## UpdatePaperApiV1ExamPaperPidPut_0

> interface{} UpdatePaperApiV1ExamPaperPidPut_0(ctx, pid).Title(title).Description(description).TotalScore(totalScore).PassScore(passScore).Duration(duration).Difficulty(difficulty).Price(price).IsFree(isFree).Status(status).Execute()

修改试卷

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
	title := "title_example" // string |  (optional)
	description := "description_example" // string |  (optional)
	totalScore := float32(8.14) // float32 |  (optional)
	passScore := float32(8.14) // float32 |  (optional)
	duration := int32(56) // int32 |  (optional)
	difficulty := int32(56) // int32 |  (optional)
	price := float32(8.14) // float32 |  (optional)
	isFree := true // bool |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.UpdatePaperApiV1ExamPaperPidPut_0(context.Background(), pid).Title(title).Description(description).TotalScore(totalScore).PassScore(passScore).Duration(duration).Difficulty(difficulty).Price(price).IsFree(isFree).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.UpdatePaperApiV1ExamPaperPidPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdatePaperApiV1ExamPaperPidPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.UpdatePaperApiV1ExamPaperPidPut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdatePaperApiV1ExamPaperPidPut_14Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **title** | **string** |  | 
 **description** | **string** |  | 
 **totalScore** | **float32** |  | 
 **passScore** | **float32** |  | 
 **duration** | **int32** |  | 
 **difficulty** | **int32** |  | 
 **price** | **float32** |  | 
 **isFree** | **bool** |  | 
 **status** | **int32** |  | 

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


## UpdateQuestionApiV1ExamQuestionQidPut

> interface{} UpdateQuestionApiV1ExamQuestionQidPut(ctx, qid).Content(content).Options(options).Answer(answer).Analysis(analysis).Score(score).SortOrder(sortOrder).Execute()

修改题目

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
	qid := int32(56) // int32 | 
	content := "content_example" // string |  (optional)
	options := "options_example" // string |  (optional)
	answer := "answer_example" // string |  (optional)
	analysis := "analysis_example" // string |  (optional)
	score := float32(8.14) // float32 |  (optional)
	sortOrder := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.UpdateQuestionApiV1ExamQuestionQidPut(context.Background(), qid).Content(content).Options(options).Answer(answer).Analysis(analysis).Score(score).SortOrder(sortOrder).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.UpdateQuestionApiV1ExamQuestionQidPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateQuestionApiV1ExamQuestionQidPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.UpdateQuestionApiV1ExamQuestionQidPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**qid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateQuestionApiV1ExamQuestionQidPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **content** | **string** |  | 
 **options** | **string** |  | 
 **answer** | **string** |  | 
 **analysis** | **string** |  | 
 **score** | **float32** |  | 
 **sortOrder** | **int32** |  | 

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


## UpdateQuestionApiV1ExamQuestionQidPut_0

> interface{} UpdateQuestionApiV1ExamQuestionQidPut_0(ctx, qid).Content(content).Options(options).Answer(answer).Analysis(analysis).Score(score).SortOrder(sortOrder).Execute()

修改题目

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
	qid := int32(56) // int32 | 
	content := "content_example" // string |  (optional)
	options := "options_example" // string |  (optional)
	answer := "answer_example" // string |  (optional)
	analysis := "analysis_example" // string |  (optional)
	score := float32(8.14) // float32 |  (optional)
	sortOrder := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.UpdateQuestionApiV1ExamQuestionQidPut_0(context.Background(), qid).Content(content).Options(options).Answer(answer).Analysis(analysis).Score(score).SortOrder(sortOrder).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.UpdateQuestionApiV1ExamQuestionQidPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateQuestionApiV1ExamQuestionQidPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.UpdateQuestionApiV1ExamQuestionQidPut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**qid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateQuestionApiV1ExamQuestionQidPut_15Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **content** | **string** |  | 
 **options** | **string** |  | 
 **answer** | **string** |  | 
 **analysis** | **string** |  | 
 **score** | **float32** |  | 
 **sortOrder** | **int32** |  | 

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


## WrongListApiV1ExamWrongListGet

> interface{} WrongListApiV1ExamWrongListGet(ctx).Page(page).Limit(limit).IsMastered(isMastered).Execute()

错题本

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
	isMastered := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.WrongListApiV1ExamWrongListGet(context.Background()).Page(page).Limit(limit).IsMastered(isMastered).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.WrongListApiV1ExamWrongListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `WrongListApiV1ExamWrongListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.WrongListApiV1ExamWrongListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiWrongListApiV1ExamWrongListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **isMastered** | **bool** |  | 

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


## WrongListApiV1ExamWrongListGet_0

> interface{} WrongListApiV1ExamWrongListGet_0(ctx).Page(page).Limit(limit).IsMastered(isMastered).Execute()

错题本

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
	isMastered := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ExamAPI.WrongListApiV1ExamWrongListGet_0(context.Background()).Page(page).Limit(limit).IsMastered(isMastered).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ExamAPI.WrongListApiV1ExamWrongListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `WrongListApiV1ExamWrongListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ExamAPI.WrongListApiV1ExamWrongListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiWrongListApiV1ExamWrongListGet_16Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **isMastered** | **bool** |  | 

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

