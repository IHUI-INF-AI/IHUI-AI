# zhs_api.MonitorBackfillProgressApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**backfill_history_api_v1_monitor_backfill_history_get**](MonitorBackfillProgressApi.md#backfill_history_api_v1_monitor_backfill_history_get) | **GET** /api/v1/monitor/backfill/history | Backfill 最近历史事件
[**backfill_progress_api_v1_monitor_backfill_progress_get**](MonitorBackfillProgressApi.md#backfill_progress_api_v1_monitor_backfill_progress_get) | **GET** /api/v1/monitor/backfill/progress | Backfill 实时进度 (SSE)
[**backfill_reset_api_v1_monitor_backfill_reset_post**](MonitorBackfillProgressApi.md#backfill_reset_api_v1_monitor_backfill_reset_post) | **POST** /api/v1/monitor/backfill/reset | 重置 backfill 状态
[**backfill_status_api_v1_monitor_backfill_status_get**](MonitorBackfillProgressApi.md#backfill_status_api_v1_monitor_backfill_status_get) | **GET** /api/v1/monitor/backfill/status | Backfill 状态快照


# **backfill_history_api_v1_monitor_backfill_history_get**
> object backfill_history_api_v1_monitor_backfill_history_get(limit=limit)

Backfill 最近历史事件

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.MonitorBackfillProgressApi(api_client)
    limit = 50 # int |  (optional) (default to 50)

    try:
        # Backfill 最近历史事件
        api_response = api_instance.backfill_history_api_v1_monitor_backfill_history_get(limit=limit)
        print("The response of MonitorBackfillProgressApi->backfill_history_api_v1_monitor_backfill_history_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorBackfillProgressApi->backfill_history_api_v1_monitor_backfill_history_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **int**|  | [optional] [default to 50]

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **backfill_progress_api_v1_monitor_backfill_progress_get**
> object backfill_progress_api_v1_monitor_backfill_progress_get()

Backfill 实时进度 (SSE)

Server-Sent Events: 实时推送 backfill 进度.

数据格式 (每行一条 SSE 事件):
    event: started
    data: {"event_type": "started", "table": "users", "total": 10000, ...}

    event: tenant_progress
    data: {"event_type": "tenant_progress", "table": "users", "tenant_id": 1, "processed": 500, "total": 2000, ...}

    event: heartbeat
    data: {"event_type": "heartbeat", ...}

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
    api_instance = zhs_api.MonitorBackfillProgressApi(api_client)

    try:
        # Backfill 实时进度 (SSE)
        api_response = api_instance.backfill_progress_api_v1_monitor_backfill_progress_get()
        print("The response of MonitorBackfillProgressApi->backfill_progress_api_v1_monitor_backfill_progress_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorBackfillProgressApi->backfill_progress_api_v1_monitor_backfill_progress_get: %s\n" % e)
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

# **backfill_reset_api_v1_monitor_backfill_reset_post**
> object backfill_reset_api_v1_monitor_backfill_reset_post()

重置 backfill 状态

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.MonitorBackfillProgressApi(api_client)

    try:
        # 重置 backfill 状态
        api_response = api_instance.backfill_reset_api_v1_monitor_backfill_reset_post()
        print("The response of MonitorBackfillProgressApi->backfill_reset_api_v1_monitor_backfill_reset_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorBackfillProgressApi->backfill_reset_api_v1_monitor_backfill_reset_post: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **backfill_status_api_v1_monitor_backfill_status_get**
> object backfill_status_api_v1_monitor_backfill_status_get()

Backfill 状态快照

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.MonitorBackfillProgressApi(api_client)

    try:
        # Backfill 状态快照
        api_response = api_instance.backfill_status_api_v1_monitor_backfill_status_get()
        print("The response of MonitorBackfillProgressApi->backfill_status_api_v1_monitor_backfill_status_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorBackfillProgressApi->backfill_status_api_v1_monitor_backfill_status_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

