# MonitorCanaryAuditApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost**](MonitorCanaryAuditApi.md#canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost) | **POST** /api/v1/monitor/canary-audit/cleanup | Canary Audit Cleanup |
| [**canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0**](MonitorCanaryAuditApi.md#canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0) | **POST** /api/v1/monitor/canary-audit/cleanup | Canary Audit Cleanup |
| [**canaryAuditStatsApiV1MonitorCanaryAuditStatsGet**](MonitorCanaryAuditApi.md#canaryAuditStatsApiV1MonitorCanaryAuditStatsGet) | **GET** /api/v1/monitor/canary-audit/stats | Canary Audit Stats |
| [**canaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0**](MonitorCanaryAuditApi.md#canaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0) | **GET** /api/v1/monitor/canary-audit/stats | Canary Audit Stats |
| [**queryCanaryAuditApiV1MonitorCanaryAuditGet**](MonitorCanaryAuditApi.md#queryCanaryAuditApiV1MonitorCanaryAuditGet) | **GET** /api/v1/monitor/canary-audit | Query Canary Audit |
| [**queryCanaryAuditApiV1MonitorCanaryAuditGet_0**](MonitorCanaryAuditApi.md#queryCanaryAuditApiV1MonitorCanaryAuditGet_0) | **GET** /api/v1/monitor/canary-audit | Query Canary Audit |


<a id="canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost"></a>
# **canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost**
> ModelApiResponse canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost()

Canary Audit Cleanup

手动触发过期清理 (按 store._retention_days).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorCanaryAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorCanaryAuditApi apiInstance = new MonitorCanaryAuditApi(defaultClient);
    try {
      ModelApiResponse result = apiInstance.canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorCanaryAuditApi#canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost");
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

[**ModelApiResponse**](ModelApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0"></a>
# **canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0**
> ModelApiResponse canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0()

Canary Audit Cleanup

手动触发过期清理 (按 store._retention_days).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorCanaryAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorCanaryAuditApi apiInstance = new MonitorCanaryAuditApi(defaultClient);
    try {
      ModelApiResponse result = apiInstance.canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorCanaryAuditApi#canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0");
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

[**ModelApiResponse**](ModelApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="canaryAuditStatsApiV1MonitorCanaryAuditStatsGet"></a>
# **canaryAuditStatsApiV1MonitorCanaryAuditStatsGet**
> ModelApiResponse canaryAuditStatsApiV1MonitorCanaryAuditStatsGet()

Canary Audit Stats

审计统计 (按 source 分组 + 总数).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorCanaryAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorCanaryAuditApi apiInstance = new MonitorCanaryAuditApi(defaultClient);
    try {
      ModelApiResponse result = apiInstance.canaryAuditStatsApiV1MonitorCanaryAuditStatsGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorCanaryAuditApi#canaryAuditStatsApiV1MonitorCanaryAuditStatsGet");
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

[**ModelApiResponse**](ModelApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="canaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0"></a>
# **canaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0**
> ModelApiResponse canaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0()

Canary Audit Stats

审计统计 (按 source 分组 + 总数).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorCanaryAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorCanaryAuditApi apiInstance = new MonitorCanaryAuditApi(defaultClient);
    try {
      ModelApiResponse result = apiInstance.canaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorCanaryAuditApi#canaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0");
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

[**ModelApiResponse**](ModelApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="queryCanaryAuditApiV1MonitorCanaryAuditGet"></a>
# **queryCanaryAuditApiV1MonitorCanaryAuditGet**
> ModelApiResponse queryCanaryAuditApiV1MonitorCanaryAuditGet(limit, source, action, sinceTs, untilTs)

Query Canary Audit

查 Canary 审计日志 (按时间倒序).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorCanaryAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorCanaryAuditApi apiInstance = new MonitorCanaryAuditApi(defaultClient);
    Integer limit = 100; // Integer | 返回条数限制
    String source = "source_example"; // String | controller / promoter / override
    String action = "action_example"; // String | 事件类型过滤
    BigDecimal sinceTs = new BigDecimal(78); // BigDecimal | 起始时间戳
    BigDecimal untilTs = new BigDecimal(78); // BigDecimal | 结束时间戳
    try {
      ModelApiResponse result = apiInstance.queryCanaryAuditApiV1MonitorCanaryAuditGet(limit, source, action, sinceTs, untilTs);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorCanaryAuditApi#queryCanaryAuditApiV1MonitorCanaryAuditGet");
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
| **limit** | **Integer**| 返回条数限制 | [optional] [default to 100] |
| **source** | **String**| controller / promoter / override | [optional] |
| **action** | **String**| 事件类型过滤 | [optional] |
| **sinceTs** | **BigDecimal**| 起始时间戳 | [optional] |
| **untilTs** | **BigDecimal**| 结束时间戳 | [optional] |

### Return type

[**ModelApiResponse**](ModelApiResponse.md)

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

<a id="queryCanaryAuditApiV1MonitorCanaryAuditGet_0"></a>
# **queryCanaryAuditApiV1MonitorCanaryAuditGet_0**
> ModelApiResponse queryCanaryAuditApiV1MonitorCanaryAuditGet_0(limit, source, action, sinceTs, untilTs)

Query Canary Audit

查 Canary 审计日志 (按时间倒序).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorCanaryAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorCanaryAuditApi apiInstance = new MonitorCanaryAuditApi(defaultClient);
    Integer limit = 100; // Integer | 返回条数限制
    String source = "source_example"; // String | controller / promoter / override
    String action = "action_example"; // String | 事件类型过滤
    BigDecimal sinceTs = new BigDecimal(78); // BigDecimal | 起始时间戳
    BigDecimal untilTs = new BigDecimal(78); // BigDecimal | 结束时间戳
    try {
      ModelApiResponse result = apiInstance.queryCanaryAuditApiV1MonitorCanaryAuditGet_0(limit, source, action, sinceTs, untilTs);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorCanaryAuditApi#queryCanaryAuditApiV1MonitorCanaryAuditGet_0");
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
| **limit** | **Integer**| 返回条数限制 | [optional] [default to 100] |
| **source** | **String**| controller / promoter / override | [optional] |
| **action** | **String**| 事件类型过滤 | [optional] |
| **sinceTs** | **BigDecimal**| 起始时间戳 | [optional] |
| **untilTs** | **BigDecimal**| 结束时间戳 | [optional] |

### Return type

[**ModelApiResponse**](ModelApiResponse.md)

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

