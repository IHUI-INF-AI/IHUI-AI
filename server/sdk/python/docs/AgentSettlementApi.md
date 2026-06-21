# zhs_api.AgentSettlementApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**list_unsettled_api_v1_agents_unsettled_get**](AgentSettlementApi.md#list_unsettled_api_v1_agents_unsettled_get) | **GET** /api/v1/agents/unsettled | 查询未结算记录
[**settlement_summary_api_v1_agents_summary_get**](AgentSettlementApi.md#settlement_summary_api_v1_agents_summary_get) | **GET** /api/v1/agents/summary | 结算汇总
[**trigger_settle_api_v1_agents_settle_post**](AgentSettlementApi.md#trigger_settle_api_v1_agents_settle_post) | **POST** /api/v1/agents/settle | 触发单条结算


# **list_unsettled_api_v1_agents_unsettled_get**
> object list_unsettled_api_v1_agents_unsettled_get()

查询未结算记录

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
    api_instance = zhs_api.AgentSettlementApi(api_client)

    try:
        # 查询未结算记录
        api_response = api_instance.list_unsettled_api_v1_agents_unsettled_get()
        print("The response of AgentSettlementApi->list_unsettled_api_v1_agents_unsettled_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentSettlementApi->list_unsettled_api_v1_agents_unsettled_get: %s\n" % e)
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

# **settlement_summary_api_v1_agents_summary_get**
> object settlement_summary_api_v1_agents_summary_get()

结算汇总

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
    api_instance = zhs_api.AgentSettlementApi(api_client)

    try:
        # 结算汇总
        api_response = api_instance.settlement_summary_api_v1_agents_summary_get()
        print("The response of AgentSettlementApi->settlement_summary_api_v1_agents_summary_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentSettlementApi->settlement_summary_api_v1_agents_summary_get: %s\n" % e)
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

# **trigger_settle_api_v1_agents_settle_post**
> object trigger_settle_api_v1_agents_settle_post(settlement_id)

触发单条结算

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
    api_instance = zhs_api.AgentSettlementApi(api_client)
    settlement_id = 'settlement_id_example' # str | 

    try:
        # 触发单条结算
        api_response = api_instance.trigger_settle_api_v1_agents_settle_post(settlement_id)
        print("The response of AgentSettlementApi->trigger_settle_api_v1_agents_settle_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentSettlementApi->trigger_settle_api_v1_agents_settle_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **settlement_id** | **str**|  | 

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

