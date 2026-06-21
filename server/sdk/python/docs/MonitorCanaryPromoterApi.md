# zhs_api.MonitorCanaryPromoterApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**get_override_api_v1_monitor_canary_promoter_override_get**](MonitorCanaryPromoterApi.md#get_override_api_v1_monitor_canary_promoter_override_get) | **GET** /api/v1/monitor/canary-promoter/override | Get Override
[**get_promoter_status_api_v1_monitor_canary_promoter_status_get**](MonitorCanaryPromoterApi.md#get_promoter_status_api_v1_monitor_canary_promoter_status_get) | **GET** /api/v1/monitor/canary-promoter/status | Get Promoter Status
[**post_force_promote_api_v1_monitor_canary_promoter_force_promote_post**](MonitorCanaryPromoterApi.md#post_force_promote_api_v1_monitor_canary_promoter_force_promote_post) | **POST** /api/v1/monitor/canary-promoter/force-promote | Post Force Promote
[**post_force_rollback_api_v1_monitor_canary_promoter_force_rollback_post**](MonitorCanaryPromoterApi.md#post_force_rollback_api_v1_monitor_canary_promoter_force_rollback_post) | **POST** /api/v1/monitor/canary-promoter/force-rollback | Post Force Rollback
[**post_pause_override_api_v1_monitor_canary_promoter_pause_post**](MonitorCanaryPromoterApi.md#post_pause_override_api_v1_monitor_canary_promoter_pause_post) | **POST** /api/v1/monitor/canary-promoter/pause | Post Pause Override
[**post_resume_override_api_v1_monitor_canary_promoter_resume_post**](MonitorCanaryPromoterApi.md#post_resume_override_api_v1_monitor_canary_promoter_resume_post) | **POST** /api/v1/monitor/canary-promoter/resume | Post Resume Override


# **get_override_api_v1_monitor_canary_promoter_override_get**
> ApiResponse get_override_api_v1_monitor_canary_promoter_override_get()

Get Override

拿 override 详细状态 + 日志.

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
    api_instance = zhs_api.MonitorCanaryPromoterApi(api_client)

    try:
        # Get Override
        api_response = api_instance.get_override_api_v1_monitor_canary_promoter_override_get()
        print("The response of MonitorCanaryPromoterApi->get_override_api_v1_monitor_canary_promoter_override_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorCanaryPromoterApi->get_override_api_v1_monitor_canary_promoter_override_get: %s\n" % e)
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

# **get_promoter_status_api_v1_monitor_canary_promoter_status_get**
> ApiResponse get_promoter_status_api_v1_monitor_canary_promoter_status_get()

Get Promoter Status

拿 CanaryAutoPromoter 完整状态 (含 override).

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
    api_instance = zhs_api.MonitorCanaryPromoterApi(api_client)

    try:
        # Get Promoter Status
        api_response = api_instance.get_promoter_status_api_v1_monitor_canary_promoter_status_get()
        print("The response of MonitorCanaryPromoterApi->get_promoter_status_api_v1_monitor_canary_promoter_status_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorCanaryPromoterApi->get_promoter_status_api_v1_monitor_canary_promoter_status_get: %s\n" % e)
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

# **post_force_promote_api_v1_monitor_canary_promoter_force_promote_post**
> ApiResponse post_force_promote_api_v1_monitor_canary_promoter_force_promote_post(force_promote_request)

Post Force Promote

强制推进 1 步 (忽略所有检查 + override 暂停).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.api_response import ApiResponse
from zhs_api.models.force_promote_request import ForcePromoteRequest
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
    api_instance = zhs_api.MonitorCanaryPromoterApi(api_client)
    force_promote_request = zhs_api.ForcePromoteRequest() # ForcePromoteRequest | 

    try:
        # Post Force Promote
        api_response = api_instance.post_force_promote_api_v1_monitor_canary_promoter_force_promote_post(force_promote_request)
        print("The response of MonitorCanaryPromoterApi->post_force_promote_api_v1_monitor_canary_promoter_force_promote_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorCanaryPromoterApi->post_force_promote_api_v1_monitor_canary_promoter_force_promote_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **force_promote_request** | [**ForcePromoteRequest**](ForcePromoteRequest.md)|  | 

### Return type

[**ApiResponse**](ApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **post_force_rollback_api_v1_monitor_canary_promoter_force_rollback_post**
> ApiResponse post_force_rollback_api_v1_monitor_canary_promoter_force_rollback_post(force_rollback_request)

Post Force Rollback

强制回滚 (紧急, 不受 cooldown 约束).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.api_response import ApiResponse
from zhs_api.models.force_rollback_request import ForceRollbackRequest
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
    api_instance = zhs_api.MonitorCanaryPromoterApi(api_client)
    force_rollback_request = zhs_api.ForceRollbackRequest() # ForceRollbackRequest | 

    try:
        # Post Force Rollback
        api_response = api_instance.post_force_rollback_api_v1_monitor_canary_promoter_force_rollback_post(force_rollback_request)
        print("The response of MonitorCanaryPromoterApi->post_force_rollback_api_v1_monitor_canary_promoter_force_rollback_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorCanaryPromoterApi->post_force_rollback_api_v1_monitor_canary_promoter_force_rollback_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **force_rollback_request** | [**ForceRollbackRequest**](ForceRollbackRequest.md)|  | 

### Return type

[**ApiResponse**](ApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **post_pause_override_api_v1_monitor_canary_promoter_pause_post**
> ApiResponse post_pause_override_api_v1_monitor_canary_promoter_pause_post(override_pause_request)

Post Pause Override

人工暂停自动推进 (override 模式).

与 promoter.pause() 不同: pause_override 写入 override_log 审计,
支持 until_ts 自动恢复, check_and_promote 会因 override_active 短路.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.api_response import ApiResponse
from zhs_api.models.override_pause_request import OverridePauseRequest
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
    api_instance = zhs_api.MonitorCanaryPromoterApi(api_client)
    override_pause_request = zhs_api.OverridePauseRequest() # OverridePauseRequest | 

    try:
        # Post Pause Override
        api_response = api_instance.post_pause_override_api_v1_monitor_canary_promoter_pause_post(override_pause_request)
        print("The response of MonitorCanaryPromoterApi->post_pause_override_api_v1_monitor_canary_promoter_pause_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorCanaryPromoterApi->post_pause_override_api_v1_monitor_canary_promoter_pause_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **override_pause_request** | [**OverridePauseRequest**](OverridePauseRequest.md)|  | 

### Return type

[**ApiResponse**](ApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **post_resume_override_api_v1_monitor_canary_promoter_resume_post**
> ApiResponse post_resume_override_api_v1_monitor_canary_promoter_resume_post(override_resume_request)

Post Resume Override

解除 override 暂停, 恢复自动检查.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.api_response import ApiResponse
from zhs_api.models.override_resume_request import OverrideResumeRequest
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
    api_instance = zhs_api.MonitorCanaryPromoterApi(api_client)
    override_resume_request = zhs_api.OverrideResumeRequest() # OverrideResumeRequest | 

    try:
        # Post Resume Override
        api_response = api_instance.post_resume_override_api_v1_monitor_canary_promoter_resume_post(override_resume_request)
        print("The response of MonitorCanaryPromoterApi->post_resume_override_api_v1_monitor_canary_promoter_resume_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorCanaryPromoterApi->post_resume_override_api_v1_monitor_canary_promoter_resume_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **override_resume_request** | [**OverrideResumeRequest**](OverrideResumeRequest.md)|  | 

### Return type

[**ApiResponse**](ApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

