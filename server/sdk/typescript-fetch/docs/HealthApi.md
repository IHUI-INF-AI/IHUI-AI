# HealthApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**healthHealthGet**](HealthApi.md#healthhealthget) | **GET** /health | 综合健康检查 |
| [**healthLiveHealthLiveGet**](HealthApi.md#healthlivehealthliveget) | **GET** /health/live | Liveness probe (K8s) |
| [**healthReadyHealthReadyGet**](HealthApi.md#healthreadyhealthreadyget) | **GET** /health/ready | Readiness probe (K8s) |
| [**metricsRateLimitMetricsRateLimitGet**](HealthApi.md#metricsratelimitmetricsratelimitget) | **GET** /metrics/rate-limit | 限流 Prometheus 指标 |



## healthHealthGet

> any healthHealthGet()

综合健康检查

综合健康 - 包含 liveness + readiness 信息 (兼容旧版).

### Example

```ts
import {
  Configuration,
  HealthApi,
} from '';
import type { HealthHealthGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new HealthApi();

  try {
    const data = await api.healthHealthGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## healthLiveHealthLiveGet

> any healthLiveHealthLiveGet()

Liveness probe (K8s)

进程是否在跑 - 不查 DB/Redis, 永远 200 (除非进程死了).

### Example

```ts
import {
  Configuration,
  HealthApi,
} from '';
import type { HealthLiveHealthLiveGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new HealthApi();

  try {
    const data = await api.healthLiveHealthLiveGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## healthReadyHealthReadyGet

> any healthReadyHealthReadyGet()

Readiness probe (K8s)

是否可以接受流量 - 检查所有依赖.  返回 200 表示 ready, 503 表示 not ready (K8s 会停止发流量过来).

### Example

```ts
import {
  Configuration,
  HealthApi,
} from '';
import type { HealthReadyHealthReadyGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new HealthApi();

  try {
    const data = await api.healthReadyHealthReadyGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## metricsRateLimitMetricsRateLimitGet

> any metricsRateLimitMetricsRateLimitGet()

限流 Prometheus 指标

返回限流相关 Prometheus 指标 (Plain text 格式).  可被 Prometheus 抓取, 也可用 curl 直接查看.

### Example

```ts
import {
  Configuration,
  HealthApi,
} from '';
import type { MetricsRateLimitMetricsRateLimitGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new HealthApi();

  try {
    const data = await api.metricsRateLimitMetricsRateLimitGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

