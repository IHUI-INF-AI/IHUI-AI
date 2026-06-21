# zhs_api.LiveApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**add_comment_api_v1_live_channel_cid_comment_post**](LiveApi.md#add_comment_api_v1_live_channel_cid_comment_post) | **POST** /api/v1/live/channel/{cid}/comment | 发表评论
[**add_comment_api_v1_live_channel_cid_comment_post_0**](LiveApi.md#add_comment_api_v1_live_channel_cid_comment_post_0) | **POST** /api/v1/live/channel/{cid}/comment | 发表评论
[**get_channel_api_v1_live_channel_cid_get**](LiveApi.md#get_channel_api_v1_live_channel_cid_get) | **GET** /api/v1/live/channel/{cid} | 直播详情
[**get_channel_api_v1_live_channel_cid_get_0**](LiveApi.md#get_channel_api_v1_live_channel_cid_get_0) | **GET** /api/v1/live/channel/{cid} | 直播详情
[**list_channels_api_v1_live_channel_list_get**](LiveApi.md#list_channels_api_v1_live_channel_list_get) | **GET** /api/v1/live/channel/list | 直播列表
[**list_channels_api_v1_live_channel_list_get_0**](LiveApi.md#list_channels_api_v1_live_channel_list_get_0) | **GET** /api/v1/live/channel/list | 直播列表
[**list_comments_api_v1_live_channel_cid_comments_get**](LiveApi.md#list_comments_api_v1_live_channel_cid_comments_get) | **GET** /api/v1/live/channel/{cid}/comments | 评论列表
[**list_comments_api_v1_live_channel_cid_comments_get_0**](LiveApi.md#list_comments_api_v1_live_channel_cid_comments_get_0) | **GET** /api/v1/live/channel/{cid}/comments | 评论列表
[**live_channel_category_list**](LiveApi.md#live_channel_category_list) | **GET** /api/v1/live/category/list | 直播分类
[**live_channel_category_list_0**](LiveApi.md#live_channel_category_list_0) | **GET** /api/v1/live/category/list | 直播分类
[**live_create_channel**](LiveApi.md#live_create_channel) | **POST** /api/v1/live/channel | 创建直播
[**live_create_channel_0**](LiveApi.md#live_create_channel_0) | **POST** /api/v1/live/channel | 创建直播
[**live_delete_channel**](LiveApi.md#live_delete_channel) | **DELETE** /api/v1/live/channel/{cid} | 删除直播
[**live_delete_channel_0**](LiveApi.md#live_delete_channel_0) | **DELETE** /api/v1/live/channel/{cid} | 删除直播
[**live_update_channel**](LiveApi.md#live_update_channel) | **PUT** /api/v1/live/channel/{cid} | 修改直播
[**live_update_channel_0**](LiveApi.md#live_update_channel_0) | **PUT** /api/v1/live/channel/{cid} | 修改直播
[**start_live_api_v1_live_channel_cid_start_post**](LiveApi.md#start_live_api_v1_live_channel_cid_start_post) | **POST** /api/v1/live/channel/{cid}/start | 开始直播
[**start_live_api_v1_live_channel_cid_start_post_0**](LiveApi.md#start_live_api_v1_live_channel_cid_start_post_0) | **POST** /api/v1/live/channel/{cid}/start | 开始直播
[**stop_live_api_v1_live_channel_cid_stop_post**](LiveApi.md#stop_live_api_v1_live_channel_cid_stop_post) | **POST** /api/v1/live/channel/{cid}/stop | 结束直播
[**stop_live_api_v1_live_channel_cid_stop_post_0**](LiveApi.md#stop_live_api_v1_live_channel_cid_stop_post_0) | **POST** /api/v1/live/channel/{cid}/stop | 结束直播
[**toggle_subscribe_api_v1_live_channel_cid_subscribe_post**](LiveApi.md#toggle_subscribe_api_v1_live_channel_cid_subscribe_post) | **POST** /api/v1/live/channel/{cid}/subscribe | 订阅/取消订阅
[**toggle_subscribe_api_v1_live_channel_cid_subscribe_post_0**](LiveApi.md#toggle_subscribe_api_v1_live_channel_cid_subscribe_post_0) | **POST** /api/v1/live/channel/{cid}/subscribe | 订阅/取消订阅


# **add_comment_api_v1_live_channel_cid_comment_post**
> object add_comment_api_v1_live_channel_cid_comment_post(cid, content, type=type)

发表评论

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
    api_instance = zhs_api.LiveApi(api_client)
    cid = 56 # int | 
    content = 'content_example' # str | 
    type = 1 # int |  (optional) (default to 1)

    try:
        # 发表评论
        api_response = api_instance.add_comment_api_v1_live_channel_cid_comment_post(cid, content, type=type)
        print("The response of LiveApi->add_comment_api_v1_live_channel_cid_comment_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->add_comment_api_v1_live_channel_cid_comment_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cid** | **int**|  | 
 **content** | **str**|  | 
 **type** | **int**|  | [optional] [default to 1]

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

# **add_comment_api_v1_live_channel_cid_comment_post_0**
> object add_comment_api_v1_live_channel_cid_comment_post_0(cid, content, type=type)

发表评论

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
    api_instance = zhs_api.LiveApi(api_client)
    cid = 56 # int | 
    content = 'content_example' # str | 
    type = 1 # int |  (optional) (default to 1)

    try:
        # 发表评论
        api_response = api_instance.add_comment_api_v1_live_channel_cid_comment_post_0(cid, content, type=type)
        print("The response of LiveApi->add_comment_api_v1_live_channel_cid_comment_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->add_comment_api_v1_live_channel_cid_comment_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cid** | **int**|  | 
 **content** | **str**|  | 
 **type** | **int**|  | [optional] [default to 1]

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

# **get_channel_api_v1_live_channel_cid_get**
> object get_channel_api_v1_live_channel_cid_get(cid)

直播详情

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
    api_instance = zhs_api.LiveApi(api_client)
    cid = 56 # int | 

    try:
        # 直播详情
        api_response = api_instance.get_channel_api_v1_live_channel_cid_get(cid)
        print("The response of LiveApi->get_channel_api_v1_live_channel_cid_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->get_channel_api_v1_live_channel_cid_get: %s\n" % e)
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

# **get_channel_api_v1_live_channel_cid_get_0**
> object get_channel_api_v1_live_channel_cid_get_0(cid)

直播详情

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
    api_instance = zhs_api.LiveApi(api_client)
    cid = 56 # int | 

    try:
        # 直播详情
        api_response = api_instance.get_channel_api_v1_live_channel_cid_get_0(cid)
        print("The response of LiveApi->get_channel_api_v1_live_channel_cid_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->get_channel_api_v1_live_channel_cid_get_0: %s\n" % e)
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

# **list_channels_api_v1_live_channel_list_get**
> object list_channels_api_v1_live_channel_list_get(page=page, limit=limit, status=status, category_id=category_id, host_id=host_id, keyword=keyword)

直播列表

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
    api_instance = zhs_api.LiveApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    status = 56 # int |  (optional)
    category_id = 56 # int |  (optional)
    host_id = 'host_id_example' # str |  (optional)
    keyword = 'keyword_example' # str |  (optional)

    try:
        # 直播列表
        api_response = api_instance.list_channels_api_v1_live_channel_list_get(page=page, limit=limit, status=status, category_id=category_id, host_id=host_id, keyword=keyword)
        print("The response of LiveApi->list_channels_api_v1_live_channel_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->list_channels_api_v1_live_channel_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **status** | **int**|  | [optional] 
 **category_id** | **int**|  | [optional] 
 **host_id** | **str**|  | [optional] 
 **keyword** | **str**|  | [optional] 

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

# **list_channels_api_v1_live_channel_list_get_0**
> object list_channels_api_v1_live_channel_list_get_0(page=page, limit=limit, status=status, category_id=category_id, host_id=host_id, keyword=keyword)

直播列表

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
    api_instance = zhs_api.LiveApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    status = 56 # int |  (optional)
    category_id = 56 # int |  (optional)
    host_id = 'host_id_example' # str |  (optional)
    keyword = 'keyword_example' # str |  (optional)

    try:
        # 直播列表
        api_response = api_instance.list_channels_api_v1_live_channel_list_get_0(page=page, limit=limit, status=status, category_id=category_id, host_id=host_id, keyword=keyword)
        print("The response of LiveApi->list_channels_api_v1_live_channel_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->list_channels_api_v1_live_channel_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **status** | **int**|  | [optional] 
 **category_id** | **int**|  | [optional] 
 **host_id** | **str**|  | [optional] 
 **keyword** | **str**|  | [optional] 

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

# **list_comments_api_v1_live_channel_cid_comments_get**
> object list_comments_api_v1_live_channel_cid_comments_get(cid, page=page, limit=limit)

评论列表

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
    api_instance = zhs_api.LiveApi(api_client)
    cid = 56 # int | 
    page = 1 # int |  (optional) (default to 1)
    limit = 50 # int |  (optional) (default to 50)

    try:
        # 评论列表
        api_response = api_instance.list_comments_api_v1_live_channel_cid_comments_get(cid, page=page, limit=limit)
        print("The response of LiveApi->list_comments_api_v1_live_channel_cid_comments_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->list_comments_api_v1_live_channel_cid_comments_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cid** | **int**|  | 
 **page** | **int**|  | [optional] [default to 1]
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

# **list_comments_api_v1_live_channel_cid_comments_get_0**
> object list_comments_api_v1_live_channel_cid_comments_get_0(cid, page=page, limit=limit)

评论列表

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
    api_instance = zhs_api.LiveApi(api_client)
    cid = 56 # int | 
    page = 1 # int |  (optional) (default to 1)
    limit = 50 # int |  (optional) (default to 50)

    try:
        # 评论列表
        api_response = api_instance.list_comments_api_v1_live_channel_cid_comments_get_0(cid, page=page, limit=limit)
        print("The response of LiveApi->list_comments_api_v1_live_channel_cid_comments_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->list_comments_api_v1_live_channel_cid_comments_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cid** | **int**|  | 
 **page** | **int**|  | [optional] [default to 1]
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

# **live_channel_category_list**
> object live_channel_category_list()

直播分类

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
    api_instance = zhs_api.LiveApi(api_client)

    try:
        # 直播分类
        api_response = api_instance.live_channel_category_list()
        print("The response of LiveApi->live_channel_category_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->live_channel_category_list: %s\n" % e)
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

# **live_channel_category_list_0**
> object live_channel_category_list_0()

直播分类

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
    api_instance = zhs_api.LiveApi(api_client)

    try:
        # 直播分类
        api_response = api_instance.live_channel_category_list_0()
        print("The response of LiveApi->live_channel_category_list_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->live_channel_category_list_0: %s\n" % e)
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

# **live_create_channel**
> object live_create_channel(title, description=description, cover=cover, category_id=category_id, type=type, price=price, plan_start_time=plan_start_time, plan_duration=plan_duration)

创建直播

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
    api_instance = zhs_api.LiveApi(api_client)
    title = 'title_example' # str | 
    description = 'description_example' # str |  (optional)
    cover = 'cover_example' # str |  (optional)
    category_id = 56 # int |  (optional)
    type = 1 # int |  (optional) (default to 1)
    price = 0 # int |  (optional) (default to 0)
    plan_start_time = '2013-10-20T19:20:30+01:00' # datetime |  (optional)
    plan_duration = 60 # int |  (optional) (default to 60)

    try:
        # 创建直播
        api_response = api_instance.live_create_channel(title, description=description, cover=cover, category_id=category_id, type=type, price=price, plan_start_time=plan_start_time, plan_duration=plan_duration)
        print("The response of LiveApi->live_create_channel:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->live_create_channel: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**|  | 
 **description** | **str**|  | [optional] 
 **cover** | **str**|  | [optional] 
 **category_id** | **int**|  | [optional] 
 **type** | **int**|  | [optional] [default to 1]
 **price** | **int**|  | [optional] [default to 0]
 **plan_start_time** | **datetime**|  | [optional] 
 **plan_duration** | **int**|  | [optional] [default to 60]

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

# **live_create_channel_0**
> object live_create_channel_0(title, description=description, cover=cover, category_id=category_id, type=type, price=price, plan_start_time=plan_start_time, plan_duration=plan_duration)

创建直播

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
    api_instance = zhs_api.LiveApi(api_client)
    title = 'title_example' # str | 
    description = 'description_example' # str |  (optional)
    cover = 'cover_example' # str |  (optional)
    category_id = 56 # int |  (optional)
    type = 1 # int |  (optional) (default to 1)
    price = 0 # int |  (optional) (default to 0)
    plan_start_time = '2013-10-20T19:20:30+01:00' # datetime |  (optional)
    plan_duration = 60 # int |  (optional) (default to 60)

    try:
        # 创建直播
        api_response = api_instance.live_create_channel_0(title, description=description, cover=cover, category_id=category_id, type=type, price=price, plan_start_time=plan_start_time, plan_duration=plan_duration)
        print("The response of LiveApi->live_create_channel_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->live_create_channel_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**|  | 
 **description** | **str**|  | [optional] 
 **cover** | **str**|  | [optional] 
 **category_id** | **int**|  | [optional] 
 **type** | **int**|  | [optional] [default to 1]
 **price** | **int**|  | [optional] [default to 0]
 **plan_start_time** | **datetime**|  | [optional] 
 **plan_duration** | **int**|  | [optional] [default to 60]

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

# **live_delete_channel**
> object live_delete_channel(cid)

删除直播

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
    api_instance = zhs_api.LiveApi(api_client)
    cid = 56 # int | 

    try:
        # 删除直播
        api_response = api_instance.live_delete_channel(cid)
        print("The response of LiveApi->live_delete_channel:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->live_delete_channel: %s\n" % e)
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

# **live_delete_channel_0**
> object live_delete_channel_0(cid)

删除直播

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
    api_instance = zhs_api.LiveApi(api_client)
    cid = 56 # int | 

    try:
        # 删除直播
        api_response = api_instance.live_delete_channel_0(cid)
        print("The response of LiveApi->live_delete_channel_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->live_delete_channel_0: %s\n" % e)
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

# **live_update_channel**
> object live_update_channel(cid, title=title, description=description, cover=cover, plan_start_time=plan_start_time)

修改直播

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
    api_instance = zhs_api.LiveApi(api_client)
    cid = 56 # int | 
    title = 'title_example' # str |  (optional)
    description = 'description_example' # str |  (optional)
    cover = 'cover_example' # str |  (optional)
    plan_start_time = '2013-10-20T19:20:30+01:00' # datetime |  (optional)

    try:
        # 修改直播
        api_response = api_instance.live_update_channel(cid, title=title, description=description, cover=cover, plan_start_time=plan_start_time)
        print("The response of LiveApi->live_update_channel:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->live_update_channel: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cid** | **int**|  | 
 **title** | **str**|  | [optional] 
 **description** | **str**|  | [optional] 
 **cover** | **str**|  | [optional] 
 **plan_start_time** | **datetime**|  | [optional] 

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

# **live_update_channel_0**
> object live_update_channel_0(cid, title=title, description=description, cover=cover, plan_start_time=plan_start_time)

修改直播

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
    api_instance = zhs_api.LiveApi(api_client)
    cid = 56 # int | 
    title = 'title_example' # str |  (optional)
    description = 'description_example' # str |  (optional)
    cover = 'cover_example' # str |  (optional)
    plan_start_time = '2013-10-20T19:20:30+01:00' # datetime |  (optional)

    try:
        # 修改直播
        api_response = api_instance.live_update_channel_0(cid, title=title, description=description, cover=cover, plan_start_time=plan_start_time)
        print("The response of LiveApi->live_update_channel_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->live_update_channel_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cid** | **int**|  | 
 **title** | **str**|  | [optional] 
 **description** | **str**|  | [optional] 
 **cover** | **str**|  | [optional] 
 **plan_start_time** | **datetime**|  | [optional] 

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

# **start_live_api_v1_live_channel_cid_start_post**
> object start_live_api_v1_live_channel_cid_start_post(cid)

开始直播

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
    api_instance = zhs_api.LiveApi(api_client)
    cid = 56 # int | 

    try:
        # 开始直播
        api_response = api_instance.start_live_api_v1_live_channel_cid_start_post(cid)
        print("The response of LiveApi->start_live_api_v1_live_channel_cid_start_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->start_live_api_v1_live_channel_cid_start_post: %s\n" % e)
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

# **start_live_api_v1_live_channel_cid_start_post_0**
> object start_live_api_v1_live_channel_cid_start_post_0(cid)

开始直播

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
    api_instance = zhs_api.LiveApi(api_client)
    cid = 56 # int | 

    try:
        # 开始直播
        api_response = api_instance.start_live_api_v1_live_channel_cid_start_post_0(cid)
        print("The response of LiveApi->start_live_api_v1_live_channel_cid_start_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->start_live_api_v1_live_channel_cid_start_post_0: %s\n" % e)
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

# **stop_live_api_v1_live_channel_cid_stop_post**
> object stop_live_api_v1_live_channel_cid_stop_post(cid)

结束直播

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
    api_instance = zhs_api.LiveApi(api_client)
    cid = 56 # int | 

    try:
        # 结束直播
        api_response = api_instance.stop_live_api_v1_live_channel_cid_stop_post(cid)
        print("The response of LiveApi->stop_live_api_v1_live_channel_cid_stop_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->stop_live_api_v1_live_channel_cid_stop_post: %s\n" % e)
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

# **stop_live_api_v1_live_channel_cid_stop_post_0**
> object stop_live_api_v1_live_channel_cid_stop_post_0(cid)

结束直播

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
    api_instance = zhs_api.LiveApi(api_client)
    cid = 56 # int | 

    try:
        # 结束直播
        api_response = api_instance.stop_live_api_v1_live_channel_cid_stop_post_0(cid)
        print("The response of LiveApi->stop_live_api_v1_live_channel_cid_stop_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->stop_live_api_v1_live_channel_cid_stop_post_0: %s\n" % e)
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

# **toggle_subscribe_api_v1_live_channel_cid_subscribe_post**
> object toggle_subscribe_api_v1_live_channel_cid_subscribe_post(cid)

订阅/取消订阅

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
    api_instance = zhs_api.LiveApi(api_client)
    cid = 56 # int | 

    try:
        # 订阅/取消订阅
        api_response = api_instance.toggle_subscribe_api_v1_live_channel_cid_subscribe_post(cid)
        print("The response of LiveApi->toggle_subscribe_api_v1_live_channel_cid_subscribe_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->toggle_subscribe_api_v1_live_channel_cid_subscribe_post: %s\n" % e)
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

# **toggle_subscribe_api_v1_live_channel_cid_subscribe_post_0**
> object toggle_subscribe_api_v1_live_channel_cid_subscribe_post_0(cid)

订阅/取消订阅

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
    api_instance = zhs_api.LiveApi(api_client)
    cid = 56 # int | 

    try:
        # 订阅/取消订阅
        api_response = api_instance.toggle_subscribe_api_v1_live_channel_cid_subscribe_post_0(cid)
        print("The response of LiveApi->toggle_subscribe_api_v1_live_channel_cid_subscribe_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LiveApi->toggle_subscribe_api_v1_live_channel_cid_subscribe_post_0: %s\n" % e)
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

