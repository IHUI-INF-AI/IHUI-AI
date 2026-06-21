# zhs_api.ResourceContextApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**get_agent_with_deduction_api_v1_resource_context_agent_agent_id_get**](ResourceContextApi.md#get_agent_with_deduction_api_v1_resource_context_agent_agent_id_get) | **GET** /api/v1/resource/context/agent/{agent_id} | 获取Agent调用（含token扣除）
[**get_context_api_v1_resource_context_get_get**](ResourceContextApi.md#get_context_api_v1_resource_context_get_get) | **GET** /api/v1/resource/context/get | 获取用户上下文
[**get_field_api_v1_resource_context_field_get**](ResourceContextApi.md#get_field_api_v1_resource_context_field_get) | **GET** /api/v1/resource/context/field | 获取指定字段值
[**get_sample_context_api_v1_resource_context_sample_get**](ResourceContextApi.md#get_sample_context_api_v1_resource_context_sample_get) | **GET** /api/v1/resource/context/sample | Get sample context data
[**get_usage_history_api_v1_resource_context_history_post**](ResourceContextApi.md#get_usage_history_api_v1_resource_context_history_post) | **POST** /api/v1/resource/context/history | Query usage history
[**query_context_raw_api_v1_resource_context_query_post**](ResourceContextApi.md#query_context_raw_api_v1_resource_context_query_post) | **POST** /api/v1/resource/context/query | Query user agent context (raw SQL)
[**remove_field_api_v1_resource_context_remove_field_post**](ResourceContextApi.md#remove_field_api_v1_resource_context_remove_field_post) | **POST** /api/v1/resource/context/remove/field | 删除指定字段
[**save_context_api_v1_resource_context_save_post**](ResourceContextApi.md#save_context_api_v1_resource_context_save_post) | **POST** /api/v1/resource/context/save | 保存用户上下文


# **get_agent_with_deduction_api_v1_resource_context_agent_agent_id_get**
> object get_agent_with_deduction_api_v1_resource_context_agent_agent_id_get(agent_id)

获取Agent调用（含token扣除）

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
    api_instance = zhs_api.ResourceContextApi(api_client)
    agent_id = 'agent_id_example' # str | 

    try:
        # 获取Agent调用（含token扣除）
        api_response = api_instance.get_agent_with_deduction_api_v1_resource_context_agent_agent_id_get(agent_id)
        print("The response of ResourceContextApi->get_agent_with_deduction_api_v1_resource_context_agent_agent_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceContextApi->get_agent_with_deduction_api_v1_resource_context_agent_agent_id_get: %s\n" % e)
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

# **get_context_api_v1_resource_context_get_get**
> object get_context_api_v1_resource_context_get_get(agent_id, context_key=context_key)

获取用户上下文

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
    api_instance = zhs_api.ResourceContextApi(api_client)
    agent_id = 'agent_id_example' # str | Agent ID
    context_key = 'context_key_example' # str | Context key (optional filter) (optional)

    try:
        # 获取用户上下文
        api_response = api_instance.get_context_api_v1_resource_context_get_get(agent_id, context_key=context_key)
        print("The response of ResourceContextApi->get_context_api_v1_resource_context_get_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceContextApi->get_context_api_v1_resource_context_get_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**| Agent ID | 
 **context_key** | **str**| Context key (optional filter) | [optional] 

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

# **get_field_api_v1_resource_context_field_get**
> object get_field_api_v1_resource_context_field_get(agent_id, field_name)

获取指定字段值

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
    api_instance = zhs_api.ResourceContextApi(api_client)
    agent_id = 'agent_id_example' # str | 
    field_name = 'field_name_example' # str | 

    try:
        # 获取指定字段值
        api_response = api_instance.get_field_api_v1_resource_context_field_get(agent_id, field_name)
        print("The response of ResourceContextApi->get_field_api_v1_resource_context_field_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceContextApi->get_field_api_v1_resource_context_field_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agent_id** | **str**|  | 
 **field_name** | **str**|  | 

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

# **get_sample_context_api_v1_resource_context_sample_get**
> object get_sample_context_api_v1_resource_context_sample_get(limit=limit)

Get sample context data

Return a few sample rows for debugging / display.

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
    api_instance = zhs_api.ResourceContextApi(api_client)
    limit = 5 # int | Number of rows (optional) (default to 5)

    try:
        # Get sample context data
        api_response = api_instance.get_sample_context_api_v1_resource_context_sample_get(limit=limit)
        print("The response of ResourceContextApi->get_sample_context_api_v1_resource_context_sample_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceContextApi->get_sample_context_api_v1_resource_context_sample_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **int**| Number of rows | [optional] [default to 5]

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

# **get_usage_history_api_v1_resource_context_history_post**
> object get_usage_history_api_v1_resource_context_history_post(history_request)

Query usage history

Query user's agent usage history with model name join and pagination.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.history_request import HistoryRequest
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
    api_instance = zhs_api.ResourceContextApi(api_client)
    history_request = zhs_api.HistoryRequest() # HistoryRequest | 

    try:
        # Query usage history
        api_response = api_instance.get_usage_history_api_v1_resource_context_history_post(history_request)
        print("The response of ResourceContextApi->get_usage_history_api_v1_resource_context_history_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceContextApi->get_usage_history_api_v1_resource_context_history_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **history_request** | [**HistoryRequest**](HistoryRequest.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **query_context_raw_api_v1_resource_context_query_post**
> object query_context_raw_api_v1_resource_context_query_post(raw_context_request)

Query user agent context (raw SQL)

Query zhs_user_agent_context by user_uuid + model_name + chat_id.
Returns messages list with user/assistant role alternation.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.raw_context_request import RawContextRequest
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
    api_instance = zhs_api.ResourceContextApi(api_client)
    raw_context_request = zhs_api.RawContextRequest() # RawContextRequest | 

    try:
        # Query user agent context (raw SQL)
        api_response = api_instance.query_context_raw_api_v1_resource_context_query_post(raw_context_request)
        print("The response of ResourceContextApi->query_context_raw_api_v1_resource_context_query_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceContextApi->query_context_raw_api_v1_resource_context_query_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **raw_context_request** | [**RawContextRequest**](RawContextRequest.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **remove_field_api_v1_resource_context_remove_field_post**
> object remove_field_api_v1_resource_context_remove_field_post(field_remove_request)

删除指定字段

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.field_remove_request import FieldRemoveRequest
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
    api_instance = zhs_api.ResourceContextApi(api_client)
    field_remove_request = zhs_api.FieldRemoveRequest() # FieldRemoveRequest | 

    try:
        # 删除指定字段
        api_response = api_instance.remove_field_api_v1_resource_context_remove_field_post(field_remove_request)
        print("The response of ResourceContextApi->remove_field_api_v1_resource_context_remove_field_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceContextApi->remove_field_api_v1_resource_context_remove_field_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **field_remove_request** | [**FieldRemoveRequest**](FieldRemoveRequest.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **save_context_api_v1_resource_context_save_post**
> object save_context_api_v1_resource_context_save_post(context_save_request)

保存用户上下文

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.context_save_request import ContextSaveRequest
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
    api_instance = zhs_api.ResourceContextApi(api_client)
    context_save_request = zhs_api.ContextSaveRequest() # ContextSaveRequest | 

    try:
        # 保存用户上下文
        api_response = api_instance.save_context_api_v1_resource_context_save_post(context_save_request)
        print("The response of ResourceContextApi->save_context_api_v1_resource_context_save_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ResourceContextApi->save_context_api_v1_resource_context_save_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **context_save_request** | [**ContextSaveRequest**](ContextSaveRequest.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

