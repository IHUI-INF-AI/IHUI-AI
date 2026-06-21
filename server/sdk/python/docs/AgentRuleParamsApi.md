# zhs_api.AgentRuleParamsApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_rule_param_api_v1_post**](AgentRuleParamsApi.md#create_rule_param_api_v1_post) | **POST** /api/v1/ | Create rule param
[**delete_rule_params_api_v1_item_ids_delete**](AgentRuleParamsApi.md#delete_rule_params_api_v1_item_ids_delete) | **DELETE** /api/v1/{item_ids} | Delete rule params
[**get_rule_param_api_v1_item_id_get**](AgentRuleParamsApi.md#get_rule_param_api_v1_item_id_get) | **GET** /api/v1/{item_id} | Get rule param detail
[**list_rule_params_api_v1_list_get**](AgentRuleParamsApi.md#list_rule_params_api_v1_list_get) | **GET** /api/v1/list | List rule params
[**update_rule_param_api_v1_put**](AgentRuleParamsApi.md#update_rule_param_api_v1_put) | **PUT** /api/v1/ | Update rule param


# **create_rule_param_api_v1_post**
> object create_rule_param_api_v1_post(rule_param_create)

Create rule param

### Example


```python
import zhs_api
from zhs_api.models.rule_param_create import RuleParamCreate
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
    api_instance = zhs_api.AgentRuleParamsApi(api_client)
    rule_param_create = zhs_api.RuleParamCreate() # RuleParamCreate | 

    try:
        # Create rule param
        api_response = api_instance.create_rule_param_api_v1_post(rule_param_create)
        print("The response of AgentRuleParamsApi->create_rule_param_api_v1_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentRuleParamsApi->create_rule_param_api_v1_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **rule_param_create** | [**RuleParamCreate**](RuleParamCreate.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **delete_rule_params_api_v1_item_ids_delete**
> object delete_rule_params_api_v1_item_ids_delete(item_ids)

Delete rule params

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
    api_instance = zhs_api.AgentRuleParamsApi(api_client)
    item_ids = 'item_ids_example' # str | 

    try:
        # Delete rule params
        api_response = api_instance.delete_rule_params_api_v1_item_ids_delete(item_ids)
        print("The response of AgentRuleParamsApi->delete_rule_params_api_v1_item_ids_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentRuleParamsApi->delete_rule_params_api_v1_item_ids_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **item_ids** | **str**|  | 

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

# **get_rule_param_api_v1_item_id_get**
> object get_rule_param_api_v1_item_id_get(item_id)

Get rule param detail

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
    api_instance = zhs_api.AgentRuleParamsApi(api_client)
    item_id = 56 # int | 

    try:
        # Get rule param detail
        api_response = api_instance.get_rule_param_api_v1_item_id_get(item_id)
        print("The response of AgentRuleParamsApi->get_rule_param_api_v1_item_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentRuleParamsApi->get_rule_param_api_v1_item_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **item_id** | **int**|  | 

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

# **list_rule_params_api_v1_list_get**
> object list_rule_params_api_v1_list_get(page=page, limit=limit, rule_id=rule_id)

List rule params

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
    api_instance = zhs_api.AgentRuleParamsApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    rule_id = 56 # int |  (optional)

    try:
        # List rule params
        api_response = api_instance.list_rule_params_api_v1_list_get(page=page, limit=limit, rule_id=rule_id)
        print("The response of AgentRuleParamsApi->list_rule_params_api_v1_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentRuleParamsApi->list_rule_params_api_v1_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **rule_id** | **int**|  | [optional] 

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

# **update_rule_param_api_v1_put**
> object update_rule_param_api_v1_put(rule_param_update)

Update rule param

### Example


```python
import zhs_api
from zhs_api.models.rule_param_update import RuleParamUpdate
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
    api_instance = zhs_api.AgentRuleParamsApi(api_client)
    rule_param_update = zhs_api.RuleParamUpdate() # RuleParamUpdate | 

    try:
        # Update rule param
        api_response = api_instance.update_rule_param_api_v1_put(rule_param_update)
        print("The response of AgentRuleParamsApi->update_rule_param_api_v1_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentRuleParamsApi->update_rule_param_api_v1_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **rule_param_update** | [**RuleParamUpdate**](RuleParamUpdate.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

