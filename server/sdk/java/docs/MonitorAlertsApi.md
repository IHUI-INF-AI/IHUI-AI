# MonitorAlertsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**alertHistoryApiV1MonitorAlertsHistoryGet**](MonitorAlertsApi.md#alertHistoryApiV1MonitorAlertsHistoryGet) | **GET** /api/v1/monitor/alerts/history | 最近告警历史（内存中） |
| [**alertmanagerWebhookApiV1MonitorAlertsWebhookPost**](MonitorAlertsApi.md#alertmanagerWebhookApiV1MonitorAlertsWebhookPost) | **POST** /api/v1/monitor/alerts/webhook | Alertmanager webhook 接收 |
| [**testAlertApiV1MonitorAlertsTestPost**](MonitorAlertsApi.md#testAlertApiV1MonitorAlertsTestPost) | **POST** /api/v1/monitor/alerts/test | 测试告警推送（手工触发） |


<a id="alertHistoryApiV1MonitorAlertsHistoryGet"></a>
# **alertHistoryApiV1MonitorAlertsHistoryGet**
> Object alertHistoryApiV1MonitorAlertsHistoryGet()

最近告警历史（内存中）

返回最近 50 条告警记录（简易版）。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorAlertsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorAlertsApi apiInstance = new MonitorAlertsApi(defaultClient);
    try {
      Object result = apiInstance.alertHistoryApiV1MonitorAlertsHistoryGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorAlertsApi#alertHistoryApiV1MonitorAlertsHistoryGet");
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

<a id="alertmanagerWebhookApiV1MonitorAlertsWebhookPost"></a>
# **alertmanagerWebhookApiV1MonitorAlertsWebhookPost**
> Object alertmanagerWebhookApiV1MonitorAlertsWebhookPost(dryRun)

Alertmanager webhook 接收

接收 Alertmanager 的告警，转推到钉钉/微信/飞书.  Alertmanager webhook 格式: {   \&quot;version\&quot;: \&quot;4\&quot;,   \&quot;status\&quot;: \&quot;firing\&quot;,   \&quot;alerts\&quot;: [     {\&quot;status\&quot;: \&quot;firing\&quot;, \&quot;labels\&quot;: {...}, \&quot;annotations\&quot;: {...}}   ] }  建议 100 改进: resolved 告警也写入 _ALERT_HISTORY (恢复也是重要事件), 但不再推送 (避免打扰); 严重度变化 (critical → warning) 也走一次 push.  建议 141: 在 push 前应用 alertmanager inhibition 抑制规则, 避免 critical 类告警触发时, 关联 warning 告警一起骚扰.  建议 146: dry_run&#x3D;true 时只统计会抑制哪些, 不真推. 通过查询参数 ?dry_run&#x3D;true 开启.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorAlertsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MonitorAlertsApi apiInstance = new MonitorAlertsApi(defaultClient);
    Boolean dryRun = false; // Boolean | 
    try {
      Object result = apiInstance.alertmanagerWebhookApiV1MonitorAlertsWebhookPost(dryRun);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorAlertsApi#alertmanagerWebhookApiV1MonitorAlertsWebhookPost");
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
| **dryRun** | **Boolean**|  | [optional] [default to false] |

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

<a id="testAlertApiV1MonitorAlertsTestPost"></a>
# **testAlertApiV1MonitorAlertsTestPost**
> Object testAlertApiV1MonitorAlertsTestPost(title, message, severity)

测试告警推送（手工触发）

向所有已配置渠道发一条测试消息.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorAlertsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorAlertsApi apiInstance = new MonitorAlertsApi(defaultClient);
    String title = "测试告警"; // String | 
    String message = "ZHS Platform 告警通道测试"; // String | 
    String severity = "info"; // String | 
    try {
      Object result = apiInstance.testAlertApiV1MonitorAlertsTestPost(title, message, severity);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorAlertsApi#testAlertApiV1MonitorAlertsTestPost");
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
| **title** | **String**|  | [optional] [default to 测试告警] |
| **message** | **String**|  | [optional] [default to ZHS Platform 告警通道测试] |
| **severity** | **String**|  | [optional] [default to info] |

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

