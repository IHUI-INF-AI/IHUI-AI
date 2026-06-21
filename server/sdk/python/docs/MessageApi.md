# zhs_api.MessageApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**batch_delete_api_v1_message_batch_delete_delete**](MessageApi.md#batch_delete_api_v1_message_batch_delete_delete) | **DELETE** /api/v1/message/batch-delete | 批量删除
[**batch_delete_api_v1_message_batch_delete_delete_0**](MessageApi.md#batch_delete_api_v1_message_batch_delete_delete_0) | **DELETE** /api/v1/message/batch-delete | 批量删除
[**create_announcement_api_v1_message_announcement_post**](MessageApi.md#create_announcement_api_v1_message_announcement_post) | **POST** /api/v1/message/announcement | 发布公告
[**create_announcement_api_v1_message_announcement_post_0**](MessageApi.md#create_announcement_api_v1_message_announcement_post_0) | **POST** /api/v1/message/announcement | 发布公告
[**create_template_api_v1_message_template_post**](MessageApi.md#create_template_api_v1_message_template_post) | **POST** /api/v1/message/template | 新增模板
[**create_template_api_v1_message_template_post_0**](MessageApi.md#create_template_api_v1_message_template_post_0) | **POST** /api/v1/message/template | 新增模板
[**delete_announcement_api_v1_message_announcement_aid_delete**](MessageApi.md#delete_announcement_api_v1_message_announcement_aid_delete) | **DELETE** /api/v1/message/announcement/{aid} | 删除公告
[**delete_announcement_api_v1_message_announcement_aid_delete_0**](MessageApi.md#delete_announcement_api_v1_message_announcement_aid_delete_0) | **DELETE** /api/v1/message/announcement/{aid} | 删除公告
[**delete_message_api_v1_message_mid_delete**](MessageApi.md#delete_message_api_v1_message_mid_delete) | **DELETE** /api/v1/message/{mid} | 删除消息
[**delete_message_api_v1_message_mid_delete_0**](MessageApi.md#delete_message_api_v1_message_mid_delete_0) | **DELETE** /api/v1/message/{mid} | 删除消息
[**get_announcement_api_v1_message_announcement_aid_get**](MessageApi.md#get_announcement_api_v1_message_announcement_aid_get) | **GET** /api/v1/message/announcement/{aid} | 公告详情
[**get_announcement_api_v1_message_announcement_aid_get_0**](MessageApi.md#get_announcement_api_v1_message_announcement_aid_get_0) | **GET** /api/v1/message/announcement/{aid} | 公告详情
[**list_announcements_api_v1_message_announcement_list_get**](MessageApi.md#list_announcements_api_v1_message_announcement_list_get) | **GET** /api/v1/message/announcement/list | 公告列表
[**list_announcements_api_v1_message_announcement_list_get_0**](MessageApi.md#list_announcements_api_v1_message_announcement_list_get_0) | **GET** /api/v1/message/announcement/list | 公告列表
[**list_messages_api_v1_message_list_get**](MessageApi.md#list_messages_api_v1_message_list_get) | **GET** /api/v1/message/list | 我的消息列表
[**list_messages_api_v1_message_list_get_0**](MessageApi.md#list_messages_api_v1_message_list_get_0) | **GET** /api/v1/message/list | 我的消息列表
[**mark_read_api_v1_message_mid_read_post**](MessageApi.md#mark_read_api_v1_message_mid_read_post) | **POST** /api/v1/message/{mid}/read | 标记已读
[**mark_read_api_v1_message_mid_read_post_0**](MessageApi.md#mark_read_api_v1_message_mid_read_post_0) | **POST** /api/v1/message/{mid}/read | 标记已读
[**message_mark_all_read**](MessageApi.md#message_mark_all_read) | **POST** /api/v1/message/read-all | 全部标记已读
[**message_mark_all_read_0**](MessageApi.md#message_mark_all_read_0) | **POST** /api/v1/message/read-all | 全部标记已读
[**message_unread_count**](MessageApi.md#message_unread_count) | **GET** /api/v1/message/unread-count | 未读消息数
[**message_unread_count_0**](MessageApi.md#message_unread_count_0) | **GET** /api/v1/message/unread-count | 未读消息数
[**send_private_api_v1_message_private_post**](MessageApi.md#send_private_api_v1_message_private_post) | **POST** /api/v1/message/private | 发送私信
[**send_private_api_v1_message_private_post_0**](MessageApi.md#send_private_api_v1_message_private_post_0) | **POST** /api/v1/message/private | 发送私信
[**template_list_api_v1_message_template_list_get**](MessageApi.md#template_list_api_v1_message_template_list_get) | **GET** /api/v1/message/template/list | 消息模板列表
[**template_list_api_v1_message_template_list_get_0**](MessageApi.md#template_list_api_v1_message_template_list_get_0) | **GET** /api/v1/message/template/list | 消息模板列表
[**update_announcement_api_v1_message_announcement_aid_put**](MessageApi.md#update_announcement_api_v1_message_announcement_aid_put) | **PUT** /api/v1/message/announcement/{aid} | 修改公告
[**update_announcement_api_v1_message_announcement_aid_put_0**](MessageApi.md#update_announcement_api_v1_message_announcement_aid_put_0) | **PUT** /api/v1/message/announcement/{aid} | 修改公告


# **batch_delete_api_v1_message_batch_delete_delete**
> object batch_delete_api_v1_message_batch_delete_delete(ids)

批量删除

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
    api_instance = zhs_api.MessageApi(api_client)
    ids = 'ids_example' # str | ID列表,逗号分隔

    try:
        # 批量删除
        api_response = api_instance.batch_delete_api_v1_message_batch_delete_delete(ids)
        print("The response of MessageApi->batch_delete_api_v1_message_batch_delete_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->batch_delete_api_v1_message_batch_delete_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ids** | **str**| ID列表,逗号分隔 | 

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

# **batch_delete_api_v1_message_batch_delete_delete_0**
> object batch_delete_api_v1_message_batch_delete_delete_0(ids)

批量删除

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
    api_instance = zhs_api.MessageApi(api_client)
    ids = 'ids_example' # str | ID列表,逗号分隔

    try:
        # 批量删除
        api_response = api_instance.batch_delete_api_v1_message_batch_delete_delete_0(ids)
        print("The response of MessageApi->batch_delete_api_v1_message_batch_delete_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->batch_delete_api_v1_message_batch_delete_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ids** | **str**| ID列表,逗号分隔 | 

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

# **create_announcement_api_v1_message_announcement_post**
> object create_announcement_api_v1_message_announcement_post(title, content, cover=cover, type=type, priority=priority, target_user=target_user, target_url=target_url, publish_time=publish_time, expire_time=expire_time)

发布公告

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
    api_instance = zhs_api.MessageApi(api_client)
    title = 'title_example' # str | 
    content = 'content_example' # str | 
    cover = 'cover_example' # str |  (optional)
    type = 1 # int |  (optional) (default to 1)
    priority = 1 # int |  (optional) (default to 1)
    target_user = 'all' # str |  (optional) (default to 'all')
    target_url = 'target_url_example' # str |  (optional)
    publish_time = '2013-10-20T19:20:30+01:00' # datetime |  (optional)
    expire_time = '2013-10-20T19:20:30+01:00' # datetime |  (optional)

    try:
        # 发布公告
        api_response = api_instance.create_announcement_api_v1_message_announcement_post(title, content, cover=cover, type=type, priority=priority, target_user=target_user, target_url=target_url, publish_time=publish_time, expire_time=expire_time)
        print("The response of MessageApi->create_announcement_api_v1_message_announcement_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->create_announcement_api_v1_message_announcement_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**|  | 
 **content** | **str**|  | 
 **cover** | **str**|  | [optional] 
 **type** | **int**|  | [optional] [default to 1]
 **priority** | **int**|  | [optional] [default to 1]
 **target_user** | **str**|  | [optional] [default to &#39;all&#39;]
 **target_url** | **str**|  | [optional] 
 **publish_time** | **datetime**|  | [optional] 
 **expire_time** | **datetime**|  | [optional] 

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

# **create_announcement_api_v1_message_announcement_post_0**
> object create_announcement_api_v1_message_announcement_post_0(title, content, cover=cover, type=type, priority=priority, target_user=target_user, target_url=target_url, publish_time=publish_time, expire_time=expire_time)

发布公告

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
    api_instance = zhs_api.MessageApi(api_client)
    title = 'title_example' # str | 
    content = 'content_example' # str | 
    cover = 'cover_example' # str |  (optional)
    type = 1 # int |  (optional) (default to 1)
    priority = 1 # int |  (optional) (default to 1)
    target_user = 'all' # str |  (optional) (default to 'all')
    target_url = 'target_url_example' # str |  (optional)
    publish_time = '2013-10-20T19:20:30+01:00' # datetime |  (optional)
    expire_time = '2013-10-20T19:20:30+01:00' # datetime |  (optional)

    try:
        # 发布公告
        api_response = api_instance.create_announcement_api_v1_message_announcement_post_0(title, content, cover=cover, type=type, priority=priority, target_user=target_user, target_url=target_url, publish_time=publish_time, expire_time=expire_time)
        print("The response of MessageApi->create_announcement_api_v1_message_announcement_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->create_announcement_api_v1_message_announcement_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**|  | 
 **content** | **str**|  | 
 **cover** | **str**|  | [optional] 
 **type** | **int**|  | [optional] [default to 1]
 **priority** | **int**|  | [optional] [default to 1]
 **target_user** | **str**|  | [optional] [default to &#39;all&#39;]
 **target_url** | **str**|  | [optional] 
 **publish_time** | **datetime**|  | [optional] 
 **expire_time** | **datetime**|  | [optional] 

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

# **create_template_api_v1_message_template_post**
> object create_template_api_v1_message_template_post(code, name, type, content, subject=subject, variables=variables)

新增模板

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
    api_instance = zhs_api.MessageApi(api_client)
    code = 'code_example' # str | 
    name = 'name_example' # str | 
    type = 'type_example' # str | 
    content = 'content_example' # str | 
    subject = 'subject_example' # str |  (optional)
    variables = 'variables_example' # str |  (optional)

    try:
        # 新增模板
        api_response = api_instance.create_template_api_v1_message_template_post(code, name, type, content, subject=subject, variables=variables)
        print("The response of MessageApi->create_template_api_v1_message_template_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->create_template_api_v1_message_template_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**|  | 
 **name** | **str**|  | 
 **type** | **str**|  | 
 **content** | **str**|  | 
 **subject** | **str**|  | [optional] 
 **variables** | **str**|  | [optional] 

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

# **create_template_api_v1_message_template_post_0**
> object create_template_api_v1_message_template_post_0(code, name, type, content, subject=subject, variables=variables)

新增模板

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
    api_instance = zhs_api.MessageApi(api_client)
    code = 'code_example' # str | 
    name = 'name_example' # str | 
    type = 'type_example' # str | 
    content = 'content_example' # str | 
    subject = 'subject_example' # str |  (optional)
    variables = 'variables_example' # str |  (optional)

    try:
        # 新增模板
        api_response = api_instance.create_template_api_v1_message_template_post_0(code, name, type, content, subject=subject, variables=variables)
        print("The response of MessageApi->create_template_api_v1_message_template_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->create_template_api_v1_message_template_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**|  | 
 **name** | **str**|  | 
 **type** | **str**|  | 
 **content** | **str**|  | 
 **subject** | **str**|  | [optional] 
 **variables** | **str**|  | [optional] 

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

# **delete_announcement_api_v1_message_announcement_aid_delete**
> object delete_announcement_api_v1_message_announcement_aid_delete(aid)

删除公告

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
    api_instance = zhs_api.MessageApi(api_client)
    aid = 56 # int | 

    try:
        # 删除公告
        api_response = api_instance.delete_announcement_api_v1_message_announcement_aid_delete(aid)
        print("The response of MessageApi->delete_announcement_api_v1_message_announcement_aid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->delete_announcement_api_v1_message_announcement_aid_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 

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

# **delete_announcement_api_v1_message_announcement_aid_delete_0**
> object delete_announcement_api_v1_message_announcement_aid_delete_0(aid)

删除公告

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
    api_instance = zhs_api.MessageApi(api_client)
    aid = 56 # int | 

    try:
        # 删除公告
        api_response = api_instance.delete_announcement_api_v1_message_announcement_aid_delete_0(aid)
        print("The response of MessageApi->delete_announcement_api_v1_message_announcement_aid_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->delete_announcement_api_v1_message_announcement_aid_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 

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

# **delete_message_api_v1_message_mid_delete**
> object delete_message_api_v1_message_mid_delete(mid)

删除消息

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
    api_instance = zhs_api.MessageApi(api_client)
    mid = 56 # int | 

    try:
        # 删除消息
        api_response = api_instance.delete_message_api_v1_message_mid_delete(mid)
        print("The response of MessageApi->delete_message_api_v1_message_mid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->delete_message_api_v1_message_mid_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **mid** | **int**|  | 

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

# **delete_message_api_v1_message_mid_delete_0**
> object delete_message_api_v1_message_mid_delete_0(mid)

删除消息

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
    api_instance = zhs_api.MessageApi(api_client)
    mid = 56 # int | 

    try:
        # 删除消息
        api_response = api_instance.delete_message_api_v1_message_mid_delete_0(mid)
        print("The response of MessageApi->delete_message_api_v1_message_mid_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->delete_message_api_v1_message_mid_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **mid** | **int**|  | 

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

# **get_announcement_api_v1_message_announcement_aid_get**
> object get_announcement_api_v1_message_announcement_aid_get(aid)

公告详情

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
    api_instance = zhs_api.MessageApi(api_client)
    aid = 56 # int | 

    try:
        # 公告详情
        api_response = api_instance.get_announcement_api_v1_message_announcement_aid_get(aid)
        print("The response of MessageApi->get_announcement_api_v1_message_announcement_aid_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->get_announcement_api_v1_message_announcement_aid_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 

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

# **get_announcement_api_v1_message_announcement_aid_get_0**
> object get_announcement_api_v1_message_announcement_aid_get_0(aid)

公告详情

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
    api_instance = zhs_api.MessageApi(api_client)
    aid = 56 # int | 

    try:
        # 公告详情
        api_response = api_instance.get_announcement_api_v1_message_announcement_aid_get_0(aid)
        print("The response of MessageApi->get_announcement_api_v1_message_announcement_aid_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->get_announcement_api_v1_message_announcement_aid_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 

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

# **list_announcements_api_v1_message_announcement_list_get**
> object list_announcements_api_v1_message_announcement_list_get(page=page, limit=limit, type=type)

公告列表

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
    api_instance = zhs_api.MessageApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    type = 56 # int |  (optional)

    try:
        # 公告列表
        api_response = api_instance.list_announcements_api_v1_message_announcement_list_get(page=page, limit=limit, type=type)
        print("The response of MessageApi->list_announcements_api_v1_message_announcement_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->list_announcements_api_v1_message_announcement_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **type** | **int**|  | [optional] 

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

# **list_announcements_api_v1_message_announcement_list_get_0**
> object list_announcements_api_v1_message_announcement_list_get_0(page=page, limit=limit, type=type)

公告列表

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
    api_instance = zhs_api.MessageApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    type = 56 # int |  (optional)

    try:
        # 公告列表
        api_response = api_instance.list_announcements_api_v1_message_announcement_list_get_0(page=page, limit=limit, type=type)
        print("The response of MessageApi->list_announcements_api_v1_message_announcement_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->list_announcements_api_v1_message_announcement_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **type** | **int**|  | [optional] 

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

# **list_messages_api_v1_message_list_get**
> object list_messages_api_v1_message_list_get(page=page, limit=limit, type=type, is_read=is_read)

我的消息列表

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
    api_instance = zhs_api.MessageApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    type = 'type_example' # str |  (optional)
    is_read = True # bool |  (optional)

    try:
        # 我的消息列表
        api_response = api_instance.list_messages_api_v1_message_list_get(page=page, limit=limit, type=type, is_read=is_read)
        print("The response of MessageApi->list_messages_api_v1_message_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->list_messages_api_v1_message_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **type** | **str**|  | [optional] 
 **is_read** | **bool**|  | [optional] 

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

# **list_messages_api_v1_message_list_get_0**
> object list_messages_api_v1_message_list_get_0(page=page, limit=limit, type=type, is_read=is_read)

我的消息列表

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
    api_instance = zhs_api.MessageApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    type = 'type_example' # str |  (optional)
    is_read = True # bool |  (optional)

    try:
        # 我的消息列表
        api_response = api_instance.list_messages_api_v1_message_list_get_0(page=page, limit=limit, type=type, is_read=is_read)
        print("The response of MessageApi->list_messages_api_v1_message_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->list_messages_api_v1_message_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **type** | **str**|  | [optional] 
 **is_read** | **bool**|  | [optional] 

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

# **mark_read_api_v1_message_mid_read_post**
> object mark_read_api_v1_message_mid_read_post(mid)

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
    api_instance = zhs_api.MessageApi(api_client)
    mid = 56 # int | 

    try:
        # 标记已读
        api_response = api_instance.mark_read_api_v1_message_mid_read_post(mid)
        print("The response of MessageApi->mark_read_api_v1_message_mid_read_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->mark_read_api_v1_message_mid_read_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **mid** | **int**|  | 

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

# **mark_read_api_v1_message_mid_read_post_0**
> object mark_read_api_v1_message_mid_read_post_0(mid)

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
    api_instance = zhs_api.MessageApi(api_client)
    mid = 56 # int | 

    try:
        # 标记已读
        api_response = api_instance.mark_read_api_v1_message_mid_read_post_0(mid)
        print("The response of MessageApi->mark_read_api_v1_message_mid_read_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->mark_read_api_v1_message_mid_read_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **mid** | **int**|  | 

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

# **message_mark_all_read**
> object message_mark_all_read()

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
    api_instance = zhs_api.MessageApi(api_client)

    try:
        # 全部标记已读
        api_response = api_instance.message_mark_all_read()
        print("The response of MessageApi->message_mark_all_read:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->message_mark_all_read: %s\n" % e)
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

# **message_mark_all_read_0**
> object message_mark_all_read_0()

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
    api_instance = zhs_api.MessageApi(api_client)

    try:
        # 全部标记已读
        api_response = api_instance.message_mark_all_read_0()
        print("The response of MessageApi->message_mark_all_read_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->message_mark_all_read_0: %s\n" % e)
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

# **message_unread_count**
> object message_unread_count()

未读消息数

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
    api_instance = zhs_api.MessageApi(api_client)

    try:
        # 未读消息数
        api_response = api_instance.message_unread_count()
        print("The response of MessageApi->message_unread_count:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->message_unread_count: %s\n" % e)
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

# **message_unread_count_0**
> object message_unread_count_0()

未读消息数

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
    api_instance = zhs_api.MessageApi(api_client)

    try:
        # 未读消息数
        api_response = api_instance.message_unread_count_0()
        print("The response of MessageApi->message_unread_count_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->message_unread_count_0: %s\n" % e)
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

# **send_private_api_v1_message_private_post**
> object send_private_api_v1_message_private_post(to_user_id, content, title=title)

发送私信

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
    api_instance = zhs_api.MessageApi(api_client)
    to_user_id = 'to_user_id_example' # str | 
    content = 'content_example' # str | 
    title = 'title_example' # str |  (optional)

    try:
        # 发送私信
        api_response = api_instance.send_private_api_v1_message_private_post(to_user_id, content, title=title)
        print("The response of MessageApi->send_private_api_v1_message_private_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->send_private_api_v1_message_private_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **to_user_id** | **str**|  | 
 **content** | **str**|  | 
 **title** | **str**|  | [optional] 

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

# **send_private_api_v1_message_private_post_0**
> object send_private_api_v1_message_private_post_0(to_user_id, content, title=title)

发送私信

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
    api_instance = zhs_api.MessageApi(api_client)
    to_user_id = 'to_user_id_example' # str | 
    content = 'content_example' # str | 
    title = 'title_example' # str |  (optional)

    try:
        # 发送私信
        api_response = api_instance.send_private_api_v1_message_private_post_0(to_user_id, content, title=title)
        print("The response of MessageApi->send_private_api_v1_message_private_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->send_private_api_v1_message_private_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **to_user_id** | **str**|  | 
 **content** | **str**|  | 
 **title** | **str**|  | [optional] 

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

# **template_list_api_v1_message_template_list_get**
> object template_list_api_v1_message_template_list_get(type=type)

消息模板列表

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
    api_instance = zhs_api.MessageApi(api_client)
    type = 'type_example' # str |  (optional)

    try:
        # 消息模板列表
        api_response = api_instance.template_list_api_v1_message_template_list_get(type=type)
        print("The response of MessageApi->template_list_api_v1_message_template_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->template_list_api_v1_message_template_list_get: %s\n" % e)
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

# **template_list_api_v1_message_template_list_get_0**
> object template_list_api_v1_message_template_list_get_0(type=type)

消息模板列表

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
    api_instance = zhs_api.MessageApi(api_client)
    type = 'type_example' # str |  (optional)

    try:
        # 消息模板列表
        api_response = api_instance.template_list_api_v1_message_template_list_get_0(type=type)
        print("The response of MessageApi->template_list_api_v1_message_template_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->template_list_api_v1_message_template_list_get_0: %s\n" % e)
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

# **update_announcement_api_v1_message_announcement_aid_put**
> object update_announcement_api_v1_message_announcement_aid_put(aid, title=title, content=content, status=status, priority=priority)

修改公告

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
    api_instance = zhs_api.MessageApi(api_client)
    aid = 56 # int | 
    title = 'title_example' # str |  (optional)
    content = 'content_example' # str |  (optional)
    status = 56 # int |  (optional)
    priority = 56 # int |  (optional)

    try:
        # 修改公告
        api_response = api_instance.update_announcement_api_v1_message_announcement_aid_put(aid, title=title, content=content, status=status, priority=priority)
        print("The response of MessageApi->update_announcement_api_v1_message_announcement_aid_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->update_announcement_api_v1_message_announcement_aid_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 
 **title** | **str**|  | [optional] 
 **content** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 
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

# **update_announcement_api_v1_message_announcement_aid_put_0**
> object update_announcement_api_v1_message_announcement_aid_put_0(aid, title=title, content=content, status=status, priority=priority)

修改公告

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
    api_instance = zhs_api.MessageApi(api_client)
    aid = 56 # int | 
    title = 'title_example' # str |  (optional)
    content = 'content_example' # str |  (optional)
    status = 56 # int |  (optional)
    priority = 56 # int |  (optional)

    try:
        # 修改公告
        api_response = api_instance.update_announcement_api_v1_message_announcement_aid_put_0(aid, title=title, content=content, status=status, priority=priority)
        print("The response of MessageApi->update_announcement_api_v1_message_announcement_aid_put_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MessageApi->update_announcement_api_v1_message_announcement_aid_put_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 
 **title** | **str**|  | [optional] 
 **content** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 
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

