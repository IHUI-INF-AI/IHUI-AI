# zhs_api.UserVideoLogApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**record_watch_api_v1_user_video_log_record_post**](UserVideoLogApi.md#record_watch_api_v1_user_video_log_record_post) | **POST** /api/v1/user-video-log/record | 记录视频观看
[**record_watch_api_v1_user_video_log_record_post_0**](UserVideoLogApi.md#record_watch_api_v1_user_video_log_record_post_0) | **POST** /api/v1/user-video-log/record | 记录视频观看
[**stats_api_v1_user_video_log_stats_get**](UserVideoLogApi.md#stats_api_v1_user_video_log_stats_get) | **GET** /api/v1/user-video-log/stats | 观看统计
[**stats_api_v1_user_video_log_stats_get_0**](UserVideoLogApi.md#stats_api_v1_user_video_log_stats_get_0) | **GET** /api/v1/user-video-log/stats | 观看统计
[**user_video_log_list**](UserVideoLogApi.md#user_video_log_list) | **GET** /api/v1/user-video-log/list | 我的观看记录
[**user_video_log_list_0**](UserVideoLogApi.md#user_video_log_list_0) | **GET** /api/v1/user-video-log/list | 我的观看记录


# **record_watch_api_v1_user_video_log_record_post**
> object record_watch_api_v1_user_video_log_record_post(video_id, duration=duration, watched=watched, device=device, ip=ip, is_completed=is_completed, is_finished=is_finished, video_title=video_title)

记录视频观看

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
    api_instance = zhs_api.UserVideoLogApi(api_client)
    video_id = 56 # int | 
    duration = 0 # int |  (optional) (default to 0)
    watched = 0 # int |  (optional) (default to 0)
    device = 'device_example' # str |  (optional)
    ip = 'ip_example' # str |  (optional)
    is_completed = False # bool |  (optional) (default to False)
    is_finished = False # bool |  (optional) (default to False)
    video_title = 'video_title_example' # str |  (optional)

    try:
        # 记录视频观看
        api_response = api_instance.record_watch_api_v1_user_video_log_record_post(video_id, duration=duration, watched=watched, device=device, ip=ip, is_completed=is_completed, is_finished=is_finished, video_title=video_title)
        print("The response of UserVideoLogApi->record_watch_api_v1_user_video_log_record_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserVideoLogApi->record_watch_api_v1_user_video_log_record_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_id** | **int**|  | 
 **duration** | **int**|  | [optional] [default to 0]
 **watched** | **int**|  | [optional] [default to 0]
 **device** | **str**|  | [optional] 
 **ip** | **str**|  | [optional] 
 **is_completed** | **bool**|  | [optional] [default to False]
 **is_finished** | **bool**|  | [optional] [default to False]
 **video_title** | **str**|  | [optional] 

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

# **record_watch_api_v1_user_video_log_record_post_0**
> object record_watch_api_v1_user_video_log_record_post_0(video_id, duration=duration, watched=watched, device=device, ip=ip, is_completed=is_completed, is_finished=is_finished, video_title=video_title)

记录视频观看

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
    api_instance = zhs_api.UserVideoLogApi(api_client)
    video_id = 56 # int | 
    duration = 0 # int |  (optional) (default to 0)
    watched = 0 # int |  (optional) (default to 0)
    device = 'device_example' # str |  (optional)
    ip = 'ip_example' # str |  (optional)
    is_completed = False # bool |  (optional) (default to False)
    is_finished = False # bool |  (optional) (default to False)
    video_title = 'video_title_example' # str |  (optional)

    try:
        # 记录视频观看
        api_response = api_instance.record_watch_api_v1_user_video_log_record_post_0(video_id, duration=duration, watched=watched, device=device, ip=ip, is_completed=is_completed, is_finished=is_finished, video_title=video_title)
        print("The response of UserVideoLogApi->record_watch_api_v1_user_video_log_record_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserVideoLogApi->record_watch_api_v1_user_video_log_record_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_id** | **int**|  | 
 **duration** | **int**|  | [optional] [default to 0]
 **watched** | **int**|  | [optional] [default to 0]
 **device** | **str**|  | [optional] 
 **ip** | **str**|  | [optional] 
 **is_completed** | **bool**|  | [optional] [default to False]
 **is_finished** | **bool**|  | [optional] [default to False]
 **video_title** | **str**|  | [optional] 

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

# **stats_api_v1_user_video_log_stats_get**
> object stats_api_v1_user_video_log_stats_get()

观看统计

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
    api_instance = zhs_api.UserVideoLogApi(api_client)

    try:
        # 观看统计
        api_response = api_instance.stats_api_v1_user_video_log_stats_get()
        print("The response of UserVideoLogApi->stats_api_v1_user_video_log_stats_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserVideoLogApi->stats_api_v1_user_video_log_stats_get: %s\n" % e)
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

# **stats_api_v1_user_video_log_stats_get_0**
> object stats_api_v1_user_video_log_stats_get_0()

观看统计

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
    api_instance = zhs_api.UserVideoLogApi(api_client)

    try:
        # 观看统计
        api_response = api_instance.stats_api_v1_user_video_log_stats_get_0()
        print("The response of UserVideoLogApi->stats_api_v1_user_video_log_stats_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserVideoLogApi->stats_api_v1_user_video_log_stats_get_0: %s\n" % e)
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

# **user_video_log_list**
> object user_video_log_list(page=page, limit=limit, video_id=video_id, is_finished=is_finished)

我的观看记录

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
    api_instance = zhs_api.UserVideoLogApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    video_id = 56 # int |  (optional)
    is_finished = True # bool |  (optional)

    try:
        # 我的观看记录
        api_response = api_instance.user_video_log_list(page=page, limit=limit, video_id=video_id, is_finished=is_finished)
        print("The response of UserVideoLogApi->user_video_log_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserVideoLogApi->user_video_log_list: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **video_id** | **int**|  | [optional] 
 **is_finished** | **bool**|  | [optional] 

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

# **user_video_log_list_0**
> object user_video_log_list_0(page=page, limit=limit, video_id=video_id, is_finished=is_finished)

我的观看记录

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
    api_instance = zhs_api.UserVideoLogApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    video_id = 56 # int |  (optional)
    is_finished = True # bool |  (optional)

    try:
        # 我的观看记录
        api_response = api_instance.user_video_log_list_0(page=page, limit=limit, video_id=video_id, is_finished=is_finished)
        print("The response of UserVideoLogApi->user_video_log_list_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserVideoLogApi->user_video_log_list_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **video_id** | **int**|  | [optional] 
 **is_finished** | **bool**|  | [optional] 

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

