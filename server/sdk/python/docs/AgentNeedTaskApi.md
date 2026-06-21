# zhs_api.AgentNeedTaskApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**accept_task_api_v1_agent_need_task_tid_accept_post**](AgentNeedTaskApi.md#accept_task_api_v1_agent_need_task_tid_accept_post) | **POST** /api/v1/agent-need-task/{tid}/accept | 开发者认领
[**accept_task_api_v1_agent_need_task_tid_accept_post_0**](AgentNeedTaskApi.md#accept_task_api_v1_agent_need_task_tid_accept_post_0) | **POST** /api/v1/agent-need-task/{tid}/accept | 开发者认领
[**bid_task_api_v1_agent_need_task_tid_bid_post**](AgentNeedTaskApi.md#bid_task_api_v1_agent_need_task_tid_bid_post) | **POST** /api/v1/agent-need-task/{tid}/bid | 开发者报价
[**bid_task_api_v1_agent_need_task_tid_bid_post_0**](AgentNeedTaskApi.md#bid_task_api_v1_agent_need_task_tid_bid_post_0) | **POST** /api/v1/agent-need-task/{tid}/bid | 开发者报价
[**create_task_api_v1_agent_need_task_post**](AgentNeedTaskApi.md#create_task_api_v1_agent_need_task_post) | **POST** /api/v1/agent-need-task | 发布需求
[**create_task_api_v1_agent_need_task_post_0**](AgentNeedTaskApi.md#create_task_api_v1_agent_need_task_post_0) | **POST** /api/v1/agent-need-task | 发布需求
[**delete_task_api_v1_agent_need_task_tid_delete**](AgentNeedTaskApi.md#delete_task_api_v1_agent_need_task_tid_delete) | **DELETE** /api/v1/agent-need-task/{tid} | 删除需求
[**delete_task_api_v1_agent_need_task_tid_delete_0**](AgentNeedTaskApi.md#delete_task_api_v1_agent_need_task_tid_delete_0) | **DELETE** /api/v1/agent-need-task/{tid} | 删除需求
[**get_task_api_v1_agent_need_task_tid_get**](AgentNeedTaskApi.md#get_task_api_v1_agent_need_task_tid_get) | **GET** /api/v1/agent-need-task/{tid} | 需求详情
[**get_task_api_v1_agent_need_task_tid_get_0**](AgentNeedTaskApi.md#get_task_api_v1_agent_need_task_tid_get_0) | **GET** /api/v1/agent-need-task/{tid} | 需求详情
[**list_bids_api_v1_agent_need_task_tid_bids_get**](AgentNeedTaskApi.md#list_bids_api_v1_agent_need_task_tid_bids_get) | **GET** /api/v1/agent-need-task/{tid}/bids | 任务报价列表
[**list_bids_api_v1_agent_need_task_tid_bids_get_0**](AgentNeedTaskApi.md#list_bids_api_v1_agent_need_task_tid_bids_get_0) | **GET** /api/v1/agent-need-task/{tid}/bids | 任务报价列表
[**list_tasks_api_v1_agent_need_task_list_get**](AgentNeedTaskApi.md#list_tasks_api_v1_agent_need_task_list_get) | **GET** /api/v1/agent-need-task/list | 需求列表
[**list_tasks_api_v1_agent_need_task_list_get_0**](AgentNeedTaskApi.md#list_tasks_api_v1_agent_need_task_list_get_0) | **GET** /api/v1/agent-need-task/list | 需求列表
[**update_task_api_v1_agent_need_task_tid_put**](AgentNeedTaskApi.md#update_task_api_v1_agent_need_task_tid_put) | **PUT** /api/v1/agent-need-task/{tid} | 修改需求
[**update_task_api_v1_agent_need_task_tid_put_0**](AgentNeedTaskApi.md#update_task_api_v1_agent_need_task_tid_put_0) | **PUT** /api/v1/agent-need-task/{tid} | 修改需求


# **accept_task_api_v1_agent_need_task_tid_accept_post**
> object accept_task_api_v1_agent_need_task_tid_accept_post(tid)

开发者认领

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
    api_instance = zhs_api.AgentNeedTaskApi(api_client)
    tid = 56 # int | 

    try:
        # 开发者认领
        api_response = api_instance.accept_task_api_v1_agent_need_task_tid_accept_post(tid)
        print("The response of AgentNeedTaskApi->accept_task_api_v1_agent_need_task_tid_accept_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentNeedTaskApi->accept_task_api_v1_agent_need_task_tid_accept_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tid** | **int**|  | 

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

# **accept_task_api_v1_agent_need_task_tid_accept_post_0**
> object accept_task_api_v1_agent_need_task_tid_accept_post_0(tid)

开发者认领

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
    api_instance = zhs_api.AgentNeedTaskApi(api_client)
    tid = 56 # int | 

    try:
        # 开发者认领
        api_response = api_instance.accept_task_api_v1_agent_need_task_tid_accept_post_0(tid)
        print("The response of AgentNeedTaskApi->accept_task_api_v1_agent_need_task_tid_accept_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentNeedTaskApi->accept_task_api_v1_agent_need_task_tid_accept_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tid** | **int**|  | 

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

# **bid_task_api_v1_agent_need_task_tid_bid_post**
> object bid_task_api_v1_agent_need_task_tid_bid_post(tid, bid, remark=remark)

开发者报价

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
    api_instance = zhs_api.AgentNeedTaskApi(api_client)
    tid = 56 # int | 
    bid = 56 # int | 
    remark = 'remark_example' # str |  (optional)

    try:
        # 开发者报价
        api_response = api_instance.bid_task_api_v1_agent_need_task_tid_bid_post(tid, bid, remark=remark)
        print("The response of AgentNeedTaskApi->bid_task_api_v1_agent_need_task_tid_bid_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentNeedTaskApi->bid_task_api_v1_agent_need_task_tid_bid_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tid** | **int**|  | 
 **bid** | **int**|  | 
 **remark** | **str**|  | [optional] 

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

# **bid_task_api_v1_agent_need_task_tid_bid_post_0**
> object bid_task_api_v1_agent_need_task_tid_bid_post_0(tid, bid, remark=remark)

开发者报价

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
    api_instance = zhs_api.AgentNeedTaskApi(api_client)
    tid = 56 # int | 
    bid = 56 # int | 
    remark = 'remark_example' # str |  (optional)

    try:
        # 开发者报价
        api_response = api_instance.bid_task_api_v1_agent_need_task_tid_bid_post_0(tid, bid, remark=remark)
        print("The response of AgentNeedTaskApi->bid_task_api_v1_agent_need_task_tid_bid_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentNeedTaskApi->bid_task_api_v1_agent_need_task_tid_bid_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tid** | **int**|  | 
 **bid** | **int**|  | 
 **remark** | **str**|  | [optional] 

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

# **create_task_api_v1_agent_need_task_post**
> object create_task_api_v1_agent_need_task_post(title, description, type=type, agent_id=agent_id, agent_name=agent_name, priority=priority, budget=budget, deadline=deadline)

发布需求

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
    api_instance = zhs_api.AgentNeedTaskApi(api_client)
    title = 'title_example' # str | 
    description = 'description_example' # str | 
    type = 'develop' # str |  (optional) (default to 'develop')
    agent_id = 'agent_id_example' # str |  (optional)
    agent_name = 'agent_name_example' # str |  (optional)
    priority = 1 # int |  (optional) (default to 1)
    budget = 0 # int |  (optional) (default to 0)
    deadline = '2013-10-20T19:20:30+01:00' # datetime |  (optional)

    try:
        # 发布需求
        api_response = api_instance.create_task_api_v1_agent_need_task_post(title, description, type=type, agent_id=agent_id, agent_name=agent_name, priority=priority, budget=budget, deadline=deadline)
        print("The response of AgentNeedTaskApi->create_task_api_v1_agent_need_task_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentNeedTaskApi->create_task_api_v1_agent_need_task_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**|  | 
 **description** | **str**|  | 
 **type** | **str**|  | [optional] [default to &#39;develop&#39;]
 **agent_id** | **str**|  | [optional] 
 **agent_name** | **str**|  | [optional] 
 **priority** | **int**|  | [optional] [default to 1]
 **budget** | **int**|  | [optional] [default to 0]
 **deadline** | **datetime**|  | [optional] 

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

# **create_task_api_v1_agent_need_task_post_0**
> object create_task_api_v1_agent_need_task_post_0(title, description, type=type, agent_id=agent_id, agent_name=agent_name, priority=priority, budget=budget, deadline=deadline)

发布需求

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
    api_instance = zhs_api.AgentNeedTaskApi(api_client)
    title = 'title_example' # str | 
    description = 'description_example' # str | 
    type = 'develop' # str |  (optional) (default to 'develop')
    agent_id = 'agent_id_example' # str |  (optional)
    agent_name = 'agent_name_example' # str |  (optional)
    priority = 1 # int |  (optional) (default to 1)
    budget = 0 # int |  (optional) (default to 0)
    deadline = '2013-10-20T19:20:30+01:00' # datetime |  (optional)

    try:
        # 发布需求
        api_response = api_instance.create_task_api_v1_agent_need_task_post_0(title, description, type=type, agent_id=agent_id, agent_name=agent_name, priority=priority, budget=budget, deadline=deadline)
        print("The response of AgentNeedTaskApi->create_task_api_v1_agent_need_task_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentNeedTaskApi->create_task_api_v1_agent_need_task_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**|  | 
 **description** | **str**|  | 
 **type** | **str**|  | [optional] [default to &#39;develop&#39;]
 **agent_id** | **str**|  | [optional] 
 **agent_name** | **str**|  | [optional] 
 **priority** | **int**|  | [optional] [default to 1]
 **budget** | **int**|  | [optional] [default to 0]
 **deadline** | **datetime**|  | [optional] 

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

# **delete_task_api_v1_agent_need_task_tid_delete**
> object delete_task_api_v1_agent_need_task_tid_delete(tid)

删除需求

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
    api_instance = zhs_api.AgentNeedTaskApi(api_client)
    tid = 56 # int | 

    try:
        # 删除需求
        api_response = api_instance.delete_task_api_v1_agent_need_task_tid_delete(tid)
        print("The response of AgentNeedTaskApi->delete_task_api_v1_agent_need_task_tid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentNeedTaskApi->delete_task_api_v1_agent_need_task_tid_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tid** | **int**|  | 

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

# **delete_task_api_v1_agent_need_task_tid_delete_0**
> object delete_task_api_v1_agent_need_task_tid_delete_0(tid)

删除需求

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
    api_instance = zhs_api.AgentNeedTaskApi(api_client)
    tid = 56 # int | 

    try:
        # 删除需求
        api_response = api_instance.delete_task_api_v1_agent_need_task_tid_delete_0(tid)
        print("The response of AgentNeedTaskApi->delete_task_api_v1_agent_need_task_tid_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentNeedTaskApi->delete_task_api_v1_agent_need_task_tid_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tid** | **int**|  | 

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

# **get_task_api_v1_agent_need_task_tid_get**
> object get_task_api_v1_agent_need_task_tid_get(tid)

需求详情

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
    api_instance = zhs_api.AgentNeedTaskApi(api_client)
    tid = 56 # int | 

    try:
        # 需求详情
        api_response = api_instance.get_task_api_v1_agent_need_task_tid_get(tid)
        print("The response of AgentNeedTaskApi->get_task_api_v1_agent_need_task_tid_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentNeedTaskApi->get_task_api_v1_agent_need_task_tid_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tid** | **int**|  | 

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

# **get_task_api_v1_agent_need_task_tid_get_0**
> object get_task_api_v1_agent_need_task_tid_get_0(tid)

需求详情

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
    api_instance = zhs_api.AgentNeedTaskApi(api_client)
    tid = 56 # int | 

    try:
        # 需求详情
        api_response = api_instance.get_task_api_v1_agent_need_task_tid_get_0(tid)
        print("The response of AgentNeedTaskApi->get_task_api_v1_agent_need_task_tid_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentNeedTaskApi->get_task_api_v1_agent_need_task_tid_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tid** | **int**|  | 

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

# **list_bids_api_v1_agent_need_task_tid_bids_get**
> object list_bids_api_v1_agent_need_task_tid_bids_get(tid)

任务报价列表

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
    api_instance = zhs_api.AgentNeedTaskApi(api_client)
    tid = 56 # int | 

    try:
        # 任务报价列表
        api_response = api_instance.list_bids_api_v1_agent_need_task_tid_bids_get(tid)
        print("The response of AgentNeedTaskApi->list_bids_api_v1_agent_need_task_tid_bids_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentNeedTaskApi->list_bids_api_v1_agent_need_task_tid_bids_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tid** | **int**|  | 

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

# **list_bids_api_v1_agent_need_task_tid_bids_get_0**
> object list_bids_api_v1_agent_need_task_tid_bids_get_0(tid)

任务报价列表

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
    api_instance = zhs_api.AgentNeedTaskApi(api_client)
    tid = 56 # int | 

    try:
        # 任务报价列表
        api_response = api_instance.list_bids_api_v1_agent_need_task_tid_bids_get_0(tid)
        print("The response of AgentNeedTaskApi->list_bids_api_v1_agent_need_task_tid_bids_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentNeedTaskApi->list_bids_api_v1_agent_need_task_tid_bids_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tid** | **int**|  | 

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

# **list_tasks_api_v1_agent_need_task_list_get**
> object list_tasks_api_v1_agent_need_task_list_get(page=page, limit=limit, status=status, type=type, user_id=user_id, developer_id=developer_id, keyword=keyword)

需求列表

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
    api_instance = zhs_api.AgentNeedTaskApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    status = 56 # int |  (optional)
    type = 'type_example' # str |  (optional)
    user_id = 'user_id_example' # str |  (optional)
    developer_id = 'developer_id_example' # str |  (optional)
    keyword = 'keyword_example' # str |  (optional)

    try:
        # 需求列表
        api_response = api_instance.list_tasks_api_v1_agent_need_task_list_get(page=page, limit=limit, status=status, type=type, user_id=user_id, developer_id=developer_id, keyword=keyword)
        print("The response of AgentNeedTaskApi->list_tasks_api_v1_agent_need_task_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentNeedTaskApi->list_tasks_api_v1_agent_need_task_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **status** | **int**|  | [optional] 
 **type** | **str**|  | [optional] 
 **user_id** | **str**|  | [optional] 
 **developer_id** | **str**|  | [optional] 
 **keyword** | **str**|  | [optional] 

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

# **list_tasks_api_v1_agent_need_task_list_get_0**
> object list_tasks_api_v1_agent_need_task_list_get_0(page=page, limit=limit, status=status, type=type, user_id=user_id, developer_id=developer_id, keyword=keyword)

需求列表

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
    api_instance = zhs_api.AgentNeedTaskApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    status = 56 # int |  (optional)
    type = 'type_example' # str |  (optional)
    user_id = 'user_id_example' # str |  (optional)
    developer_id = 'developer_id_example' # str |  (optional)
    keyword = 'keyword_example' # str |  (optional)

    try:
        # 需求列表
        api_response = api_instance.list_tasks_api_v1_agent_need_task_list_get_0(page=page, limit=limit, status=status, type=type, user_id=user_id, developer_id=developer_id, keyword=keyword)
        print("The response of AgentNeedTaskApi->list_tasks_api_v1_agent_need_task_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentNeedTaskApi->list_tasks_api_v1_agent_need_task_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **status** | **int**|  | [optional] 
 **type** | **str**|  | [optional] 
 **user_id** | **str**|  | [optional] 
 **developer_id** | **str**|  | [optional] 
 **keyword** | **str**|  | [optional] 

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

# **update_task_api_v1_agent_need_task_tid_put**
> object update_task_api_v1_agent_need_task_tid_put(tid, title=title, description=description, priority=priority, budget=budget, status=status, deliverable=deliverable, remark=remark)

修改需求

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
    api_instance = zhs_api.AgentNeedTaskApi(api_client)
    tid = 56 # int | 
    title = 'title_example' # str |  (optional)
    description = 'description_example' # str |  (optional)
    priority = 56 # int |  (optional)
    budget = 56 # int |  (optional)
    status = 56 # int |  (optional)
    deliverable = 'deliverable_example' # str |  (optional)
    remark = 'remark_example' # str |  (optional)

    try:
        # 修改需求
        api_response = api_instance.update_task_api_v1_agent_need_task_tid_put(tid, title=title, description=description, priority=priority, budget=budget, status=status, deliverable=deliverable, remark=remark)
        print("The response of AgentNeedTaskApi->update_task_api_v1_agent_need_task_tid_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentNeedTaskApi->update_task_api_v1_agent_need_task_tid_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tid** | **int**|  | 
 **title** | **str**|  | [optional] 
 **description** | **str**|  | [optional] 
 **priority** | **int**|  | [optional] 
 **budget** | **int**|  | [optional] 
 **status** | **int**|  | [optional] 
 **deliverable** | **str**|  | [optional] 
 **remark** | **str**|  | [optional] 

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

# **update_task_api_v1_agent_need_task_tid_put_0**
> object update_task_api_v1_agent_need_task_tid_put_0(tid, title=title, description=description, priority=priority, budget=budget, status=status, deliverable=deliverable, remark=remark)

修改需求

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
    api_instance = zhs_api.AgentNeedTaskApi(api_client)
    tid = 56 # int | 
    title = 'title_example' # str |  (optional)
    description = 'description_example' # str |  (optional)
    priority = 56 # int |  (optional)
    budget = 56 # int |  (optional)
    status = 56 # int |  (optional)
    deliverable = 'deliverable_example' # str |  (optional)
    remark = 'remark_example' # str |  (optional)

    try:
        # 修改需求
        api_response = api_instance.update_task_api_v1_agent_need_task_tid_put_0(tid, title=title, description=description, priority=priority, budget=budget, status=status, deliverable=deliverable, remark=remark)
        print("The response of AgentNeedTaskApi->update_task_api_v1_agent_need_task_tid_put_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentNeedTaskApi->update_task_api_v1_agent_need_task_tid_put_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tid** | **int**|  | 
 **title** | **str**|  | [optional] 
 **description** | **str**|  | [optional] 
 **priority** | **int**|  | [optional] 
 **budget** | **int**|  | [optional] 
 **status** | **int**|  | [optional] 
 **deliverable** | **str**|  | [optional] 
 **remark** | **str**|  | [optional] 

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

