# zhs_api.BotsApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_bot_api_v1_bots_create_post**](BotsApi.md#create_bot_api_v1_bots_create_post) | **POST** /api/v1/bots/create | 创建 Bot
[**delete_bot_api_v1_bots_delete_post**](BotsApi.md#delete_bot_api_v1_bots_delete_post) | **POST** /api/v1/bots/delete | 删除 Bot
[**get_bot_api_v1_bots_bot_id_get**](BotsApi.md#get_bot_api_v1_bots_bot_id_get) | **GET** /api/v1/bots/{bot_id} | Bot 详情
[**list_bots_api_v1_bots_list_get**](BotsApi.md#list_bots_api_v1_bots_list_get) | **GET** /api/v1/bots/list | Bot 列表
[**list_datasets_api_v1_bots_datasets_list_get**](BotsApi.md#list_datasets_api_v1_bots_datasets_list_get) | **GET** /api/v1/bots/datasets/list | Bot 关联知识库列表
[**publish_bot_api_v1_bots_publish_post**](BotsApi.md#publish_bot_api_v1_bots_publish_post) | **POST** /api/v1/bots/publish | 发布 Bot
[**update_bot_api_v1_bots_update_post**](BotsApi.md#update_bot_api_v1_bots_update_post) | **POST** /api/v1/bots/update | 更新 Bot


# **create_bot_api_v1_bots_create_post**
> object create_bot_api_v1_bots_create_post(name, description=description, persona=persona)

创建 Bot

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
    api_instance = zhs_api.BotsApi(api_client)
    name = 'name_example' # str | 
    description = '' # str |  (optional) (default to '')
    persona = '' # str | Bot 人设描述 (optional) (default to '')

    try:
        # 创建 Bot
        api_response = api_instance.create_bot_api_v1_bots_create_post(name, description=description, persona=persona)
        print("The response of BotsApi->create_bot_api_v1_bots_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling BotsApi->create_bot_api_v1_bots_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **str**|  | 
 **description** | **str**|  | [optional] [default to &#39;&#39;]
 **persona** | **str**| Bot 人设描述 | [optional] [default to &#39;&#39;]

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

# **delete_bot_api_v1_bots_delete_post**
> object delete_bot_api_v1_bots_delete_post(bot_id)

删除 Bot

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
    api_instance = zhs_api.BotsApi(api_client)
    bot_id = 'bot_id_example' # str | 

    try:
        # 删除 Bot
        api_response = api_instance.delete_bot_api_v1_bots_delete_post(bot_id)
        print("The response of BotsApi->delete_bot_api_v1_bots_delete_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling BotsApi->delete_bot_api_v1_bots_delete_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bot_id** | **str**|  | 

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

# **get_bot_api_v1_bots_bot_id_get**
> object get_bot_api_v1_bots_bot_id_get(bot_id)

Bot 详情

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
    api_instance = zhs_api.BotsApi(api_client)
    bot_id = 'bot_id_example' # str | 

    try:
        # Bot 详情
        api_response = api_instance.get_bot_api_v1_bots_bot_id_get(bot_id)
        print("The response of BotsApi->get_bot_api_v1_bots_bot_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling BotsApi->get_bot_api_v1_bots_bot_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bot_id** | **str**|  | 

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

# **list_bots_api_v1_bots_list_get**
> object list_bots_api_v1_bots_list_get(page=page, page_size=page_size, space_id=space_id)

Bot 列表

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
    api_instance = zhs_api.BotsApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    page_size = 20 # int |  (optional) (default to 20)
    space_id = '' # str | 空间 ID，默认使用 settings.COZE_ACCOUNT_ID (optional) (default to '')

    try:
        # Bot 列表
        api_response = api_instance.list_bots_api_v1_bots_list_get(page=page, page_size=page_size, space_id=space_id)
        print("The response of BotsApi->list_bots_api_v1_bots_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling BotsApi->list_bots_api_v1_bots_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **page_size** | **int**|  | [optional] [default to 20]
 **space_id** | **str**| 空间 ID，默认使用 settings.COZE_ACCOUNT_ID | [optional] [default to &#39;&#39;]

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

# **list_datasets_api_v1_bots_datasets_list_get**
> object list_datasets_api_v1_bots_datasets_list_get(page=page, page_size=page_size)

Bot 关联知识库列表

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
    api_instance = zhs_api.BotsApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    page_size = 20 # int |  (optional) (default to 20)

    try:
        # Bot 关联知识库列表
        api_response = api_instance.list_datasets_api_v1_bots_datasets_list_get(page=page, page_size=page_size)
        print("The response of BotsApi->list_datasets_api_v1_bots_datasets_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling BotsApi->list_datasets_api_v1_bots_datasets_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **page_size** | **int**|  | [optional] [default to 20]

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

# **publish_bot_api_v1_bots_publish_post**
> object publish_bot_api_v1_bots_publish_post(bot_id, version=version)

发布 Bot

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
    api_instance = zhs_api.BotsApi(api_client)
    bot_id = 'bot_id_example' # str | 
    version = '' # str |  (optional) (default to '')

    try:
        # 发布 Bot
        api_response = api_instance.publish_bot_api_v1_bots_publish_post(bot_id, version=version)
        print("The response of BotsApi->publish_bot_api_v1_bots_publish_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling BotsApi->publish_bot_api_v1_bots_publish_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bot_id** | **str**|  | 
 **version** | **str**|  | [optional] [default to &#39;&#39;]

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

# **update_bot_api_v1_bots_update_post**
> object update_bot_api_v1_bots_update_post(bot_id, name=name, description=description, persona=persona)

更新 Bot

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
    api_instance = zhs_api.BotsApi(api_client)
    bot_id = 'bot_id_example' # str | 
    name = 'name_example' # str |  (optional)
    description = 'description_example' # str |  (optional)
    persona = 'persona_example' # str |  (optional)

    try:
        # 更新 Bot
        api_response = api_instance.update_bot_api_v1_bots_update_post(bot_id, name=name, description=description, persona=persona)
        print("The response of BotsApi->update_bot_api_v1_bots_update_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling BotsApi->update_bot_api_v1_bots_update_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bot_id** | **str**|  | 
 **name** | **str**|  | [optional] 
 **description** | **str**|  | [optional] 
 **persona** | **str**|  | [optional] 

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

