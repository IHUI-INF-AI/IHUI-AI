# zhs_api.CozeVariablesApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_variable_api_v1_coze_variables_variables_create_post**](CozeVariablesApi.md#create_variable_api_v1_coze_variables_variables_create_post) | **POST** /api/v1/coze/variables/variables/create | Create Variable
[**delete_variable_api_v1_coze_variables_variables_delete_post**](CozeVariablesApi.md#delete_variable_api_v1_coze_variables_variables_delete_post) | **POST** /api/v1/coze/variables/variables/delete | Delete Variable
[**list_variables_api_v1_coze_variables_variables_list_get**](CozeVariablesApi.md#list_variables_api_v1_coze_variables_variables_list_get) | **GET** /api/v1/coze/variables/variables/list | List Variables
[**retrieve_variable_api_v1_coze_variables_variables_retrieve_get**](CozeVariablesApi.md#retrieve_variable_api_v1_coze_variables_variables_retrieve_get) | **GET** /api/v1/coze/variables/variables/retrieve | Retrieve Variable
[**update_variable_api_v1_coze_variables_variables_update_post**](CozeVariablesApi.md#update_variable_api_v1_coze_variables_variables_update_post) | **POST** /api/v1/coze/variables/variables/update | Update Variable


# **create_variable_api_v1_coze_variables_variables_create_post**
> object create_variable_api_v1_coze_variables_variables_create_post(create_var_req)

Create Variable

### Example


```python
import zhs_api
from zhs_api.models.create_var_req import CreateVarReq
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
    api_instance = zhs_api.CozeVariablesApi(api_client)
    create_var_req = zhs_api.CreateVarReq() # CreateVarReq | 

    try:
        # Create Variable
        api_response = api_instance.create_variable_api_v1_coze_variables_variables_create_post(create_var_req)
        print("The response of CozeVariablesApi->create_variable_api_v1_coze_variables_variables_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeVariablesApi->create_variable_api_v1_coze_variables_variables_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **create_var_req** | [**CreateVarReq**](CreateVarReq.md)|  | 

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

# **delete_variable_api_v1_coze_variables_variables_delete_post**
> object delete_variable_api_v1_coze_variables_variables_delete_post(delete_var_req)

Delete Variable

### Example


```python
import zhs_api
from zhs_api.models.delete_var_req import DeleteVarReq
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
    api_instance = zhs_api.CozeVariablesApi(api_client)
    delete_var_req = zhs_api.DeleteVarReq() # DeleteVarReq | 

    try:
        # Delete Variable
        api_response = api_instance.delete_variable_api_v1_coze_variables_variables_delete_post(delete_var_req)
        print("The response of CozeVariablesApi->delete_variable_api_v1_coze_variables_variables_delete_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeVariablesApi->delete_variable_api_v1_coze_variables_variables_delete_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **delete_var_req** | [**DeleteVarReq**](DeleteVarReq.md)|  | 

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

# **list_variables_api_v1_coze_variables_variables_list_get**
> object list_variables_api_v1_coze_variables_variables_list_get(connector_id, page=page, size=size)

List Variables

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
    api_instance = zhs_api.CozeVariablesApi(api_client)
    connector_id = 'connector_id_example' # str | 
    page = 1 # int |  (optional) (default to 1)
    size = 20 # int |  (optional) (default to 20)

    try:
        # List Variables
        api_response = api_instance.list_variables_api_v1_coze_variables_variables_list_get(connector_id, page=page, size=size)
        print("The response of CozeVariablesApi->list_variables_api_v1_coze_variables_variables_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeVariablesApi->list_variables_api_v1_coze_variables_variables_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **connector_id** | **str**|  | 
 **page** | **int**|  | [optional] [default to 1]
 **size** | **int**|  | [optional] [default to 20]

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

# **retrieve_variable_api_v1_coze_variables_variables_retrieve_get**
> object retrieve_variable_api_v1_coze_variables_variables_retrieve_get(connector_id, variable_id)

Retrieve Variable

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
    api_instance = zhs_api.CozeVariablesApi(api_client)
    connector_id = 'connector_id_example' # str | 
    variable_id = 'variable_id_example' # str | 

    try:
        # Retrieve Variable
        api_response = api_instance.retrieve_variable_api_v1_coze_variables_variables_retrieve_get(connector_id, variable_id)
        print("The response of CozeVariablesApi->retrieve_variable_api_v1_coze_variables_variables_retrieve_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeVariablesApi->retrieve_variable_api_v1_coze_variables_variables_retrieve_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **connector_id** | **str**|  | 
 **variable_id** | **str**|  | 

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

# **update_variable_api_v1_coze_variables_variables_update_post**
> object update_variable_api_v1_coze_variables_variables_update_post(update_var_req)

Update Variable

### Example


```python
import zhs_api
from zhs_api.models.update_var_req import UpdateVarReq
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
    api_instance = zhs_api.CozeVariablesApi(api_client)
    update_var_req = zhs_api.UpdateVarReq() # UpdateVarReq | 

    try:
        # Update Variable
        api_response = api_instance.update_variable_api_v1_coze_variables_variables_update_post(update_var_req)
        print("The response of CozeVariablesApi->update_variable_api_v1_coze_variables_variables_update_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeVariablesApi->update_variable_api_v1_coze_variables_variables_update_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **update_var_req** | [**UpdateVarReq**](UpdateVarReq.md)|  | 

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

