# zhs_api.AgentCacheApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**cache_clear_api_v1_agents_clear_post**](AgentCacheApi.md#cache_clear_api_v1_agents_clear_post) | **POST** /api/v1/agents/clear | Clear category cache
[**cache_info_api_v1_agents_info_get**](AgentCacheApi.md#cache_info_api_v1_agents_info_get) | **GET** /api/v1/agents/info | Get category cache info
[**cache_reload_api_v1_agents_reload_post**](AgentCacheApi.md#cache_reload_api_v1_agents_reload_post) | **POST** /api/v1/agents/reload | Reload category cache from DB
[**cache_search_api_v1_agents_search_get**](AgentCacheApi.md#cache_search_api_v1_agents_search_get) | **GET** /api/v1/agents/search | Search categories in cache


# **cache_clear_api_v1_agents_clear_post**
> object cache_clear_api_v1_agents_clear_post()

Clear category cache

Clear the in-memory category cache.

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
    api_instance = zhs_api.AgentCacheApi(api_client)

    try:
        # Clear category cache
        api_response = api_instance.cache_clear_api_v1_agents_clear_post()
        print("The response of AgentCacheApi->cache_clear_api_v1_agents_clear_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentCacheApi->cache_clear_api_v1_agents_clear_post: %s\n" % e)
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

# **cache_info_api_v1_agents_info_get**
> object cache_info_api_v1_agents_info_get()

Get category cache info

Return cache metadata: size, last reload time, version.

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
    api_instance = zhs_api.AgentCacheApi(api_client)

    try:
        # Get category cache info
        api_response = api_instance.cache_info_api_v1_agents_info_get()
        print("The response of AgentCacheApi->cache_info_api_v1_agents_info_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentCacheApi->cache_info_api_v1_agents_info_get: %s\n" % e)
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

# **cache_reload_api_v1_agents_reload_post**
> object cache_reload_api_v1_agents_reload_post()

Reload category cache from DB

Force-reload agent categories from database into memory cache.

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
    api_instance = zhs_api.AgentCacheApi(api_client)

    try:
        # Reload category cache from DB
        api_response = api_instance.cache_reload_api_v1_agents_reload_post()
        print("The response of AgentCacheApi->cache_reload_api_v1_agents_reload_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentCacheApi->cache_reload_api_v1_agents_reload_post: %s\n" % e)
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

# **cache_search_api_v1_agents_search_get**
> object cache_search_api_v1_agents_search_get(keyword=keyword, group=group, type=type)

Search categories in cache

Search cached agent categories with optional filters.

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
    api_instance = zhs_api.AgentCacheApi(api_client)
    keyword = 'keyword_example' # str | Search keyword for agent_id (optional)
    group = 56 # int | Filter by group (optional)
    type = 'type_example' # str | Filter by type (optional)

    try:
        # Search categories in cache
        api_response = api_instance.cache_search_api_v1_agents_search_get(keyword=keyword, group=group, type=type)
        print("The response of AgentCacheApi->cache_search_api_v1_agents_search_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentCacheApi->cache_search_api_v1_agents_search_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **keyword** | **str**| Search keyword for agent_id | [optional] 
 **group** | **int**| Filter by group | [optional] 
 **type** | **str**| Filter by type | [optional] 

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

