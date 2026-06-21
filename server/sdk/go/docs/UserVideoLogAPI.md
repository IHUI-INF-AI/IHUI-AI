# \UserVideoLogAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**RecordWatchApiV1UserVideoLogRecordPost**](UserVideoLogAPI.md#RecordWatchApiV1UserVideoLogRecordPost) | **Post** /api/v1/user-video-log/record | 记录视频观看
[**RecordWatchApiV1UserVideoLogRecordPost_0**](UserVideoLogAPI.md#RecordWatchApiV1UserVideoLogRecordPost_0) | **Post** /api/v1/user-video-log/record | 记录视频观看
[**StatsApiV1UserVideoLogStatsGet**](UserVideoLogAPI.md#StatsApiV1UserVideoLogStatsGet) | **Get** /api/v1/user-video-log/stats | 观看统计
[**StatsApiV1UserVideoLogStatsGet_0**](UserVideoLogAPI.md#StatsApiV1UserVideoLogStatsGet_0) | **Get** /api/v1/user-video-log/stats | 观看统计
[**UserVideoLogList**](UserVideoLogAPI.md#UserVideoLogList) | **Get** /api/v1/user-video-log/list | 我的观看记录
[**UserVideoLogList_0**](UserVideoLogAPI.md#UserVideoLogList_0) | **Get** /api/v1/user-video-log/list | 我的观看记录



## RecordWatchApiV1UserVideoLogRecordPost

> interface{} RecordWatchApiV1UserVideoLogRecordPost(ctx).VideoId(videoId).Duration(duration).Watched(watched).Device(device).Ip(ip).IsCompleted(isCompleted).IsFinished(isFinished).VideoTitle(videoTitle).Execute()

记录视频观看

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
	duration := int32(56) // int32 |  (optional) (default to 0)
	watched := int32(56) // int32 |  (optional) (default to 0)
	device := "device_example" // string |  (optional)
	ip := "ip_example" // string |  (optional)
	isCompleted := true // bool |  (optional) (default to false)
	isFinished := true // bool |  (optional) (default to false)
	videoTitle := "videoTitle_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserVideoLogAPI.RecordWatchApiV1UserVideoLogRecordPost(context.Background()).VideoId(videoId).Duration(duration).Watched(watched).Device(device).Ip(ip).IsCompleted(isCompleted).IsFinished(isFinished).VideoTitle(videoTitle).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserVideoLogAPI.RecordWatchApiV1UserVideoLogRecordPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RecordWatchApiV1UserVideoLogRecordPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserVideoLogAPI.RecordWatchApiV1UserVideoLogRecordPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRecordWatchApiV1UserVideoLogRecordPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **videoId** | **int32** |  | 
 **duration** | **int32** |  | [default to 0]
 **watched** | **int32** |  | [default to 0]
 **device** | **string** |  | 
 **ip** | **string** |  | 
 **isCompleted** | **bool** |  | [default to false]
 **isFinished** | **bool** |  | [default to false]
 **videoTitle** | **string** |  | 

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


## RecordWatchApiV1UserVideoLogRecordPost_0

> interface{} RecordWatchApiV1UserVideoLogRecordPost_0(ctx).VideoId(videoId).Duration(duration).Watched(watched).Device(device).Ip(ip).IsCompleted(isCompleted).IsFinished(isFinished).VideoTitle(videoTitle).Execute()

记录视频观看

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
	duration := int32(56) // int32 |  (optional) (default to 0)
	watched := int32(56) // int32 |  (optional) (default to 0)
	device := "device_example" // string |  (optional)
	ip := "ip_example" // string |  (optional)
	isCompleted := true // bool |  (optional) (default to false)
	isFinished := true // bool |  (optional) (default to false)
	videoTitle := "videoTitle_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserVideoLogAPI.RecordWatchApiV1UserVideoLogRecordPost_0(context.Background()).VideoId(videoId).Duration(duration).Watched(watched).Device(device).Ip(ip).IsCompleted(isCompleted).IsFinished(isFinished).VideoTitle(videoTitle).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserVideoLogAPI.RecordWatchApiV1UserVideoLogRecordPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RecordWatchApiV1UserVideoLogRecordPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserVideoLogAPI.RecordWatchApiV1UserVideoLogRecordPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRecordWatchApiV1UserVideoLogRecordPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **videoId** | **int32** |  | 
 **duration** | **int32** |  | [default to 0]
 **watched** | **int32** |  | [default to 0]
 **device** | **string** |  | 
 **ip** | **string** |  | 
 **isCompleted** | **bool** |  | [default to false]
 **isFinished** | **bool** |  | [default to false]
 **videoTitle** | **string** |  | 

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


## StatsApiV1UserVideoLogStatsGet

> interface{} StatsApiV1UserVideoLogStatsGet(ctx).Execute()

观看统计

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
	resp, r, err := apiClient.UserVideoLogAPI.StatsApiV1UserVideoLogStatsGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserVideoLogAPI.StatsApiV1UserVideoLogStatsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StatsApiV1UserVideoLogStatsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserVideoLogAPI.StatsApiV1UserVideoLogStatsGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiStatsApiV1UserVideoLogStatsGetRequest struct via the builder pattern


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


## StatsApiV1UserVideoLogStatsGet_0

> interface{} StatsApiV1UserVideoLogStatsGet_0(ctx).Execute()

观看统计

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
	resp, r, err := apiClient.UserVideoLogAPI.StatsApiV1UserVideoLogStatsGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserVideoLogAPI.StatsApiV1UserVideoLogStatsGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StatsApiV1UserVideoLogStatsGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserVideoLogAPI.StatsApiV1UserVideoLogStatsGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiStatsApiV1UserVideoLogStatsGet_2Request struct via the builder pattern


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


## UserVideoLogList

> interface{} UserVideoLogList(ctx).Page(page).Limit(limit).VideoId(videoId).IsFinished(isFinished).Execute()

我的观看记录

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
	videoId := int32(56) // int32 |  (optional)
	isFinished := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserVideoLogAPI.UserVideoLogList(context.Background()).Page(page).Limit(limit).VideoId(videoId).IsFinished(isFinished).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserVideoLogAPI.UserVideoLogList``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UserVideoLogList`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserVideoLogAPI.UserVideoLogList`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUserVideoLogListRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **videoId** | **int32** |  | 
 **isFinished** | **bool** |  | 

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


## UserVideoLogList_0

> interface{} UserVideoLogList_0(ctx).Page(page).Limit(limit).VideoId(videoId).IsFinished(isFinished).Execute()

我的观看记录

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
	videoId := int32(56) // int32 |  (optional)
	isFinished := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserVideoLogAPI.UserVideoLogList_0(context.Background()).Page(page).Limit(limit).VideoId(videoId).IsFinished(isFinished).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserVideoLogAPI.UserVideoLogList_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UserVideoLogList_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserVideoLogAPI.UserVideoLogList_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUserVideoLogList_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **videoId** | **int32** |  | 
 **isFinished** | **bool** |  | 

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

