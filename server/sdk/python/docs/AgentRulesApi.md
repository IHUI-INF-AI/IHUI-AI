# zhs_api.AgentRulesApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**accept_need_task_api_v1_agents_need_task_accept_post**](AgentRulesApi.md#accept_need_task_api_v1_agents_need_task_accept_post) | **POST** /api/v1/agents/need-task/accept | 接单需求任务
[**complete_need_task_api_v1_agents_need_task_complete_post**](AgentRulesApi.md#complete_need_task_api_v1_agents_need_task_complete_post) | **POST** /api/v1/agents/need-task/complete | 完成需求任务
[**create_need_task_api_v1_agents_need_task_create_post**](AgentRulesApi.md#create_need_task_api_v1_agents_need_task_create_post) | **POST** /api/v1/agents/need-task/create | 创建需求任务
[**list_need_tasks_api_v1_agents_need_task_list_get**](AgentRulesApi.md#list_need_tasks_api_v1_agents_need_task_list_get) | **GET** /api/v1/agents/need-task/list | 需求任务列表
[**toggle_rule_api_v1_agents_toggle_post**](AgentRulesApi.md#toggle_rule_api_v1_agents_toggle_post) | **POST** /api/v1/agents/toggle | 启用/禁用规则


# **accept_need_task_api_v1_agents_need_task_accept_post**
> object accept_need_task_api_v1_agents_need_task_accept_post(task_id)

接单需求任务

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
    api_instance = zhs_api.AgentRulesApi(api_client)
    task_id = 56 # int | 

    try:
        # 接单需求任务
        api_response = api_instance.accept_need_task_api_v1_agents_need_task_accept_post(task_id)
        print("The response of AgentRulesApi->accept_need_task_api_v1_agents_need_task_accept_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentRulesApi->accept_need_task_api_v1_agents_need_task_accept_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **task_id** | **int**|  | 

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

# **complete_need_task_api_v1_agents_need_task_complete_post**
> object complete_need_task_api_v1_agents_need_task_complete_post(task_id)

完成需求任务

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
    api_instance = zhs_api.AgentRulesApi(api_client)
    task_id = 56 # int | 

    try:
        # 完成需求任务
        api_response = api_instance.complete_need_task_api_v1_agents_need_task_complete_post(task_id)
        print("The response of AgentRulesApi->complete_need_task_api_v1_agents_need_task_complete_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentRulesApi->complete_need_task_api_v1_agents_need_task_complete_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **task_id** | **int**|  | 

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

# **create_need_task_api_v1_agents_need_task_create_post**
> object create_need_task_api_v1_agents_need_task_create_post(task_name, task_desc=task_desc, agent_id=agent_id, reward_tokens=reward_tokens, deadline=deadline)

创建需求任务

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
    api_instance = zhs_api.AgentRulesApi(api_client)
    task_name = 'task_name_example' # str | 
    task_desc = '' # str |  (optional) (default to '')
    agent_id = '' # str |  (optional) (default to '')
    reward_tokens = 0 # int |  (optional) (default to 0)
    deadline = 'deadline_example' # str | ISO 时间字符串 (optional)

    try:
        # 创建需求任务
        api_response = api_instance.create_need_task_api_v1_agents_need_task_create_post(task_name, task_desc=task_desc, agent_id=agent_id, reward_tokens=reward_tokens, deadline=deadline)
        print("The response of AgentRulesApi->create_need_task_api_v1_agents_need_task_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentRulesApi->create_need_task_api_v1_agents_need_task_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **task_name** | **str**|  | 
 **task_desc** | **str**|  | [optional] [default to &#39;&#39;]
 **agent_id** | **str**|  | [optional] [default to &#39;&#39;]
 **reward_tokens** | **int**|  | [optional] [default to 0]
 **deadline** | **str**| ISO 时间字符串 | [optional] 

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

# **list_need_tasks_api_v1_agents_need_task_list_get**
> object list_need_tasks_api_v1_agents_need_task_list_get(page=page, limit=limit, status=status)

需求任务列表

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
    api_instance = zhs_api.AgentRulesApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    status = 56 # int |  (optional)

    try:
        # 需求任务列表
        api_response = api_instance.list_need_tasks_api_v1_agents_need_task_list_get(page=page, limit=limit, status=status)
        print("The response of AgentRulesApi->list_need_tasks_api_v1_agents_need_task_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentRulesApi->list_need_tasks_api_v1_agents_need_task_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **status** | **int**|  | [optional] 

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

# **toggle_rule_api_v1_agents_toggle_post**
> object toggle_rule_api_v1_agents_toggle_post(rule_id, status)

启用/禁用规则

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
    api_instance = zhs_api.AgentRulesApi(api_client)
    rule_id = 56 # int | 
    status = 56 # int | 0 禁用 1 启用

    try:
        # 启用/禁用规则
        api_response = api_instance.toggle_rule_api_v1_agents_toggle_post(rule_id, status)
        print("The response of AgentRulesApi->toggle_rule_api_v1_agents_toggle_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentRulesApi->toggle_rule_api_v1_agents_toggle_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **rule_id** | **int**|  | 
 **status** | **int**| 0 禁用 1 启用 | 

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

