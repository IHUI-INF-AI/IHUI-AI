# zhs_api.CanaryApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**get_canary_stage_api_v1_canary_canary_stage_get**](CanaryApi.md#get_canary_stage_api_v1_canary_canary_stage_get) | **GET** /api/v1/canary/canary/stage | Get Canary Stage
[**get_canary_stage_api_v1_canary_canary_stage_get_0**](CanaryApi.md#get_canary_stage_api_v1_canary_canary_stage_get_0) | **GET** /api/v1/canary/canary/stage | Get Canary Stage
[**post_canary_failure_api_v1_canary_canary_failure_post**](CanaryApi.md#post_canary_failure_api_v1_canary_canary_failure_post) | **POST** /api/v1/canary/canary/failure | Post Canary Failure
[**post_canary_failure_api_v1_canary_canary_failure_post_0**](CanaryApi.md#post_canary_failure_api_v1_canary_canary_failure_post_0) | **POST** /api/v1/canary/canary/failure | Post Canary Failure
[**post_canary_promote_api_v1_canary_canary_promote_post**](CanaryApi.md#post_canary_promote_api_v1_canary_canary_promote_post) | **POST** /api/v1/canary/canary/promote | Post Canary Promote
[**post_canary_promote_api_v1_canary_canary_promote_post_0**](CanaryApi.md#post_canary_promote_api_v1_canary_canary_promote_post_0) | **POST** /api/v1/canary/canary/promote | Post Canary Promote
[**post_canary_reset_api_v1_canary_canary_reset_post**](CanaryApi.md#post_canary_reset_api_v1_canary_canary_reset_post) | **POST** /api/v1/canary/canary/reset | Post Canary Reset
[**post_canary_reset_api_v1_canary_canary_reset_post_0**](CanaryApi.md#post_canary_reset_api_v1_canary_canary_reset_post_0) | **POST** /api/v1/canary/canary/reset | Post Canary Reset
[**post_canary_rollback_api_v1_canary_canary_rollback_post**](CanaryApi.md#post_canary_rollback_api_v1_canary_canary_rollback_post) | **POST** /api/v1/canary/canary/rollback | Post Canary Rollback
[**post_canary_rollback_api_v1_canary_canary_rollback_post_0**](CanaryApi.md#post_canary_rollback_api_v1_canary_canary_rollback_post_0) | **POST** /api/v1/canary/canary/rollback | Post Canary Rollback
[**post_canary_traffic_api_v1_canary_canary_traffic_post**](CanaryApi.md#post_canary_traffic_api_v1_canary_canary_traffic_post) | **POST** /api/v1/canary/canary/traffic | Post Canary Traffic
[**post_canary_traffic_api_v1_canary_canary_traffic_post_0**](CanaryApi.md#post_canary_traffic_api_v1_canary_canary_traffic_post_0) | **POST** /api/v1/canary/canary/traffic | Post Canary Traffic


# **get_canary_stage_api_v1_canary_canary_stage_get**
> CanaryResponse get_canary_stage_api_v1_canary_canary_stage_get()

Get Canary Stage

查询当前 canary 阶段状态 (建议 133: 需 admin 角色).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.canary_response import CanaryResponse
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
    api_instance = zhs_api.CanaryApi(api_client)

    try:
        # Get Canary Stage
        api_response = api_instance.get_canary_stage_api_v1_canary_canary_stage_get()
        print("The response of CanaryApi->get_canary_stage_api_v1_canary_canary_stage_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CanaryApi->get_canary_stage_api_v1_canary_canary_stage_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

# **get_canary_stage_api_v1_canary_canary_stage_get_0**
> CanaryResponse get_canary_stage_api_v1_canary_canary_stage_get_0()

Get Canary Stage

查询当前 canary 阶段状态 (建议 133: 需 admin 角色).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.canary_response import CanaryResponse
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
    api_instance = zhs_api.CanaryApi(api_client)

    try:
        # Get Canary Stage
        api_response = api_instance.get_canary_stage_api_v1_canary_canary_stage_get_0()
        print("The response of CanaryApi->get_canary_stage_api_v1_canary_canary_stage_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CanaryApi->get_canary_stage_api_v1_canary_canary_stage_get_0: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

# **post_canary_failure_api_v1_canary_canary_failure_post**
> CanaryResponse post_canary_failure_api_v1_canary_canary_failure_post(failure_request)

Post Canary Failure

标记一次失败 (累计达阈值自动回滚, 建议 133: 需 admin 角色).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.canary_response import CanaryResponse
from zhs_api.models.failure_request import FailureRequest
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
    api_instance = zhs_api.CanaryApi(api_client)
    failure_request = zhs_api.FailureRequest() # FailureRequest | 

    try:
        # Post Canary Failure
        api_response = api_instance.post_canary_failure_api_v1_canary_canary_failure_post(failure_request)
        print("The response of CanaryApi->post_canary_failure_api_v1_canary_canary_failure_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CanaryApi->post_canary_failure_api_v1_canary_canary_failure_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **failure_request** | [**FailureRequest**](FailureRequest.md)|  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

# **post_canary_failure_api_v1_canary_canary_failure_post_0**
> CanaryResponse post_canary_failure_api_v1_canary_canary_failure_post_0(failure_request)

Post Canary Failure

标记一次失败 (累计达阈值自动回滚, 建议 133: 需 admin 角色).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.canary_response import CanaryResponse
from zhs_api.models.failure_request import FailureRequest
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
    api_instance = zhs_api.CanaryApi(api_client)
    failure_request = zhs_api.FailureRequest() # FailureRequest | 

    try:
        # Post Canary Failure
        api_response = api_instance.post_canary_failure_api_v1_canary_canary_failure_post_0(failure_request)
        print("The response of CanaryApi->post_canary_failure_api_v1_canary_canary_failure_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CanaryApi->post_canary_failure_api_v1_canary_canary_failure_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **failure_request** | [**FailureRequest**](FailureRequest.md)|  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

# **post_canary_promote_api_v1_canary_canary_promote_post**
> CanaryResponse post_canary_promote_api_v1_canary_canary_promote_post(promote_request)

Post Canary Promote

提升到下一阶段 (受 cooldown 约束, 建议 133: 需 admin 角色).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.canary_response import CanaryResponse
from zhs_api.models.promote_request import PromoteRequest
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
    api_instance = zhs_api.CanaryApi(api_client)
    promote_request = zhs_api.PromoteRequest() # PromoteRequest | 

    try:
        # Post Canary Promote
        api_response = api_instance.post_canary_promote_api_v1_canary_canary_promote_post(promote_request)
        print("The response of CanaryApi->post_canary_promote_api_v1_canary_canary_promote_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CanaryApi->post_canary_promote_api_v1_canary_canary_promote_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **promote_request** | [**PromoteRequest**](PromoteRequest.md)|  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

# **post_canary_promote_api_v1_canary_canary_promote_post_0**
> CanaryResponse post_canary_promote_api_v1_canary_canary_promote_post_0(promote_request)

Post Canary Promote

提升到下一阶段 (受 cooldown 约束, 建议 133: 需 admin 角色).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.canary_response import CanaryResponse
from zhs_api.models.promote_request import PromoteRequest
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
    api_instance = zhs_api.CanaryApi(api_client)
    promote_request = zhs_api.PromoteRequest() # PromoteRequest | 

    try:
        # Post Canary Promote
        api_response = api_instance.post_canary_promote_api_v1_canary_canary_promote_post_0(promote_request)
        print("The response of CanaryApi->post_canary_promote_api_v1_canary_canary_promote_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CanaryApi->post_canary_promote_api_v1_canary_canary_promote_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **promote_request** | [**PromoteRequest**](PromoteRequest.md)|  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

# **post_canary_reset_api_v1_canary_canary_reset_post**
> CanaryResponse post_canary_reset_api_v1_canary_canary_reset_post(reset_request)

Post Canary Reset

重置到 STAGE_0 (新灰度周期, 建议 133: 需 admin 角色).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.canary_response import CanaryResponse
from zhs_api.models.reset_request import ResetRequest
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
    api_instance = zhs_api.CanaryApi(api_client)
    reset_request = zhs_api.ResetRequest() # ResetRequest | 

    try:
        # Post Canary Reset
        api_response = api_instance.post_canary_reset_api_v1_canary_canary_reset_post(reset_request)
        print("The response of CanaryApi->post_canary_reset_api_v1_canary_canary_reset_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CanaryApi->post_canary_reset_api_v1_canary_canary_reset_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **reset_request** | [**ResetRequest**](ResetRequest.md)|  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

# **post_canary_reset_api_v1_canary_canary_reset_post_0**
> CanaryResponse post_canary_reset_api_v1_canary_canary_reset_post_0(reset_request)

Post Canary Reset

重置到 STAGE_0 (新灰度周期, 建议 133: 需 admin 角色).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.canary_response import CanaryResponse
from zhs_api.models.reset_request import ResetRequest
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
    api_instance = zhs_api.CanaryApi(api_client)
    reset_request = zhs_api.ResetRequest() # ResetRequest | 

    try:
        # Post Canary Reset
        api_response = api_instance.post_canary_reset_api_v1_canary_canary_reset_post_0(reset_request)
        print("The response of CanaryApi->post_canary_reset_api_v1_canary_canary_reset_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CanaryApi->post_canary_reset_api_v1_canary_canary_reset_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **reset_request** | [**ResetRequest**](ResetRequest.md)|  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

# **post_canary_rollback_api_v1_canary_canary_rollback_post**
> CanaryResponse post_canary_rollback_api_v1_canary_canary_rollback_post(rollback_request)

Post Canary Rollback

回滚到上一阶段 (不受 cooldown 限制, 建议 133: 需 admin 角色).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.canary_response import CanaryResponse
from zhs_api.models.rollback_request import RollbackRequest
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
    api_instance = zhs_api.CanaryApi(api_client)
    rollback_request = zhs_api.RollbackRequest() # RollbackRequest | 

    try:
        # Post Canary Rollback
        api_response = api_instance.post_canary_rollback_api_v1_canary_canary_rollback_post(rollback_request)
        print("The response of CanaryApi->post_canary_rollback_api_v1_canary_canary_rollback_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CanaryApi->post_canary_rollback_api_v1_canary_canary_rollback_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **rollback_request** | [**RollbackRequest**](RollbackRequest.md)|  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

# **post_canary_rollback_api_v1_canary_canary_rollback_post_0**
> CanaryResponse post_canary_rollback_api_v1_canary_canary_rollback_post_0(rollback_request)

Post Canary Rollback

回滚到上一阶段 (不受 cooldown 限制, 建议 133: 需 admin 角色).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.canary_response import CanaryResponse
from zhs_api.models.rollback_request import RollbackRequest
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
    api_instance = zhs_api.CanaryApi(api_client)
    rollback_request = zhs_api.RollbackRequest() # RollbackRequest | 

    try:
        # Post Canary Rollback
        api_response = api_instance.post_canary_rollback_api_v1_canary_canary_rollback_post_0(rollback_request)
        print("The response of CanaryApi->post_canary_rollback_api_v1_canary_canary_rollback_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CanaryApi->post_canary_rollback_api_v1_canary_canary_rollback_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **rollback_request** | [**RollbackRequest**](RollbackRequest.md)|  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

# **post_canary_traffic_api_v1_canary_canary_traffic_post**
> CanaryResponse post_canary_traffic_api_v1_canary_canary_traffic_post(traffic_request)

Post Canary Traffic

报告阶段内流量数 (建议 133: 需 admin 角色).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.canary_response import CanaryResponse
from zhs_api.models.traffic_request import TrafficRequest
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
    api_instance = zhs_api.CanaryApi(api_client)
    traffic_request = zhs_api.TrafficRequest() # TrafficRequest | 

    try:
        # Post Canary Traffic
        api_response = api_instance.post_canary_traffic_api_v1_canary_canary_traffic_post(traffic_request)
        print("The response of CanaryApi->post_canary_traffic_api_v1_canary_canary_traffic_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CanaryApi->post_canary_traffic_api_v1_canary_canary_traffic_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **traffic_request** | [**TrafficRequest**](TrafficRequest.md)|  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

# **post_canary_traffic_api_v1_canary_canary_traffic_post_0**
> CanaryResponse post_canary_traffic_api_v1_canary_canary_traffic_post_0(traffic_request)

Post Canary Traffic

报告阶段内流量数 (建议 133: 需 admin 角色).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.canary_response import CanaryResponse
from zhs_api.models.traffic_request import TrafficRequest
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
    api_instance = zhs_api.CanaryApi(api_client)
    traffic_request = zhs_api.TrafficRequest() # TrafficRequest | 

    try:
        # Post Canary Traffic
        api_response = api_instance.post_canary_traffic_api_v1_canary_canary_traffic_post_0(traffic_request)
        print("The response of CanaryApi->post_canary_traffic_api_v1_canary_canary_traffic_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CanaryApi->post_canary_traffic_api_v1_canary_canary_traffic_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **traffic_request** | [**TrafficRequest**](TrafficRequest.md)|  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

