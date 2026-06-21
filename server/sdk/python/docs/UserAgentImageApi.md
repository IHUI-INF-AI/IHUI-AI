# zhs_api.UserAgentImageApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_image_api_v1_user_agent_image_post**](UserAgentImageApi.md#create_image_api_v1_user_agent_image_post) | **POST** /api/v1/user-agent-image | 记录图片交互
[**create_image_api_v1_user_agent_image_post_0**](UserAgentImageApi.md#create_image_api_v1_user_agent_image_post_0) | **POST** /api/v1/user-agent-image | 记录图片交互
[**delete_image_api_v1_user_agent_image_iid_delete**](UserAgentImageApi.md#delete_image_api_v1_user_agent_image_iid_delete) | **DELETE** /api/v1/user-agent-image/{iid} | 删除图片记录
[**delete_image_api_v1_user_agent_image_iid_delete_0**](UserAgentImageApi.md#delete_image_api_v1_user_agent_image_iid_delete_0) | **DELETE** /api/v1/user-agent-image/{iid} | 删除图片记录
[**get_image_api_v1_user_agent_image_iid_get**](UserAgentImageApi.md#get_image_api_v1_user_agent_image_iid_get) | **GET** /api/v1/user-agent-image/{iid} | 图片详情
[**get_image_api_v1_user_agent_image_iid_get_0**](UserAgentImageApi.md#get_image_api_v1_user_agent_image_iid_get_0) | **GET** /api/v1/user-agent-image/{iid} | 图片详情
[**list_images_api_v1_user_agent_image_list_get**](UserAgentImageApi.md#list_images_api_v1_user_agent_image_list_get) | **GET** /api/v1/user-agent-image/list | 我的图片交互
[**list_images_api_v1_user_agent_image_list_get_0**](UserAgentImageApi.md#list_images_api_v1_user_agent_image_list_get_0) | **GET** /api/v1/user-agent-image/list | 我的图片交互


# **create_image_api_v1_user_agent_image_post**
> object create_image_api_v1_user_agent_image_post(image_url, image_type=image_type, agent_id=agent_id, agent_name=agent_name, prompt=prompt, model=model, task_id=task_id, status=status, cost=cost, width=width, height=height, size=size)

记录图片交互

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
    api_instance = zhs_api.UserAgentImageApi(api_client)
    image_url = 'image_url_example' # str | 
    image_type = 'input' # str |  (optional) (default to 'input')
    agent_id = 'agent_id_example' # str |  (optional)
    agent_name = 'agent_name_example' # str |  (optional)
    prompt = 'prompt_example' # str |  (optional)
    model = 'model_example' # str |  (optional)
    task_id = 'task_id_example' # str |  (optional)
    status = 1 # int |  (optional) (default to 1)
    cost = 0 # int |  (optional) (default to 0)
    width = 0 # int |  (optional) (default to 0)
    height = 0 # int |  (optional) (default to 0)
    size = 0 # int |  (optional) (default to 0)

    try:
        # 记录图片交互
        api_response = api_instance.create_image_api_v1_user_agent_image_post(image_url, image_type=image_type, agent_id=agent_id, agent_name=agent_name, prompt=prompt, model=model, task_id=task_id, status=status, cost=cost, width=width, height=height, size=size)
        print("The response of UserAgentImageApi->create_image_api_v1_user_agent_image_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserAgentImageApi->create_image_api_v1_user_agent_image_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **image_url** | **str**|  | 
 **image_type** | **str**|  | [optional] [default to &#39;input&#39;]
 **agent_id** | **str**|  | [optional] 
 **agent_name** | **str**|  | [optional] 
 **prompt** | **str**|  | [optional] 
 **model** | **str**|  | [optional] 
 **task_id** | **str**|  | [optional] 
 **status** | **int**|  | [optional] [default to 1]
 **cost** | **int**|  | [optional] [default to 0]
 **width** | **int**|  | [optional] [default to 0]
 **height** | **int**|  | [optional] [default to 0]
 **size** | **int**|  | [optional] [default to 0]

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

# **create_image_api_v1_user_agent_image_post_0**
> object create_image_api_v1_user_agent_image_post_0(image_url, image_type=image_type, agent_id=agent_id, agent_name=agent_name, prompt=prompt, model=model, task_id=task_id, status=status, cost=cost, width=width, height=height, size=size)

记录图片交互

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
    api_instance = zhs_api.UserAgentImageApi(api_client)
    image_url = 'image_url_example' # str | 
    image_type = 'input' # str |  (optional) (default to 'input')
    agent_id = 'agent_id_example' # str |  (optional)
    agent_name = 'agent_name_example' # str |  (optional)
    prompt = 'prompt_example' # str |  (optional)
    model = 'model_example' # str |  (optional)
    task_id = 'task_id_example' # str |  (optional)
    status = 1 # int |  (optional) (default to 1)
    cost = 0 # int |  (optional) (default to 0)
    width = 0 # int |  (optional) (default to 0)
    height = 0 # int |  (optional) (default to 0)
    size = 0 # int |  (optional) (default to 0)

    try:
        # 记录图片交互
        api_response = api_instance.create_image_api_v1_user_agent_image_post_0(image_url, image_type=image_type, agent_id=agent_id, agent_name=agent_name, prompt=prompt, model=model, task_id=task_id, status=status, cost=cost, width=width, height=height, size=size)
        print("The response of UserAgentImageApi->create_image_api_v1_user_agent_image_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserAgentImageApi->create_image_api_v1_user_agent_image_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **image_url** | **str**|  | 
 **image_type** | **str**|  | [optional] [default to &#39;input&#39;]
 **agent_id** | **str**|  | [optional] 
 **agent_name** | **str**|  | [optional] 
 **prompt** | **str**|  | [optional] 
 **model** | **str**|  | [optional] 
 **task_id** | **str**|  | [optional] 
 **status** | **int**|  | [optional] [default to 1]
 **cost** | **int**|  | [optional] [default to 0]
 **width** | **int**|  | [optional] [default to 0]
 **height** | **int**|  | [optional] [default to 0]
 **size** | **int**|  | [optional] [default to 0]

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

# **delete_image_api_v1_user_agent_image_iid_delete**
> object delete_image_api_v1_user_agent_image_iid_delete(iid)

删除图片记录

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
    api_instance = zhs_api.UserAgentImageApi(api_client)
    iid = 56 # int | 

    try:
        # 删除图片记录
        api_response = api_instance.delete_image_api_v1_user_agent_image_iid_delete(iid)
        print("The response of UserAgentImageApi->delete_image_api_v1_user_agent_image_iid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserAgentImageApi->delete_image_api_v1_user_agent_image_iid_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **iid** | **int**|  | 

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

# **delete_image_api_v1_user_agent_image_iid_delete_0**
> object delete_image_api_v1_user_agent_image_iid_delete_0(iid)

删除图片记录

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
    api_instance = zhs_api.UserAgentImageApi(api_client)
    iid = 56 # int | 

    try:
        # 删除图片记录
        api_response = api_instance.delete_image_api_v1_user_agent_image_iid_delete_0(iid)
        print("The response of UserAgentImageApi->delete_image_api_v1_user_agent_image_iid_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserAgentImageApi->delete_image_api_v1_user_agent_image_iid_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **iid** | **int**|  | 

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

# **get_image_api_v1_user_agent_image_iid_get**
> object get_image_api_v1_user_agent_image_iid_get(iid)

图片详情

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
    api_instance = zhs_api.UserAgentImageApi(api_client)
    iid = 56 # int | 

    try:
        # 图片详情
        api_response = api_instance.get_image_api_v1_user_agent_image_iid_get(iid)
        print("The response of UserAgentImageApi->get_image_api_v1_user_agent_image_iid_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserAgentImageApi->get_image_api_v1_user_agent_image_iid_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **iid** | **int**|  | 

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

# **get_image_api_v1_user_agent_image_iid_get_0**
> object get_image_api_v1_user_agent_image_iid_get_0(iid)

图片详情

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
    api_instance = zhs_api.UserAgentImageApi(api_client)
    iid = 56 # int | 

    try:
        # 图片详情
        api_response = api_instance.get_image_api_v1_user_agent_image_iid_get_0(iid)
        print("The response of UserAgentImageApi->get_image_api_v1_user_agent_image_iid_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserAgentImageApi->get_image_api_v1_user_agent_image_iid_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **iid** | **int**|  | 

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

# **list_images_api_v1_user_agent_image_list_get**
> object list_images_api_v1_user_agent_image_list_get(page=page, limit=limit, image_type=image_type, agent_id=agent_id)

我的图片交互

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
    api_instance = zhs_api.UserAgentImageApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    image_type = 'image_type_example' # str |  (optional)
    agent_id = 'agent_id_example' # str |  (optional)

    try:
        # 我的图片交互
        api_response = api_instance.list_images_api_v1_user_agent_image_list_get(page=page, limit=limit, image_type=image_type, agent_id=agent_id)
        print("The response of UserAgentImageApi->list_images_api_v1_user_agent_image_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserAgentImageApi->list_images_api_v1_user_agent_image_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **image_type** | **str**|  | [optional] 
 **agent_id** | **str**|  | [optional] 

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

# **list_images_api_v1_user_agent_image_list_get_0**
> object list_images_api_v1_user_agent_image_list_get_0(page=page, limit=limit, image_type=image_type, agent_id=agent_id)

我的图片交互

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
    api_instance = zhs_api.UserAgentImageApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    image_type = 'image_type_example' # str |  (optional)
    agent_id = 'agent_id_example' # str |  (optional)

    try:
        # 我的图片交互
        api_response = api_instance.list_images_api_v1_user_agent_image_list_get_0(page=page, limit=limit, image_type=image_type, agent_id=agent_id)
        print("The response of UserAgentImageApi->list_images_api_v1_user_agent_image_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserAgentImageApi->list_images_api_v1_user_agent_image_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **image_type** | **str**|  | [optional] 
 **agent_id** | **str**|  | [optional] 

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

