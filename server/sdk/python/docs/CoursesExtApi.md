# zhs_api.CoursesExtApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**batch_create_videos_api_v1_courses_videos_batch_post**](CoursesExtApi.md#batch_create_videos_api_v1_courses_videos_batch_post) | **POST** /api/v1/courses/videos/batch | 批量创建视频
[**bind_user_platform_api_v1_courses_user_platform_bind_post**](CoursesExtApi.md#bind_user_platform_api_v1_courses_user_platform_bind_post) | **POST** /api/v1/courses/user-platform/bind | 用户绑定教育平台
[**create_comment_api_v1_courses_comments_create_post**](CoursesExtApi.md#create_comment_api_v1_courses_comments_create_post) | **POST** /api/v1/courses/comments/create | 提交课程评论
[**create_platform_api_v1_courses_platforms_create_post**](CoursesExtApi.md#create_platform_api_v1_courses_platforms_create_post) | **POST** /api/v1/courses/platforms/create | 创建教育平台
[**create_video_api_v1_courses_videos_create_post**](CoursesExtApi.md#create_video_api_v1_courses_videos_create_post) | **POST** /api/v1/courses/videos/create | 创建视频
[**create_video_log_api_v1_courses_video_log_post**](CoursesExtApi.md#create_video_log_api_v1_courses_video_log_post) | **POST** /api/v1/courses/video-log | 记录用户视频观看日志
[**delete_comment_api_v1_courses_comments_comment_id_delete**](CoursesExtApi.md#delete_comment_api_v1_courses_comments_comment_id_delete) | **DELETE** /api/v1/courses/comments/{comment_id} | 删除评论（软删除）
[**delete_platform_api_v1_courses_platforms_platform_id_delete**](CoursesExtApi.md#delete_platform_api_v1_courses_platforms_platform_id_delete) | **DELETE** /api/v1/courses/platforms/{platform_id} | 删除教育平台（软删除）
[**delete_video_api_v1_courses_videos_video_id_delete**](CoursesExtApi.md#delete_video_api_v1_courses_videos_video_id_delete) | **DELETE** /api/v1/courses/videos/{video_id} | 删除视频
[**get_category_parent_api_v1_courses_categories_category_id_parent_get**](CoursesExtApi.md#get_category_parent_api_v1_courses_categories_category_id_parent_get) | **GET** /api/v1/courses/categories/{category_id}/parent | 查询分类的父级链
[**get_comment_parent_api_v1_courses_comments_parent_get**](CoursesExtApi.md#get_comment_parent_api_v1_courses_comments_parent_get) | **GET** /api/v1/courses/comments/parent | 查询评论的父级评论
[**get_platform_api_v1_courses_platforms_code_get**](CoursesExtApi.md#get_platform_api_v1_courses_platforms_code_get) | **GET** /api/v1/courses/platforms/{code} | 教育平台详情
[**get_video_api_v1_courses_videos_video_id_get**](CoursesExtApi.md#get_video_api_v1_courses_videos_video_id_get) | **GET** /api/v1/courses/videos/{video_id} | 视频详情
[**issue_video_api_v1_courses_videos_video_id_issue_post**](CoursesExtApi.md#issue_video_api_v1_courses_videos_video_id_issue_post) | **POST** /api/v1/courses/videos/{video_id}/issue | 视频发布/下架
[**list_categories_api_v1_courses_categories_get**](CoursesExtApi.md#list_categories_api_v1_courses_categories_get) | **GET** /api/v1/courses/categories | 课程分类列表
[**list_comments_api_v1_courses_comments_get**](CoursesExtApi.md#list_comments_api_v1_courses_comments_get) | **GET** /api/v1/courses/comments | 课程评论列表
[**list_operate_logs_api_v1_courses_operate_list_get**](CoursesExtApi.md#list_operate_logs_api_v1_courses_operate_list_get) | **GET** /api/v1/courses/operate/list | 用户操作日志列表
[**list_pay_logs_api_v1_courses_pay_logs_get**](CoursesExtApi.md#list_pay_logs_api_v1_courses_pay_logs_get) | **GET** /api/v1/courses/pay-logs | 课程支付日志列表
[**list_platform_logs_api_v1_courses_platform_logs_get**](CoursesExtApi.md#list_platform_logs_api_v1_courses_platform_logs_get) | **GET** /api/v1/courses/platform-logs | 平台操作日志列表
[**list_platforms_api_v1_courses_platforms_get**](CoursesExtApi.md#list_platforms_api_v1_courses_platforms_get) | **GET** /api/v1/courses/platforms | 教育平台列表
[**list_video_logs_api_v1_courses_video_log_list_get**](CoursesExtApi.md#list_video_logs_api_v1_courses_video_log_list_get) | **GET** /api/v1/courses/video-log/list | 用户视频观看日志列表
[**list_videos_api_v1_courses_videos_get**](CoursesExtApi.md#list_videos_api_v1_courses_videos_get) | **GET** /api/v1/courses/videos | 课程视频列表
[**move_video_api_v1_courses_videos_video_id_move_post**](CoursesExtApi.md#move_video_api_v1_courses_videos_video_id_move_post) | **POST** /api/v1/courses/videos/{video_id}/move | 移动视频到其他课程
[**my_platforms_api_v1_courses_user_platform_my_get**](CoursesExtApi.md#my_platforms_api_v1_courses_user_platform_my_get) | **GET** /api/v1/courses/user-platform/my | 我的平台绑定列表
[**my_videos_api_v1_courses_videos_my_get**](CoursesExtApi.md#my_videos_api_v1_courses_videos_my_get) | **GET** /api/v1/courses/videos/my | 我创建的视频
[**pay_course_api_v1_courses_pay_post**](CoursesExtApi.md#pay_course_api_v1_courses_pay_post) | **POST** /api/v1/courses/pay | 课程支付（先用 token 扣减）
[**unbind_user_platform_api_v1_courses_user_platform_unbind_delete**](CoursesExtApi.md#unbind_user_platform_api_v1_courses_user_platform_unbind_delete) | **DELETE** /api/v1/courses/user-platform/unbind | 用户解绑教育平台
[**update_platform_api_v1_courses_platforms_platform_id_put**](CoursesExtApi.md#update_platform_api_v1_courses_platforms_platform_id_put) | **PUT** /api/v1/courses/platforms/{platform_id} | 更新教育平台
[**update_video_api_v1_courses_videos_video_id_put**](CoursesExtApi.md#update_video_api_v1_courses_videos_video_id_put) | **PUT** /api/v1/courses/videos/{video_id} | 更新视频


# **batch_create_videos_api_v1_courses_videos_batch_post**
> object batch_create_videos_api_v1_courses_videos_batch_post(video_batch_create)

批量创建视频

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.video_batch_create import VideoBatchCreate
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CoursesExtApi(api_client)
    video_batch_create = zhs_api.VideoBatchCreate() # VideoBatchCreate | 

    try:
        # 批量创建视频
        api_response = api_instance.batch_create_videos_api_v1_courses_videos_batch_post(video_batch_create)
        print("The response of CoursesExtApi->batch_create_videos_api_v1_courses_videos_batch_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->batch_create_videos_api_v1_courses_videos_batch_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_batch_create** | [**VideoBatchCreate**](VideoBatchCreate.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **bind_user_platform_api_v1_courses_user_platform_bind_post**
> object bind_user_platform_api_v1_courses_user_platform_bind_post(user_platform_bind)

用户绑定教育平台

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.user_platform_bind import UserPlatformBind
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CoursesExtApi(api_client)
    user_platform_bind = zhs_api.UserPlatformBind() # UserPlatformBind | 

    try:
        # 用户绑定教育平台
        api_response = api_instance.bind_user_platform_api_v1_courses_user_platform_bind_post(user_platform_bind)
        print("The response of CoursesExtApi->bind_user_platform_api_v1_courses_user_platform_bind_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->bind_user_platform_api_v1_courses_user_platform_bind_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **user_platform_bind** | [**UserPlatformBind**](UserPlatformBind.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **create_comment_api_v1_courses_comments_create_post**
> object create_comment_api_v1_courses_comments_create_post(app_api_v1_courses_courses_ext_comment_create)

提交课程评论

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.app_api_v1_courses_courses_ext_comment_create import AppApiV1CoursesCoursesExtCommentCreate
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CoursesExtApi(api_client)
    app_api_v1_courses_courses_ext_comment_create = zhs_api.AppApiV1CoursesCoursesExtCommentCreate() # AppApiV1CoursesCoursesExtCommentCreate | 

    try:
        # 提交课程评论
        api_response = api_instance.create_comment_api_v1_courses_comments_create_post(app_api_v1_courses_courses_ext_comment_create)
        print("The response of CoursesExtApi->create_comment_api_v1_courses_comments_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->create_comment_api_v1_courses_comments_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **app_api_v1_courses_courses_ext_comment_create** | [**AppApiV1CoursesCoursesExtCommentCreate**](AppApiV1CoursesCoursesExtCommentCreate.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **create_platform_api_v1_courses_platforms_create_post**
> object create_platform_api_v1_courses_platforms_create_post(platform_create)

创建教育平台

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.platform_create import PlatformCreate
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CoursesExtApi(api_client)
    platform_create = zhs_api.PlatformCreate() # PlatformCreate | 

    try:
        # 创建教育平台
        api_response = api_instance.create_platform_api_v1_courses_platforms_create_post(platform_create)
        print("The response of CoursesExtApi->create_platform_api_v1_courses_platforms_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->create_platform_api_v1_courses_platforms_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform_create** | [**PlatformCreate**](PlatformCreate.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **create_video_api_v1_courses_videos_create_post**
> object create_video_api_v1_courses_videos_create_post(video_create)

创建视频

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.video_create import VideoCreate
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CoursesExtApi(api_client)
    video_create = zhs_api.VideoCreate() # VideoCreate | 

    try:
        # 创建视频
        api_response = api_instance.create_video_api_v1_courses_videos_create_post(video_create)
        print("The response of CoursesExtApi->create_video_api_v1_courses_videos_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->create_video_api_v1_courses_videos_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_create** | [**VideoCreate**](VideoCreate.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **create_video_log_api_v1_courses_video_log_post**
> object create_video_log_api_v1_courses_video_log_post(video_id, course_id, progress=progress, duration=duration)

记录用户视频观看日志

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CoursesExtApi(api_client)
    video_id = 56 # int | 
    course_id = 56 # int | 
    progress = 0 # int | 观看进度(秒) (optional) (default to 0)
    duration = 0 # int | 视频总时长(秒) (optional) (default to 0)

    try:
        # 记录用户视频观看日志
        api_response = api_instance.create_video_log_api_v1_courses_video_log_post(video_id, course_id, progress=progress, duration=duration)
        print("The response of CoursesExtApi->create_video_log_api_v1_courses_video_log_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->create_video_log_api_v1_courses_video_log_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_id** | **int**|  | 
 **course_id** | **int**|  | 
 **progress** | **int**| 观看进度(秒) | [optional] [default to 0]
 **duration** | **int**| 视频总时长(秒) | [optional] [default to 0]

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **delete_comment_api_v1_courses_comments_comment_id_delete**
> object delete_comment_api_v1_courses_comments_comment_id_delete(comment_id)

删除评论（软删除）

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CoursesExtApi(api_client)
    comment_id = 56 # int | 

    try:
        # 删除评论（软删除）
        api_response = api_instance.delete_comment_api_v1_courses_comments_comment_id_delete(comment_id)
        print("The response of CoursesExtApi->delete_comment_api_v1_courses_comments_comment_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->delete_comment_api_v1_courses_comments_comment_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **comment_id** | **int**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **delete_platform_api_v1_courses_platforms_platform_id_delete**
> object delete_platform_api_v1_courses_platforms_platform_id_delete(platform_id)

删除教育平台（软删除）

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CoursesExtApi(api_client)
    platform_id = 56 # int | 

    try:
        # 删除教育平台（软删除）
        api_response = api_instance.delete_platform_api_v1_courses_platforms_platform_id_delete(platform_id)
        print("The response of CoursesExtApi->delete_platform_api_v1_courses_platforms_platform_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->delete_platform_api_v1_courses_platforms_platform_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform_id** | **int**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **delete_video_api_v1_courses_videos_video_id_delete**
> object delete_video_api_v1_courses_videos_video_id_delete(video_id)

删除视频

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CoursesExtApi(api_client)
    video_id = 56 # int | 

    try:
        # 删除视频
        api_response = api_instance.delete_video_api_v1_courses_videos_video_id_delete(video_id)
        print("The response of CoursesExtApi->delete_video_api_v1_courses_videos_video_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->delete_video_api_v1_courses_videos_video_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_id** | **int**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_category_parent_api_v1_courses_categories_category_id_parent_get**
> object get_category_parent_api_v1_courses_categories_category_id_parent_get(category_id)

查询分类的父级链

递归查询分类的父级链，返回从根到当前节点的完整路径。

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
    api_instance = zhs_api.CoursesExtApi(api_client)
    category_id = 56 # int | 

    try:
        # 查询分类的父级链
        api_response = api_instance.get_category_parent_api_v1_courses_categories_category_id_parent_get(category_id)
        print("The response of CoursesExtApi->get_category_parent_api_v1_courses_categories_category_id_parent_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->get_category_parent_api_v1_courses_categories_category_id_parent_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **category_id** | **int**|  | 

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

# **get_comment_parent_api_v1_courses_comments_parent_get**
> object get_comment_parent_api_v1_courses_comments_parent_get(comment_id)

查询评论的父级评论

查询指定评论的父级评论内容。

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
    api_instance = zhs_api.CoursesExtApi(api_client)
    comment_id = 56 # int | 

    try:
        # 查询评论的父级评论
        api_response = api_instance.get_comment_parent_api_v1_courses_comments_parent_get(comment_id)
        print("The response of CoursesExtApi->get_comment_parent_api_v1_courses_comments_parent_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->get_comment_parent_api_v1_courses_comments_parent_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **comment_id** | **int**|  | 

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

# **get_platform_api_v1_courses_platforms_code_get**
> object get_platform_api_v1_courses_platforms_code_get(code)

教育平台详情

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
    api_instance = zhs_api.CoursesExtApi(api_client)
    code = 'code_example' # str | 

    try:
        # 教育平台详情
        api_response = api_instance.get_platform_api_v1_courses_platforms_code_get(code)
        print("The response of CoursesExtApi->get_platform_api_v1_courses_platforms_code_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->get_platform_api_v1_courses_platforms_code_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**|  | 

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

# **get_video_api_v1_courses_videos_video_id_get**
> object get_video_api_v1_courses_videos_video_id_get(video_id)

视频详情

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
    api_instance = zhs_api.CoursesExtApi(api_client)
    video_id = 56 # int | 

    try:
        # 视频详情
        api_response = api_instance.get_video_api_v1_courses_videos_video_id_get(video_id)
        print("The response of CoursesExtApi->get_video_api_v1_courses_videos_video_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->get_video_api_v1_courses_videos_video_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_id** | **int**|  | 

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

# **issue_video_api_v1_courses_videos_video_id_issue_post**
> object issue_video_api_v1_courses_videos_video_id_issue_post(video_id)

视频发布/下架

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CoursesExtApi(api_client)
    video_id = 56 # int | 

    try:
        # 视频发布/下架
        api_response = api_instance.issue_video_api_v1_courses_videos_video_id_issue_post(video_id)
        print("The response of CoursesExtApi->issue_video_api_v1_courses_videos_video_id_issue_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->issue_video_api_v1_courses_videos_video_id_issue_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_id** | **int**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_categories_api_v1_courses_categories_get**
> object list_categories_api_v1_courses_categories_get(status=status)

课程分类列表

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
    api_instance = zhs_api.CoursesExtApi(api_client)
    status = 1 # int | 0 禁用 1 启用 (optional) (default to 1)

    try:
        # 课程分类列表
        api_response = api_instance.list_categories_api_v1_courses_categories_get(status=status)
        print("The response of CoursesExtApi->list_categories_api_v1_courses_categories_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->list_categories_api_v1_courses_categories_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **status** | **int**| 0 禁用 1 启用 | [optional] [default to 1]

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

# **list_comments_api_v1_courses_comments_get**
> object list_comments_api_v1_courses_comments_get(course_id, parent_id=parent_id, page=page, limit=limit)

课程评论列表

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
    api_instance = zhs_api.CoursesExtApi(api_client)
    course_id = 56 # int | 
    parent_id = 56 # int | 父评论 ID，不传则只查顶级 (optional)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 课程评论列表
        api_response = api_instance.list_comments_api_v1_courses_comments_get(course_id, parent_id=parent_id, page=page, limit=limit)
        print("The response of CoursesExtApi->list_comments_api_v1_courses_comments_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->list_comments_api_v1_courses_comments_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **course_id** | **int**|  | 
 **parent_id** | **int**| 父评论 ID，不传则只查顶级 | [optional] 
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

# **list_operate_logs_api_v1_courses_operate_list_get**
> object list_operate_logs_api_v1_courses_operate_list_get(type=type, user_id=user_id, page=page, limit=limit)

用户操作日志列表

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
    api_instance = zhs_api.CoursesExtApi(api_client)
    type = 'type_example' # str | 操作类型: comment / pay / video 等 (optional)
    user_id = 'user_id_example' # str |  (optional)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 用户操作日志列表
        api_response = api_instance.list_operate_logs_api_v1_courses_operate_list_get(type=type, user_id=user_id, page=page, limit=limit)
        print("The response of CoursesExtApi->list_operate_logs_api_v1_courses_operate_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->list_operate_logs_api_v1_courses_operate_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type** | **str**| 操作类型: comment / pay / video 等 | [optional] 
 **user_id** | **str**|  | [optional] 
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

# **list_pay_logs_api_v1_courses_pay_logs_get**
> object list_pay_logs_api_v1_courses_pay_logs_get(course_id=course_id, user_id=user_id, page=page, limit=limit)

课程支付日志列表

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
    api_instance = zhs_api.CoursesExtApi(api_client)
    course_id = 56 # int |  (optional)
    user_id = 'user_id_example' # str |  (optional)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 课程支付日志列表
        api_response = api_instance.list_pay_logs_api_v1_courses_pay_logs_get(course_id=course_id, user_id=user_id, page=page, limit=limit)
        print("The response of CoursesExtApi->list_pay_logs_api_v1_courses_pay_logs_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->list_pay_logs_api_v1_courses_pay_logs_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **course_id** | **int**|  | [optional] 
 **user_id** | **str**|  | [optional] 
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

# **list_platform_logs_api_v1_courses_platform_logs_get**
> object list_platform_logs_api_v1_courses_platform_logs_get(platform_id=platform_id, user_id=user_id, page=page, limit=limit)

平台操作日志列表

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
    api_instance = zhs_api.CoursesExtApi(api_client)
    platform_id = 56 # int |  (optional)
    user_id = 'user_id_example' # str |  (optional)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 平台操作日志列表
        api_response = api_instance.list_platform_logs_api_v1_courses_platform_logs_get(platform_id=platform_id, user_id=user_id, page=page, limit=limit)
        print("The response of CoursesExtApi->list_platform_logs_api_v1_courses_platform_logs_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->list_platform_logs_api_v1_courses_platform_logs_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform_id** | **int**|  | [optional] 
 **user_id** | **str**|  | [optional] 
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

# **list_platforms_api_v1_courses_platforms_get**
> object list_platforms_api_v1_courses_platforms_get(status=status, page=page, limit=limit)

教育平台列表

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
    api_instance = zhs_api.CoursesExtApi(api_client)
    status = 1 # int |  (optional) (default to 1)
    page = 1 # int |  (optional) (default to 1)
    limit = 100 # int |  (optional) (default to 100)

    try:
        # 教育平台列表
        api_response = api_instance.list_platforms_api_v1_courses_platforms_get(status=status, page=page, limit=limit)
        print("The response of CoursesExtApi->list_platforms_api_v1_courses_platforms_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->list_platforms_api_v1_courses_platforms_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **status** | **int**|  | [optional] [default to 1]
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 100]

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

# **list_video_logs_api_v1_courses_video_log_list_get**
> object list_video_logs_api_v1_courses_video_log_list_get(course_id=course_id, page=page, limit=limit)

用户视频观看日志列表

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CoursesExtApi(api_client)
    course_id = 56 # int |  (optional)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 用户视频观看日志列表
        api_response = api_instance.list_video_logs_api_v1_courses_video_log_list_get(course_id=course_id, page=page, limit=limit)
        print("The response of CoursesExtApi->list_video_logs_api_v1_courses_video_log_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->list_video_logs_api_v1_courses_video_log_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **course_id** | **int**|  | [optional] 
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_videos_api_v1_courses_videos_get**
> object list_videos_api_v1_courses_videos_get(course_id, is_pay=is_pay, page=page, limit=limit)

课程视频列表

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
    api_instance = zhs_api.CoursesExtApi(api_client)
    course_id = 56 # int | 
    is_pay = 56 # int | 0 免费 1 付费 (optional)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 课程视频列表
        api_response = api_instance.list_videos_api_v1_courses_videos_get(course_id, is_pay=is_pay, page=page, limit=limit)
        print("The response of CoursesExtApi->list_videos_api_v1_courses_videos_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->list_videos_api_v1_courses_videos_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **course_id** | **int**|  | 
 **is_pay** | **int**| 0 免费 1 付费 | [optional] 
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

# **move_video_api_v1_courses_videos_video_id_move_post**
> object move_video_api_v1_courses_videos_video_id_move_post(video_id, target_course_id)

移动视频到其他课程

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CoursesExtApi(api_client)
    video_id = 56 # int | 
    target_course_id = 56 # int | 目标课程 ID

    try:
        # 移动视频到其他课程
        api_response = api_instance.move_video_api_v1_courses_videos_video_id_move_post(video_id, target_course_id)
        print("The response of CoursesExtApi->move_video_api_v1_courses_videos_video_id_move_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->move_video_api_v1_courses_videos_video_id_move_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_id** | **int**|  | 
 **target_course_id** | **int**| 目标课程 ID | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **my_platforms_api_v1_courses_user_platform_my_get**
> object my_platforms_api_v1_courses_user_platform_my_get()

我的平台绑定列表

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CoursesExtApi(api_client)

    try:
        # 我的平台绑定列表
        api_response = api_instance.my_platforms_api_v1_courses_user_platform_my_get()
        print("The response of CoursesExtApi->my_platforms_api_v1_courses_user_platform_my_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->my_platforms_api_v1_courses_user_platform_my_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **my_videos_api_v1_courses_videos_my_get**
> object my_videos_api_v1_courses_videos_my_get(page=page, limit=limit)

我创建的视频

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CoursesExtApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 我创建的视频
        api_response = api_instance.my_videos_api_v1_courses_videos_my_get(page=page, limit=limit)
        print("The response of CoursesExtApi->my_videos_api_v1_courses_videos_my_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->my_videos_api_v1_courses_videos_my_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pay_course_api_v1_courses_pay_post**
> object pay_course_api_v1_courses_pay_post(course_id, cost_tokens, pay_type=pay_type)

课程支付（先用 token 扣减）

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CoursesExtApi(api_client)
    course_id = 56 # int | 
    cost_tokens = 56 # int | 所需 token
    pay_type = 0 # int | 0 token 1 微信 2 支付宝 (optional) (default to 0)

    try:
        # 课程支付（先用 token 扣减）
        api_response = api_instance.pay_course_api_v1_courses_pay_post(course_id, cost_tokens, pay_type=pay_type)
        print("The response of CoursesExtApi->pay_course_api_v1_courses_pay_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->pay_course_api_v1_courses_pay_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **course_id** | **int**|  | 
 **cost_tokens** | **int**| 所需 token | 
 **pay_type** | **int**| 0 token 1 微信 2 支付宝 | [optional] [default to 0]

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **unbind_user_platform_api_v1_courses_user_platform_unbind_delete**
> object unbind_user_platform_api_v1_courses_user_platform_unbind_delete(platform_id)

用户解绑教育平台

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CoursesExtApi(api_client)
    platform_id = 56 # int | 

    try:
        # 用户解绑教育平台
        api_response = api_instance.unbind_user_platform_api_v1_courses_user_platform_unbind_delete(platform_id)
        print("The response of CoursesExtApi->unbind_user_platform_api_v1_courses_user_platform_unbind_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->unbind_user_platform_api_v1_courses_user_platform_unbind_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform_id** | **int**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **update_platform_api_v1_courses_platforms_platform_id_put**
> object update_platform_api_v1_courses_platforms_platform_id_put(platform_id, platform_update)

更新教育平台

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.platform_update import PlatformUpdate
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CoursesExtApi(api_client)
    platform_id = 56 # int | 
    platform_update = zhs_api.PlatformUpdate() # PlatformUpdate | 

    try:
        # 更新教育平台
        api_response = api_instance.update_platform_api_v1_courses_platforms_platform_id_put(platform_id, platform_update)
        print("The response of CoursesExtApi->update_platform_api_v1_courses_platforms_platform_id_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->update_platform_api_v1_courses_platforms_platform_id_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform_id** | **int**|  | 
 **platform_update** | [**PlatformUpdate**](PlatformUpdate.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **update_video_api_v1_courses_videos_video_id_put**
> object update_video_api_v1_courses_videos_video_id_put(video_id, video_update)

更新视频

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.video_update import VideoUpdate
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CoursesExtApi(api_client)
    video_id = 56 # int | 
    video_update = zhs_api.VideoUpdate() # VideoUpdate | 

    try:
        # 更新视频
        api_response = api_instance.update_video_api_v1_courses_videos_video_id_put(video_id, video_update)
        print("The response of CoursesExtApi->update_video_api_v1_courses_videos_video_id_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesExtApi->update_video_api_v1_courses_videos_video_id_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_id** | **int**|  | 
 **video_update** | [**VideoUpdate**](VideoUpdate.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

