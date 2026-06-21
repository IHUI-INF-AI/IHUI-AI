# zhs_api.VideoPreloadBreakpointApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**get_breakpoint_api_v1_video_breakpoint_get_get**](VideoPreloadBreakpointApi.md#get_breakpoint_api_v1_video_breakpoint_get_get) | **GET** /api/v1/video/breakpoint/get | 查询断点
[**get_hls_manifest_api_v1_video_hls_manifest_video_id_get**](VideoPreloadBreakpointApi.md#get_hls_manifest_api_v1_video_hls_manifest_video_id_get) | **GET** /api/v1/video/hls/manifest/{videoId} | 取 HLS master.m3u8 文本 (含 .ts 预签名 URL)
[**get_hls_playlist_api_v1_video_hls_playlist_video_id_bitrate_get**](VideoPreloadBreakpointApi.md#get_hls_playlist_api_v1_video_hls_playlist_video_id_bitrate_get) | **GET** /api/v1/video/hls/playlist/{videoId}/{bitrate} | 取单档 m3u8 文本
[**load_from_breakpoint_api_v1_video_breakpoint_load_post**](VideoPreloadBreakpointApi.md#load_from_breakpoint_api_v1_video_breakpoint_load_post) | **POST** /api/v1/video/breakpoint/load | 从断点位置加载视频
[**preload_video_api_v1_video_preload_post**](VideoPreloadBreakpointApi.md#preload_video_api_v1_video_preload_post) | **POST** /api/v1/video/preload | 预读视频指定时间段
[**transcode_hls_api_v1_video_hls_transcode_post**](VideoPreloadBreakpointApi.md#transcode_hls_api_v1_video_hls_transcode_post) | **POST** /api/v1/video/hls/transcode | HLS 多码率转码 (生成 master.m3u8 + .ts)
[**update_breakpoint_api_v1_video_breakpoint_update_post**](VideoPreloadBreakpointApi.md#update_breakpoint_api_v1_video_breakpoint_update_post) | **POST** /api/v1/video/breakpoint/update | 上报当前播放位置


# **get_breakpoint_api_v1_video_breakpoint_get_get**
> object get_breakpoint_api_v1_video_breakpoint_get_get(user_id, video_id)

查询断点

配套查询: GET /api/video/breakpoint/get?userId=&videoId=

### Example


```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.VideoPreloadBreakpointApi(api_client)
    user_id = 'user_id_example' # str | 
    video_id = 'video_id_example' # str | 

    try:
        # 查询断点
        api_response = api_instance.get_breakpoint_api_v1_video_breakpoint_get_get(user_id, video_id)
        print("The response of VideoPreloadBreakpointApi->get_breakpoint_api_v1_video_breakpoint_get_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VideoPreloadBreakpointApi->get_breakpoint_api_v1_video_breakpoint_get_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **user_id** | **str**|  | 
 **video_id** | **str**|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_hls_manifest_api_v1_video_hls_manifest_video_id_get**
> object get_hls_manifest_api_v1_video_hls_manifest_video_id_get(video_id)

取 HLS master.m3u8 文本 (含 .ts 预签名 URL)

GET /api/video/hls/manifest/{videoId} — 纯文本, 前端 hls.js 直接加载.

### Example


```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.VideoPreloadBreakpointApi(api_client)
    video_id = 'video_id_example' # str | 

    try:
        # 取 HLS master.m3u8 文本 (含 .ts 预签名 URL)
        api_response = api_instance.get_hls_manifest_api_v1_video_hls_manifest_video_id_get(video_id)
        print("The response of VideoPreloadBreakpointApi->get_hls_manifest_api_v1_video_hls_manifest_video_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VideoPreloadBreakpointApi->get_hls_manifest_api_v1_video_hls_manifest_video_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_id** | **str**|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_hls_playlist_api_v1_video_hls_playlist_video_id_bitrate_get**
> object get_hls_playlist_api_v1_video_hls_playlist_video_id_bitrate_get(video_id, bitrate)

取单档 m3u8 文本

GET /api/video/hls/playlist/{videoId}/{1080p|720p|480p}

### Example


```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.VideoPreloadBreakpointApi(api_client)
    video_id = 'video_id_example' # str | 
    bitrate = 'bitrate_example' # str | 

    try:
        # 取单档 m3u8 文本
        api_response = api_instance.get_hls_playlist_api_v1_video_hls_playlist_video_id_bitrate_get(video_id, bitrate)
        print("The response of VideoPreloadBreakpointApi->get_hls_playlist_api_v1_video_hls_playlist_video_id_bitrate_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VideoPreloadBreakpointApi->get_hls_playlist_api_v1_video_hls_playlist_video_id_bitrate_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_id** | **str**|  | 
 **bitrate** | **str**|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **load_from_breakpoint_api_v1_video_breakpoint_load_post**
> object load_from_breakpoint_api_v1_video_breakpoint_load_post(breakpoint_req)

从断点位置加载视频

对应 Java: POST /api/video/breakpoint/load

### Example


```python
import zhs_api
from zhs_api.models.breakpoint_req import BreakpointReq
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.VideoPreloadBreakpointApi(api_client)
    breakpoint_req = zhs_api.BreakpointReq() # BreakpointReq | 

    try:
        # 从断点位置加载视频
        api_response = api_instance.load_from_breakpoint_api_v1_video_breakpoint_load_post(breakpoint_req)
        print("The response of VideoPreloadBreakpointApi->load_from_breakpoint_api_v1_video_breakpoint_load_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VideoPreloadBreakpointApi->load_from_breakpoint_api_v1_video_breakpoint_load_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **breakpoint_req** | [**BreakpointReq**](BreakpointReq.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **preload_video_api_v1_video_preload_post**
> object preload_video_api_v1_video_preload_post(preload_req)

预读视频指定时间段

对应 Java: POST /api/video/preload

请求体: { "videoId": "xxx", "videoPath": "可选", "startSeconds": 60, "preloadSeconds": 10 }
返回: { videoId, actualStartSeconds, actualEndSeconds, streamData (base64), streamFormat, duration, size }

### Example


```python
import zhs_api
from zhs_api.models.preload_req import PreloadReq
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.VideoPreloadBreakpointApi(api_client)
    preload_req = zhs_api.PreloadReq() # PreloadReq | 

    try:
        # 预读视频指定时间段
        api_response = api_instance.preload_video_api_v1_video_preload_post(preload_req)
        print("The response of VideoPreloadBreakpointApi->preload_video_api_v1_video_preload_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VideoPreloadBreakpointApi->preload_video_api_v1_video_preload_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **preload_req** | [**PreloadReq**](PreloadReq.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **transcode_hls_api_v1_video_hls_transcode_post**
> object transcode_hls_api_v1_video_hls_transcode_post(hls_transcode_req)

HLS 多码率转码 (生成 master.m3u8 + .ts)

对应 Java: POST /api/video/hls/transcode

流程:
1. 跑 ffmpeg 生成 3 档位 (1080p/720p/480p) .ts 切片 + master.m3u8
2. 所有 .ts 上传 storage
3. 改写 m3u8 把 .ts 路径替换成预签名 URL
4. 改写后的 m3u8 上传 storage, 缓存到 Redis

### Example


```python
import zhs_api
from zhs_api.models.hls_transcode_req import HlsTranscodeReq
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.VideoPreloadBreakpointApi(api_client)
    hls_transcode_req = zhs_api.HlsTranscodeReq() # HlsTranscodeReq | 

    try:
        # HLS 多码率转码 (生成 master.m3u8 + .ts)
        api_response = api_instance.transcode_hls_api_v1_video_hls_transcode_post(hls_transcode_req)
        print("The response of VideoPreloadBreakpointApi->transcode_hls_api_v1_video_hls_transcode_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VideoPreloadBreakpointApi->transcode_hls_api_v1_video_hls_transcode_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **hls_transcode_req** | [**HlsTranscodeReq**](HlsTranscodeReq.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **update_breakpoint_api_v1_video_breakpoint_update_post**
> object update_breakpoint_api_v1_video_breakpoint_update_post(breakpoint_update_req)

上报当前播放位置

对应 Java: POST /api/video/breakpoint/update — 存 Redis

### Example


```python
import zhs_api
from zhs_api.models.breakpoint_update_req import BreakpointUpdateReq
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.VideoPreloadBreakpointApi(api_client)
    breakpoint_update_req = zhs_api.BreakpointUpdateReq() # BreakpointUpdateReq | 

    try:
        # 上报当前播放位置
        api_response = api_instance.update_breakpoint_api_v1_video_breakpoint_update_post(breakpoint_update_req)
        print("The response of VideoPreloadBreakpointApi->update_breakpoint_api_v1_video_breakpoint_update_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VideoPreloadBreakpointApi->update_breakpoint_api_v1_video_breakpoint_update_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **breakpoint_update_req** | [**BreakpointUpdateReq**](BreakpointUpdateReq.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

