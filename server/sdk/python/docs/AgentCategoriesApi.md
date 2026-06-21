# zhs_api.AgentCategoriesApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**delete_category_api_v1_agents_category_id_delete**](AgentCategoriesApi.md#delete_category_api_v1_agents_category_id_delete) | **DELETE** /api/v1/agents/{category_id} | Delete agent category
[**get_category_detail_api_v1_agents_category_id_get**](AgentCategoriesApi.md#get_category_detail_api_v1_agents_category_id_get) | **GET** /api/v1/agents/{category_id} | Get category detail
[**update_category_api_v1_agents_category_id_put**](AgentCategoriesApi.md#update_category_api_v1_agents_category_id_put) | **PUT** /api/v1/agents/{category_id} | Update agent category


# **delete_category_api_v1_agents_category_id_delete**
> object delete_category_api_v1_agents_category_id_delete(category_id)

Delete agent category

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
    api_instance = zhs_api.AgentCategoriesApi(api_client)
    category_id = 56 # int | 

    try:
        # Delete agent category
        api_response = api_instance.delete_category_api_v1_agents_category_id_delete(category_id)
        print("The response of AgentCategoriesApi->delete_category_api_v1_agents_category_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentCategoriesApi->delete_category_api_v1_agents_category_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **category_id** | **int**|  | 

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

# **get_category_detail_api_v1_agents_category_id_get**
> object get_category_detail_api_v1_agents_category_id_get(category_id)

Get category detail

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
    api_instance = zhs_api.AgentCategoriesApi(api_client)
    category_id = 56 # int | 

    try:
        # Get category detail
        api_response = api_instance.get_category_detail_api_v1_agents_category_id_get(category_id)
        print("The response of AgentCategoriesApi->get_category_detail_api_v1_agents_category_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentCategoriesApi->get_category_detail_api_v1_agents_category_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **category_id** | **int**|  | 

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

# **update_category_api_v1_agents_category_id_put**
> object update_category_api_v1_agents_category_id_put(category_id, category_update_body)

Update agent category

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.category_update_body import CategoryUpdateBody
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
    api_instance = zhs_api.AgentCategoriesApi(api_client)
    category_id = 56 # int | 
    category_update_body = zhs_api.CategoryUpdateBody() # CategoryUpdateBody | 

    try:
        # Update agent category
        api_response = api_instance.update_category_api_v1_agents_category_id_put(category_id, category_update_body)
        print("The response of AgentCategoriesApi->update_category_api_v1_agents_category_id_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AgentCategoriesApi->update_category_api_v1_agents_category_id_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **category_id** | **int**|  | 
 **category_update_body** | [**CategoryUpdateBody**](CategoryUpdateBody.md)|  | 

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

