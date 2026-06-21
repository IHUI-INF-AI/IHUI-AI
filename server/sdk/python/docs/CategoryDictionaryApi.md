# zhs_api.CategoryDictionaryApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_dict_api_v1_category_dictionary_post**](CategoryDictionaryApi.md#create_dict_api_v1_category_dictionary_post) | **POST** /api/v1/category-dictionary | 新增字典
[**create_dict_api_v1_category_dictionary_post_0**](CategoryDictionaryApi.md#create_dict_api_v1_category_dictionary_post_0) | **POST** /api/v1/category-dictionary | 新增字典
[**delete_dict_api_v1_category_dictionary_did_delete**](CategoryDictionaryApi.md#delete_dict_api_v1_category_dictionary_did_delete) | **DELETE** /api/v1/category-dictionary/{did} | 删除字典
[**delete_dict_api_v1_category_dictionary_did_delete_0**](CategoryDictionaryApi.md#delete_dict_api_v1_category_dictionary_did_delete_0) | **DELETE** /api/v1/category-dictionary/{did} | 删除字典
[**dict_types_api_v1_category_dictionary_type_get**](CategoryDictionaryApi.md#dict_types_api_v1_category_dictionary_type_get) | **GET** /api/v1/category-dictionary/type | 字典类型列表
[**dict_types_api_v1_category_dictionary_type_get_0**](CategoryDictionaryApi.md#dict_types_api_v1_category_dictionary_type_get_0) | **GET** /api/v1/category-dictionary/type | 字典类型列表
[**get_dict_api_v1_category_dictionary_did_get**](CategoryDictionaryApi.md#get_dict_api_v1_category_dictionary_did_get) | **GET** /api/v1/category-dictionary/{did} | 字典详情
[**get_dict_api_v1_category_dictionary_did_get_0**](CategoryDictionaryApi.md#get_dict_api_v1_category_dictionary_did_get_0) | **GET** /api/v1/category-dictionary/{did} | 字典详情
[**list_dict_api_v1_category_dictionary_list_get**](CategoryDictionaryApi.md#list_dict_api_v1_category_dictionary_list_get) | **GET** /api/v1/category-dictionary/list | 字典列表
[**list_dict_api_v1_category_dictionary_list_get_0**](CategoryDictionaryApi.md#list_dict_api_v1_category_dictionary_list_get_0) | **GET** /api/v1/category-dictionary/list | 字典列表
[**update_dict_api_v1_category_dictionary_did_put**](CategoryDictionaryApi.md#update_dict_api_v1_category_dictionary_did_put) | **PUT** /api/v1/category-dictionary/{did} | 修改字典
[**update_dict_api_v1_category_dictionary_did_put_0**](CategoryDictionaryApi.md#update_dict_api_v1_category_dictionary_did_put_0) | **PUT** /api/v1/category-dictionary/{did} | 修改字典


# **create_dict_api_v1_category_dictionary_post**
> object create_dict_api_v1_category_dictionary_post(dict_type, code, label, value=value, sort_order=sort_order, is_show=is_show, description=description, parent_id=parent_id, extra=extra)

新增字典

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
    api_instance = zhs_api.CategoryDictionaryApi(api_client)
    dict_type = 'dict_type_example' # str | 
    code = 'code_example' # str | 
    label = 'label_example' # str | 
    value = 'value_example' # str |  (optional)
    sort_order = 0 # int |  (optional) (default to 0)
    is_show = True # bool |  (optional) (default to True)
    description = 'description_example' # str |  (optional)
    parent_id = 0 # int |  (optional) (default to 0)
    extra = 'extra_example' # str |  (optional)

    try:
        # 新增字典
        api_response = api_instance.create_dict_api_v1_category_dictionary_post(dict_type, code, label, value=value, sort_order=sort_order, is_show=is_show, description=description, parent_id=parent_id, extra=extra)
        print("The response of CategoryDictionaryApi->create_dict_api_v1_category_dictionary_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CategoryDictionaryApi->create_dict_api_v1_category_dictionary_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dict_type** | **str**|  | 
 **code** | **str**|  | 
 **label** | **str**|  | 
 **value** | **str**|  | [optional] 
 **sort_order** | **int**|  | [optional] [default to 0]
 **is_show** | **bool**|  | [optional] [default to True]
 **description** | **str**|  | [optional] 
 **parent_id** | **int**|  | [optional] [default to 0]
 **extra** | **str**|  | [optional] 

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

# **create_dict_api_v1_category_dictionary_post_0**
> object create_dict_api_v1_category_dictionary_post_0(dict_type, code, label, value=value, sort_order=sort_order, is_show=is_show, description=description, parent_id=parent_id, extra=extra)

新增字典

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
    api_instance = zhs_api.CategoryDictionaryApi(api_client)
    dict_type = 'dict_type_example' # str | 
    code = 'code_example' # str | 
    label = 'label_example' # str | 
    value = 'value_example' # str |  (optional)
    sort_order = 0 # int |  (optional) (default to 0)
    is_show = True # bool |  (optional) (default to True)
    description = 'description_example' # str |  (optional)
    parent_id = 0 # int |  (optional) (default to 0)
    extra = 'extra_example' # str |  (optional)

    try:
        # 新增字典
        api_response = api_instance.create_dict_api_v1_category_dictionary_post_0(dict_type, code, label, value=value, sort_order=sort_order, is_show=is_show, description=description, parent_id=parent_id, extra=extra)
        print("The response of CategoryDictionaryApi->create_dict_api_v1_category_dictionary_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CategoryDictionaryApi->create_dict_api_v1_category_dictionary_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dict_type** | **str**|  | 
 **code** | **str**|  | 
 **label** | **str**|  | 
 **value** | **str**|  | [optional] 
 **sort_order** | **int**|  | [optional] [default to 0]
 **is_show** | **bool**|  | [optional] [default to True]
 **description** | **str**|  | [optional] 
 **parent_id** | **int**|  | [optional] [default to 0]
 **extra** | **str**|  | [optional] 

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

# **delete_dict_api_v1_category_dictionary_did_delete**
> object delete_dict_api_v1_category_dictionary_did_delete(did)

删除字典

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
    api_instance = zhs_api.CategoryDictionaryApi(api_client)
    did = 56 # int | 

    try:
        # 删除字典
        api_response = api_instance.delete_dict_api_v1_category_dictionary_did_delete(did)
        print("The response of CategoryDictionaryApi->delete_dict_api_v1_category_dictionary_did_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CategoryDictionaryApi->delete_dict_api_v1_category_dictionary_did_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **did** | **int**|  | 

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

# **delete_dict_api_v1_category_dictionary_did_delete_0**
> object delete_dict_api_v1_category_dictionary_did_delete_0(did)

删除字典

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
    api_instance = zhs_api.CategoryDictionaryApi(api_client)
    did = 56 # int | 

    try:
        # 删除字典
        api_response = api_instance.delete_dict_api_v1_category_dictionary_did_delete_0(did)
        print("The response of CategoryDictionaryApi->delete_dict_api_v1_category_dictionary_did_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CategoryDictionaryApi->delete_dict_api_v1_category_dictionary_did_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **did** | **int**|  | 

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

# **dict_types_api_v1_category_dictionary_type_get**
> object dict_types_api_v1_category_dictionary_type_get()

字典类型列表

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
    api_instance = zhs_api.CategoryDictionaryApi(api_client)

    try:
        # 字典类型列表
        api_response = api_instance.dict_types_api_v1_category_dictionary_type_get()
        print("The response of CategoryDictionaryApi->dict_types_api_v1_category_dictionary_type_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CategoryDictionaryApi->dict_types_api_v1_category_dictionary_type_get: %s\n" % e)
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

# **dict_types_api_v1_category_dictionary_type_get_0**
> object dict_types_api_v1_category_dictionary_type_get_0()

字典类型列表

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
    api_instance = zhs_api.CategoryDictionaryApi(api_client)

    try:
        # 字典类型列表
        api_response = api_instance.dict_types_api_v1_category_dictionary_type_get_0()
        print("The response of CategoryDictionaryApi->dict_types_api_v1_category_dictionary_type_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CategoryDictionaryApi->dict_types_api_v1_category_dictionary_type_get_0: %s\n" % e)
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

# **get_dict_api_v1_category_dictionary_did_get**
> object get_dict_api_v1_category_dictionary_did_get(did)

字典详情

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
    api_instance = zhs_api.CategoryDictionaryApi(api_client)
    did = 56 # int | 

    try:
        # 字典详情
        api_response = api_instance.get_dict_api_v1_category_dictionary_did_get(did)
        print("The response of CategoryDictionaryApi->get_dict_api_v1_category_dictionary_did_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CategoryDictionaryApi->get_dict_api_v1_category_dictionary_did_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **did** | **int**|  | 

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

# **get_dict_api_v1_category_dictionary_did_get_0**
> object get_dict_api_v1_category_dictionary_did_get_0(did)

字典详情

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
    api_instance = zhs_api.CategoryDictionaryApi(api_client)
    did = 56 # int | 

    try:
        # 字典详情
        api_response = api_instance.get_dict_api_v1_category_dictionary_did_get_0(did)
        print("The response of CategoryDictionaryApi->get_dict_api_v1_category_dictionary_did_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CategoryDictionaryApi->get_dict_api_v1_category_dictionary_did_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **did** | **int**|  | 

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

# **list_dict_api_v1_category_dictionary_list_get**
> object list_dict_api_v1_category_dictionary_list_get(dict_type=dict_type, page=page, limit=limit)

字典列表

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
    api_instance = zhs_api.CategoryDictionaryApi(api_client)
    dict_type = 'dict_type_example' # str |  (optional)
    page = 1 # int |  (optional) (default to 1)
    limit = 100 # int |  (optional) (default to 100)

    try:
        # 字典列表
        api_response = api_instance.list_dict_api_v1_category_dictionary_list_get(dict_type=dict_type, page=page, limit=limit)
        print("The response of CategoryDictionaryApi->list_dict_api_v1_category_dictionary_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CategoryDictionaryApi->list_dict_api_v1_category_dictionary_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dict_type** | **str**|  | [optional] 
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

# **list_dict_api_v1_category_dictionary_list_get_0**
> object list_dict_api_v1_category_dictionary_list_get_0(dict_type=dict_type, page=page, limit=limit)

字典列表

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
    api_instance = zhs_api.CategoryDictionaryApi(api_client)
    dict_type = 'dict_type_example' # str |  (optional)
    page = 1 # int |  (optional) (default to 1)
    limit = 100 # int |  (optional) (default to 100)

    try:
        # 字典列表
        api_response = api_instance.list_dict_api_v1_category_dictionary_list_get_0(dict_type=dict_type, page=page, limit=limit)
        print("The response of CategoryDictionaryApi->list_dict_api_v1_category_dictionary_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CategoryDictionaryApi->list_dict_api_v1_category_dictionary_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dict_type** | **str**|  | [optional] 
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

# **update_dict_api_v1_category_dictionary_did_put**
> object update_dict_api_v1_category_dictionary_did_put(did, label=label, value=value, sort_order=sort_order, is_show=is_show, description=description)

修改字典

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
    api_instance = zhs_api.CategoryDictionaryApi(api_client)
    did = 56 # int | 
    label = 'label_example' # str |  (optional)
    value = 'value_example' # str |  (optional)
    sort_order = 56 # int |  (optional)
    is_show = True # bool |  (optional)
    description = 'description_example' # str |  (optional)

    try:
        # 修改字典
        api_response = api_instance.update_dict_api_v1_category_dictionary_did_put(did, label=label, value=value, sort_order=sort_order, is_show=is_show, description=description)
        print("The response of CategoryDictionaryApi->update_dict_api_v1_category_dictionary_did_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CategoryDictionaryApi->update_dict_api_v1_category_dictionary_did_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **did** | **int**|  | 
 **label** | **str**|  | [optional] 
 **value** | **str**|  | [optional] 
 **sort_order** | **int**|  | [optional] 
 **is_show** | **bool**|  | [optional] 
 **description** | **str**|  | [optional] 

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

# **update_dict_api_v1_category_dictionary_did_put_0**
> object update_dict_api_v1_category_dictionary_did_put_0(did, label=label, value=value, sort_order=sort_order, is_show=is_show, description=description)

修改字典

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
    api_instance = zhs_api.CategoryDictionaryApi(api_client)
    did = 56 # int | 
    label = 'label_example' # str |  (optional)
    value = 'value_example' # str |  (optional)
    sort_order = 56 # int |  (optional)
    is_show = True # bool |  (optional)
    description = 'description_example' # str |  (optional)

    try:
        # 修改字典
        api_response = api_instance.update_dict_api_v1_category_dictionary_did_put_0(did, label=label, value=value, sort_order=sort_order, is_show=is_show, description=description)
        print("The response of CategoryDictionaryApi->update_dict_api_v1_category_dictionary_did_put_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CategoryDictionaryApi->update_dict_api_v1_category_dictionary_did_put_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **did** | **int**|  | 
 **label** | **str**|  | [optional] 
 **value** | **str**|  | [optional] 
 **sort_order** | **int**|  | [optional] 
 **is_show** | **bool**|  | [optional] 
 **description** | **str**|  | [optional] 

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

