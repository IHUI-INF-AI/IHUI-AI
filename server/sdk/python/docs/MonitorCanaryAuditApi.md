# zhs_api.MonitorCanaryAuditApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**canary_audit_cleanup_api_v1_monitor_canary_audit_cleanup_post**](MonitorCanaryAuditApi.md#canary_audit_cleanup_api_v1_monitor_canary_audit_cleanup_post) | **POST** /api/v1/monitor/canary-audit/cleanup | Canary Audit Cleanup
[**canary_audit_cleanup_api_v1_monitor_canary_audit_cleanup_post_0**](MonitorCanaryAuditApi.md#canary_audit_cleanup_api_v1_monitor_canary_audit_cleanup_post_0) | **POST** /api/v1/monitor/canary-audit/cleanup | Canary Audit Cleanup
[**canary_audit_stats_api_v1_monitor_canary_audit_stats_get**](MonitorCanaryAuditApi.md#canary_audit_stats_api_v1_monitor_canary_audit_stats_get) | **GET** /api/v1/monitor/canary-audit/stats | Canary Audit Stats
[**canary_audit_stats_api_v1_monitor_canary_audit_stats_get_0**](MonitorCanaryAuditApi.md#canary_audit_stats_api_v1_monitor_canary_audit_stats_get_0) | **GET** /api/v1/monitor/canary-audit/stats | Canary Audit Stats
[**query_canary_audit_api_v1_monitor_canary_audit_get**](MonitorCanaryAuditApi.md#query_canary_audit_api_v1_monitor_canary_audit_get) | **GET** /api/v1/monitor/canary-audit | Query Canary Audit
[**query_canary_audit_api_v1_monitor_canary_audit_get_0**](MonitorCanaryAuditApi.md#query_canary_audit_api_v1_monitor_canary_audit_get_0) | **GET** /api/v1/monitor/canary-audit | Query Canary Audit


# **canary_audit_cleanup_api_v1_monitor_canary_audit_cleanup_post**
> ApiResponse canary_audit_cleanup_api_v1_monitor_canary_audit_cleanup_post()

Canary Audit Cleanup

手动触发过期清理 (按 store._retention_days).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.api_response import ApiResponse
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
    api_instance = zhs_api.MonitorCanaryAuditApi(api_client)

    try:
        # Canary Audit Cleanup
        api_response = api_instance.canary_audit_cleanup_api_v1_monitor_canary_audit_cleanup_post()
        print("The response of MonitorCanaryAuditApi->canary_audit_cleanup_api_v1_monitor_canary_audit_cleanup_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorCanaryAuditApi->canary_audit_cleanup_api_v1_monitor_canary_audit_cleanup_post: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

[**ApiResponse**](ApiResponse.md)

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

# **canary_audit_cleanup_api_v1_monitor_canary_audit_cleanup_post_0**
> ApiResponse canary_audit_cleanup_api_v1_monitor_canary_audit_cleanup_post_0()

Canary Audit Cleanup

手动触发过期清理 (按 store._retention_days).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.api_response import ApiResponse
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
    api_instance = zhs_api.MonitorCanaryAuditApi(api_client)

    try:
        # Canary Audit Cleanup
        api_response = api_instance.canary_audit_cleanup_api_v1_monitor_canary_audit_cleanup_post_0()
        print("The response of MonitorCanaryAuditApi->canary_audit_cleanup_api_v1_monitor_canary_audit_cleanup_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorCanaryAuditApi->canary_audit_cleanup_api_v1_monitor_canary_audit_cleanup_post_0: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

[**ApiResponse**](ApiResponse.md)

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

# **canary_audit_stats_api_v1_monitor_canary_audit_stats_get**
> ApiResponse canary_audit_stats_api_v1_monitor_canary_audit_stats_get()

Canary Audit Stats

审计统计 (按 source 分组 + 总数).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.api_response import ApiResponse
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
    api_instance = zhs_api.MonitorCanaryAuditApi(api_client)

    try:
        # Canary Audit Stats
        api_response = api_instance.canary_audit_stats_api_v1_monitor_canary_audit_stats_get()
        print("The response of MonitorCanaryAuditApi->canary_audit_stats_api_v1_monitor_canary_audit_stats_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorCanaryAuditApi->canary_audit_stats_api_v1_monitor_canary_audit_stats_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

[**ApiResponse**](ApiResponse.md)

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

# **canary_audit_stats_api_v1_monitor_canary_audit_stats_get_0**
> ApiResponse canary_audit_stats_api_v1_monitor_canary_audit_stats_get_0()

Canary Audit Stats

审计统计 (按 source 分组 + 总数).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.api_response import ApiResponse
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
    api_instance = zhs_api.MonitorCanaryAuditApi(api_client)

    try:
        # Canary Audit Stats
        api_response = api_instance.canary_audit_stats_api_v1_monitor_canary_audit_stats_get_0()
        print("The response of MonitorCanaryAuditApi->canary_audit_stats_api_v1_monitor_canary_audit_stats_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorCanaryAuditApi->canary_audit_stats_api_v1_monitor_canary_audit_stats_get_0: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

[**ApiResponse**](ApiResponse.md)

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

# **query_canary_audit_api_v1_monitor_canary_audit_get**
> ApiResponse query_canary_audit_api_v1_monitor_canary_audit_get(limit=limit, source=source, action=action, since_ts=since_ts, until_ts=until_ts)

Query Canary Audit

查 Canary 审计日志 (按时间倒序).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.api_response import ApiResponse
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
    api_instance = zhs_api.MonitorCanaryAuditApi(api_client)
    limit = 100 # int | 返回条数限制 (optional) (default to 100)
    source = 'source_example' # str | controller / promoter / override (optional)
    action = 'action_example' # str | 事件类型过滤 (optional)
    since_ts = 3.4 # float | 起始时间戳 (optional)
    until_ts = 3.4 # float | 结束时间戳 (optional)

    try:
        # Query Canary Audit
        api_response = api_instance.query_canary_audit_api_v1_monitor_canary_audit_get(limit=limit, source=source, action=action, since_ts=since_ts, until_ts=until_ts)
        print("The response of MonitorCanaryAuditApi->query_canary_audit_api_v1_monitor_canary_audit_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorCanaryAuditApi->query_canary_audit_api_v1_monitor_canary_audit_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **int**| 返回条数限制 | [optional] [default to 100]
 **source** | **str**| controller / promoter / override | [optional] 
 **action** | **str**| 事件类型过滤 | [optional] 
 **since_ts** | **float**| 起始时间戳 | [optional] 
 **until_ts** | **float**| 结束时间戳 | [optional] 

### Return type

[**ApiResponse**](ApiResponse.md)

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

# **query_canary_audit_api_v1_monitor_canary_audit_get_0**
> ApiResponse query_canary_audit_api_v1_monitor_canary_audit_get_0(limit=limit, source=source, action=action, since_ts=since_ts, until_ts=until_ts)

Query Canary Audit

查 Canary 审计日志 (按时间倒序).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.api_response import ApiResponse
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
    api_instance = zhs_api.MonitorCanaryAuditApi(api_client)
    limit = 100 # int | 返回条数限制 (optional) (default to 100)
    source = 'source_example' # str | controller / promoter / override (optional)
    action = 'action_example' # str | 事件类型过滤 (optional)
    since_ts = 3.4 # float | 起始时间戳 (optional)
    until_ts = 3.4 # float | 结束时间戳 (optional)

    try:
        # Query Canary Audit
        api_response = api_instance.query_canary_audit_api_v1_monitor_canary_audit_get_0(limit=limit, source=source, action=action, since_ts=since_ts, until_ts=until_ts)
        print("The response of MonitorCanaryAuditApi->query_canary_audit_api_v1_monitor_canary_audit_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorCanaryAuditApi->query_canary_audit_api_v1_monitor_canary_audit_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **int**| 返回条数限制 | [optional] [default to 100]
 **source** | **str**| controller / promoter / override | [optional] 
 **action** | **str**| 事件类型过滤 | [optional] 
 **since_ts** | **float**| 起始时间戳 | [optional] 
 **until_ts** | **float**| 结束时间戳 | [optional] 

### Return type

[**ApiResponse**](ApiResponse.md)

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

