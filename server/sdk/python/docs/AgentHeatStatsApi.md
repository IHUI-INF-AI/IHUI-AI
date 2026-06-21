# zhs_api.AgentHeatStatsApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**agent_heat_api_v1_agents_agent_agent_id_get**](AgentHeatStatsApi.md#agent_heat_api_v1_agents_agent_agent_id_get) | **GET** /api/v1/agents/agent/{agent_id} | 查询 Agent 热度（按日聚合）
[**hit_api_v1_agents_hit_post**](AgentHeatStatsApi.md#hit_api_v1_agents_hit_post) | **POST** /api/v1/agents/hit | 记录一次 Agent 命中（内部调用）
[**top_agents_api_v1_agents_top_get**](AgentHeatStatsApi.md#top_agents_api_v1_agents_top_get) | **GET** /api/v1/agents/top | 热度 TOP 榜


# **agent_heat_api_v1_agents_agent_agent_id_get**
> object agent_heat_api_v1_agents_agent_agent_id_get(agent_id, days=days)

查询 Agent 热度（按日聚合）

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
    api_instance = zhs_api.AgentHeatStatsApi(api_client)
    agent_id = 'agent_id_example' # str | 
    days = 7 # int |  (optional) (default to 7)

    try:
        # 查询 Agent 热度（按日聚合）
        api_response = api_instance.agent_heat_api_v1_agents_agent_agent_id_get(agent_id, days=days)
        print("The response of AgentHeatStatsApi->agent_heat_api_v1_agents_agent_agent_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentHeatStatsApi->agent_heat_api_v1_agents_agent_agent_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 
 **days** | **int**|  | [optional] [default to 7]

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

# **hit_api_v1_agents_hit_post**
> object hit_api_v1_agents_hit_post(agent_id)

记录一次 Agent 命中（内部调用）

累加当日 hit_count。无对应行时新建。

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
    api_instance = zhs_api.AgentHeatStatsApi(api_client)
    agent_id = 'agent_id_example' # str | 

    try:
        # 记录一次 Agent 命中（内部调用）
        api_response = api_instance.hit_api_v1_agents_hit_post(agent_id)
        print("The response of AgentHeatStatsApi->hit_api_v1_agents_hit_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentHeatStatsApi->hit_api_v1_agents_hit_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 

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

# **top_agents_api_v1_agents_top_get**
> object top_agents_api_v1_agents_top_get(days=days, limit=limit)

热度 TOP 榜

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
    api_instance = zhs_api.AgentHeatStatsApi(api_client)
    days = 7 # int |  (optional) (default to 7)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 热度 TOP 榜
        api_response = api_instance.top_agents_api_v1_agents_top_get(days=days, limit=limit)
        print("The response of AgentHeatStatsApi->top_agents_api_v1_agents_top_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentHeatStatsApi->top_agents_api_v1_agents_top_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **days** | **int**|  | [optional] [default to 7]
 **limit** | **int**|  | [optional] [default to 20]

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

