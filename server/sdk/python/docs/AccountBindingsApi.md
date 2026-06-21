# zhs_api.AccountBindingsApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**list_bindings_api_v1_auth_auth_bindings_get**](AccountBindingsApi.md#list_bindings_api_v1_auth_auth_bindings_get) | **GET** /api/v1/auth/auth/bindings/ | List all third-party bindings
[**list_bindings_api_v1_auth_auth_bindings_get_0**](AccountBindingsApi.md#list_bindings_api_v1_auth_auth_bindings_get_0) | **GET** /api/v1/auth/auth/bindings/ | List all third-party bindings
[**remove_by_platform_api_v1_auth_auth_bindings_remove_post**](AccountBindingsApi.md#remove_by_platform_api_v1_auth_auth_bindings_remove_post) | **POST** /api/v1/auth/auth/bindings/remove | Unbind third-party account by platform
[**remove_by_platform_api_v1_auth_auth_bindings_remove_post_0**](AccountBindingsApi.md#remove_by_platform_api_v1_auth_auth_bindings_remove_post_0) | **POST** /api/v1/auth/auth/bindings/remove | Unbind third-party account by platform
[**unbind_api_v1_auth_auth_bindings_binding_id_delete**](AccountBindingsApi.md#unbind_api_v1_auth_auth_bindings_binding_id_delete) | **DELETE** /api/v1/auth/auth/bindings/{binding_id} | Unbind third-party account by ID
[**unbind_api_v1_auth_auth_bindings_binding_id_delete_0**](AccountBindingsApi.md#unbind_api_v1_auth_auth_bindings_binding_id_delete_0) | **DELETE** /api/v1/auth/auth/bindings/{binding_id} | Unbind third-party account by ID


# **list_bindings_api_v1_auth_auth_bindings_get**
> object list_bindings_api_v1_auth_auth_bindings_get()

List all third-party bindings

Get all third-party account bindings for the current user.

Matches Java: AuthorizationManagementServlet.getList(uuid)

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
    api_instance = zhs_api.AccountBindingsApi(api_client)

    try:
        # List all third-party bindings
        api_response = api_instance.list_bindings_api_v1_auth_auth_bindings_get()
        print("The response of AccountBindingsApi->list_bindings_api_v1_auth_auth_bindings_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AccountBindingsApi->list_bindings_api_v1_auth_auth_bindings_get: %s\n" % e)
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

# **list_bindings_api_v1_auth_auth_bindings_get_0**
> object list_bindings_api_v1_auth_auth_bindings_get_0()

List all third-party bindings

Get all third-party account bindings for the current user.

Matches Java: AuthorizationManagementServlet.getList(uuid)

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
    api_instance = zhs_api.AccountBindingsApi(api_client)

    try:
        # List all third-party bindings
        api_response = api_instance.list_bindings_api_v1_auth_auth_bindings_get_0()
        print("The response of AccountBindingsApi->list_bindings_api_v1_auth_auth_bindings_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AccountBindingsApi->list_bindings_api_v1_auth_auth_bindings_get_0: %s\n" % e)
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

# **remove_by_platform_api_v1_auth_auth_bindings_remove_post**
> object remove_by_platform_api_v1_auth_auth_bindings_remove_post(body_remove_by_platform_api_v1_auth_auth_bindings_remove_post)

Unbind third-party account by platform

Remove a third-party account binding by uuid + platform.

Matches Java: AuthorizationManagementController.delAuth -> AuthorizationManagementServlet.delAuth(uuid, platform)
SQL: DELETE FROM user_third_party_accounts WHERE user_uuid = #{uuid} AND platform = #{platform}

### Example


```python
import zhs_api
from zhs_api.models.body_remove_by_platform_api_v1_auth_auth_bindings_remove_post import BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost
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
    api_instance = zhs_api.AccountBindingsApi(api_client)
    body_remove_by_platform_api_v1_auth_auth_bindings_remove_post = zhs_api.BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost() # BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost | 

    try:
        # Unbind third-party account by platform
        api_response = api_instance.remove_by_platform_api_v1_auth_auth_bindings_remove_post(body_remove_by_platform_api_v1_auth_auth_bindings_remove_post)
        print("The response of AccountBindingsApi->remove_by_platform_api_v1_auth_auth_bindings_remove_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AccountBindingsApi->remove_by_platform_api_v1_auth_auth_bindings_remove_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_remove_by_platform_api_v1_auth_auth_bindings_remove_post** | [**BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost**](BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **remove_by_platform_api_v1_auth_auth_bindings_remove_post_0**
> object remove_by_platform_api_v1_auth_auth_bindings_remove_post_0(body_remove_by_platform_api_v1_auth_auth_bindings_remove_post)

Unbind third-party account by platform

Remove a third-party account binding by uuid + platform.

Matches Java: AuthorizationManagementController.delAuth -> AuthorizationManagementServlet.delAuth(uuid, platform)
SQL: DELETE FROM user_third_party_accounts WHERE user_uuid = #{uuid} AND platform = #{platform}

### Example


```python
import zhs_api
from zhs_api.models.body_remove_by_platform_api_v1_auth_auth_bindings_remove_post import BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost
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
    api_instance = zhs_api.AccountBindingsApi(api_client)
    body_remove_by_platform_api_v1_auth_auth_bindings_remove_post = zhs_api.BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost() # BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost | 

    try:
        # Unbind third-party account by platform
        api_response = api_instance.remove_by_platform_api_v1_auth_auth_bindings_remove_post_0(body_remove_by_platform_api_v1_auth_auth_bindings_remove_post)
        print("The response of AccountBindingsApi->remove_by_platform_api_v1_auth_auth_bindings_remove_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AccountBindingsApi->remove_by_platform_api_v1_auth_auth_bindings_remove_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_remove_by_platform_api_v1_auth_auth_bindings_remove_post** | [**BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost**](BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **unbind_api_v1_auth_auth_bindings_binding_id_delete**
> object unbind_api_v1_auth_auth_bindings_binding_id_delete(binding_id)

Unbind third-party account by ID

Remove a third-party account binding by ID.

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
    api_instance = zhs_api.AccountBindingsApi(api_client)
    binding_id = 56 # int | 

    try:
        # Unbind third-party account by ID
        api_response = api_instance.unbind_api_v1_auth_auth_bindings_binding_id_delete(binding_id)
        print("The response of AccountBindingsApi->unbind_api_v1_auth_auth_bindings_binding_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AccountBindingsApi->unbind_api_v1_auth_auth_bindings_binding_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **binding_id** | **int**|  | 

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

# **unbind_api_v1_auth_auth_bindings_binding_id_delete_0**
> object unbind_api_v1_auth_auth_bindings_binding_id_delete_0(binding_id)

Unbind third-party account by ID

Remove a third-party account binding by ID.

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
    api_instance = zhs_api.AccountBindingsApi(api_client)
    binding_id = 56 # int | 

    try:
        # Unbind third-party account by ID
        api_response = api_instance.unbind_api_v1_auth_auth_bindings_binding_id_delete_0(binding_id)
        print("The response of AccountBindingsApi->unbind_api_v1_auth_auth_bindings_binding_id_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AccountBindingsApi->unbind_api_v1_auth_auth_bindings_binding_id_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **binding_id** | **int**|  | 

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

