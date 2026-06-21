# zhs_api.NotificationApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**channel_list_api_v1_notification_channel_list_get**](NotificationApi.md#channel_list_api_v1_notification_channel_list_get) | **GET** /api/v1/notification/channel/list | 通知渠道列表
[**channel_list_api_v1_notification_channel_list_get_0**](NotificationApi.md#channel_list_api_v1_notification_channel_list_get_0) | **GET** /api/v1/notification/channel/list | 通知渠道列表
[**delete_notification_api_v1_notification_nid_delete**](NotificationApi.md#delete_notification_api_v1_notification_nid_delete) | **DELETE** /api/v1/notification/{nid} | 删除通知
[**delete_notification_api_v1_notification_nid_delete_0**](NotificationApi.md#delete_notification_api_v1_notification_nid_delete_0) | **DELETE** /api/v1/notification/{nid} | 删除通知
[**list_notifications_api_v1_notification_list_get**](NotificationApi.md#list_notifications_api_v1_notification_list_get) | **GET** /api/v1/notification/list | 我的通知列表
[**list_notifications_api_v1_notification_list_get_0**](NotificationApi.md#list_notifications_api_v1_notification_list_get_0) | **GET** /api/v1/notification/list | 我的通知列表
[**mark_read_api_v1_notification_nid_read_post**](NotificationApi.md#mark_read_api_v1_notification_nid_read_post) | **POST** /api/v1/notification/{nid}/read | 标记已读
[**mark_read_api_v1_notification_nid_read_post_0**](NotificationApi.md#mark_read_api_v1_notification_nid_read_post_0) | **POST** /api/v1/notification/{nid}/read | 标记已读
[**notification_create_channel**](NotificationApi.md#notification_create_channel) | **POST** /api/v1/notification/channel | 添加渠道
[**notification_create_channel_0**](NotificationApi.md#notification_create_channel_0) | **POST** /api/v1/notification/channel | 添加渠道
[**notification_delete_channel**](NotificationApi.md#notification_delete_channel) | **DELETE** /api/v1/notification/channel/{cid} | 删除渠道
[**notification_delete_channel_0**](NotificationApi.md#notification_delete_channel_0) | **DELETE** /api/v1/notification/channel/{cid} | 删除渠道
[**notification_log_list**](NotificationApi.md#notification_log_list) | **GET** /api/v1/notification/log/list | 通知发送日志
[**notification_log_list_0**](NotificationApi.md#notification_log_list_0) | **GET** /api/v1/notification/log/list | 通知发送日志
[**notification_mark_all_read**](NotificationApi.md#notification_mark_all_read) | **POST** /api/v1/notification/read-all | 全部标记已读
[**notification_mark_all_read_0**](NotificationApi.md#notification_mark_all_read_0) | **POST** /api/v1/notification/read-all | 全部标记已读
[**notification_unread_count**](NotificationApi.md#notification_unread_count) | **GET** /api/v1/notification/unread-count | 未读通知数
[**notification_unread_count_0**](NotificationApi.md#notification_unread_count_0) | **GET** /api/v1/notification/unread-count | 未读通知数
[**notification_update_channel**](NotificationApi.md#notification_update_channel) | **PUT** /api/v1/notification/channel/{cid} | 修改渠道
[**notification_update_channel_0**](NotificationApi.md#notification_update_channel_0) | **PUT** /api/v1/notification/channel/{cid} | 修改渠道
[**send_notification_api_v1_notification_send_post**](NotificationApi.md#send_notification_api_v1_notification_send_post) | **POST** /api/v1/notification/send | 发送通知
[**send_notification_api_v1_notification_send_post_0**](NotificationApi.md#send_notification_api_v1_notification_send_post_0) | **POST** /api/v1/notification/send | 发送通知
[**set_subscription_api_v1_notification_subscription_post**](NotificationApi.md#set_subscription_api_v1_notification_subscription_post) | **POST** /api/v1/notification/subscription | 设置订阅
[**set_subscription_api_v1_notification_subscription_post_0**](NotificationApi.md#set_subscription_api_v1_notification_subscription_post_0) | **POST** /api/v1/notification/subscription | 设置订阅
[**subscription_list_api_v1_notification_subscription_list_get**](NotificationApi.md#subscription_list_api_v1_notification_subscription_list_get) | **GET** /api/v1/notification/subscription/list | 我的订阅偏好
[**subscription_list_api_v1_notification_subscription_list_get_0**](NotificationApi.md#subscription_list_api_v1_notification_subscription_list_get_0) | **GET** /api/v1/notification/subscription/list | 我的订阅偏好


# **channel_list_api_v1_notification_channel_list_get**
> object channel_list_api_v1_notification_channel_list_get(type=type)

通知渠道列表

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
    api_instance = zhs_api.NotificationApi(api_client)
    type = 'type_example' # str |  (optional)

    try:
        # 通知渠道列表
        api_response = api_instance.channel_list_api_v1_notification_channel_list_get(type=type)
        print("The response of NotificationApi->channel_list_api_v1_notification_channel_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->channel_list_api_v1_notification_channel_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type** | **str**|  | [optional] 

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

# **channel_list_api_v1_notification_channel_list_get_0**
> object channel_list_api_v1_notification_channel_list_get_0(type=type)

通知渠道列表

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
    api_instance = zhs_api.NotificationApi(api_client)
    type = 'type_example' # str |  (optional)

    try:
        # 通知渠道列表
        api_response = api_instance.channel_list_api_v1_notification_channel_list_get_0(type=type)
        print("The response of NotificationApi->channel_list_api_v1_notification_channel_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->channel_list_api_v1_notification_channel_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type** | **str**|  | [optional] 

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

# **delete_notification_api_v1_notification_nid_delete**
> object delete_notification_api_v1_notification_nid_delete(nid)

删除通知

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
    api_instance = zhs_api.NotificationApi(api_client)
    nid = 56 # int | 

    try:
        # 删除通知
        api_response = api_instance.delete_notification_api_v1_notification_nid_delete(nid)
        print("The response of NotificationApi->delete_notification_api_v1_notification_nid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->delete_notification_api_v1_notification_nid_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **nid** | **int**|  | 

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

# **delete_notification_api_v1_notification_nid_delete_0**
> object delete_notification_api_v1_notification_nid_delete_0(nid)

删除通知

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
    api_instance = zhs_api.NotificationApi(api_client)
    nid = 56 # int | 

    try:
        # 删除通知
        api_response = api_instance.delete_notification_api_v1_notification_nid_delete_0(nid)
        print("The response of NotificationApi->delete_notification_api_v1_notification_nid_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->delete_notification_api_v1_notification_nid_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **nid** | **int**|  | 

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

# **list_notifications_api_v1_notification_list_get**
> object list_notifications_api_v1_notification_list_get(page=page, limit=limit, type=type, status=status)

我的通知列表

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
    api_instance = zhs_api.NotificationApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    type = 'type_example' # str |  (optional)
    status = 56 # int |  (optional)

    try:
        # 我的通知列表
        api_response = api_instance.list_notifications_api_v1_notification_list_get(page=page, limit=limit, type=type, status=status)
        print("The response of NotificationApi->list_notifications_api_v1_notification_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->list_notifications_api_v1_notification_list_get: %s\n" % e)
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

# **list_notifications_api_v1_notification_list_get_0**
> object list_notifications_api_v1_notification_list_get_0(page=page, limit=limit, type=type, status=status)

我的通知列表

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
    api_instance = zhs_api.NotificationApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    type = 'type_example' # str |  (optional)
    status = 56 # int |  (optional)

    try:
        # 我的通知列表
        api_response = api_instance.list_notifications_api_v1_notification_list_get_0(page=page, limit=limit, type=type, status=status)
        print("The response of NotificationApi->list_notifications_api_v1_notification_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->list_notifications_api_v1_notification_list_get_0: %s\n" % e)
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

# **mark_read_api_v1_notification_nid_read_post**
> object mark_read_api_v1_notification_nid_read_post(nid)

标记已读

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
    api_instance = zhs_api.NotificationApi(api_client)
    nid = 56 # int | 

    try:
        # 标记已读
        api_response = api_instance.mark_read_api_v1_notification_nid_read_post(nid)
        print("The response of NotificationApi->mark_read_api_v1_notification_nid_read_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->mark_read_api_v1_notification_nid_read_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **nid** | **int**|  | 

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

# **mark_read_api_v1_notification_nid_read_post_0**
> object mark_read_api_v1_notification_nid_read_post_0(nid)

标记已读

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
    api_instance = zhs_api.NotificationApi(api_client)
    nid = 56 # int | 

    try:
        # 标记已读
        api_response = api_instance.mark_read_api_v1_notification_nid_read_post_0(nid)
        print("The response of NotificationApi->mark_read_api_v1_notification_nid_read_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->mark_read_api_v1_notification_nid_read_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **nid** | **int**|  | 

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

# **notification_create_channel**
> object notification_create_channel(name, type, config=config, is_default=is_default)

添加渠道

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
    api_instance = zhs_api.NotificationApi(api_client)
    name = 'name_example' # str | 
    type = 'type_example' # str | 
    config = 'config_example' # str |  (optional)
    is_default = False # bool |  (optional) (default to False)

    try:
        # 添加渠道
        api_response = api_instance.notification_create_channel(name, type, config=config, is_default=is_default)
        print("The response of NotificationApi->notification_create_channel:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->notification_create_channel: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **str**|  | 
 **type** | **str**|  | 
 **config** | **str**|  | [optional] 
 **is_default** | **bool**|  | [optional] [default to False]

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

# **notification_create_channel_0**
> object notification_create_channel_0(name, type, config=config, is_default=is_default)

添加渠道

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
    api_instance = zhs_api.NotificationApi(api_client)
    name = 'name_example' # str | 
    type = 'type_example' # str | 
    config = 'config_example' # str |  (optional)
    is_default = False # bool |  (optional) (default to False)

    try:
        # 添加渠道
        api_response = api_instance.notification_create_channel_0(name, type, config=config, is_default=is_default)
        print("The response of NotificationApi->notification_create_channel_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->notification_create_channel_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **str**|  | 
 **type** | **str**|  | 
 **config** | **str**|  | [optional] 
 **is_default** | **bool**|  | [optional] [default to False]

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

# **notification_delete_channel**
> object notification_delete_channel(cid)

删除渠道

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
    api_instance = zhs_api.NotificationApi(api_client)
    cid = 56 # int | 

    try:
        # 删除渠道
        api_response = api_instance.notification_delete_channel(cid)
        print("The response of NotificationApi->notification_delete_channel:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->notification_delete_channel: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cid** | **int**|  | 

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

# **notification_delete_channel_0**
> object notification_delete_channel_0(cid)

删除渠道

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
    api_instance = zhs_api.NotificationApi(api_client)
    cid = 56 # int | 

    try:
        # 删除渠道
        api_response = api_instance.notification_delete_channel_0(cid)
        print("The response of NotificationApi->notification_delete_channel_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->notification_delete_channel_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cid** | **int**|  | 

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

# **notification_log_list**
> object notification_log_list(page=page, limit=limit, success_flag=success_flag)

通知发送日志

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
    api_instance = zhs_api.NotificationApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    success_flag = True # bool |  (optional)

    try:
        # 通知发送日志
        api_response = api_instance.notification_log_list(page=page, limit=limit, success_flag=success_flag)
        print("The response of NotificationApi->notification_log_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->notification_log_list: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **success_flag** | **bool**|  | [optional] 

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

# **notification_log_list_0**
> object notification_log_list_0(page=page, limit=limit, success_flag=success_flag)

通知发送日志

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
    api_instance = zhs_api.NotificationApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    success_flag = True # bool |  (optional)

    try:
        # 通知发送日志
        api_response = api_instance.notification_log_list_0(page=page, limit=limit, success_flag=success_flag)
        print("The response of NotificationApi->notification_log_list_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->notification_log_list_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **success_flag** | **bool**|  | [optional] 

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

# **notification_mark_all_read**
> object notification_mark_all_read()

全部标记已读

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
    api_instance = zhs_api.NotificationApi(api_client)

    try:
        # 全部标记已读
        api_response = api_instance.notification_mark_all_read()
        print("The response of NotificationApi->notification_mark_all_read:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->notification_mark_all_read: %s\n" % e)
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

# **notification_mark_all_read_0**
> object notification_mark_all_read_0()

全部标记已读

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
    api_instance = zhs_api.NotificationApi(api_client)

    try:
        # 全部标记已读
        api_response = api_instance.notification_mark_all_read_0()
        print("The response of NotificationApi->notification_mark_all_read_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->notification_mark_all_read_0: %s\n" % e)
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

# **notification_unread_count**
> object notification_unread_count()

未读通知数

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
    api_instance = zhs_api.NotificationApi(api_client)

    try:
        # 未读通知数
        api_response = api_instance.notification_unread_count()
        print("The response of NotificationApi->notification_unread_count:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->notification_unread_count: %s\n" % e)
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

# **notification_unread_count_0**
> object notification_unread_count_0()

未读通知数

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
    api_instance = zhs_api.NotificationApi(api_client)

    try:
        # 未读通知数
        api_response = api_instance.notification_unread_count_0()
        print("The response of NotificationApi->notification_unread_count_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->notification_unread_count_0: %s\n" % e)
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

# **notification_update_channel**
> object notification_update_channel(cid, name=name, config=config, is_default=is_default, status=status)

修改渠道

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
    api_instance = zhs_api.NotificationApi(api_client)
    cid = 56 # int | 
    name = 'name_example' # str |  (optional)
    config = 'config_example' # str |  (optional)
    is_default = True # bool |  (optional)
    status = 56 # int |  (optional)

    try:
        # 修改渠道
        api_response = api_instance.notification_update_channel(cid, name=name, config=config, is_default=is_default, status=status)
        print("The response of NotificationApi->notification_update_channel:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->notification_update_channel: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cid** | **int**|  | 
 **name** | **str**|  | [optional] 
 **config** | **str**|  | [optional] 
 **is_default** | **bool**|  | [optional] 
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

# **notification_update_channel_0**
> object notification_update_channel_0(cid, name=name, config=config, is_default=is_default, status=status)

修改渠道

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
    api_instance = zhs_api.NotificationApi(api_client)
    cid = 56 # int | 
    name = 'name_example' # str |  (optional)
    config = 'config_example' # str |  (optional)
    is_default = True # bool |  (optional)
    status = 56 # int |  (optional)

    try:
        # 修改渠道
        api_response = api_instance.notification_update_channel_0(cid, name=name, config=config, is_default=is_default, status=status)
        print("The response of NotificationApi->notification_update_channel_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->notification_update_channel_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cid** | **int**|  | 
 **name** | **str**|  | [optional] 
 **config** | **str**|  | [optional] 
 **is_default** | **bool**|  | [optional] 
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

# **send_notification_api_v1_notification_send_post**
> object send_notification_api_v1_notification_send_post(title, content, user_id=user_id, type=type, channel=channel, target_type=target_type, target_id=target_id, target_url=target_url, user_ids=user_ids)

发送通知

发送通知: user_id(单用户) 或 user_ids(逗号分隔多用户)

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
    api_instance = zhs_api.NotificationApi(api_client)
    title = 'title_example' # str | 
    content = 'content_example' # str | 
    user_id = 'user_id_example' # str |  (optional)
    type = 'site' # str |  (optional) (default to 'site')
    channel = 'channel_example' # str |  (optional)
    target_type = 'target_type_example' # str |  (optional)
    target_id = 'target_id_example' # str |  (optional)
    target_url = 'target_url_example' # str |  (optional)
    user_ids = 'user_ids_example' # str |  (optional)

    try:
        # 发送通知
        api_response = api_instance.send_notification_api_v1_notification_send_post(title, content, user_id=user_id, type=type, channel=channel, target_type=target_type, target_id=target_id, target_url=target_url, user_ids=user_ids)
        print("The response of NotificationApi->send_notification_api_v1_notification_send_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->send_notification_api_v1_notification_send_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**|  | 
 **content** | **str**|  | 
 **user_id** | **str**|  | [optional] 
 **type** | **str**|  | [optional] [default to &#39;site&#39;]
 **channel** | **str**|  | [optional] 
 **target_type** | **str**|  | [optional] 
 **target_id** | **str**|  | [optional] 
 **target_url** | **str**|  | [optional] 
 **user_ids** | **str**|  | [optional] 

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

# **send_notification_api_v1_notification_send_post_0**
> object send_notification_api_v1_notification_send_post_0(title, content, user_id=user_id, type=type, channel=channel, target_type=target_type, target_id=target_id, target_url=target_url, user_ids=user_ids)

发送通知

发送通知: user_id(单用户) 或 user_ids(逗号分隔多用户)

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
    api_instance = zhs_api.NotificationApi(api_client)
    title = 'title_example' # str | 
    content = 'content_example' # str | 
    user_id = 'user_id_example' # str |  (optional)
    type = 'site' # str |  (optional) (default to 'site')
    channel = 'channel_example' # str |  (optional)
    target_type = 'target_type_example' # str |  (optional)
    target_id = 'target_id_example' # str |  (optional)
    target_url = 'target_url_example' # str |  (optional)
    user_ids = 'user_ids_example' # str |  (optional)

    try:
        # 发送通知
        api_response = api_instance.send_notification_api_v1_notification_send_post_0(title, content, user_id=user_id, type=type, channel=channel, target_type=target_type, target_id=target_id, target_url=target_url, user_ids=user_ids)
        print("The response of NotificationApi->send_notification_api_v1_notification_send_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->send_notification_api_v1_notification_send_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**|  | 
 **content** | **str**|  | 
 **user_id** | **str**|  | [optional] 
 **type** | **str**|  | [optional] [default to &#39;site&#39;]
 **channel** | **str**|  | [optional] 
 **target_type** | **str**|  | [optional] 
 **target_id** | **str**|  | [optional] 
 **target_url** | **str**|  | [optional] 
 **user_ids** | **str**|  | [optional] 

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

# **set_subscription_api_v1_notification_subscription_post**
> object set_subscription_api_v1_notification_subscription_post(type, category, enabled=enabled)

设置订阅

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
    api_instance = zhs_api.NotificationApi(api_client)
    type = 'type_example' # str | 
    category = 'category_example' # str | 
    enabled = True # bool |  (optional) (default to True)

    try:
        # 设置订阅
        api_response = api_instance.set_subscription_api_v1_notification_subscription_post(type, category, enabled=enabled)
        print("The response of NotificationApi->set_subscription_api_v1_notification_subscription_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->set_subscription_api_v1_notification_subscription_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type** | **str**|  | 
 **category** | **str**|  | 
 **enabled** | **bool**|  | [optional] [default to True]

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

# **set_subscription_api_v1_notification_subscription_post_0**
> object set_subscription_api_v1_notification_subscription_post_0(type, category, enabled=enabled)

设置订阅

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
    api_instance = zhs_api.NotificationApi(api_client)
    type = 'type_example' # str | 
    category = 'category_example' # str | 
    enabled = True # bool |  (optional) (default to True)

    try:
        # 设置订阅
        api_response = api_instance.set_subscription_api_v1_notification_subscription_post_0(type, category, enabled=enabled)
        print("The response of NotificationApi->set_subscription_api_v1_notification_subscription_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->set_subscription_api_v1_notification_subscription_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type** | **str**|  | 
 **category** | **str**|  | 
 **enabled** | **bool**|  | [optional] [default to True]

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

# **subscription_list_api_v1_notification_subscription_list_get**
> object subscription_list_api_v1_notification_subscription_list_get()

我的订阅偏好

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
    api_instance = zhs_api.NotificationApi(api_client)

    try:
        # 我的订阅偏好
        api_response = api_instance.subscription_list_api_v1_notification_subscription_list_get()
        print("The response of NotificationApi->subscription_list_api_v1_notification_subscription_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->subscription_list_api_v1_notification_subscription_list_get: %s\n" % e)
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

# **subscription_list_api_v1_notification_subscription_list_get_0**
> object subscription_list_api_v1_notification_subscription_list_get_0()

我的订阅偏好

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
    api_instance = zhs_api.NotificationApi(api_client)

    try:
        # 我的订阅偏好
        api_response = api_instance.subscription_list_api_v1_notification_subscription_list_get_0()
        print("The response of NotificationApi->subscription_list_api_v1_notification_subscription_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling NotificationApi->subscription_list_api_v1_notification_subscription_list_get_0: %s\n" % e)
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

