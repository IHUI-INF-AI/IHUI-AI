# zhs_api.AskQuestionApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ask_question_add_comment**](AskQuestionApi.md#ask_question_add_comment) | **POST** /api/v1/ask/question/comment | 发表评论
[**ask_question_toggle_favorite**](AskQuestionApi.md#ask_question_toggle_favorite) | **POST** /api/v1/ask/question/favorite | 收藏/取消收藏
[**ask_question_toggle_like**](AskQuestionApi.md#ask_question_toggle_like) | **POST** /api/v1/ask/question/like | 点赞/取消点赞
[**create_question_api_v1_ask_question_post**](AskQuestionApi.md#create_question_api_v1_ask_question_post) | **POST** /api/v1/ask/question | 提出问题
[**delete_question_api_v1_ask_question_delete**](AskQuestionApi.md#delete_question_api_v1_ask_question_delete) | **DELETE** /api/v1/ask/question | 删除问题
[**get_question_api_v1_ask_question_public_api_get**](AskQuestionApi.md#get_question_api_v1_ask_question_public_api_get) | **GET** /api/v1/ask/question/public-api | 问题详情
[**list_questions_api_v1_ask_question_list_get**](AskQuestionApi.md#list_questions_api_v1_ask_question_list_get) | **GET** /api/v1/ask/question/list | 问题列表(需权限)
[**member_question_count_api_v1_ask_question_public_api_member_count_get**](AskQuestionApi.md#member_question_count_api_v1_ask_question_public_api_member_count_get) | **GET** /api/v1/ask/question/public-api/member/count | 会员问题数
[**public_list_questions_api_v1_ask_question_public_api_list_get**](AskQuestionApi.md#public_list_questions_api_v1_ask_question_public_api_list_get) | **GET** /api/v1/ask/question/public-api/list | 问题列表(公开)
[**update_question_api_v1_ask_question_put**](AskQuestionApi.md#update_question_api_v1_ask_question_put) | **PUT** /api/v1/ask/question | 修改问题


# **ask_question_add_comment**
> object ask_question_add_comment(app_schemas_ask_comment_create)

发表评论

### Example


```python
import zhs_api
from zhs_api.models.app_schemas_ask_comment_create import AppSchemasAskCommentCreate
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
    api_instance = zhs_api.AskQuestionApi(api_client)
    app_schemas_ask_comment_create = zhs_api.AppSchemasAskCommentCreate() # AppSchemasAskCommentCreate | 

    try:
        # 发表评论
        api_response = api_instance.ask_question_add_comment(app_schemas_ask_comment_create)
        print("The response of AskQuestionApi->ask_question_add_comment:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskQuestionApi->ask_question_add_comment: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **app_schemas_ask_comment_create** | [**AppSchemasAskCommentCreate**](AppSchemasAskCommentCreate.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **ask_question_toggle_favorite**
> object ask_question_toggle_favorite(target_type, target_id)

收藏/取消收藏

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
    api_instance = zhs_api.AskQuestionApi(api_client)
    target_type = 'target_type_example' # str | 
    target_id = 56 # int | 

    try:
        # 收藏/取消收藏
        api_response = api_instance.ask_question_toggle_favorite(target_type, target_id)
        print("The response of AskQuestionApi->ask_question_toggle_favorite:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskQuestionApi->ask_question_toggle_favorite: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **target_type** | **str**|  | 
 **target_id** | **int**|  | 

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

# **ask_question_toggle_like**
> object ask_question_toggle_like(target_type, target_id)

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
    api_instance = zhs_api.AskQuestionApi(api_client)
    target_type = 'target_type_example' # str | 
    target_id = 56 # int | 

    try:
        # 点赞/取消点赞
        api_response = api_instance.ask_question_toggle_like(target_type, target_id)
        print("The response of AskQuestionApi->ask_question_toggle_like:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskQuestionApi->ask_question_toggle_like: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **target_type** | **str**|  | 
 **target_id** | **int**|  | 

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

# **create_question_api_v1_ask_question_post**
> object create_question_api_v1_ask_question_post(question_create)

提出问题

### Example


```python
import zhs_api
from zhs_api.models.question_create import QuestionCreate
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
    api_instance = zhs_api.AskQuestionApi(api_client)
    question_create = zhs_api.QuestionCreate() # QuestionCreate | 

    try:
        # 提出问题
        api_response = api_instance.create_question_api_v1_ask_question_post(question_create)
        print("The response of AskQuestionApi->create_question_api_v1_ask_question_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskQuestionApi->create_question_api_v1_ask_question_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **question_create** | [**QuestionCreate**](QuestionCreate.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **delete_question_api_v1_ask_question_delete**
> object delete_question_api_v1_ask_question_delete(id)

删除问题

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
    api_instance = zhs_api.AskQuestionApi(api_client)
    id = 56 # int | 

    try:
        # 删除问题
        api_response = api_instance.delete_question_api_v1_ask_question_delete(id)
        print("The response of AskQuestionApi->delete_question_api_v1_ask_question_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskQuestionApi->delete_question_api_v1_ask_question_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **int**|  | 

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

# **get_question_api_v1_ask_question_public_api_get**
> object get_question_api_v1_ask_question_public_api_get(id)

问题详情

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
    api_instance = zhs_api.AskQuestionApi(api_client)
    id = 56 # int | 

    try:
        # 问题详情
        api_response = api_instance.get_question_api_v1_ask_question_public_api_get(id)
        print("The response of AskQuestionApi->get_question_api_v1_ask_question_public_api_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskQuestionApi->get_question_api_v1_ask_question_public_api_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **int**|  | 

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

# **list_questions_api_v1_ask_question_list_get**
> object list_questions_api_v1_ask_question_list_get(page=page, limit=limit, keyword=keyword, status=status, cid=cid, member_id=member_id, order_column=order_column, order_direction=order_direction)

问题列表(需权限)

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
    api_instance = zhs_api.AskQuestionApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 10 # int |  (optional) (default to 10)
    keyword = 'keyword_example' # str |  (optional)
    status = 'status_example' # str |  (optional)
    cid = 56 # int |  (optional)
    member_id = 'member_id_example' # str |  (optional)
    order_column = 'order_column_example' # str |  (optional)
    order_direction = 'order_direction_example' # str |  (optional)

    try:
        # 问题列表(需权限)
        api_response = api_instance.list_questions_api_v1_ask_question_list_get(page=page, limit=limit, keyword=keyword, status=status, cid=cid, member_id=member_id, order_column=order_column, order_direction=order_direction)
        print("The response of AskQuestionApi->list_questions_api_v1_ask_question_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskQuestionApi->list_questions_api_v1_ask_question_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 10]
 **keyword** | **str**|  | [optional] 
 **status** | **str**|  | [optional] 
 **cid** | **int**|  | [optional] 
 **member_id** | **str**|  | [optional] 
 **order_column** | **str**|  | [optional] 
 **order_direction** | **str**|  | [optional] 

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

# **member_question_count_api_v1_ask_question_public_api_member_count_get**
> object member_question_count_api_v1_ask_question_public_api_member_count_get(member_id=member_id)

会员问题数

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
    api_instance = zhs_api.AskQuestionApi(api_client)
    member_id = 'member_id_example' # str |  (optional)

    try:
        # 会员问题数
        api_response = api_instance.member_question_count_api_v1_ask_question_public_api_member_count_get(member_id=member_id)
        print("The response of AskQuestionApi->member_question_count_api_v1_ask_question_public_api_member_count_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskQuestionApi->member_question_count_api_v1_ask_question_public_api_member_count_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **member_id** | **str**|  | [optional] 

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

# **public_list_questions_api_v1_ask_question_public_api_list_get**
> object public_list_questions_api_v1_ask_question_public_api_list_get(page=page, limit=limit, keyword=keyword, cid=cid, order_column=order_column, order_direction=order_direction)

问题列表(公开)

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
    api_instance = zhs_api.AskQuestionApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 10 # int |  (optional) (default to 10)
    keyword = 'keyword_example' # str |  (optional)
    cid = 56 # int |  (optional)
    order_column = 'order_column_example' # str |  (optional)
    order_direction = 'order_direction_example' # str |  (optional)

    try:
        # 问题列表(公开)
        api_response = api_instance.public_list_questions_api_v1_ask_question_public_api_list_get(page=page, limit=limit, keyword=keyword, cid=cid, order_column=order_column, order_direction=order_direction)
        print("The response of AskQuestionApi->public_list_questions_api_v1_ask_question_public_api_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskQuestionApi->public_list_questions_api_v1_ask_question_public_api_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 10]
 **keyword** | **str**|  | [optional] 
 **cid** | **int**|  | [optional] 
 **order_column** | **str**|  | [optional] 
 **order_direction** | **str**|  | [optional] 

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

# **update_question_api_v1_ask_question_put**
> object update_question_api_v1_ask_question_put(question_update)

修改问题

### Example


```python
import zhs_api
from zhs_api.models.question_update import QuestionUpdate
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
    api_instance = zhs_api.AskQuestionApi(api_client)
    question_update = zhs_api.QuestionUpdate() # QuestionUpdate | 

    try:
        # 修改问题
        api_response = api_instance.update_question_api_v1_ask_question_put(question_update)
        print("The response of AskQuestionApi->update_question_api_v1_ask_question_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskQuestionApi->update_question_api_v1_ask_question_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **question_update** | [**QuestionUpdate**](QuestionUpdate.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

