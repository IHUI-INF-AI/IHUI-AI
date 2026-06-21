# zhs_api.UserCommentLogApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**record_log_api_v1_user_comment_log_record_post**](UserCommentLogApi.md#record_log_api_v1_user_comment_log_record_post) | **POST** /api/v1/user-comment-log/record | 记录评论日志
[**record_log_api_v1_user_comment_log_record_post_0**](UserCommentLogApi.md#record_log_api_v1_user_comment_log_record_post_0) | **POST** /api/v1/user-comment-log/record | 记录评论日志
[**user_comment_log_list**](UserCommentLogApi.md#user_comment_log_list) | **GET** /api/v1/user-comment-log/list | 评论日志
[**user_comment_log_list_0**](UserCommentLogApi.md#user_comment_log_list_0) | **GET** /api/v1/user-comment-log/list | 评论日志


# **record_log_api_v1_user_comment_log_record_post**
> object record_log_api_v1_user_comment_log_record_post(target_type, target_id, comment_id, content, action=action, ip=ip)

记录评论日志

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
    api_instance = zhs_api.UserCommentLogApi(api_client)
    target_type = 'target_type_example' # str | 
    target_id = 56 # int | 
    comment_id = 56 # int | 
    content = 'content_example' # str | 
    action = 'add' # str |  (optional) (default to 'add')
    ip = 'ip_example' # str |  (optional)

    try:
        # 记录评论日志
        api_response = api_instance.record_log_api_v1_user_comment_log_record_post(target_type, target_id, comment_id, content, action=action, ip=ip)
        print("The response of UserCommentLogApi->record_log_api_v1_user_comment_log_record_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserCommentLogApi->record_log_api_v1_user_comment_log_record_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **target_type** | **str**|  | 
 **target_id** | **int**|  | 
 **comment_id** | **int**|  | 
 **content** | **str**|  | 
 **action** | **str**|  | [optional] [default to &#39;add&#39;]
 **ip** | **str**|  | [optional] 

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

# **record_log_api_v1_user_comment_log_record_post_0**
> object record_log_api_v1_user_comment_log_record_post_0(target_type, target_id, comment_id, content, action=action, ip=ip)

记录评论日志

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
    api_instance = zhs_api.UserCommentLogApi(api_client)
    target_type = 'target_type_example' # str | 
    target_id = 56 # int | 
    comment_id = 56 # int | 
    content = 'content_example' # str | 
    action = 'add' # str |  (optional) (default to 'add')
    ip = 'ip_example' # str |  (optional)

    try:
        # 记录评论日志
        api_response = api_instance.record_log_api_v1_user_comment_log_record_post_0(target_type, target_id, comment_id, content, action=action, ip=ip)
        print("The response of UserCommentLogApi->record_log_api_v1_user_comment_log_record_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserCommentLogApi->record_log_api_v1_user_comment_log_record_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **target_type** | **str**|  | 
 **target_id** | **int**|  | 
 **comment_id** | **int**|  | 
 **content** | **str**|  | 
 **action** | **str**|  | [optional] [default to &#39;add&#39;]
 **ip** | **str**|  | [optional] 

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

# **user_comment_log_list**
> object user_comment_log_list(page=page, limit=limit, user_id=user_id, target_type=target_type, action=action)

评论日志

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
    api_instance = zhs_api.UserCommentLogApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    user_id = 'user_id_example' # str |  (optional)
    target_type = 'target_type_example' # str |  (optional)
    action = 'action_example' # str |  (optional)

    try:
        # 评论日志
        api_response = api_instance.user_comment_log_list(page=page, limit=limit, user_id=user_id, target_type=target_type, action=action)
        print("The response of UserCommentLogApi->user_comment_log_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserCommentLogApi->user_comment_log_list: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **user_id** | **str**|  | [optional] 
 **target_type** | **str**|  | [optional] 
 **action** | **str**|  | [optional] 

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

# **user_comment_log_list_0**
> object user_comment_log_list_0(page=page, limit=limit, user_id=user_id, target_type=target_type, action=action)

评论日志

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
    api_instance = zhs_api.UserCommentLogApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    user_id = 'user_id_example' # str |  (optional)
    target_type = 'target_type_example' # str |  (optional)
    action = 'action_example' # str |  (optional)

    try:
        # 评论日志
        api_response = api_instance.user_comment_log_list_0(page=page, limit=limit, user_id=user_id, target_type=target_type, action=action)
        print("The response of UserCommentLogApi->user_comment_log_list_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserCommentLogApi->user_comment_log_list_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **user_id** | **str**|  | [optional] 
 **target_type** | **str**|  | [optional] 
 **action** | **str**|  | [optional] 

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

