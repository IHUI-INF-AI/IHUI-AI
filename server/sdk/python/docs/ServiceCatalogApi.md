# zhs_api.ServiceCatalogApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**call_log_list_api_v1_service_catalog_log_list_get**](ServiceCatalogApi.md#call_log_list_api_v1_service_catalog_log_list_get) | **GET** /api/v1/service-catalog/log/list | 服务调用日志
[**call_log_list_api_v1_service_catalog_log_list_get_0**](ServiceCatalogApi.md#call_log_list_api_v1_service_catalog_log_list_get_0) | **GET** /api/v1/service-catalog/log/list | 服务调用日志
[**delete_service_api_v1_service_catalog_sid_delete**](ServiceCatalogApi.md#delete_service_api_v1_service_catalog_sid_delete) | **DELETE** /api/v1/service-catalog/{sid} | 下线服务
[**delete_service_api_v1_service_catalog_sid_delete_0**](ServiceCatalogApi.md#delete_service_api_v1_service_catalog_sid_delete_0) | **DELETE** /api/v1/service-catalog/{sid} | 下线服务
[**get_service_api_v1_service_catalog_sid_get**](ServiceCatalogApi.md#get_service_api_v1_service_catalog_sid_get) | **GET** /api/v1/service-catalog/{sid} | 服务详情
[**get_service_api_v1_service_catalog_sid_get_0**](ServiceCatalogApi.md#get_service_api_v1_service_catalog_sid_get_0) | **GET** /api/v1/service-catalog/{sid} | 服务详情
[**heartbeat_api_v1_service_catalog_sid_heartbeat_post**](ServiceCatalogApi.md#heartbeat_api_v1_service_catalog_sid_heartbeat_post) | **POST** /api/v1/service-catalog/{sid}/heartbeat | 心跳上报
[**heartbeat_api_v1_service_catalog_sid_heartbeat_post_0**](ServiceCatalogApi.md#heartbeat_api_v1_service_catalog_sid_heartbeat_post_0) | **POST** /api/v1/service-catalog/{sid}/heartbeat | 心跳上报
[**register_api_v1_service_catalog_post**](ServiceCatalogApi.md#register_api_v1_service_catalog_post) | **POST** /api/v1/service-catalog | 注册服务
[**register_api_v1_service_catalog_post_0**](ServiceCatalogApi.md#register_api_v1_service_catalog_post_0) | **POST** /api/v1/service-catalog | 注册服务
[**service_list_api_v1_service_catalog_list_get**](ServiceCatalogApi.md#service_list_api_v1_service_catalog_list_get) | **GET** /api/v1/service-catalog/list | 服务列表
[**service_list_api_v1_service_catalog_list_get_0**](ServiceCatalogApi.md#service_list_api_v1_service_catalog_list_get_0) | **GET** /api/v1/service-catalog/list | 服务列表
[**update_service_api_v1_service_catalog_sid_put**](ServiceCatalogApi.md#update_service_api_v1_service_catalog_sid_put) | **PUT** /api/v1/service-catalog/{sid} | 更新服务
[**update_service_api_v1_service_catalog_sid_put_0**](ServiceCatalogApi.md#update_service_api_v1_service_catalog_sid_put_0) | **PUT** /api/v1/service-catalog/{sid} | 更新服务


# **call_log_list_api_v1_service_catalog_log_list_get**
> object call_log_list_api_v1_service_catalog_log_list_get(page=page, limit=limit, service_code=service_code, status=status)

服务调用日志

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
    api_instance = zhs_api.ServiceCatalogApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    service_code = 'service_code_example' # str |  (optional)
    status = 56 # int |  (optional)

    try:
        # 服务调用日志
        api_response = api_instance.call_log_list_api_v1_service_catalog_log_list_get(page=page, limit=limit, service_code=service_code, status=status)
        print("The response of ServiceCatalogApi->call_log_list_api_v1_service_catalog_log_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ServiceCatalogApi->call_log_list_api_v1_service_catalog_log_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **service_code** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 

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

# **call_log_list_api_v1_service_catalog_log_list_get_0**
> object call_log_list_api_v1_service_catalog_log_list_get_0(page=page, limit=limit, service_code=service_code, status=status)

服务调用日志

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
    api_instance = zhs_api.ServiceCatalogApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    service_code = 'service_code_example' # str |  (optional)
    status = 56 # int |  (optional)

    try:
        # 服务调用日志
        api_response = api_instance.call_log_list_api_v1_service_catalog_log_list_get_0(page=page, limit=limit, service_code=service_code, status=status)
        print("The response of ServiceCatalogApi->call_log_list_api_v1_service_catalog_log_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ServiceCatalogApi->call_log_list_api_v1_service_catalog_log_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **service_code** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 

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

# **delete_service_api_v1_service_catalog_sid_delete**
> object delete_service_api_v1_service_catalog_sid_delete(sid)

下线服务

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
    api_instance = zhs_api.ServiceCatalogApi(api_client)
    sid = 56 # int | 

    try:
        # 下线服务
        api_response = api_instance.delete_service_api_v1_service_catalog_sid_delete(sid)
        print("The response of ServiceCatalogApi->delete_service_api_v1_service_catalog_sid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ServiceCatalogApi->delete_service_api_v1_service_catalog_sid_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sid** | **int**|  | 

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

# **delete_service_api_v1_service_catalog_sid_delete_0**
> object delete_service_api_v1_service_catalog_sid_delete_0(sid)

下线服务

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
    api_instance = zhs_api.ServiceCatalogApi(api_client)
    sid = 56 # int | 

    try:
        # 下线服务
        api_response = api_instance.delete_service_api_v1_service_catalog_sid_delete_0(sid)
        print("The response of ServiceCatalogApi->delete_service_api_v1_service_catalog_sid_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ServiceCatalogApi->delete_service_api_v1_service_catalog_sid_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sid** | **int**|  | 

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

# **get_service_api_v1_service_catalog_sid_get**
> object get_service_api_v1_service_catalog_sid_get(sid)

服务详情

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
    api_instance = zhs_api.ServiceCatalogApi(api_client)
    sid = 56 # int | 

    try:
        # 服务详情
        api_response = api_instance.get_service_api_v1_service_catalog_sid_get(sid)
        print("The response of ServiceCatalogApi->get_service_api_v1_service_catalog_sid_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ServiceCatalogApi->get_service_api_v1_service_catalog_sid_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sid** | **int**|  | 

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

# **get_service_api_v1_service_catalog_sid_get_0**
> object get_service_api_v1_service_catalog_sid_get_0(sid)

服务详情

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
    api_instance = zhs_api.ServiceCatalogApi(api_client)
    sid = 56 # int | 

    try:
        # 服务详情
        api_response = api_instance.get_service_api_v1_service_catalog_sid_get_0(sid)
        print("The response of ServiceCatalogApi->get_service_api_v1_service_catalog_sid_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ServiceCatalogApi->get_service_api_v1_service_catalog_sid_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sid** | **int**|  | 

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

# **heartbeat_api_v1_service_catalog_sid_heartbeat_post**
> object heartbeat_api_v1_service_catalog_sid_heartbeat_post(sid, is_healthy=is_healthy, error_msg=error_msg)

心跳上报

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
    api_instance = zhs_api.ServiceCatalogApi(api_client)
    sid = 56 # int | 
    is_healthy = True # bool |  (optional) (default to True)
    error_msg = 'error_msg_example' # str |  (optional)

    try:
        # 心跳上报
        api_response = api_instance.heartbeat_api_v1_service_catalog_sid_heartbeat_post(sid, is_healthy=is_healthy, error_msg=error_msg)
        print("The response of ServiceCatalogApi->heartbeat_api_v1_service_catalog_sid_heartbeat_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ServiceCatalogApi->heartbeat_api_v1_service_catalog_sid_heartbeat_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sid** | **int**|  | 
 **is_healthy** | **bool**|  | [optional] [default to True]
 **error_msg** | **str**|  | [optional] 

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

# **heartbeat_api_v1_service_catalog_sid_heartbeat_post_0**
> object heartbeat_api_v1_service_catalog_sid_heartbeat_post_0(sid, is_healthy=is_healthy, error_msg=error_msg)

心跳上报

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
    api_instance = zhs_api.ServiceCatalogApi(api_client)
    sid = 56 # int | 
    is_healthy = True # bool |  (optional) (default to True)
    error_msg = 'error_msg_example' # str |  (optional)

    try:
        # 心跳上报
        api_response = api_instance.heartbeat_api_v1_service_catalog_sid_heartbeat_post_0(sid, is_healthy=is_healthy, error_msg=error_msg)
        print("The response of ServiceCatalogApi->heartbeat_api_v1_service_catalog_sid_heartbeat_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ServiceCatalogApi->heartbeat_api_v1_service_catalog_sid_heartbeat_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sid** | **int**|  | 
 **is_healthy** | **bool**|  | [optional] [default to True]
 **error_msg** | **str**|  | [optional] 

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

# **register_api_v1_service_catalog_post**
> object register_api_v1_service_catalog_post(code, name, type=type, host=host, port=port, path=path, version=version, description=description, group=group, tags=tags, health_url=health_url, weight=weight, config=config)

注册服务

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
    api_instance = zhs_api.ServiceCatalogApi(api_client)
    code = 'code_example' # str | 
    name = 'name_example' # str | 
    type = 'api' # str |  (optional) (default to 'api')
    host = 'host_example' # str |  (optional)
    port = 0 # int |  (optional) (default to 0)
    path = '/' # str |  (optional) (default to '/')
    version = '1.0.0' # str |  (optional) (default to '1.0.0')
    description = 'description_example' # str |  (optional)
    group = 'default' # str |  (optional) (default to 'default')
    tags = 'tags_example' # str |  (optional)
    health_url = 'health_url_example' # str |  (optional)
    weight = 1 # int |  (optional) (default to 1)
    config = 'config_example' # str |  (optional)

    try:
        # 注册服务
        api_response = api_instance.register_api_v1_service_catalog_post(code, name, type=type, host=host, port=port, path=path, version=version, description=description, group=group, tags=tags, health_url=health_url, weight=weight, config=config)
        print("The response of ServiceCatalogApi->register_api_v1_service_catalog_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ServiceCatalogApi->register_api_v1_service_catalog_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**|  | 
 **name** | **str**|  | 
 **type** | **str**|  | [optional] [default to &#39;api&#39;]
 **host** | **str**|  | [optional] 
 **port** | **int**|  | [optional] [default to 0]
 **path** | **str**|  | [optional] [default to &#39;/&#39;]
 **version** | **str**|  | [optional] [default to &#39;1.0.0&#39;]
 **description** | **str**|  | [optional] 
 **group** | **str**|  | [optional] [default to &#39;default&#39;]
 **tags** | **str**|  | [optional] 
 **health_url** | **str**|  | [optional] 
 **weight** | **int**|  | [optional] [default to 1]
 **config** | **str**|  | [optional] 

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

# **register_api_v1_service_catalog_post_0**
> object register_api_v1_service_catalog_post_0(code, name, type=type, host=host, port=port, path=path, version=version, description=description, group=group, tags=tags, health_url=health_url, weight=weight, config=config)

注册服务

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
    api_instance = zhs_api.ServiceCatalogApi(api_client)
    code = 'code_example' # str | 
    name = 'name_example' # str | 
    type = 'api' # str |  (optional) (default to 'api')
    host = 'host_example' # str |  (optional)
    port = 0 # int |  (optional) (default to 0)
    path = '/' # str |  (optional) (default to '/')
    version = '1.0.0' # str |  (optional) (default to '1.0.0')
    description = 'description_example' # str |  (optional)
    group = 'default' # str |  (optional) (default to 'default')
    tags = 'tags_example' # str |  (optional)
    health_url = 'health_url_example' # str |  (optional)
    weight = 1 # int |  (optional) (default to 1)
    config = 'config_example' # str |  (optional)

    try:
        # 注册服务
        api_response = api_instance.register_api_v1_service_catalog_post_0(code, name, type=type, host=host, port=port, path=path, version=version, description=description, group=group, tags=tags, health_url=health_url, weight=weight, config=config)
        print("The response of ServiceCatalogApi->register_api_v1_service_catalog_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ServiceCatalogApi->register_api_v1_service_catalog_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**|  | 
 **name** | **str**|  | 
 **type** | **str**|  | [optional] [default to &#39;api&#39;]
 **host** | **str**|  | [optional] 
 **port** | **int**|  | [optional] [default to 0]
 **path** | **str**|  | [optional] [default to &#39;/&#39;]
 **version** | **str**|  | [optional] [default to &#39;1.0.0&#39;]
 **description** | **str**|  | [optional] 
 **group** | **str**|  | [optional] [default to &#39;default&#39;]
 **tags** | **str**|  | [optional] 
 **health_url** | **str**|  | [optional] 
 **weight** | **int**|  | [optional] [default to 1]
 **config** | **str**|  | [optional] 

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

# **service_list_api_v1_service_catalog_list_get**
> object service_list_api_v1_service_catalog_list_get(group=group, type=type, status=status, keyword=keyword)

服务列表

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
    api_instance = zhs_api.ServiceCatalogApi(api_client)
    group = 'group_example' # str |  (optional)
    type = 'type_example' # str |  (optional)
    status = 56 # int |  (optional)
    keyword = 'keyword_example' # str |  (optional)

    try:
        # 服务列表
        api_response = api_instance.service_list_api_v1_service_catalog_list_get(group=group, type=type, status=status, keyword=keyword)
        print("The response of ServiceCatalogApi->service_list_api_v1_service_catalog_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ServiceCatalogApi->service_list_api_v1_service_catalog_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **group** | **str**|  | [optional] 
 **type** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 
 **keyword** | **str**|  | [optional] 

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

# **service_list_api_v1_service_catalog_list_get_0**
> object service_list_api_v1_service_catalog_list_get_0(group=group, type=type, status=status, keyword=keyword)

服务列表

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
    api_instance = zhs_api.ServiceCatalogApi(api_client)
    group = 'group_example' # str |  (optional)
    type = 'type_example' # str |  (optional)
    status = 56 # int |  (optional)
    keyword = 'keyword_example' # str |  (optional)

    try:
        # 服务列表
        api_response = api_instance.service_list_api_v1_service_catalog_list_get_0(group=group, type=type, status=status, keyword=keyword)
        print("The response of ServiceCatalogApi->service_list_api_v1_service_catalog_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ServiceCatalogApi->service_list_api_v1_service_catalog_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **group** | **str**|  | [optional] 
 **type** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 
 **keyword** | **str**|  | [optional] 

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

# **update_service_api_v1_service_catalog_sid_put**
> object update_service_api_v1_service_catalog_sid_put(sid, name=name, host=host, port=port, status=status, weight=weight, config=config)

更新服务

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
    api_instance = zhs_api.ServiceCatalogApi(api_client)
    sid = 56 # int | 
    name = 'name_example' # str |  (optional)
    host = 'host_example' # str |  (optional)
    port = 56 # int |  (optional)
    status = 56 # int |  (optional)
    weight = 56 # int |  (optional)
    config = 'config_example' # str |  (optional)

    try:
        # 更新服务
        api_response = api_instance.update_service_api_v1_service_catalog_sid_put(sid, name=name, host=host, port=port, status=status, weight=weight, config=config)
        print("The response of ServiceCatalogApi->update_service_api_v1_service_catalog_sid_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ServiceCatalogApi->update_service_api_v1_service_catalog_sid_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sid** | **int**|  | 
 **name** | **str**|  | [optional] 
 **host** | **str**|  | [optional] 
 **port** | **int**|  | [optional] 
 **status** | **int**|  | [optional] 
 **weight** | **int**|  | [optional] 
 **config** | **str**|  | [optional] 

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

# **update_service_api_v1_service_catalog_sid_put_0**
> object update_service_api_v1_service_catalog_sid_put_0(sid, name=name, host=host, port=port, status=status, weight=weight, config=config)

更新服务

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
    api_instance = zhs_api.ServiceCatalogApi(api_client)
    sid = 56 # int | 
    name = 'name_example' # str |  (optional)
    host = 'host_example' # str |  (optional)
    port = 56 # int |  (optional)
    status = 56 # int |  (optional)
    weight = 56 # int |  (optional)
    config = 'config_example' # str |  (optional)

    try:
        # 更新服务
        api_response = api_instance.update_service_api_v1_service_catalog_sid_put_0(sid, name=name, host=host, port=port, status=status, weight=weight, config=config)
        print("The response of ServiceCatalogApi->update_service_api_v1_service_catalog_sid_put_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ServiceCatalogApi->update_service_api_v1_service_catalog_sid_put_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sid** | **int**|  | 
 **name** | **str**|  | [optional] 
 **host** | **str**|  | [optional] 
 **port** | **int**|  | [optional] 
 **status** | **int**|  | [optional] 
 **weight** | **int**|  | [optional] 
 **config** | **str**|  | [optional] 

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

