# VisitTrackingApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**logListApiV1VisitLogListGet**](VisitTrackingApi.md#logListApiV1VisitLogListGet) | **GET** /api/v1/visit/log/list | 访问日志 |
| [**logListApiV1VisitLogListGet_0**](VisitTrackingApi.md#logListApiV1VisitLogListGet_0) | **GET** /api/v1/visit/log/list | 访问日志 |
| [**pageStatsApiV1VisitStatsPageGet**](VisitTrackingApi.md#pageStatsApiV1VisitStatsPageGet) | **GET** /api/v1/visit/stats/page | 页面统计 |
| [**pageStatsApiV1VisitStatsPageGet_0**](VisitTrackingApi.md#pageStatsApiV1VisitStatsPageGet_0) | **GET** /api/v1/visit/stats/page | 页面统计 |
| [**recordPageApiV1VisitPageRecordPost**](VisitTrackingApi.md#recordPageApiV1VisitPageRecordPost) | **POST** /api/v1/visit/page/record | 记录页面访问 |
| [**recordPageApiV1VisitPageRecordPost_0**](VisitTrackingApi.md#recordPageApiV1VisitPageRecordPost_0) | **POST** /api/v1/visit/page/record | 记录页面访问 |
| [**recordSourceApiV1VisitSourceRecordPost**](VisitTrackingApi.md#recordSourceApiV1VisitSourceRecordPost) | **POST** /api/v1/visit/source/record | 记录来源 |
| [**recordSourceApiV1VisitSourceRecordPost_0**](VisitTrackingApi.md#recordSourceApiV1VisitSourceRecordPost_0) | **POST** /api/v1/visit/source/record | 记录来源 |
| [**sourceStatsApiV1VisitStatsSourceGet**](VisitTrackingApi.md#sourceStatsApiV1VisitStatsSourceGet) | **GET** /api/v1/visit/stats/source | 来源统计 |
| [**sourceStatsApiV1VisitStatsSourceGet_0**](VisitTrackingApi.md#sourceStatsApiV1VisitStatsSourceGet_0) | **GET** /api/v1/visit/stats/source | 来源统计 |
| [**todayStatsApiV1VisitStatsTodayGet**](VisitTrackingApi.md#todayStatsApiV1VisitStatsTodayGet) | **GET** /api/v1/visit/stats/today | 今日实时统计 |
| [**todayStatsApiV1VisitStatsTodayGet_0**](VisitTrackingApi.md#todayStatsApiV1VisitStatsTodayGet_0) | **GET** /api/v1/visit/stats/today | 今日实时统计 |
| [**trackApiV1VisitTrackPost**](VisitTrackingApi.md#trackApiV1VisitTrackPost) | **POST** /api/v1/visit/track | 记录访问 |
| [**trackApiV1VisitTrackPost_0**](VisitTrackingApi.md#trackApiV1VisitTrackPost_0) | **POST** /api/v1/visit/track | 记录访问 |
| [**visitDailyStats**](VisitTrackingApi.md#visitDailyStats) | **GET** /api/v1/visit/stats/daily | 每日访问统计 |
| [**visitDailyStats_0**](VisitTrackingApi.md#visitDailyStats_0) | **GET** /api/v1/visit/stats/daily | 每日访问统计 |


<a id="logListApiV1VisitLogListGet"></a>
# **logListApiV1VisitLogListGet**
> Object logListApiV1VisitLogListGet(page, limit, userId, path, targetType, startDate, endDate)

访问日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VisitTrackingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VisitTrackingApi apiInstance = new VisitTrackingApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String userId = "userId_example"; // String | 
    String path = "path_example"; // String | 
    String targetType = "targetType_example"; // String | 
    String startDate = "startDate_example"; // String | 
    String endDate = "endDate_example"; // String | 
    try {
      Object result = apiInstance.logListApiV1VisitLogListGet(page, limit, userId, path, targetType, startDate, endDate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VisitTrackingApi#logListApiV1VisitLogListGet");
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
| **userId** | **String**|  | [optional] |
| **path** | **String**|  | [optional] |
| **targetType** | **String**|  | [optional] |
| **startDate** | **String**|  | [optional] |
| **endDate** | **String**|  | [optional] |

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

<a id="logListApiV1VisitLogListGet_0"></a>
# **logListApiV1VisitLogListGet_0**
> Object logListApiV1VisitLogListGet_0(page, limit, userId, path, targetType, startDate, endDate)

访问日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VisitTrackingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VisitTrackingApi apiInstance = new VisitTrackingApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String userId = "userId_example"; // String | 
    String path = "path_example"; // String | 
    String targetType = "targetType_example"; // String | 
    String startDate = "startDate_example"; // String | 
    String endDate = "endDate_example"; // String | 
    try {
      Object result = apiInstance.logListApiV1VisitLogListGet_0(page, limit, userId, path, targetType, startDate, endDate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VisitTrackingApi#logListApiV1VisitLogListGet_0");
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
| **userId** | **String**|  | [optional] |
| **path** | **String**|  | [optional] |
| **targetType** | **String**|  | [optional] |
| **startDate** | **String**|  | [optional] |
| **endDate** | **String**|  | [optional] |

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

<a id="pageStatsApiV1VisitStatsPageGet"></a>
# **pageStatsApiV1VisitStatsPageGet**
> Object pageStatsApiV1VisitStatsPageGet(startDate, endDate, limit)

页面统计

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VisitTrackingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VisitTrackingApi apiInstance = new VisitTrackingApi(defaultClient);
    String startDate = "startDate_example"; // String | 
    String endDate = "endDate_example"; // String | 
    Integer limit = 50; // Integer | 
    try {
      Object result = apiInstance.pageStatsApiV1VisitStatsPageGet(startDate, endDate, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VisitTrackingApi#pageStatsApiV1VisitStatsPageGet");
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
| **startDate** | **String**|  | [optional] |
| **endDate** | **String**|  | [optional] |
| **limit** | **Integer**|  | [optional] [default to 50] |

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

<a id="pageStatsApiV1VisitStatsPageGet_0"></a>
# **pageStatsApiV1VisitStatsPageGet_0**
> Object pageStatsApiV1VisitStatsPageGet_0(startDate, endDate, limit)

页面统计

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VisitTrackingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VisitTrackingApi apiInstance = new VisitTrackingApi(defaultClient);
    String startDate = "startDate_example"; // String | 
    String endDate = "endDate_example"; // String | 
    Integer limit = 50; // Integer | 
    try {
      Object result = apiInstance.pageStatsApiV1VisitStatsPageGet_0(startDate, endDate, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VisitTrackingApi#pageStatsApiV1VisitStatsPageGet_0");
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
| **startDate** | **String**|  | [optional] |
| **endDate** | **String**|  | [optional] |
| **limit** | **Integer**|  | [optional] [default to 50] |

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

<a id="recordPageApiV1VisitPageRecordPost"></a>
# **recordPageApiV1VisitPageRecordPost**
> Object recordPageApiV1VisitPageRecordPost(path, statDate, duration)

记录页面访问

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VisitTrackingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VisitTrackingApi apiInstance = new VisitTrackingApi(defaultClient);
    String path = "path_example"; // String | 
    String statDate = "statDate_example"; // String | 
    Integer duration = 0; // Integer | 
    try {
      Object result = apiInstance.recordPageApiV1VisitPageRecordPost(path, statDate, duration);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VisitTrackingApi#recordPageApiV1VisitPageRecordPost");
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
| **path** | **String**|  | |
| **statDate** | **String**|  | [optional] |
| **duration** | **Integer**|  | [optional] [default to 0] |

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

<a id="recordPageApiV1VisitPageRecordPost_0"></a>
# **recordPageApiV1VisitPageRecordPost_0**
> Object recordPageApiV1VisitPageRecordPost_0(path, statDate, duration)

记录页面访问

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VisitTrackingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VisitTrackingApi apiInstance = new VisitTrackingApi(defaultClient);
    String path = "path_example"; // String | 
    String statDate = "statDate_example"; // String | 
    Integer duration = 0; // Integer | 
    try {
      Object result = apiInstance.recordPageApiV1VisitPageRecordPost_0(path, statDate, duration);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VisitTrackingApi#recordPageApiV1VisitPageRecordPost_0");
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
| **path** | **String**|  | |
| **statDate** | **String**|  | [optional] |
| **duration** | **Integer**|  | [optional] [default to 0] |

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

<a id="recordSourceApiV1VisitSourceRecordPost"></a>
# **recordSourceApiV1VisitSourceRecordPost**
> Object recordSourceApiV1VisitSourceRecordPost(source, statDate)

记录来源

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VisitTrackingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VisitTrackingApi apiInstance = new VisitTrackingApi(defaultClient);
    String source = "source_example"; // String | 
    String statDate = "statDate_example"; // String | 
    try {
      Object result = apiInstance.recordSourceApiV1VisitSourceRecordPost(source, statDate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VisitTrackingApi#recordSourceApiV1VisitSourceRecordPost");
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
| **source** | **String**|  | |
| **statDate** | **String**|  | [optional] |

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

<a id="recordSourceApiV1VisitSourceRecordPost_0"></a>
# **recordSourceApiV1VisitSourceRecordPost_0**
> Object recordSourceApiV1VisitSourceRecordPost_0(source, statDate)

记录来源

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VisitTrackingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VisitTrackingApi apiInstance = new VisitTrackingApi(defaultClient);
    String source = "source_example"; // String | 
    String statDate = "statDate_example"; // String | 
    try {
      Object result = apiInstance.recordSourceApiV1VisitSourceRecordPost_0(source, statDate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VisitTrackingApi#recordSourceApiV1VisitSourceRecordPost_0");
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
| **source** | **String**|  | |
| **statDate** | **String**|  | [optional] |

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

<a id="sourceStatsApiV1VisitStatsSourceGet"></a>
# **sourceStatsApiV1VisitStatsSourceGet**
> Object sourceStatsApiV1VisitStatsSourceGet(startDate, endDate)

来源统计

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VisitTrackingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VisitTrackingApi apiInstance = new VisitTrackingApi(defaultClient);
    String startDate = "startDate_example"; // String | 
    String endDate = "endDate_example"; // String | 
    try {
      Object result = apiInstance.sourceStatsApiV1VisitStatsSourceGet(startDate, endDate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VisitTrackingApi#sourceStatsApiV1VisitStatsSourceGet");
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
| **startDate** | **String**|  | [optional] |
| **endDate** | **String**|  | [optional] |

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

<a id="sourceStatsApiV1VisitStatsSourceGet_0"></a>
# **sourceStatsApiV1VisitStatsSourceGet_0**
> Object sourceStatsApiV1VisitStatsSourceGet_0(startDate, endDate)

来源统计

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VisitTrackingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VisitTrackingApi apiInstance = new VisitTrackingApi(defaultClient);
    String startDate = "startDate_example"; // String | 
    String endDate = "endDate_example"; // String | 
    try {
      Object result = apiInstance.sourceStatsApiV1VisitStatsSourceGet_0(startDate, endDate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VisitTrackingApi#sourceStatsApiV1VisitStatsSourceGet_0");
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
| **startDate** | **String**|  | [optional] |
| **endDate** | **String**|  | [optional] |

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

<a id="todayStatsApiV1VisitStatsTodayGet"></a>
# **todayStatsApiV1VisitStatsTodayGet**
> Object todayStatsApiV1VisitStatsTodayGet()

今日实时统计

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VisitTrackingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VisitTrackingApi apiInstance = new VisitTrackingApi(defaultClient);
    try {
      Object result = apiInstance.todayStatsApiV1VisitStatsTodayGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VisitTrackingApi#todayStatsApiV1VisitStatsTodayGet");
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

<a id="todayStatsApiV1VisitStatsTodayGet_0"></a>
# **todayStatsApiV1VisitStatsTodayGet_0**
> Object todayStatsApiV1VisitStatsTodayGet_0()

今日实时统计

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VisitTrackingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VisitTrackingApi apiInstance = new VisitTrackingApi(defaultClient);
    try {
      Object result = apiInstance.todayStatsApiV1VisitStatsTodayGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VisitTrackingApi#todayStatsApiV1VisitStatsTodayGet_0");
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

<a id="trackApiV1VisitTrackPost"></a>
# **trackApiV1VisitTrackPost**
> Object trackApiV1VisitTrackPost(path, method, queryParams, referer, userAgent, ip, device, os, browser, targetType, targetId, duration, source, sessionId, userId)

记录访问

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VisitTrackingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VisitTrackingApi apiInstance = new VisitTrackingApi(defaultClient);
    String path = "path_example"; // String | 
    String method = "method_example"; // String | 
    String queryParams = "queryParams_example"; // String | 
    String referer = "referer_example"; // String | 
    String userAgent = "userAgent_example"; // String | 
    String ip = "ip_example"; // String | 
    String device = "device_example"; // String | 
    String os = "os_example"; // String | 
    String browser = "browser_example"; // String | 
    String targetType = "targetType_example"; // String | 
    String targetId = "targetId_example"; // String | 
    Integer duration = 0; // Integer | 
    String source = "source_example"; // String | 
    String sessionId = "sessionId_example"; // String | 
    String userId = "userId_example"; // String | 
    try {
      Object result = apiInstance.trackApiV1VisitTrackPost(path, method, queryParams, referer, userAgent, ip, device, os, browser, targetType, targetId, duration, source, sessionId, userId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VisitTrackingApi#trackApiV1VisitTrackPost");
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
| **path** | **String**|  | |
| **method** | **String**|  | [optional] |
| **queryParams** | **String**|  | [optional] |
| **referer** | **String**|  | [optional] |
| **userAgent** | **String**|  | [optional] |
| **ip** | **String**|  | [optional] |
| **device** | **String**|  | [optional] |
| **os** | **String**|  | [optional] |
| **browser** | **String**|  | [optional] |
| **targetType** | **String**|  | [optional] |
| **targetId** | **String**|  | [optional] |
| **duration** | **Integer**|  | [optional] [default to 0] |
| **source** | **String**|  | [optional] |
| **sessionId** | **String**|  | [optional] |
| **userId** | **String**|  | [optional] |

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

<a id="trackApiV1VisitTrackPost_0"></a>
# **trackApiV1VisitTrackPost_0**
> Object trackApiV1VisitTrackPost_0(path, method, queryParams, referer, userAgent, ip, device, os, browser, targetType, targetId, duration, source, sessionId, userId)

记录访问

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VisitTrackingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VisitTrackingApi apiInstance = new VisitTrackingApi(defaultClient);
    String path = "path_example"; // String | 
    String method = "method_example"; // String | 
    String queryParams = "queryParams_example"; // String | 
    String referer = "referer_example"; // String | 
    String userAgent = "userAgent_example"; // String | 
    String ip = "ip_example"; // String | 
    String device = "device_example"; // String | 
    String os = "os_example"; // String | 
    String browser = "browser_example"; // String | 
    String targetType = "targetType_example"; // String | 
    String targetId = "targetId_example"; // String | 
    Integer duration = 0; // Integer | 
    String source = "source_example"; // String | 
    String sessionId = "sessionId_example"; // String | 
    String userId = "userId_example"; // String | 
    try {
      Object result = apiInstance.trackApiV1VisitTrackPost_0(path, method, queryParams, referer, userAgent, ip, device, os, browser, targetType, targetId, duration, source, sessionId, userId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VisitTrackingApi#trackApiV1VisitTrackPost_0");
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
| **path** | **String**|  | |
| **method** | **String**|  | [optional] |
| **queryParams** | **String**|  | [optional] |
| **referer** | **String**|  | [optional] |
| **userAgent** | **String**|  | [optional] |
| **ip** | **String**|  | [optional] |
| **device** | **String**|  | [optional] |
| **os** | **String**|  | [optional] |
| **browser** | **String**|  | [optional] |
| **targetType** | **String**|  | [optional] |
| **targetId** | **String**|  | [optional] |
| **duration** | **Integer**|  | [optional] [default to 0] |
| **source** | **String**|  | [optional] |
| **sessionId** | **String**|  | [optional] |
| **userId** | **String**|  | [optional] |

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

<a id="visitDailyStats"></a>
# **visitDailyStats**
> Object visitDailyStats(startDate, endDate, targetType)

每日访问统计

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VisitTrackingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VisitTrackingApi apiInstance = new VisitTrackingApi(defaultClient);
    String startDate = "startDate_example"; // String | 
    String endDate = "endDate_example"; // String | 
    String targetType = "targetType_example"; // String | 
    try {
      Object result = apiInstance.visitDailyStats(startDate, endDate, targetType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VisitTrackingApi#visitDailyStats");
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
| **startDate** | **String**|  | [optional] |
| **endDate** | **String**|  | [optional] |
| **targetType** | **String**|  | [optional] |

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

<a id="visitDailyStats_0"></a>
# **visitDailyStats_0**
> Object visitDailyStats_0(startDate, endDate, targetType)

每日访问统计

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VisitTrackingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    VisitTrackingApi apiInstance = new VisitTrackingApi(defaultClient);
    String startDate = "startDate_example"; // String | 
    String endDate = "endDate_example"; // String | 
    String targetType = "targetType_example"; // String | 
    try {
      Object result = apiInstance.visitDailyStats_0(startDate, endDate, targetType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VisitTrackingApi#visitDailyStats_0");
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
| **startDate** | **String**|  | [optional] |
| **endDate** | **String**|  | [optional] |
| **targetType** | **String**|  | [optional] |

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

