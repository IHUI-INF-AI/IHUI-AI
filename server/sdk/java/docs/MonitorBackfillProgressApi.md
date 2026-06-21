# MonitorBackfillProgressApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**backfillHistoryApiV1MonitorBackfillHistoryGet**](MonitorBackfillProgressApi.md#backfillHistoryApiV1MonitorBackfillHistoryGet) | **GET** /api/v1/monitor/backfill/history | Backfill 最近历史事件 |
| [**backfillProgressApiV1MonitorBackfillProgressGet**](MonitorBackfillProgressApi.md#backfillProgressApiV1MonitorBackfillProgressGet) | **GET** /api/v1/monitor/backfill/progress | Backfill 实时进度 (SSE) |
| [**backfillResetApiV1MonitorBackfillResetPost**](MonitorBackfillProgressApi.md#backfillResetApiV1MonitorBackfillResetPost) | **POST** /api/v1/monitor/backfill/reset | 重置 backfill 状态 |
| [**backfillStatusApiV1MonitorBackfillStatusGet**](MonitorBackfillProgressApi.md#backfillStatusApiV1MonitorBackfillStatusGet) | **GET** /api/v1/monitor/backfill/status | Backfill 状态快照 |


<a id="backfillHistoryApiV1MonitorBackfillHistoryGet"></a>
# **backfillHistoryApiV1MonitorBackfillHistoryGet**
> Object backfillHistoryApiV1MonitorBackfillHistoryGet(limit)

Backfill 最近历史事件

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorBackfillProgressApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorBackfillProgressApi apiInstance = new MonitorBackfillProgressApi(defaultClient);
    Integer limit = 50; // Integer | 
    try {
      Object result = apiInstance.backfillHistoryApiV1MonitorBackfillHistoryGet(limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorBackfillProgressApi#backfillHistoryApiV1MonitorBackfillHistoryGet");
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
| **limit** | **Integer**|  | [optional] [default to 50] |

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

<a id="backfillProgressApiV1MonitorBackfillProgressGet"></a>
# **backfillProgressApiV1MonitorBackfillProgressGet**
> Object backfillProgressApiV1MonitorBackfillProgressGet()

Backfill 实时进度 (SSE)

Server-Sent Events: 实时推送 backfill 进度.  数据格式 (每行一条 SSE 事件):     event: started     data: {\&quot;event_type\&quot;: \&quot;started\&quot;, \&quot;table\&quot;: \&quot;users\&quot;, \&quot;total\&quot;: 10000, ...}      event: tenant_progress     data: {\&quot;event_type\&quot;: \&quot;tenant_progress\&quot;, \&quot;table\&quot;: \&quot;users\&quot;, \&quot;tenant_id\&quot;: 1, \&quot;processed\&quot;: 500, \&quot;total\&quot;: 2000, ...}      event: heartbeat     data: {\&quot;event_type\&quot;: \&quot;heartbeat\&quot;, ...}

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorBackfillProgressApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MonitorBackfillProgressApi apiInstance = new MonitorBackfillProgressApi(defaultClient);
    try {
      Object result = apiInstance.backfillProgressApiV1MonitorBackfillProgressGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorBackfillProgressApi#backfillProgressApiV1MonitorBackfillProgressGet");
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

<a id="backfillResetApiV1MonitorBackfillResetPost"></a>
# **backfillResetApiV1MonitorBackfillResetPost**
> Object backfillResetApiV1MonitorBackfillResetPost()

重置 backfill 状态

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorBackfillProgressApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorBackfillProgressApi apiInstance = new MonitorBackfillProgressApi(defaultClient);
    try {
      Object result = apiInstance.backfillResetApiV1MonitorBackfillResetPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorBackfillProgressApi#backfillResetApiV1MonitorBackfillResetPost");
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="backfillStatusApiV1MonitorBackfillStatusGet"></a>
# **backfillStatusApiV1MonitorBackfillStatusGet**
> Object backfillStatusApiV1MonitorBackfillStatusGet()

Backfill 状态快照

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorBackfillProgressApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorBackfillProgressApi apiInstance = new MonitorBackfillProgressApi(defaultClient);
    try {
      Object result = apiInstance.backfillStatusApiV1MonitorBackfillStatusGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorBackfillProgressApi#backfillStatusApiV1MonitorBackfillStatusGet");
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

