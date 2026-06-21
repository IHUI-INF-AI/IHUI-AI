# zhs_api.CirclePostApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**add_comment_api_v1_circle_post_pid_comment_post**](CirclePostApi.md#add_comment_api_v1_circle_post_pid_comment_post) | **POST** /api/v1/circle/post/{pid}/comment | 发表评论
[**create_post_api_v1_circle_post_post**](CirclePostApi.md#create_post_api_v1_circle_post_post) | **POST** /api/v1/circle/post | 发布帖子
[**delete_post_api_v1_circle_post_pid_delete**](CirclePostApi.md#delete_post_api_v1_circle_post_pid_delete) | **DELETE** /api/v1/circle/post/{pid} | 删除帖子
[**get_post_api_v1_circle_post_pid_get**](CirclePostApi.md#get_post_api_v1_circle_post_pid_get) | **GET** /api/v1/circle/post/{pid} | 帖子详情
[**list_comments_api_v1_circle_post_pid_comments_get**](CirclePostApi.md#list_comments_api_v1_circle_post_pid_comments_get) | **GET** /api/v1/circle/post/{pid}/comments | 评论列表
[**list_posts_api_v1_circle_post_list_get**](CirclePostApi.md#list_posts_api_v1_circle_post_list_get) | **GET** /api/v1/circle/post/list | 帖子列表
[**toggle_like_api_v1_circle_post_pid_like_post**](CirclePostApi.md#toggle_like_api_v1_circle_post_pid_like_post) | **POST** /api/v1/circle/post/{pid}/like | 点赞/取消点赞
[**update_post_api_v1_circle_post_pid_put**](CirclePostApi.md#update_post_api_v1_circle_post_pid_put) | **PUT** /api/v1/circle/post/{pid} | 修改帖子


# **add_comment_api_v1_circle_post_pid_comment_post**
> object add_comment_api_v1_circle_post_pid_comment_post(pid, content, pid2=pid2, reply_user_id=reply_user_id, reply_user_name=reply_user_name)

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
    api_instance = zhs_api.CirclePostApi(api_client)
    pid = 56 # int | 
    content = 'content_example' # str | 
    pid2 = 0 # int |  (optional) (default to 0)
    reply_user_id = 'reply_user_id_example' # str |  (optional)
    reply_user_name = 'reply_user_name_example' # str |  (optional)

    try:
        # 发表评论
        api_response = api_instance.add_comment_api_v1_circle_post_pid_comment_post(pid, content, pid2=pid2, reply_user_id=reply_user_id, reply_user_name=reply_user_name)
        print("The response of CirclePostApi->add_comment_api_v1_circle_post_pid_comment_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CirclePostApi->add_comment_api_v1_circle_post_pid_comment_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pid** | **int**|  | 
 **content** | **str**|  | 
 **pid2** | **int**|  | [optional] [default to 0]
 **reply_user_id** | **str**|  | [optional] 
 **reply_user_name** | **str**|  | [optional] 

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

# **create_post_api_v1_circle_post_post**
> object create_post_api_v1_circle_post_post(circle_id, content, images=images, video=video)

发布帖子

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
    api_instance = zhs_api.CirclePostApi(api_client)
    circle_id = 56 # int | 
    content = 'content_example' # str | 
    images = 'images_example' # str |  (optional)
    video = 'video_example' # str |  (optional)

    try:
        # 发布帖子
        api_response = api_instance.create_post_api_v1_circle_post_post(circle_id, content, images=images, video=video)
        print("The response of CirclePostApi->create_post_api_v1_circle_post_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CirclePostApi->create_post_api_v1_circle_post_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **circle_id** | **int**|  | 
 **content** | **str**|  | 
 **images** | **str**|  | [optional] 
 **video** | **str**|  | [optional] 

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

# **delete_post_api_v1_circle_post_pid_delete**
> object delete_post_api_v1_circle_post_pid_delete(pid)

删除帖子

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
    api_instance = zhs_api.CirclePostApi(api_client)
    pid = 56 # int | 

    try:
        # 删除帖子
        api_response = api_instance.delete_post_api_v1_circle_post_pid_delete(pid)
        print("The response of CirclePostApi->delete_post_api_v1_circle_post_pid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CirclePostApi->delete_post_api_v1_circle_post_pid_delete: %s\n" % e)
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

# **get_post_api_v1_circle_post_pid_get**
> object get_post_api_v1_circle_post_pid_get(pid)

帖子详情

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
    api_instance = zhs_api.CirclePostApi(api_client)
    pid = 56 # int | 

    try:
        # 帖子详情
        api_response = api_instance.get_post_api_v1_circle_post_pid_get(pid)
        print("The response of CirclePostApi->get_post_api_v1_circle_post_pid_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CirclePostApi->get_post_api_v1_circle_post_pid_get: %s\n" % e)
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

# **list_comments_api_v1_circle_post_pid_comments_get**
> object list_comments_api_v1_circle_post_pid_comments_get(pid, page=page, limit=limit)

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
    api_instance = zhs_api.CirclePostApi(api_client)
    pid = 56 # int | 
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 评论列表
        api_response = api_instance.list_comments_api_v1_circle_post_pid_comments_get(pid, page=page, limit=limit)
        print("The response of CirclePostApi->list_comments_api_v1_circle_post_pid_comments_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CirclePostApi->list_comments_api_v1_circle_post_pid_comments_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pid** | **int**|  | 
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]

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

# **list_posts_api_v1_circle_post_list_get**
> object list_posts_api_v1_circle_post_list_get(page=page, limit=limit, circle_id=circle_id, user_id=user_id, keyword=keyword, order_by=order_by)

帖子列表

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
    api_instance = zhs_api.CirclePostApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    circle_id = 56 # int |  (optional)
    user_id = 'user_id_example' # str |  (optional)
    keyword = 'keyword_example' # str |  (optional)
    order_by = 'order_by_example' # str |  (optional)

    try:
        # 帖子列表
        api_response = api_instance.list_posts_api_v1_circle_post_list_get(page=page, limit=limit, circle_id=circle_id, user_id=user_id, keyword=keyword, order_by=order_by)
        print("The response of CirclePostApi->list_posts_api_v1_circle_post_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CirclePostApi->list_posts_api_v1_circle_post_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **circle_id** | **int**|  | [optional] 
 **user_id** | **str**|  | [optional] 
 **keyword** | **str**|  | [optional] 
 **order_by** | **str**|  | [optional] 

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

# **toggle_like_api_v1_circle_post_pid_like_post**
> object toggle_like_api_v1_circle_post_pid_like_post(pid)

点赞/取消点赞

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
    api_instance = zhs_api.CirclePostApi(api_client)
    pid = 56 # int | 

    try:
        # 点赞/取消点赞
        api_response = api_instance.toggle_like_api_v1_circle_post_pid_like_post(pid)
        print("The response of CirclePostApi->toggle_like_api_v1_circle_post_pid_like_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CirclePostApi->toggle_like_api_v1_circle_post_pid_like_post: %s\n" % e)
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

# **update_post_api_v1_circle_post_pid_put**
> object update_post_api_v1_circle_post_pid_put(pid, content=content, images=images, video=video)

修改帖子

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
    api_instance = zhs_api.CirclePostApi(api_client)
    pid = 56 # int | 
    content = 'content_example' # str |  (optional)
    images = 'images_example' # str |  (optional)
    video = 'video_example' # str |  (optional)

    try:
        # 修改帖子
        api_response = api_instance.update_post_api_v1_circle_post_pid_put(pid, content=content, images=images, video=video)
        print("The response of CirclePostApi->update_post_api_v1_circle_post_pid_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CirclePostApi->update_post_api_v1_circle_post_pid_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pid** | **int**|  | 
 **content** | **str**|  | [optional] 
 **images** | **str**|  | [optional] 
 **video** | **str**|  | [optional] 

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

