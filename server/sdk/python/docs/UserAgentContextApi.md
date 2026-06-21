# zhs_api.UserAgentContextApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**add_context_api_v1_user_agent_context_post**](UserAgentContextApi.md#add_context_api_v1_user_agent_context_post) | **POST** /api/v1/user-agent-context | 添加上下文消息
[**add_context_api_v1_user_agent_context_post_0**](UserAgentContextApi.md#add_context_api_v1_user_agent_context_post_0) | **POST** /api/v1/user-agent-context | 添加上下文消息
[**clear_context_api_v1_user_agent_context_delete**](UserAgentContextApi.md#clear_context_api_v1_user_agent_context_delete) | **DELETE** /api/v1/user-agent-context | 清空上下文
[**clear_context_api_v1_user_agent_context_delete_0**](UserAgentContextApi.md#clear_context_api_v1_user_agent_context_delete_0) | **DELETE** /api/v1/user-agent-context | 清空上下文
[**list_context_api_v1_user_agent_context_list_get**](UserAgentContextApi.md#list_context_api_v1_user_agent_context_list_get) | **GET** /api/v1/user-agent-context/list | 获取上下文
[**list_context_api_v1_user_agent_context_list_get_0**](UserAgentContextApi.md#list_context_api_v1_user_agent_context_list_get_0) | **GET** /api/v1/user-agent-context/list | 获取上下文
[**list_summaries_api_v1_user_agent_context_summary_list_get**](UserAgentContextApi.md#list_summaries_api_v1_user_agent_context_summary_list_get) | **GET** /api/v1/user-agent-context/summary/list | 总结列表
[**list_summaries_api_v1_user_agent_context_summary_list_get_0**](UserAgentContextApi.md#list_summaries_api_v1_user_agent_context_summary_list_get_0) | **GET** /api/v1/user-agent-context/summary/list | 总结列表
[**summarize_context_api_v1_user_agent_context_summary_post**](UserAgentContextApi.md#summarize_context_api_v1_user_agent_context_summary_post) | **POST** /api/v1/user-agent-context/summary | 总结上下文
[**summarize_context_api_v1_user_agent_context_summary_post_0**](UserAgentContextApi.md#summarize_context_api_v1_user_agent_context_summary_post_0) | **POST** /api/v1/user-agent-context/summary | 总结上下文


# **add_context_api_v1_user_agent_context_post**
> object add_context_api_v1_user_agent_context_post(agent_id, session_id, role, content, content_type=content_type, tokens=tokens, model=model)

添加上下文消息

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
    api_instance = zhs_api.UserAgentContextApi(api_client)
    agent_id = 'agent_id_example' # str | 
    session_id = 'session_id_example' # str | 
    role = 'role_example' # str | 
    content = 'content_example' # str | 
    content_type = 'text' # str |  (optional) (default to 'text')
    tokens = 0 # int |  (optional) (default to 0)
    model = 'model_example' # str |  (optional)

    try:
        # 添加上下文消息
        api_response = api_instance.add_context_api_v1_user_agent_context_post(agent_id, session_id, role, content, content_type=content_type, tokens=tokens, model=model)
        print("The response of UserAgentContextApi->add_context_api_v1_user_agent_context_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserAgentContextApi->add_context_api_v1_user_agent_context_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 
 **session_id** | **str**|  | 
 **role** | **str**|  | 
 **content** | **str**|  | 
 **content_type** | **str**|  | [optional] [default to &#39;text&#39;]
 **tokens** | **int**|  | [optional] [default to 0]
 **model** | **str**|  | [optional] 

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

# **add_context_api_v1_user_agent_context_post_0**
> object add_context_api_v1_user_agent_context_post_0(agent_id, session_id, role, content, content_type=content_type, tokens=tokens, model=model)

添加上下文消息

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
    api_instance = zhs_api.UserAgentContextApi(api_client)
    agent_id = 'agent_id_example' # str | 
    session_id = 'session_id_example' # str | 
    role = 'role_example' # str | 
    content = 'content_example' # str | 
    content_type = 'text' # str |  (optional) (default to 'text')
    tokens = 0 # int |  (optional) (default to 0)
    model = 'model_example' # str |  (optional)

    try:
        # 添加上下文消息
        api_response = api_instance.add_context_api_v1_user_agent_context_post_0(agent_id, session_id, role, content, content_type=content_type, tokens=tokens, model=model)
        print("The response of UserAgentContextApi->add_context_api_v1_user_agent_context_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserAgentContextApi->add_context_api_v1_user_agent_context_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 
 **session_id** | **str**|  | 
 **role** | **str**|  | 
 **content** | **str**|  | 
 **content_type** | **str**|  | [optional] [default to &#39;text&#39;]
 **tokens** | **int**|  | [optional] [default to 0]
 **model** | **str**|  | [optional] 

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

# **clear_context_api_v1_user_agent_context_delete**
> object clear_context_api_v1_user_agent_context_delete(agent_id, session_id=session_id)

清空上下文

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
    api_instance = zhs_api.UserAgentContextApi(api_client)
    agent_id = 'agent_id_example' # str | 
    session_id = 'session_id_example' # str |  (optional)

    try:
        # 清空上下文
        api_response = api_instance.clear_context_api_v1_user_agent_context_delete(agent_id, session_id=session_id)
        print("The response of UserAgentContextApi->clear_context_api_v1_user_agent_context_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserAgentContextApi->clear_context_api_v1_user_agent_context_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 
 **session_id** | **str**|  | [optional] 

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

# **clear_context_api_v1_user_agent_context_delete_0**
> object clear_context_api_v1_user_agent_context_delete_0(agent_id, session_id=session_id)

清空上下文

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
    api_instance = zhs_api.UserAgentContextApi(api_client)
    agent_id = 'agent_id_example' # str | 
    session_id = 'session_id_example' # str |  (optional)

    try:
        # 清空上下文
        api_response = api_instance.clear_context_api_v1_user_agent_context_delete_0(agent_id, session_id=session_id)
        print("The response of UserAgentContextApi->clear_context_api_v1_user_agent_context_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserAgentContextApi->clear_context_api_v1_user_agent_context_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 
 **session_id** | **str**|  | [optional] 

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

# **list_context_api_v1_user_agent_context_list_get**
> object list_context_api_v1_user_agent_context_list_get(agent_id, session_id=session_id, limit=limit)

获取上下文

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
    api_instance = zhs_api.UserAgentContextApi(api_client)
    agent_id = 'agent_id_example' # str | 
    session_id = 'session_id_example' # str |  (optional)
    limit = 50 # int |  (optional) (default to 50)

    try:
        # 获取上下文
        api_response = api_instance.list_context_api_v1_user_agent_context_list_get(agent_id, session_id=session_id, limit=limit)
        print("The response of UserAgentContextApi->list_context_api_v1_user_agent_context_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserAgentContextApi->list_context_api_v1_user_agent_context_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 
 **session_id** | **str**|  | [optional] 
 **limit** | **int**|  | [optional] [default to 50]

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

# **list_context_api_v1_user_agent_context_list_get_0**
> object list_context_api_v1_user_agent_context_list_get_0(agent_id, session_id=session_id, limit=limit)

获取上下文

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
    api_instance = zhs_api.UserAgentContextApi(api_client)
    agent_id = 'agent_id_example' # str | 
    session_id = 'session_id_example' # str |  (optional)
    limit = 50 # int |  (optional) (default to 50)

    try:
        # 获取上下文
        api_response = api_instance.list_context_api_v1_user_agent_context_list_get_0(agent_id, session_id=session_id, limit=limit)
        print("The response of UserAgentContextApi->list_context_api_v1_user_agent_context_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserAgentContextApi->list_context_api_v1_user_agent_context_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 
 **session_id** | **str**|  | [optional] 
 **limit** | **int**|  | [optional] [default to 50]

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

# **list_summaries_api_v1_user_agent_context_summary_list_get**
> object list_summaries_api_v1_user_agent_context_summary_list_get(agent_id, limit=limit)

总结列表

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
    api_instance = zhs_api.UserAgentContextApi(api_client)
    agent_id = 'agent_id_example' # str | 
    limit = 10 # int |  (optional) (default to 10)

    try:
        # 总结列表
        api_response = api_instance.list_summaries_api_v1_user_agent_context_summary_list_get(agent_id, limit=limit)
        print("The response of UserAgentContextApi->list_summaries_api_v1_user_agent_context_summary_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserAgentContextApi->list_summaries_api_v1_user_agent_context_summary_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 
 **limit** | **int**|  | [optional] [default to 10]

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

# **list_summaries_api_v1_user_agent_context_summary_list_get_0**
> object list_summaries_api_v1_user_agent_context_summary_list_get_0(agent_id, limit=limit)

总结列表

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
    api_instance = zhs_api.UserAgentContextApi(api_client)
    agent_id = 'agent_id_example' # str | 
    limit = 10 # int |  (optional) (default to 10)

    try:
        # 总结列表
        api_response = api_instance.list_summaries_api_v1_user_agent_context_summary_list_get_0(agent_id, limit=limit)
        print("The response of UserAgentContextApi->list_summaries_api_v1_user_agent_context_summary_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserAgentContextApi->list_summaries_api_v1_user_agent_context_summary_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 
 **limit** | **int**|  | [optional] [default to 10]

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

# **summarize_context_api_v1_user_agent_context_summary_post**
> object summarize_context_api_v1_user_agent_context_summary_post(agent_id, summary, session_id=session_id, start_id=start_id, end_id=end_id, tokens=tokens)

总结上下文

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
    api_instance = zhs_api.UserAgentContextApi(api_client)
    agent_id = 'agent_id_example' # str | 
    summary = 'summary_example' # str | 
    session_id = 'session_id_example' # str |  (optional)
    start_id = 0 # int |  (optional) (default to 0)
    end_id = 0 # int |  (optional) (default to 0)
    tokens = 0 # int |  (optional) (default to 0)

    try:
        # 总结上下文
        api_response = api_instance.summarize_context_api_v1_user_agent_context_summary_post(agent_id, summary, session_id=session_id, start_id=start_id, end_id=end_id, tokens=tokens)
        print("The response of UserAgentContextApi->summarize_context_api_v1_user_agent_context_summary_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserAgentContextApi->summarize_context_api_v1_user_agent_context_summary_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 
 **summary** | **str**|  | 
 **session_id** | **str**|  | [optional] 
 **start_id** | **int**|  | [optional] [default to 0]
 **end_id** | **int**|  | [optional] [default to 0]
 **tokens** | **int**|  | [optional] [default to 0]

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

# **summarize_context_api_v1_user_agent_context_summary_post_0**
> object summarize_context_api_v1_user_agent_context_summary_post_0(agent_id, summary, session_id=session_id, start_id=start_id, end_id=end_id, tokens=tokens)

总结上下文

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
    api_instance = zhs_api.UserAgentContextApi(api_client)
    agent_id = 'agent_id_example' # str | 
    summary = 'summary_example' # str | 
    session_id = 'session_id_example' # str |  (optional)
    start_id = 0 # int |  (optional) (default to 0)
    end_id = 0 # int |  (optional) (default to 0)
    tokens = 0 # int |  (optional) (default to 0)

    try:
        # 总结上下文
        api_response = api_instance.summarize_context_api_v1_user_agent_context_summary_post_0(agent_id, summary, session_id=session_id, start_id=start_id, end_id=end_id, tokens=tokens)
        print("The response of UserAgentContextApi->summarize_context_api_v1_user_agent_context_summary_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserAgentContextApi->summarize_context_api_v1_user_agent_context_summary_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 
 **summary** | **str**|  | 
 **session_id** | **str**|  | [optional] 
 **start_id** | **int**|  | [optional] [default to 0]
 **end_id** | **int**|  | [optional] [default to 0]
 **tokens** | **int**|  | [optional] [default to 0]

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

