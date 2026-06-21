# \VisitTrackingAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**LogListApiV1VisitLogListGet**](VisitTrackingAPI.md#LogListApiV1VisitLogListGet) | **Get** /api/v1/visit/log/list | 访问日志
[**LogListApiV1VisitLogListGet_0**](VisitTrackingAPI.md#LogListApiV1VisitLogListGet_0) | **Get** /api/v1/visit/log/list | 访问日志
[**PageStatsApiV1VisitStatsPageGet**](VisitTrackingAPI.md#PageStatsApiV1VisitStatsPageGet) | **Get** /api/v1/visit/stats/page | 页面统计
[**PageStatsApiV1VisitStatsPageGet_0**](VisitTrackingAPI.md#PageStatsApiV1VisitStatsPageGet_0) | **Get** /api/v1/visit/stats/page | 页面统计
[**RecordPageApiV1VisitPageRecordPost**](VisitTrackingAPI.md#RecordPageApiV1VisitPageRecordPost) | **Post** /api/v1/visit/page/record | 记录页面访问
[**RecordPageApiV1VisitPageRecordPost_0**](VisitTrackingAPI.md#RecordPageApiV1VisitPageRecordPost_0) | **Post** /api/v1/visit/page/record | 记录页面访问
[**RecordSourceApiV1VisitSourceRecordPost**](VisitTrackingAPI.md#RecordSourceApiV1VisitSourceRecordPost) | **Post** /api/v1/visit/source/record | 记录来源
[**RecordSourceApiV1VisitSourceRecordPost_0**](VisitTrackingAPI.md#RecordSourceApiV1VisitSourceRecordPost_0) | **Post** /api/v1/visit/source/record | 记录来源
[**SourceStatsApiV1VisitStatsSourceGet**](VisitTrackingAPI.md#SourceStatsApiV1VisitStatsSourceGet) | **Get** /api/v1/visit/stats/source | 来源统计
[**SourceStatsApiV1VisitStatsSourceGet_0**](VisitTrackingAPI.md#SourceStatsApiV1VisitStatsSourceGet_0) | **Get** /api/v1/visit/stats/source | 来源统计
[**TodayStatsApiV1VisitStatsTodayGet**](VisitTrackingAPI.md#TodayStatsApiV1VisitStatsTodayGet) | **Get** /api/v1/visit/stats/today | 今日实时统计
[**TodayStatsApiV1VisitStatsTodayGet_0**](VisitTrackingAPI.md#TodayStatsApiV1VisitStatsTodayGet_0) | **Get** /api/v1/visit/stats/today | 今日实时统计
[**TrackApiV1VisitTrackPost**](VisitTrackingAPI.md#TrackApiV1VisitTrackPost) | **Post** /api/v1/visit/track | 记录访问
[**TrackApiV1VisitTrackPost_0**](VisitTrackingAPI.md#TrackApiV1VisitTrackPost_0) | **Post** /api/v1/visit/track | 记录访问
[**VisitDailyStats**](VisitTrackingAPI.md#VisitDailyStats) | **Get** /api/v1/visit/stats/daily | 每日访问统计
[**VisitDailyStats_0**](VisitTrackingAPI.md#VisitDailyStats_0) | **Get** /api/v1/visit/stats/daily | 每日访问统计



## LogListApiV1VisitLogListGet

> interface{} LogListApiV1VisitLogListGet(ctx).Page(page).Limit(limit).UserId(userId).Path(path).TargetType(targetType).StartDate(startDate).EndDate(endDate).Execute()

访问日志

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
	path := "path_example" // string |  (optional)
	targetType := "targetType_example" // string |  (optional)
	startDate := "startDate_example" // string |  (optional)
	endDate := "endDate_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VisitTrackingAPI.LogListApiV1VisitLogListGet(context.Background()).Page(page).Limit(limit).UserId(userId).Path(path).TargetType(targetType).StartDate(startDate).EndDate(endDate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VisitTrackingAPI.LogListApiV1VisitLogListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LogListApiV1VisitLogListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VisitTrackingAPI.LogListApiV1VisitLogListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiLogListApiV1VisitLogListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **userId** | **string** |  | 
 **path** | **string** |  | 
 **targetType** | **string** |  | 
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


## LogListApiV1VisitLogListGet_0

> interface{} LogListApiV1VisitLogListGet_0(ctx).Page(page).Limit(limit).UserId(userId).Path(path).TargetType(targetType).StartDate(startDate).EndDate(endDate).Execute()

访问日志

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
	path := "path_example" // string |  (optional)
	targetType := "targetType_example" // string |  (optional)
	startDate := "startDate_example" // string |  (optional)
	endDate := "endDate_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VisitTrackingAPI.LogListApiV1VisitLogListGet_0(context.Background()).Page(page).Limit(limit).UserId(userId).Path(path).TargetType(targetType).StartDate(startDate).EndDate(endDate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VisitTrackingAPI.LogListApiV1VisitLogListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LogListApiV1VisitLogListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VisitTrackingAPI.LogListApiV1VisitLogListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiLogListApiV1VisitLogListGet_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **userId** | **string** |  | 
 **path** | **string** |  | 
 **targetType** | **string** |  | 
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


## PageStatsApiV1VisitStatsPageGet

> interface{} PageStatsApiV1VisitStatsPageGet(ctx).StartDate(startDate).EndDate(endDate).Limit(limit).Execute()

页面统计

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
	startDate := "startDate_example" // string |  (optional)
	endDate := "endDate_example" // string |  (optional)
	limit := int32(56) // int32 |  (optional) (default to 50)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VisitTrackingAPI.PageStatsApiV1VisitStatsPageGet(context.Background()).StartDate(startDate).EndDate(endDate).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VisitTrackingAPI.PageStatsApiV1VisitStatsPageGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PageStatsApiV1VisitStatsPageGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VisitTrackingAPI.PageStatsApiV1VisitStatsPageGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPageStatsApiV1VisitStatsPageGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **startDate** | **string** |  | 
 **endDate** | **string** |  | 
 **limit** | **int32** |  | [default to 50]

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


## PageStatsApiV1VisitStatsPageGet_0

> interface{} PageStatsApiV1VisitStatsPageGet_0(ctx).StartDate(startDate).EndDate(endDate).Limit(limit).Execute()

页面统计

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
	startDate := "startDate_example" // string |  (optional)
	endDate := "endDate_example" // string |  (optional)
	limit := int32(56) // int32 |  (optional) (default to 50)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VisitTrackingAPI.PageStatsApiV1VisitStatsPageGet_0(context.Background()).StartDate(startDate).EndDate(endDate).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VisitTrackingAPI.PageStatsApiV1VisitStatsPageGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PageStatsApiV1VisitStatsPageGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VisitTrackingAPI.PageStatsApiV1VisitStatsPageGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPageStatsApiV1VisitStatsPageGet_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **startDate** | **string** |  | 
 **endDate** | **string** |  | 
 **limit** | **int32** |  | [default to 50]

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


## RecordPageApiV1VisitPageRecordPost

> interface{} RecordPageApiV1VisitPageRecordPost(ctx).Path(path).StatDate(statDate).Duration(duration).Execute()

记录页面访问

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
	path := "path_example" // string | 
	statDate := "statDate_example" // string |  (optional)
	duration := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VisitTrackingAPI.RecordPageApiV1VisitPageRecordPost(context.Background()).Path(path).StatDate(statDate).Duration(duration).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VisitTrackingAPI.RecordPageApiV1VisitPageRecordPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RecordPageApiV1VisitPageRecordPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VisitTrackingAPI.RecordPageApiV1VisitPageRecordPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRecordPageApiV1VisitPageRecordPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **path** | **string** |  | 
 **statDate** | **string** |  | 
 **duration** | **int32** |  | [default to 0]

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


## RecordPageApiV1VisitPageRecordPost_0

> interface{} RecordPageApiV1VisitPageRecordPost_0(ctx).Path(path).StatDate(statDate).Duration(duration).Execute()

记录页面访问

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
	path := "path_example" // string | 
	statDate := "statDate_example" // string |  (optional)
	duration := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VisitTrackingAPI.RecordPageApiV1VisitPageRecordPost_0(context.Background()).Path(path).StatDate(statDate).Duration(duration).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VisitTrackingAPI.RecordPageApiV1VisitPageRecordPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RecordPageApiV1VisitPageRecordPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VisitTrackingAPI.RecordPageApiV1VisitPageRecordPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRecordPageApiV1VisitPageRecordPost_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **path** | **string** |  | 
 **statDate** | **string** |  | 
 **duration** | **int32** |  | [default to 0]

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


## RecordSourceApiV1VisitSourceRecordPost

> interface{} RecordSourceApiV1VisitSourceRecordPost(ctx).Source(source).StatDate(statDate).Execute()

记录来源

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
	source := "source_example" // string | 
	statDate := "statDate_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VisitTrackingAPI.RecordSourceApiV1VisitSourceRecordPost(context.Background()).Source(source).StatDate(statDate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VisitTrackingAPI.RecordSourceApiV1VisitSourceRecordPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RecordSourceApiV1VisitSourceRecordPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VisitTrackingAPI.RecordSourceApiV1VisitSourceRecordPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRecordSourceApiV1VisitSourceRecordPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **source** | **string** |  | 
 **statDate** | **string** |  | 

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


## RecordSourceApiV1VisitSourceRecordPost_0

> interface{} RecordSourceApiV1VisitSourceRecordPost_0(ctx).Source(source).StatDate(statDate).Execute()

记录来源

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
	source := "source_example" // string | 
	statDate := "statDate_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VisitTrackingAPI.RecordSourceApiV1VisitSourceRecordPost_0(context.Background()).Source(source).StatDate(statDate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VisitTrackingAPI.RecordSourceApiV1VisitSourceRecordPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RecordSourceApiV1VisitSourceRecordPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VisitTrackingAPI.RecordSourceApiV1VisitSourceRecordPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRecordSourceApiV1VisitSourceRecordPost_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **source** | **string** |  | 
 **statDate** | **string** |  | 

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


## SourceStatsApiV1VisitStatsSourceGet

> interface{} SourceStatsApiV1VisitStatsSourceGet(ctx).StartDate(startDate).EndDate(endDate).Execute()

来源统计

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
	startDate := "startDate_example" // string |  (optional)
	endDate := "endDate_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VisitTrackingAPI.SourceStatsApiV1VisitStatsSourceGet(context.Background()).StartDate(startDate).EndDate(endDate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VisitTrackingAPI.SourceStatsApiV1VisitStatsSourceGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SourceStatsApiV1VisitStatsSourceGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VisitTrackingAPI.SourceStatsApiV1VisitStatsSourceGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSourceStatsApiV1VisitStatsSourceGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
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


## SourceStatsApiV1VisitStatsSourceGet_0

> interface{} SourceStatsApiV1VisitStatsSourceGet_0(ctx).StartDate(startDate).EndDate(endDate).Execute()

来源统计

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
	startDate := "startDate_example" // string |  (optional)
	endDate := "endDate_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VisitTrackingAPI.SourceStatsApiV1VisitStatsSourceGet_0(context.Background()).StartDate(startDate).EndDate(endDate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VisitTrackingAPI.SourceStatsApiV1VisitStatsSourceGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SourceStatsApiV1VisitStatsSourceGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VisitTrackingAPI.SourceStatsApiV1VisitStatsSourceGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSourceStatsApiV1VisitStatsSourceGet_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
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


## TodayStatsApiV1VisitStatsTodayGet

> interface{} TodayStatsApiV1VisitStatsTodayGet(ctx).Execute()

今日实时统计

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
	resp, r, err := apiClient.VisitTrackingAPI.TodayStatsApiV1VisitStatsTodayGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VisitTrackingAPI.TodayStatsApiV1VisitStatsTodayGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TodayStatsApiV1VisitStatsTodayGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VisitTrackingAPI.TodayStatsApiV1VisitStatsTodayGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiTodayStatsApiV1VisitStatsTodayGetRequest struct via the builder pattern


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


## TodayStatsApiV1VisitStatsTodayGet_0

> interface{} TodayStatsApiV1VisitStatsTodayGet_0(ctx).Execute()

今日实时统计

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
	resp, r, err := apiClient.VisitTrackingAPI.TodayStatsApiV1VisitStatsTodayGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VisitTrackingAPI.TodayStatsApiV1VisitStatsTodayGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TodayStatsApiV1VisitStatsTodayGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VisitTrackingAPI.TodayStatsApiV1VisitStatsTodayGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiTodayStatsApiV1VisitStatsTodayGet_6Request struct via the builder pattern


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


## TrackApiV1VisitTrackPost

> interface{} TrackApiV1VisitTrackPost(ctx).Path(path).Method(method).QueryParams(queryParams).Referer(referer).UserAgent(userAgent).Ip(ip).Device(device).Os(os).Browser(browser).TargetType(targetType).TargetId(targetId).Duration(duration).Source(source).SessionId(sessionId).UserId(userId).Execute()

记录访问

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
	path := "path_example" // string | 
	method := "method_example" // string |  (optional)
	queryParams := "queryParams_example" // string |  (optional)
	referer := "referer_example" // string |  (optional)
	userAgent := "userAgent_example" // string |  (optional)
	ip := "ip_example" // string |  (optional)
	device := "device_example" // string |  (optional)
	os := "os_example" // string |  (optional)
	browser := "browser_example" // string |  (optional)
	targetType := "targetType_example" // string |  (optional)
	targetId := "targetId_example" // string |  (optional)
	duration := int32(56) // int32 |  (optional) (default to 0)
	source := "source_example" // string |  (optional)
	sessionId := "sessionId_example" // string |  (optional)
	userId := "userId_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VisitTrackingAPI.TrackApiV1VisitTrackPost(context.Background()).Path(path).Method(method).QueryParams(queryParams).Referer(referer).UserAgent(userAgent).Ip(ip).Device(device).Os(os).Browser(browser).TargetType(targetType).TargetId(targetId).Duration(duration).Source(source).SessionId(sessionId).UserId(userId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VisitTrackingAPI.TrackApiV1VisitTrackPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TrackApiV1VisitTrackPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VisitTrackingAPI.TrackApiV1VisitTrackPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTrackApiV1VisitTrackPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **path** | **string** |  | 
 **method** | **string** |  | 
 **queryParams** | **string** |  | 
 **referer** | **string** |  | 
 **userAgent** | **string** |  | 
 **ip** | **string** |  | 
 **device** | **string** |  | 
 **os** | **string** |  | 
 **browser** | **string** |  | 
 **targetType** | **string** |  | 
 **targetId** | **string** |  | 
 **duration** | **int32** |  | [default to 0]
 **source** | **string** |  | 
 **sessionId** | **string** |  | 
 **userId** | **string** |  | 

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


## TrackApiV1VisitTrackPost_0

> interface{} TrackApiV1VisitTrackPost_0(ctx).Path(path).Method(method).QueryParams(queryParams).Referer(referer).UserAgent(userAgent).Ip(ip).Device(device).Os(os).Browser(browser).TargetType(targetType).TargetId(targetId).Duration(duration).Source(source).SessionId(sessionId).UserId(userId).Execute()

记录访问

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
	path := "path_example" // string | 
	method := "method_example" // string |  (optional)
	queryParams := "queryParams_example" // string |  (optional)
	referer := "referer_example" // string |  (optional)
	userAgent := "userAgent_example" // string |  (optional)
	ip := "ip_example" // string |  (optional)
	device := "device_example" // string |  (optional)
	os := "os_example" // string |  (optional)
	browser := "browser_example" // string |  (optional)
	targetType := "targetType_example" // string |  (optional)
	targetId := "targetId_example" // string |  (optional)
	duration := int32(56) // int32 |  (optional) (default to 0)
	source := "source_example" // string |  (optional)
	sessionId := "sessionId_example" // string |  (optional)
	userId := "userId_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VisitTrackingAPI.TrackApiV1VisitTrackPost_0(context.Background()).Path(path).Method(method).QueryParams(queryParams).Referer(referer).UserAgent(userAgent).Ip(ip).Device(device).Os(os).Browser(browser).TargetType(targetType).TargetId(targetId).Duration(duration).Source(source).SessionId(sessionId).UserId(userId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VisitTrackingAPI.TrackApiV1VisitTrackPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TrackApiV1VisitTrackPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VisitTrackingAPI.TrackApiV1VisitTrackPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTrackApiV1VisitTrackPost_7Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **path** | **string** |  | 
 **method** | **string** |  | 
 **queryParams** | **string** |  | 
 **referer** | **string** |  | 
 **userAgent** | **string** |  | 
 **ip** | **string** |  | 
 **device** | **string** |  | 
 **os** | **string** |  | 
 **browser** | **string** |  | 
 **targetType** | **string** |  | 
 **targetId** | **string** |  | 
 **duration** | **int32** |  | [default to 0]
 **source** | **string** |  | 
 **sessionId** | **string** |  | 
 **userId** | **string** |  | 

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


## VisitDailyStats

> interface{} VisitDailyStats(ctx).StartDate(startDate).EndDate(endDate).TargetType(targetType).Execute()

每日访问统计

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
	startDate := "startDate_example" // string |  (optional)
	endDate := "endDate_example" // string |  (optional)
	targetType := "targetType_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VisitTrackingAPI.VisitDailyStats(context.Background()).StartDate(startDate).EndDate(endDate).TargetType(targetType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VisitTrackingAPI.VisitDailyStats``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `VisitDailyStats`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VisitTrackingAPI.VisitDailyStats`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiVisitDailyStatsRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **startDate** | **string** |  | 
 **endDate** | **string** |  | 
 **targetType** | **string** |  | 

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


## VisitDailyStats_0

> interface{} VisitDailyStats_0(ctx).StartDate(startDate).EndDate(endDate).TargetType(targetType).Execute()

每日访问统计

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
	startDate := "startDate_example" // string |  (optional)
	endDate := "endDate_example" // string |  (optional)
	targetType := "targetType_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VisitTrackingAPI.VisitDailyStats_0(context.Background()).StartDate(startDate).EndDate(endDate).TargetType(targetType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VisitTrackingAPI.VisitDailyStats_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `VisitDailyStats_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VisitTrackingAPI.VisitDailyStats_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiVisitDailyStats_8Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **startDate** | **string** |  | 
 **endDate** | **string** |  | 
 **targetType** | **string** |  | 

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

