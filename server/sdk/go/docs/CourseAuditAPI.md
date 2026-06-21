# \CourseAuditAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AuditCourseApiV1CourseAuditAidAuditPut**](CourseAuditAPI.md#AuditCourseApiV1CourseAuditAidAuditPut) | **Put** /api/v1/course-audit/{aid}/audit | 审核操作
[**AuditCourseApiV1CourseAuditAidAuditPut_0**](CourseAuditAPI.md#AuditCourseApiV1CourseAuditAidAuditPut_0) | **Put** /api/v1/course-audit/{aid}/audit | 审核操作
[**CourseAuditSubmit**](CourseAuditAPI.md#CourseAuditSubmit) | **Post** /api/v1/course-audit/submit | 提交课程审核
[**CourseAuditSubmit_0**](CourseAuditAPI.md#CourseAuditSubmit_0) | **Post** /api/v1/course-audit/submit | 提交课程审核
[**GetAuditApiV1CourseAuditAidGet**](CourseAuditAPI.md#GetAuditApiV1CourseAuditAidGet) | **Get** /api/v1/course-audit/{aid} | 审核详情
[**GetAuditApiV1CourseAuditAidGet_0**](CourseAuditAPI.md#GetAuditApiV1CourseAuditAidGet_0) | **Get** /api/v1/course-audit/{aid} | 审核详情
[**ListAuditsApiV1CourseAuditListGet**](CourseAuditAPI.md#ListAuditsApiV1CourseAuditListGet) | **Get** /api/v1/course-audit/list | 审核列表
[**ListAuditsApiV1CourseAuditListGet_0**](CourseAuditAPI.md#ListAuditsApiV1CourseAuditListGet_0) | **Get** /api/v1/course-audit/list | 审核列表



## AuditCourseApiV1CourseAuditAidAuditPut

> interface{} AuditCourseApiV1CourseAuditAidAuditPut(ctx, aid).Status(status).Remark(remark).Score(score).IsFinal(isFinal).Execute()

审核操作

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
	aid := int32(56) // int32 | 
	status := int32(56) // int32 | 
	remark := "remark_example" // string |  (optional)
	score := int32(56) // int32 |  (optional) (default to 0)
	isFinal := true // bool |  (optional) (default to false)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CourseAuditAPI.AuditCourseApiV1CourseAuditAidAuditPut(context.Background(), aid).Status(status).Remark(remark).Score(score).IsFinal(isFinal).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CourseAuditAPI.AuditCourseApiV1CourseAuditAidAuditPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AuditCourseApiV1CourseAuditAidAuditPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CourseAuditAPI.AuditCourseApiV1CourseAuditAidAuditPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiAuditCourseApiV1CourseAuditAidAuditPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **status** | **int32** |  | 
 **remark** | **string** |  | 
 **score** | **int32** |  | [default to 0]
 **isFinal** | **bool** |  | [default to false]

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


## AuditCourseApiV1CourseAuditAidAuditPut_0

> interface{} AuditCourseApiV1CourseAuditAidAuditPut_0(ctx, aid).Status(status).Remark(remark).Score(score).IsFinal(isFinal).Execute()

审核操作

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
	aid := int32(56) // int32 | 
	status := int32(56) // int32 | 
	remark := "remark_example" // string |  (optional)
	score := int32(56) // int32 |  (optional) (default to 0)
	isFinal := true // bool |  (optional) (default to false)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CourseAuditAPI.AuditCourseApiV1CourseAuditAidAuditPut_0(context.Background(), aid).Status(status).Remark(remark).Score(score).IsFinal(isFinal).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CourseAuditAPI.AuditCourseApiV1CourseAuditAidAuditPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AuditCourseApiV1CourseAuditAidAuditPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CourseAuditAPI.AuditCourseApiV1CourseAuditAidAuditPut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiAuditCourseApiV1CourseAuditAidAuditPut_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **status** | **int32** |  | 
 **remark** | **string** |  | 
 **score** | **int32** |  | [default to 0]
 **isFinal** | **bool** |  | [default to false]

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


## CourseAuditSubmit

> interface{} CourseAuditSubmit(ctx).CourseId(courseId).CourseTitle(courseTitle).Execute()

提交课程审核

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
	courseTitle := "courseTitle_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CourseAuditAPI.CourseAuditSubmit(context.Background()).CourseId(courseId).CourseTitle(courseTitle).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CourseAuditAPI.CourseAuditSubmit``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CourseAuditSubmit`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CourseAuditAPI.CourseAuditSubmit`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCourseAuditSubmitRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **courseId** | **int32** |  | 
 **courseTitle** | **string** |  | 

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


## CourseAuditSubmit_0

> interface{} CourseAuditSubmit_0(ctx).CourseId(courseId).CourseTitle(courseTitle).Execute()

提交课程审核

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
	courseTitle := "courseTitle_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CourseAuditAPI.CourseAuditSubmit_0(context.Background()).CourseId(courseId).CourseTitle(courseTitle).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CourseAuditAPI.CourseAuditSubmit_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CourseAuditSubmit_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CourseAuditAPI.CourseAuditSubmit_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCourseAuditSubmit_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **courseId** | **int32** |  | 
 **courseTitle** | **string** |  | 

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


## GetAuditApiV1CourseAuditAidGet

> interface{} GetAuditApiV1CourseAuditAidGet(ctx, aid).Execute()

审核详情

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
	aid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CourseAuditAPI.GetAuditApiV1CourseAuditAidGet(context.Background(), aid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CourseAuditAPI.GetAuditApiV1CourseAuditAidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetAuditApiV1CourseAuditAidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CourseAuditAPI.GetAuditApiV1CourseAuditAidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetAuditApiV1CourseAuditAidGetRequest struct via the builder pattern


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


## GetAuditApiV1CourseAuditAidGet_0

> interface{} GetAuditApiV1CourseAuditAidGet_0(ctx, aid).Execute()

审核详情

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
	aid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CourseAuditAPI.GetAuditApiV1CourseAuditAidGet_0(context.Background(), aid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CourseAuditAPI.GetAuditApiV1CourseAuditAidGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetAuditApiV1CourseAuditAidGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CourseAuditAPI.GetAuditApiV1CourseAuditAidGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetAuditApiV1CourseAuditAidGet_3Request struct via the builder pattern


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


## ListAuditsApiV1CourseAuditListGet

> interface{} ListAuditsApiV1CourseAuditListGet(ctx).Page(page).Limit(limit).Status(status).CourseId(courseId).Execute()

审核列表

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
	status := int32(56) // int32 |  (optional)
	courseId := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CourseAuditAPI.ListAuditsApiV1CourseAuditListGet(context.Background()).Page(page).Limit(limit).Status(status).CourseId(courseId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CourseAuditAPI.ListAuditsApiV1CourseAuditListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListAuditsApiV1CourseAuditListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CourseAuditAPI.ListAuditsApiV1CourseAuditListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListAuditsApiV1CourseAuditListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **status** | **int32** |  | 
 **courseId** | **int32** |  | 

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


## ListAuditsApiV1CourseAuditListGet_0

> interface{} ListAuditsApiV1CourseAuditListGet_0(ctx).Page(page).Limit(limit).Status(status).CourseId(courseId).Execute()

审核列表

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
	status := int32(56) // int32 |  (optional)
	courseId := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CourseAuditAPI.ListAuditsApiV1CourseAuditListGet_0(context.Background()).Page(page).Limit(limit).Status(status).CourseId(courseId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CourseAuditAPI.ListAuditsApiV1CourseAuditListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListAuditsApiV1CourseAuditListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CourseAuditAPI.ListAuditsApiV1CourseAuditListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListAuditsApiV1CourseAuditListGet_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **status** | **int32** |  | 
 **courseId** | **int32** |  | 

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

