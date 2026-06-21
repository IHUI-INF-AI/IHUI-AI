# zhs_api.MonitorInhibitionPlaygroundApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**inhibition_dry_run_api_v1_monitor_inhibition_dry_run_post**](MonitorInhibitionPlaygroundApi.md#inhibition_dry_run_api_v1_monitor_inhibition_dry_run_post) | **POST** /api/v1/monitor/inhibition/dry-run | Inhibition Dry Run
[**inhibition_dry_run_api_v1_monitor_inhibition_dry_run_post_0**](MonitorInhibitionPlaygroundApi.md#inhibition_dry_run_api_v1_monitor_inhibition_dry_run_post_0) | **POST** /api/v1/monitor/inhibition/dry-run | Inhibition Dry Run
[**list_presets_api_v1_monitor_inhibition_presets_get**](MonitorInhibitionPlaygroundApi.md#list_presets_api_v1_monitor_inhibition_presets_get) | **GET** /api/v1/monitor/inhibition/presets | List Presets
[**list_presets_api_v1_monitor_inhibition_presets_get_0**](MonitorInhibitionPlaygroundApi.md#list_presets_api_v1_monitor_inhibition_presets_get_0) | **GET** /api/v1/monitor/inhibition/presets | List Presets


# **inhibition_dry_run_api_v1_monitor_inhibition_dry_run_post**
> ApiResponse inhibition_dry_run_api_v1_monitor_inhibition_dry_run_post(playground_request)

Inhibition Dry Run

抑制规则 playground (建议 150).

给定任意告警 + 任意抑制规则, 返回哪些会被抑制 / 命中哪条规则.
不修改全局默认 inhibitor, 不影响生产告警通路.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.api_response import ApiResponse
from zhs_api.models.playground_request import PlaygroundRequest
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
    api_instance = zhs_api.MonitorInhibitionPlaygroundApi(api_client)
    playground_request = zhs_api.PlaygroundRequest() # PlaygroundRequest | 

    try:
        # Inhibition Dry Run
        api_response = api_instance.inhibition_dry_run_api_v1_monitor_inhibition_dry_run_post(playground_request)
        print("The response of MonitorInhibitionPlaygroundApi->inhibition_dry_run_api_v1_monitor_inhibition_dry_run_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorInhibitionPlaygroundApi->inhibition_dry_run_api_v1_monitor_inhibition_dry_run_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **playground_request** | [**PlaygroundRequest**](PlaygroundRequest.md)|  | 

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

# **inhibition_dry_run_api_v1_monitor_inhibition_dry_run_post_0**
> ApiResponse inhibition_dry_run_api_v1_monitor_inhibition_dry_run_post_0(playground_request)

Inhibition Dry Run

抑制规则 playground (建议 150).

给定任意告警 + 任意抑制规则, 返回哪些会被抑制 / 命中哪条规则.
不修改全局默认 inhibitor, 不影响生产告警通路.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.api_response import ApiResponse
from zhs_api.models.playground_request import PlaygroundRequest
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
    api_instance = zhs_api.MonitorInhibitionPlaygroundApi(api_client)
    playground_request = zhs_api.PlaygroundRequest() # PlaygroundRequest | 

    try:
        # Inhibition Dry Run
        api_response = api_instance.inhibition_dry_run_api_v1_monitor_inhibition_dry_run_post_0(playground_request)
        print("The response of MonitorInhibitionPlaygroundApi->inhibition_dry_run_api_v1_monitor_inhibition_dry_run_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorInhibitionPlaygroundApi->inhibition_dry_run_api_v1_monitor_inhibition_dry_run_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **playground_request** | [**PlaygroundRequest**](PlaygroundRequest.md)|  | 

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

# **list_presets_api_v1_monitor_inhibition_presets_get**
> ApiResponse list_presets_api_v1_monitor_inhibition_presets_get()

List Presets

列出 ZHS 平台预设抑制规则 (用于 playground 调试参考).

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
    api_instance = zhs_api.MonitorInhibitionPlaygroundApi(api_client)

    try:
        # List Presets
        api_response = api_instance.list_presets_api_v1_monitor_inhibition_presets_get()
        print("The response of MonitorInhibitionPlaygroundApi->list_presets_api_v1_monitor_inhibition_presets_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorInhibitionPlaygroundApi->list_presets_api_v1_monitor_inhibition_presets_get: %s\n" % e)
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

# **list_presets_api_v1_monitor_inhibition_presets_get_0**
> ApiResponse list_presets_api_v1_monitor_inhibition_presets_get_0()

List Presets

列出 ZHS 平台预设抑制规则 (用于 playground 调试参考).

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
    api_instance = zhs_api.MonitorInhibitionPlaygroundApi(api_client)

    try:
        # List Presets
        api_response = api_instance.list_presets_api_v1_monitor_inhibition_presets_get_0()
        print("The response of MonitorInhibitionPlaygroundApi->list_presets_api_v1_monitor_inhibition_presets_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorInhibitionPlaygroundApi->list_presets_api_v1_monitor_inhibition_presets_get_0: %s\n" % e)
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

