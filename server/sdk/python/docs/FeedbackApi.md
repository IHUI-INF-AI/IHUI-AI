# zhs_api.FeedbackApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**delete_feedback_api_v1_feedback_fid_delete**](FeedbackApi.md#delete_feedback_api_v1_feedback_fid_delete) | **DELETE** /api/v1/feedback/{fid} | 删除反馈
[**delete_feedback_api_v1_feedback_fid_delete_0**](FeedbackApi.md#delete_feedback_api_v1_feedback_fid_delete_0) | **DELETE** /api/v1/feedback/{fid} | 删除反馈
[**feedback_admin_list**](FeedbackApi.md#feedback_admin_list) | **GET** /api/v1/feedback/admin/list | 反馈列表(管理员)
[**feedback_admin_list_0**](FeedbackApi.md#feedback_admin_list_0) | **GET** /api/v1/feedback/admin/list | 反馈列表(管理员)
[**get_feedback_api_v1_feedback_fid_get**](FeedbackApi.md#get_feedback_api_v1_feedback_fid_get) | **GET** /api/v1/feedback/{fid} | 反馈详情
[**get_feedback_api_v1_feedback_fid_get_0**](FeedbackApi.md#get_feedback_api_v1_feedback_fid_get_0) | **GET** /api/v1/feedback/{fid} | 反馈详情
[**handle_feedback_api_v1_feedback_fid_handle_put**](FeedbackApi.md#handle_feedback_api_v1_feedback_fid_handle_put) | **PUT** /api/v1/feedback/{fid}/handle | 处理反馈
[**handle_feedback_api_v1_feedback_fid_handle_put_0**](FeedbackApi.md#handle_feedback_api_v1_feedback_fid_handle_put_0) | **PUT** /api/v1/feedback/{fid}/handle | 处理反馈
[**list_my_feedbacks_api_v1_feedback_list_get**](FeedbackApi.md#list_my_feedbacks_api_v1_feedback_list_get) | **GET** /api/v1/feedback/list | 我的反馈
[**list_my_feedbacks_api_v1_feedback_list_get_0**](FeedbackApi.md#list_my_feedbacks_api_v1_feedback_list_get_0) | **GET** /api/v1/feedback/list | 我的反馈
[**rate_feedback_api_v1_feedback_fid_rate_post**](FeedbackApi.md#rate_feedback_api_v1_feedback_fid_rate_post) | **POST** /api/v1/feedback/{fid}/rate | 评价反馈
[**rate_feedback_api_v1_feedback_fid_rate_post_0**](FeedbackApi.md#rate_feedback_api_v1_feedback_fid_rate_post_0) | **POST** /api/v1/feedback/{fid}/rate | 评价反馈
[**submit_feedback_api_v1_feedback_post**](FeedbackApi.md#submit_feedback_api_v1_feedback_post) | **POST** /api/v1/feedback | 提交反馈
[**submit_feedback_api_v1_feedback_post_0**](FeedbackApi.md#submit_feedback_api_v1_feedback_post_0) | **POST** /api/v1/feedback | 提交反馈


# **delete_feedback_api_v1_feedback_fid_delete**
> object delete_feedback_api_v1_feedback_fid_delete(fid)

删除反馈

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
    api_instance = zhs_api.FeedbackApi(api_client)
    fid = 56 # int | 

    try:
        # 删除反馈
        api_response = api_instance.delete_feedback_api_v1_feedback_fid_delete(fid)
        print("The response of FeedbackApi->delete_feedback_api_v1_feedback_fid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FeedbackApi->delete_feedback_api_v1_feedback_fid_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fid** | **int**|  | 

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

# **delete_feedback_api_v1_feedback_fid_delete_0**
> object delete_feedback_api_v1_feedback_fid_delete_0(fid)

删除反馈

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
    api_instance = zhs_api.FeedbackApi(api_client)
    fid = 56 # int | 

    try:
        # 删除反馈
        api_response = api_instance.delete_feedback_api_v1_feedback_fid_delete_0(fid)
        print("The response of FeedbackApi->delete_feedback_api_v1_feedback_fid_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FeedbackApi->delete_feedback_api_v1_feedback_fid_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fid** | **int**|  | 

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

# **feedback_admin_list**
> object feedback_admin_list(page=page, limit=limit, status=status, type=type, priority=priority)

反馈列表(管理员)

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
    api_instance = zhs_api.FeedbackApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    status = 56 # int |  (optional)
    type = 'type_example' # str |  (optional)
    priority = 56 # int |  (optional)

    try:
        # 反馈列表(管理员)
        api_response = api_instance.feedback_admin_list(page=page, limit=limit, status=status, type=type, priority=priority)
        print("The response of FeedbackApi->feedback_admin_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FeedbackApi->feedback_admin_list: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **status** | **int**|  | [optional] 
 **type** | **str**|  | [optional] 
 **priority** | **int**|  | [optional] 

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

# **feedback_admin_list_0**
> object feedback_admin_list_0(page=page, limit=limit, status=status, type=type, priority=priority)

反馈列表(管理员)

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
    api_instance = zhs_api.FeedbackApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    status = 56 # int |  (optional)
    type = 'type_example' # str |  (optional)
    priority = 56 # int |  (optional)

    try:
        # 反馈列表(管理员)
        api_response = api_instance.feedback_admin_list_0(page=page, limit=limit, status=status, type=type, priority=priority)
        print("The response of FeedbackApi->feedback_admin_list_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FeedbackApi->feedback_admin_list_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **status** | **int**|  | [optional] 
 **type** | **str**|  | [optional] 
 **priority** | **int**|  | [optional] 

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

# **get_feedback_api_v1_feedback_fid_get**
> object get_feedback_api_v1_feedback_fid_get(fid)

反馈详情

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
    api_instance = zhs_api.FeedbackApi(api_client)
    fid = 56 # int | 

    try:
        # 反馈详情
        api_response = api_instance.get_feedback_api_v1_feedback_fid_get(fid)
        print("The response of FeedbackApi->get_feedback_api_v1_feedback_fid_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FeedbackApi->get_feedback_api_v1_feedback_fid_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fid** | **int**|  | 

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

# **get_feedback_api_v1_feedback_fid_get_0**
> object get_feedback_api_v1_feedback_fid_get_0(fid)

反馈详情

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
    api_instance = zhs_api.FeedbackApi(api_client)
    fid = 56 # int | 

    try:
        # 反馈详情
        api_response = api_instance.get_feedback_api_v1_feedback_fid_get_0(fid)
        print("The response of FeedbackApi->get_feedback_api_v1_feedback_fid_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FeedbackApi->get_feedback_api_v1_feedback_fid_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fid** | **int**|  | 

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

# **handle_feedback_api_v1_feedback_fid_handle_put**
> object handle_feedback_api_v1_feedback_fid_handle_put(fid, status, remark=remark, priority=priority, reply=reply)

处理反馈

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
    api_instance = zhs_api.FeedbackApi(api_client)
    fid = 56 # int | 
    status = 56 # int | 
    remark = 'remark_example' # str |  (optional)
    priority = 56 # int |  (optional)
    reply = 'reply_example' # str |  (optional)

    try:
        # 处理反馈
        api_response = api_instance.handle_feedback_api_v1_feedback_fid_handle_put(fid, status, remark=remark, priority=priority, reply=reply)
        print("The response of FeedbackApi->handle_feedback_api_v1_feedback_fid_handle_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FeedbackApi->handle_feedback_api_v1_feedback_fid_handle_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fid** | **int**|  | 
 **status** | **int**|  | 
 **remark** | **str**|  | [optional] 
 **priority** | **int**|  | [optional] 
 **reply** | **str**|  | [optional] 

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

# **handle_feedback_api_v1_feedback_fid_handle_put_0**
> object handle_feedback_api_v1_feedback_fid_handle_put_0(fid, status, remark=remark, priority=priority, reply=reply)

处理反馈

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
    api_instance = zhs_api.FeedbackApi(api_client)
    fid = 56 # int | 
    status = 56 # int | 
    remark = 'remark_example' # str |  (optional)
    priority = 56 # int |  (optional)
    reply = 'reply_example' # str |  (optional)

    try:
        # 处理反馈
        api_response = api_instance.handle_feedback_api_v1_feedback_fid_handle_put_0(fid, status, remark=remark, priority=priority, reply=reply)
        print("The response of FeedbackApi->handle_feedback_api_v1_feedback_fid_handle_put_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FeedbackApi->handle_feedback_api_v1_feedback_fid_handle_put_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fid** | **int**|  | 
 **status** | **int**|  | 
 **remark** | **str**|  | [optional] 
 **priority** | **int**|  | [optional] 
 **reply** | **str**|  | [optional] 

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

# **list_my_feedbacks_api_v1_feedback_list_get**
> object list_my_feedbacks_api_v1_feedback_list_get(page=page, limit=limit, type=type, status=status)

我的反馈

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
    api_instance = zhs_api.FeedbackApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    type = 'type_example' # str |  (optional)
    status = 56 # int |  (optional)

    try:
        # 我的反馈
        api_response = api_instance.list_my_feedbacks_api_v1_feedback_list_get(page=page, limit=limit, type=type, status=status)
        print("The response of FeedbackApi->list_my_feedbacks_api_v1_feedback_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FeedbackApi->list_my_feedbacks_api_v1_feedback_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **type** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 

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

# **list_my_feedbacks_api_v1_feedback_list_get_0**
> object list_my_feedbacks_api_v1_feedback_list_get_0(page=page, limit=limit, type=type, status=status)

我的反馈

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
    api_instance = zhs_api.FeedbackApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    type = 'type_example' # str |  (optional)
    status = 56 # int |  (optional)

    try:
        # 我的反馈
        api_response = api_instance.list_my_feedbacks_api_v1_feedback_list_get_0(page=page, limit=limit, type=type, status=status)
        print("The response of FeedbackApi->list_my_feedbacks_api_v1_feedback_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FeedbackApi->list_my_feedbacks_api_v1_feedback_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **type** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 

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

# **rate_feedback_api_v1_feedback_fid_rate_post**
> object rate_feedback_api_v1_feedback_fid_rate_post(fid, rating)

评价反馈

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
    api_instance = zhs_api.FeedbackApi(api_client)
    fid = 56 # int | 
    rating = 56 # int | 

    try:
        # 评价反馈
        api_response = api_instance.rate_feedback_api_v1_feedback_fid_rate_post(fid, rating)
        print("The response of FeedbackApi->rate_feedback_api_v1_feedback_fid_rate_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FeedbackApi->rate_feedback_api_v1_feedback_fid_rate_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fid** | **int**|  | 
 **rating** | **int**|  | 

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

# **rate_feedback_api_v1_feedback_fid_rate_post_0**
> object rate_feedback_api_v1_feedback_fid_rate_post_0(fid, rating)

评价反馈

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
    api_instance = zhs_api.FeedbackApi(api_client)
    fid = 56 # int | 
    rating = 56 # int | 

    try:
        # 评价反馈
        api_response = api_instance.rate_feedback_api_v1_feedback_fid_rate_post_0(fid, rating)
        print("The response of FeedbackApi->rate_feedback_api_v1_feedback_fid_rate_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FeedbackApi->rate_feedback_api_v1_feedback_fid_rate_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fid** | **int**|  | 
 **rating** | **int**|  | 

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

# **submit_feedback_api_v1_feedback_post**
> object submit_feedback_api_v1_feedback_post(title, content, type=type, images=images, contact=contact, app_version=app_version, device_info=device_info)

提交反馈

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
    api_instance = zhs_api.FeedbackApi(api_client)
    title = 'title_example' # str | 
    content = 'content_example' # str | 
    type = 'bug' # str |  (optional) (default to 'bug')
    images = 'images_example' # str |  (optional)
    contact = 'contact_example' # str |  (optional)
    app_version = 'app_version_example' # str |  (optional)
    device_info = 'device_info_example' # str |  (optional)

    try:
        # 提交反馈
        api_response = api_instance.submit_feedback_api_v1_feedback_post(title, content, type=type, images=images, contact=contact, app_version=app_version, device_info=device_info)
        print("The response of FeedbackApi->submit_feedback_api_v1_feedback_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FeedbackApi->submit_feedback_api_v1_feedback_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**|  | 
 **content** | **str**|  | 
 **type** | **str**|  | [optional] [default to &#39;bug&#39;]
 **images** | **str**|  | [optional] 
 **contact** | **str**|  | [optional] 
 **app_version** | **str**|  | [optional] 
 **device_info** | **str**|  | [optional] 

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

# **submit_feedback_api_v1_feedback_post_0**
> object submit_feedback_api_v1_feedback_post_0(title, content, type=type, images=images, contact=contact, app_version=app_version, device_info=device_info)

提交反馈

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
    api_instance = zhs_api.FeedbackApi(api_client)
    title = 'title_example' # str | 
    content = 'content_example' # str | 
    type = 'bug' # str |  (optional) (default to 'bug')
    images = 'images_example' # str |  (optional)
    contact = 'contact_example' # str |  (optional)
    app_version = 'app_version_example' # str |  (optional)
    device_info = 'device_info_example' # str |  (optional)

    try:
        # 提交反馈
        api_response = api_instance.submit_feedback_api_v1_feedback_post_0(title, content, type=type, images=images, contact=contact, app_version=app_version, device_info=device_info)
        print("The response of FeedbackApi->submit_feedback_api_v1_feedback_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FeedbackApi->submit_feedback_api_v1_feedback_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**|  | 
 **content** | **str**|  | 
 **type** | **str**|  | [optional] [default to &#39;bug&#39;]
 **images** | **str**|  | [optional] 
 **contact** | **str**|  | [optional] 
 **app_version** | **str**|  | [optional] 
 **device_info** | **str**|  | [optional] 

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

