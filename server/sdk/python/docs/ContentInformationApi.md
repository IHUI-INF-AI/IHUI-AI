# zhs_api.ContentInformationApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_information_api_v1_content_information_create_post**](ContentInformationApi.md#create_information_api_v1_content_information_create_post) | **POST** /api/v1/content/information/create | 创建资讯
[**list_dictionary_api_v1_content_information_dictionary_get**](ContentInformationApi.md#list_dictionary_api_v1_content_information_dictionary_get) | **GET** /api/v1/content/information/dictionary | 资讯分类字典
[**list_information_api_v1_content_information_list_get**](ContentInformationApi.md#list_information_api_v1_content_information_list_get) | **GET** /api/v1/content/information/list | 资讯列表


# **create_information_api_v1_content_information_create_post**
> object create_information_api_v1_content_information_create_post(title, content=content, type=type, sort=sort)

创建资讯

管理端创建一条 AI 资讯。

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
    api_instance = zhs_api.ContentInformationApi(api_client)
    title = 'title_example' # str | 
    content = '' # str |  (optional) (default to '')
    type = 56 # int | 资讯分类 type (optional)
    sort = 0 # int |  (optional) (default to 0)

    try:
        # 创建资讯
        api_response = api_instance.create_information_api_v1_content_information_create_post(title, content=content, type=type, sort=sort)
        print("The response of ContentInformationApi->create_information_api_v1_content_information_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentInformationApi->create_information_api_v1_content_information_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**|  | 
 **content** | **str**|  | [optional] [default to &#39;&#39;]
 **type** | **int**| 资讯分类 type | [optional] 
 **sort** | **int**|  | [optional] [default to 0]

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

# **list_dictionary_api_v1_content_information_dictionary_get**
> object list_dictionary_api_v1_content_information_dictionary_get(type=type)

资讯分类字典

返回 zhs_category_dictionary 中的分类字典列表。

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
    api_instance = zhs_api.ContentInformationApi(api_client)
    type = 'type_example' # str | 字典类型筛选 (optional)

    try:
        # 资讯分类字典
        api_response = api_instance.list_dictionary_api_v1_content_information_dictionary_get(type=type)
        print("The response of ContentInformationApi->list_dictionary_api_v1_content_information_dictionary_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentInformationApi->list_dictionary_api_v1_content_information_dictionary_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type** | **str**| 字典类型筛选 | [optional] 

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

# **list_information_api_v1_content_information_list_get**
> object list_information_api_v1_content_information_list_get(page=page, limit=limit, type=type, status=status)

资讯列表

分页返回资讯列表。

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
    api_instance = zhs_api.ContentInformationApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    type = 56 # int | 按分类筛选 (optional)
    status = 56 # int | 筛选状态: 0=禁用 1=启用 (optional)

    try:
        # 资讯列表
        api_response = api_instance.list_information_api_v1_content_information_list_get(page=page, limit=limit, type=type, status=status)
        print("The response of ContentInformationApi->list_information_api_v1_content_information_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentInformationApi->list_information_api_v1_content_information_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **type** | **int**| 按分类筛选 | [optional] 
 **status** | **int**| 筛选状态: 0&#x3D;禁用 1&#x3D;启用 | [optional] 

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

