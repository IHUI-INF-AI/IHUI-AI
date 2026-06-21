# \VideoPreloadAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreatePreloadApiV1VideoPreloadPost**](VideoPreloadAPI.md#CreatePreloadApiV1VideoPreloadPost) | **Post** /api/v1/video-preload | 创建预读任务
[**CreatePreloadApiV1VideoPreloadPost_0**](VideoPreloadAPI.md#CreatePreloadApiV1VideoPreloadPost_0) | **Post** /api/v1/video-preload | 创建预读任务
[**DeletePreloadApiV1VideoPreloadPidDelete**](VideoPreloadAPI.md#DeletePreloadApiV1VideoPreloadPidDelete) | **Delete** /api/v1/video-preload/{pid} | 删除预读任务
[**DeletePreloadApiV1VideoPreloadPidDelete_0**](VideoPreloadAPI.md#DeletePreloadApiV1VideoPreloadPidDelete_0) | **Delete** /api/v1/video-preload/{pid} | 删除预读任务
[**ListPreloadsApiV1VideoPreloadListGet**](VideoPreloadAPI.md#ListPreloadsApiV1VideoPreloadListGet) | **Get** /api/v1/video-preload/list | 我的预读任务
[**ListPreloadsApiV1VideoPreloadListGet_0**](VideoPreloadAPI.md#ListPreloadsApiV1VideoPreloadListGet_0) | **Get** /api/v1/video-preload/list | 我的预读任务
[**MarkCompleteApiV1VideoPreloadPidCompletePut**](VideoPreloadAPI.md#MarkCompleteApiV1VideoPreloadPidCompletePut) | **Put** /api/v1/video-preload/{pid}/complete | 标记完成
[**MarkCompleteApiV1VideoPreloadPidCompletePut_0**](VideoPreloadAPI.md#MarkCompleteApiV1VideoPreloadPidCompletePut_0) | **Put** /api/v1/video-preload/{pid}/complete | 标记完成



## CreatePreloadApiV1VideoPreloadPost

> interface{} CreatePreloadApiV1VideoPreloadPost(ctx).VideoId(videoId).StartTime(startTime).EndTime(endTime).IsChunked(isChunked).VideoUrl(videoUrl).Execute()

创建预读任务

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
	startTime := int32(56) // int32 |  (optional) (default to 0)
	endTime := int32(56) // int32 |  (optional) (default to 0)
	isChunked := true // bool |  (optional) (default to true)
	videoUrl := "videoUrl_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VideoPreloadAPI.CreatePreloadApiV1VideoPreloadPost(context.Background()).VideoId(videoId).StartTime(startTime).EndTime(endTime).IsChunked(isChunked).VideoUrl(videoUrl).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadAPI.CreatePreloadApiV1VideoPreloadPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreatePreloadApiV1VideoPreloadPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadAPI.CreatePreloadApiV1VideoPreloadPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreatePreloadApiV1VideoPreloadPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **videoId** | **int32** |  | 
 **startTime** | **int32** |  | [default to 0]
 **endTime** | **int32** |  | [default to 0]
 **isChunked** | **bool** |  | [default to true]
 **videoUrl** | **string** |  | 

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


## CreatePreloadApiV1VideoPreloadPost_0

> interface{} CreatePreloadApiV1VideoPreloadPost_0(ctx).VideoId(videoId).StartTime(startTime).EndTime(endTime).IsChunked(isChunked).VideoUrl(videoUrl).Execute()

创建预读任务

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
	startTime := int32(56) // int32 |  (optional) (default to 0)
	endTime := int32(56) // int32 |  (optional) (default to 0)
	isChunked := true // bool |  (optional) (default to true)
	videoUrl := "videoUrl_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VideoPreloadAPI.CreatePreloadApiV1VideoPreloadPost_0(context.Background()).VideoId(videoId).StartTime(startTime).EndTime(endTime).IsChunked(isChunked).VideoUrl(videoUrl).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadAPI.CreatePreloadApiV1VideoPreloadPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreatePreloadApiV1VideoPreloadPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadAPI.CreatePreloadApiV1VideoPreloadPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreatePreloadApiV1VideoPreloadPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **videoId** | **int32** |  | 
 **startTime** | **int32** |  | [default to 0]
 **endTime** | **int32** |  | [default to 0]
 **isChunked** | **bool** |  | [default to true]
 **videoUrl** | **string** |  | 

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


## DeletePreloadApiV1VideoPreloadPidDelete

> interface{} DeletePreloadApiV1VideoPreloadPidDelete(ctx, pid).Execute()

删除预读任务

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
	resp, r, err := apiClient.VideoPreloadAPI.DeletePreloadApiV1VideoPreloadPidDelete(context.Background(), pid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadAPI.DeletePreloadApiV1VideoPreloadPidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeletePreloadApiV1VideoPreloadPidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadAPI.DeletePreloadApiV1VideoPreloadPidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeletePreloadApiV1VideoPreloadPidDeleteRequest struct via the builder pattern


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


## DeletePreloadApiV1VideoPreloadPidDelete_0

> interface{} DeletePreloadApiV1VideoPreloadPidDelete_0(ctx, pid).Execute()

删除预读任务

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
	resp, r, err := apiClient.VideoPreloadAPI.DeletePreloadApiV1VideoPreloadPidDelete_0(context.Background(), pid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadAPI.DeletePreloadApiV1VideoPreloadPidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeletePreloadApiV1VideoPreloadPidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadAPI.DeletePreloadApiV1VideoPreloadPidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeletePreloadApiV1VideoPreloadPidDelete_2Request struct via the builder pattern


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


## ListPreloadsApiV1VideoPreloadListGet

> interface{} ListPreloadsApiV1VideoPreloadListGet(ctx).Page(page).Limit(limit).VideoId(videoId).Execute()

我的预读任务

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VideoPreloadAPI.ListPreloadsApiV1VideoPreloadListGet(context.Background()).Page(page).Limit(limit).VideoId(videoId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadAPI.ListPreloadsApiV1VideoPreloadListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListPreloadsApiV1VideoPreloadListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadAPI.ListPreloadsApiV1VideoPreloadListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListPreloadsApiV1VideoPreloadListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **videoId** | **int32** |  | 

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


## ListPreloadsApiV1VideoPreloadListGet_0

> interface{} ListPreloadsApiV1VideoPreloadListGet_0(ctx).Page(page).Limit(limit).VideoId(videoId).Execute()

我的预读任务

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VideoPreloadAPI.ListPreloadsApiV1VideoPreloadListGet_0(context.Background()).Page(page).Limit(limit).VideoId(videoId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadAPI.ListPreloadsApiV1VideoPreloadListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListPreloadsApiV1VideoPreloadListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadAPI.ListPreloadsApiV1VideoPreloadListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListPreloadsApiV1VideoPreloadListGet_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **videoId** | **int32** |  | 

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


## MarkCompleteApiV1VideoPreloadPidCompletePut

> interface{} MarkCompleteApiV1VideoPreloadPidCompletePut(ctx, pid).Execute()

标记完成

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
	resp, r, err := apiClient.VideoPreloadAPI.MarkCompleteApiV1VideoPreloadPidCompletePut(context.Background(), pid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadAPI.MarkCompleteApiV1VideoPreloadPidCompletePut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MarkCompleteApiV1VideoPreloadPidCompletePut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadAPI.MarkCompleteApiV1VideoPreloadPidCompletePut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiMarkCompleteApiV1VideoPreloadPidCompletePutRequest struct via the builder pattern


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


## MarkCompleteApiV1VideoPreloadPidCompletePut_0

> interface{} MarkCompleteApiV1VideoPreloadPidCompletePut_0(ctx, pid).Execute()

标记完成

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
	resp, r, err := apiClient.VideoPreloadAPI.MarkCompleteApiV1VideoPreloadPidCompletePut_0(context.Background(), pid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadAPI.MarkCompleteApiV1VideoPreloadPidCompletePut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MarkCompleteApiV1VideoPreloadPidCompletePut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadAPI.MarkCompleteApiV1VideoPreloadPidCompletePut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiMarkCompleteApiV1VideoPreloadPidCompletePut_4Request struct via the builder pattern


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

