# \CoursesAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateCourseApiV1CoursesCreatePost**](CoursesAPI.md#CreateCourseApiV1CoursesCreatePost) | **Post** /api/v1/courses/create | Create course
[**DeleteCourseApiV1CoursesCourseIdDelete**](CoursesAPI.md#DeleteCourseApiV1CoursesCourseIdDelete) | **Delete** /api/v1/courses/{course_id} | Delete course (soft)
[**DelistCourseApiV1CoursesCourseIdDelistPost**](CoursesAPI.md#DelistCourseApiV1CoursesCourseIdDelistPost) | **Post** /api/v1/courses/{course_id}/delist | Delist (hide) course
[**GetCourseApiV1CoursesCourseIdGet**](CoursesAPI.md#GetCourseApiV1CoursesCourseIdGet) | **Get** /api/v1/courses/{course_id} | Get course detail
[**ListCoursesApiV1CoursesListGet**](CoursesAPI.md#ListCoursesApiV1CoursesListGet) | **Get** /api/v1/courses/list | List courses
[**UpdateCourseApiV1CoursesCourseIdPut**](CoursesAPI.md#UpdateCourseApiV1CoursesCourseIdPut) | **Put** /api/v1/courses/{course_id} | Update course



## CreateCourseApiV1CoursesCreatePost

> interface{} CreateCourseApiV1CoursesCreatePost(ctx).CourseCreate(courseCreate).Execute()

Create course

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
	courseCreate := *openapiclient.NewCourseCreate("Title_example") // CourseCreate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesAPI.CreateCourseApiV1CoursesCreatePost(context.Background()).CourseCreate(courseCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesAPI.CreateCourseApiV1CoursesCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateCourseApiV1CoursesCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesAPI.CreateCourseApiV1CoursesCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateCourseApiV1CoursesCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **courseCreate** | [**CourseCreate**](CourseCreate.md) |  | 

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


## DeleteCourseApiV1CoursesCourseIdDelete

> interface{} DeleteCourseApiV1CoursesCourseIdDelete(ctx, courseId).Execute()

Delete course (soft)

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesAPI.DeleteCourseApiV1CoursesCourseIdDelete(context.Background(), courseId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesAPI.DeleteCourseApiV1CoursesCourseIdDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteCourseApiV1CoursesCourseIdDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesAPI.DeleteCourseApiV1CoursesCourseIdDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**courseId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteCourseApiV1CoursesCourseIdDeleteRequest struct via the builder pattern


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


## DelistCourseApiV1CoursesCourseIdDelistPost

> interface{} DelistCourseApiV1CoursesCourseIdDelistPost(ctx, courseId).Execute()

Delist (hide) course

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesAPI.DelistCourseApiV1CoursesCourseIdDelistPost(context.Background(), courseId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesAPI.DelistCourseApiV1CoursesCourseIdDelistPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DelistCourseApiV1CoursesCourseIdDelistPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesAPI.DelistCourseApiV1CoursesCourseIdDelistPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**courseId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDelistCourseApiV1CoursesCourseIdDelistPostRequest struct via the builder pattern


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


## GetCourseApiV1CoursesCourseIdGet

> interface{} GetCourseApiV1CoursesCourseIdGet(ctx, courseId).Execute()

Get course detail

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesAPI.GetCourseApiV1CoursesCourseIdGet(context.Background(), courseId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesAPI.GetCourseApiV1CoursesCourseIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetCourseApiV1CoursesCourseIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesAPI.GetCourseApiV1CoursesCourseIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**courseId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetCourseApiV1CoursesCourseIdGetRequest struct via the builder pattern


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


## ListCoursesApiV1CoursesListGet

> interface{} ListCoursesApiV1CoursesListGet(ctx).Page(page).Limit(limit).Keyword(keyword).Stage(stage).IsHidden(isHidden).AuditStatus(auditStatus).Execute()

List courses

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
	keyword := "keyword_example" // string |  (optional)
	stage := "stage_example" // string |  (optional)
	isHidden := int32(56) // int32 |  (optional)
	auditStatus := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesAPI.ListCoursesApiV1CoursesListGet(context.Background()).Page(page).Limit(limit).Keyword(keyword).Stage(stage).IsHidden(isHidden).AuditStatus(auditStatus).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesAPI.ListCoursesApiV1CoursesListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListCoursesApiV1CoursesListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesAPI.ListCoursesApiV1CoursesListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListCoursesApiV1CoursesListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **keyword** | **string** |  | 
 **stage** | **string** |  | 
 **isHidden** | **int32** |  | 
 **auditStatus** | **int32** |  | 

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


## UpdateCourseApiV1CoursesCourseIdPut

> interface{} UpdateCourseApiV1CoursesCourseIdPut(ctx, courseId).CourseUpdate(courseUpdate).Execute()

Update course

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
	courseUpdate := *openapiclient.NewCourseUpdate() // CourseUpdate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CoursesAPI.UpdateCourseApiV1CoursesCourseIdPut(context.Background(), courseId).CourseUpdate(courseUpdate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CoursesAPI.UpdateCourseApiV1CoursesCourseIdPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateCourseApiV1CoursesCourseIdPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CoursesAPI.UpdateCourseApiV1CoursesCourseIdPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**courseId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateCourseApiV1CoursesCourseIdPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **courseUpdate** | [**CourseUpdate**](CourseUpdate.md) |  | 

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

