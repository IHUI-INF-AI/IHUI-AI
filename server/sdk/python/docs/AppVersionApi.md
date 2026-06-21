# zhs_api.AppVersionApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**check_update_api_v1_app_version_check_get**](AppVersionApi.md#check_update_api_v1_app_version_check_get) | **GET** /api/v1/app-version/check | 检查更新
[**check_update_api_v1_app_version_check_get_0**](AppVersionApi.md#check_update_api_v1_app_version_check_get_0) | **GET** /api/v1/app-version/check | 检查更新
[**create_version_api_v1_app_version_post**](AppVersionApi.md#create_version_api_v1_app_version_post) | **POST** /api/v1/app-version | 新增版本
[**create_version_api_v1_app_version_post_0**](AppVersionApi.md#create_version_api_v1_app_version_post_0) | **POST** /api/v1/app-version | 新增版本
[**delete_version_api_v1_app_version_vid_delete**](AppVersionApi.md#delete_version_api_v1_app_version_vid_delete) | **DELETE** /api/v1/app-version/{vid} | 删除版本
[**delete_version_api_v1_app_version_vid_delete_0**](AppVersionApi.md#delete_version_api_v1_app_version_vid_delete_0) | **DELETE** /api/v1/app-version/{vid} | 删除版本
[**list_versions_api_v1_app_version_list_get**](AppVersionApi.md#list_versions_api_v1_app_version_list_get) | **GET** /api/v1/app-version/list | 版本列表
[**list_versions_api_v1_app_version_list_get_0**](AppVersionApi.md#list_versions_api_v1_app_version_list_get_0) | **GET** /api/v1/app-version/list | 版本列表
[**update_version_api_v1_app_version_vid_put**](AppVersionApi.md#update_version_api_v1_app_version_vid_put) | **PUT** /api/v1/app-version/{vid} | 修改版本
[**update_version_api_v1_app_version_vid_put_0**](AppVersionApi.md#update_version_api_v1_app_version_vid_put_0) | **PUT** /api/v1/app-version/{vid} | 修改版本


# **check_update_api_v1_app_version_check_get**
> object check_update_api_v1_app_version_check_get(platform, current_version, build=build)

检查更新

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
    api_instance = zhs_api.AppVersionApi(api_client)
    platform = 'platform_example' # str | 
    current_version = 'current_version_example' # str | 
    build = 0 # int |  (optional) (default to 0)

    try:
        # 检查更新
        api_response = api_instance.check_update_api_v1_app_version_check_get(platform, current_version, build=build)
        print("The response of AppVersionApi->check_update_api_v1_app_version_check_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AppVersionApi->check_update_api_v1_app_version_check_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform** | **str**|  | 
 **current_version** | **str**|  | 
 **build** | **int**|  | [optional] [default to 0]

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

# **check_update_api_v1_app_version_check_get_0**
> object check_update_api_v1_app_version_check_get_0(platform, current_version, build=build)

检查更新

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
    api_instance = zhs_api.AppVersionApi(api_client)
    platform = 'platform_example' # str | 
    current_version = 'current_version_example' # str | 
    build = 0 # int |  (optional) (default to 0)

    try:
        # 检查更新
        api_response = api_instance.check_update_api_v1_app_version_check_get_0(platform, current_version, build=build)
        print("The response of AppVersionApi->check_update_api_v1_app_version_check_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AppVersionApi->check_update_api_v1_app_version_check_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform** | **str**|  | 
 **current_version** | **str**|  | 
 **build** | **int**|  | [optional] [default to 0]

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

# **create_version_api_v1_app_version_post**
> object create_version_api_v1_app_version_post(platform, version, title, content, build=build, download_url=download_url, is_force=is_force, is_silent=is_silent, min_version=min_version, gray_ratio=gray_ratio, file_size=file_size, md5=md5)

新增版本

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
    api_instance = zhs_api.AppVersionApi(api_client)
    platform = 'platform_example' # str | 
    version = 'version_example' # str | 
    title = 'title_example' # str | 
    content = 'content_example' # str | 
    build = 1 # int |  (optional) (default to 1)
    download_url = 'download_url_example' # str |  (optional)
    is_force = False # bool |  (optional) (default to False)
    is_silent = False # bool |  (optional) (default to False)
    min_version = 'min_version_example' # str |  (optional)
    gray_ratio = 0 # int |  (optional) (default to 0)
    file_size = 0 # int |  (optional) (default to 0)
    md5 = 'md5_example' # str |  (optional)

    try:
        # 新增版本
        api_response = api_instance.create_version_api_v1_app_version_post(platform, version, title, content, build=build, download_url=download_url, is_force=is_force, is_silent=is_silent, min_version=min_version, gray_ratio=gray_ratio, file_size=file_size, md5=md5)
        print("The response of AppVersionApi->create_version_api_v1_app_version_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AppVersionApi->create_version_api_v1_app_version_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform** | **str**|  | 
 **version** | **str**|  | 
 **title** | **str**|  | 
 **content** | **str**|  | 
 **build** | **int**|  | [optional] [default to 1]
 **download_url** | **str**|  | [optional] 
 **is_force** | **bool**|  | [optional] [default to False]
 **is_silent** | **bool**|  | [optional] [default to False]
 **min_version** | **str**|  | [optional] 
 **gray_ratio** | **int**|  | [optional] [default to 0]
 **file_size** | **int**|  | [optional] [default to 0]
 **md5** | **str**|  | [optional] 

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

# **create_version_api_v1_app_version_post_0**
> object create_version_api_v1_app_version_post_0(platform, version, title, content, build=build, download_url=download_url, is_force=is_force, is_silent=is_silent, min_version=min_version, gray_ratio=gray_ratio, file_size=file_size, md5=md5)

新增版本

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
    api_instance = zhs_api.AppVersionApi(api_client)
    platform = 'platform_example' # str | 
    version = 'version_example' # str | 
    title = 'title_example' # str | 
    content = 'content_example' # str | 
    build = 1 # int |  (optional) (default to 1)
    download_url = 'download_url_example' # str |  (optional)
    is_force = False # bool |  (optional) (default to False)
    is_silent = False # bool |  (optional) (default to False)
    min_version = 'min_version_example' # str |  (optional)
    gray_ratio = 0 # int |  (optional) (default to 0)
    file_size = 0 # int |  (optional) (default to 0)
    md5 = 'md5_example' # str |  (optional)

    try:
        # 新增版本
        api_response = api_instance.create_version_api_v1_app_version_post_0(platform, version, title, content, build=build, download_url=download_url, is_force=is_force, is_silent=is_silent, min_version=min_version, gray_ratio=gray_ratio, file_size=file_size, md5=md5)
        print("The response of AppVersionApi->create_version_api_v1_app_version_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AppVersionApi->create_version_api_v1_app_version_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform** | **str**|  | 
 **version** | **str**|  | 
 **title** | **str**|  | 
 **content** | **str**|  | 
 **build** | **int**|  | [optional] [default to 1]
 **download_url** | **str**|  | [optional] 
 **is_force** | **bool**|  | [optional] [default to False]
 **is_silent** | **bool**|  | [optional] [default to False]
 **min_version** | **str**|  | [optional] 
 **gray_ratio** | **int**|  | [optional] [default to 0]
 **file_size** | **int**|  | [optional] [default to 0]
 **md5** | **str**|  | [optional] 

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

# **delete_version_api_v1_app_version_vid_delete**
> object delete_version_api_v1_app_version_vid_delete(vid)

删除版本

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
    api_instance = zhs_api.AppVersionApi(api_client)
    vid = 56 # int | 

    try:
        # 删除版本
        api_response = api_instance.delete_version_api_v1_app_version_vid_delete(vid)
        print("The response of AppVersionApi->delete_version_api_v1_app_version_vid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AppVersionApi->delete_version_api_v1_app_version_vid_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **vid** | **int**|  | 

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

# **delete_version_api_v1_app_version_vid_delete_0**
> object delete_version_api_v1_app_version_vid_delete_0(vid)

删除版本

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
    api_instance = zhs_api.AppVersionApi(api_client)
    vid = 56 # int | 

    try:
        # 删除版本
        api_response = api_instance.delete_version_api_v1_app_version_vid_delete_0(vid)
        print("The response of AppVersionApi->delete_version_api_v1_app_version_vid_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AppVersionApi->delete_version_api_v1_app_version_vid_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **vid** | **int**|  | 

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

# **list_versions_api_v1_app_version_list_get**
> object list_versions_api_v1_app_version_list_get(platform=platform, page=page, limit=limit)

版本列表

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
    api_instance = zhs_api.AppVersionApi(api_client)
    platform = 'platform_example' # str |  (optional)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 版本列表
        api_response = api_instance.list_versions_api_v1_app_version_list_get(platform=platform, page=page, limit=limit)
        print("The response of AppVersionApi->list_versions_api_v1_app_version_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AppVersionApi->list_versions_api_v1_app_version_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform** | **str**|  | [optional] 
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

# **list_versions_api_v1_app_version_list_get_0**
> object list_versions_api_v1_app_version_list_get_0(platform=platform, page=page, limit=limit)

版本列表

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
    api_instance = zhs_api.AppVersionApi(api_client)
    platform = 'platform_example' # str |  (optional)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 版本列表
        api_response = api_instance.list_versions_api_v1_app_version_list_get_0(platform=platform, page=page, limit=limit)
        print("The response of AppVersionApi->list_versions_api_v1_app_version_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AppVersionApi->list_versions_api_v1_app_version_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform** | **str**|  | [optional] 
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

# **update_version_api_v1_app_version_vid_put**
> object update_version_api_v1_app_version_vid_put(vid, title=title, content=content, status=status, is_force=is_force, download_url=download_url, gray_ratio=gray_ratio)

修改版本

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
    api_instance = zhs_api.AppVersionApi(api_client)
    vid = 56 # int | 
    title = 'title_example' # str |  (optional)
    content = 'content_example' # str |  (optional)
    status = 56 # int |  (optional)
    is_force = True # bool |  (optional)
    download_url = 'download_url_example' # str |  (optional)
    gray_ratio = 56 # int |  (optional)

    try:
        # 修改版本
        api_response = api_instance.update_version_api_v1_app_version_vid_put(vid, title=title, content=content, status=status, is_force=is_force, download_url=download_url, gray_ratio=gray_ratio)
        print("The response of AppVersionApi->update_version_api_v1_app_version_vid_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AppVersionApi->update_version_api_v1_app_version_vid_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **vid** | **int**|  | 
 **title** | **str**|  | [optional] 
 **content** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 
 **is_force** | **bool**|  | [optional] 
 **download_url** | **str**|  | [optional] 
 **gray_ratio** | **int**|  | [optional] 

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

# **update_version_api_v1_app_version_vid_put_0**
> object update_version_api_v1_app_version_vid_put_0(vid, title=title, content=content, status=status, is_force=is_force, download_url=download_url, gray_ratio=gray_ratio)

修改版本

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
    api_instance = zhs_api.AppVersionApi(api_client)
    vid = 56 # int | 
    title = 'title_example' # str |  (optional)
    content = 'content_example' # str |  (optional)
    status = 56 # int |  (optional)
    is_force = True # bool |  (optional)
    download_url = 'download_url_example' # str |  (optional)
    gray_ratio = 56 # int |  (optional)

    try:
        # 修改版本
        api_response = api_instance.update_version_api_v1_app_version_vid_put_0(vid, title=title, content=content, status=status, is_force=is_force, download_url=download_url, gray_ratio=gray_ratio)
        print("The response of AppVersionApi->update_version_api_v1_app_version_vid_put_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AppVersionApi->update_version_api_v1_app_version_vid_put_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **vid** | **int**|  | 
 **title** | **str**|  | [optional] 
 **content** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 
 **is_force** | **bool**|  | [optional] 
 **download_url** | **str**|  | [optional] 
 **gray_ratio** | **int**|  | [optional] 

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

