# zhs_api.AIModelInfoApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**compat_create_model_api_v1_ai_compat_create_post**](AIModelInfoApi.md#compat_create_model_api_v1_ai_compat_create_post) | **POST** /api/v1/ai/compat/create | [兼容] 新增模型 (前端 aiModelInfo.add)
[**compat_delete_model_api_v1_ai_compat_delete_get**](AIModelInfoApi.md#compat_delete_model_api_v1_ai_compat_delete_get) | **GET** /api/v1/ai/compat/delete | [兼容] 删除模型 (前端 aiModelInfo.delete)
[**compat_update_model_api_v1_ai_compat_update_post**](AIModelInfoApi.md#compat_update_model_api_v1_ai_compat_update_post) | **POST** /api/v1/ai/compat/update | [兼容] 更新模型 (前端 aiModelInfo.update)
[**create_model_api_v1_ai_create_post**](AIModelInfoApi.md#create_model_api_v1_ai_create_post) | **POST** /api/v1/ai/create | 新增模型
[**delete_model_api_v1_ai_model_id_delete**](AIModelInfoApi.md#delete_model_api_v1_ai_model_id_delete) | **DELETE** /api/v1/ai/{model_id} | 删除AI模型
[**update_model_api_v1_ai_update_post**](AIModelInfoApi.md#update_model_api_v1_ai_update_post) | **POST** /api/v1/ai/update | 更新模型
[**vendor_stats_api_v1_ai_vendors_get**](AIModelInfoApi.md#vendor_stats_api_v1_ai_vendors_get) | **GET** /api/v1/ai/vendors | 支持的厂商统计


# **compat_create_model_api_v1_ai_compat_create_post**
> object compat_create_model_api_v1_ai_compat_create_post(name, source=source, img=img, remark=remark, type=type, creator=creator)

[兼容] 新增模型 (前端 aiModelInfo.add)

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
    api_instance = zhs_api.AIModelInfoApi(api_client)
    name = 'name_example' # str | 
    source = '' # str |  (optional) (default to '')
    img = '' # str |  (optional) (default to '')
    remark = '' # str |  (optional) (default to '')
    type = 56 # int |  (optional)
    creator = '' # str |  (optional) (default to '')

    try:
        # [兼容] 新增模型 (前端 aiModelInfo.add)
        api_response = api_instance.compat_create_model_api_v1_ai_compat_create_post(name, source=source, img=img, remark=remark, type=type, creator=creator)
        print("The response of AIModelInfoApi->compat_create_model_api_v1_ai_compat_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIModelInfoApi->compat_create_model_api_v1_ai_compat_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **str**|  | 
 **source** | **str**|  | [optional] [default to &#39;&#39;]
 **img** | **str**|  | [optional] [default to &#39;&#39;]
 **remark** | **str**|  | [optional] [default to &#39;&#39;]
 **type** | **int**|  | [optional] 
 **creator** | **str**|  | [optional] [default to &#39;&#39;]

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

# **compat_delete_model_api_v1_ai_compat_delete_get**
> object compat_delete_model_api_v1_ai_compat_delete_get(id, updator=updator)

[兼容] 删除模型 (前端 aiModelInfo.delete)

逻辑删除：将 status 置为 0。前端用 GET + query params，此处兼容。

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
    api_instance = zhs_api.AIModelInfoApi(api_client)
    id = 'id_example' # str | 
    updator = '' # str |  (optional) (default to '')

    try:
        # [兼容] 删除模型 (前端 aiModelInfo.delete)
        api_response = api_instance.compat_delete_model_api_v1_ai_compat_delete_get(id, updator=updator)
        print("The response of AIModelInfoApi->compat_delete_model_api_v1_ai_compat_delete_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIModelInfoApi->compat_delete_model_api_v1_ai_compat_delete_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **str**|  | 
 **updator** | **str**|  | [optional] [default to &#39;&#39;]

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

# **compat_update_model_api_v1_ai_compat_update_post**
> object compat_update_model_api_v1_ai_compat_update_post(id, name=name, source=source, img=img, remark=remark, type=type, is_del=is_del, updator=updator)

[兼容] 更新模型 (前端 aiModelInfo.update)

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
    api_instance = zhs_api.AIModelInfoApi(api_client)
    id = 'id_example' # str | 
    name = 'name_example' # str |  (optional)
    source = 'source_example' # str |  (optional)
    img = 'img_example' # str |  (optional)
    remark = 'remark_example' # str |  (optional)
    type = 56 # int |  (optional)
    is_del = 56 # int |  (optional)
    updator = '' # str |  (optional) (default to '')

    try:
        # [兼容] 更新模型 (前端 aiModelInfo.update)
        api_response = api_instance.compat_update_model_api_v1_ai_compat_update_post(id, name=name, source=source, img=img, remark=remark, type=type, is_del=is_del, updator=updator)
        print("The response of AIModelInfoApi->compat_update_model_api_v1_ai_compat_update_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIModelInfoApi->compat_update_model_api_v1_ai_compat_update_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **str**|  | 
 **name** | **str**|  | [optional] 
 **source** | **str**|  | [optional] 
 **img** | **str**|  | [optional] 
 **remark** | **str**|  | [optional] 
 **type** | **int**|  | [optional] 
 **is_del** | **int**|  | [optional] 
 **updator** | **str**|  | [optional] [default to &#39;&#39;]

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

# **create_model_api_v1_ai_create_post**
> object create_model_api_v1_ai_create_post(vendor, model_name, description=description, icon=icon)

新增模型

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
    api_instance = zhs_api.AIModelInfoApi(api_client)
    vendor = 'vendor_example' # str | 
    model_name = 'model_name_example' # str | 
    description = '' # str |  (optional) (default to '')
    icon = '' # str |  (optional) (default to '')

    try:
        # 新增模型
        api_response = api_instance.create_model_api_v1_ai_create_post(vendor, model_name, description=description, icon=icon)
        print("The response of AIModelInfoApi->create_model_api_v1_ai_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIModelInfoApi->create_model_api_v1_ai_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **vendor** | **str**|  | 
 **model_name** | **str**|  | 
 **description** | **str**|  | [optional] [default to &#39;&#39;]
 **icon** | **str**|  | [optional] [default to &#39;&#39;]

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

# **delete_model_api_v1_ai_model_id_delete**
> object delete_model_api_v1_ai_model_id_delete(model_id)

删除AI模型

逻辑删除：将 status 置为 0。

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
    api_instance = zhs_api.AIModelInfoApi(api_client)
    model_id = 56 # int | 

    try:
        # 删除AI模型
        api_response = api_instance.delete_model_api_v1_ai_model_id_delete(model_id)
        print("The response of AIModelInfoApi->delete_model_api_v1_ai_model_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIModelInfoApi->delete_model_api_v1_ai_model_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **model_id** | **int**|  | 

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

# **update_model_api_v1_ai_update_post**
> object update_model_api_v1_ai_update_post(model_id, display_name=display_name, status=status)

更新模型

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
    api_instance = zhs_api.AIModelInfoApi(api_client)
    model_id = 56 # int | 
    display_name = 'display_name_example' # str |  (optional)
    status = 56 # int |  (optional)

    try:
        # 更新模型
        api_response = api_instance.update_model_api_v1_ai_update_post(model_id, display_name=display_name, status=status)
        print("The response of AIModelInfoApi->update_model_api_v1_ai_update_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIModelInfoApi->update_model_api_v1_ai_update_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **model_id** | **int**|  | 
 **display_name** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 

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

# **vendor_stats_api_v1_ai_vendors_get**
> object vendor_stats_api_v1_ai_vendors_get()

支持的厂商统计

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
    api_instance = zhs_api.AIModelInfoApi(api_client)

    try:
        # 支持的厂商统计
        api_response = api_instance.vendor_stats_api_v1_ai_vendors_get()
        print("The response of AIModelInfoApi->vendor_stats_api_v1_ai_vendors_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIModelInfoApi->vendor_stats_api_v1_ai_vendors_get: %s\n" % e)
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

