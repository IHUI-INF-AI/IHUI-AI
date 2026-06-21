# VideoPreloadBreakpointApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getBreakpointApiV1VideoBreakpointGetGet**](#getbreakpointapiv1videobreakpointgetget) | **GET** /api/v1/video/breakpoint/get | 查询断点|
|[**getBreakpointApiV1VideoBreakpointGetGet_0**](#getbreakpointapiv1videobreakpointgetget_0) | **GET** /api/v1/video/breakpoint/get | 查询断点|
|[**getHlsManifestApiV1VideoHlsManifestVideoIdGet**](#gethlsmanifestapiv1videohlsmanifestvideoidget) | **GET** /api/v1/video/hls/manifest/{videoId} | 取 HLS master.m3u8 文本 (含 .ts 预签名 URL)|
|[**getHlsManifestApiV1VideoHlsManifestVideoIdGet_0**](#gethlsmanifestapiv1videohlsmanifestvideoidget_0) | **GET** /api/v1/video/hls/manifest/{videoId} | 取 HLS master.m3u8 文本 (含 .ts 预签名 URL)|
|[**getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet**](#gethlsplaylistapiv1videohlsplaylistvideoidbitrateget) | **GET** /api/v1/video/hls/playlist/{videoId}/{bitrate} | 取单档 m3u8 文本|
|[**getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0**](#gethlsplaylistapiv1videohlsplaylistvideoidbitrateget_0) | **GET** /api/v1/video/hls/playlist/{videoId}/{bitrate} | 取单档 m3u8 文本|
|[**loadFromBreakpointApiV1VideoBreakpointLoadPost**](#loadfrombreakpointapiv1videobreakpointloadpost) | **POST** /api/v1/video/breakpoint/load | 从断点位置加载视频|
|[**loadFromBreakpointApiV1VideoBreakpointLoadPost_0**](#loadfrombreakpointapiv1videobreakpointloadpost_0) | **POST** /api/v1/video/breakpoint/load | 从断点位置加载视频|
|[**preloadVideoApiV1VideoPreloadPost**](#preloadvideoapiv1videopreloadpost) | **POST** /api/v1/video/preload | 预读视频指定时间段|
|[**preloadVideoApiV1VideoPreloadPost_0**](#preloadvideoapiv1videopreloadpost_0) | **POST** /api/v1/video/preload | 预读视频指定时间段|
|[**transcodeHlsApiV1VideoHlsTranscodePost**](#transcodehlsapiv1videohlstranscodepost) | **POST** /api/v1/video/hls/transcode | HLS 多码率转码 (生成 master.m3u8 + .ts)|
|[**transcodeHlsApiV1VideoHlsTranscodePost_0**](#transcodehlsapiv1videohlstranscodepost_0) | **POST** /api/v1/video/hls/transcode | HLS 多码率转码 (生成 master.m3u8 + .ts)|
|[**updateBreakpointApiV1VideoBreakpointUpdatePost**](#updatebreakpointapiv1videobreakpointupdatepost) | **POST** /api/v1/video/breakpoint/update | 上报当前播放位置|
|[**updateBreakpointApiV1VideoBreakpointUpdatePost_0**](#updatebreakpointapiv1videobreakpointupdatepost_0) | **POST** /api/v1/video/breakpoint/update | 上报当前播放位置|

# **getBreakpointApiV1VideoBreakpointGetGet**
> any getBreakpointApiV1VideoBreakpointGetGet()

配套查询: GET /api/video/breakpoint/get?userId=&videoId=

### Example

```typescript
import {
    VideoPreloadBreakpointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadBreakpointApi(configuration);

let userId: string; // (default to undefined)
let videoId: string; // (default to undefined)

const { status, data } = await apiInstance.getBreakpointApiV1VideoBreakpointGetGet(
    userId,
    videoId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**string**] |  | defaults to undefined|
| **videoId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getBreakpointApiV1VideoBreakpointGetGet_0**
> any getBreakpointApiV1VideoBreakpointGetGet_0()

配套查询: GET /api/video/breakpoint/get?userId=&videoId=

### Example

```typescript
import {
    VideoPreloadBreakpointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadBreakpointApi(configuration);

let userId: string; // (default to undefined)
let videoId: string; // (default to undefined)

const { status, data } = await apiInstance.getBreakpointApiV1VideoBreakpointGetGet_0(
    userId,
    videoId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**string**] |  | defaults to undefined|
| **videoId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getHlsManifestApiV1VideoHlsManifestVideoIdGet**
> any getHlsManifestApiV1VideoHlsManifestVideoIdGet()

GET /api/video/hls/manifest/{videoId} — 纯文本, 前端 hls.js 直接加载.

### Example

```typescript
import {
    VideoPreloadBreakpointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadBreakpointApi(configuration);

let videoId: string; // (default to undefined)

const { status, data } = await apiInstance.getHlsManifestApiV1VideoHlsManifestVideoIdGet(
    videoId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getHlsManifestApiV1VideoHlsManifestVideoIdGet_0**
> any getHlsManifestApiV1VideoHlsManifestVideoIdGet_0()

GET /api/video/hls/manifest/{videoId} — 纯文本, 前端 hls.js 直接加载.

### Example

```typescript
import {
    VideoPreloadBreakpointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadBreakpointApi(configuration);

let videoId: string; // (default to undefined)

const { status, data } = await apiInstance.getHlsManifestApiV1VideoHlsManifestVideoIdGet_0(
    videoId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet**
> any getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet()

GET /api/video/hls/playlist/{videoId}/{1080p|720p|480p}

### Example

```typescript
import {
    VideoPreloadBreakpointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadBreakpointApi(configuration);

let videoId: string; // (default to undefined)
let bitrate: string; // (default to undefined)

const { status, data } = await apiInstance.getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet(
    videoId,
    bitrate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoId** | [**string**] |  | defaults to undefined|
| **bitrate** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0**
> any getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0()

GET /api/video/hls/playlist/{videoId}/{1080p|720p|480p}

### Example

```typescript
import {
    VideoPreloadBreakpointApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadBreakpointApi(configuration);

let videoId: string; // (default to undefined)
let bitrate: string; // (default to undefined)

const { status, data } = await apiInstance.getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0(
    videoId,
    bitrate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoId** | [**string**] |  | defaults to undefined|
| **bitrate** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **loadFromBreakpointApiV1VideoBreakpointLoadPost**
> any loadFromBreakpointApiV1VideoBreakpointLoadPost(breakpointReq)

对应 Java: POST /api/video/breakpoint/load

### Example

```typescript
import {
    VideoPreloadBreakpointApi,
    Configuration,
    BreakpointReq
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadBreakpointApi(configuration);

let breakpointReq: BreakpointReq; //

const { status, data } = await apiInstance.loadFromBreakpointApiV1VideoBreakpointLoadPost(
    breakpointReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **breakpointReq** | **BreakpointReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **loadFromBreakpointApiV1VideoBreakpointLoadPost_0**
> any loadFromBreakpointApiV1VideoBreakpointLoadPost_0(breakpointReq)

对应 Java: POST /api/video/breakpoint/load

### Example

```typescript
import {
    VideoPreloadBreakpointApi,
    Configuration,
    BreakpointReq
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadBreakpointApi(configuration);

let breakpointReq: BreakpointReq; //

const { status, data } = await apiInstance.loadFromBreakpointApiV1VideoBreakpointLoadPost_0(
    breakpointReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **breakpointReq** | **BreakpointReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **preloadVideoApiV1VideoPreloadPost**
> any preloadVideoApiV1VideoPreloadPost(preloadReq)

对应 Java: POST /api/video/preload  请求体: { \"videoId\": \"xxx\", \"videoPath\": \"可选\", \"startSeconds\": 60, \"preloadSeconds\": 10 } 返回: { videoId, actualStartSeconds, actualEndSeconds, streamData (base64), streamFormat, duration, size }

### Example

```typescript
import {
    VideoPreloadBreakpointApi,
    Configuration,
    PreloadReq
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadBreakpointApi(configuration);

let preloadReq: PreloadReq; //

const { status, data } = await apiInstance.preloadVideoApiV1VideoPreloadPost(
    preloadReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **preloadReq** | **PreloadReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **preloadVideoApiV1VideoPreloadPost_0**
> any preloadVideoApiV1VideoPreloadPost_0(preloadReq)

对应 Java: POST /api/video/preload  请求体: { \"videoId\": \"xxx\", \"videoPath\": \"可选\", \"startSeconds\": 60, \"preloadSeconds\": 10 } 返回: { videoId, actualStartSeconds, actualEndSeconds, streamData (base64), streamFormat, duration, size }

### Example

```typescript
import {
    VideoPreloadBreakpointApi,
    Configuration,
    PreloadReq
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadBreakpointApi(configuration);

let preloadReq: PreloadReq; //

const { status, data } = await apiInstance.preloadVideoApiV1VideoPreloadPost_0(
    preloadReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **preloadReq** | **PreloadReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **transcodeHlsApiV1VideoHlsTranscodePost**
> any transcodeHlsApiV1VideoHlsTranscodePost(hlsTranscodeReq)

对应 Java: POST /api/video/hls/transcode  流程: 1. 跑 ffmpeg 生成 3 档位 (1080p/720p/480p) .ts 切片 + master.m3u8 2. 所有 .ts 上传 storage 3. 改写 m3u8 把 .ts 路径替换成预签名 URL 4. 改写后的 m3u8 上传 storage, 缓存到 Redis

### Example

```typescript
import {
    VideoPreloadBreakpointApi,
    Configuration,
    HlsTranscodeReq
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadBreakpointApi(configuration);

let hlsTranscodeReq: HlsTranscodeReq; //

const { status, data } = await apiInstance.transcodeHlsApiV1VideoHlsTranscodePost(
    hlsTranscodeReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **hlsTranscodeReq** | **HlsTranscodeReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **transcodeHlsApiV1VideoHlsTranscodePost_0**
> any transcodeHlsApiV1VideoHlsTranscodePost_0(hlsTranscodeReq)

对应 Java: POST /api/video/hls/transcode  流程: 1. 跑 ffmpeg 生成 3 档位 (1080p/720p/480p) .ts 切片 + master.m3u8 2. 所有 .ts 上传 storage 3. 改写 m3u8 把 .ts 路径替换成预签名 URL 4. 改写后的 m3u8 上传 storage, 缓存到 Redis

### Example

```typescript
import {
    VideoPreloadBreakpointApi,
    Configuration,
    HlsTranscodeReq
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadBreakpointApi(configuration);

let hlsTranscodeReq: HlsTranscodeReq; //

const { status, data } = await apiInstance.transcodeHlsApiV1VideoHlsTranscodePost_0(
    hlsTranscodeReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **hlsTranscodeReq** | **HlsTranscodeReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateBreakpointApiV1VideoBreakpointUpdatePost**
> any updateBreakpointApiV1VideoBreakpointUpdatePost(breakpointUpdateReq)

对应 Java: POST /api/video/breakpoint/update — 存 Redis

### Example

```typescript
import {
    VideoPreloadBreakpointApi,
    Configuration,
    BreakpointUpdateReq
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadBreakpointApi(configuration);

let breakpointUpdateReq: BreakpointUpdateReq; //

const { status, data } = await apiInstance.updateBreakpointApiV1VideoBreakpointUpdatePost(
    breakpointUpdateReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **breakpointUpdateReq** | **BreakpointUpdateReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateBreakpointApiV1VideoBreakpointUpdatePost_0**
> any updateBreakpointApiV1VideoBreakpointUpdatePost_0(breakpointUpdateReq)

对应 Java: POST /api/video/breakpoint/update — 存 Redis

### Example

```typescript
import {
    VideoPreloadBreakpointApi,
    Configuration,
    BreakpointUpdateReq
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadBreakpointApi(configuration);

let breakpointUpdateReq: BreakpointUpdateReq; //

const { status, data } = await apiInstance.updateBreakpointApiV1VideoBreakpointUpdatePost_0(
    breakpointUpdateReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **breakpointUpdateReq** | **BreakpointUpdateReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

