# zhs_api.HealthApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**health_health_get**](HealthApi.md#health_health_get) | **GET** /health | 综合健康检查
[**health_live_health_live_get**](HealthApi.md#health_live_health_live_get) | **GET** /health/live | Liveness probe (K8s)
[**health_ready_health_ready_get**](HealthApi.md#health_ready_health_ready_get) | **GET** /health/ready | Readiness probe (K8s)
[**metrics_rate_limit_metrics_rate_limit_get**](HealthApi.md#metrics_rate_limit_metrics_rate_limit_get) | **GET** /metrics/rate-limit | 限流 Prometheus 指标


# **health_health_get**
> object health_health_get()

综合健康检查

综合健康 - 包含 liveness + readiness 信息 (兼容旧版).

### Example


```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.HealthApi(api_client)

    try:
        # 综合健康检查
        api_response = api_instance.health_health_get()
        print("The response of HealthApi->health_health_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling HealthApi->health_health_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **health_live_health_live_get**
> object health_live_health_live_get()

Liveness probe (K8s)

进程是否在跑 - 不查 DB/Redis, 永远 200 (除非进程死了).

### Example


```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.HealthApi(api_client)

    try:
        # Liveness probe (K8s)
        api_response = api_instance.health_live_health_live_get()
        print("The response of HealthApi->health_live_health_live_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling HealthApi->health_live_health_live_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **health_ready_health_ready_get**
> object health_ready_health_ready_get()

Readiness probe (K8s)

是否可以接受流量 - 检查所有依赖.

返回 200 表示 ready, 503 表示 not ready (K8s 会停止发流量过来).

### Example


```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.HealthApi(api_client)

    try:
        # Readiness probe (K8s)
        api_response = api_instance.health_ready_health_ready_get()
        print("The response of HealthApi->health_ready_health_ready_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling HealthApi->health_ready_health_ready_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **metrics_rate_limit_metrics_rate_limit_get**
> object metrics_rate_limit_metrics_rate_limit_get()

限流 Prometheus 指标

返回限流相关 Prometheus 指标 (Plain text 格式).

可被 Prometheus 抓取, 也可用 curl 直接查看.

### Example


```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.HealthApi(api_client)

    try:
        # 限流 Prometheus 指标
        api_response = api_instance.metrics_rate_limit_metrics_rate_limit_get()
        print("The response of HealthApi->metrics_rate_limit_metrics_rate_limit_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling HealthApi->metrics_rate_limit_metrics_rate_limit_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

