# zhs_api.CircleCircleApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**circle_category_list**](CircleCircleApi.md#circle_category_list) | **GET** /api/v1/circle/category/list | 圈子分类列表
[**create_circle_api_v1_circle_post**](CircleCircleApi.md#create_circle_api_v1_circle_post) | **POST** /api/v1/circle | 创建圈子
[**delete_circle_api_v1_circle_cid_delete**](CircleCircleApi.md#delete_circle_api_v1_circle_cid_delete) | **DELETE** /api/v1/circle/{cid} | 删除圈子
[**get_circle_api_v1_circle_cid_get**](CircleCircleApi.md#get_circle_api_v1_circle_cid_get) | **GET** /api/v1/circle/{cid} | 圈子详情
[**join_circle_api_v1_circle_cid_join_post**](CircleCircleApi.md#join_circle_api_v1_circle_cid_join_post) | **POST** /api/v1/circle/{cid}/join | 加入圈子
[**list_circles_api_v1_circle_list_get**](CircleCircleApi.md#list_circles_api_v1_circle_list_get) | **GET** /api/v1/circle/list | 圈子列表
[**list_members_api_v1_circle_cid_members_get**](CircleCircleApi.md#list_members_api_v1_circle_cid_members_get) | **GET** /api/v1/circle/{cid}/members | 成员列表
[**quit_circle_api_v1_circle_cid_quit_post**](CircleCircleApi.md#quit_circle_api_v1_circle_cid_quit_post) | **POST** /api/v1/circle/{cid}/quit | 退出圈子
[**update_circle_api_v1_circle_cid_put**](CircleCircleApi.md#update_circle_api_v1_circle_cid_put) | **PUT** /api/v1/circle/{cid} | 修改圈子


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
    api_instance = zhs_api.CircleCircleApi(api_client)

    try:
        # 圈子分类列表
        api_response = api_instance.circle_category_list()
        print("The response of CircleCircleApi->circle_category_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleCircleApi->circle_category_list: %s\n" % e)
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
    api_instance = zhs_api.CircleCircleApi(api_client)
    name = 'name_example' # str | 
    description = 'description_example' # str |  (optional)
    category_id = 56 # int |  (optional)
    avatar = 'avatar_example' # str |  (optional)
    cover = 'cover_example' # str |  (optional)

    try:
        # 创建圈子
        api_response = api_instance.create_circle_api_v1_circle_post(name, description=description, category_id=category_id, avatar=avatar, cover=cover)
        print("The response of CircleCircleApi->create_circle_api_v1_circle_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleCircleApi->create_circle_api_v1_circle_post: %s\n" % e)
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
    api_instance = zhs_api.CircleCircleApi(api_client)
    cid = 56 # int | 

    try:
        # 删除圈子
        api_response = api_instance.delete_circle_api_v1_circle_cid_delete(cid)
        print("The response of CircleCircleApi->delete_circle_api_v1_circle_cid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleCircleApi->delete_circle_api_v1_circle_cid_delete: %s\n" % e)
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
    api_instance = zhs_api.CircleCircleApi(api_client)
    cid = 56 # int | 

    try:
        # 圈子详情
        api_response = api_instance.get_circle_api_v1_circle_cid_get(cid)
        print("The response of CircleCircleApi->get_circle_api_v1_circle_cid_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleCircleApi->get_circle_api_v1_circle_cid_get: %s\n" % e)
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
    api_instance = zhs_api.CircleCircleApi(api_client)
    cid = 56 # int | 

    try:
        # 加入圈子
        api_response = api_instance.join_circle_api_v1_circle_cid_join_post(cid)
        print("The response of CircleCircleApi->join_circle_api_v1_circle_cid_join_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleCircleApi->join_circle_api_v1_circle_cid_join_post: %s\n" % e)
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
    api_instance = zhs_api.CircleCircleApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    category_id = 56 # int |  (optional)
    keyword = 'keyword_example' # str |  (optional)
    is_official = True # bool |  (optional)

    try:
        # 圈子列表
        api_response = api_instance.list_circles_api_v1_circle_list_get(page=page, limit=limit, category_id=category_id, keyword=keyword, is_official=is_official)
        print("The response of CircleCircleApi->list_circles_api_v1_circle_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleCircleApi->list_circles_api_v1_circle_list_get: %s\n" % e)
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
    api_instance = zhs_api.CircleCircleApi(api_client)
    cid = 56 # int | 
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 成员列表
        api_response = api_instance.list_members_api_v1_circle_cid_members_get(cid, page=page, limit=limit)
        print("The response of CircleCircleApi->list_members_api_v1_circle_cid_members_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleCircleApi->list_members_api_v1_circle_cid_members_get: %s\n" % e)
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
    api_instance = zhs_api.CircleCircleApi(api_client)
    cid = 56 # int | 

    try:
        # 退出圈子
        api_response = api_instance.quit_circle_api_v1_circle_cid_quit_post(cid)
        print("The response of CircleCircleApi->quit_circle_api_v1_circle_cid_quit_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleCircleApi->quit_circle_api_v1_circle_cid_quit_post: %s\n" % e)
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
    api_instance = zhs_api.CircleCircleApi(api_client)
    cid = 56 # int | 
    name = 'name_example' # str |  (optional)
    description = 'description_example' # str |  (optional)
    avatar = 'avatar_example' # str |  (optional)
    cover = 'cover_example' # str |  (optional)

    try:
        # 修改圈子
        api_response = api_instance.update_circle_api_v1_circle_cid_put(cid, name=name, description=description, avatar=avatar, cover=cover)
        print("The response of CircleCircleApi->update_circle_api_v1_circle_cid_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CircleCircleApi->update_circle_api_v1_circle_cid_put: %s\n" % e)
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

