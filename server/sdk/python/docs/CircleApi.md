# zhs_api.CircleApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**add_comment_api_v1_circle_post_pid_comment_post**](CircleApi.md#add_comment_api_v1_circle_post_pid_comment_post) | **POST** /api/v1/circle/post/{pid}/comment | 发表评论
[**circle_category_list**](CircleApi.md#circle_category_list) | **GET** /api/v1/circle/category/list | 圈子分类列表
[**create_circle_api_v1_circle_post**](CircleApi.md#create_circle_api_v1_circle_post) | **POST** /api/v1/circle | 创建圈子
[**create_post_api_v1_circle_post_post**](CircleApi.md#create_post_api_v1_circle_post_post) | **POST** /api/v1/circle/post | 发布帖子
[**delete_circle_api_v1_circle_cid_delete**](CircleApi.md#delete_circle_api_v1_circle_cid_delete) | **DELETE** /api/v1/circle/{cid} | 删除圈子
[**delete_post_api_v1_circle_post_pid_delete**](CircleApi.md#delete_post_api_v1_circle_post_pid_delete) | **DELETE** /api/v1/circle/post/{pid} | 删除帖子
[**get_circle_api_v1_circle_cid_get**](CircleApi.md#get_circle_api_v1_circle_cid_get) | **GET** /api/v1/circle/{cid} | 圈子详情
[**get_post_api_v1_circle_post_pid_get**](CircleApi.md#get_post_api_v1_circle_post_pid_get) | **GET** /api/v1/circle/post/{pid} | 帖子详情
[**join_circle_api_v1_circle_cid_join_post**](CircleApi.md#join_circle_api_v1_circle_cid_join_post) | **POST** /api/v1/circle/{cid}/join | 加入圈子
[**list_circles_api_v1_circle_list_get**](CircleApi.md#list_circles_api_v1_circle_list_get) | **GET** /api/v1/circle/list | 圈子列表
[**list_comments_api_v1_circle_post_pid_comments_get**](CircleApi.md#list_comments_api_v1_circle_post_pid_comments_get) | **GET** /api/v1/circle/post/{pid}/comments | 评论列表
[**list_members_api_v1_circle_cid_members_get**](CircleApi.md#list_members_api_v1_circle_cid_members_get) | **GET** /api/v1/circle/{cid}/members | 成员列表
[**list_posts_api_v1_circle_post_list_get**](CircleApi.md#list_posts_api_v1_circle_post_list_get) | **GET** /api/v1/circle/post/list | 帖子列表
[**quit_circle_api_v1_circle_cid_quit_post**](CircleApi.md#quit_circle_api_v1_circle_cid_quit_post) | **POST** /api/v1/circle/{cid}/quit | 退出圈子
[**toggle_like_api_v1_circle_post_pid_like_post**](CircleApi.md#toggle_like_api_v1_circle_post_pid_like_post) | **POST** /api/v1/circle/post/{pid}/like | 点赞/取消点赞
[**update_circle_api_v1_circle_cid_put**](CircleApi.md#update_circle_api_v1_circle_cid_put) | **PUT** /api/v1/circle/{cid} | 修改圈子
[**update_post_api_v1_circle_post_pid_put**](CircleApi.md#update_post_api_v1_circle_post_pid_put) | **PUT** /api/v1/circle/post/{pid} | 修改帖子


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
    api_instance = zhs_api.CircleApi(api_client)
    pid = 56 # int | 
    content = 'content_example' # str | 
    pid2 = 0 # int |  (optional) (default to 0)
    reply_user_id = 'reply_user_id_example' # str |  (optional)
    reply_user_name = 'reply_user_name_example' # str |  (optional)

    try:
        # 发表评论
        api_response = api_instance.add_comment_api_v1_circle_post_pid_comment_post(pid, content, pid2=pid2, reply_user_id=reply_user_id, reply_user_name=reply_user_name)
        print("The response of CircleApi->add_comment_api_v1_circle_post_pid_comment_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleApi->add_comment_api_v1_circle_post_pid_comment_post: %s\n" % e)
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

# **circle_category_list**
> object circle_category_list()

圈子分类列表

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
    api_instance = zhs_api.CircleApi(api_client)

    try:
        # 圈子分类列表
        api_response = api_instance.circle_category_list()
        print("The response of CircleApi->circle_category_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleApi->circle_category_list: %s\n" % e)
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

# **create_circle_api_v1_circle_post**
> object create_circle_api_v1_circle_post(name, description=description, category_id=category_id, avatar=avatar, cover=cover)

创建圈子

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
    api_instance = zhs_api.CircleApi(api_client)
    name = 'name_example' # str | 
    description = 'description_example' # str |  (optional)
    category_id = 56 # int |  (optional)
    avatar = 'avatar_example' # str |  (optional)
    cover = 'cover_example' # str |  (optional)

    try:
        # 创建圈子
        api_response = api_instance.create_circle_api_v1_circle_post(name, description=description, category_id=category_id, avatar=avatar, cover=cover)
        print("The response of CircleApi->create_circle_api_v1_circle_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleApi->create_circle_api_v1_circle_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **str**|  | 
 **description** | **str**|  | [optional] 
 **category_id** | **int**|  | [optional] 
 **avatar** | **str**|  | [optional] 
 **cover** | **str**|  | [optional] 

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
    api_instance = zhs_api.CircleApi(api_client)
    circle_id = 56 # int | 
    content = 'content_example' # str | 
    images = 'images_example' # str |  (optional)
    video = 'video_example' # str |  (optional)

    try:
        # 发布帖子
        api_response = api_instance.create_post_api_v1_circle_post_post(circle_id, content, images=images, video=video)
        print("The response of CircleApi->create_post_api_v1_circle_post_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleApi->create_post_api_v1_circle_post_post: %s\n" % e)
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

# **delete_circle_api_v1_circle_cid_delete**
> object delete_circle_api_v1_circle_cid_delete(cid)

删除圈子

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
    api_instance = zhs_api.CircleApi(api_client)
    cid = 56 # int | 

    try:
        # 删除圈子
        api_response = api_instance.delete_circle_api_v1_circle_cid_delete(cid)
        print("The response of CircleApi->delete_circle_api_v1_circle_cid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleApi->delete_circle_api_v1_circle_cid_delete: %s\n" % e)
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
    api_instance = zhs_api.CircleApi(api_client)
    pid = 56 # int | 

    try:
        # 删除帖子
        api_response = api_instance.delete_post_api_v1_circle_post_pid_delete(pid)
        print("The response of CircleApi->delete_post_api_v1_circle_post_pid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleApi->delete_post_api_v1_circle_post_pid_delete: %s\n" % e)
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

# **get_circle_api_v1_circle_cid_get**
> object get_circle_api_v1_circle_cid_get(cid)

圈子详情

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
    api_instance = zhs_api.CircleApi(api_client)
    cid = 56 # int | 

    try:
        # 圈子详情
        api_response = api_instance.get_circle_api_v1_circle_cid_get(cid)
        print("The response of CircleApi->get_circle_api_v1_circle_cid_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleApi->get_circle_api_v1_circle_cid_get: %s\n" % e)
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
    api_instance = zhs_api.CircleApi(api_client)
    pid = 56 # int | 

    try:
        # 帖子详情
        api_response = api_instance.get_post_api_v1_circle_post_pid_get(pid)
        print("The response of CircleApi->get_post_api_v1_circle_post_pid_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleApi->get_post_api_v1_circle_post_pid_get: %s\n" % e)
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

# **join_circle_api_v1_circle_cid_join_post**
> object join_circle_api_v1_circle_cid_join_post(cid)

加入圈子

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
    api_instance = zhs_api.CircleApi(api_client)
    cid = 56 # int | 

    try:
        # 加入圈子
        api_response = api_instance.join_circle_api_v1_circle_cid_join_post(cid)
        print("The response of CircleApi->join_circle_api_v1_circle_cid_join_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleApi->join_circle_api_v1_circle_cid_join_post: %s\n" % e)
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

# **list_circles_api_v1_circle_list_get**
> object list_circles_api_v1_circle_list_get(page=page, limit=limit, category_id=category_id, keyword=keyword, is_official=is_official)

圈子列表

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
    api_instance = zhs_api.CircleApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    category_id = 56 # int |  (optional)
    keyword = 'keyword_example' # str |  (optional)
    is_official = True # bool |  (optional)

    try:
        # 圈子列表
        api_response = api_instance.list_circles_api_v1_circle_list_get(page=page, limit=limit, category_id=category_id, keyword=keyword, is_official=is_official)
        print("The response of CircleApi->list_circles_api_v1_circle_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleApi->list_circles_api_v1_circle_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **category_id** | **int**|  | [optional] 
 **keyword** | **str**|  | [optional] 
 **is_official** | **bool**|  | [optional] 

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
    api_instance = zhs_api.CircleApi(api_client)
    pid = 56 # int | 
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 评论列表
        api_response = api_instance.list_comments_api_v1_circle_post_pid_comments_get(pid, page=page, limit=limit)
        print("The response of CircleApi->list_comments_api_v1_circle_post_pid_comments_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleApi->list_comments_api_v1_circle_post_pid_comments_get: %s\n" % e)
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

# **list_members_api_v1_circle_cid_members_get**
> object list_members_api_v1_circle_cid_members_get(cid, page=page, limit=limit)

成员列表

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
    api_instance = zhs_api.CircleApi(api_client)
    cid = 56 # int | 
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 成员列表
        api_response = api_instance.list_members_api_v1_circle_cid_members_get(cid, page=page, limit=limit)
        print("The response of CircleApi->list_members_api_v1_circle_cid_members_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleApi->list_members_api_v1_circle_cid_members_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cid** | **int**|  | 
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
    api_instance = zhs_api.CircleApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    circle_id = 56 # int |  (optional)
    user_id = 'user_id_example' # str |  (optional)
    keyword = 'keyword_example' # str |  (optional)
    order_by = 'order_by_example' # str |  (optional)

    try:
        # 帖子列表
        api_response = api_instance.list_posts_api_v1_circle_post_list_get(page=page, limit=limit, circle_id=circle_id, user_id=user_id, keyword=keyword, order_by=order_by)
        print("The response of CircleApi->list_posts_api_v1_circle_post_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleApi->list_posts_api_v1_circle_post_list_get: %s\n" % e)
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

# **quit_circle_api_v1_circle_cid_quit_post**
> object quit_circle_api_v1_circle_cid_quit_post(cid)

退出圈子

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
    api_instance = zhs_api.CircleApi(api_client)
    cid = 56 # int | 

    try:
        # 退出圈子
        api_response = api_instance.quit_circle_api_v1_circle_cid_quit_post(cid)
        print("The response of CircleApi->quit_circle_api_v1_circle_cid_quit_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleApi->quit_circle_api_v1_circle_cid_quit_post: %s\n" % e)
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
    api_instance = zhs_api.CircleApi(api_client)
    pid = 56 # int | 

    try:
        # 点赞/取消点赞
        api_response = api_instance.toggle_like_api_v1_circle_post_pid_like_post(pid)
        print("The response of CircleApi->toggle_like_api_v1_circle_post_pid_like_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleApi->toggle_like_api_v1_circle_post_pid_like_post: %s\n" % e)
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

# **update_circle_api_v1_circle_cid_put**
> object update_circle_api_v1_circle_cid_put(cid, name=name, description=description, avatar=avatar, cover=cover)

修改圈子

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
    api_instance = zhs_api.CircleApi(api_client)
    cid = 56 # int | 
    name = 'name_example' # str |  (optional)
    description = 'description_example' # str |  (optional)
    avatar = 'avatar_example' # str |  (optional)
    cover = 'cover_example' # str |  (optional)

    try:
        # 修改圈子
        api_response = api_instance.update_circle_api_v1_circle_cid_put(cid, name=name, description=description, avatar=avatar, cover=cover)
        print("The response of CircleApi->update_circle_api_v1_circle_cid_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleApi->update_circle_api_v1_circle_cid_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cid** | **int**|  | 
 **name** | **str**|  | [optional] 
 **description** | **str**|  | [optional] 
 **avatar** | **str**|  | [optional] 
 **cover** | **str**|  | [optional] 

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
    api_instance = zhs_api.CircleApi(api_client)
    pid = 56 # int | 
    content = 'content_example' # str |  (optional)
    images = 'images_example' # str |  (optional)
    video = 'video_example' # str |  (optional)

    try:
        # 修改帖子
        api_response = api_instance.update_post_api_v1_circle_post_pid_put(pid, content=content, images=images, video=video)
        print("The response of CircleApi->update_post_api_v1_circle_post_pid_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleApi->update_post_api_v1_circle_post_pid_put: %s\n" % e)
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

