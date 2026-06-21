# zhs_api.ContentActivityApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**get_activity_api_v1_content_activity_activity_id_get**](ContentActivityApi.md#get_activity_api_v1_content_activity_activity_id_get) | **GET** /api/v1/content/activity/{activity_id} | 活动详情
[**list_activities_api_v1_content_activity_list_get**](ContentActivityApi.md#list_activities_api_v1_content_activity_list_get) | **GET** /api/v1/content/activity/list | 活动列表


# **get_activity_api_v1_content_activity_activity_id_get**
> object get_activity_api_v1_content_activity_activity_id_get(activity_id)

活动详情

根据活动 ID 返回详情。

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
    api_instance = zhs_api.ContentActivityApi(api_client)
    activity_id = 'activity_id_example' # str | 

    try:
        # 活动详情
        api_response = api_instance.get_activity_api_v1_content_activity_activity_id_get(activity_id)
        print("The response of ContentActivityApi->get_activity_api_v1_content_activity_activity_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentActivityApi->get_activity_api_v1_content_activity_activity_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **activity_id** | **str**|  | 

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

# **list_activities_api_v1_content_activity_list_get**
> object list_activities_api_v1_content_activity_list_get(page=page, limit=limit, status=status)

活动列表

分页返回活动列表，可按 status 筛选。

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
    api_instance = zhs_api.ContentActivityApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    status = 56 # int | 筛选状态: 0=关闭 1=开启 (optional)

    try:
        # 活动列表
        api_response = api_instance.list_activities_api_v1_content_activity_list_get(page=page, limit=limit, status=status)
        print("The response of ContentActivityApi->list_activities_api_v1_content_activity_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentActivityApi->list_activities_api_v1_content_activity_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **status** | **int**| 筛选状态: 0&#x3D;关闭 1&#x3D;开启 | [optional] 

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

