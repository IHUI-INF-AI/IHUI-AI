# zhs_api.AgentCreationApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**get_creation_by_share_code_api_v1_agents_share_third_code_get**](AgentCreationApi.md#get_creation_by_share_code_api_v1_agents_share_third_code_get) | **GET** /api/v1/agents/share/third/{code} | 通过分享码获取创作
[**my_creations_api_v1_agents_my_type_post**](AgentCreationApi.md#my_creations_api_v1_agents_my_type_post) | **POST** /api/v1/agents/my/{type} | 我的创作列表
[**operate_creation_api_v1_agents_operate_gc_id_type_get**](AgentCreationApi.md#operate_creation_api_v1_agents_operate_gc_id_type_get) | **GET** /api/v1/agents/operate/{gc_id}/{type} | 点赞/收藏操作
[**share_creation_api_v1_agents_share_post**](AgentCreationApi.md#share_creation_api_v1_agents_share_post) | **POST** /api/v1/agents/share | 分享创作（生成分享码）
[**share_generate_image_api_v1_agents_share_image_post**](AgentCreationApi.md#share_generate_image_api_v1_agents_share_image_post) | **POST** /api/v1/agents/share/image | 分享生成图片
[**share_to_code_api_v1_agents_share_code_post**](AgentCreationApi.md#share_to_code_api_v1_agents_share_code_post) | **POST** /api/v1/agents/share/code | 分享转CODE


# **get_creation_by_share_code_api_v1_agents_share_third_code_get**
> object get_creation_by_share_code_api_v1_agents_share_third_code_get(code)

通过分享码获取创作

Public endpoint — retrieve a creation by its share code.

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
    api_instance = zhs_api.AgentCreationApi(api_client)
    code = 'code_example' # str | 

    try:
        # 通过分享码获取创作
        api_response = api_instance.get_creation_by_share_code_api_v1_agents_share_third_code_get(code)
        print("The response of AgentCreationApi->get_creation_by_share_code_api_v1_agents_share_third_code_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentCreationApi->get_creation_by_share_code_api_v1_agents_share_third_code_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**|  | 

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

# **my_creations_api_v1_agents_my_type_post**
> object my_creations_api_v1_agents_my_type_post(type, page=page, limit=limit)

我的创作列表

Return the current user's creations filtered by type.

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
    api_instance = zhs_api.AgentCreationApi(api_client)
    type = 'type_example' # str | 
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 我的创作列表
        api_response = api_instance.my_creations_api_v1_agents_my_type_post(type, page=page, limit=limit)
        print("The response of AgentCreationApi->my_creations_api_v1_agents_my_type_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentCreationApi->my_creations_api_v1_agents_my_type_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type** | **str**|  | 
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

# **operate_creation_api_v1_agents_operate_gc_id_type_get**
> object operate_creation_api_v1_agents_operate_gc_id_type_get(gc_id, type)

点赞/收藏操作

Toggle like or collect on a creation. Returns new state.

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
    api_instance = zhs_api.AgentCreationApi(api_client)
    gc_id = 'gc_id_example' # str | 
    type = 'type_example' # str | 

    try:
        # 点赞/收藏操作
        api_response = api_instance.operate_creation_api_v1_agents_operate_gc_id_type_get(gc_id, type)
        print("The response of AgentCreationApi->operate_creation_api_v1_agents_operate_gc_id_type_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentCreationApi->operate_creation_api_v1_agents_operate_gc_id_type_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gc_id** | **str**|  | 
 **type** | **str**|  | 

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

# **share_creation_api_v1_agents_share_post**
> object share_creation_api_v1_agents_share_post(gc_id)

分享创作（生成分享码）

Generate a share code for a creation.

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
    api_instance = zhs_api.AgentCreationApi(api_client)
    gc_id = 'gc_id_example' # str | 创作ID

    try:
        # 分享创作（生成分享码）
        api_response = api_instance.share_creation_api_v1_agents_share_post(gc_id)
        print("The response of AgentCreationApi->share_creation_api_v1_agents_share_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentCreationApi->share_creation_api_v1_agents_share_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gc_id** | **str**| 创作ID | 

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

# **share_generate_image_api_v1_agents_share_image_post**
> object share_generate_image_api_v1_agents_share_image_post(gc_id, width=width, height=height)

分享生成图片

Generate a shareable image card for a creation.

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
    api_instance = zhs_api.AgentCreationApi(api_client)
    gc_id = 'gc_id_example' # str | 创作ID
    width = 800 # int | 图片宽度 (optional) (default to 800)
    height = 600 # int | 图片高度 (optional) (default to 600)

    try:
        # 分享生成图片
        api_response = api_instance.share_generate_image_api_v1_agents_share_image_post(gc_id, width=width, height=height)
        print("The response of AgentCreationApi->share_generate_image_api_v1_agents_share_image_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentCreationApi->share_generate_image_api_v1_agents_share_image_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gc_id** | **str**| 创作ID | 
 **width** | **int**| 图片宽度 | [optional] [default to 800]
 **height** | **int**| 图片高度 | [optional] [default to 600]

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

# **share_to_code_api_v1_agents_share_code_post**
> object share_to_code_api_v1_agents_share_code_post(gc_id)

分享转CODE

Convert a share reference to a code (alias for share creation).

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
    api_instance = zhs_api.AgentCreationApi(api_client)
    gc_id = 'gc_id_example' # str | 创作ID

    try:
        # 分享转CODE
        api_response = api_instance.share_to_code_api_v1_agents_share_code_post(gc_id)
        print("The response of AgentCreationApi->share_to_code_api_v1_agents_share_code_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentCreationApi->share_to_code_api_v1_agents_share_code_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gc_id** | **str**| 创作ID | 

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

