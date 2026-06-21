# zhs_api.AdvertiseApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_advertise_api_v1_advertise_post**](AdvertiseApi.md#create_advertise_api_v1_advertise_post) | **POST** /api/v1/advertise | 新增广告
[**create_advertise_api_v1_advertise_post_0**](AdvertiseApi.md#create_advertise_api_v1_advertise_post_0) | **POST** /api/v1/advertise | 新增广告
[**create_position_api_v1_advertise_position_post**](AdvertiseApi.md#create_position_api_v1_advertise_position_post) | **POST** /api/v1/advertise/position | 新增广告位
[**create_position_api_v1_advertise_position_post_0**](AdvertiseApi.md#create_position_api_v1_advertise_position_post_0) | **POST** /api/v1/advertise/position | 新增广告位
[**delete_advertise_api_v1_advertise_aid_delete**](AdvertiseApi.md#delete_advertise_api_v1_advertise_aid_delete) | **DELETE** /api/v1/advertise/{aid} | 删除广告
[**delete_advertise_api_v1_advertise_aid_delete_0**](AdvertiseApi.md#delete_advertise_api_v1_advertise_aid_delete_0) | **DELETE** /api/v1/advertise/{aid} | 删除广告
[**get_advertise_api_v1_advertise_aid_get**](AdvertiseApi.md#get_advertise_api_v1_advertise_aid_get) | **GET** /api/v1/advertise/{aid} | 广告详情
[**get_advertise_api_v1_advertise_aid_get_0**](AdvertiseApi.md#get_advertise_api_v1_advertise_aid_get_0) | **GET** /api/v1/advertise/{aid} | 广告详情
[**list_advertises_api_v1_advertise_list_get**](AdvertiseApi.md#list_advertises_api_v1_advertise_list_get) | **GET** /api/v1/advertise/list | 广告列表
[**list_advertises_api_v1_advertise_list_get_0**](AdvertiseApi.md#list_advertises_api_v1_advertise_list_get_0) | **GET** /api/v1/advertise/list | 广告列表
[**position_list_api_v1_advertise_position_list_get**](AdvertiseApi.md#position_list_api_v1_advertise_position_list_get) | **GET** /api/v1/advertise/position/list | 广告位列表
[**position_list_api_v1_advertise_position_list_get_0**](AdvertiseApi.md#position_list_api_v1_advertise_position_list_get_0) | **GET** /api/v1/advertise/position/list | 广告位列表
[**record_click_api_v1_advertise_aid_click_post**](AdvertiseApi.md#record_click_api_v1_advertise_aid_click_post) | **POST** /api/v1/advertise/{aid}/click | 记录广告点击
[**record_click_api_v1_advertise_aid_click_post_0**](AdvertiseApi.md#record_click_api_v1_advertise_aid_click_post_0) | **POST** /api/v1/advertise/{aid}/click | 记录广告点击
[**update_advertise_api_v1_advertise_aid_put**](AdvertiseApi.md#update_advertise_api_v1_advertise_aid_put) | **PUT** /api/v1/advertise/{aid} | 修改广告
[**update_advertise_api_v1_advertise_aid_put_0**](AdvertiseApi.md#update_advertise_api_v1_advertise_aid_put_0) | **PUT** /api/v1/advertise/{aid} | 修改广告


# **create_advertise_api_v1_advertise_post**
> object create_advertise_api_v1_advertise_post(title, position_id, image=image, url=url, type=type, content=content, start_time=start_time, end_time=end_time, sort_order=sort_order, target_user=target_user)

新增广告

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
    api_instance = zhs_api.AdvertiseApi(api_client)
    title = 'title_example' # str | 
    position_id = 56 # int | 
    image = 'image_example' # str |  (optional)
    url = 'url_example' # str |  (optional)
    type = 'image' # str |  (optional) (default to 'image')
    content = 'content_example' # str |  (optional)
    start_time = '2013-10-20T19:20:30+01:00' # datetime |  (optional)
    end_time = '2013-10-20T19:20:30+01:00' # datetime |  (optional)
    sort_order = 0 # int |  (optional) (default to 0)
    target_user = 'all' # str |  (optional) (default to 'all')

    try:
        # 新增广告
        api_response = api_instance.create_advertise_api_v1_advertise_post(title, position_id, image=image, url=url, type=type, content=content, start_time=start_time, end_time=end_time, sort_order=sort_order, target_user=target_user)
        print("The response of AdvertiseApi->create_advertise_api_v1_advertise_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AdvertiseApi->create_advertise_api_v1_advertise_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**|  | 
 **position_id** | **int**|  | 
 **image** | **str**|  | [optional] 
 **url** | **str**|  | [optional] 
 **type** | **str**|  | [optional] [default to &#39;image&#39;]
 **content** | **str**|  | [optional] 
 **start_time** | **datetime**|  | [optional] 
 **end_time** | **datetime**|  | [optional] 
 **sort_order** | **int**|  | [optional] [default to 0]
 **target_user** | **str**|  | [optional] [default to &#39;all&#39;]

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

# **create_advertise_api_v1_advertise_post_0**
> object create_advertise_api_v1_advertise_post_0(title, position_id, image=image, url=url, type=type, content=content, start_time=start_time, end_time=end_time, sort_order=sort_order, target_user=target_user)

新增广告

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
    api_instance = zhs_api.AdvertiseApi(api_client)
    title = 'title_example' # str | 
    position_id = 56 # int | 
    image = 'image_example' # str |  (optional)
    url = 'url_example' # str |  (optional)
    type = 'image' # str |  (optional) (default to 'image')
    content = 'content_example' # str |  (optional)
    start_time = '2013-10-20T19:20:30+01:00' # datetime |  (optional)
    end_time = '2013-10-20T19:20:30+01:00' # datetime |  (optional)
    sort_order = 0 # int |  (optional) (default to 0)
    target_user = 'all' # str |  (optional) (default to 'all')

    try:
        # 新增广告
        api_response = api_instance.create_advertise_api_v1_advertise_post_0(title, position_id, image=image, url=url, type=type, content=content, start_time=start_time, end_time=end_time, sort_order=sort_order, target_user=target_user)
        print("The response of AdvertiseApi->create_advertise_api_v1_advertise_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AdvertiseApi->create_advertise_api_v1_advertise_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**|  | 
 **position_id** | **int**|  | 
 **image** | **str**|  | [optional] 
 **url** | **str**|  | [optional] 
 **type** | **str**|  | [optional] [default to &#39;image&#39;]
 **content** | **str**|  | [optional] 
 **start_time** | **datetime**|  | [optional] 
 **end_time** | **datetime**|  | [optional] 
 **sort_order** | **int**|  | [optional] [default to 0]
 **target_user** | **str**|  | [optional] [default to &#39;all&#39;]

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

# **create_position_api_v1_advertise_position_post**
> object create_position_api_v1_advertise_position_post(name, code, description=description, width=width, height=height)

新增广告位

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
    api_instance = zhs_api.AdvertiseApi(api_client)
    name = 'name_example' # str | 
    code = 'code_example' # str | 
    description = 'description_example' # str |  (optional)
    width = 0 # int |  (optional) (default to 0)
    height = 0 # int |  (optional) (default to 0)

    try:
        # 新增广告位
        api_response = api_instance.create_position_api_v1_advertise_position_post(name, code, description=description, width=width, height=height)
        print("The response of AdvertiseApi->create_position_api_v1_advertise_position_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AdvertiseApi->create_position_api_v1_advertise_position_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **str**|  | 
 **code** | **str**|  | 
 **description** | **str**|  | [optional] 
 **width** | **int**|  | [optional] [default to 0]
 **height** | **int**|  | [optional] [default to 0]

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

# **create_position_api_v1_advertise_position_post_0**
> object create_position_api_v1_advertise_position_post_0(name, code, description=description, width=width, height=height)

新增广告位

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
    api_instance = zhs_api.AdvertiseApi(api_client)
    name = 'name_example' # str | 
    code = 'code_example' # str | 
    description = 'description_example' # str |  (optional)
    width = 0 # int |  (optional) (default to 0)
    height = 0 # int |  (optional) (default to 0)

    try:
        # 新增广告位
        api_response = api_instance.create_position_api_v1_advertise_position_post_0(name, code, description=description, width=width, height=height)
        print("The response of AdvertiseApi->create_position_api_v1_advertise_position_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AdvertiseApi->create_position_api_v1_advertise_position_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **str**|  | 
 **code** | **str**|  | 
 **description** | **str**|  | [optional] 
 **width** | **int**|  | [optional] [default to 0]
 **height** | **int**|  | [optional] [default to 0]

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

# **delete_advertise_api_v1_advertise_aid_delete**
> object delete_advertise_api_v1_advertise_aid_delete(aid)

删除广告

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
    api_instance = zhs_api.AdvertiseApi(api_client)
    aid = 56 # int | 

    try:
        # 删除广告
        api_response = api_instance.delete_advertise_api_v1_advertise_aid_delete(aid)
        print("The response of AdvertiseApi->delete_advertise_api_v1_advertise_aid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AdvertiseApi->delete_advertise_api_v1_advertise_aid_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 

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

# **delete_advertise_api_v1_advertise_aid_delete_0**
> object delete_advertise_api_v1_advertise_aid_delete_0(aid)

删除广告

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
    api_instance = zhs_api.AdvertiseApi(api_client)
    aid = 56 # int | 

    try:
        # 删除广告
        api_response = api_instance.delete_advertise_api_v1_advertise_aid_delete_0(aid)
        print("The response of AdvertiseApi->delete_advertise_api_v1_advertise_aid_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AdvertiseApi->delete_advertise_api_v1_advertise_aid_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 

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

# **get_advertise_api_v1_advertise_aid_get**
> object get_advertise_api_v1_advertise_aid_get(aid)

广告详情

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
    api_instance = zhs_api.AdvertiseApi(api_client)
    aid = 56 # int | 

    try:
        # 广告详情
        api_response = api_instance.get_advertise_api_v1_advertise_aid_get(aid)
        print("The response of AdvertiseApi->get_advertise_api_v1_advertise_aid_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AdvertiseApi->get_advertise_api_v1_advertise_aid_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 

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

# **get_advertise_api_v1_advertise_aid_get_0**
> object get_advertise_api_v1_advertise_aid_get_0(aid)

广告详情

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
    api_instance = zhs_api.AdvertiseApi(api_client)
    aid = 56 # int | 

    try:
        # 广告详情
        api_response = api_instance.get_advertise_api_v1_advertise_aid_get_0(aid)
        print("The response of AdvertiseApi->get_advertise_api_v1_advertise_aid_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AdvertiseApi->get_advertise_api_v1_advertise_aid_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 

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

# **list_advertises_api_v1_advertise_list_get**
> object list_advertises_api_v1_advertise_list_get(position_id=position_id, status=status, page=page, limit=limit)

广告列表

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
    api_instance = zhs_api.AdvertiseApi(api_client)
    position_id = 56 # int |  (optional)
    status = 56 # int |  (optional)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 广告列表
        api_response = api_instance.list_advertises_api_v1_advertise_list_get(position_id=position_id, status=status, page=page, limit=limit)
        print("The response of AdvertiseApi->list_advertises_api_v1_advertise_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AdvertiseApi->list_advertises_api_v1_advertise_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **position_id** | **int**|  | [optional] 
 **status** | **int**|  | [optional] 
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

# **list_advertises_api_v1_advertise_list_get_0**
> object list_advertises_api_v1_advertise_list_get_0(position_id=position_id, status=status, page=page, limit=limit)

广告列表

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
    api_instance = zhs_api.AdvertiseApi(api_client)
    position_id = 56 # int |  (optional)
    status = 56 # int |  (optional)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 广告列表
        api_response = api_instance.list_advertises_api_v1_advertise_list_get_0(position_id=position_id, status=status, page=page, limit=limit)
        print("The response of AdvertiseApi->list_advertises_api_v1_advertise_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AdvertiseApi->list_advertises_api_v1_advertise_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **position_id** | **int**|  | [optional] 
 **status** | **int**|  | [optional] 
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

# **position_list_api_v1_advertise_position_list_get**
> object position_list_api_v1_advertise_position_list_get()

广告位列表

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
    api_instance = zhs_api.AdvertiseApi(api_client)

    try:
        # 广告位列表
        api_response = api_instance.position_list_api_v1_advertise_position_list_get()
        print("The response of AdvertiseApi->position_list_api_v1_advertise_position_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AdvertiseApi->position_list_api_v1_advertise_position_list_get: %s\n" % e)
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

# **position_list_api_v1_advertise_position_list_get_0**
> object position_list_api_v1_advertise_position_list_get_0()

广告位列表

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
    api_instance = zhs_api.AdvertiseApi(api_client)

    try:
        # 广告位列表
        api_response = api_instance.position_list_api_v1_advertise_position_list_get_0()
        print("The response of AdvertiseApi->position_list_api_v1_advertise_position_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AdvertiseApi->position_list_api_v1_advertise_position_list_get_0: %s\n" % e)
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

# **record_click_api_v1_advertise_aid_click_post**
> object record_click_api_v1_advertise_aid_click_post(aid)

记录广告点击

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
    api_instance = zhs_api.AdvertiseApi(api_client)
    aid = 56 # int | 

    try:
        # 记录广告点击
        api_response = api_instance.record_click_api_v1_advertise_aid_click_post(aid)
        print("The response of AdvertiseApi->record_click_api_v1_advertise_aid_click_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AdvertiseApi->record_click_api_v1_advertise_aid_click_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 

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

# **record_click_api_v1_advertise_aid_click_post_0**
> object record_click_api_v1_advertise_aid_click_post_0(aid)

记录广告点击

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
    api_instance = zhs_api.AdvertiseApi(api_client)
    aid = 56 # int | 

    try:
        # 记录广告点击
        api_response = api_instance.record_click_api_v1_advertise_aid_click_post_0(aid)
        print("The response of AdvertiseApi->record_click_api_v1_advertise_aid_click_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AdvertiseApi->record_click_api_v1_advertise_aid_click_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 

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

# **update_advertise_api_v1_advertise_aid_put**
> object update_advertise_api_v1_advertise_aid_put(aid, title=title, image=image, url=url, status=status, sort_order=sort_order)

修改广告

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
    api_instance = zhs_api.AdvertiseApi(api_client)
    aid = 56 # int | 
    title = 'title_example' # str |  (optional)
    image = 'image_example' # str |  (optional)
    url = 'url_example' # str |  (optional)
    status = 56 # int |  (optional)
    sort_order = 56 # int |  (optional)

    try:
        # 修改广告
        api_response = api_instance.update_advertise_api_v1_advertise_aid_put(aid, title=title, image=image, url=url, status=status, sort_order=sort_order)
        print("The response of AdvertiseApi->update_advertise_api_v1_advertise_aid_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AdvertiseApi->update_advertise_api_v1_advertise_aid_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 
 **title** | **str**|  | [optional] 
 **image** | **str**|  | [optional] 
 **url** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 
 **sort_order** | **int**|  | [optional] 

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

# **update_advertise_api_v1_advertise_aid_put_0**
> object update_advertise_api_v1_advertise_aid_put_0(aid, title=title, image=image, url=url, status=status, sort_order=sort_order)

修改广告

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
    api_instance = zhs_api.AdvertiseApi(api_client)
    aid = 56 # int | 
    title = 'title_example' # str |  (optional)
    image = 'image_example' # str |  (optional)
    url = 'url_example' # str |  (optional)
    status = 56 # int |  (optional)
    sort_order = 56 # int |  (optional)

    try:
        # 修改广告
        api_response = api_instance.update_advertise_api_v1_advertise_aid_put_0(aid, title=title, image=image, url=url, status=status, sort_order=sort_order)
        print("The response of AdvertiseApi->update_advertise_api_v1_advertise_aid_put_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AdvertiseApi->update_advertise_api_v1_advertise_aid_put_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aid** | **int**|  | 
 **title** | **str**|  | [optional] 
 **image** | **str**|  | [optional] 
 **url** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 
 **sort_order** | **int**|  | [optional] 

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

