# zhs_api.AskCategoryApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**add_category_api_v1_ask_category_post**](AskCategoryApi.md#add_category_api_v1_ask_category_post) | **POST** /api/v1/ask/category | 添加分类
[**ask_category_admin_list**](AskCategoryApi.md#ask_category_admin_list) | **GET** /api/v1/ask/category/admin/list | 分类列表(管理员)
[**change_show_api_v1_ask_category_is_show_put**](AskCategoryApi.md#change_show_api_v1_ask_category_is_show_put) | **PUT** /api/v1/ask/category/is-show | 修改显示状态
[**change_show_index_api_v1_ask_category_is_show_index_put**](AskCategoryApi.md#change_show_index_api_v1_ask_category_is_show_index_put) | **PUT** /api/v1/ask/category/is-show-index | 修改首页显示状态
[**delete_category_api_v1_ask_category_cat_id_delete**](AskCategoryApi.md#delete_category_api_v1_ask_category_cat_id_delete) | **DELETE** /api/v1/ask/category/{cat_id} | 删除分类
[**get_category_api_v1_ask_category_cat_id_get**](AskCategoryApi.md#get_category_api_v1_ask_category_cat_id_get) | **GET** /api/v1/ask/category/{cat_id} | 分类详情
[**public_list_api_v1_ask_category_public_api_list_get**](AskCategoryApi.md#public_list_api_v1_ask_category_public_api_list_get) | **GET** /api/v1/ask/category/public-api/list | 分类列表(公开)
[**update_category_api_v1_ask_category_put**](AskCategoryApi.md#update_category_api_v1_ask_category_put) | **PUT** /api/v1/ask/category | 修改分类


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
    api_instance = zhs_api.AskCategoryApi(api_client)
    category_create = zhs_api.CategoryCreate() # CategoryCreate | 

    try:
        # 添加分类
        api_response = api_instance.add_category_api_v1_ask_category_post(category_create)
        print("The response of AskCategoryApi->add_category_api_v1_ask_category_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskCategoryApi->add_category_api_v1_ask_category_post: %s\n" % e)
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
    api_instance = zhs_api.AskCategoryApi(api_client)
    is_show = True # bool |  (optional)
    is_show_index = True # bool |  (optional)

    try:
        # 分类列表(管理员)
        api_response = api_instance.ask_category_admin_list(is_show=is_show, is_show_index=is_show_index)
        print("The response of AskCategoryApi->ask_category_admin_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskCategoryApi->ask_category_admin_list: %s\n" % e)
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
    api_instance = zhs_api.AskCategoryApi(api_client)
    id = 56 # int | 
    is_show = True # bool | 

    try:
        # 修改显示状态
        api_response = api_instance.change_show_api_v1_ask_category_is_show_put(id, is_show)
        print("The response of AskCategoryApi->change_show_api_v1_ask_category_is_show_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskCategoryApi->change_show_api_v1_ask_category_is_show_put: %s\n" % e)
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
    api_instance = zhs_api.AskCategoryApi(api_client)
    id = 56 # int | 
    is_show_index = True # bool | 

    try:
        # 修改首页显示状态
        api_response = api_instance.change_show_index_api_v1_ask_category_is_show_index_put(id, is_show_index)
        print("The response of AskCategoryApi->change_show_index_api_v1_ask_category_is_show_index_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskCategoryApi->change_show_index_api_v1_ask_category_is_show_index_put: %s\n" % e)
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
    api_instance = zhs_api.AskCategoryApi(api_client)
    cat_id = 56 # int | 

    try:
        # 删除分类
        api_response = api_instance.delete_category_api_v1_ask_category_cat_id_delete(cat_id)
        print("The response of AskCategoryApi->delete_category_api_v1_ask_category_cat_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskCategoryApi->delete_category_api_v1_ask_category_cat_id_delete: %s\n" % e)
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
    api_instance = zhs_api.AskCategoryApi(api_client)
    cat_id = 56 # int | 

    try:
        # 分类详情
        api_response = api_instance.get_category_api_v1_ask_category_cat_id_get(cat_id)
        print("The response of AskCategoryApi->get_category_api_v1_ask_category_cat_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskCategoryApi->get_category_api_v1_ask_category_cat_id_get: %s\n" % e)
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
    api_instance = zhs_api.AskCategoryApi(api_client)
    is_show = True # bool |  (optional)
    is_show_index = True # bool |  (optional)

    try:
        # 分类列表(公开)
        api_response = api_instance.public_list_api_v1_ask_category_public_api_list_get(is_show=is_show, is_show_index=is_show_index)
        print("The response of AskCategoryApi->public_list_api_v1_ask_category_public_api_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskCategoryApi->public_list_api_v1_ask_category_public_api_list_get: %s\n" % e)
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
    api_instance = zhs_api.AskCategoryApi(api_client)
    category_update = zhs_api.CategoryUpdate() # CategoryUpdate | 

    try:
        # 修改分类
        api_response = api_instance.update_category_api_v1_ask_category_put(category_update)
        print("The response of AskCategoryApi->update_category_api_v1_ask_category_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AskCategoryApi->update_category_api_v1_ask_category_put: %s\n" % e)
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

