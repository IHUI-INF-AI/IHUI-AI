# zhs_api.AskAnswerApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**adopt_answer_api_v1_ask_answer_adopt_put**](AskAnswerApi.md#adopt_answer_api_v1_ask_answer_adopt_put) | **PUT** /api/v1/ask/answer/adopt | 采纳回答
[**create_answer_api_v1_ask_answer_post**](AskAnswerApi.md#create_answer_api_v1_ask_answer_post) | **POST** /api/v1/ask/answer | 提出回答
[**delete_answer_api_v1_ask_answer_delete**](AskAnswerApi.md#delete_answer_api_v1_ask_answer_delete) | **DELETE** /api/v1/ask/answer | 删除回答
[**get_answer_api_v1_ask_answer_public_api_get**](AskAnswerApi.md#get_answer_api_v1_ask_answer_public_api_get) | **GET** /api/v1/ask/answer/public-api | 回答详情
[**list_answers_api_v1_ask_answer_list_get**](AskAnswerApi.md#list_answers_api_v1_ask_answer_list_get) | **GET** /api/v1/ask/answer/list | 回答列表(需权限)
[**member_answer_count_api_v1_ask_answer_public_api_member_count_get**](AskAnswerApi.md#member_answer_count_api_v1_ask_answer_public_api_member_count_get) | **GET** /api/v1/ask/answer/public-api/member/count | 会员回答数
[**public_list_answers_api_v1_ask_answer_public_api_list_get**](AskAnswerApi.md#public_list_answers_api_v1_ask_answer_public_api_list_get) | **GET** /api/v1/ask/answer/public-api/list | 回答列表(公开)
[**update_answer_api_v1_ask_answer_put**](AskAnswerApi.md#update_answer_api_v1_ask_answer_put) | **PUT** /api/v1/ask/answer | 修改回答


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
    api_instance = zhs_api.AskAnswerApi(api_client)
    id = 56 # int | 

    try:
        # 采纳回答
        api_response = api_instance.adopt_answer_api_v1_ask_answer_adopt_put(id)
        print("The response of AskAnswerApi->adopt_answer_api_v1_ask_answer_adopt_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskAnswerApi->adopt_answer_api_v1_ask_answer_adopt_put: %s\n" % e)
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
    api_instance = zhs_api.AskAnswerApi(api_client)
    answer_create = zhs_api.AnswerCreate() # AnswerCreate | 

    try:
        # 提出回答
        api_response = api_instance.create_answer_api_v1_ask_answer_post(answer_create)
        print("The response of AskAnswerApi->create_answer_api_v1_ask_answer_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskAnswerApi->create_answer_api_v1_ask_answer_post: %s\n" % e)
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
    api_instance = zhs_api.AskAnswerApi(api_client)
    id = 56 # int | 

    try:
        # 删除回答
        api_response = api_instance.delete_answer_api_v1_ask_answer_delete(id)
        print("The response of AskAnswerApi->delete_answer_api_v1_ask_answer_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskAnswerApi->delete_answer_api_v1_ask_answer_delete: %s\n" % e)
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
    api_instance = zhs_api.AskAnswerApi(api_client)
    id = 56 # int | 

    try:
        # 回答详情
        api_response = api_instance.get_answer_api_v1_ask_answer_public_api_get(id)
        print("The response of AskAnswerApi->get_answer_api_v1_ask_answer_public_api_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskAnswerApi->get_answer_api_v1_ask_answer_public_api_get: %s\n" % e)
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
    api_instance = zhs_api.AskAnswerApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 10 # int |  (optional) (default to 10)
    question_id = 56 # int |  (optional)
    member_id = 'member_id_example' # str |  (optional)

    try:
        # 回答列表(需权限)
        api_response = api_instance.list_answers_api_v1_ask_answer_list_get(page=page, limit=limit, question_id=question_id, member_id=member_id)
        print("The response of AskAnswerApi->list_answers_api_v1_ask_answer_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskAnswerApi->list_answers_api_v1_ask_answer_list_get: %s\n" % e)
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
    api_instance = zhs_api.AskAnswerApi(api_client)
    member_id = 'member_id_example' # str |  (optional)

    try:
        # 会员回答数
        api_response = api_instance.member_answer_count_api_v1_ask_answer_public_api_member_count_get(member_id=member_id)
        print("The response of AskAnswerApi->member_answer_count_api_v1_ask_answer_public_api_member_count_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskAnswerApi->member_answer_count_api_v1_ask_answer_public_api_member_count_get: %s\n" % e)
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
    api_instance = zhs_api.AskAnswerApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 10 # int |  (optional) (default to 10)
    question_id = 56 # int |  (optional)

    try:
        # 回答列表(公开)
        api_response = api_instance.public_list_answers_api_v1_ask_answer_public_api_list_get(page=page, limit=limit, question_id=question_id)
        print("The response of AskAnswerApi->public_list_answers_api_v1_ask_answer_public_api_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskAnswerApi->public_list_answers_api_v1_ask_answer_public_api_list_get: %s\n" % e)
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
    api_instance = zhs_api.AskAnswerApi(api_client)
    answer_update = zhs_api.AnswerUpdate() # AnswerUpdate | 

    try:
        # 修改回答
        api_response = api_instance.update_answer_api_v1_ask_answer_put(answer_update)
        print("The response of AskAnswerApi->update_answer_api_v1_ask_answer_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskAnswerApi->update_answer_api_v1_ask_answer_put: %s\n" % e)
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

