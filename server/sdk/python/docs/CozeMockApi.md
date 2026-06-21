# zhs_api.CozeMockApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mock_coze_agents**](CozeMockApi.md#mock_coze_agents) | **GET** /cozeZhsApi/agents | Mock: Coze 智能体列表
[**mock_coze_categories**](CozeMockApi.md#mock_coze_categories) | **GET** /cozeZhsApi/cache/agent-category-dict/categories | Mock: Coze 智能体分类字典
[**mock_coze_category_detail**](CozeMockApi.md#mock_coze_category_detail) | **GET** /cozeZhsApi/cache/agent-category-dict/categories/{category_id} | Mock: Coze 分类详情


# **mock_coze_agents**
> object mock_coze_agents()

Mock: Coze 智能体列表

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
    api_instance = zhs_api.CozeMockApi(api_client)

    try:
        # Mock: Coze 智能体列表
        api_response = api_instance.mock_coze_agents()
        print("The response of CozeMockApi->mock_coze_agents:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeMockApi->mock_coze_agents: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mock_coze_categories**
> object mock_coze_categories()

Mock: Coze 智能体分类字典

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
    api_instance = zhs_api.CozeMockApi(api_client)

    try:
        # Mock: Coze 智能体分类字典
        api_response = api_instance.mock_coze_categories()
        print("The response of CozeMockApi->mock_coze_categories:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeMockApi->mock_coze_categories: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mock_coze_category_detail**
> object mock_coze_category_detail(category_id)

Mock: Coze 分类详情

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
    api_instance = zhs_api.CozeMockApi(api_client)
    category_id = 'category_id_example' # str | 

    try:
        # Mock: Coze 分类详情
        api_response = api_instance.mock_coze_category_detail(category_id)
        print("The response of CozeMockApi->mock_coze_category_detail:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeMockApi->mock_coze_category_detail: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **category_id** | **str**|  | 

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

