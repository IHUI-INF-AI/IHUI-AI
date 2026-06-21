# zhs_api.AgentsApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**delete_api_v1_agents_agent_id_delete**](AgentsApi.md#delete_api_v1_agents_agent_id_delete) | **DELETE** /api/v1/agents/{agent_id} | Delete agent
[**get_detail_api_v1_agents_agent_id_get**](AgentsApi.md#get_detail_api_v1_agents_agent_id_get) | **GET** /api/v1/agents/{agent_id} | Get agent detail
[**update_api_v1_agents_agent_id_put**](AgentsApi.md#update_api_v1_agents_agent_id_put) | **PUT** /api/v1/agents/{agent_id} | Update agent


# **delete_api_v1_agents_agent_id_delete**
> object delete_api_v1_agents_agent_id_delete(agent_id)

Delete agent

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
    api_instance = zhs_api.AgentsApi(api_client)
    agent_id = 'agent_id_example' # str | 

    try:
        # Delete agent
        api_response = api_instance.delete_api_v1_agents_agent_id_delete(agent_id)
        print("The response of AgentsApi->delete_api_v1_agents_agent_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentsApi->delete_api_v1_agents_agent_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 

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

# **get_detail_api_v1_agents_agent_id_get**
> object get_detail_api_v1_agents_agent_id_get(agent_id)

Get agent detail

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
    api_instance = zhs_api.AgentsApi(api_client)
    agent_id = 'agent_id_example' # str | 

    try:
        # Get agent detail
        api_response = api_instance.get_detail_api_v1_agents_agent_id_get(agent_id)
        print("The response of AgentsApi->get_detail_api_v1_agents_agent_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentsApi->get_detail_api_v1_agents_agent_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 

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

# **update_api_v1_agents_agent_id_put**
> object update_api_v1_agents_agent_id_put(agent_id, agent_name=agent_name, agent_prompt=agent_prompt, publish_status=publish_status)

Update agent

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
    api_instance = zhs_api.AgentsApi(api_client)
    agent_id = 'agent_id_example' # str | 
    agent_name = 'agent_name_example' # str |  (optional)
    agent_prompt = 'agent_prompt_example' # str |  (optional)
    publish_status = 56 # int |  (optional)

    try:
        # Update agent
        api_response = api_instance.update_api_v1_agents_agent_id_put(agent_id, agent_name=agent_name, agent_prompt=agent_prompt, publish_status=publish_status)
        print("The response of AgentsApi->update_api_v1_agents_agent_id_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentsApi->update_api_v1_agents_agent_id_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 
 **agent_name** | **str**|  | [optional] 
 **agent_prompt** | **str**|  | [optional] 
 **publish_status** | **int**|  | [optional] 

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

