# HealthApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**healthHealthGet**](HealthApi.md#healthHealthGet) | **GET** /health | 综合健康检查 |
| [**healthLiveHealthLiveGet**](HealthApi.md#healthLiveHealthLiveGet) | **GET** /health/live | Liveness probe (K8s) |
| [**healthReadyHealthReadyGet**](HealthApi.md#healthReadyHealthReadyGet) | **GET** /health/ready | Readiness probe (K8s) |
| [**metricsRateLimitMetricsRateLimitGet**](HealthApi.md#metricsRateLimitMetricsRateLimitGet) | **GET** /metrics/rate-limit | 限流 Prometheus 指标 |


<a id="healthHealthGet"></a>
# **healthHealthGet**
> Object healthHealthGet()

综合健康检查

综合健康 - 包含 liveness + readiness 信息 (兼容旧版).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.HealthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    HealthApi apiInstance = new HealthApi(defaultClient);
    try {
      Object result = apiInstance.healthHealthGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling HealthApi#healthHealthGet");
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

<a id="healthLiveHealthLiveGet"></a>
# **healthLiveHealthLiveGet**
> Object healthLiveHealthLiveGet()

Liveness probe (K8s)

进程是否在跑 - 不查 DB/Redis, 永远 200 (除非进程死了).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.HealthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    HealthApi apiInstance = new HealthApi(defaultClient);
    try {
      Object result = apiInstance.healthLiveHealthLiveGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling HealthApi#healthLiveHealthLiveGet");
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

<a id="healthReadyHealthReadyGet"></a>
# **healthReadyHealthReadyGet**
> Object healthReadyHealthReadyGet()

Readiness probe (K8s)

是否可以接受流量 - 检查所有依赖.  返回 200 表示 ready, 503 表示 not ready (K8s 会停止发流量过来).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.HealthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    HealthApi apiInstance = new HealthApi(defaultClient);
    try {
      Object result = apiInstance.healthReadyHealthReadyGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling HealthApi#healthReadyHealthReadyGet");
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

<a id="metricsRateLimitMetricsRateLimitGet"></a>
# **metricsRateLimitMetricsRateLimitGet**
> Object metricsRateLimitMetricsRateLimitGet()

限流 Prometheus 指标

返回限流相关 Prometheus 指标 (Plain text 格式).  可被 Prometheus 抓取, 也可用 curl 直接查看.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.HealthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    HealthApi apiInstance = new HealthApi(defaultClient);
    try {
      Object result = apiInstance.metricsRateLimitMetricsRateLimitGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling HealthApi#metricsRateLimitMetricsRateLimitGet");
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

