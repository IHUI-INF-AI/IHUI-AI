# zhs_api.UserVideoCommentApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**add_comment_api_v1_user_video_comment_post**](UserVideoCommentApi.md#add_comment_api_v1_user_video_comment_post) | **POST** /api/v1/user-video-comment | 发表视频评论
[**add_comment_api_v1_user_video_comment_post_0**](UserVideoCommentApi.md#add_comment_api_v1_user_video_comment_post_0) | **POST** /api/v1/user-video-comment | 发表视频评论
[**delete_comment_api_v1_user_video_comment_cid_delete**](UserVideoCommentApi.md#delete_comment_api_v1_user_video_comment_cid_delete) | **DELETE** /api/v1/user-video-comment/{cid} | 删除视频评论
[**delete_comment_api_v1_user_video_comment_cid_delete_0**](UserVideoCommentApi.md#delete_comment_api_v1_user_video_comment_cid_delete_0) | **DELETE** /api/v1/user-video-comment/{cid} | 删除视频评论
[**list_comments_api_v1_user_video_comment_list_get**](UserVideoCommentApi.md#list_comments_api_v1_user_video_comment_list_get) | **GET** /api/v1/user-video-comment/list | 视频评论列表
[**list_comments_api_v1_user_video_comment_list_get_0**](UserVideoCommentApi.md#list_comments_api_v1_user_video_comment_list_get_0) | **GET** /api/v1/user-video-comment/list | 视频评论列表


# **add_comment_api_v1_user_video_comment_post**
> object add_comment_api_v1_user_video_comment_post(video_id, content, pid=pid, reply_user_id=reply_user_id, reply_user_name=reply_user_name)

发表视频评论

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
    api_instance = zhs_api.UserVideoCommentApi(api_client)
    video_id = 56 # int | 
    content = 'content_example' # str | 
    pid = 0 # int |  (optional) (default to 0)
    reply_user_id = 'reply_user_id_example' # str |  (optional)
    reply_user_name = 'reply_user_name_example' # str |  (optional)

    try:
        # 发表视频评论
        api_response = api_instance.add_comment_api_v1_user_video_comment_post(video_id, content, pid=pid, reply_user_id=reply_user_id, reply_user_name=reply_user_name)
        print("The response of UserVideoCommentApi->add_comment_api_v1_user_video_comment_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserVideoCommentApi->add_comment_api_v1_user_video_comment_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_id** | **int**|  | 
 **content** | **str**|  | 
 **pid** | **int**|  | [optional] [default to 0]
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

# **add_comment_api_v1_user_video_comment_post_0**
> object add_comment_api_v1_user_video_comment_post_0(video_id, content, pid=pid, reply_user_id=reply_user_id, reply_user_name=reply_user_name)

发表视频评论

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
    api_instance = zhs_api.UserVideoCommentApi(api_client)
    video_id = 56 # int | 
    content = 'content_example' # str | 
    pid = 0 # int |  (optional) (default to 0)
    reply_user_id = 'reply_user_id_example' # str |  (optional)
    reply_user_name = 'reply_user_name_example' # str |  (optional)

    try:
        # 发表视频评论
        api_response = api_instance.add_comment_api_v1_user_video_comment_post_0(video_id, content, pid=pid, reply_user_id=reply_user_id, reply_user_name=reply_user_name)
        print("The response of UserVideoCommentApi->add_comment_api_v1_user_video_comment_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserVideoCommentApi->add_comment_api_v1_user_video_comment_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_id** | **int**|  | 
 **content** | **str**|  | 
 **pid** | **int**|  | [optional] [default to 0]
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

# **delete_comment_api_v1_user_video_comment_cid_delete**
> object delete_comment_api_v1_user_video_comment_cid_delete(cid)

删除视频评论

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
    api_instance = zhs_api.UserVideoCommentApi(api_client)
    cid = 56 # int | 

    try:
        # 删除视频评论
        api_response = api_instance.delete_comment_api_v1_user_video_comment_cid_delete(cid)
        print("The response of UserVideoCommentApi->delete_comment_api_v1_user_video_comment_cid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserVideoCommentApi->delete_comment_api_v1_user_video_comment_cid_delete: %s\n" % e)
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

# **delete_comment_api_v1_user_video_comment_cid_delete_0**
> object delete_comment_api_v1_user_video_comment_cid_delete_0(cid)

删除视频评论

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
    api_instance = zhs_api.UserVideoCommentApi(api_client)
    cid = 56 # int | 

    try:
        # 删除视频评论
        api_response = api_instance.delete_comment_api_v1_user_video_comment_cid_delete_0(cid)
        print("The response of UserVideoCommentApi->delete_comment_api_v1_user_video_comment_cid_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserVideoCommentApi->delete_comment_api_v1_user_video_comment_cid_delete_0: %s\n" % e)
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

# **list_comments_api_v1_user_video_comment_list_get**
> object list_comments_api_v1_user_video_comment_list_get(video_id, page=page, limit=limit)

视频评论列表

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
    api_instance = zhs_api.UserVideoCommentApi(api_client)
    video_id = 56 # int | 
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 视频评论列表
        api_response = api_instance.list_comments_api_v1_user_video_comment_list_get(video_id, page=page, limit=limit)
        print("The response of UserVideoCommentApi->list_comments_api_v1_user_video_comment_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserVideoCommentApi->list_comments_api_v1_user_video_comment_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_id** | **int**|  | 
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

# **list_comments_api_v1_user_video_comment_list_get_0**
> object list_comments_api_v1_user_video_comment_list_get_0(video_id, page=page, limit=limit)

视频评论列表

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
    api_instance = zhs_api.UserVideoCommentApi(api_client)
    video_id = 56 # int | 
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 视频评论列表
        api_response = api_instance.list_comments_api_v1_user_video_comment_list_get_0(video_id, page=page, limit=limit)
        print("The response of UserVideoCommentApi->list_comments_api_v1_user_video_comment_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserVideoCommentApi->list_comments_api_v1_user_video_comment_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_id** | **int**|  | 
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

