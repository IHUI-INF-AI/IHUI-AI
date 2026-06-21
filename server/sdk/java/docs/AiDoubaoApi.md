# AiDoubaoApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**doubaoChatApiV1AiDoubaoChatPost**](AiDoubaoApi.md#doubaoChatApiV1AiDoubaoChatPost) | **POST** /api/v1/ai/doubao/chat | Doubao chat completion |
| [**doubaoImageEditApiV1AiDoubaoImageEditPost**](AiDoubaoApi.md#doubaoImageEditApiV1AiDoubaoImageEditPost) | **POST** /api/v1/ai/doubao/image/edit | 豆包图片编辑 |
| [**doubaoImageGenerateApiV1AiDoubaoImageGeneratePost**](AiDoubaoApi.md#doubaoImageGenerateApiV1AiDoubaoImageGeneratePost) | **POST** /api/v1/ai/doubao/image/generate | 豆包图片生成 (即梦 jimeng_t2i_v40) |
| [**doubaoSeedreamApiV1AiDoubaoImageSeedreamPost**](AiDoubaoApi.md#doubaoSeedreamApiV1AiDoubaoImageSeedreamPost) | **POST** /api/v1/ai/doubao/image/seedream | Seedream 图片生成 |
| [**doubaoStreamApiV1AiDoubaoChatStreamPost**](AiDoubaoApi.md#doubaoStreamApiV1AiDoubaoChatStreamPost) | **POST** /api/v1/ai/doubao/chat/stream | Doubao streaming chat |
| [**doubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost**](AiDoubaoApi.md#doubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost) | **POST** /api/v1/ai/doubao/video/generate | 豆包视频生成 (Seedance, async) |


<a id="doubaoChatApiV1AiDoubaoChatPost"></a>
# **doubaoChatApiV1AiDoubaoChatPost**
> Object doubaoChatApiV1AiDoubaoChatPost(message, model)

Doubao chat completion

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiDoubaoApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiDoubaoApi apiInstance = new AiDoubaoApi(defaultClient);
    String message = "message_example"; // String | 
    String model = "doubao-pro-32k"; // String | 
    try {
      Object result = apiInstance.doubaoChatApiV1AiDoubaoChatPost(message, model);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiDoubaoApi#doubaoChatApiV1AiDoubaoChatPost");
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
| **message** | **String**|  | |
| **model** | **String**|  | [optional] [default to doubao-pro-32k] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="doubaoImageEditApiV1AiDoubaoImageEditPost"></a>
# **doubaoImageEditApiV1AiDoubaoImageEditPost**
> Object doubaoImageEditApiV1AiDoubaoImageEditPost(prompt, image, mask, model, size, n, strength, responseFormat)

豆包图片编辑

调用豆包图片编辑 API（/v3/images/edits）。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiDoubaoApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiDoubaoApi apiInstance = new AiDoubaoApi(defaultClient);
    String prompt = "prompt_example"; // String | 编辑指令 prompt
    File image = new File("/path/to/file"); // File | 待编辑的原始图片
    File mask = new File("/path/to/file"); // File | 遮罩图片（可选），标记需要编辑的区域
    String model = "doubao-seedream-3-0-i2i-250415"; // String | 图片编辑模型名称
    String size = "1024x1024"; // String | 输出图片尺寸
    Integer n = 1; // Integer | 生成数量
    BigDecimal strength = new BigDecimal("0.8"); // BigDecimal | 编辑强度，0-1
    String responseFormat = "url"; // String | 返回格式: url / b64_json
    try {
      Object result = apiInstance.doubaoImageEditApiV1AiDoubaoImageEditPost(prompt, image, mask, model, size, n, strength, responseFormat);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiDoubaoApi#doubaoImageEditApiV1AiDoubaoImageEditPost");
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
| **prompt** | **String**| 编辑指令 prompt | |
| **image** | **File**| 待编辑的原始图片 | |
| **mask** | **File**| 遮罩图片（可选），标记需要编辑的区域 | [optional] |
| **model** | **String**| 图片编辑模型名称 | [optional] [default to doubao-seedream-3-0-i2i-250415] |
| **size** | **String**| 输出图片尺寸 | [optional] [default to 1024x1024] |
| **n** | **Integer**| 生成数量 | [optional] [default to 1] |
| **strength** | **BigDecimal**| 编辑强度，0-1 | [optional] [default to 0.8] |
| **responseFormat** | **String**| 返回格式: url / b64_json | [optional] [default to url] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="doubaoImageGenerateApiV1AiDoubaoImageGeneratePost"></a>
# **doubaoImageGenerateApiV1AiDoubaoImageGeneratePost**
> Object doubaoImageGenerateApiV1AiDoubaoImageGeneratePost(doubaoImageRequest)

豆包图片生成 (即梦 jimeng_t2i_v40)

Submit a JiMeng text-to-image task via Volcengine CVSync2Async API, poll until complete, persist the image, deduct tokens, and return the URL.  Uses Volcengine V4 HMAC signing with DOUBAO_JM_API_KEY / DOUBAO_JM_SECRET_KEY.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiDoubaoApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AiDoubaoApi apiInstance = new AiDoubaoApi(defaultClient);
    DoubaoImageRequest doubaoImageRequest = new DoubaoImageRequest(); // DoubaoImageRequest | 
    try {
      Object result = apiInstance.doubaoImageGenerateApiV1AiDoubaoImageGeneratePost(doubaoImageRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiDoubaoApi#doubaoImageGenerateApiV1AiDoubaoImageGeneratePost");
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
| **doubaoImageRequest** | [**DoubaoImageRequest**](DoubaoImageRequest.md)|  | |

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

<a id="doubaoSeedreamApiV1AiDoubaoImageSeedreamPost"></a>
# **doubaoSeedreamApiV1AiDoubaoImageSeedreamPost**
> Object doubaoSeedreamApiV1AiDoubaoImageSeedreamPost(seedreamImageRequest)

Seedream 图片生成

Call Doubao Seedream model for image generation via /v3/images/generations with Bearer token auth.  Mirrors the original doubao_image_proxy.py /doubao-seedream-generation endpoint.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiDoubaoApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AiDoubaoApi apiInstance = new AiDoubaoApi(defaultClient);
    SeedreamImageRequest seedreamImageRequest = new SeedreamImageRequest(); // SeedreamImageRequest | 
    try {
      Object result = apiInstance.doubaoSeedreamApiV1AiDoubaoImageSeedreamPost(seedreamImageRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiDoubaoApi#doubaoSeedreamApiV1AiDoubaoImageSeedreamPost");
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
| **seedreamImageRequest** | [**SeedreamImageRequest**](SeedreamImageRequest.md)|  | |

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

<a id="doubaoStreamApiV1AiDoubaoChatStreamPost"></a>
# **doubaoStreamApiV1AiDoubaoChatStreamPost**
> Object doubaoStreamApiV1AiDoubaoChatStreamPost(message, model)

Doubao streaming chat

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiDoubaoApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiDoubaoApi apiInstance = new AiDoubaoApi(defaultClient);
    String message = "message_example"; // String | 
    String model = "doubao-pro-32k"; // String | 
    try {
      Object result = apiInstance.doubaoStreamApiV1AiDoubaoChatStreamPost(message, model);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiDoubaoApi#doubaoStreamApiV1AiDoubaoChatStreamPost");
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
| **message** | **String**|  | |
| **model** | **String**|  | [optional] [default to doubao-pro-32k] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="doubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost"></a>
# **doubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost**
> Object doubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost(videoGenerateRequest)

豆包视频生成 (Seedance, async)

Submit a Doubao Seedance video-generation task, poll until complete, persist the resulting video, deduct tokens, and return the video URL.  Mirrors the original doubao_video_proxy.py /video-generation endpoint.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiDoubaoApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AiDoubaoApi apiInstance = new AiDoubaoApi(defaultClient);
    VideoGenerateRequest videoGenerateRequest = new VideoGenerateRequest(); // VideoGenerateRequest | 
    try {
      Object result = apiInstance.doubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost(videoGenerateRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiDoubaoApi#doubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost");
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
| **videoGenerateRequest** | [**VideoGenerateRequest**](VideoGenerateRequest.md)|  | |

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

