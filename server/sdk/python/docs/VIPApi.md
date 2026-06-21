# zhs_api.VIPApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**check_vip_api_v1_user_check_get**](VIPApi.md#check_vip_api_v1_user_check_get) | **GET** /api/v1/user/check | Check current user VIP status
[**get_my_vip_api_v1_user_my_get**](VIPApi.md#get_my_vip_api_v1_user_my_get) | **GET** /api/v1/user/my | Get current user VIP info
[**get_vip_level_detail_api_v1_user_level_vip_id_get**](VIPApi.md#get_vip_level_detail_api_v1_user_level_vip_id_get) | **GET** /api/v1/user/level/{vip_id} | Get VIP level detail
[**get_vip_levels_api_v1_user_levels_get**](VIPApi.md#get_vip_levels_api_v1_user_levels_get) | **GET** /api/v1/user/levels | Get all VIP levels
[**subscribe_vip_api_v1_user_subscribe_post**](VIPApi.md#subscribe_vip_api_v1_user_subscribe_post) | **POST** /api/v1/user/subscribe | Subscribe VIP (create order)


# **check_vip_api_v1_user_check_get**
> object check_vip_api_v1_user_check_get()

Check current user VIP status

Quickly check whether the current user is an active VIP and what level.

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
    api_instance = zhs_api.VIPApi(api_client)

    try:
        # Check current user VIP status
        api_response = api_instance.check_vip_api_v1_user_check_get()
        print("The response of VIPApi->check_vip_api_v1_user_check_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VIPApi->check_vip_api_v1_user_check_get: %s\n" % e)
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

# **get_my_vip_api_v1_user_my_get**
> object get_my_vip_api_v1_user_my_get()

Get current user VIP info

Return the current user's VIP subscription: level, expiration, and benefits.

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
    api_instance = zhs_api.VIPApi(api_client)

    try:
        # Get current user VIP info
        api_response = api_instance.get_my_vip_api_v1_user_my_get()
        print("The response of VIPApi->get_my_vip_api_v1_user_my_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VIPApi->get_my_vip_api_v1_user_my_get: %s\n" % e)
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

# **get_vip_level_detail_api_v1_user_level_vip_id_get**
> object get_vip_level_detail_api_v1_user_level_vip_id_get(vip_id)

Get VIP level detail

Return details of a single VIP level by its ID.

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
    api_instance = zhs_api.VIPApi(api_client)
    vip_id = 56 # int | 

    try:
        # Get VIP level detail
        api_response = api_instance.get_vip_level_detail_api_v1_user_level_vip_id_get(vip_id)
        print("The response of VIPApi->get_vip_level_detail_api_v1_user_level_vip_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VIPApi->get_vip_level_detail_api_v1_user_level_vip_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **vip_id** | **int**|  | 

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

# **get_vip_levels_api_v1_user_levels_get**
> object get_vip_levels_api_v1_user_levels_get()

Get all VIP levels

Return the list of all active VIP levels.

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
    api_instance = zhs_api.VIPApi(api_client)

    try:
        # Get all VIP levels
        api_response = api_instance.get_vip_levels_api_v1_user_levels_get()
        print("The response of VIPApi->get_vip_levels_api_v1_user_levels_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VIPApi->get_vip_levels_api_v1_user_levels_get: %s\n" % e)
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

# **subscribe_vip_api_v1_user_subscribe_post**
> object subscribe_vip_api_v1_user_subscribe_post(subscribe_request)

Subscribe VIP (create order)

Create a new VIP subscription for the current user.

If the user already has an active subscription that hasn't expired,
the new subscription starts after the existing one ends.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.subscribe_request import SubscribeRequest
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
    api_instance = zhs_api.VIPApi(api_client)
    subscribe_request = zhs_api.SubscribeRequest() # SubscribeRequest | 

    try:
        # Subscribe VIP (create order)
        api_response = api_instance.subscribe_vip_api_v1_user_subscribe_post(subscribe_request)
        print("The response of VIPApi->subscribe_vip_api_v1_user_subscribe_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VIPApi->subscribe_vip_api_v1_user_subscribe_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **subscribe_request** | [**SubscribeRequest**](SubscribeRequest.md)|  | 

### Return type

**object**

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

