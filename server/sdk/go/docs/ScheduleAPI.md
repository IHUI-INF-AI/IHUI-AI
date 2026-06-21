# \ScheduleAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateScheduleApiV1SchedulePost**](ScheduleAPI.md#CreateScheduleApiV1SchedulePost) | **Post** /api/v1/schedule | 创建日程
[**CreateScheduleApiV1SchedulePost_0**](ScheduleAPI.md#CreateScheduleApiV1SchedulePost_0) | **Post** /api/v1/schedule | 创建日程
[**DeleteScheduleApiV1ScheduleSidDelete**](ScheduleAPI.md#DeleteScheduleApiV1ScheduleSidDelete) | **Delete** /api/v1/schedule/{sid} | 删除日程
[**DeleteScheduleApiV1ScheduleSidDelete_0**](ScheduleAPI.md#DeleteScheduleApiV1ScheduleSidDelete_0) | **Delete** /api/v1/schedule/{sid} | 删除日程
[**ListSchedulesApiV1ScheduleListGet**](ScheduleAPI.md#ListSchedulesApiV1ScheduleListGet) | **Get** /api/v1/schedule/list | 我的日程
[**ListSchedulesApiV1ScheduleListGet_0**](ScheduleAPI.md#ListSchedulesApiV1ScheduleListGet_0) | **Get** /api/v1/schedule/list | 我的日程
[**UpdateScheduleApiV1ScheduleSidPut**](ScheduleAPI.md#UpdateScheduleApiV1ScheduleSidPut) | **Put** /api/v1/schedule/{sid} | 修改日程
[**UpdateScheduleApiV1ScheduleSidPut_0**](ScheduleAPI.md#UpdateScheduleApiV1ScheduleSidPut_0) | **Put** /api/v1/schedule/{sid} | 修改日程



## CreateScheduleApiV1SchedulePost

> interface{} CreateScheduleApiV1SchedulePost(ctx).Title(title).StartTime(startTime).Description(description).EndTime(endTime).AllDay(allDay).Type_(type_).Color(color).RemindBefore(remindBefore).Location(location).RefId(refId).RefType(refType).Execute()

创建日程

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
    "time"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	title := "title_example" // string | 
	startTime := time.Now() // time.Time | 
	description := "description_example" // string |  (optional)
	endTime := time.Now() // time.Time |  (optional)
	allDay := true // bool |  (optional) (default to false)
	type_ := "type__example" // string |  (optional) (default to "personal")
	color := "color_example" // string |  (optional)
	remindBefore := int32(56) // int32 |  (optional) (default to 0)
	location := "location_example" // string |  (optional)
	refId := "refId_example" // string |  (optional)
	refType := "refType_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ScheduleAPI.CreateScheduleApiV1SchedulePost(context.Background()).Title(title).StartTime(startTime).Description(description).EndTime(endTime).AllDay(allDay).Type_(type_).Color(color).RemindBefore(remindBefore).Location(location).RefId(refId).RefType(refType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ScheduleAPI.CreateScheduleApiV1SchedulePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateScheduleApiV1SchedulePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ScheduleAPI.CreateScheduleApiV1SchedulePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateScheduleApiV1SchedulePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **startTime** | **time.Time** |  | 
 **description** | **string** |  | 
 **endTime** | **time.Time** |  | 
 **allDay** | **bool** |  | [default to false]
 **type_** | **string** |  | [default to &quot;personal&quot;]
 **color** | **string** |  | 
 **remindBefore** | **int32** |  | [default to 0]
 **location** | **string** |  | 
 **refId** | **string** |  | 
 **refType** | **string** |  | 

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


## CreateScheduleApiV1SchedulePost_0

> interface{} CreateScheduleApiV1SchedulePost_0(ctx).Title(title).StartTime(startTime).Description(description).EndTime(endTime).AllDay(allDay).Type_(type_).Color(color).RemindBefore(remindBefore).Location(location).RefId(refId).RefType(refType).Execute()

创建日程

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
    "time"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	title := "title_example" // string | 
	startTime := time.Now() // time.Time | 
	description := "description_example" // string |  (optional)
	endTime := time.Now() // time.Time |  (optional)
	allDay := true // bool |  (optional) (default to false)
	type_ := "type__example" // string |  (optional) (default to "personal")
	color := "color_example" // string |  (optional)
	remindBefore := int32(56) // int32 |  (optional) (default to 0)
	location := "location_example" // string |  (optional)
	refId := "refId_example" // string |  (optional)
	refType := "refType_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ScheduleAPI.CreateScheduleApiV1SchedulePost_0(context.Background()).Title(title).StartTime(startTime).Description(description).EndTime(endTime).AllDay(allDay).Type_(type_).Color(color).RemindBefore(remindBefore).Location(location).RefId(refId).RefType(refType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ScheduleAPI.CreateScheduleApiV1SchedulePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateScheduleApiV1SchedulePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ScheduleAPI.CreateScheduleApiV1SchedulePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateScheduleApiV1SchedulePost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **startTime** | **time.Time** |  | 
 **description** | **string** |  | 
 **endTime** | **time.Time** |  | 
 **allDay** | **bool** |  | [default to false]
 **type_** | **string** |  | [default to &quot;personal&quot;]
 **color** | **string** |  | 
 **remindBefore** | **int32** |  | [default to 0]
 **location** | **string** |  | 
 **refId** | **string** |  | 
 **refType** | **string** |  | 

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


## DeleteScheduleApiV1ScheduleSidDelete

> interface{} DeleteScheduleApiV1ScheduleSidDelete(ctx, sid).Execute()

删除日程

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
	sid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ScheduleAPI.DeleteScheduleApiV1ScheduleSidDelete(context.Background(), sid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ScheduleAPI.DeleteScheduleApiV1ScheduleSidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteScheduleApiV1ScheduleSidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ScheduleAPI.DeleteScheduleApiV1ScheduleSidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteScheduleApiV1ScheduleSidDeleteRequest struct via the builder pattern


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


## DeleteScheduleApiV1ScheduleSidDelete_0

> interface{} DeleteScheduleApiV1ScheduleSidDelete_0(ctx, sid).Execute()

删除日程

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
	sid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ScheduleAPI.DeleteScheduleApiV1ScheduleSidDelete_0(context.Background(), sid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ScheduleAPI.DeleteScheduleApiV1ScheduleSidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteScheduleApiV1ScheduleSidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ScheduleAPI.DeleteScheduleApiV1ScheduleSidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteScheduleApiV1ScheduleSidDelete_2Request struct via the builder pattern


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


## ListSchedulesApiV1ScheduleListGet

> interface{} ListSchedulesApiV1ScheduleListGet(ctx).Page(page).Limit(limit).Type_(type_).StartDate(startDate).EndDate(endDate).Execute()

我的日程

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
	type_ := "type__example" // string |  (optional)
	startDate := "startDate_example" // string |  (optional)
	endDate := "endDate_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ScheduleAPI.ListSchedulesApiV1ScheduleListGet(context.Background()).Page(page).Limit(limit).Type_(type_).StartDate(startDate).EndDate(endDate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ScheduleAPI.ListSchedulesApiV1ScheduleListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListSchedulesApiV1ScheduleListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ScheduleAPI.ListSchedulesApiV1ScheduleListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListSchedulesApiV1ScheduleListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **type_** | **string** |  | 
 **startDate** | **string** |  | 
 **endDate** | **string** |  | 

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


## ListSchedulesApiV1ScheduleListGet_0

> interface{} ListSchedulesApiV1ScheduleListGet_0(ctx).Page(page).Limit(limit).Type_(type_).StartDate(startDate).EndDate(endDate).Execute()

我的日程

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
	type_ := "type__example" // string |  (optional)
	startDate := "startDate_example" // string |  (optional)
	endDate := "endDate_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ScheduleAPI.ListSchedulesApiV1ScheduleListGet_0(context.Background()).Page(page).Limit(limit).Type_(type_).StartDate(startDate).EndDate(endDate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ScheduleAPI.ListSchedulesApiV1ScheduleListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListSchedulesApiV1ScheduleListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ScheduleAPI.ListSchedulesApiV1ScheduleListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListSchedulesApiV1ScheduleListGet_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **type_** | **string** |  | 
 **startDate** | **string** |  | 
 **endDate** | **string** |  | 

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


## UpdateScheduleApiV1ScheduleSidPut

> interface{} UpdateScheduleApiV1ScheduleSidPut(ctx, sid).Title(title).Description(description).StartTime(startTime).EndTime(endTime).Status(status).Color(color).Execute()

修改日程

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
    "time"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sid := int32(56) // int32 | 
	title := "title_example" // string |  (optional)
	description := "description_example" // string |  (optional)
	startTime := time.Now() // time.Time |  (optional)
	endTime := time.Now() // time.Time |  (optional)
	status := int32(56) // int32 |  (optional)
	color := "color_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ScheduleAPI.UpdateScheduleApiV1ScheduleSidPut(context.Background(), sid).Title(title).Description(description).StartTime(startTime).EndTime(endTime).Status(status).Color(color).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ScheduleAPI.UpdateScheduleApiV1ScheduleSidPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateScheduleApiV1ScheduleSidPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ScheduleAPI.UpdateScheduleApiV1ScheduleSidPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateScheduleApiV1ScheduleSidPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **title** | **string** |  | 
 **description** | **string** |  | 
 **startTime** | **time.Time** |  | 
 **endTime** | **time.Time** |  | 
 **status** | **int32** |  | 
 **color** | **string** |  | 

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


## UpdateScheduleApiV1ScheduleSidPut_0

> interface{} UpdateScheduleApiV1ScheduleSidPut_0(ctx, sid).Title(title).Description(description).StartTime(startTime).EndTime(endTime).Status(status).Color(color).Execute()

修改日程

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
    "time"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sid := int32(56) // int32 | 
	title := "title_example" // string |  (optional)
	description := "description_example" // string |  (optional)
	startTime := time.Now() // time.Time |  (optional)
	endTime := time.Now() // time.Time |  (optional)
	status := int32(56) // int32 |  (optional)
	color := "color_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ScheduleAPI.UpdateScheduleApiV1ScheduleSidPut_0(context.Background(), sid).Title(title).Description(description).StartTime(startTime).EndTime(endTime).Status(status).Color(color).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ScheduleAPI.UpdateScheduleApiV1ScheduleSidPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateScheduleApiV1ScheduleSidPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ScheduleAPI.UpdateScheduleApiV1ScheduleSidPut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateScheduleApiV1ScheduleSidPut_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **title** | **string** |  | 
 **description** | **string** |  | 
 **startTime** | **time.Time** |  | 
 **endTime** | **time.Time** |  | 
 **status** | **int32** |  | 
 **color** | **string** |  | 

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

