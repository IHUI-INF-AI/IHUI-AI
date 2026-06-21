# VideoPreloadBreakpointApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getBreakpointApiV1VideoBreakpointGetGet**](VideoPreloadBreakpointApi.md#getbreakpointapiv1videobreakpointgetget) | **GET** /api/v1/video/breakpoint/get | 查询断点 |
| [**getBreakpointApiV1VideoBreakpointGetGet_0**](VideoPreloadBreakpointApi.md#getbreakpointapiv1videobreakpointgetget_0) | **GET** /api/v1/video/breakpoint/get | 查询断点 |
| [**getHlsManifestApiV1VideoHlsManifestVideoIdGet**](VideoPreloadBreakpointApi.md#gethlsmanifestapiv1videohlsmanifestvideoidget) | **GET** /api/v1/video/hls/manifest/{videoId} | 取 HLS master.m3u8 文本 (含 .ts 预签名 URL) |
| [**getHlsManifestApiV1VideoHlsManifestVideoIdGet_0**](VideoPreloadBreakpointApi.md#gethlsmanifestapiv1videohlsmanifestvideoidget_0) | **GET** /api/v1/video/hls/manifest/{videoId} | 取 HLS master.m3u8 文本 (含 .ts 预签名 URL) |
| [**getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet**](VideoPreloadBreakpointApi.md#gethlsplaylistapiv1videohlsplaylistvideoidbitrateget) | **GET** /api/v1/video/hls/playlist/{videoId}/{bitrate} | 取单档 m3u8 文本 |
| [**getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0**](VideoPreloadBreakpointApi.md#gethlsplaylistapiv1videohlsplaylistvideoidbitrateget_0) | **GET** /api/v1/video/hls/playlist/{videoId}/{bitrate} | 取单档 m3u8 文本 |
| [**loadFromBreakpointApiV1VideoBreakpointLoadPost**](VideoPreloadBreakpointApi.md#loadfrombreakpointapiv1videobreakpointloadpost) | **POST** /api/v1/video/breakpoint/load | 从断点位置加载视频 |
| [**loadFromBreakpointApiV1VideoBreakpointLoadPost_0**](VideoPreloadBreakpointApi.md#loadfrombreakpointapiv1videobreakpointloadpost_0) | **POST** /api/v1/video/breakpoint/load | 从断点位置加载视频 |
| [**preloadVideoApiV1VideoPreloadPost**](VideoPreloadBreakpointApi.md#preloadvideoapiv1videopreloadpost) | **POST** /api/v1/video/preload | 预读视频指定时间段 |
| [**preloadVideoApiV1VideoPreloadPost_0**](VideoPreloadBreakpointApi.md#preloadvideoapiv1videopreloadpost_0) | **POST** /api/v1/video/preload | 预读视频指定时间段 |
| [**transcodeHlsApiV1VideoHlsTranscodePost**](VideoPreloadBreakpointApi.md#transcodehlsapiv1videohlstranscodepost) | **POST** /api/v1/video/hls/transcode | HLS 多码率转码 (生成 master.m3u8 + .ts) |
| [**transcodeHlsApiV1VideoHlsTranscodePost_0**](VideoPreloadBreakpointApi.md#transcodehlsapiv1videohlstranscodepost_0) | **POST** /api/v1/video/hls/transcode | HLS 多码率转码 (生成 master.m3u8 + .ts) |
| [**updateBreakpointApiV1VideoBreakpointUpdatePost**](VideoPreloadBreakpointApi.md#updatebreakpointapiv1videobreakpointupdatepost) | **POST** /api/v1/video/breakpoint/update | 上报当前播放位置 |
| [**updateBreakpointApiV1VideoBreakpointUpdatePost_0**](VideoPreloadBreakpointApi.md#updatebreakpointapiv1videobreakpointupdatepost_0) | **POST** /api/v1/video/breakpoint/update | 上报当前播放位置 |



## getBreakpointApiV1VideoBreakpointGetGet

> any getBreakpointApiV1VideoBreakpointGetGet(userId, videoId)

查询断点

配套查询: GET /api/video/breakpoint/get?userId&#x3D;&amp;videoId&#x3D;

### Example

```ts
import {
  Configuration,
  VideoPreloadBreakpointApi,
} from '';
import type { GetBreakpointApiV1VideoBreakpointGetGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadBreakpointApi();

  const body = {
    // string
    userId: userId_example,
    // string
    videoId: videoId_example,
  } satisfies GetBreakpointApiV1VideoBreakpointGetGetRequest;

  try {
    const data = await api.getBreakpointApiV1VideoBreakpointGetGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **userId** | `string` |  | [Defaults to `undefined`] |
| **videoId** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getBreakpointApiV1VideoBreakpointGetGet_0

> any getBreakpointApiV1VideoBreakpointGetGet_0(userId, videoId)

查询断点

配套查询: GET /api/video/breakpoint/get?userId&#x3D;&amp;videoId&#x3D;

### Example

```ts
import {
  Configuration,
  VideoPreloadBreakpointApi,
} from '';
import type { GetBreakpointApiV1VideoBreakpointGetGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadBreakpointApi();

  const body = {
    // string
    userId: userId_example,
    // string
    videoId: videoId_example,
  } satisfies GetBreakpointApiV1VideoBreakpointGetGet0Request;

  try {
    const data = await api.getBreakpointApiV1VideoBreakpointGetGet_0(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **userId** | `string` |  | [Defaults to `undefined`] |
| **videoId** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getHlsManifestApiV1VideoHlsManifestVideoIdGet

> any getHlsManifestApiV1VideoHlsManifestVideoIdGet(videoId)

取 HLS master.m3u8 文本 (含 .ts 预签名 URL)

GET /api/video/hls/manifest/{videoId} — 纯文本, 前端 hls.js 直接加载.

### Example

```ts
import {
  Configuration,
  VideoPreloadBreakpointApi,
} from '';
import type { GetHlsManifestApiV1VideoHlsManifestVideoIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadBreakpointApi();

  const body = {
    // string
    videoId: videoId_example,
  } satisfies GetHlsManifestApiV1VideoHlsManifestVideoIdGetRequest;

  try {
    const data = await api.getHlsManifestApiV1VideoHlsManifestVideoIdGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **videoId** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getHlsManifestApiV1VideoHlsManifestVideoIdGet_0

> any getHlsManifestApiV1VideoHlsManifestVideoIdGet_0(videoId)

取 HLS master.m3u8 文本 (含 .ts 预签名 URL)

GET /api/video/hls/manifest/{videoId} — 纯文本, 前端 hls.js 直接加载.

### Example

```ts
import {
  Configuration,
  VideoPreloadBreakpointApi,
} from '';
import type { GetHlsManifestApiV1VideoHlsManifestVideoIdGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadBreakpointApi();

  const body = {
    // string
    videoId: videoId_example,
  } satisfies GetHlsManifestApiV1VideoHlsManifestVideoIdGet0Request;

  try {
    const data = await api.getHlsManifestApiV1VideoHlsManifestVideoIdGet_0(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **videoId** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet

> any getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet(videoId, bitrate)

取单档 m3u8 文本

GET /api/video/hls/playlist/{videoId}/{1080p|720p|480p}

### Example

```ts
import {
  Configuration,
  VideoPreloadBreakpointApi,
} from '';
import type { GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadBreakpointApi();

  const body = {
    // string
    videoId: videoId_example,
    // string
    bitrate: bitrate_example,
  } satisfies GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGetRequest;

  try {
    const data = await api.getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **videoId** | `string` |  | [Defaults to `undefined`] |
| **bitrate** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0

> any getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0(videoId, bitrate)

取单档 m3u8 文本

GET /api/video/hls/playlist/{videoId}/{1080p|720p|480p}

### Example

```ts
import {
  Configuration,
  VideoPreloadBreakpointApi,
} from '';
import type { GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadBreakpointApi();

  const body = {
    // string
    videoId: videoId_example,
    // string
    bitrate: bitrate_example,
  } satisfies GetHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet0Request;

  try {
    const data = await api.getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **videoId** | `string` |  | [Defaults to `undefined`] |
| **bitrate** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## loadFromBreakpointApiV1VideoBreakpointLoadPost

> any loadFromBreakpointApiV1VideoBreakpointLoadPost(breakpointReq)

从断点位置加载视频

对应 Java: POST /api/video/breakpoint/load

### Example

```ts
import {
  Configuration,
  VideoPreloadBreakpointApi,
} from '';
import type { LoadFromBreakpointApiV1VideoBreakpointLoadPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadBreakpointApi();

  const body = {
    // BreakpointReq
    breakpointReq: ...,
  } satisfies LoadFromBreakpointApiV1VideoBreakpointLoadPostRequest;

  try {
    const data = await api.loadFromBreakpointApiV1VideoBreakpointLoadPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **breakpointReq** | [BreakpointReq](BreakpointReq.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## loadFromBreakpointApiV1VideoBreakpointLoadPost_0

> any loadFromBreakpointApiV1VideoBreakpointLoadPost_0(breakpointReq)

从断点位置加载视频

对应 Java: POST /api/video/breakpoint/load

### Example

```ts
import {
  Configuration,
  VideoPreloadBreakpointApi,
} from '';
import type { LoadFromBreakpointApiV1VideoBreakpointLoadPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadBreakpointApi();

  const body = {
    // BreakpointReq
    breakpointReq: ...,
  } satisfies LoadFromBreakpointApiV1VideoBreakpointLoadPost0Request;

  try {
    const data = await api.loadFromBreakpointApiV1VideoBreakpointLoadPost_0(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **breakpointReq** | [BreakpointReq](BreakpointReq.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## preloadVideoApiV1VideoPreloadPost

> any preloadVideoApiV1VideoPreloadPost(preloadReq)

预读视频指定时间段

对应 Java: POST /api/video/preload  请求体: { \&quot;videoId\&quot;: \&quot;xxx\&quot;, \&quot;videoPath\&quot;: \&quot;可选\&quot;, \&quot;startSeconds\&quot;: 60, \&quot;preloadSeconds\&quot;: 10 } 返回: { videoId, actualStartSeconds, actualEndSeconds, streamData (base64), streamFormat, duration, size }

### Example

```ts
import {
  Configuration,
  VideoPreloadBreakpointApi,
} from '';
import type { PreloadVideoApiV1VideoPreloadPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadBreakpointApi();

  const body = {
    // PreloadReq
    preloadReq: ...,
  } satisfies PreloadVideoApiV1VideoPreloadPostRequest;

  try {
    const data = await api.preloadVideoApiV1VideoPreloadPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **preloadReq** | [PreloadReq](PreloadReq.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## preloadVideoApiV1VideoPreloadPost_0

> any preloadVideoApiV1VideoPreloadPost_0(preloadReq)

预读视频指定时间段

对应 Java: POST /api/video/preload  请求体: { \&quot;videoId\&quot;: \&quot;xxx\&quot;, \&quot;videoPath\&quot;: \&quot;可选\&quot;, \&quot;startSeconds\&quot;: 60, \&quot;preloadSeconds\&quot;: 10 } 返回: { videoId, actualStartSeconds, actualEndSeconds, streamData (base64), streamFormat, duration, size }

### Example

```ts
import {
  Configuration,
  VideoPreloadBreakpointApi,
} from '';
import type { PreloadVideoApiV1VideoPreloadPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadBreakpointApi();

  const body = {
    // PreloadReq
    preloadReq: ...,
  } satisfies PreloadVideoApiV1VideoPreloadPost0Request;

  try {
    const data = await api.preloadVideoApiV1VideoPreloadPost_0(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **preloadReq** | [PreloadReq](PreloadReq.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## transcodeHlsApiV1VideoHlsTranscodePost

> any transcodeHlsApiV1VideoHlsTranscodePost(hlsTranscodeReq)

HLS 多码率转码 (生成 master.m3u8 + .ts)

对应 Java: POST /api/video/hls/transcode  流程: 1. 跑 ffmpeg 生成 3 档位 (1080p/720p/480p) .ts 切片 + master.m3u8 2. 所有 .ts 上传 storage 3. 改写 m3u8 把 .ts 路径替换成预签名 URL 4. 改写后的 m3u8 上传 storage, 缓存到 Redis

### Example

```ts
import {
  Configuration,
  VideoPreloadBreakpointApi,
} from '';
import type { TranscodeHlsApiV1VideoHlsTranscodePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadBreakpointApi();

  const body = {
    // HlsTranscodeReq
    hlsTranscodeReq: ...,
  } satisfies TranscodeHlsApiV1VideoHlsTranscodePostRequest;

  try {
    const data = await api.transcodeHlsApiV1VideoHlsTranscodePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **hlsTranscodeReq** | [HlsTranscodeReq](HlsTranscodeReq.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## transcodeHlsApiV1VideoHlsTranscodePost_0

> any transcodeHlsApiV1VideoHlsTranscodePost_0(hlsTranscodeReq)

HLS 多码率转码 (生成 master.m3u8 + .ts)

对应 Java: POST /api/video/hls/transcode  流程: 1. 跑 ffmpeg 生成 3 档位 (1080p/720p/480p) .ts 切片 + master.m3u8 2. 所有 .ts 上传 storage 3. 改写 m3u8 把 .ts 路径替换成预签名 URL 4. 改写后的 m3u8 上传 storage, 缓存到 Redis

### Example

```ts
import {
  Configuration,
  VideoPreloadBreakpointApi,
} from '';
import type { TranscodeHlsApiV1VideoHlsTranscodePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadBreakpointApi();

  const body = {
    // HlsTranscodeReq
    hlsTranscodeReq: ...,
  } satisfies TranscodeHlsApiV1VideoHlsTranscodePost0Request;

  try {
    const data = await api.transcodeHlsApiV1VideoHlsTranscodePost_0(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **hlsTranscodeReq** | [HlsTranscodeReq](HlsTranscodeReq.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateBreakpointApiV1VideoBreakpointUpdatePost

> any updateBreakpointApiV1VideoBreakpointUpdatePost(breakpointUpdateReq)

上报当前播放位置

对应 Java: POST /api/video/breakpoint/update — 存 Redis

### Example

```ts
import {
  Configuration,
  VideoPreloadBreakpointApi,
} from '';
import type { UpdateBreakpointApiV1VideoBreakpointUpdatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadBreakpointApi();

  const body = {
    // BreakpointUpdateReq
    breakpointUpdateReq: ...,
  } satisfies UpdateBreakpointApiV1VideoBreakpointUpdatePostRequest;

  try {
    const data = await api.updateBreakpointApiV1VideoBreakpointUpdatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **breakpointUpdateReq** | [BreakpointUpdateReq](BreakpointUpdateReq.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateBreakpointApiV1VideoBreakpointUpdatePost_0

> any updateBreakpointApiV1VideoBreakpointUpdatePost_0(breakpointUpdateReq)

上报当前播放位置

对应 Java: POST /api/video/breakpoint/update — 存 Redis

### Example

```ts
import {
  Configuration,
  VideoPreloadBreakpointApi,
} from '';
import type { UpdateBreakpointApiV1VideoBreakpointUpdatePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadBreakpointApi();

  const body = {
    // BreakpointUpdateReq
    breakpointUpdateReq: ...,
  } satisfies UpdateBreakpointApiV1VideoBreakpointUpdatePost0Request;

  try {
    const data = await api.updateBreakpointApiV1VideoBreakpointUpdatePost_0(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **breakpointUpdateReq** | [BreakpointUpdateReq](BreakpointUpdateReq.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

