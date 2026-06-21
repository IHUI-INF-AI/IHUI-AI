# zhs_api.AgentUseDetailApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**agent_usedetail_daily_stats**](AgentUseDetailApi.md#agent_usedetail_daily_stats) | **GET** /api/v1/agent-usedetail/stats/daily | 日统计
[**agent_usedetail_daily_stats_0**](AgentUseDetailApi.md#agent_usedetail_daily_stats_0) | **GET** /api/v1/agent-usedetail/stats/daily | 日统计
[**list_details_api_v1_agent_usedetail_list_get**](AgentUseDetailApi.md#list_details_api_v1_agent_usedetail_list_get) | **GET** /api/v1/agent-usedetail/list | 使用明细
[**list_details_api_v1_agent_usedetail_list_get_0**](AgentUseDetailApi.md#list_details_api_v1_agent_usedetail_list_get_0) | **GET** /api/v1/agent-usedetail/list | 使用明细
[**record_usage_api_v1_agent_usedetail_record_post**](AgentUseDetailApi.md#record_usage_api_v1_agent_usedetail_record_post) | **POST** /api/v1/agent-usedetail/record | 记录使用
[**record_usage_api_v1_agent_usedetail_record_post_0**](AgentUseDetailApi.md#record_usage_api_v1_agent_usedetail_record_post_0) | **POST** /api/v1/agent-usedetail/record | 记录使用
[**summary_stats_api_v1_agent_usedetail_stats_summary_get**](AgentUseDetailApi.md#summary_stats_api_v1_agent_usedetail_stats_summary_get) | **GET** /api/v1/agent-usedetail/stats/summary | 汇总统计
[**summary_stats_api_v1_agent_usedetail_stats_summary_get_0**](AgentUseDetailApi.md#summary_stats_api_v1_agent_usedetail_stats_summary_get_0) | **GET** /api/v1/agent-usedetail/stats/summary | 汇总统计


# **agent_usedetail_daily_stats**
> object agent_usedetail_daily_stats(agent_id=agent_id, start_date=start_date, end_date=end_date)

日统计

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
    api_instance = zhs_api.AgentUseDetailApi(api_client)
    agent_id = 'agent_id_example' # str |  (optional)
    start_date = 'start_date_example' # str |  (optional)
    end_date = 'end_date_example' # str |  (optional)

    try:
        # 日统计
        api_response = api_instance.agent_usedetail_daily_stats(agent_id=agent_id, start_date=start_date, end_date=end_date)
        print("The response of AgentUseDetailApi->agent_usedetail_daily_stats:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentUseDetailApi->agent_usedetail_daily_stats: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | [optional] 
 **start_date** | **str**|  | [optional] 
 **end_date** | **str**|  | [optional] 

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

# **agent_usedetail_daily_stats_0**
> object agent_usedetail_daily_stats_0(agent_id=agent_id, start_date=start_date, end_date=end_date)

日统计

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
    api_instance = zhs_api.AgentUseDetailApi(api_client)
    agent_id = 'agent_id_example' # str |  (optional)
    start_date = 'start_date_example' # str |  (optional)
    end_date = 'end_date_example' # str |  (optional)

    try:
        # 日统计
        api_response = api_instance.agent_usedetail_daily_stats_0(agent_id=agent_id, start_date=start_date, end_date=end_date)
        print("The response of AgentUseDetailApi->agent_usedetail_daily_stats_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentUseDetailApi->agent_usedetail_daily_stats_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | [optional] 
 **start_date** | **str**|  | [optional] 
 **end_date** | **str**|  | [optional] 

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

# **list_details_api_v1_agent_usedetail_list_get**
> object list_details_api_v1_agent_usedetail_list_get(page=page, limit=limit, agent_id=agent_id, user_id=user_id, type=type, start_date=start_date, end_date=end_date)

使用明细

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
    api_instance = zhs_api.AgentUseDetailApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    agent_id = 'agent_id_example' # str |  (optional)
    user_id = 'user_id_example' # str |  (optional)
    type = 'type_example' # str |  (optional)
    start_date = 'start_date_example' # str |  (optional)
    end_date = 'end_date_example' # str |  (optional)

    try:
        # 使用明细
        api_response = api_instance.list_details_api_v1_agent_usedetail_list_get(page=page, limit=limit, agent_id=agent_id, user_id=user_id, type=type, start_date=start_date, end_date=end_date)
        print("The response of AgentUseDetailApi->list_details_api_v1_agent_usedetail_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentUseDetailApi->list_details_api_v1_agent_usedetail_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **agent_id** | **str**|  | [optional] 
 **user_id** | **str**|  | [optional] 
 **type** | **str**|  | [optional] 
 **start_date** | **str**|  | [optional] 
 **end_date** | **str**|  | [optional] 

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

# **list_details_api_v1_agent_usedetail_list_get_0**
> object list_details_api_v1_agent_usedetail_list_get_0(page=page, limit=limit, agent_id=agent_id, user_id=user_id, type=type, start_date=start_date, end_date=end_date)

使用明细

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
    api_instance = zhs_api.AgentUseDetailApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    agent_id = 'agent_id_example' # str |  (optional)
    user_id = 'user_id_example' # str |  (optional)
    type = 'type_example' # str |  (optional)
    start_date = 'start_date_example' # str |  (optional)
    end_date = 'end_date_example' # str |  (optional)

    try:
        # 使用明细
        api_response = api_instance.list_details_api_v1_agent_usedetail_list_get_0(page=page, limit=limit, agent_id=agent_id, user_id=user_id, type=type, start_date=start_date, end_date=end_date)
        print("The response of AgentUseDetailApi->list_details_api_v1_agent_usedetail_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentUseDetailApi->list_details_api_v1_agent_usedetail_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **agent_id** | **str**|  | [optional] 
 **user_id** | **str**|  | [optional] 
 **type** | **str**|  | [optional] 
 **start_date** | **str**|  | [optional] 
 **end_date** | **str**|  | [optional] 

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

# **record_usage_api_v1_agent_usedetail_record_post**
> object record_usage_api_v1_agent_usedetail_record_post(agent_id, user_id, type=type, model=model, tokens=tokens, amount=amount, cost=cost, request_id=request_id, status=status, remark=remark)

记录使用

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
    api_instance = zhs_api.AgentUseDetailApi(api_client)
    agent_id = 'agent_id_example' # str | 
    user_id = 'user_id_example' # str | 
    type = 'consume' # str |  (optional) (default to 'consume')
    model = 'model_example' # str |  (optional)
    tokens = 0 # int |  (optional) (default to 0)
    amount = 0 # float |  (optional) (default to 0)
    cost = 0 # float |  (optional) (default to 0)
    request_id = 'request_id_example' # str |  (optional)
    status = 1 # int |  (optional) (default to 1)
    remark = 'remark_example' # str |  (optional)

    try:
        # 记录使用
        api_response = api_instance.record_usage_api_v1_agent_usedetail_record_post(agent_id, user_id, type=type, model=model, tokens=tokens, amount=amount, cost=cost, request_id=request_id, status=status, remark=remark)
        print("The response of AgentUseDetailApi->record_usage_api_v1_agent_usedetail_record_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentUseDetailApi->record_usage_api_v1_agent_usedetail_record_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 
 **user_id** | **str**|  | 
 **type** | **str**|  | [optional] [default to &#39;consume&#39;]
 **model** | **str**|  | [optional] 
 **tokens** | **int**|  | [optional] [default to 0]
 **amount** | **float**|  | [optional] [default to 0]
 **cost** | **float**|  | [optional] [default to 0]
 **request_id** | **str**|  | [optional] 
 **status** | **int**|  | [optional] [default to 1]
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

# **record_usage_api_v1_agent_usedetail_record_post_0**
> object record_usage_api_v1_agent_usedetail_record_post_0(agent_id, user_id, type=type, model=model, tokens=tokens, amount=amount, cost=cost, request_id=request_id, status=status, remark=remark)

记录使用

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
    api_instance = zhs_api.AgentUseDetailApi(api_client)
    agent_id = 'agent_id_example' # str | 
    user_id = 'user_id_example' # str | 
    type = 'consume' # str |  (optional) (default to 'consume')
    model = 'model_example' # str |  (optional)
    tokens = 0 # int |  (optional) (default to 0)
    amount = 0 # float |  (optional) (default to 0)
    cost = 0 # float |  (optional) (default to 0)
    request_id = 'request_id_example' # str |  (optional)
    status = 1 # int |  (optional) (default to 1)
    remark = 'remark_example' # str |  (optional)

    try:
        # 记录使用
        api_response = api_instance.record_usage_api_v1_agent_usedetail_record_post_0(agent_id, user_id, type=type, model=model, tokens=tokens, amount=amount, cost=cost, request_id=request_id, status=status, remark=remark)
        print("The response of AgentUseDetailApi->record_usage_api_v1_agent_usedetail_record_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentUseDetailApi->record_usage_api_v1_agent_usedetail_record_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 
 **user_id** | **str**|  | 
 **type** | **str**|  | [optional] [default to &#39;consume&#39;]
 **model** | **str**|  | [optional] 
 **tokens** | **int**|  | [optional] [default to 0]
 **amount** | **float**|  | [optional] [default to 0]
 **cost** | **float**|  | [optional] [default to 0]
 **request_id** | **str**|  | [optional] 
 **status** | **int**|  | [optional] [default to 1]
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

# **summary_stats_api_v1_agent_usedetail_stats_summary_get**
> object summary_stats_api_v1_agent_usedetail_stats_summary_get(agent_id=agent_id, start_date=start_date, end_date=end_date)

汇总统计

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
    api_instance = zhs_api.AgentUseDetailApi(api_client)
    agent_id = 'agent_id_example' # str |  (optional)
    start_date = 'start_date_example' # str |  (optional)
    end_date = 'end_date_example' # str |  (optional)

    try:
        # 汇总统计
        api_response = api_instance.summary_stats_api_v1_agent_usedetail_stats_summary_get(agent_id=agent_id, start_date=start_date, end_date=end_date)
        print("The response of AgentUseDetailApi->summary_stats_api_v1_agent_usedetail_stats_summary_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentUseDetailApi->summary_stats_api_v1_agent_usedetail_stats_summary_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | [optional] 
 **start_date** | **str**|  | [optional] 
 **end_date** | **str**|  | [optional] 

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

# **summary_stats_api_v1_agent_usedetail_stats_summary_get_0**
> object summary_stats_api_v1_agent_usedetail_stats_summary_get_0(agent_id=agent_id, start_date=start_date, end_date=end_date)

汇总统计

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
    api_instance = zhs_api.AgentUseDetailApi(api_client)
    agent_id = 'agent_id_example' # str |  (optional)
    start_date = 'start_date_example' # str |  (optional)
    end_date = 'end_date_example' # str |  (optional)

    try:
        # 汇总统计
        api_response = api_instance.summary_stats_api_v1_agent_usedetail_stats_summary_get_0(agent_id=agent_id, start_date=start_date, end_date=end_date)
        print("The response of AgentUseDetailApi->summary_stats_api_v1_agent_usedetail_stats_summary_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentUseDetailApi->summary_stats_api_v1_agent_usedetail_stats_summary_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | [optional] 
 **start_date** | **str**|  | [optional] 
 **end_date** | **str**|  | [optional] 

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

