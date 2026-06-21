# zhs_api.ToolsApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**list_categories_api_v1_tools_categories_get**](ToolsApi.md#list_categories_api_v1_tools_categories_get) | **GET** /api/v1/tools/categories | 获取工具分类列表
[**list_tools_api_v1_tools_list_get**](ToolsApi.md#list_tools_api_v1_tools_list_get) | **GET** /api/v1/tools/list | 获取工具列表
[**upload_file_api_v1_tools_upload_post**](ToolsApi.md#upload_file_api_v1_tools_upload_post) | **POST** /api/v1/tools/upload | Upload file to MinIO


# **list_categories_api_v1_tools_categories_get**
> object list_categories_api_v1_tools_categories_get()

获取工具分类列表

获取工具分类及每个分类的工具数量

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
    api_instance = zhs_api.ToolsApi(api_client)

    try:
        # 获取工具分类列表
        api_response = api_instance.list_categories_api_v1_tools_categories_get()
        print("The response of ToolsApi->list_categories_api_v1_tools_categories_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ToolsApi->list_categories_api_v1_tools_categories_get: %s\n" % e)
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

# **list_tools_api_v1_tools_list_get**
> object list_tools_api_v1_tools_list_get(category=category, keyword=keyword, sort=sort)

获取工具列表

获取工具列表 (对接 Tools.vue 前端)

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
    api_instance = zhs_api.ToolsApi(api_client)
    category = 'category_example' # str | 分类过滤 (optional)
    keyword = 'keyword_example' # str | 搜索关键词 (optional)
    sort = 'sort_example' # str | 排序: default/name/hot (optional)

    try:
        # 获取工具列表
        api_response = api_instance.list_tools_api_v1_tools_list_get(category=category, keyword=keyword, sort=sort)
        print("The response of ToolsApi->list_tools_api_v1_tools_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ToolsApi->list_tools_api_v1_tools_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **category** | **str**| 分类过滤 | [optional] 
 **keyword** | **str**| 搜索关键词 | [optional] 
 **sort** | **str**| 排序: default/name/hot | [optional] 

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

# **upload_file_api_v1_tools_upload_post**
> object upload_file_api_v1_tools_upload_post(file)

Upload file to MinIO

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
    api_instance = zhs_api.ToolsApi(api_client)
    file = None # bytes | 

    try:
        # Upload file to MinIO
        api_response = api_instance.upload_file_api_v1_tools_upload_post(file)
        print("The response of ToolsApi->upload_file_api_v1_tools_upload_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ToolsApi->upload_file_api_v1_tools_upload_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file** | **bytes**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

