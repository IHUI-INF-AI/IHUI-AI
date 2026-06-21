# zhs_api.AIVideoTasksApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**get_video_task_api_v1_ai_task_id_get**](AIVideoTasksApi.md#get_video_task_api_v1_ai_task_id_get) | **GET** /api/v1/ai/{task_id} | 任务详情
[**list_video_tasks_api_v1_ai_list_get**](AIVideoTasksApi.md#list_video_tasks_api_v1_ai_list_get) | **GET** /api/v1/ai/list | 视频任务列表


# **get_video_task_api_v1_ai_task_id_get**
> object get_video_task_api_v1_ai_task_id_get(task_id)

任务详情

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
    api_instance = zhs_api.AIVideoTasksApi(api_client)
    task_id = 'task_id_example' # str | 

    try:
        # 任务详情
        api_response = api_instance.get_video_task_api_v1_ai_task_id_get(task_id)
        print("The response of AIVideoTasksApi->get_video_task_api_v1_ai_task_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIVideoTasksApi->get_video_task_api_v1_ai_task_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **task_id** | **str**|  | 

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

# **list_video_tasks_api_v1_ai_list_get**
> object list_video_tasks_api_v1_ai_list_get(page=page, limit=limit, status=status)

视频任务列表

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
    api_instance = zhs_api.AIVideoTasksApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    status = 'status_example' # str | 任务状态过滤: accepted / processing / completed / failed (optional)

    try:
        # 视频任务列表
        api_response = api_instance.list_video_tasks_api_v1_ai_list_get(page=page, limit=limit, status=status)
        print("The response of AIVideoTasksApi->list_video_tasks_api_v1_ai_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIVideoTasksApi->list_video_tasks_api_v1_ai_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **status** | **str**| 任务状态过滤: accepted / processing / completed / failed | [optional] 

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

