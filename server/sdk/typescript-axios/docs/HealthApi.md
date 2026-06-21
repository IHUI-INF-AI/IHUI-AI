# HealthApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**healthHealthGet**](#healthhealthget) | **GET** /health | 综合健康检查|
|[**healthLiveHealthLiveGet**](#healthlivehealthliveget) | **GET** /health/live | Liveness probe (K8s)|
|[**healthReadyHealthReadyGet**](#healthreadyhealthreadyget) | **GET** /health/ready | Readiness probe (K8s)|
|[**metricsRateLimitMetricsRateLimitGet**](#metricsratelimitmetricsratelimitget) | **GET** /metrics/rate-limit | 限流 Prometheus 指标|

# **healthHealthGet**
> any healthHealthGet()

综合健康 - 包含 liveness + readiness 信息 (兼容旧版).

### Example

```typescript
import {
    HealthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new HealthApi(configuration);

const { status, data } = await apiInstance.healthHealthGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **healthLiveHealthLiveGet**
> any healthLiveHealthLiveGet()

进程是否在跑 - 不查 DB/Redis, 永远 200 (除非进程死了).

### Example

```typescript
import {
    HealthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new HealthApi(configuration);

const { status, data } = await apiInstance.healthLiveHealthLiveGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **healthReadyHealthReadyGet**
> any healthReadyHealthReadyGet()

是否可以接受流量 - 检查所有依赖.  返回 200 表示 ready, 503 表示 not ready (K8s 会停止发流量过来).

### Example

```typescript
import {
    HealthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new HealthApi(configuration);

const { status, data } = await apiInstance.healthReadyHealthReadyGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **metricsRateLimitMetricsRateLimitGet**
> any metricsRateLimitMetricsRateLimitGet()

返回限流相关 Prometheus 指标 (Plain text 格式).  可被 Prometheus 抓取, 也可用 curl 直接查看.

### Example

```typescript
import {
    HealthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new HealthApi(configuration);

const { status, data } = await apiInstance.metricsRateLimitMetricsRateLimitGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

