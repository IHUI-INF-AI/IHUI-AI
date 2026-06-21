# UserVideoLogApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**recordWatchApiV1UserVideoLogRecordPost**](UserVideoLogApi.md#recordWatchApiV1UserVideoLogRecordPost) | **POST** /api/v1/user-video-log/record | 记录视频观看 |
| [**recordWatchApiV1UserVideoLogRecordPost_0**](UserVideoLogApi.md#recordWatchApiV1UserVideoLogRecordPost_0) | **POST** /api/v1/user-video-log/record | 记录视频观看 |
| [**statsApiV1UserVideoLogStatsGet**](UserVideoLogApi.md#statsApiV1UserVideoLogStatsGet) | **GET** /api/v1/user-video-log/stats | 观看统计 |
| [**statsApiV1UserVideoLogStatsGet_0**](UserVideoLogApi.md#statsApiV1UserVideoLogStatsGet_0) | **GET** /api/v1/user-video-log/stats | 观看统计 |
| [**userVideoLogList**](UserVideoLogApi.md#userVideoLogList) | **GET** /api/v1/user-video-log/list | 我的观看记录 |
| [**userVideoLogList_0**](UserVideoLogApi.md#userVideoLogList_0) | **GET** /api/v1/user-video-log/list | 我的观看记录 |


<a id="recordWatchApiV1UserVideoLogRecordPost"></a>
# **recordWatchApiV1UserVideoLogRecordPost**
> Object recordWatchApiV1UserVideoLogRecordPost(videoId, duration, watched, device, ip, isCompleted, isFinished, videoTitle)

记录视频观看

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserVideoLogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserVideoLogApi apiInstance = new UserVideoLogApi(defaultClient);
    Integer videoId = 56; // Integer | 
    Integer duration = 0; // Integer | 
    Integer watched = 0; // Integer | 
    String device = "device_example"; // String | 
    String ip = "ip_example"; // String | 
    Boolean isCompleted = false; // Boolean | 
    Boolean isFinished = false; // Boolean | 
    String videoTitle = "videoTitle_example"; // String | 
    try {
      Object result = apiInstance.recordWatchApiV1UserVideoLogRecordPost(videoId, duration, watched, device, ip, isCompleted, isFinished, videoTitle);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserVideoLogApi#recordWatchApiV1UserVideoLogRecordPost");
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
| **duration** | **Integer**|  | [optional] [default to 0] |
| **watched** | **Integer**|  | [optional] [default to 0] |
| **device** | **String**|  | [optional] |
| **ip** | **String**|  | [optional] |
| **isCompleted** | **Boolean**|  | [optional] [default to false] |
| **isFinished** | **Boolean**|  | [optional] [default to false] |
| **videoTitle** | **String**|  | [optional] |

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

<a id="recordWatchApiV1UserVideoLogRecordPost_0"></a>
# **recordWatchApiV1UserVideoLogRecordPost_0**
> Object recordWatchApiV1UserVideoLogRecordPost_0(videoId, duration, watched, device, ip, isCompleted, isFinished, videoTitle)

记录视频观看

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserVideoLogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserVideoLogApi apiInstance = new UserVideoLogApi(defaultClient);
    Integer videoId = 56; // Integer | 
    Integer duration = 0; // Integer | 
    Integer watched = 0; // Integer | 
    String device = "device_example"; // String | 
    String ip = "ip_example"; // String | 
    Boolean isCompleted = false; // Boolean | 
    Boolean isFinished = false; // Boolean | 
    String videoTitle = "videoTitle_example"; // String | 
    try {
      Object result = apiInstance.recordWatchApiV1UserVideoLogRecordPost_0(videoId, duration, watched, device, ip, isCompleted, isFinished, videoTitle);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserVideoLogApi#recordWatchApiV1UserVideoLogRecordPost_0");
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
| **duration** | **Integer**|  | [optional] [default to 0] |
| **watched** | **Integer**|  | [optional] [default to 0] |
| **device** | **String**|  | [optional] |
| **ip** | **String**|  | [optional] |
| **isCompleted** | **Boolean**|  | [optional] [default to false] |
| **isFinished** | **Boolean**|  | [optional] [default to false] |
| **videoTitle** | **String**|  | [optional] |

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

<a id="statsApiV1UserVideoLogStatsGet"></a>
# **statsApiV1UserVideoLogStatsGet**
> Object statsApiV1UserVideoLogStatsGet()

观看统计

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserVideoLogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserVideoLogApi apiInstance = new UserVideoLogApi(defaultClient);
    try {
      Object result = apiInstance.statsApiV1UserVideoLogStatsGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserVideoLogApi#statsApiV1UserVideoLogStatsGet");
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

<a id="statsApiV1UserVideoLogStatsGet_0"></a>
# **statsApiV1UserVideoLogStatsGet_0**
> Object statsApiV1UserVideoLogStatsGet_0()

观看统计

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserVideoLogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserVideoLogApi apiInstance = new UserVideoLogApi(defaultClient);
    try {
      Object result = apiInstance.statsApiV1UserVideoLogStatsGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserVideoLogApi#statsApiV1UserVideoLogStatsGet_0");
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

<a id="userVideoLogList"></a>
# **userVideoLogList**
> Object userVideoLogList(page, limit, videoId, isFinished)

我的观看记录

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserVideoLogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserVideoLogApi apiInstance = new UserVideoLogApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer videoId = 56; // Integer | 
    Boolean isFinished = true; // Boolean | 
    try {
      Object result = apiInstance.userVideoLogList(page, limit, videoId, isFinished);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserVideoLogApi#userVideoLogList");
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
| **isFinished** | **Boolean**|  | [optional] |

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

<a id="userVideoLogList_0"></a>
# **userVideoLogList_0**
> Object userVideoLogList_0(page, limit, videoId, isFinished)

我的观看记录

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserVideoLogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserVideoLogApi apiInstance = new UserVideoLogApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer videoId = 56; // Integer | 
    Boolean isFinished = true; // Boolean | 
    try {
      Object result = apiInstance.userVideoLogList_0(page, limit, videoId, isFinished);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserVideoLogApi#userVideoLogList_0");
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
| **isFinished** | **Boolean**|  | [optional] |

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

