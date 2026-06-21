# zhs_api.VisitTrackingApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**log_list_api_v1_visit_log_list_get**](VisitTrackingApi.md#log_list_api_v1_visit_log_list_get) | **GET** /api/v1/visit/log/list | 访问日志
[**log_list_api_v1_visit_log_list_get_0**](VisitTrackingApi.md#log_list_api_v1_visit_log_list_get_0) | **GET** /api/v1/visit/log/list | 访问日志
[**page_stats_api_v1_visit_stats_page_get**](VisitTrackingApi.md#page_stats_api_v1_visit_stats_page_get) | **GET** /api/v1/visit/stats/page | 页面统计
[**page_stats_api_v1_visit_stats_page_get_0**](VisitTrackingApi.md#page_stats_api_v1_visit_stats_page_get_0) | **GET** /api/v1/visit/stats/page | 页面统计
[**record_page_api_v1_visit_page_record_post**](VisitTrackingApi.md#record_page_api_v1_visit_page_record_post) | **POST** /api/v1/visit/page/record | 记录页面访问
[**record_page_api_v1_visit_page_record_post_0**](VisitTrackingApi.md#record_page_api_v1_visit_page_record_post_0) | **POST** /api/v1/visit/page/record | 记录页面访问
[**record_source_api_v1_visit_source_record_post**](VisitTrackingApi.md#record_source_api_v1_visit_source_record_post) | **POST** /api/v1/visit/source/record | 记录来源
[**record_source_api_v1_visit_source_record_post_0**](VisitTrackingApi.md#record_source_api_v1_visit_source_record_post_0) | **POST** /api/v1/visit/source/record | 记录来源
[**source_stats_api_v1_visit_stats_source_get**](VisitTrackingApi.md#source_stats_api_v1_visit_stats_source_get) | **GET** /api/v1/visit/stats/source | 来源统计
[**source_stats_api_v1_visit_stats_source_get_0**](VisitTrackingApi.md#source_stats_api_v1_visit_stats_source_get_0) | **GET** /api/v1/visit/stats/source | 来源统计
[**today_stats_api_v1_visit_stats_today_get**](VisitTrackingApi.md#today_stats_api_v1_visit_stats_today_get) | **GET** /api/v1/visit/stats/today | 今日实时统计
[**today_stats_api_v1_visit_stats_today_get_0**](VisitTrackingApi.md#today_stats_api_v1_visit_stats_today_get_0) | **GET** /api/v1/visit/stats/today | 今日实时统计
[**track_api_v1_visit_track_post**](VisitTrackingApi.md#track_api_v1_visit_track_post) | **POST** /api/v1/visit/track | 记录访问
[**track_api_v1_visit_track_post_0**](VisitTrackingApi.md#track_api_v1_visit_track_post_0) | **POST** /api/v1/visit/track | 记录访问
[**visit_daily_stats**](VisitTrackingApi.md#visit_daily_stats) | **GET** /api/v1/visit/stats/daily | 每日访问统计
[**visit_daily_stats_0**](VisitTrackingApi.md#visit_daily_stats_0) | **GET** /api/v1/visit/stats/daily | 每日访问统计


# **log_list_api_v1_visit_log_list_get**
> object log_list_api_v1_visit_log_list_get(page=page, limit=limit, user_id=user_id, path=path, target_type=target_type, start_date=start_date, end_date=end_date)

访问日志

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
    api_instance = zhs_api.VisitTrackingApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    user_id = 'user_id_example' # str |  (optional)
    path = 'path_example' # str |  (optional)
    target_type = 'target_type_example' # str |  (optional)
    start_date = 'start_date_example' # str |  (optional)
    end_date = 'end_date_example' # str |  (optional)

    try:
        # 访问日志
        api_response = api_instance.log_list_api_v1_visit_log_list_get(page=page, limit=limit, user_id=user_id, path=path, target_type=target_type, start_date=start_date, end_date=end_date)
        print("The response of VisitTrackingApi->log_list_api_v1_visit_log_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VisitTrackingApi->log_list_api_v1_visit_log_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **user_id** | **str**|  | [optional] 
 **path** | **str**|  | [optional] 
 **target_type** | **str**|  | [optional] 
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

# **log_list_api_v1_visit_log_list_get_0**
> object log_list_api_v1_visit_log_list_get_0(page=page, limit=limit, user_id=user_id, path=path, target_type=target_type, start_date=start_date, end_date=end_date)

访问日志

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
    api_instance = zhs_api.VisitTrackingApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    user_id = 'user_id_example' # str |  (optional)
    path = 'path_example' # str |  (optional)
    target_type = 'target_type_example' # str |  (optional)
    start_date = 'start_date_example' # str |  (optional)
    end_date = 'end_date_example' # str |  (optional)

    try:
        # 访问日志
        api_response = api_instance.log_list_api_v1_visit_log_list_get_0(page=page, limit=limit, user_id=user_id, path=path, target_type=target_type, start_date=start_date, end_date=end_date)
        print("The response of VisitTrackingApi->log_list_api_v1_visit_log_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VisitTrackingApi->log_list_api_v1_visit_log_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **user_id** | **str**|  | [optional] 
 **path** | **str**|  | [optional] 
 **target_type** | **str**|  | [optional] 
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

# **page_stats_api_v1_visit_stats_page_get**
> object page_stats_api_v1_visit_stats_page_get(start_date=start_date, end_date=end_date, limit=limit)

页面统计

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
    api_instance = zhs_api.VisitTrackingApi(api_client)
    start_date = 'start_date_example' # str |  (optional)
    end_date = 'end_date_example' # str |  (optional)
    limit = 50 # int |  (optional) (default to 50)

    try:
        # 页面统计
        api_response = api_instance.page_stats_api_v1_visit_stats_page_get(start_date=start_date, end_date=end_date, limit=limit)
        print("The response of VisitTrackingApi->page_stats_api_v1_visit_stats_page_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VisitTrackingApi->page_stats_api_v1_visit_stats_page_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **start_date** | **str**|  | [optional] 
 **end_date** | **str**|  | [optional] 
 **limit** | **int**|  | [optional] [default to 50]

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

# **page_stats_api_v1_visit_stats_page_get_0**
> object page_stats_api_v1_visit_stats_page_get_0(start_date=start_date, end_date=end_date, limit=limit)

页面统计

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
    api_instance = zhs_api.VisitTrackingApi(api_client)
    start_date = 'start_date_example' # str |  (optional)
    end_date = 'end_date_example' # str |  (optional)
    limit = 50 # int |  (optional) (default to 50)

    try:
        # 页面统计
        api_response = api_instance.page_stats_api_v1_visit_stats_page_get_0(start_date=start_date, end_date=end_date, limit=limit)
        print("The response of VisitTrackingApi->page_stats_api_v1_visit_stats_page_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VisitTrackingApi->page_stats_api_v1_visit_stats_page_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **start_date** | **str**|  | [optional] 
 **end_date** | **str**|  | [optional] 
 **limit** | **int**|  | [optional] [default to 50]

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

# **record_page_api_v1_visit_page_record_post**
> object record_page_api_v1_visit_page_record_post(path, stat_date=stat_date, duration=duration)

记录页面访问

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
    api_instance = zhs_api.VisitTrackingApi(api_client)
    path = 'path_example' # str | 
    stat_date = 'stat_date_example' # str |  (optional)
    duration = 0 # int |  (optional) (default to 0)

    try:
        # 记录页面访问
        api_response = api_instance.record_page_api_v1_visit_page_record_post(path, stat_date=stat_date, duration=duration)
        print("The response of VisitTrackingApi->record_page_api_v1_visit_page_record_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VisitTrackingApi->record_page_api_v1_visit_page_record_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **path** | **str**|  | 
 **stat_date** | **str**|  | [optional] 
 **duration** | **int**|  | [optional] [default to 0]

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

# **record_page_api_v1_visit_page_record_post_0**
> object record_page_api_v1_visit_page_record_post_0(path, stat_date=stat_date, duration=duration)

记录页面访问

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
    api_instance = zhs_api.VisitTrackingApi(api_client)
    path = 'path_example' # str | 
    stat_date = 'stat_date_example' # str |  (optional)
    duration = 0 # int |  (optional) (default to 0)

    try:
        # 记录页面访问
        api_response = api_instance.record_page_api_v1_visit_page_record_post_0(path, stat_date=stat_date, duration=duration)
        print("The response of VisitTrackingApi->record_page_api_v1_visit_page_record_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VisitTrackingApi->record_page_api_v1_visit_page_record_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **path** | **str**|  | 
 **stat_date** | **str**|  | [optional] 
 **duration** | **int**|  | [optional] [default to 0]

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

# **record_source_api_v1_visit_source_record_post**
> object record_source_api_v1_visit_source_record_post(source, stat_date=stat_date)

记录来源

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
    api_instance = zhs_api.VisitTrackingApi(api_client)
    source = 'source_example' # str | 
    stat_date = 'stat_date_example' # str |  (optional)

    try:
        # 记录来源
        api_response = api_instance.record_source_api_v1_visit_source_record_post(source, stat_date=stat_date)
        print("The response of VisitTrackingApi->record_source_api_v1_visit_source_record_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VisitTrackingApi->record_source_api_v1_visit_source_record_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **source** | **str**|  | 
 **stat_date** | **str**|  | [optional] 

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

# **record_source_api_v1_visit_source_record_post_0**
> object record_source_api_v1_visit_source_record_post_0(source, stat_date=stat_date)

记录来源

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
    api_instance = zhs_api.VisitTrackingApi(api_client)
    source = 'source_example' # str | 
    stat_date = 'stat_date_example' # str |  (optional)

    try:
        # 记录来源
        api_response = api_instance.record_source_api_v1_visit_source_record_post_0(source, stat_date=stat_date)
        print("The response of VisitTrackingApi->record_source_api_v1_visit_source_record_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VisitTrackingApi->record_source_api_v1_visit_source_record_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **source** | **str**|  | 
 **stat_date** | **str**|  | [optional] 

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

# **source_stats_api_v1_visit_stats_source_get**
> object source_stats_api_v1_visit_stats_source_get(start_date=start_date, end_date=end_date)

来源统计

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
    api_instance = zhs_api.VisitTrackingApi(api_client)
    start_date = 'start_date_example' # str |  (optional)
    end_date = 'end_date_example' # str |  (optional)

    try:
        # 来源统计
        api_response = api_instance.source_stats_api_v1_visit_stats_source_get(start_date=start_date, end_date=end_date)
        print("The response of VisitTrackingApi->source_stats_api_v1_visit_stats_source_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VisitTrackingApi->source_stats_api_v1_visit_stats_source_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
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

# **source_stats_api_v1_visit_stats_source_get_0**
> object source_stats_api_v1_visit_stats_source_get_0(start_date=start_date, end_date=end_date)

来源统计

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
    api_instance = zhs_api.VisitTrackingApi(api_client)
    start_date = 'start_date_example' # str |  (optional)
    end_date = 'end_date_example' # str |  (optional)

    try:
        # 来源统计
        api_response = api_instance.source_stats_api_v1_visit_stats_source_get_0(start_date=start_date, end_date=end_date)
        print("The response of VisitTrackingApi->source_stats_api_v1_visit_stats_source_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VisitTrackingApi->source_stats_api_v1_visit_stats_source_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
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

# **today_stats_api_v1_visit_stats_today_get**
> object today_stats_api_v1_visit_stats_today_get()

今日实时统计

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
    api_instance = zhs_api.VisitTrackingApi(api_client)

    try:
        # 今日实时统计
        api_response = api_instance.today_stats_api_v1_visit_stats_today_get()
        print("The response of VisitTrackingApi->today_stats_api_v1_visit_stats_today_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VisitTrackingApi->today_stats_api_v1_visit_stats_today_get: %s\n" % e)
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

# **today_stats_api_v1_visit_stats_today_get_0**
> object today_stats_api_v1_visit_stats_today_get_0()

今日实时统计

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
    api_instance = zhs_api.VisitTrackingApi(api_client)

    try:
        # 今日实时统计
        api_response = api_instance.today_stats_api_v1_visit_stats_today_get_0()
        print("The response of VisitTrackingApi->today_stats_api_v1_visit_stats_today_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VisitTrackingApi->today_stats_api_v1_visit_stats_today_get_0: %s\n" % e)
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

# **track_api_v1_visit_track_post**
> object track_api_v1_visit_track_post(path, method=method, var_query_params=var_query_params, referer=referer, user_agent=user_agent, ip=ip, device=device, os=os, browser=browser, target_type=target_type, target_id=target_id, duration=duration, source=source, session_id=session_id, user_id=user_id)

记录访问

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
    api_instance = zhs_api.VisitTrackingApi(api_client)
    path = 'path_example' # str | 
    method = 'method_example' # str |  (optional)
    var_query_params = 'var_query_params_example' # str |  (optional)
    referer = 'referer_example' # str |  (optional)
    user_agent = 'user_agent_example' # str |  (optional)
    ip = 'ip_example' # str |  (optional)
    device = 'device_example' # str |  (optional)
    os = 'os_example' # str |  (optional)
    browser = 'browser_example' # str |  (optional)
    target_type = 'target_type_example' # str |  (optional)
    target_id = 'target_id_example' # str |  (optional)
    duration = 0 # int |  (optional) (default to 0)
    source = 'source_example' # str |  (optional)
    session_id = 'session_id_example' # str |  (optional)
    user_id = 'user_id_example' # str |  (optional)

    try:
        # 记录访问
        api_response = api_instance.track_api_v1_visit_track_post(path, method=method, var_query_params=var_query_params, referer=referer, user_agent=user_agent, ip=ip, device=device, os=os, browser=browser, target_type=target_type, target_id=target_id, duration=duration, source=source, session_id=session_id, user_id=user_id)
        print("The response of VisitTrackingApi->track_api_v1_visit_track_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VisitTrackingApi->track_api_v1_visit_track_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **path** | **str**|  | 
 **method** | **str**|  | [optional] 
 **var_query_params** | **str**|  | [optional] 
 **referer** | **str**|  | [optional] 
 **user_agent** | **str**|  | [optional] 
 **ip** | **str**|  | [optional] 
 **device** | **str**|  | [optional] 
 **os** | **str**|  | [optional] 
 **browser** | **str**|  | [optional] 
 **target_type** | **str**|  | [optional] 
 **target_id** | **str**|  | [optional] 
 **duration** | **int**|  | [optional] [default to 0]
 **source** | **str**|  | [optional] 
 **session_id** | **str**|  | [optional] 
 **user_id** | **str**|  | [optional] 

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

# **track_api_v1_visit_track_post_0**
> object track_api_v1_visit_track_post_0(path, method=method, var_query_params=var_query_params, referer=referer, user_agent=user_agent, ip=ip, device=device, os=os, browser=browser, target_type=target_type, target_id=target_id, duration=duration, source=source, session_id=session_id, user_id=user_id)

记录访问

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
    api_instance = zhs_api.VisitTrackingApi(api_client)
    path = 'path_example' # str | 
    method = 'method_example' # str |  (optional)
    var_query_params = 'var_query_params_example' # str |  (optional)
    referer = 'referer_example' # str |  (optional)
    user_agent = 'user_agent_example' # str |  (optional)
    ip = 'ip_example' # str |  (optional)
    device = 'device_example' # str |  (optional)
    os = 'os_example' # str |  (optional)
    browser = 'browser_example' # str |  (optional)
    target_type = 'target_type_example' # str |  (optional)
    target_id = 'target_id_example' # str |  (optional)
    duration = 0 # int |  (optional) (default to 0)
    source = 'source_example' # str |  (optional)
    session_id = 'session_id_example' # str |  (optional)
    user_id = 'user_id_example' # str |  (optional)

    try:
        # 记录访问
        api_response = api_instance.track_api_v1_visit_track_post_0(path, method=method, var_query_params=var_query_params, referer=referer, user_agent=user_agent, ip=ip, device=device, os=os, browser=browser, target_type=target_type, target_id=target_id, duration=duration, source=source, session_id=session_id, user_id=user_id)
        print("The response of VisitTrackingApi->track_api_v1_visit_track_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VisitTrackingApi->track_api_v1_visit_track_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **path** | **str**|  | 
 **method** | **str**|  | [optional] 
 **var_query_params** | **str**|  | [optional] 
 **referer** | **str**|  | [optional] 
 **user_agent** | **str**|  | [optional] 
 **ip** | **str**|  | [optional] 
 **device** | **str**|  | [optional] 
 **os** | **str**|  | [optional] 
 **browser** | **str**|  | [optional] 
 **target_type** | **str**|  | [optional] 
 **target_id** | **str**|  | [optional] 
 **duration** | **int**|  | [optional] [default to 0]
 **source** | **str**|  | [optional] 
 **session_id** | **str**|  | [optional] 
 **user_id** | **str**|  | [optional] 

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

# **visit_daily_stats**
> object visit_daily_stats(start_date=start_date, end_date=end_date, target_type=target_type)

每日访问统计

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
    api_instance = zhs_api.VisitTrackingApi(api_client)
    start_date = 'start_date_example' # str |  (optional)
    end_date = 'end_date_example' # str |  (optional)
    target_type = 'target_type_example' # str |  (optional)

    try:
        # 每日访问统计
        api_response = api_instance.visit_daily_stats(start_date=start_date, end_date=end_date, target_type=target_type)
        print("The response of VisitTrackingApi->visit_daily_stats:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VisitTrackingApi->visit_daily_stats: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **start_date** | **str**|  | [optional] 
 **end_date** | **str**|  | [optional] 
 **target_type** | **str**|  | [optional] 

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

# **visit_daily_stats_0**
> object visit_daily_stats_0(start_date=start_date, end_date=end_date, target_type=target_type)

每日访问统计

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
    api_instance = zhs_api.VisitTrackingApi(api_client)
    start_date = 'start_date_example' # str |  (optional)
    end_date = 'end_date_example' # str |  (optional)
    target_type = 'target_type_example' # str |  (optional)

    try:
        # 每日访问统计
        api_response = api_instance.visit_daily_stats_0(start_date=start_date, end_date=end_date, target_type=target_type)
        print("The response of VisitTrackingApi->visit_daily_stats_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling VisitTrackingApi->visit_daily_stats_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **start_date** | **str**|  | [optional] 
 **end_date** | **str**|  | [optional] 
 **target_type** | **str**|  | [optional] 

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

