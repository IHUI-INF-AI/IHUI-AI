# VideoPreloadApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createPreloadApiV1VideoPreloadPost**](VideoPreloadApi.md#createPreloadApiV1VideoPreloadPost) | **POST** /api/v1/video-preload | 创建预读任务 |
| [**createPreloadApiV1VideoPreloadPost_0**](VideoPreloadApi.md#createPreloadApiV1VideoPreloadPost_0) | **POST** /api/v1/video-preload | 创建预读任务 |
| [**deletePreloadApiV1VideoPreloadPidDelete**](VideoPreloadApi.md#deletePreloadApiV1VideoPreloadPidDelete) | **DELETE** /api/v1/video-preload/{pid} | 删除预读任务 |
| [**deletePreloadApiV1VideoPreloadPidDelete_0**](VideoPreloadApi.md#deletePreloadApiV1VideoPreloadPidDelete_0) | **DELETE** /api/v1/video-preload/{pid} | 删除预读任务 |
| [**listPreloadsApiV1VideoPreloadListGet**](VideoPreloadApi.md#listPreloadsApiV1VideoPreloadListGet) | **GET** /api/v1/video-preload/list | 我的预读任务 |
| [**listPreloadsApiV1VideoPreloadListGet_0**](VideoPreloadApi.md#listPreloadsApiV1VideoPreloadListGet_0) | **GET** /api/v1/video-preload/list | 我的预读任务 |
| [**markCompleteApiV1VideoPreloadPidCompletePut**](VideoPreloadApi.md#markCompleteApiV1VideoPreloadPidCompletePut) | **PUT** /api/v1/video-preload/{pid}/complete | 标记完成 |
| [**markCompleteApiV1VideoPreloadPidCompletePut_0**](VideoPreloadApi.md#markCompleteApiV1VideoPreloadPidCompletePut_0) | **PUT** /api/v1/video-preload/{pid}/complete | 标记完成 |


<a id="createPreloadApiV1VideoPreloadPost"></a>
# **createPreloadApiV1VideoPreloadPost**
> Object createPreloadApiV1VideoPreloadPost(videoId, startTime, endTime, isChunked, videoUrl)

创建预读任务

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadApi apiInstance = new VideoPreloadApi(defaultClient);
    Integer videoId = 56; // Integer | 
    Integer startTime = 0; // Integer | 
    Integer endTime = 0; // Integer | 
    Boolean isChunked = true; // Boolean | 
    String videoUrl = "videoUrl_example"; // String | 
    try {
      Object result = apiInstance.createPreloadApiV1VideoPreloadPost(videoId, startTime, endTime, isChunked, videoUrl);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadApi#createPreloadApiV1VideoPreloadPost");
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
| **videoId** | **Integer**|  | |
| **startTime** | **Integer**|  | [optional] [default to 0] |
| **endTime** | **Integer**|  | [optional] [default to 0] |
| **isChunked** | **Boolean**|  | [optional] [default to true] |
| **videoUrl** | **String**|  | [optional] |

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

<a id="createPreloadApiV1VideoPreloadPost_0"></a>
# **createPreloadApiV1VideoPreloadPost_0**
> Object createPreloadApiV1VideoPreloadPost_0(videoId, startTime, endTime, isChunked, videoUrl)

创建预读任务

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadApi apiInstance = new VideoPreloadApi(defaultClient);
    Integer videoId = 56; // Integer | 
    Integer startTime = 0; // Integer | 
    Integer endTime = 0; // Integer | 
    Boolean isChunked = true; // Boolean | 
    String videoUrl = "videoUrl_example"; // String | 
    try {
      Object result = apiInstance.createPreloadApiV1VideoPreloadPost_0(videoId, startTime, endTime, isChunked, videoUrl);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadApi#createPreloadApiV1VideoPreloadPost_0");
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
| **videoId** | **Integer**|  | |
| **startTime** | **Integer**|  | [optional] [default to 0] |
| **endTime** | **Integer**|  | [optional] [default to 0] |
| **isChunked** | **Boolean**|  | [optional] [default to true] |
| **videoUrl** | **String**|  | [optional] |

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

<a id="deletePreloadApiV1VideoPreloadPidDelete"></a>
# **deletePreloadApiV1VideoPreloadPidDelete**
> Object deletePreloadApiV1VideoPreloadPidDelete(pid)

删除预读任务

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadApi apiInstance = new VideoPreloadApi(defaultClient);
    Integer pid = 56; // Integer | 
    try {
      Object result = apiInstance.deletePreloadApiV1VideoPreloadPidDelete(pid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadApi#deletePreloadApiV1VideoPreloadPidDelete");
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
| **pid** | **Integer**|  | |

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

<a id="deletePreloadApiV1VideoPreloadPidDelete_0"></a>
# **deletePreloadApiV1VideoPreloadPidDelete_0**
> Object deletePreloadApiV1VideoPreloadPidDelete_0(pid)

删除预读任务

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadApi apiInstance = new VideoPreloadApi(defaultClient);
    Integer pid = 56; // Integer | 
    try {
      Object result = apiInstance.deletePreloadApiV1VideoPreloadPidDelete_0(pid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadApi#deletePreloadApiV1VideoPreloadPidDelete_0");
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
| **pid** | **Integer**|  | |

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

<a id="listPreloadsApiV1VideoPreloadListGet"></a>
# **listPreloadsApiV1VideoPreloadListGet**
> Object listPreloadsApiV1VideoPreloadListGet(page, limit, videoId)

我的预读任务

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadApi apiInstance = new VideoPreloadApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer videoId = 56; // Integer | 
    try {
      Object result = apiInstance.listPreloadsApiV1VideoPreloadListGet(page, limit, videoId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadApi#listPreloadsApiV1VideoPreloadListGet");
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
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **videoId** | **Integer**|  | [optional] |

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

<a id="listPreloadsApiV1VideoPreloadListGet_0"></a>
# **listPreloadsApiV1VideoPreloadListGet_0**
> Object listPreloadsApiV1VideoPreloadListGet_0(page, limit, videoId)

我的预读任务

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadApi apiInstance = new VideoPreloadApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer videoId = 56; // Integer | 
    try {
      Object result = apiInstance.listPreloadsApiV1VideoPreloadListGet_0(page, limit, videoId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadApi#listPreloadsApiV1VideoPreloadListGet_0");
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
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **videoId** | **Integer**|  | [optional] |

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

<a id="markCompleteApiV1VideoPreloadPidCompletePut"></a>
# **markCompleteApiV1VideoPreloadPidCompletePut**
> Object markCompleteApiV1VideoPreloadPidCompletePut(pid)

标记完成

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadApi apiInstance = new VideoPreloadApi(defaultClient);
    Integer pid = 56; // Integer | 
    try {
      Object result = apiInstance.markCompleteApiV1VideoPreloadPidCompletePut(pid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadApi#markCompleteApiV1VideoPreloadPidCompletePut");
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
| **pid** | **Integer**|  | |

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

<a id="markCompleteApiV1VideoPreloadPidCompletePut_0"></a>
# **markCompleteApiV1VideoPreloadPidCompletePut_0**
> Object markCompleteApiV1VideoPreloadPidCompletePut_0(pid)

标记完成

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VideoPreloadApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VideoPreloadApi apiInstance = new VideoPreloadApi(defaultClient);
    Integer pid = 56; // Integer | 
    try {
      Object result = apiInstance.markCompleteApiV1VideoPreloadPidCompletePut_0(pid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VideoPreloadApi#markCompleteApiV1VideoPreloadPidCompletePut_0");
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
| **pid** | **Integer**|  | |

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

