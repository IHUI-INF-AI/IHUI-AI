# zhs_api.AgentDevelopersApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**bind_coze_api_v1_agents_coze_link_bind_post**](AgentDevelopersApi.md#bind_coze_api_v1_agents_coze_link_bind_post) | **POST** /api/v1/agents/coze-link/bind | 绑定 Coze 账号
[**bind_developer_api_v1_agents_bind_post**](AgentDevelopersApi.md#bind_developer_api_v1_agents_bind_post) | **POST** /api/v1/agents/bind | 绑定 Agent 到当前用户（成为开发者）
[**coze_link_api_v1_agents_coze_link_get**](AgentDevelopersApi.md#coze_link_api_v1_agents_coze_link_get) | **GET** /api/v1/agents/coze-link | 查询 Coze 账号绑定
[**get_developer_api_v1_agents_record_id_get**](AgentDevelopersApi.md#get_developer_api_v1_agents_record_id_get) | **GET** /api/v1/agents/{record_id} | 开发者记录详情
[**my_developer_agents_api_v1_agents_my_get**](AgentDevelopersApi.md#my_developer_agents_api_v1_agents_my_get) | **GET** /api/v1/agents/my | 我作为开发者的所有 Agent
[**update_price_api_v1_agents_update_price_post**](AgentDevelopersApi.md#update_price_api_v1_agents_update_price_post) | **POST** /api/v1/agents/update-price | 更新开发者价格


# **bind_coze_api_v1_agents_coze_link_bind_post**
> object bind_coze_api_v1_agents_coze_link_bind_post(coze_account_id, coze_account_name)

绑定 Coze 账号

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
    api_instance = zhs_api.AgentDevelopersApi(api_client)
    coze_account_id = 'coze_account_id_example' # str | 
    coze_account_name = 'coze_account_name_example' # str | 

    try:
        # 绑定 Coze 账号
        api_response = api_instance.bind_coze_api_v1_agents_coze_link_bind_post(coze_account_id, coze_account_name)
        print("The response of AgentDevelopersApi->bind_coze_api_v1_agents_coze_link_bind_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentDevelopersApi->bind_coze_api_v1_agents_coze_link_bind_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **coze_account_id** | **str**|  | 
 **coze_account_name** | **str**|  | 

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

# **bind_developer_api_v1_agents_bind_post**
> object bind_developer_api_v1_agents_bind_post(agent_id, price=price)

绑定 Agent 到当前用户（成为开发者）

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
    api_instance = zhs_api.AgentDevelopersApi(api_client)
    agent_id = 'agent_id_example' # str | 
    price = 0.0 # float | 开发者价格 (optional) (default to 0.0)

    try:
        # 绑定 Agent 到当前用户（成为开发者）
        api_response = api_instance.bind_developer_api_v1_agents_bind_post(agent_id, price=price)
        print("The response of AgentDevelopersApi->bind_developer_api_v1_agents_bind_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentDevelopersApi->bind_developer_api_v1_agents_bind_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 
 **price** | **float**| 开发者价格 | [optional] [default to 0.0]

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

# **coze_link_api_v1_agents_coze_link_get**
> object coze_link_api_v1_agents_coze_link_get()

查询 Coze 账号绑定

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
    api_instance = zhs_api.AgentDevelopersApi(api_client)

    try:
        # 查询 Coze 账号绑定
        api_response = api_instance.coze_link_api_v1_agents_coze_link_get()
        print("The response of AgentDevelopersApi->coze_link_api_v1_agents_coze_link_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentDevelopersApi->coze_link_api_v1_agents_coze_link_get: %s\n" % e)
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

# **get_developer_api_v1_agents_record_id_get**
> object get_developer_api_v1_agents_record_id_get(record_id)

开发者记录详情

根据记录 ID 返回开发者详情。

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
    api_instance = zhs_api.AgentDevelopersApi(api_client)
    record_id = 56 # int | 

    try:
        # 开发者记录详情
        api_response = api_instance.get_developer_api_v1_agents_record_id_get(record_id)
        print("The response of AgentDevelopersApi->get_developer_api_v1_agents_record_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentDevelopersApi->get_developer_api_v1_agents_record_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **record_id** | **int**|  | 

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

# **my_developer_agents_api_v1_agents_my_get**
> object my_developer_agents_api_v1_agents_my_get()

我作为开发者的所有 Agent

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
    api_instance = zhs_api.AgentDevelopersApi(api_client)

    try:
        # 我作为开发者的所有 Agent
        api_response = api_instance.my_developer_agents_api_v1_agents_my_get()
        print("The response of AgentDevelopersApi->my_developer_agents_api_v1_agents_my_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentDevelopersApi->my_developer_agents_api_v1_agents_my_get: %s\n" % e)
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

# **update_price_api_v1_agents_update_price_post**
> object update_price_api_v1_agents_update_price_post(agent_id, price)

更新开发者价格

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
    api_instance = zhs_api.AgentDevelopersApi(api_client)
    agent_id = 'agent_id_example' # str | 
    price = 3.4 # float | 

    try:
        # 更新开发者价格
        api_response = api_instance.update_price_api_v1_agents_update_price_post(agent_id, price)
        print("The response of AgentDevelopersApi->update_price_api_v1_agents_update_price_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentDevelopersApi->update_price_api_v1_agents_update_price_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 
 **price** | **float**|  | 

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

