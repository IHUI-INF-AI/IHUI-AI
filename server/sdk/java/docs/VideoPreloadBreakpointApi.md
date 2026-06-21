# VideoPreloadBreakpointApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getBreakpointApiV1VideoBreakpointGetGet**](VideoPreloadBreakpointApi.md#getBreakpointApiV1VideoBreakpointGetGet) | **GET** /api/v1/video/breakpoint/get | 查询断点 |
| [**getBreakpointApiV1VideoBreakpointGetGet_0**](VideoPreloadBreakpointApi.md#getBreakpointApiV1VideoBreakpointGetGet_0) | **GET** /api/v1/video/breakpoint/get | 查询断点 |
| [**getHlsManifestApiV1VideoHlsManifestVideoIdGet**](VideoPreloadBreakpointApi.md#getHlsManifestApiV1VideoHlsManifestVideoIdGet) | **GET** /api/v1/video/hls/manifest/{videoId} | 取 HLS master.m3u8 文本 (含 .ts 预签名 URL) |
| [**getHlsManifestApiV1VideoHlsManifestVideoIdGet_0**](VideoPreloadBreakpointApi.md#getHlsManifestApiV1VideoHlsManifestVideoIdGet_0) | **GET** /api/v1/video/hls/manifest/{videoId} | 取 HLS master.m3u8 文本 (含 .ts 预签名 URL) |
| [**getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet**](VideoPreloadBreakpointApi.md#getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet) | **GET** /api/v1/video/hls/playlist/{videoId}/{bitrate} | 取单档 m3u8 文本 |
| [**getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0**](VideoPreloadBreakpointApi.md#getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0) | **GET** /api/v1/video/hls/playlist/{videoId}/{bitrate} | 取单档 m3u8 文本 |
| [**loadFromBreakpointApiV1VideoBreakpointLoadPost**](VideoPreloadBreakpointApi.md#loadFromBreakpointApiV1VideoBreakpointLoadPost) | **POST** /api/v1/video/breakpoint/load | 从断点位置加载视频 |
| [**loadFromBreakpointApiV1VideoBreakpointLoadPost_0**](VideoPreloadBreakpointApi.md#loadFromBreakpointApiV1VideoBreakpointLoadPost_0) | **POST** /api/v1/video/breakpoint/load | 从断点位置加载视频 |
| [**preloadVideoApiV1VideoPreloadPost**](VideoPreloadBreakpointApi.md#preloadVideoApiV1VideoPreloadPost) | **POST** /api/v1/video/preload | 预读视频指定时间段 |
| [**preloadVideoApiV1VideoPreloadPost_0**](VideoPreloadBreakpointApi.md#preloadVideoApiV1VideoPreloadPost_0) | **POST** /api/v1/video/preload | 预读视频指定时间段 |
| [**transcodeHlsApiV1VideoHlsTranscodePost**](VideoPreloadBreakpointApi.md#transcodeHlsApiV1VideoHlsTranscodePost) | **POST** /api/v1/video/hls/transcode | HLS 多码率转码 (生成 master.m3u8 + .ts) |
| [**transcodeHlsApiV1VideoHlsTranscodePost_0**](VideoPreloadBreakpointApi.md#transcodeHlsApiV1VideoHlsTranscodePost_0) | **POST** /api/v1/video/hls/transcode | HLS 多码率转码 (生成 master.m3u8 + .ts) |
| [**updateBreakpointApiV1VideoBreakpointUpdatePost**](VideoPreloadBreakpointApi.md#updateBreakpointApiV1VideoBreakpointUpdatePost) | **POST** /api/v1/video/breakpoint/update | 上报当前播放位置 |
| [**updateBreakpointApiV1VideoBreakpointUpdatePost_0**](VideoPreloadBreakpointApi.md#updateBreakpointApiV1VideoBreakpointUpdatePost_0) | **POST** /api/v1/video/breakpoint/update | 上报当前播放位置 |


<a id="getBreakpointApiV1VideoBreakpointGetGet"></a>
# **getBreakpointApiV1VideoBreakpointGetGet**
> Object getBreakpointApiV1VideoBreakpointGetGet(userId, videoId)

查询断点

配套查询: GET /api/video/breakpoint/get?userId&#x3D;&amp;videoId&#x3D;

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadBreakpointApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadBreakpointApi apiInstance = new VideoPreloadBreakpointApi(defaultClient);
    String userId = "userId_example"; // String | 
    String videoId = "videoId_example"; // String | 
    try {
      Object result = apiInstance.getBreakpointApiV1VideoBreakpointGetGet(userId, videoId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadBreakpointApi#getBreakpointApiV1VideoBreakpointGetGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **userId** | **String**|  | |
| **videoId** | **String**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="getBreakpointApiV1VideoBreakpointGetGet_0"></a>
# **getBreakpointApiV1VideoBreakpointGetGet_0**
> Object getBreakpointApiV1VideoBreakpointGetGet_0(userId, videoId)

查询断点

配套查询: GET /api/video/breakpoint/get?userId&#x3D;&amp;videoId&#x3D;

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadBreakpointApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadBreakpointApi apiInstance = new VideoPreloadBreakpointApi(defaultClient);
    String userId = "userId_example"; // String | 
    String videoId = "videoId_example"; // String | 
    try {
      Object result = apiInstance.getBreakpointApiV1VideoBreakpointGetGet_0(userId, videoId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadBreakpointApi#getBreakpointApiV1VideoBreakpointGetGet_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **userId** | **String**|  | |
| **videoId** | **String**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="getHlsManifestApiV1VideoHlsManifestVideoIdGet"></a>
# **getHlsManifestApiV1VideoHlsManifestVideoIdGet**
> Object getHlsManifestApiV1VideoHlsManifestVideoIdGet(videoId)

取 HLS master.m3u8 文本 (含 .ts 预签名 URL)

GET /api/video/hls/manifest/{videoId} — 纯文本, 前端 hls.js 直接加载.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadBreakpointApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadBreakpointApi apiInstance = new VideoPreloadBreakpointApi(defaultClient);
    String videoId = "videoId_example"; // String | 
    try {
      Object result = apiInstance.getHlsManifestApiV1VideoHlsManifestVideoIdGet(videoId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadBreakpointApi#getHlsManifestApiV1VideoHlsManifestVideoIdGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **videoId** | **String**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="getHlsManifestApiV1VideoHlsManifestVideoIdGet_0"></a>
# **getHlsManifestApiV1VideoHlsManifestVideoIdGet_0**
> Object getHlsManifestApiV1VideoHlsManifestVideoIdGet_0(videoId)

取 HLS master.m3u8 文本 (含 .ts 预签名 URL)

GET /api/video/hls/manifest/{videoId} — 纯文本, 前端 hls.js 直接加载.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadBreakpointApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadBreakpointApi apiInstance = new VideoPreloadBreakpointApi(defaultClient);
    String videoId = "videoId_example"; // String | 
    try {
      Object result = apiInstance.getHlsManifestApiV1VideoHlsManifestVideoIdGet_0(videoId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadBreakpointApi#getHlsManifestApiV1VideoHlsManifestVideoIdGet_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **videoId** | **String**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet"></a>
# **getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet**
> Object getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet(videoId, bitrate)

取单档 m3u8 文本

GET /api/video/hls/playlist/{videoId}/{1080p|720p|480p}

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadBreakpointApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadBreakpointApi apiInstance = new VideoPreloadBreakpointApi(defaultClient);
    String videoId = "videoId_example"; // String | 
    String bitrate = "bitrate_example"; // String | 
    try {
      Object result = apiInstance.getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet(videoId, bitrate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadBreakpointApi#getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **videoId** | **String**|  | |
| **bitrate** | **String**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0"></a>
# **getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0**
> Object getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0(videoId, bitrate)

取单档 m3u8 文本

GET /api/video/hls/playlist/{videoId}/{1080p|720p|480p}

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadBreakpointApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadBreakpointApi apiInstance = new VideoPreloadBreakpointApi(defaultClient);
    String videoId = "videoId_example"; // String | 
    String bitrate = "bitrate_example"; // String | 
    try {
      Object result = apiInstance.getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0(videoId, bitrate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadBreakpointApi#getHlsPlaylistApiV1VideoHlsPlaylistVideoIdBitrateGet_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **videoId** | **String**|  | |
| **bitrate** | **String**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="loadFromBreakpointApiV1VideoBreakpointLoadPost"></a>
# **loadFromBreakpointApiV1VideoBreakpointLoadPost**
> Object loadFromBreakpointApiV1VideoBreakpointLoadPost(breakpointReq)

从断点位置加载视频

对应 Java: POST /api/video/breakpoint/load

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadBreakpointApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadBreakpointApi apiInstance = new VideoPreloadBreakpointApi(defaultClient);
    BreakpointReq breakpointReq = new BreakpointReq(); // BreakpointReq | 
    try {
      Object result = apiInstance.loadFromBreakpointApiV1VideoBreakpointLoadPost(breakpointReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadBreakpointApi#loadFromBreakpointApiV1VideoBreakpointLoadPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **breakpointReq** | [**BreakpointReq**](BreakpointReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="loadFromBreakpointApiV1VideoBreakpointLoadPost_0"></a>
# **loadFromBreakpointApiV1VideoBreakpointLoadPost_0**
> Object loadFromBreakpointApiV1VideoBreakpointLoadPost_0(breakpointReq)

从断点位置加载视频

对应 Java: POST /api/video/breakpoint/load

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadBreakpointApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadBreakpointApi apiInstance = new VideoPreloadBreakpointApi(defaultClient);
    BreakpointReq breakpointReq = new BreakpointReq(); // BreakpointReq | 
    try {
      Object result = apiInstance.loadFromBreakpointApiV1VideoBreakpointLoadPost_0(breakpointReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadBreakpointApi#loadFromBreakpointApiV1VideoBreakpointLoadPost_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **breakpointReq** | [**BreakpointReq**](BreakpointReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="preloadVideoApiV1VideoPreloadPost"></a>
# **preloadVideoApiV1VideoPreloadPost**
> Object preloadVideoApiV1VideoPreloadPost(preloadReq)

预读视频指定时间段

对应 Java: POST /api/video/preload  请求体: { \&quot;videoId\&quot;: \&quot;xxx\&quot;, \&quot;videoPath\&quot;: \&quot;可选\&quot;, \&quot;startSeconds\&quot;: 60, \&quot;preloadSeconds\&quot;: 10 } 返回: { videoId, actualStartSeconds, actualEndSeconds, streamData (base64), streamFormat, duration, size }

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadBreakpointApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadBreakpointApi apiInstance = new VideoPreloadBreakpointApi(defaultClient);
    PreloadReq preloadReq = new PreloadReq(); // PreloadReq | 
    try {
      Object result = apiInstance.preloadVideoApiV1VideoPreloadPost(preloadReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadBreakpointApi#preloadVideoApiV1VideoPreloadPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **preloadReq** | [**PreloadReq**](PreloadReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="preloadVideoApiV1VideoPreloadPost_0"></a>
# **preloadVideoApiV1VideoPreloadPost_0**
> Object preloadVideoApiV1VideoPreloadPost_0(preloadReq)

预读视频指定时间段

对应 Java: POST /api/video/preload  请求体: { \&quot;videoId\&quot;: \&quot;xxx\&quot;, \&quot;videoPath\&quot;: \&quot;可选\&quot;, \&quot;startSeconds\&quot;: 60, \&quot;preloadSeconds\&quot;: 10 } 返回: { videoId, actualStartSeconds, actualEndSeconds, streamData (base64), streamFormat, duration, size }

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadBreakpointApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadBreakpointApi apiInstance = new VideoPreloadBreakpointApi(defaultClient);
    PreloadReq preloadReq = new PreloadReq(); // PreloadReq | 
    try {
      Object result = apiInstance.preloadVideoApiV1VideoPreloadPost_0(preloadReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadBreakpointApi#preloadVideoApiV1VideoPreloadPost_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **preloadReq** | [**PreloadReq**](PreloadReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="transcodeHlsApiV1VideoHlsTranscodePost"></a>
# **transcodeHlsApiV1VideoHlsTranscodePost**
> Object transcodeHlsApiV1VideoHlsTranscodePost(hlsTranscodeReq)

HLS 多码率转码 (生成 master.m3u8 + .ts)

对应 Java: POST /api/video/hls/transcode  流程: 1. 跑 ffmpeg 生成 3 档位 (1080p/720p/480p) .ts 切片 + master.m3u8 2. 所有 .ts 上传 storage 3. 改写 m3u8 把 .ts 路径替换成预签名 URL 4. 改写后的 m3u8 上传 storage, 缓存到 Redis

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadBreakpointApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadBreakpointApi apiInstance = new VideoPreloadBreakpointApi(defaultClient);
    HlsTranscodeReq hlsTranscodeReq = new HlsTranscodeReq(); // HlsTranscodeReq | 
    try {
      Object result = apiInstance.transcodeHlsApiV1VideoHlsTranscodePost(hlsTranscodeReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadBreakpointApi#transcodeHlsApiV1VideoHlsTranscodePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **hlsTranscodeReq** | [**HlsTranscodeReq**](HlsTranscodeReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="transcodeHlsApiV1VideoHlsTranscodePost_0"></a>
# **transcodeHlsApiV1VideoHlsTranscodePost_0**
> Object transcodeHlsApiV1VideoHlsTranscodePost_0(hlsTranscodeReq)

HLS 多码率转码 (生成 master.m3u8 + .ts)

对应 Java: POST /api/video/hls/transcode  流程: 1. 跑 ffmpeg 生成 3 档位 (1080p/720p/480p) .ts 切片 + master.m3u8 2. 所有 .ts 上传 storage 3. 改写 m3u8 把 .ts 路径替换成预签名 URL 4. 改写后的 m3u8 上传 storage, 缓存到 Redis

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadBreakpointApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadBreakpointApi apiInstance = new VideoPreloadBreakpointApi(defaultClient);
    HlsTranscodeReq hlsTranscodeReq = new HlsTranscodeReq(); // HlsTranscodeReq | 
    try {
      Object result = apiInstance.transcodeHlsApiV1VideoHlsTranscodePost_0(hlsTranscodeReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadBreakpointApi#transcodeHlsApiV1VideoHlsTranscodePost_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **hlsTranscodeReq** | [**HlsTranscodeReq**](HlsTranscodeReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="updateBreakpointApiV1VideoBreakpointUpdatePost"></a>
# **updateBreakpointApiV1VideoBreakpointUpdatePost**
> Object updateBreakpointApiV1VideoBreakpointUpdatePost(breakpointUpdateReq)

上报当前播放位置

对应 Java: POST /api/video/breakpoint/update — 存 Redis

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadBreakpointApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadBreakpointApi apiInstance = new VideoPreloadBreakpointApi(defaultClient);
    BreakpointUpdateReq breakpointUpdateReq = new BreakpointUpdateReq(); // BreakpointUpdateReq | 
    try {
      Object result = apiInstance.updateBreakpointApiV1VideoBreakpointUpdatePost(breakpointUpdateReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadBreakpointApi#updateBreakpointApiV1VideoBreakpointUpdatePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **breakpointUpdateReq** | [**BreakpointUpdateReq**](BreakpointUpdateReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="updateBreakpointApiV1VideoBreakpointUpdatePost_0"></a>
# **updateBreakpointApiV1VideoBreakpointUpdatePost_0**
> Object updateBreakpointApiV1VideoBreakpointUpdatePost_0(breakpointUpdateReq)

上报当前播放位置

对应 Java: POST /api/video/breakpoint/update — 存 Redis

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadBreakpointApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadBreakpointApi apiInstance = new VideoPreloadBreakpointApi(defaultClient);
    BreakpointUpdateReq breakpointUpdateReq = new BreakpointUpdateReq(); // BreakpointUpdateReq | 
    try {
      Object result = apiInstance.updateBreakpointApiV1VideoBreakpointUpdatePost_0(breakpointUpdateReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadBreakpointApi#updateBreakpointApiV1VideoBreakpointUpdatePost_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **breakpointUpdateReq** | [**BreakpointUpdateReq**](BreakpointUpdateReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

