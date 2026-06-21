# AiVolcEngineApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**jimeng31GenerateApiV1AiVolcengineJimengGeneratePost**](AiVolcEngineApi.md#jimeng31GenerateApiV1AiVolcengineJimengGeneratePost) | **POST** /api/v1/ai/volcengine/jimeng/generate | JiMeng 3.1 generation |
| [**jimeng4ImageApiV1AiVolcengineJimengImagePost**](AiVolcEngineApi.md#jimeng4ImageApiV1AiVolcengineJimengImagePost) | **POST** /api/v1/ai/volcengine/jimeng/image | JiMeng 4.0 text-to-image (async) |
| [**jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost**](AiVolcEngineApi.md#jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost) | **POST** /api/v1/ai/volcengine/jimeng4/process | 即梦4.0 CVProcess 通用转发 |
| [**pingApiV1AiVolcenginePingGet**](AiVolcEngineApi.md#pingApiV1AiVolcenginePingGet) | **GET** /api/v1/ai/volcengine/ping | Health check |
| [**visualProxyApiV1AiVolcengineVisualReqKeyPost**](AiVolcEngineApi.md#visualProxyApiV1AiVolcengineVisualReqKeyPost) | **POST** /api/v1/ai/volcengine/visual/{req_key} | 火山视觉通用代理 (CVSync2Async async submit+poll) |


<a id="jimeng31GenerateApiV1AiVolcengineJimengGeneratePost"></a>
# **jimeng31GenerateApiV1AiVolcengineJimengGeneratePost**
> Object jimeng31GenerateApiV1AiVolcengineJimengGeneratePost(jimeng31Request)

JiMeng 3.1 generation

Proxy a JiMeng 3.1 generation request via CVProcess.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiVolcEngineApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AiVolcEngineApi apiInstance = new AiVolcEngineApi(defaultClient);
    Jimeng31Request jimeng31Request = new Jimeng31Request(); // Jimeng31Request | 
    try {
      Object result = apiInstance.jimeng31GenerateApiV1AiVolcengineJimengGeneratePost(jimeng31Request);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiVolcEngineApi#jimeng31GenerateApiV1AiVolcengineJimengGeneratePost");
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
| **jimeng31Request** | [**Jimeng31Request**](Jimeng31Request.md)|  | |

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

<a id="jimeng4ImageApiV1AiVolcengineJimengImagePost"></a>
# **jimeng4ImageApiV1AiVolcengineJimengImagePost**
> Object jimeng4ImageApiV1AiVolcengineJimengImagePost(jimeng4ImageRequest)

JiMeng 4.0 text-to-image (async)

Submit a JiMeng 4.0 image generation task via CVSync2Async, poll until complete, and return image URLs / base64 data.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiVolcEngineApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AiVolcEngineApi apiInstance = new AiVolcEngineApi(defaultClient);
    Jimeng4ImageRequest jimeng4ImageRequest = new Jimeng4ImageRequest(); // Jimeng4ImageRequest | 
    try {
      Object result = apiInstance.jimeng4ImageApiV1AiVolcengineJimengImagePost(jimeng4ImageRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiVolcEngineApi#jimeng4ImageApiV1AiVolcengineJimengImagePost");
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
| **jimeng4ImageRequest** | [**Jimeng4ImageRequest**](Jimeng4ImageRequest.md)|  | |

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

<a id="jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost"></a>
# **jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost**
> Object jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost(jimeng4ProcessRequest)

即梦4.0 CVProcess 通用转发

JiMeng 4.0 CVProcess generic proxy. Forwards the body (with arbitrary extra fields) via CVProcess to Volcengine. Mirrors the original volcengine_visual_proxy.py /jimeng4/process endpoint.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiVolcEngineApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AiVolcEngineApi apiInstance = new AiVolcEngineApi(defaultClient);
    Jimeng4ProcessRequest jimeng4ProcessRequest = new Jimeng4ProcessRequest(); // Jimeng4ProcessRequest | 
    try {
      Object result = apiInstance.jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost(jimeng4ProcessRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiVolcEngineApi#jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost");
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
| **jimeng4ProcessRequest** | [**Jimeng4ProcessRequest**](Jimeng4ProcessRequest.md)|  | |

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

<a id="pingApiV1AiVolcenginePingGet"></a>
# **pingApiV1AiVolcenginePingGet**
> Object pingApiV1AiVolcenginePingGet()

Health check

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiVolcEngineApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AiVolcEngineApi apiInstance = new AiVolcEngineApi(defaultClient);
    try {
      Object result = apiInstance.pingApiV1AiVolcenginePingGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiVolcEngineApi#pingApiV1AiVolcenginePingGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

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

<a id="visualProxyApiV1AiVolcengineVisualReqKeyPost"></a>
# **visualProxyApiV1AiVolcengineVisualReqKeyPost**
> Object visualProxyApiV1AiVolcengineVisualReqKeyPost(reqKey, visualGenericRequest)

火山视觉通用代理 (CVSync2Async async submit+poll)

Submit a Volcengine visual task (text-to-video, image-to-video, etc.) via CVSync2Async, poll until complete, persist the resulting video, deduct tokens, and return the video URL.  Mirrors the original volcengine_visual_proxy.py /visual/{req_key} endpoint.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiVolcEngineApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AiVolcEngineApi apiInstance = new AiVolcEngineApi(defaultClient);
    String reqKey = "reqKey_example"; // String | 
    VisualGenericRequest visualGenericRequest = new VisualGenericRequest(); // VisualGenericRequest | 
    try {
      Object result = apiInstance.visualProxyApiV1AiVolcengineVisualReqKeyPost(reqKey, visualGenericRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiVolcEngineApi#visualProxyApiV1AiVolcengineVisualReqKeyPost");
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
| **reqKey** | **String**|  | |
| **visualGenericRequest** | [**VisualGenericRequest**](VisualGenericRequest.md)|  | |

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

