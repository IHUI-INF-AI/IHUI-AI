# zhs_api.AgentPurchaseApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**expire_purchase_api_v1_agents_record_id_expire_put**](AgentPurchaseApi.md#expire_purchase_api_v1_agents_record_id_expire_put) | **PUT** /api/v1/agents/{record_id}/expire | Mark purchase record as expired
[**get_purchase_by_order_api_v1_agents_order_order_no_get**](AgentPurchaseApi.md#get_purchase_by_order_api_v1_agents_order_order_no_get) | **GET** /api/v1/agents/order/{order_no} | Query by order number
[**get_purchase_by_user_agent_api_v1_agents_user_user_uuid_agent_agent_id_get**](AgentPurchaseApi.md#get_purchase_by_user_agent_api_v1_agents_user_user_uuid_agent_agent_id_get) | **GET** /api/v1/agents/user/{user_uuid}/agent/{agent_id} | Query by user and agent
[**list_expired_purchases_api_v1_agents_expired_get**](AgentPurchaseApi.md#list_expired_purchases_api_v1_agents_expired_get) | **GET** /api/v1/agents/expired | List expired purchase records


# **expire_purchase_api_v1_agents_record_id_expire_put**
> object expire_purchase_api_v1_agents_record_id_expire_put(record_id)

Mark purchase record as expired

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
    api_instance = zhs_api.AgentPurchaseApi(api_client)
    record_id = 56 # int | 

    try:
        # Mark purchase record as expired
        api_response = api_instance.expire_purchase_api_v1_agents_record_id_expire_put(record_id)
        print("The response of AgentPurchaseApi->expire_purchase_api_v1_agents_record_id_expire_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentPurchaseApi->expire_purchase_api_v1_agents_record_id_expire_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **record_id** | **int**|  | 

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

# **get_purchase_by_order_api_v1_agents_order_order_no_get**
> object get_purchase_by_order_api_v1_agents_order_order_no_get(order_no)

Query by order number

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
    api_instance = zhs_api.AgentPurchaseApi(api_client)
    order_no = 'order_no_example' # str | 

    try:
        # Query by order number
        api_response = api_instance.get_purchase_by_order_api_v1_agents_order_order_no_get(order_no)
        print("The response of AgentPurchaseApi->get_purchase_by_order_api_v1_agents_order_order_no_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentPurchaseApi->get_purchase_by_order_api_v1_agents_order_order_no_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **order_no** | **str**|  | 

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

# **get_purchase_by_user_agent_api_v1_agents_user_user_uuid_agent_agent_id_get**
> object get_purchase_by_user_agent_api_v1_agents_user_user_uuid_agent_agent_id_get(user_uuid, agent_id, page=page, limit=limit)

Query by user and agent

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
    api_instance = zhs_api.AgentPurchaseApi(api_client)
    user_uuid = 'user_uuid_example' # str | 
    agent_id = 'agent_id_example' # str | 
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # Query by user and agent
        api_response = api_instance.get_purchase_by_user_agent_api_v1_agents_user_user_uuid_agent_agent_id_get(user_uuid, agent_id, page=page, limit=limit)
        print("The response of AgentPurchaseApi->get_purchase_by_user_agent_api_v1_agents_user_user_uuid_agent_agent_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentPurchaseApi->get_purchase_by_user_agent_api_v1_agents_user_user_uuid_agent_agent_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **user_uuid** | **str**|  | 
 **agent_id** | **str**|  | 
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

# **list_expired_purchases_api_v1_agents_expired_get**
> object list_expired_purchases_api_v1_agents_expired_get(page=page, limit=limit)

List expired purchase records

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
    api_instance = zhs_api.AgentPurchaseApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # List expired purchase records
        api_response = api_instance.list_expired_purchases_api_v1_agents_expired_get(page=page, limit=limit)
        print("The response of AgentPurchaseApi->list_expired_purchases_api_v1_agents_expired_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentPurchaseApi->list_expired_purchases_api_v1_agents_expired_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
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

