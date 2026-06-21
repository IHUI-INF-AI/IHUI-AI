# zhs_api.EducationPlatformApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_platform_api_v1_education_platform_post**](EducationPlatformApi.md#create_platform_api_v1_education_platform_post) | **POST** /api/v1/education-platform | 新增教育平台
[**create_platform_api_v1_education_platform_post_0**](EducationPlatformApi.md#create_platform_api_v1_education_platform_post_0) | **POST** /api/v1/education-platform | 新增教育平台
[**delete_platform_api_v1_education_platform_pid_delete**](EducationPlatformApi.md#delete_platform_api_v1_education_platform_pid_delete) | **DELETE** /api/v1/education-platform/{pid} | 删除教育平台
[**delete_platform_api_v1_education_platform_pid_delete_0**](EducationPlatformApi.md#delete_platform_api_v1_education_platform_pid_delete_0) | **DELETE** /api/v1/education-platform/{pid} | 删除教育平台
[**list_platforms_api_v1_education_platform_list_get**](EducationPlatformApi.md#list_platforms_api_v1_education_platform_list_get) | **GET** /api/v1/education-platform/list | 教育平台列表
[**list_platforms_api_v1_education_platform_list_get_0**](EducationPlatformApi.md#list_platforms_api_v1_education_platform_list_get_0) | **GET** /api/v1/education-platform/list | 教育平台列表
[**sync_log_api_v1_education_platform_sync_log_get**](EducationPlatformApi.md#sync_log_api_v1_education_platform_sync_log_get) | **GET** /api/v1/education-platform/sync/log | 同步日志
[**sync_log_api_v1_education_platform_sync_log_get_0**](EducationPlatformApi.md#sync_log_api_v1_education_platform_sync_log_get_0) | **GET** /api/v1/education-platform/sync/log | 同步日志
[**sync_platform_api_v1_education_platform_pid_sync_post**](EducationPlatformApi.md#sync_platform_api_v1_education_platform_pid_sync_post) | **POST** /api/v1/education-platform/{pid}/sync | 同步数据
[**sync_platform_api_v1_education_platform_pid_sync_post_0**](EducationPlatformApi.md#sync_platform_api_v1_education_platform_pid_sync_post_0) | **POST** /api/v1/education-platform/{pid}/sync | 同步数据
[**update_platform_api_v1_education_platform_pid_put**](EducationPlatformApi.md#update_platform_api_v1_education_platform_pid_put) | **PUT** /api/v1/education-platform/{pid} | 修改教育平台
[**update_platform_api_v1_education_platform_pid_put_0**](EducationPlatformApi.md#update_platform_api_v1_education_platform_pid_put_0) | **PUT** /api/v1/education-platform/{pid} | 修改教育平台


# **create_platform_api_v1_education_platform_post**
> object create_platform_api_v1_education_platform_post(name, code, type=type, api_url=api_url, api_key=api_key, api_secret=api_secret, config=config, sync_url=sync_url, description=description)

新增教育平台

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
    api_instance = zhs_api.EducationPlatformApi(api_client)
    name = 'name_example' # str | 
    code = 'code_example' # str | 
    type = 'mooc' # str |  (optional) (default to 'mooc')
    api_url = 'api_url_example' # str |  (optional)
    api_key = 'api_key_example' # str |  (optional)
    api_secret = 'api_secret_example' # str |  (optional)
    config = 'config_example' # str |  (optional)
    sync_url = 'sync_url_example' # str |  (optional)
    description = 'description_example' # str |  (optional)

    try:
        # 新增教育平台
        api_response = api_instance.create_platform_api_v1_education_platform_post(name, code, type=type, api_url=api_url, api_key=api_key, api_secret=api_secret, config=config, sync_url=sync_url, description=description)
        print("The response of EducationPlatformApi->create_platform_api_v1_education_platform_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EducationPlatformApi->create_platform_api_v1_education_platform_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **str**|  | 
 **code** | **str**|  | 
 **type** | **str**|  | [optional] [default to &#39;mooc&#39;]
 **api_url** | **str**|  | [optional] 
 **api_key** | **str**|  | [optional] 
 **api_secret** | **str**|  | [optional] 
 **config** | **str**|  | [optional] 
 **sync_url** | **str**|  | [optional] 
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

# **create_platform_api_v1_education_platform_post_0**
> object create_platform_api_v1_education_platform_post_0(name, code, type=type, api_url=api_url, api_key=api_key, api_secret=api_secret, config=config, sync_url=sync_url, description=description)

新增教育平台

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
    api_instance = zhs_api.EducationPlatformApi(api_client)
    name = 'name_example' # str | 
    code = 'code_example' # str | 
    type = 'mooc' # str |  (optional) (default to 'mooc')
    api_url = 'api_url_example' # str |  (optional)
    api_key = 'api_key_example' # str |  (optional)
    api_secret = 'api_secret_example' # str |  (optional)
    config = 'config_example' # str |  (optional)
    sync_url = 'sync_url_example' # str |  (optional)
    description = 'description_example' # str |  (optional)

    try:
        # 新增教育平台
        api_response = api_instance.create_platform_api_v1_education_platform_post_0(name, code, type=type, api_url=api_url, api_key=api_key, api_secret=api_secret, config=config, sync_url=sync_url, description=description)
        print("The response of EducationPlatformApi->create_platform_api_v1_education_platform_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EducationPlatformApi->create_platform_api_v1_education_platform_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **str**|  | 
 **code** | **str**|  | 
 **type** | **str**|  | [optional] [default to &#39;mooc&#39;]
 **api_url** | **str**|  | [optional] 
 **api_key** | **str**|  | [optional] 
 **api_secret** | **str**|  | [optional] 
 **config** | **str**|  | [optional] 
 **sync_url** | **str**|  | [optional] 
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

# **delete_platform_api_v1_education_platform_pid_delete**
> object delete_platform_api_v1_education_platform_pid_delete(pid)

删除教育平台

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
    api_instance = zhs_api.EducationPlatformApi(api_client)
    pid = 56 # int | 

    try:
        # 删除教育平台
        api_response = api_instance.delete_platform_api_v1_education_platform_pid_delete(pid)
        print("The response of EducationPlatformApi->delete_platform_api_v1_education_platform_pid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EducationPlatformApi->delete_platform_api_v1_education_platform_pid_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pid** | **int**|  | 

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

# **delete_platform_api_v1_education_platform_pid_delete_0**
> object delete_platform_api_v1_education_platform_pid_delete_0(pid)

删除教育平台

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
    api_instance = zhs_api.EducationPlatformApi(api_client)
    pid = 56 # int | 

    try:
        # 删除教育平台
        api_response = api_instance.delete_platform_api_v1_education_platform_pid_delete_0(pid)
        print("The response of EducationPlatformApi->delete_platform_api_v1_education_platform_pid_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EducationPlatformApi->delete_platform_api_v1_education_platform_pid_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pid** | **int**|  | 

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

# **list_platforms_api_v1_education_platform_list_get**
> object list_platforms_api_v1_education_platform_list_get(status=status)

教育平台列表

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
    api_instance = zhs_api.EducationPlatformApi(api_client)
    status = 56 # int |  (optional)

    try:
        # 教育平台列表
        api_response = api_instance.list_platforms_api_v1_education_platform_list_get(status=status)
        print("The response of EducationPlatformApi->list_platforms_api_v1_education_platform_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EducationPlatformApi->list_platforms_api_v1_education_platform_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
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

# **list_platforms_api_v1_education_platform_list_get_0**
> object list_platforms_api_v1_education_platform_list_get_0(status=status)

教育平台列表

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
    api_instance = zhs_api.EducationPlatformApi(api_client)
    status = 56 # int |  (optional)

    try:
        # 教育平台列表
        api_response = api_instance.list_platforms_api_v1_education_platform_list_get_0(status=status)
        print("The response of EducationPlatformApi->list_platforms_api_v1_education_platform_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EducationPlatformApi->list_platforms_api_v1_education_platform_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
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

# **sync_log_api_v1_education_platform_sync_log_get**
> object sync_log_api_v1_education_platform_sync_log_get(page=page, limit=limit, platform_code=platform_code)

同步日志

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
    api_instance = zhs_api.EducationPlatformApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    platform_code = 'platform_code_example' # str |  (optional)

    try:
        # 同步日志
        api_response = api_instance.sync_log_api_v1_education_platform_sync_log_get(page=page, limit=limit, platform_code=platform_code)
        print("The response of EducationPlatformApi->sync_log_api_v1_education_platform_sync_log_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EducationPlatformApi->sync_log_api_v1_education_platform_sync_log_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **platform_code** | **str**|  | [optional] 

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

# **sync_log_api_v1_education_platform_sync_log_get_0**
> object sync_log_api_v1_education_platform_sync_log_get_0(page=page, limit=limit, platform_code=platform_code)

同步日志

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
    api_instance = zhs_api.EducationPlatformApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    platform_code = 'platform_code_example' # str |  (optional)

    try:
        # 同步日志
        api_response = api_instance.sync_log_api_v1_education_platform_sync_log_get_0(page=page, limit=limit, platform_code=platform_code)
        print("The response of EducationPlatformApi->sync_log_api_v1_education_platform_sync_log_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EducationPlatformApi->sync_log_api_v1_education_platform_sync_log_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **platform_code** | **str**|  | [optional] 

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

# **sync_platform_api_v1_education_platform_pid_sync_post**
> object sync_platform_api_v1_education_platform_pid_sync_post(pid, type=type, sync_type=sync_type)

同步数据

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
    api_instance = zhs_api.EducationPlatformApi(api_client)
    pid = 56 # int | 
    type = 'course' # str |  (optional) (default to 'course')
    sync_type = 'pull' # str |  (optional) (default to 'pull')

    try:
        # 同步数据
        api_response = api_instance.sync_platform_api_v1_education_platform_pid_sync_post(pid, type=type, sync_type=sync_type)
        print("The response of EducationPlatformApi->sync_platform_api_v1_education_platform_pid_sync_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EducationPlatformApi->sync_platform_api_v1_education_platform_pid_sync_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pid** | **int**|  | 
 **type** | **str**|  | [optional] [default to &#39;course&#39;]
 **sync_type** | **str**|  | [optional] [default to &#39;pull&#39;]

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

# **sync_platform_api_v1_education_platform_pid_sync_post_0**
> object sync_platform_api_v1_education_platform_pid_sync_post_0(pid, type=type, sync_type=sync_type)

同步数据

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
    api_instance = zhs_api.EducationPlatformApi(api_client)
    pid = 56 # int | 
    type = 'course' # str |  (optional) (default to 'course')
    sync_type = 'pull' # str |  (optional) (default to 'pull')

    try:
        # 同步数据
        api_response = api_instance.sync_platform_api_v1_education_platform_pid_sync_post_0(pid, type=type, sync_type=sync_type)
        print("The response of EducationPlatformApi->sync_platform_api_v1_education_platform_pid_sync_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EducationPlatformApi->sync_platform_api_v1_education_platform_pid_sync_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pid** | **int**|  | 
 **type** | **str**|  | [optional] [default to &#39;course&#39;]
 **sync_type** | **str**|  | [optional] [default to &#39;pull&#39;]

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

# **update_platform_api_v1_education_platform_pid_put**
> object update_platform_api_v1_education_platform_pid_put(pid, name=name, api_url=api_url, api_key=api_key, api_secret=api_secret, status=status, config=config)

修改教育平台

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
    api_instance = zhs_api.EducationPlatformApi(api_client)
    pid = 56 # int | 
    name = 'name_example' # str |  (optional)
    api_url = 'api_url_example' # str |  (optional)
    api_key = 'api_key_example' # str |  (optional)
    api_secret = 'api_secret_example' # str |  (optional)
    status = 56 # int |  (optional)
    config = 'config_example' # str |  (optional)

    try:
        # 修改教育平台
        api_response = api_instance.update_platform_api_v1_education_platform_pid_put(pid, name=name, api_url=api_url, api_key=api_key, api_secret=api_secret, status=status, config=config)
        print("The response of EducationPlatformApi->update_platform_api_v1_education_platform_pid_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EducationPlatformApi->update_platform_api_v1_education_platform_pid_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pid** | **int**|  | 
 **name** | **str**|  | [optional] 
 **api_url** | **str**|  | [optional] 
 **api_key** | **str**|  | [optional] 
 **api_secret** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 
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

# **update_platform_api_v1_education_platform_pid_put_0**
> object update_platform_api_v1_education_platform_pid_put_0(pid, name=name, api_url=api_url, api_key=api_key, api_secret=api_secret, status=status, config=config)

修改教育平台

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
    api_instance = zhs_api.EducationPlatformApi(api_client)
    pid = 56 # int | 
    name = 'name_example' # str |  (optional)
    api_url = 'api_url_example' # str |  (optional)
    api_key = 'api_key_example' # str |  (optional)
    api_secret = 'api_secret_example' # str |  (optional)
    status = 56 # int |  (optional)
    config = 'config_example' # str |  (optional)

    try:
        # 修改教育平台
        api_response = api_instance.update_platform_api_v1_education_platform_pid_put_0(pid, name=name, api_url=api_url, api_key=api_key, api_secret=api_secret, status=status, config=config)
        print("The response of EducationPlatformApi->update_platform_api_v1_education_platform_pid_put_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EducationPlatformApi->update_platform_api_v1_education_platform_pid_put_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pid** | **int**|  | 
 **name** | **str**|  | [optional] 
 **api_url** | **str**|  | [optional] 
 **api_key** | **str**|  | [optional] 
 **api_secret** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 
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

