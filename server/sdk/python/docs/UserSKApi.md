# zhs_api.UserSKApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_sk_api_v1_auth_user_sk_create_post**](UserSKApi.md#create_sk_api_v1_auth_user_sk_create_post) | **POST** /api/v1/auth/user-sk/create | Create a secret key
[**create_sk_api_v1_auth_user_sk_create_post_0**](UserSKApi.md#create_sk_api_v1_auth_user_sk_create_post_0) | **POST** /api/v1/auth/user-sk/create | Create a secret key
[**delete_sk_api_v1_auth_user_sk_sk_id_delete**](UserSKApi.md#delete_sk_api_v1_auth_user_sk_sk_id_delete) | **DELETE** /api/v1/auth/user-sk/{sk_id} | Delete a secret key
[**delete_sk_api_v1_auth_user_sk_sk_id_delete_0**](UserSKApi.md#delete_sk_api_v1_auth_user_sk_sk_id_delete_0) | **DELETE** /api/v1/auth/user-sk/{sk_id} | Delete a secret key
[**list_sks_api_v1_auth_user_sk_list_get**](UserSKApi.md#list_sks_api_v1_auth_user_sk_list_get) | **GET** /api/v1/auth/user-sk/list | List user secret keys
[**list_sks_api_v1_auth_user_sk_list_get_0**](UserSKApi.md#list_sks_api_v1_auth_user_sk_list_get_0) | **GET** /api/v1/auth/user-sk/list | List user secret keys
[**update_sk_api_v1_auth_user_sk_sk_id_put**](UserSKApi.md#update_sk_api_v1_auth_user_sk_sk_id_put) | **PUT** /api/v1/auth/user-sk/{sk_id} | Update a secret key
[**update_sk_api_v1_auth_user_sk_sk_id_put_0**](UserSKApi.md#update_sk_api_v1_auth_user_sk_sk_id_put_0) | **PUT** /api/v1/auth/user-sk/{sk_id} | Update a secret key


# **create_sk_api_v1_auth_user_sk_create_post**
> object create_sk_api_v1_auth_user_sk_create_post(body)

Create a secret key

Generate a new secret key for the authenticated user.

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
    api_instance = zhs_api.UserSKApi(api_client)
    body = None # object | 

    try:
        # Create a secret key
        api_response = api_instance.create_sk_api_v1_auth_user_sk_create_post(body)
        print("The response of UserSKApi->create_sk_api_v1_auth_user_sk_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserSKApi->create_sk_api_v1_auth_user_sk_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body** | **object**|  | 

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

# **create_sk_api_v1_auth_user_sk_create_post_0**
> object create_sk_api_v1_auth_user_sk_create_post_0(body)

Create a secret key

Generate a new secret key for the authenticated user.

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
    api_instance = zhs_api.UserSKApi(api_client)
    body = None # object | 

    try:
        # Create a secret key
        api_response = api_instance.create_sk_api_v1_auth_user_sk_create_post_0(body)
        print("The response of UserSKApi->create_sk_api_v1_auth_user_sk_create_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserSKApi->create_sk_api_v1_auth_user_sk_create_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body** | **object**|  | 

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

# **delete_sk_api_v1_auth_user_sk_sk_id_delete**
> object delete_sk_api_v1_auth_user_sk_sk_id_delete(sk_id)

Delete a secret key

Delete a secret key owned by the authenticated user.

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
    api_instance = zhs_api.UserSKApi(api_client)
    sk_id = 56 # int | 

    try:
        # Delete a secret key
        api_response = api_instance.delete_sk_api_v1_auth_user_sk_sk_id_delete(sk_id)
        print("The response of UserSKApi->delete_sk_api_v1_auth_user_sk_sk_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserSKApi->delete_sk_api_v1_auth_user_sk_sk_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sk_id** | **int**|  | 

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

# **delete_sk_api_v1_auth_user_sk_sk_id_delete_0**
> object delete_sk_api_v1_auth_user_sk_sk_id_delete_0(sk_id)

Delete a secret key

Delete a secret key owned by the authenticated user.

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
    api_instance = zhs_api.UserSKApi(api_client)
    sk_id = 56 # int | 

    try:
        # Delete a secret key
        api_response = api_instance.delete_sk_api_v1_auth_user_sk_sk_id_delete_0(sk_id)
        print("The response of UserSKApi->delete_sk_api_v1_auth_user_sk_sk_id_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserSKApi->delete_sk_api_v1_auth_user_sk_sk_id_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sk_id** | **int**|  | 

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

# **list_sks_api_v1_auth_user_sk_list_get**
> object list_sks_api_v1_auth_user_sk_list_get(page=page, limit=limit)

List user secret keys

List all secret keys for the authenticated user with pagination.

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
    api_instance = zhs_api.UserSKApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # List user secret keys
        api_response = api_instance.list_sks_api_v1_auth_user_sk_list_get(page=page, limit=limit)
        print("The response of UserSKApi->list_sks_api_v1_auth_user_sk_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserSKApi->list_sks_api_v1_auth_user_sk_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]

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

# **list_sks_api_v1_auth_user_sk_list_get_0**
> object list_sks_api_v1_auth_user_sk_list_get_0(page=page, limit=limit)

List user secret keys

List all secret keys for the authenticated user with pagination.

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
    api_instance = zhs_api.UserSKApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # List user secret keys
        api_response = api_instance.list_sks_api_v1_auth_user_sk_list_get_0(page=page, limit=limit)
        print("The response of UserSKApi->list_sks_api_v1_auth_user_sk_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserSKApi->list_sks_api_v1_auth_user_sk_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]

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

# **update_sk_api_v1_auth_user_sk_sk_id_put**
> object update_sk_api_v1_auth_user_sk_sk_id_put(sk_id, sk_update_body)

Update a secret key

Update secret key name or status.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.sk_update_body import SKUpdateBody
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
    api_instance = zhs_api.UserSKApi(api_client)
    sk_id = 56 # int | 
    sk_update_body = zhs_api.SKUpdateBody() # SKUpdateBody | 

    try:
        # Update a secret key
        api_response = api_instance.update_sk_api_v1_auth_user_sk_sk_id_put(sk_id, sk_update_body)
        print("The response of UserSKApi->update_sk_api_v1_auth_user_sk_sk_id_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserSKApi->update_sk_api_v1_auth_user_sk_sk_id_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sk_id** | **int**|  | 
 **sk_update_body** | [**SKUpdateBody**](SKUpdateBody.md)|  | 

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

# **update_sk_api_v1_auth_user_sk_sk_id_put_0**
> object update_sk_api_v1_auth_user_sk_sk_id_put_0(sk_id, sk_update_body)

Update a secret key

Update secret key name or status.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.sk_update_body import SKUpdateBody
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
    api_instance = zhs_api.UserSKApi(api_client)
    sk_id = 56 # int | 
    sk_update_body = zhs_api.SKUpdateBody() # SKUpdateBody | 

    try:
        # Update a secret key
        api_response = api_instance.update_sk_api_v1_auth_user_sk_sk_id_put_0(sk_id, sk_update_body)
        print("The response of UserSKApi->update_sk_api_v1_auth_user_sk_sk_id_put_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserSKApi->update_sk_api_v1_auth_user_sk_sk_id_put_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sk_id** | **int**|  | 
 **sk_update_body** | [**SKUpdateBody**](SKUpdateBody.md)|  | 

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

