# zhs_api.ContentApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_version_api_v1_content_version_create_post**](ContentApi.md#create_version_api_v1_content_version_create_post) | **POST** /api/v1/content/version/create | 创建 App 版本
[**delete_feedback_api_v1_content_feedback_delete_delete**](ContentApi.md#delete_feedback_api_v1_content_feedback_delete_delete) | **DELETE** /api/v1/content/feedback/delete | 删除反馈
[**delete_version_api_v1_content_version_delete_delete**](ContentApi.md#delete_version_api_v1_content_version_delete_delete) | **DELETE** /api/v1/content/version/delete | 删除 App 版本
[**get_about_api_v1_content_about_get**](ContentApi.md#get_about_api_v1_content_about_get) | **GET** /api/v1/content/about | Get about us
[**get_contact_api_v1_content_contact_get**](ContentApi.md#get_contact_api_v1_content_contact_get) | **GET** /api/v1/content/contact | 获取联系信息
[**get_news_api_v1_content_news_news_id_get**](ContentApi.md#get_news_api_v1_content_news_news_id_get) | **GET** /api/v1/content/news/{news_id} | Get news detail
[**get_version_api_v1_content_version_get**](ContentApi.md#get_version_api_v1_content_version_get) | **GET** /api/v1/content/version | Get latest app version
[**list_banners_api_v1_content_banners_get**](ContentApi.md#list_banners_api_v1_content_banners_get) | **GET** /api/v1/content/banners | List banners
[**list_feedbacks_api_v1_content_feedback_list_get**](ContentApi.md#list_feedbacks_api_v1_content_feedback_list_get) | **GET** /api/v1/content/feedback/list | 反馈列表
[**list_news_api_v1_content_news_get**](ContentApi.md#list_news_api_v1_content_news_get) | **GET** /api/v1/content/news | List news
[**list_versions_api_v1_content_version_list_get**](ContentApi.md#list_versions_api_v1_content_version_list_get) | **GET** /api/v1/content/version/list | App 版本列表
[**submit_feedback_api_v1_content_feedback_post**](ContentApi.md#submit_feedback_api_v1_content_feedback_post) | **POST** /api/v1/content/feedback | Submit feedback
[**update_feedback_api_v1_content_feedback_update_put**](ContentApi.md#update_feedback_api_v1_content_feedback_update_put) | **PUT** /api/v1/content/feedback/update | 更新/回复反馈
[**update_version_api_v1_content_version_update_put**](ContentApi.md#update_version_api_v1_content_version_update_put) | **PUT** /api/v1/content/version/update | 更新 App 版本


# **create_version_api_v1_content_version_create_post**
> object create_version_api_v1_content_version_create_post(version_code, version_name, download_url, description=description, platform=platform, force_update=force_update)

创建 App 版本

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
    api_instance = zhs_api.ContentApi(api_client)
    version_code = 'version_code_example' # str | 
    version_name = 'version_name_example' # str | 
    download_url = 'download_url_example' # str | 
    description = '' # str |  (optional) (default to '')
    platform = 'android' # str |  (optional) (default to 'android')
    force_update = 0 # int | 0=否 1=是 (optional) (default to 0)

    try:
        # 创建 App 版本
        api_response = api_instance.create_version_api_v1_content_version_create_post(version_code, version_name, download_url, description=description, platform=platform, force_update=force_update)
        print("The response of ContentApi->create_version_api_v1_content_version_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentApi->create_version_api_v1_content_version_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **version_code** | **str**|  | 
 **version_name** | **str**|  | 
 **download_url** | **str**|  | 
 **description** | **str**|  | [optional] [default to &#39;&#39;]
 **platform** | **str**|  | [optional] [default to &#39;android&#39;]
 **force_update** | **int**| 0&#x3D;否 1&#x3D;是 | [optional] [default to 0]

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

# **delete_feedback_api_v1_content_feedback_delete_delete**
> object delete_feedback_api_v1_content_feedback_delete_delete(feedback_id)

删除反馈

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
    api_instance = zhs_api.ContentApi(api_client)
    feedback_id = 56 # int | 

    try:
        # 删除反馈
        api_response = api_instance.delete_feedback_api_v1_content_feedback_delete_delete(feedback_id)
        print("The response of ContentApi->delete_feedback_api_v1_content_feedback_delete_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentApi->delete_feedback_api_v1_content_feedback_delete_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **feedback_id** | **int**|  | 

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

# **delete_version_api_v1_content_version_delete_delete**
> object delete_version_api_v1_content_version_delete_delete(version_id)

删除 App 版本

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
    api_instance = zhs_api.ContentApi(api_client)
    version_id = 56 # int | 

    try:
        # 删除 App 版本
        api_response = api_instance.delete_version_api_v1_content_version_delete_delete(version_id)
        print("The response of ContentApi->delete_version_api_v1_content_version_delete_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentApi->delete_version_api_v1_content_version_delete_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **version_id** | **int**|  | 

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

# **get_about_api_v1_content_about_get**
> object get_about_api_v1_content_about_get()

Get about us

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
    api_instance = zhs_api.ContentApi(api_client)

    try:
        # Get about us
        api_response = api_instance.get_about_api_v1_content_about_get()
        print("The response of ContentApi->get_about_api_v1_content_about_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentApi->get_about_api_v1_content_about_get: %s\n" % e)
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

# **get_contact_api_v1_content_contact_get**
> object get_contact_api_v1_content_contact_get()

获取联系信息

Return the active contact-us entry.

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
    api_instance = zhs_api.ContentApi(api_client)

    try:
        # 获取联系信息
        api_response = api_instance.get_contact_api_v1_content_contact_get()
        print("The response of ContentApi->get_contact_api_v1_content_contact_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentApi->get_contact_api_v1_content_contact_get: %s\n" % e)
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

# **get_news_api_v1_content_news_news_id_get**
> object get_news_api_v1_content_news_news_id_get(news_id)

Get news detail

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
    api_instance = zhs_api.ContentApi(api_client)
    news_id = 56 # int | 

    try:
        # Get news detail
        api_response = api_instance.get_news_api_v1_content_news_news_id_get(news_id)
        print("The response of ContentApi->get_news_api_v1_content_news_news_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentApi->get_news_api_v1_content_news_news_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **news_id** | **int**|  | 

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

# **get_version_api_v1_content_version_get**
> object get_version_api_v1_content_version_get(platform=platform)

Get latest app version

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
    api_instance = zhs_api.ContentApi(api_client)
    platform = 'android' # str |  (optional) (default to 'android')

    try:
        # Get latest app version
        api_response = api_instance.get_version_api_v1_content_version_get(platform=platform)
        print("The response of ContentApi->get_version_api_v1_content_version_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentApi->get_version_api_v1_content_version_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform** | **str**|  | [optional] [default to &#39;android&#39;]

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

# **list_banners_api_v1_content_banners_get**
> object list_banners_api_v1_content_banners_get(position=position)

List banners

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
    api_instance = zhs_api.ContentApi(api_client)
    position = 'position_example' # str |  (optional)

    try:
        # List banners
        api_response = api_instance.list_banners_api_v1_content_banners_get(position=position)
        print("The response of ContentApi->list_banners_api_v1_content_banners_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentApi->list_banners_api_v1_content_banners_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **position** | **str**|  | [optional] 

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

# **list_feedbacks_api_v1_content_feedback_list_get**
> object list_feedbacks_api_v1_content_feedback_list_get(page=page, limit=limit, status=status)

反馈列表

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
    api_instance = zhs_api.ContentApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    status = 56 # int | 筛选状态: 0=未处理 1=已处理 (optional)

    try:
        # 反馈列表
        api_response = api_instance.list_feedbacks_api_v1_content_feedback_list_get(page=page, limit=limit, status=status)
        print("The response of ContentApi->list_feedbacks_api_v1_content_feedback_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentApi->list_feedbacks_api_v1_content_feedback_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **status** | **int**| 筛选状态: 0&#x3D;未处理 1&#x3D;已处理 | [optional] 

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

# **list_news_api_v1_content_news_get**
> object list_news_api_v1_content_news_get(page=page, limit=limit)

List news

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
    api_instance = zhs_api.ContentApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # List news
        api_response = api_instance.list_news_api_v1_content_news_get(page=page, limit=limit)
        print("The response of ContentApi->list_news_api_v1_content_news_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentApi->list_news_api_v1_content_news_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
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

# **list_versions_api_v1_content_version_list_get**
> object list_versions_api_v1_content_version_list_get(page=page, limit=limit, platform=platform)

App 版本列表

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
    api_instance = zhs_api.ContentApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    platform = 'platform_example' # str |  (optional)

    try:
        # App 版本列表
        api_response = api_instance.list_versions_api_v1_content_version_list_get(page=page, limit=limit, platform=platform)
        print("The response of ContentApi->list_versions_api_v1_content_version_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentApi->list_versions_api_v1_content_version_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **platform** | **str**|  | [optional] 

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

# **submit_feedback_api_v1_content_feedback_post**
> object submit_feedback_api_v1_content_feedback_post(content, images=images, type=type)

Submit feedback

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
    api_instance = zhs_api.ContentApi(api_client)
    content = 'content_example' # str | 
    images = 'images_example' # str |  (optional)
    type = 'type_example' # str |  (optional)

    try:
        # Submit feedback
        api_response = api_instance.submit_feedback_api_v1_content_feedback_post(content, images=images, type=type)
        print("The response of ContentApi->submit_feedback_api_v1_content_feedback_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentApi->submit_feedback_api_v1_content_feedback_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **content** | **str**|  | 
 **images** | **str**|  | [optional] 
 **type** | **str**|  | [optional] 

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

# **update_feedback_api_v1_content_feedback_update_put**
> object update_feedback_api_v1_content_feedback_update_put(feedback_id, status=status, reply=reply)

更新/回复反馈

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
    api_instance = zhs_api.ContentApi(api_client)
    feedback_id = 56 # int | 
    status = 56 # int |  (optional)
    reply = 'reply_example' # str |  (optional)

    try:
        # 更新/回复反馈
        api_response = api_instance.update_feedback_api_v1_content_feedback_update_put(feedback_id, status=status, reply=reply)
        print("The response of ContentApi->update_feedback_api_v1_content_feedback_update_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentApi->update_feedback_api_v1_content_feedback_update_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **feedback_id** | **int**|  | 
 **status** | **int**|  | [optional] 
 **reply** | **str**|  | [optional] 

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

# **update_version_api_v1_content_version_update_put**
> object update_version_api_v1_content_version_update_put(version_id, version_code=version_code, version_name=version_name, download_url=download_url, description=description, platform=platform, force_update=force_update, status=status)

更新 App 版本

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
    api_instance = zhs_api.ContentApi(api_client)
    version_id = 56 # int | 
    version_code = 'version_code_example' # str |  (optional)
    version_name = 'version_name_example' # str |  (optional)
    download_url = 'download_url_example' # str |  (optional)
    description = 'description_example' # str |  (optional)
    platform = 'platform_example' # str |  (optional)
    force_update = 56 # int |  (optional)
    status = 56 # int |  (optional)

    try:
        # 更新 App 版本
        api_response = api_instance.update_version_api_v1_content_version_update_put(version_id, version_code=version_code, version_name=version_name, download_url=download_url, description=description, platform=platform, force_update=force_update, status=status)
        print("The response of ContentApi->update_version_api_v1_content_version_update_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentApi->update_version_api_v1_content_version_update_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **version_id** | **int**|  | 
 **version_code** | **str**|  | [optional] 
 **version_name** | **str**|  | [optional] 
 **download_url** | **str**|  | [optional] 
 **description** | **str**|  | [optional] 
 **platform** | **str**|  | [optional] 
 **force_update** | **int**|  | [optional] 
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

