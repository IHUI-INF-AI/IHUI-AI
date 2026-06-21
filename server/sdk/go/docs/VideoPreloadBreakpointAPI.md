# \VideoPreloadBreakpointAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetBreakpointApiV1VideoBreakpointGetGet**](VideoPreloadBreakpointAPI.md#GetBreakpointApiV1VideoBreakpointGetGet) | **Get** /api/v1/video/breakpoint/get | 查询断点
[**GetBreakpointApiV1VideoBreakpointGetGet_0**](VideoPreloadBreakpointAPI.md#GetBreakpointApiV1VideoBreakpointGetGet_0) | **Get** /api/v1/video/breakpoint/get | 查询断点
[**GetHlsManifestApiV1VideoHlsManifestVideoIdGet**](VideoPreloadBreakpointAPI.md#GetHlsManifestApiV1VideoHlsManifestVideoIdGet) | **Get** /api/v1/video/hls/manifest/{videoId} | 取 HLS master.m3u8 文本 (含 .ts 预签名 URL)
[**GetHlsManifestApiV1VideoHlsManifestVideoIdGet_0**](VideoPreloadBreakpointAPI.md#GetHlsManifestApiV1VideoHlsManifestVideoIdGet_0) | **Get** /api/v1/video/hls/manifest/{videoId} | 取 HLS master.m3u8 文本 (含 .ts 预签名 URL)
[**GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet**](VideoPreloadBreakpointAPI.md#GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet) | **Get** /api/v1/video/hls/playlist/{videoId}/{bitrate} | 取单档 m3u8 文本
[**GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0**](VideoPreloadBreakpointAPI.md#GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0) | **Get** /api/v1/video/hls/playlist/{videoId}/{bitrate} | 取单档 m3u8 文本
[**LoadFromBreakpointApiV1VideoBreakpointLoadPost**](VideoPreloadBreakpointAPI.md#LoadFromBreakpointApiV1VideoBreakpointLoadPost) | **Post** /api/v1/video/breakpoint/load | 从断点位置加载视频
[**LoadFromBreakpointApiV1VideoBreakpointLoadPost_0**](VideoPreloadBreakpointAPI.md#LoadFromBreakpointApiV1VideoBreakpointLoadPost_0) | **Post** /api/v1/video/breakpoint/load | 从断点位置加载视频
[**PreloadVideoApiV1VideoPreloadPost**](VideoPreloadBreakpointAPI.md#PreloadVideoApiV1VideoPreloadPost) | **Post** /api/v1/video/preload | 预读视频指定时间段
[**PreloadVideoApiV1VideoPreloadPost_0**](VideoPreloadBreakpointAPI.md#PreloadVideoApiV1VideoPreloadPost_0) | **Post** /api/v1/video/preload | 预读视频指定时间段
[**TranscodeHlsApiV1VideoHlsTranscodePost**](VideoPreloadBreakpointAPI.md#TranscodeHlsApiV1VideoHlsTranscodePost) | **Post** /api/v1/video/hls/transcode | HLS 多码率转码 (生成 master.m3u8 + .ts)
[**TranscodeHlsApiV1VideoHlsTranscodePost_0**](VideoPreloadBreakpointAPI.md#TranscodeHlsApiV1VideoHlsTranscodePost_0) | **Post** /api/v1/video/hls/transcode | HLS 多码率转码 (生成 master.m3u8 + .ts)
[**UpdateBreakpointApiV1VideoBreakpointUpdatePost**](VideoPreloadBreakpointAPI.md#UpdateBreakpointApiV1VideoBreakpointUpdatePost) | **Post** /api/v1/video/breakpoint/update | 上报当前播放位置
[**UpdateBreakpointApiV1VideoBreakpointUpdatePost_0**](VideoPreloadBreakpointAPI.md#UpdateBreakpointApiV1VideoBreakpointUpdatePost_0) | **Post** /api/v1/video/breakpoint/update | 上报当前播放位置



## GetBreakpointApiV1VideoBreakpointGetGet

> interface{} GetBreakpointApiV1VideoBreakpointGetGet(ctx).UserId(userId).VideoId(videoId).Execute()

查询断点



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
	userId := "userId_example" // string | 
	videoId := "videoId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VideoPreloadBreakpointAPI.GetBreakpointApiV1VideoBreakpointGetGet(context.Background()).UserId(userId).VideoId(videoId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadBreakpointAPI.GetBreakpointApiV1VideoBreakpointGetGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetBreakpointApiV1VideoBreakpointGetGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadBreakpointAPI.GetBreakpointApiV1VideoBreakpointGetGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetBreakpointApiV1VideoBreakpointGetGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **userId** | **string** |  | 
 **videoId** | **string** |  | 

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


## GetBreakpointApiV1VideoBreakpointGetGet_0

> interface{} GetBreakpointApiV1VideoBreakpointGetGet_0(ctx).UserId(userId).VideoId(videoId).Execute()

查询断点



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
	userId := "userId_example" // string | 
	videoId := "videoId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VideoPreloadBreakpointAPI.GetBreakpointApiV1VideoBreakpointGetGet_0(context.Background()).UserId(userId).VideoId(videoId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadBreakpointAPI.GetBreakpointApiV1VideoBreakpointGetGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetBreakpointApiV1VideoBreakpointGetGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadBreakpointAPI.GetBreakpointApiV1VideoBreakpointGetGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetBreakpointApiV1VideoBreakpointGetGet_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **userId** | **string** |  | 
 **videoId** | **string** |  | 

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


## GetHlsManifestApiV1VideoHlsManifestVideoIdGet

> interface{} GetHlsManifestApiV1VideoHlsManifestVideoIdGet(ctx, videoId).Execute()

取 HLS master.m3u8 文本 (含 .ts 预签名 URL)



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
	videoId := "videoId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VideoPreloadBreakpointAPI.GetHlsManifestApiV1VideoHlsManifestVideoIdGet(context.Background(), videoId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadBreakpointAPI.GetHlsManifestApiV1VideoHlsManifestVideoIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetHlsManifestApiV1VideoHlsManifestVideoIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadBreakpointAPI.GetHlsManifestApiV1VideoHlsManifestVideoIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**videoId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetHlsManifestApiV1VideoHlsManifestVideoIdGetRequest struct via the builder pattern


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


## GetHlsManifestApiV1VideoHlsManifestVideoIdGet_0

> interface{} GetHlsManifestApiV1VideoHlsManifestVideoIdGet_0(ctx, videoId).Execute()

取 HLS master.m3u8 文本 (含 .ts 预签名 URL)



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
	videoId := "videoId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VideoPreloadBreakpointAPI.GetHlsManifestApiV1VideoHlsManifestVideoIdGet_0(context.Background(), videoId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadBreakpointAPI.GetHlsManifestApiV1VideoHlsManifestVideoIdGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetHlsManifestApiV1VideoHlsManifestVideoIdGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadBreakpointAPI.GetHlsManifestApiV1VideoHlsManifestVideoIdGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**videoId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetHlsManifestApiV1VideoHlsManifestVideoIdGet_2Request struct via the builder pattern


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


## GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet

> interface{} GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet(ctx, videoId, bitrate).Execute()

取单档 m3u8 文本



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
	videoId := "videoId_example" // string | 
	bitrate := "bitrate_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VideoPreloadBreakpointAPI.GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet(context.Background(), videoId, bitrate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadBreakpointAPI.GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadBreakpointAPI.GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**videoId** | **string** |  | 
**bitrate** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGetRequest struct via the builder pattern


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


## GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0

> interface{} GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0(ctx, videoId, bitrate).Execute()

取单档 m3u8 文本



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
	videoId := "videoId_example" // string | 
	bitrate := "bitrate_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VideoPreloadBreakpointAPI.GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0(context.Background(), videoId, bitrate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadBreakpointAPI.GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadBreakpointAPI.GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**videoId** | **string** |  | 
**bitrate** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_3Request struct via the builder pattern


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


## LoadFromBreakpointApiV1VideoBreakpointLoadPost

> interface{} LoadFromBreakpointApiV1VideoBreakpointLoadPost(ctx).BreakpointReq(breakpointReq).Execute()

从断点位置加载视频



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
	breakpointReq := *openapiclient.NewBreakpointReq("VideoId_example", float32(123)) // BreakpointReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VideoPreloadBreakpointAPI.LoadFromBreakpointApiV1VideoBreakpointLoadPost(context.Background()).BreakpointReq(breakpointReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadBreakpointAPI.LoadFromBreakpointApiV1VideoBreakpointLoadPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LoadFromBreakpointApiV1VideoBreakpointLoadPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadBreakpointAPI.LoadFromBreakpointApiV1VideoBreakpointLoadPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiLoadFromBreakpointApiV1VideoBreakpointLoadPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **breakpointReq** | [**BreakpointReq**](BreakpointReq.md) |  | 

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


## LoadFromBreakpointApiV1VideoBreakpointLoadPost_0

> interface{} LoadFromBreakpointApiV1VideoBreakpointLoadPost_0(ctx).BreakpointReq(breakpointReq).Execute()

从断点位置加载视频



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
	breakpointReq := *openapiclient.NewBreakpointReq("VideoId_example", float32(123)) // BreakpointReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VideoPreloadBreakpointAPI.LoadFromBreakpointApiV1VideoBreakpointLoadPost_0(context.Background()).BreakpointReq(breakpointReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadBreakpointAPI.LoadFromBreakpointApiV1VideoBreakpointLoadPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LoadFromBreakpointApiV1VideoBreakpointLoadPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadBreakpointAPI.LoadFromBreakpointApiV1VideoBreakpointLoadPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiLoadFromBreakpointApiV1VideoBreakpointLoadPost_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **breakpointReq** | [**BreakpointReq**](BreakpointReq.md) |  | 

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


## PreloadVideoApiV1VideoPreloadPost

> interface{} PreloadVideoApiV1VideoPreloadPost(ctx).PreloadReq(preloadReq).Execute()

预读视频指定时间段



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
	preloadReq := *openapiclient.NewPreloadReq("VideoId_example", float32(123)) // PreloadReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VideoPreloadBreakpointAPI.PreloadVideoApiV1VideoPreloadPost(context.Background()).PreloadReq(preloadReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadBreakpointAPI.PreloadVideoApiV1VideoPreloadPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PreloadVideoApiV1VideoPreloadPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadBreakpointAPI.PreloadVideoApiV1VideoPreloadPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPreloadVideoApiV1VideoPreloadPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **preloadReq** | [**PreloadReq**](PreloadReq.md) |  | 

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


## PreloadVideoApiV1VideoPreloadPost_0

> interface{} PreloadVideoApiV1VideoPreloadPost_0(ctx).PreloadReq(preloadReq).Execute()

预读视频指定时间段



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
	preloadReq := *openapiclient.NewPreloadReq("VideoId_example", float32(123)) // PreloadReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VideoPreloadBreakpointAPI.PreloadVideoApiV1VideoPreloadPost_0(context.Background()).PreloadReq(preloadReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadBreakpointAPI.PreloadVideoApiV1VideoPreloadPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PreloadVideoApiV1VideoPreloadPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadBreakpointAPI.PreloadVideoApiV1VideoPreloadPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPreloadVideoApiV1VideoPreloadPost_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **preloadReq** | [**PreloadReq**](PreloadReq.md) |  | 

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


## TranscodeHlsApiV1VideoHlsTranscodePost

> interface{} TranscodeHlsApiV1VideoHlsTranscodePost(ctx).HlsTranscodeReq(hlsTranscodeReq).Execute()

HLS 多码率转码 (生成 master.m3u8 + .ts)



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
	hlsTranscodeReq := *openapiclient.NewHlsTranscodeReq("VideoId_example") // HlsTranscodeReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VideoPreloadBreakpointAPI.TranscodeHlsApiV1VideoHlsTranscodePost(context.Background()).HlsTranscodeReq(hlsTranscodeReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadBreakpointAPI.TranscodeHlsApiV1VideoHlsTranscodePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TranscodeHlsApiV1VideoHlsTranscodePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadBreakpointAPI.TranscodeHlsApiV1VideoHlsTranscodePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTranscodeHlsApiV1VideoHlsTranscodePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **hlsTranscodeReq** | [**HlsTranscodeReq**](HlsTranscodeReq.md) |  | 

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


## TranscodeHlsApiV1VideoHlsTranscodePost_0

> interface{} TranscodeHlsApiV1VideoHlsTranscodePost_0(ctx).HlsTranscodeReq(hlsTranscodeReq).Execute()

HLS 多码率转码 (生成 master.m3u8 + .ts)



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
	hlsTranscodeReq := *openapiclient.NewHlsTranscodeReq("VideoId_example") // HlsTranscodeReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VideoPreloadBreakpointAPI.TranscodeHlsApiV1VideoHlsTranscodePost_0(context.Background()).HlsTranscodeReq(hlsTranscodeReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadBreakpointAPI.TranscodeHlsApiV1VideoHlsTranscodePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TranscodeHlsApiV1VideoHlsTranscodePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadBreakpointAPI.TranscodeHlsApiV1VideoHlsTranscodePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTranscodeHlsApiV1VideoHlsTranscodePost_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **hlsTranscodeReq** | [**HlsTranscodeReq**](HlsTranscodeReq.md) |  | 

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


## UpdateBreakpointApiV1VideoBreakpointUpdatePost

> interface{} UpdateBreakpointApiV1VideoBreakpointUpdatePost(ctx).BreakpointUpdateReq(breakpointUpdateReq).Execute()

上报当前播放位置



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
	breakpointUpdateReq := *openapiclient.NewBreakpointUpdateReq("VideoId_example", "UserId_example", float32(123)) // BreakpointUpdateReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VideoPreloadBreakpointAPI.UpdateBreakpointApiV1VideoBreakpointUpdatePost(context.Background()).BreakpointUpdateReq(breakpointUpdateReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadBreakpointAPI.UpdateBreakpointApiV1VideoBreakpointUpdatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateBreakpointApiV1VideoBreakpointUpdatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadBreakpointAPI.UpdateBreakpointApiV1VideoBreakpointUpdatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateBreakpointApiV1VideoBreakpointUpdatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **breakpointUpdateReq** | [**BreakpointUpdateReq**](BreakpointUpdateReq.md) |  | 

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


## UpdateBreakpointApiV1VideoBreakpointUpdatePost_0

> interface{} UpdateBreakpointApiV1VideoBreakpointUpdatePost_0(ctx).BreakpointUpdateReq(breakpointUpdateReq).Execute()

上报当前播放位置



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
	breakpointUpdateReq := *openapiclient.NewBreakpointUpdateReq("VideoId_example", "UserId_example", float32(123)) // BreakpointUpdateReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VideoPreloadBreakpointAPI.UpdateBreakpointApiV1VideoBreakpointUpdatePost_0(context.Background()).BreakpointUpdateReq(breakpointUpdateReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VideoPreloadBreakpointAPI.UpdateBreakpointApiV1VideoBreakpointUpdatePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateBreakpointApiV1VideoBreakpointUpdatePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VideoPreloadBreakpointAPI.UpdateBreakpointApiV1VideoBreakpointUpdatePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateBreakpointApiV1VideoBreakpointUpdatePost_7Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **breakpointUpdateReq** | [**BreakpointUpdateReq**](BreakpointUpdateReq.md) |  | 

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

