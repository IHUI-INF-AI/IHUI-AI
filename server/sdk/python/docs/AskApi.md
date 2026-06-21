# zhs_api.AskApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**add_category_api_v1_ask_category_post**](AskApi.md#add_category_api_v1_ask_category_post) | **POST** /api/v1/ask/category | 添加分类
[**adopt_answer_api_v1_ask_answer_adopt_put**](AskApi.md#adopt_answer_api_v1_ask_answer_adopt_put) | **PUT** /api/v1/ask/answer/adopt | 采纳回答
[**ask_category_admin_list**](AskApi.md#ask_category_admin_list) | **GET** /api/v1/ask/category/admin/list | 分类列表(管理员)
[**ask_question_add_comment**](AskApi.md#ask_question_add_comment) | **POST** /api/v1/ask/question/comment | 发表评论
[**ask_question_toggle_favorite**](AskApi.md#ask_question_toggle_favorite) | **POST** /api/v1/ask/question/favorite | 收藏/取消收藏
[**ask_question_toggle_like**](AskApi.md#ask_question_toggle_like) | **POST** /api/v1/ask/question/like | 点赞/取消点赞
[**change_show_api_v1_ask_category_is_show_put**](AskApi.md#change_show_api_v1_ask_category_is_show_put) | **PUT** /api/v1/ask/category/is-show | 修改显示状态
[**change_show_index_api_v1_ask_category_is_show_index_put**](AskApi.md#change_show_index_api_v1_ask_category_is_show_index_put) | **PUT** /api/v1/ask/category/is-show-index | 修改首页显示状态
[**create_answer_api_v1_ask_answer_post**](AskApi.md#create_answer_api_v1_ask_answer_post) | **POST** /api/v1/ask/answer | 提出回答
[**create_question_api_v1_ask_question_post**](AskApi.md#create_question_api_v1_ask_question_post) | **POST** /api/v1/ask/question | 提出问题
[**delete_answer_api_v1_ask_answer_delete**](AskApi.md#delete_answer_api_v1_ask_answer_delete) | **DELETE** /api/v1/ask/answer | 删除回答
[**delete_category_api_v1_ask_category_cat_id_delete**](AskApi.md#delete_category_api_v1_ask_category_cat_id_delete) | **DELETE** /api/v1/ask/category/{cat_id} | 删除分类
[**delete_question_api_v1_ask_question_delete**](AskApi.md#delete_question_api_v1_ask_question_delete) | **DELETE** /api/v1/ask/question | 删除问题
[**get_answer_api_v1_ask_answer_public_api_get**](AskApi.md#get_answer_api_v1_ask_answer_public_api_get) | **GET** /api/v1/ask/answer/public-api | 回答详情
[**get_category_api_v1_ask_category_cat_id_get**](AskApi.md#get_category_api_v1_ask_category_cat_id_get) | **GET** /api/v1/ask/category/{cat_id} | 分类详情
[**get_question_api_v1_ask_question_public_api_get**](AskApi.md#get_question_api_v1_ask_question_public_api_get) | **GET** /api/v1/ask/question/public-api | 问题详情
[**list_answers_api_v1_ask_answer_list_get**](AskApi.md#list_answers_api_v1_ask_answer_list_get) | **GET** /api/v1/ask/answer/list | 回答列表(需权限)
[**list_questions_api_v1_ask_question_list_get**](AskApi.md#list_questions_api_v1_ask_question_list_get) | **GET** /api/v1/ask/question/list | 问题列表(需权限)
[**member_answer_count_api_v1_ask_answer_public_api_member_count_get**](AskApi.md#member_answer_count_api_v1_ask_answer_public_api_member_count_get) | **GET** /api/v1/ask/answer/public-api/member/count | 会员回答数
[**member_question_count_api_v1_ask_question_public_api_member_count_get**](AskApi.md#member_question_count_api_v1_ask_question_public_api_member_count_get) | **GET** /api/v1/ask/question/public-api/member/count | 会员问题数
[**public_list_answers_api_v1_ask_answer_public_api_list_get**](AskApi.md#public_list_answers_api_v1_ask_answer_public_api_list_get) | **GET** /api/v1/ask/answer/public-api/list | 回答列表(公开)
[**public_list_api_v1_ask_category_public_api_list_get**](AskApi.md#public_list_api_v1_ask_category_public_api_list_get) | **GET** /api/v1/ask/category/public-api/list | 分类列表(公开)
[**public_list_questions_api_v1_ask_question_public_api_list_get**](AskApi.md#public_list_questions_api_v1_ask_question_public_api_list_get) | **GET** /api/v1/ask/question/public-api/list | 问题列表(公开)
[**update_answer_api_v1_ask_answer_put**](AskApi.md#update_answer_api_v1_ask_answer_put) | **PUT** /api/v1/ask/answer | 修改回答
[**update_category_api_v1_ask_category_put**](AskApi.md#update_category_api_v1_ask_category_put) | **PUT** /api/v1/ask/category | 修改分类
[**update_question_api_v1_ask_question_put**](AskApi.md#update_question_api_v1_ask_question_put) | **PUT** /api/v1/ask/question | 修改问题


# **add_category_api_v1_ask_category_post**
> object add_category_api_v1_ask_category_post(category_create)

添加分类

### Example


```python
import zhs_api
from zhs_api.models.category_create import CategoryCreate
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
    api_instance = zhs_api.AskApi(api_client)
    category_create = zhs_api.CategoryCreate() # CategoryCreate | 

    try:
        # 添加分类
        api_response = api_instance.add_category_api_v1_ask_category_post(category_create)
        print("The response of AskApi->add_category_api_v1_ask_category_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->add_category_api_v1_ask_category_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **category_create** | [**CategoryCreate**](CategoryCreate.md)|  | 

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

# **adopt_answer_api_v1_ask_answer_adopt_put**
> object adopt_answer_api_v1_ask_answer_adopt_put(id)

采纳回答

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
    api_instance = zhs_api.AskApi(api_client)
    id = 56 # int | 

    try:
        # 采纳回答
        api_response = api_instance.adopt_answer_api_v1_ask_answer_adopt_put(id)
        print("The response of AskApi->adopt_answer_api_v1_ask_answer_adopt_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->adopt_answer_api_v1_ask_answer_adopt_put: %s\n" % e)
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

# **ask_category_admin_list**
> object ask_category_admin_list(is_show=is_show, is_show_index=is_show_index)

分类列表(管理员)

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
    api_instance = zhs_api.AskApi(api_client)
    is_show = True # bool |  (optional)
    is_show_index = True # bool |  (optional)

    try:
        # 分类列表(管理员)
        api_response = api_instance.ask_category_admin_list(is_show=is_show, is_show_index=is_show_index)
        print("The response of AskApi->ask_category_admin_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->ask_category_admin_list: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **is_show** | **bool**|  | [optional] 
 **is_show_index** | **bool**|  | [optional] 

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
    api_instance = zhs_api.AskApi(api_client)
    app_schemas_ask_comment_create = zhs_api.AppSchemasAskCommentCreate() # AppSchemasAskCommentCreate | 

    try:
        # 发表评论
        api_response = api_instance.ask_question_add_comment(app_schemas_ask_comment_create)
        print("The response of AskApi->ask_question_add_comment:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->ask_question_add_comment: %s\n" % e)
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
    api_instance = zhs_api.AskApi(api_client)
    target_type = 'target_type_example' # str | 
    target_id = 56 # int | 

    try:
        # 收藏/取消收藏
        api_response = api_instance.ask_question_toggle_favorite(target_type, target_id)
        print("The response of AskApi->ask_question_toggle_favorite:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->ask_question_toggle_favorite: %s\n" % e)
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
    api_instance = zhs_api.AskApi(api_client)
    target_type = 'target_type_example' # str | 
    target_id = 56 # int | 

    try:
        # 点赞/取消点赞
        api_response = api_instance.ask_question_toggle_like(target_type, target_id)
        print("The response of AskApi->ask_question_toggle_like:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->ask_question_toggle_like: %s\n" % e)
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

# **change_show_api_v1_ask_category_is_show_put**
> object change_show_api_v1_ask_category_is_show_put(id, is_show)

修改显示状态

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
    api_instance = zhs_api.AskApi(api_client)
    id = 56 # int | 
    is_show = True # bool | 

    try:
        # 修改显示状态
        api_response = api_instance.change_show_api_v1_ask_category_is_show_put(id, is_show)
        print("The response of AskApi->change_show_api_v1_ask_category_is_show_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->change_show_api_v1_ask_category_is_show_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **int**|  | 
 **is_show** | **bool**|  | 

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

# **change_show_index_api_v1_ask_category_is_show_index_put**
> object change_show_index_api_v1_ask_category_is_show_index_put(id, is_show_index)

修改首页显示状态

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
    api_instance = zhs_api.AskApi(api_client)
    id = 56 # int | 
    is_show_index = True # bool | 

    try:
        # 修改首页显示状态
        api_response = api_instance.change_show_index_api_v1_ask_category_is_show_index_put(id, is_show_index)
        print("The response of AskApi->change_show_index_api_v1_ask_category_is_show_index_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->change_show_index_api_v1_ask_category_is_show_index_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **int**|  | 
 **is_show_index** | **bool**|  | 

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

# **create_answer_api_v1_ask_answer_post**
> object create_answer_api_v1_ask_answer_post(answer_create)

提出回答

### Example


```python
import zhs_api
from zhs_api.models.answer_create import AnswerCreate
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
    api_instance = zhs_api.AskApi(api_client)
    answer_create = zhs_api.AnswerCreate() # AnswerCreate | 

    try:
        # 提出回答
        api_response = api_instance.create_answer_api_v1_ask_answer_post(answer_create)
        print("The response of AskApi->create_answer_api_v1_ask_answer_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->create_answer_api_v1_ask_answer_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **answer_create** | [**AnswerCreate**](AnswerCreate.md)|  | 

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
    api_instance = zhs_api.AskApi(api_client)
    question_create = zhs_api.QuestionCreate() # QuestionCreate | 

    try:
        # 提出问题
        api_response = api_instance.create_question_api_v1_ask_question_post(question_create)
        print("The response of AskApi->create_question_api_v1_ask_question_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->create_question_api_v1_ask_question_post: %s\n" % e)
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

# **delete_answer_api_v1_ask_answer_delete**
> object delete_answer_api_v1_ask_answer_delete(id)

删除回答

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
    api_instance = zhs_api.AskApi(api_client)
    id = 56 # int | 

    try:
        # 删除回答
        api_response = api_instance.delete_answer_api_v1_ask_answer_delete(id)
        print("The response of AskApi->delete_answer_api_v1_ask_answer_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->delete_answer_api_v1_ask_answer_delete: %s\n" % e)
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

# **delete_category_api_v1_ask_category_cat_id_delete**
> object delete_category_api_v1_ask_category_cat_id_delete(cat_id)

删除分类

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
    api_instance = zhs_api.AskApi(api_client)
    cat_id = 56 # int | 

    try:
        # 删除分类
        api_response = api_instance.delete_category_api_v1_ask_category_cat_id_delete(cat_id)
        print("The response of AskApi->delete_category_api_v1_ask_category_cat_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->delete_category_api_v1_ask_category_cat_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cat_id** | **int**|  | 

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
    api_instance = zhs_api.AskApi(api_client)
    id = 56 # int | 

    try:
        # 删除问题
        api_response = api_instance.delete_question_api_v1_ask_question_delete(id)
        print("The response of AskApi->delete_question_api_v1_ask_question_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->delete_question_api_v1_ask_question_delete: %s\n" % e)
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

# **get_answer_api_v1_ask_answer_public_api_get**
> object get_answer_api_v1_ask_answer_public_api_get(id)

回答详情

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
    api_instance = zhs_api.AskApi(api_client)
    id = 56 # int | 

    try:
        # 回答详情
        api_response = api_instance.get_answer_api_v1_ask_answer_public_api_get(id)
        print("The response of AskApi->get_answer_api_v1_ask_answer_public_api_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->get_answer_api_v1_ask_answer_public_api_get: %s\n" % e)
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

# **get_category_api_v1_ask_category_cat_id_get**
> object get_category_api_v1_ask_category_cat_id_get(cat_id)

分类详情

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
    api_instance = zhs_api.AskApi(api_client)
    cat_id = 56 # int | 

    try:
        # 分类详情
        api_response = api_instance.get_category_api_v1_ask_category_cat_id_get(cat_id)
        print("The response of AskApi->get_category_api_v1_ask_category_cat_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->get_category_api_v1_ask_category_cat_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cat_id** | **int**|  | 

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
    api_instance = zhs_api.AskApi(api_client)
    id = 56 # int | 

    try:
        # 问题详情
        api_response = api_instance.get_question_api_v1_ask_question_public_api_get(id)
        print("The response of AskApi->get_question_api_v1_ask_question_public_api_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->get_question_api_v1_ask_question_public_api_get: %s\n" % e)
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

# **list_answers_api_v1_ask_answer_list_get**
> object list_answers_api_v1_ask_answer_list_get(page=page, limit=limit, question_id=question_id, member_id=member_id)

回答列表(需权限)

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
    api_instance = zhs_api.AskApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 10 # int |  (optional) (default to 10)
    question_id = 56 # int |  (optional)
    member_id = 'member_id_example' # str |  (optional)

    try:
        # 回答列表(需权限)
        api_response = api_instance.list_answers_api_v1_ask_answer_list_get(page=page, limit=limit, question_id=question_id, member_id=member_id)
        print("The response of AskApi->list_answers_api_v1_ask_answer_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->list_answers_api_v1_ask_answer_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 10]
 **question_id** | **int**|  | [optional] 
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
    api_instance = zhs_api.AskApi(api_client)
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
        print("The response of AskApi->list_questions_api_v1_ask_question_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->list_questions_api_v1_ask_question_list_get: %s\n" % e)
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

# **member_answer_count_api_v1_ask_answer_public_api_member_count_get**
> object member_answer_count_api_v1_ask_answer_public_api_member_count_get(member_id=member_id)

会员回答数

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
    api_instance = zhs_api.AskApi(api_client)
    member_id = 'member_id_example' # str |  (optional)

    try:
        # 会员回答数
        api_response = api_instance.member_answer_count_api_v1_ask_answer_public_api_member_count_get(member_id=member_id)
        print("The response of AskApi->member_answer_count_api_v1_ask_answer_public_api_member_count_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->member_answer_count_api_v1_ask_answer_public_api_member_count_get: %s\n" % e)
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
    api_instance = zhs_api.AskApi(api_client)
    member_id = 'member_id_example' # str |  (optional)

    try:
        # 会员问题数
        api_response = api_instance.member_question_count_api_v1_ask_question_public_api_member_count_get(member_id=member_id)
        print("The response of AskApi->member_question_count_api_v1_ask_question_public_api_member_count_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->member_question_count_api_v1_ask_question_public_api_member_count_get: %s\n" % e)
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

# **public_list_answers_api_v1_ask_answer_public_api_list_get**
> object public_list_answers_api_v1_ask_answer_public_api_list_get(page=page, limit=limit, question_id=question_id)

回答列表(公开)

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
    api_instance = zhs_api.AskApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 10 # int |  (optional) (default to 10)
    question_id = 56 # int |  (optional)

    try:
        # 回答列表(公开)
        api_response = api_instance.public_list_answers_api_v1_ask_answer_public_api_list_get(page=page, limit=limit, question_id=question_id)
        print("The response of AskApi->public_list_answers_api_v1_ask_answer_public_api_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->public_list_answers_api_v1_ask_answer_public_api_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 10]
 **question_id** | **int**|  | [optional] 

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

# **public_list_api_v1_ask_category_public_api_list_get**
> object public_list_api_v1_ask_category_public_api_list_get(is_show=is_show, is_show_index=is_show_index)

分类列表(公开)

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
    api_instance = zhs_api.AskApi(api_client)
    is_show = True # bool |  (optional)
    is_show_index = True # bool |  (optional)

    try:
        # 分类列表(公开)
        api_response = api_instance.public_list_api_v1_ask_category_public_api_list_get(is_show=is_show, is_show_index=is_show_index)
        print("The response of AskApi->public_list_api_v1_ask_category_public_api_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->public_list_api_v1_ask_category_public_api_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **is_show** | **bool**|  | [optional] 
 **is_show_index** | **bool**|  | [optional] 

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
    api_instance = zhs_api.AskApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 10 # int |  (optional) (default to 10)
    keyword = 'keyword_example' # str |  (optional)
    cid = 56 # int |  (optional)
    order_column = 'order_column_example' # str |  (optional)
    order_direction = 'order_direction_example' # str |  (optional)

    try:
        # 问题列表(公开)
        api_response = api_instance.public_list_questions_api_v1_ask_question_public_api_list_get(page=page, limit=limit, keyword=keyword, cid=cid, order_column=order_column, order_direction=order_direction)
        print("The response of AskApi->public_list_questions_api_v1_ask_question_public_api_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->public_list_questions_api_v1_ask_question_public_api_list_get: %s\n" % e)
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

# **update_answer_api_v1_ask_answer_put**
> object update_answer_api_v1_ask_answer_put(answer_update)

修改回答

### Example


```python
import zhs_api
from zhs_api.models.answer_update import AnswerUpdate
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
    api_instance = zhs_api.AskApi(api_client)
    answer_update = zhs_api.AnswerUpdate() # AnswerUpdate | 

    try:
        # 修改回答
        api_response = api_instance.update_answer_api_v1_ask_answer_put(answer_update)
        print("The response of AskApi->update_answer_api_v1_ask_answer_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->update_answer_api_v1_ask_answer_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **answer_update** | [**AnswerUpdate**](AnswerUpdate.md)|  | 

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

# **update_category_api_v1_ask_category_put**
> object update_category_api_v1_ask_category_put(category_update)

修改分类

### Example


```python
import zhs_api
from zhs_api.models.category_update import CategoryUpdate
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
    api_instance = zhs_api.AskApi(api_client)
    category_update = zhs_api.CategoryUpdate() # CategoryUpdate | 

    try:
        # 修改分类
        api_response = api_instance.update_category_api_v1_ask_category_put(category_update)
        print("The response of AskApi->update_category_api_v1_ask_category_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->update_category_api_v1_ask_category_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **category_update** | [**CategoryUpdate**](CategoryUpdate.md)|  | 

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
    api_instance = zhs_api.AskApi(api_client)
    question_update = zhs_api.QuestionUpdate() # QuestionUpdate | 

    try:
        # 修改问题
        api_response = api_instance.update_question_api_v1_ask_question_put(question_update)
        print("The response of AskApi->update_question_api_v1_ask_question_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskApi->update_question_api_v1_ask_question_put: %s\n" % e)
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

