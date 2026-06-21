# zhs_api.OAuthApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**authorize_api_v1_auth_oauth_authorize_get**](OAuthApi.md#authorize_api_v1_auth_oauth_authorize_get) | **GET** /api/v1/auth/oauth/authorize | OAuth authorize
[**authorize_api_v1_auth_oauth_authorize_get_0**](OAuthApi.md#authorize_api_v1_auth_oauth_authorize_get_0) | **GET** /api/v1/auth/oauth/authorize | OAuth authorize
[**create_oauth_app_api_v1_auth_oauth_apps_create_post**](OAuthApi.md#create_oauth_app_api_v1_auth_oauth_apps_create_post) | **POST** /api/v1/auth/oauth/apps/create | Create an OAuth application
[**create_oauth_app_api_v1_auth_oauth_apps_create_post_0**](OAuthApi.md#create_oauth_app_api_v1_auth_oauth_apps_create_post_0) | **POST** /api/v1/auth/oauth/apps/create | Create an OAuth application
[**delete_oauth_app_api_v1_auth_oauth_apps_client_id_delete**](OAuthApi.md#delete_oauth_app_api_v1_auth_oauth_apps_client_id_delete) | **DELETE** /api/v1/auth/oauth/apps/{client_id} | Delete OAuth application
[**delete_oauth_app_api_v1_auth_oauth_apps_client_id_delete_0**](OAuthApi.md#delete_oauth_app_api_v1_auth_oauth_apps_client_id_delete_0) | **DELETE** /api/v1/auth/oauth/apps/{client_id} | Delete OAuth application
[**get_oauth_app_api_v1_auth_oauth_apps_client_id_get**](OAuthApi.md#get_oauth_app_api_v1_auth_oauth_apps_client_id_get) | **GET** /api/v1/auth/oauth/apps/{client_id} | Get OAuth application by client_id
[**get_oauth_app_api_v1_auth_oauth_apps_client_id_get_0**](OAuthApi.md#get_oauth_app_api_v1_auth_oauth_apps_client_id_get_0) | **GET** /api/v1/auth/oauth/apps/{client_id} | Get OAuth application by client_id
[**get_oauth_user_api_v1_auth_oauth_users_user_id_get**](OAuthApi.md#get_oauth_user_api_v1_auth_oauth_users_user_id_get) | **GET** /api/v1/auth/oauth/users/{user_id} | OAuth 用户详情
[**get_oauth_user_api_v1_auth_oauth_users_user_id_get_0**](OAuthApi.md#get_oauth_user_api_v1_auth_oauth_users_user_id_get_0) | **GET** /api/v1/auth/oauth/users/{user_id} | OAuth 用户详情
[**list_oauth_apps_api_v1_auth_oauth_apps_list_get**](OAuthApi.md#list_oauth_apps_api_v1_auth_oauth_apps_list_get) | **GET** /api/v1/auth/oauth/apps/list | List OAuth applications
[**list_oauth_apps_api_v1_auth_oauth_apps_list_get_0**](OAuthApi.md#list_oauth_apps_api_v1_auth_oauth_apps_list_get_0) | **GET** /api/v1/auth/oauth/apps/list | List OAuth applications
[**list_oauth_users_api_v1_auth_oauth_users_list_get**](OAuthApi.md#list_oauth_users_api_v1_auth_oauth_users_list_get) | **GET** /api/v1/auth/oauth/users/list | OAuth 用户列表
[**list_oauth_users_api_v1_auth_oauth_users_list_get_0**](OAuthApi.md#list_oauth_users_api_v1_auth_oauth_users_list_get_0) | **GET** /api/v1/auth/oauth/users/list | OAuth 用户列表
[**oauth_token_api_v1_auth_oauth_token_post**](OAuthApi.md#oauth_token_api_v1_auth_oauth_token_post) | **POST** /api/v1/auth/oauth/token | Exchange code for token
[**oauth_token_api_v1_auth_oauth_token_post_0**](OAuthApi.md#oauth_token_api_v1_auth_oauth_token_post_0) | **POST** /api/v1/auth/oauth/token | Exchange code for token


# **authorize_api_v1_auth_oauth_authorize_get**
> object authorize_api_v1_auth_oauth_authorize_get(client_id, redirect_uri, response_type=response_type, state=state)

OAuth authorize

OAuth authorize. State 参数用于 CSRF 防护,客户端必须传并在回调时校验.

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
    api_instance = zhs_api.OAuthApi(api_client)
    client_id = 'client_id_example' # str | 
    redirect_uri = 'redirect_uri_example' # str | 
    response_type = 'code' # str |  (optional) (default to 'code')
    state = 'state_example' # str | CSRF state parameter (optional)

    try:
        # OAuth authorize
        api_response = api_instance.authorize_api_v1_auth_oauth_authorize_get(client_id, redirect_uri, response_type=response_type, state=state)
        print("The response of OAuthApi->authorize_api_v1_auth_oauth_authorize_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OAuthApi->authorize_api_v1_auth_oauth_authorize_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **client_id** | **str**|  | 
 **redirect_uri** | **str**|  | 
 **response_type** | **str**|  | [optional] [default to &#39;code&#39;]
 **state** | **str**| CSRF state parameter | [optional] 

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

# **authorize_api_v1_auth_oauth_authorize_get_0**
> object authorize_api_v1_auth_oauth_authorize_get_0(client_id, redirect_uri, response_type=response_type, state=state)

OAuth authorize

OAuth authorize. State 参数用于 CSRF 防护,客户端必须传并在回调时校验.

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
    api_instance = zhs_api.OAuthApi(api_client)
    client_id = 'client_id_example' # str | 
    redirect_uri = 'redirect_uri_example' # str | 
    response_type = 'code' # str |  (optional) (default to 'code')
    state = 'state_example' # str | CSRF state parameter (optional)

    try:
        # OAuth authorize
        api_response = api_instance.authorize_api_v1_auth_oauth_authorize_get_0(client_id, redirect_uri, response_type=response_type, state=state)
        print("The response of OAuthApi->authorize_api_v1_auth_oauth_authorize_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OAuthApi->authorize_api_v1_auth_oauth_authorize_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **client_id** | **str**|  | 
 **redirect_uri** | **str**|  | 
 **response_type** | **str**|  | [optional] [default to &#39;code&#39;]
 **state** | **str**| CSRF state parameter | [optional] 

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

# **create_oauth_app_api_v1_auth_oauth_apps_create_post**
> object create_oauth_app_api_v1_auth_oauth_apps_create_post(o_auth_app_create_body)

Create an OAuth application

Register a new OAuth application and return client credentials.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.o_auth_app_create_body import OAuthAppCreateBody
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
    api_instance = zhs_api.OAuthApi(api_client)
    o_auth_app_create_body = zhs_api.OAuthAppCreateBody() # OAuthAppCreateBody | 

    try:
        # Create an OAuth application
        api_response = api_instance.create_oauth_app_api_v1_auth_oauth_apps_create_post(o_auth_app_create_body)
        print("The response of OAuthApi->create_oauth_app_api_v1_auth_oauth_apps_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OAuthApi->create_oauth_app_api_v1_auth_oauth_apps_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **o_auth_app_create_body** | [**OAuthAppCreateBody**](OAuthAppCreateBody.md)|  | 

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

# **create_oauth_app_api_v1_auth_oauth_apps_create_post_0**
> object create_oauth_app_api_v1_auth_oauth_apps_create_post_0(o_auth_app_create_body)

Create an OAuth application

Register a new OAuth application and return client credentials.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.o_auth_app_create_body import OAuthAppCreateBody
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
    api_instance = zhs_api.OAuthApi(api_client)
    o_auth_app_create_body = zhs_api.OAuthAppCreateBody() # OAuthAppCreateBody | 

    try:
        # Create an OAuth application
        api_response = api_instance.create_oauth_app_api_v1_auth_oauth_apps_create_post_0(o_auth_app_create_body)
        print("The response of OAuthApi->create_oauth_app_api_v1_auth_oauth_apps_create_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OAuthApi->create_oauth_app_api_v1_auth_oauth_apps_create_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **o_auth_app_create_body** | [**OAuthAppCreateBody**](OAuthAppCreateBody.md)|  | 

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

# **delete_oauth_app_api_v1_auth_oauth_apps_client_id_delete**
> object delete_oauth_app_api_v1_auth_oauth_apps_client_id_delete(client_id)

Delete OAuth application

Delete an OAuth application by its client_id.

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
    api_instance = zhs_api.OAuthApi(api_client)
    client_id = 'client_id_example' # str | 

    try:
        # Delete OAuth application
        api_response = api_instance.delete_oauth_app_api_v1_auth_oauth_apps_client_id_delete(client_id)
        print("The response of OAuthApi->delete_oauth_app_api_v1_auth_oauth_apps_client_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OAuthApi->delete_oauth_app_api_v1_auth_oauth_apps_client_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **client_id** | **str**|  | 

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

# **delete_oauth_app_api_v1_auth_oauth_apps_client_id_delete_0**
> object delete_oauth_app_api_v1_auth_oauth_apps_client_id_delete_0(client_id)

Delete OAuth application

Delete an OAuth application by its client_id.

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
    api_instance = zhs_api.OAuthApi(api_client)
    client_id = 'client_id_example' # str | 

    try:
        # Delete OAuth application
        api_response = api_instance.delete_oauth_app_api_v1_auth_oauth_apps_client_id_delete_0(client_id)
        print("The response of OAuthApi->delete_oauth_app_api_v1_auth_oauth_apps_client_id_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OAuthApi->delete_oauth_app_api_v1_auth_oauth_apps_client_id_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **client_id** | **str**|  | 

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

# **get_oauth_app_api_v1_auth_oauth_apps_client_id_get**
> object get_oauth_app_api_v1_auth_oauth_apps_client_id_get(client_id)

Get OAuth application by client_id

Retrieve a single OAuth application by its client_id.

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
    api_instance = zhs_api.OAuthApi(api_client)
    client_id = 'client_id_example' # str | 

    try:
        # Get OAuth application by client_id
        api_response = api_instance.get_oauth_app_api_v1_auth_oauth_apps_client_id_get(client_id)
        print("The response of OAuthApi->get_oauth_app_api_v1_auth_oauth_apps_client_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OAuthApi->get_oauth_app_api_v1_auth_oauth_apps_client_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **client_id** | **str**|  | 

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

# **get_oauth_app_api_v1_auth_oauth_apps_client_id_get_0**
> object get_oauth_app_api_v1_auth_oauth_apps_client_id_get_0(client_id)

Get OAuth application by client_id

Retrieve a single OAuth application by its client_id.

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
    api_instance = zhs_api.OAuthApi(api_client)
    client_id = 'client_id_example' # str | 

    try:
        # Get OAuth application by client_id
        api_response = api_instance.get_oauth_app_api_v1_auth_oauth_apps_client_id_get_0(client_id)
        print("The response of OAuthApi->get_oauth_app_api_v1_auth_oauth_apps_client_id_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OAuthApi->get_oauth_app_api_v1_auth_oauth_apps_client_id_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **client_id** | **str**|  | 

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

# **get_oauth_user_api_v1_auth_oauth_users_user_id_get**
> object get_oauth_user_api_v1_auth_oauth_users_user_id_get(user_id)

OAuth 用户详情

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
    api_instance = zhs_api.OAuthApi(api_client)
    user_id = 56 # int | 

    try:
        # OAuth 用户详情
        api_response = api_instance.get_oauth_user_api_v1_auth_oauth_users_user_id_get(user_id)
        print("The response of OAuthApi->get_oauth_user_api_v1_auth_oauth_users_user_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OAuthApi->get_oauth_user_api_v1_auth_oauth_users_user_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **user_id** | **int**|  | 

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

# **get_oauth_user_api_v1_auth_oauth_users_user_id_get_0**
> object get_oauth_user_api_v1_auth_oauth_users_user_id_get_0(user_id)

OAuth 用户详情

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
    api_instance = zhs_api.OAuthApi(api_client)
    user_id = 56 # int | 

    try:
        # OAuth 用户详情
        api_response = api_instance.get_oauth_user_api_v1_auth_oauth_users_user_id_get_0(user_id)
        print("The response of OAuthApi->get_oauth_user_api_v1_auth_oauth_users_user_id_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OAuthApi->get_oauth_user_api_v1_auth_oauth_users_user_id_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **user_id** | **int**|  | 

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

# **list_oauth_apps_api_v1_auth_oauth_apps_list_get**
> object list_oauth_apps_api_v1_auth_oauth_apps_list_get(page=page, limit=limit)

List OAuth applications

List all OAuth applications with pagination.

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
    api_instance = zhs_api.OAuthApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # List OAuth applications
        api_response = api_instance.list_oauth_apps_api_v1_auth_oauth_apps_list_get(page=page, limit=limit)
        print("The response of OAuthApi->list_oauth_apps_api_v1_auth_oauth_apps_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OAuthApi->list_oauth_apps_api_v1_auth_oauth_apps_list_get: %s\n" % e)
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

# **list_oauth_apps_api_v1_auth_oauth_apps_list_get_0**
> object list_oauth_apps_api_v1_auth_oauth_apps_list_get_0(page=page, limit=limit)

List OAuth applications

List all OAuth applications with pagination.

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
    api_instance = zhs_api.OAuthApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # List OAuth applications
        api_response = api_instance.list_oauth_apps_api_v1_auth_oauth_apps_list_get_0(page=page, limit=limit)
        print("The response of OAuthApi->list_oauth_apps_api_v1_auth_oauth_apps_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OAuthApi->list_oauth_apps_api_v1_auth_oauth_apps_list_get_0: %s\n" % e)
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

# **list_oauth_users_api_v1_auth_oauth_users_list_get**
> object list_oauth_users_api_v1_auth_oauth_users_list_get(page=page, limit=limit, provider=provider)

OAuth 用户列表

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
    api_instance = zhs_api.OAuthApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    provider = 'provider_example' # str | 按 provider 过滤 (optional)

    try:
        # OAuth 用户列表
        api_response = api_instance.list_oauth_users_api_v1_auth_oauth_users_list_get(page=page, limit=limit, provider=provider)
        print("The response of OAuthApi->list_oauth_users_api_v1_auth_oauth_users_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OAuthApi->list_oauth_users_api_v1_auth_oauth_users_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **provider** | **str**| 按 provider 过滤 | [optional] 

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

# **list_oauth_users_api_v1_auth_oauth_users_list_get_0**
> object list_oauth_users_api_v1_auth_oauth_users_list_get_0(page=page, limit=limit, provider=provider)

OAuth 用户列表

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
    api_instance = zhs_api.OAuthApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    provider = 'provider_example' # str | 按 provider 过滤 (optional)

    try:
        # OAuth 用户列表
        api_response = api_instance.list_oauth_users_api_v1_auth_oauth_users_list_get_0(page=page, limit=limit, provider=provider)
        print("The response of OAuthApi->list_oauth_users_api_v1_auth_oauth_users_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OAuthApi->list_oauth_users_api_v1_auth_oauth_users_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **provider** | **str**| 按 provider 过滤 | [optional] 

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

# **oauth_token_api_v1_auth_oauth_token_post**
> object oauth_token_api_v1_auth_oauth_token_post(code, client_id, client_secret, state=state)

Exchange code for token

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
    api_instance = zhs_api.OAuthApi(api_client)
    code = 'code_example' # str | 
    client_id = 'client_id_example' # str | 
    client_secret = 'client_secret_example' # str | 
    state = 'state_example' # str | CSRF state to verify against session (optional)

    try:
        # Exchange code for token
        api_response = api_instance.oauth_token_api_v1_auth_oauth_token_post(code, client_id, client_secret, state=state)
        print("The response of OAuthApi->oauth_token_api_v1_auth_oauth_token_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OAuthApi->oauth_token_api_v1_auth_oauth_token_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**|  | 
 **client_id** | **str**|  | 
 **client_secret** | **str**|  | 
 **state** | **str**| CSRF state to verify against session | [optional] 

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
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **oauth_token_api_v1_auth_oauth_token_post_0**
> object oauth_token_api_v1_auth_oauth_token_post_0(code, client_id, client_secret, state=state)

Exchange code for token

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
    api_instance = zhs_api.OAuthApi(api_client)
    code = 'code_example' # str | 
    client_id = 'client_id_example' # str | 
    client_secret = 'client_secret_example' # str | 
    state = 'state_example' # str | CSRF state to verify against session (optional)

    try:
        # Exchange code for token
        api_response = api_instance.oauth_token_api_v1_auth_oauth_token_post_0(code, client_id, client_secret, state=state)
        print("The response of OAuthApi->oauth_token_api_v1_auth_oauth_token_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OAuthApi->oauth_token_api_v1_auth_oauth_token_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**|  | 
 **client_id** | **str**|  | 
 **client_secret** | **str**|  | 
 **state** | **str**| CSRF state to verify against session | [optional] 

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
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

