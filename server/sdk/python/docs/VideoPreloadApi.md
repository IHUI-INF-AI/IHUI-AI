# zhs_api.VideoPreloadApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_preload_api_v1_video_preload_post**](VideoPreloadApi.md#create_preload_api_v1_video_preload_post) | **POST** /api/v1/video-preload | 创建预读任务
[**create_preload_api_v1_video_preload_post_0**](VideoPreloadApi.md#create_preload_api_v1_video_preload_post_0) | **POST** /api/v1/video-preload | 创建预读任务
[**delete_preload_api_v1_video_preload_pid_delete**](VideoPreloadApi.md#delete_preload_api_v1_video_preload_pid_delete) | **DELETE** /api/v1/video-preload/{pid} | 删除预读任务
[**delete_preload_api_v1_video_preload_pid_delete_0**](VideoPreloadApi.md#delete_preload_api_v1_video_preload_pid_delete_0) | **DELETE** /api/v1/video-preload/{pid} | 删除预读任务
[**list_preloads_api_v1_video_preload_list_get**](VideoPreloadApi.md#list_preloads_api_v1_video_preload_list_get) | **GET** /api/v1/video-preload/list | 我的预读任务
[**list_preloads_api_v1_video_preload_list_get_0**](VideoPreloadApi.md#list_preloads_api_v1_video_preload_list_get_0) | **GET** /api/v1/video-preload/list | 我的预读任务
[**mark_complete_api_v1_video_preload_pid_complete_put**](VideoPreloadApi.md#mark_complete_api_v1_video_preload_pid_complete_put) | **PUT** /api/v1/video-preload/{pid}/complete | 标记完成
[**mark_complete_api_v1_video_preload_pid_complete_put_0**](VideoPreloadApi.md#mark_complete_api_v1_video_preload_pid_complete_put_0) | **PUT** /api/v1/video-preload/{pid}/complete | 标记完成


# **create_preload_api_v1_video_preload_post**
> object create_preload_api_v1_video_preload_post(video_id, start_time=start_time, end_time=end_time, is_chunked=is_chunked, video_url=video_url)

创建预读任务

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
    api_instance = zhs_api.VideoPreloadApi(api_client)
    video_id = 56 # int | 
    start_time = 0 # int |  (optional) (default to 0)
    end_time = 0 # int |  (optional) (default to 0)
    is_chunked = True # bool |  (optional) (default to True)
    video_url = 'video_url_example' # str |  (optional)

    try:
        # 创建预读任务
        api_response = api_instance.create_preload_api_v1_video_preload_post(video_id, start_time=start_time, end_time=end_time, is_chunked=is_chunked, video_url=video_url)
        print("The response of VideoPreloadApi->create_preload_api_v1_video_preload_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VideoPreloadApi->create_preload_api_v1_video_preload_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_id** | **int**|  | 
 **start_time** | **int**|  | [optional] [default to 0]
 **end_time** | **int**|  | [optional] [default to 0]
 **is_chunked** | **bool**|  | [optional] [default to True]
 **video_url** | **str**|  | [optional] 

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

# **create_preload_api_v1_video_preload_post_0**
> object create_preload_api_v1_video_preload_post_0(video_id, start_time=start_time, end_time=end_time, is_chunked=is_chunked, video_url=video_url)

创建预读任务

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
    api_instance = zhs_api.VideoPreloadApi(api_client)
    video_id = 56 # int | 
    start_time = 0 # int |  (optional) (default to 0)
    end_time = 0 # int |  (optional) (default to 0)
    is_chunked = True # bool |  (optional) (default to True)
    video_url = 'video_url_example' # str |  (optional)

    try:
        # 创建预读任务
        api_response = api_instance.create_preload_api_v1_video_preload_post_0(video_id, start_time=start_time, end_time=end_time, is_chunked=is_chunked, video_url=video_url)
        print("The response of VideoPreloadApi->create_preload_api_v1_video_preload_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VideoPreloadApi->create_preload_api_v1_video_preload_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_id** | **int**|  | 
 **start_time** | **int**|  | [optional] [default to 0]
 **end_time** | **int**|  | [optional] [default to 0]
 **is_chunked** | **bool**|  | [optional] [default to True]
 **video_url** | **str**|  | [optional] 

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

# **delete_preload_api_v1_video_preload_pid_delete**
> object delete_preload_api_v1_video_preload_pid_delete(pid)

删除预读任务

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
    api_instance = zhs_api.VideoPreloadApi(api_client)
    pid = 56 # int | 

    try:
        # 删除预读任务
        api_response = api_instance.delete_preload_api_v1_video_preload_pid_delete(pid)
        print("The response of VideoPreloadApi->delete_preload_api_v1_video_preload_pid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VideoPreloadApi->delete_preload_api_v1_video_preload_pid_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pid** | **int**|  | 

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

# **delete_preload_api_v1_video_preload_pid_delete_0**
> object delete_preload_api_v1_video_preload_pid_delete_0(pid)

删除预读任务

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
    api_instance = zhs_api.VideoPreloadApi(api_client)
    pid = 56 # int | 

    try:
        # 删除预读任务
        api_response = api_instance.delete_preload_api_v1_video_preload_pid_delete_0(pid)
        print("The response of VideoPreloadApi->delete_preload_api_v1_video_preload_pid_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VideoPreloadApi->delete_preload_api_v1_video_preload_pid_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pid** | **int**|  | 

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

# **list_preloads_api_v1_video_preload_list_get**
> object list_preloads_api_v1_video_preload_list_get(page=page, limit=limit, video_id=video_id)

我的预读任务

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
    api_instance = zhs_api.VideoPreloadApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    video_id = 56 # int |  (optional)

    try:
        # 我的预读任务
        api_response = api_instance.list_preloads_api_v1_video_preload_list_get(page=page, limit=limit, video_id=video_id)
        print("The response of VideoPreloadApi->list_preloads_api_v1_video_preload_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VideoPreloadApi->list_preloads_api_v1_video_preload_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **video_id** | **int**|  | [optional] 

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

# **list_preloads_api_v1_video_preload_list_get_0**
> object list_preloads_api_v1_video_preload_list_get_0(page=page, limit=limit, video_id=video_id)

我的预读任务

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
    api_instance = zhs_api.VideoPreloadApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    video_id = 56 # int |  (optional)

    try:
        # 我的预读任务
        api_response = api_instance.list_preloads_api_v1_video_preload_list_get_0(page=page, limit=limit, video_id=video_id)
        print("The response of VideoPreloadApi->list_preloads_api_v1_video_preload_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VideoPreloadApi->list_preloads_api_v1_video_preload_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **video_id** | **int**|  | [optional] 

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

# **mark_complete_api_v1_video_preload_pid_complete_put**
> object mark_complete_api_v1_video_preload_pid_complete_put(pid)

标记完成

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
    api_instance = zhs_api.VideoPreloadApi(api_client)
    pid = 56 # int | 

    try:
        # 标记完成
        api_response = api_instance.mark_complete_api_v1_video_preload_pid_complete_put(pid)
        print("The response of VideoPreloadApi->mark_complete_api_v1_video_preload_pid_complete_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VideoPreloadApi->mark_complete_api_v1_video_preload_pid_complete_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pid** | **int**|  | 

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

# **mark_complete_api_v1_video_preload_pid_complete_put_0**
> object mark_complete_api_v1_video_preload_pid_complete_put_0(pid)

标记完成

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
    api_instance = zhs_api.VideoPreloadApi(api_client)
    pid = 56 # int | 

    try:
        # 标记完成
        api_response = api_instance.mark_complete_api_v1_video_preload_pid_complete_put_0(pid)
        print("The response of VideoPreloadApi->mark_complete_api_v1_video_preload_pid_complete_put_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VideoPreloadApi->mark_complete_api_v1_video_preload_pid_complete_put_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pid** | **int**|  | 

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

