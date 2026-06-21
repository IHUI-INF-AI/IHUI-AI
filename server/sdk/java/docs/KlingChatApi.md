# KlingChatApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**klingImageGenerateApiV1ChatImageGeneratePost**](KlingChatApi.md#klingImageGenerateApiV1ChatImageGeneratePost) | **POST** /api/v1/chat/image/generate | Kling text-to-image generation |
| [**klingImageToVideoApiV1ChatVideoImageToVideoPost**](KlingChatApi.md#klingImageToVideoApiV1ChatVideoImageToVideoPost) | **POST** /api/v1/chat/video/image-to-video | Kling image-to-video generation |
| [**klingLipSyncApiV1ChatVideoLipSyncPost**](KlingChatApi.md#klingLipSyncApiV1ChatVideoLipSyncPost) | **POST** /api/v1/chat/video/lip-sync | Kling lip-sync video creation |
| [**klingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost**](KlingChatApi.md#klingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost) | **POST** /api/v1/chat/video/lip-sync/one-shot | Kling one-shot lip-sync |
| [**klingQueryTaskApiV1ChatTaskTaskIdGet**](KlingChatApi.md#klingQueryTaskApiV1ChatTaskTaskIdGet) | **GET** /api/v1/chat/task/{task_id} | Query Kling task status |
| [**klingVideoGenerateApiV1ChatVideoGeneratePost**](KlingChatApi.md#klingVideoGenerateApiV1ChatVideoGeneratePost) | **POST** /api/v1/chat/video/generate | Kling text-to-video generation |
| [**klingVideoIdentifyApiV1ChatVideoIdentifyPost**](KlingChatApi.md#klingVideoIdentifyApiV1ChatVideoIdentifyPost) | **POST** /api/v1/chat/video/identify | Kling face identification |


<a id="klingImageGenerateApiV1ChatImageGeneratePost"></a>
# **klingImageGenerateApiV1ChatImageGeneratePost**
> Object klingImageGenerateApiV1ChatImageGeneratePost(appApiV1ChatKlingImageGenerateBody)

Kling text-to-image generation

Submit a text-to-image task.  Returns task_id for polling.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.KlingChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    KlingChatApi apiInstance = new KlingChatApi(defaultClient);
    AppApiV1ChatKlingImageGenerateBody appApiV1ChatKlingImageGenerateBody = new AppApiV1ChatKlingImageGenerateBody(); // AppApiV1ChatKlingImageGenerateBody | 
    try {
      Object result = apiInstance.klingImageGenerateApiV1ChatImageGeneratePost(appApiV1ChatKlingImageGenerateBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling KlingChatApi#klingImageGenerateApiV1ChatImageGeneratePost");
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
| **appApiV1ChatKlingImageGenerateBody** | [**AppApiV1ChatKlingImageGenerateBody**](AppApiV1ChatKlingImageGenerateBody.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="klingImageToVideoApiV1ChatVideoImageToVideoPost"></a>
# **klingImageToVideoApiV1ChatVideoImageToVideoPost**
> Object klingImageToVideoApiV1ChatVideoImageToVideoPost(imageToVideoBody)

Kling image-to-video generation

Submit an image-to-video task.  Returns task_id for polling.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.KlingChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    KlingChatApi apiInstance = new KlingChatApi(defaultClient);
    ImageToVideoBody imageToVideoBody = new ImageToVideoBody(); // ImageToVideoBody | 
    try {
      Object result = apiInstance.klingImageToVideoApiV1ChatVideoImageToVideoPost(imageToVideoBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling KlingChatApi#klingImageToVideoApiV1ChatVideoImageToVideoPost");
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
| **imageToVideoBody** | [**ImageToVideoBody**](ImageToVideoBody.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="klingLipSyncApiV1ChatVideoLipSyncPost"></a>
# **klingLipSyncApiV1ChatVideoLipSyncPost**
> Object klingLipSyncApiV1ChatVideoLipSyncPost(lipSyncBody)

Kling lip-sync video creation

Create an advanced-lip-sync task.  Polls synchronously up to 5 min, then falls back to background polling.  Returns the final video URL when available, or a pending task reference.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.KlingChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    KlingChatApi apiInstance = new KlingChatApi(defaultClient);
    LipSyncBody lipSyncBody = new LipSyncBody(); // LipSyncBody | 
    try {
      Object result = apiInstance.klingLipSyncApiV1ChatVideoLipSyncPost(lipSyncBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling KlingChatApi#klingLipSyncApiV1ChatVideoLipSyncPost");
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
| **lipSyncBody** | [**LipSyncBody**](LipSyncBody.md)|  | |

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

<a id="klingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost"></a>
# **klingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost**
> Object klingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost(lipSyncOneShotBody)

Kling one-shot lip-sync

End-to-end: face identification -&gt; create lip-sync task -&gt; sync poll -&gt; persist/charge -&gt; return result.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.KlingChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    KlingChatApi apiInstance = new KlingChatApi(defaultClient);
    LipSyncOneShotBody lipSyncOneShotBody = new LipSyncOneShotBody(); // LipSyncOneShotBody | 
    try {
      Object result = apiInstance.klingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost(lipSyncOneShotBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling KlingChatApi#klingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost");
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
| **lipSyncOneShotBody** | [**LipSyncOneShotBody**](LipSyncOneShotBody.md)|  | |

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

<a id="klingQueryTaskApiV1ChatTaskTaskIdGet"></a>
# **klingQueryTaskApiV1ChatTaskTaskIdGet**
> Object klingQueryTaskApiV1ChatTaskTaskIdGet(taskId, taskType)

Query Kling task status

Query status of a Kling async task.  task_type: &#x60;&#x60;video&#x60;&#x60; (text2video / image2video), &#x60;&#x60;image&#x60;&#x60; (text2image), or &#x60;&#x60;lip-sync&#x60;&#x60; (advanced-lip-sync).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.KlingChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    KlingChatApi apiInstance = new KlingChatApi(defaultClient);
    String taskId = "taskId_example"; // String | 
    String taskType = "video"; // String | 
    try {
      Object result = apiInstance.klingQueryTaskApiV1ChatTaskTaskIdGet(taskId, taskType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling KlingChatApi#klingQueryTaskApiV1ChatTaskTaskIdGet");
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
| **taskId** | **String**|  | |
| **taskType** | **String**|  | [optional] [default to video] |

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

<a id="klingVideoGenerateApiV1ChatVideoGeneratePost"></a>
# **klingVideoGenerateApiV1ChatVideoGeneratePost**
> Object klingVideoGenerateApiV1ChatVideoGeneratePost(videoGenerateBody)

Kling text-to-video generation

Submit a text-to-video task via Kling API.  Returns task_id for polling.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.KlingChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    KlingChatApi apiInstance = new KlingChatApi(defaultClient);
    VideoGenerateBody videoGenerateBody = new VideoGenerateBody(); // VideoGenerateBody | 
    try {
      Object result = apiInstance.klingVideoGenerateApiV1ChatVideoGeneratePost(videoGenerateBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling KlingChatApi#klingVideoGenerateApiV1ChatVideoGeneratePost");
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
| **videoGenerateBody** | [**VideoGenerateBody**](VideoGenerateBody.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="klingVideoIdentifyApiV1ChatVideoIdentifyPost"></a>
# **klingVideoIdentifyApiV1ChatVideoIdentifyPost**
> Object klingVideoIdentifyApiV1ChatVideoIdentifyPost()

Kling face identification

Proxy face identification: POST /v1/videos/identify-face.  Body: { user_uuid, video_id | video_url (XOR) } Returns session_id and face_data for lip-sync creation.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.KlingChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    KlingChatApi apiInstance = new KlingChatApi(defaultClient);
    try {
      Object result = apiInstance.klingVideoIdentifyApiV1ChatVideoIdentifyPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling KlingChatApi#klingVideoIdentifyApiV1ChatVideoIdentifyPost");
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

