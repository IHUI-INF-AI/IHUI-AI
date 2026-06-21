# zhs_api.ScheduleApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_schedule_api_v1_schedule_post**](ScheduleApi.md#create_schedule_api_v1_schedule_post) | **POST** /api/v1/schedule | 创建日程
[**create_schedule_api_v1_schedule_post_0**](ScheduleApi.md#create_schedule_api_v1_schedule_post_0) | **POST** /api/v1/schedule | 创建日程
[**delete_schedule_api_v1_schedule_sid_delete**](ScheduleApi.md#delete_schedule_api_v1_schedule_sid_delete) | **DELETE** /api/v1/schedule/{sid} | 删除日程
[**delete_schedule_api_v1_schedule_sid_delete_0**](ScheduleApi.md#delete_schedule_api_v1_schedule_sid_delete_0) | **DELETE** /api/v1/schedule/{sid} | 删除日程
[**list_schedules_api_v1_schedule_list_get**](ScheduleApi.md#list_schedules_api_v1_schedule_list_get) | **GET** /api/v1/schedule/list | 我的日程
[**list_schedules_api_v1_schedule_list_get_0**](ScheduleApi.md#list_schedules_api_v1_schedule_list_get_0) | **GET** /api/v1/schedule/list | 我的日程
[**update_schedule_api_v1_schedule_sid_put**](ScheduleApi.md#update_schedule_api_v1_schedule_sid_put) | **PUT** /api/v1/schedule/{sid} | 修改日程
[**update_schedule_api_v1_schedule_sid_put_0**](ScheduleApi.md#update_schedule_api_v1_schedule_sid_put_0) | **PUT** /api/v1/schedule/{sid} | 修改日程


# **create_schedule_api_v1_schedule_post**
> object create_schedule_api_v1_schedule_post(title, start_time, description=description, end_time=end_time, all_day=all_day, type=type, color=color, remind_before=remind_before, location=location, ref_id=ref_id, ref_type=ref_type)

创建日程

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
    api_instance = zhs_api.ScheduleApi(api_client)
    title = 'title_example' # str | 
    start_time = '2013-10-20T19:20:30+01:00' # datetime | 
    description = 'description_example' # str |  (optional)
    end_time = '2013-10-20T19:20:30+01:00' # datetime |  (optional)
    all_day = False # bool |  (optional) (default to False)
    type = 'personal' # str |  (optional) (default to 'personal')
    color = 'color_example' # str |  (optional)
    remind_before = 0 # int |  (optional) (default to 0)
    location = 'location_example' # str |  (optional)
    ref_id = 'ref_id_example' # str |  (optional)
    ref_type = 'ref_type_example' # str |  (optional)

    try:
        # 创建日程
        api_response = api_instance.create_schedule_api_v1_schedule_post(title, start_time, description=description, end_time=end_time, all_day=all_day, type=type, color=color, remind_before=remind_before, location=location, ref_id=ref_id, ref_type=ref_type)
        print("The response of ScheduleApi->create_schedule_api_v1_schedule_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ScheduleApi->create_schedule_api_v1_schedule_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**|  | 
 **start_time** | **datetime**|  | 
 **description** | **str**|  | [optional] 
 **end_time** | **datetime**|  | [optional] 
 **all_day** | **bool**|  | [optional] [default to False]
 **type** | **str**|  | [optional] [default to &#39;personal&#39;]
 **color** | **str**|  | [optional] 
 **remind_before** | **int**|  | [optional] [default to 0]
 **location** | **str**|  | [optional] 
 **ref_id** | **str**|  | [optional] 
 **ref_type** | **str**|  | [optional] 

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

# **create_schedule_api_v1_schedule_post_0**
> object create_schedule_api_v1_schedule_post_0(title, start_time, description=description, end_time=end_time, all_day=all_day, type=type, color=color, remind_before=remind_before, location=location, ref_id=ref_id, ref_type=ref_type)

创建日程

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
    api_instance = zhs_api.ScheduleApi(api_client)
    title = 'title_example' # str | 
    start_time = '2013-10-20T19:20:30+01:00' # datetime | 
    description = 'description_example' # str |  (optional)
    end_time = '2013-10-20T19:20:30+01:00' # datetime |  (optional)
    all_day = False # bool |  (optional) (default to False)
    type = 'personal' # str |  (optional) (default to 'personal')
    color = 'color_example' # str |  (optional)
    remind_before = 0 # int |  (optional) (default to 0)
    location = 'location_example' # str |  (optional)
    ref_id = 'ref_id_example' # str |  (optional)
    ref_type = 'ref_type_example' # str |  (optional)

    try:
        # 创建日程
        api_response = api_instance.create_schedule_api_v1_schedule_post_0(title, start_time, description=description, end_time=end_time, all_day=all_day, type=type, color=color, remind_before=remind_before, location=location, ref_id=ref_id, ref_type=ref_type)
        print("The response of ScheduleApi->create_schedule_api_v1_schedule_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ScheduleApi->create_schedule_api_v1_schedule_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**|  | 
 **start_time** | **datetime**|  | 
 **description** | **str**|  | [optional] 
 **end_time** | **datetime**|  | [optional] 
 **all_day** | **bool**|  | [optional] [default to False]
 **type** | **str**|  | [optional] [default to &#39;personal&#39;]
 **color** | **str**|  | [optional] 
 **remind_before** | **int**|  | [optional] [default to 0]
 **location** | **str**|  | [optional] 
 **ref_id** | **str**|  | [optional] 
 **ref_type** | **str**|  | [optional] 

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

# **delete_schedule_api_v1_schedule_sid_delete**
> object delete_schedule_api_v1_schedule_sid_delete(sid)

删除日程

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
    api_instance = zhs_api.ScheduleApi(api_client)
    sid = 56 # int | 

    try:
        # 删除日程
        api_response = api_instance.delete_schedule_api_v1_schedule_sid_delete(sid)
        print("The response of ScheduleApi->delete_schedule_api_v1_schedule_sid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ScheduleApi->delete_schedule_api_v1_schedule_sid_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sid** | **int**|  | 

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

# **delete_schedule_api_v1_schedule_sid_delete_0**
> object delete_schedule_api_v1_schedule_sid_delete_0(sid)

删除日程

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
    api_instance = zhs_api.ScheduleApi(api_client)
    sid = 56 # int | 

    try:
        # 删除日程
        api_response = api_instance.delete_schedule_api_v1_schedule_sid_delete_0(sid)
        print("The response of ScheduleApi->delete_schedule_api_v1_schedule_sid_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ScheduleApi->delete_schedule_api_v1_schedule_sid_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sid** | **int**|  | 

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

# **list_schedules_api_v1_schedule_list_get**
> object list_schedules_api_v1_schedule_list_get(page=page, limit=limit, type=type, start_date=start_date, end_date=end_date)

我的日程

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
    api_instance = zhs_api.ScheduleApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    type = 'type_example' # str |  (optional)
    start_date = 'start_date_example' # str |  (optional)
    end_date = 'end_date_example' # str |  (optional)

    try:
        # 我的日程
        api_response = api_instance.list_schedules_api_v1_schedule_list_get(page=page, limit=limit, type=type, start_date=start_date, end_date=end_date)
        print("The response of ScheduleApi->list_schedules_api_v1_schedule_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ScheduleApi->list_schedules_api_v1_schedule_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **type** | **str**|  | [optional] 
 **start_date** | **str**|  | [optional] 
 **end_date** | **str**|  | [optional] 

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

# **list_schedules_api_v1_schedule_list_get_0**
> object list_schedules_api_v1_schedule_list_get_0(page=page, limit=limit, type=type, start_date=start_date, end_date=end_date)

我的日程

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
    api_instance = zhs_api.ScheduleApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    type = 'type_example' # str |  (optional)
    start_date = 'start_date_example' # str |  (optional)
    end_date = 'end_date_example' # str |  (optional)

    try:
        # 我的日程
        api_response = api_instance.list_schedules_api_v1_schedule_list_get_0(page=page, limit=limit, type=type, start_date=start_date, end_date=end_date)
        print("The response of ScheduleApi->list_schedules_api_v1_schedule_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ScheduleApi->list_schedules_api_v1_schedule_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **type** | **str**|  | [optional] 
 **start_date** | **str**|  | [optional] 
 **end_date** | **str**|  | [optional] 

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

# **update_schedule_api_v1_schedule_sid_put**
> object update_schedule_api_v1_schedule_sid_put(sid, title=title, description=description, start_time=start_time, end_time=end_time, status=status, color=color)

修改日程

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
    api_instance = zhs_api.ScheduleApi(api_client)
    sid = 56 # int | 
    title = 'title_example' # str |  (optional)
    description = 'description_example' # str |  (optional)
    start_time = '2013-10-20T19:20:30+01:00' # datetime |  (optional)
    end_time = '2013-10-20T19:20:30+01:00' # datetime |  (optional)
    status = 56 # int |  (optional)
    color = 'color_example' # str |  (optional)

    try:
        # 修改日程
        api_response = api_instance.update_schedule_api_v1_schedule_sid_put(sid, title=title, description=description, start_time=start_time, end_time=end_time, status=status, color=color)
        print("The response of ScheduleApi->update_schedule_api_v1_schedule_sid_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ScheduleApi->update_schedule_api_v1_schedule_sid_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sid** | **int**|  | 
 **title** | **str**|  | [optional] 
 **description** | **str**|  | [optional] 
 **start_time** | **datetime**|  | [optional] 
 **end_time** | **datetime**|  | [optional] 
 **status** | **int**|  | [optional] 
 **color** | **str**|  | [optional] 

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

# **update_schedule_api_v1_schedule_sid_put_0**
> object update_schedule_api_v1_schedule_sid_put_0(sid, title=title, description=description, start_time=start_time, end_time=end_time, status=status, color=color)

修改日程

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
    api_instance = zhs_api.ScheduleApi(api_client)
    sid = 56 # int | 
    title = 'title_example' # str |  (optional)
    description = 'description_example' # str |  (optional)
    start_time = '2013-10-20T19:20:30+01:00' # datetime |  (optional)
    end_time = '2013-10-20T19:20:30+01:00' # datetime |  (optional)
    status = 56 # int |  (optional)
    color = 'color_example' # str |  (optional)

    try:
        # 修改日程
        api_response = api_instance.update_schedule_api_v1_schedule_sid_put_0(sid, title=title, description=description, start_time=start_time, end_time=end_time, status=status, color=color)
        print("The response of ScheduleApi->update_schedule_api_v1_schedule_sid_put_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ScheduleApi->update_schedule_api_v1_schedule_sid_put_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sid** | **int**|  | 
 **title** | **str**|  | [optional] 
 **description** | **str**|  | [optional] 
 **start_time** | **datetime**|  | [optional] 
 **end_time** | **datetime**|  | [optional] 
 **status** | **int**|  | [optional] 
 **color** | **str**|  | [optional] 

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

