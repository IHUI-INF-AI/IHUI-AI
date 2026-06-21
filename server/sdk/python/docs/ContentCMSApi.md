# zhs_api.ContentCMSApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_banner_api_v1_content_cms_banner_create_post**](ContentCMSApi.md#create_banner_api_v1_content_cms_banner_create_post) | **POST** /api/v1/content/cms/banner/create | Create banner (admin only)
[**create_news_api_v1_content_cms_news_create_post**](ContentCMSApi.md#create_news_api_v1_content_cms_news_create_post) | **POST** /api/v1/content/cms/news/create | Create news (admin only)
[**create_notice_api_v1_content_cms_notice_create_post**](ContentCMSApi.md#create_notice_api_v1_content_cms_notice_create_post) | **POST** /api/v1/content/cms/notice/create | Create system notice (admin only)
[**delete_banner_api_v1_content_cms_banner_delete_post**](ContentCMSApi.md#delete_banner_api_v1_content_cms_banner_delete_post) | **POST** /api/v1/content/cms/banner/delete | Delete banner (admin only)
[**delete_news_api_v1_content_cms_news_delete_post**](ContentCMSApi.md#delete_news_api_v1_content_cms_news_delete_post) | **POST** /api/v1/content/cms/news/delete | Delete news (admin only)
[**delete_notice_api_v1_content_cms_notice_delete_post**](ContentCMSApi.md#delete_notice_api_v1_content_cms_notice_delete_post) | **POST** /api/v1/content/cms/notice/delete | Delete notice (admin only)
[**list_banners_api_v1_content_cms_banner_list_get**](ContentCMSApi.md#list_banners_api_v1_content_cms_banner_list_get) | **GET** /api/v1/content/cms/banner/list | Banner list (public)
[**list_news_api_v1_content_cms_news_list_get**](ContentCMSApi.md#list_news_api_v1_content_cms_news_list_get) | **GET** /api/v1/content/cms/news/list | News list (public)
[**list_notices_api_v1_content_cms_notice_list_get**](ContentCMSApi.md#list_notices_api_v1_content_cms_notice_list_get) | **GET** /api/v1/content/cms/notice/list | System notice list (public)
[**list_popular_api_v1_content_cms_popular_list_get**](ContentCMSApi.md#list_popular_api_v1_content_cms_popular_list_get) | **GET** /api/v1/content/cms/popular/list | Popular recommendations (public)
[**update_banner_api_v1_content_cms_banner_update_banner_id_put**](ContentCMSApi.md#update_banner_api_v1_content_cms_banner_update_banner_id_put) | **PUT** /api/v1/content/cms/banner/update/{banner_id} | Update banner (admin only)
[**update_news_api_v1_content_cms_news_update_news_id_put**](ContentCMSApi.md#update_news_api_v1_content_cms_news_update_news_id_put) | **PUT** /api/v1/content/cms/news/update/{news_id} | Update news (admin only)
[**update_notice_api_v1_content_cms_notice_update_notice_id_put**](ContentCMSApi.md#update_notice_api_v1_content_cms_notice_update_notice_id_put) | **PUT** /api/v1/content/cms/notice/update/{notice_id} | Update notice (admin only)


# **create_banner_api_v1_content_cms_banner_create_post**
> object create_banner_api_v1_content_cms_banner_create_post(title, image, url=url, sort=sort, authorization=authorization)

Create banner (admin only)

Create a new banner carousel item. Requires admin role.

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
    api_instance = zhs_api.ContentCMSApi(api_client)
    title = 'title_example' # str | Banner title
    image = 'image_example' # str | Banner image URL
    url = '' # str | Banner link URL (optional) (default to '')
    sort = 0 # int | Sort order (optional) (default to 0)
    authorization = 'authorization_example' # str |  (optional)

    try:
        # Create banner (admin only)
        api_response = api_instance.create_banner_api_v1_content_cms_banner_create_post(title, image, url=url, sort=sort, authorization=authorization)
        print("The response of ContentCMSApi->create_banner_api_v1_content_cms_banner_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentCMSApi->create_banner_api_v1_content_cms_banner_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**| Banner title | 
 **image** | **str**| Banner image URL | 
 **url** | **str**| Banner link URL | [optional] [default to &#39;&#39;]
 **sort** | **int**| Sort order | [optional] [default to 0]
 **authorization** | **str**|  | [optional] 

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

# **create_news_api_v1_content_cms_news_create_post**
> object create_news_api_v1_content_cms_news_create_post(title, content, image=image, authorization=authorization)

Create news (admin only)

Create a news article. Requires admin role.

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
    api_instance = zhs_api.ContentCMSApi(api_client)
    title = 'title_example' # str | News title
    content = 'content_example' # str | News content (HTML supported)
    image = '' # str | Cover image URL (optional) (default to '')
    authorization = 'authorization_example' # str |  (optional)

    try:
        # Create news (admin only)
        api_response = api_instance.create_news_api_v1_content_cms_news_create_post(title, content, image=image, authorization=authorization)
        print("The response of ContentCMSApi->create_news_api_v1_content_cms_news_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentCMSApi->create_news_api_v1_content_cms_news_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**| News title | 
 **content** | **str**| News content (HTML supported) | 
 **image** | **str**| Cover image URL | [optional] [default to &#39;&#39;]
 **authorization** | **str**|  | [optional] 

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

# **create_notice_api_v1_content_cms_notice_create_post**
> object create_notice_api_v1_content_cms_notice_create_post(notice_title, notice_type=notice_type, notice_content=notice_content, authorization=authorization)

Create system notice (admin only)

Create a system notice. Requires admin role.

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
    api_instance = zhs_api.ContentCMSApi(api_client)
    notice_title = 'notice_title_example' # str | Notice title
    notice_type = '1' # str | 1=notification, 2=announcement (optional) (default to '1')
    notice_content = '' # str | Notice content (optional) (default to '')
    authorization = 'authorization_example' # str |  (optional)

    try:
        # Create system notice (admin only)
        api_response = api_instance.create_notice_api_v1_content_cms_notice_create_post(notice_title, notice_type=notice_type, notice_content=notice_content, authorization=authorization)
        print("The response of ContentCMSApi->create_notice_api_v1_content_cms_notice_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentCMSApi->create_notice_api_v1_content_cms_notice_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **notice_title** | **str**| Notice title | 
 **notice_type** | **str**| 1&#x3D;notification, 2&#x3D;announcement | [optional] [default to &#39;1&#39;]
 **notice_content** | **str**| Notice content | [optional] [default to &#39;&#39;]
 **authorization** | **str**|  | [optional] 

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

# **delete_banner_api_v1_content_cms_banner_delete_post**
> object delete_banner_api_v1_content_cms_banner_delete_post(banner_id, authorization=authorization)

Delete banner (admin only)

Delete a banner. Requires admin role.

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
    api_instance = zhs_api.ContentCMSApi(api_client)
    banner_id = 56 # int | Banner ID to delete
    authorization = 'authorization_example' # str |  (optional)

    try:
        # Delete banner (admin only)
        api_response = api_instance.delete_banner_api_v1_content_cms_banner_delete_post(banner_id, authorization=authorization)
        print("The response of ContentCMSApi->delete_banner_api_v1_content_cms_banner_delete_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentCMSApi->delete_banner_api_v1_content_cms_banner_delete_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **banner_id** | **int**| Banner ID to delete | 
 **authorization** | **str**|  | [optional] 

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

# **delete_news_api_v1_content_cms_news_delete_post**
> object delete_news_api_v1_content_cms_news_delete_post(news_id, authorization=authorization)

Delete news (admin only)

Delete a news article. Requires admin role.

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
    api_instance = zhs_api.ContentCMSApi(api_client)
    news_id = 56 # int | News ID to delete
    authorization = 'authorization_example' # str |  (optional)

    try:
        # Delete news (admin only)
        api_response = api_instance.delete_news_api_v1_content_cms_news_delete_post(news_id, authorization=authorization)
        print("The response of ContentCMSApi->delete_news_api_v1_content_cms_news_delete_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentCMSApi->delete_news_api_v1_content_cms_news_delete_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **news_id** | **int**| News ID to delete | 
 **authorization** | **str**|  | [optional] 

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

# **delete_notice_api_v1_content_cms_notice_delete_post**
> object delete_notice_api_v1_content_cms_notice_delete_post(notice_id, authorization=authorization)

Delete notice (admin only)

Delete a system notice. Requires admin role.

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
    api_instance = zhs_api.ContentCMSApi(api_client)
    notice_id = 56 # int | Notice ID to delete
    authorization = 'authorization_example' # str |  (optional)

    try:
        # Delete notice (admin only)
        api_response = api_instance.delete_notice_api_v1_content_cms_notice_delete_post(notice_id, authorization=authorization)
        print("The response of ContentCMSApi->delete_notice_api_v1_content_cms_notice_delete_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentCMSApi->delete_notice_api_v1_content_cms_notice_delete_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **notice_id** | **int**| Notice ID to delete | 
 **authorization** | **str**|  | [optional] 

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

# **list_banners_api_v1_content_cms_banner_list_get**
> object list_banners_api_v1_content_cms_banner_list_get(page=page, limit=limit, status=status)

Banner list (public)

Get active banners for homepage carousel.

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
    api_instance = zhs_api.ContentCMSApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 10 # int |  (optional) (default to 10)
    status = 1 # int | 0=disabled, 1=enabled (optional) (default to 1)

    try:
        # Banner list (public)
        api_response = api_instance.list_banners_api_v1_content_cms_banner_list_get(page=page, limit=limit, status=status)
        print("The response of ContentCMSApi->list_banners_api_v1_content_cms_banner_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentCMSApi->list_banners_api_v1_content_cms_banner_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 10]
 **status** | **int**| 0&#x3D;disabled, 1&#x3D;enabled | [optional] [default to 1]

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

# **list_news_api_v1_content_cms_news_list_get**
> object list_news_api_v1_content_cms_news_list_get(page=page, limit=limit, user_uuid=user_uuid)

News list (public)

Get active news articles. Public endpoint.

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
    api_instance = zhs_api.ContentCMSApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    user_uuid = 'user_uuid_example' # str |  (optional)

    try:
        # News list (public)
        api_response = api_instance.list_news_api_v1_content_cms_news_list_get(page=page, limit=limit, user_uuid=user_uuid)
        print("The response of ContentCMSApi->list_news_api_v1_content_cms_news_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentCMSApi->list_news_api_v1_content_cms_news_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **user_uuid** | **str**|  | [optional] 

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

# **list_notices_api_v1_content_cms_notice_list_get**
> object list_notices_api_v1_content_cms_notice_list_get(page=page, limit=limit, user_uuid=user_uuid)

System notice list (public)

Get active system notices. Public endpoint.

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
    api_instance = zhs_api.ContentCMSApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    user_uuid = 'user_uuid_example' # str |  (optional)

    try:
        # System notice list (public)
        api_response = api_instance.list_notices_api_v1_content_cms_notice_list_get(page=page, limit=limit, user_uuid=user_uuid)
        print("The response of ContentCMSApi->list_notices_api_v1_content_cms_notice_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentCMSApi->list_notices_api_v1_content_cms_notice_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **user_uuid** | **str**|  | [optional] 

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

# **list_popular_api_v1_content_cms_popular_list_get**
> object list_popular_api_v1_content_cms_popular_list_get(page=page, limit=limit)

Popular recommendations (public)

Get popular recommended content based on sort order.

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
    api_instance = zhs_api.ContentCMSApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # Popular recommendations (public)
        api_response = api_instance.list_popular_api_v1_content_cms_popular_list_get(page=page, limit=limit)
        print("The response of ContentCMSApi->list_popular_api_v1_content_cms_popular_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentCMSApi->list_popular_api_v1_content_cms_popular_list_get: %s\n" % e)
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

# **update_banner_api_v1_content_cms_banner_update_banner_id_put**
> object update_banner_api_v1_content_cms_banner_update_banner_id_put(banner_id, title=title, image=image, url=url, sort=sort, is_active=is_active, authorization=authorization)

Update banner (admin only)

Update an existing banner. Requires admin role.

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
    api_instance = zhs_api.ContentCMSApi(api_client)
    banner_id = 56 # int | 
    title = 'title_example' # str |  (optional)
    image = 'image_example' # str |  (optional)
    url = 'url_example' # str |  (optional)
    sort = 56 # int |  (optional)
    is_active = 56 # int |  (optional)
    authorization = 'authorization_example' # str |  (optional)

    try:
        # Update banner (admin only)
        api_response = api_instance.update_banner_api_v1_content_cms_banner_update_banner_id_put(banner_id, title=title, image=image, url=url, sort=sort, is_active=is_active, authorization=authorization)
        print("The response of ContentCMSApi->update_banner_api_v1_content_cms_banner_update_banner_id_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentCMSApi->update_banner_api_v1_content_cms_banner_update_banner_id_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **banner_id** | **int**|  | 
 **title** | **str**|  | [optional] 
 **image** | **str**|  | [optional] 
 **url** | **str**|  | [optional] 
 **sort** | **int**|  | [optional] 
 **is_active** | **int**|  | [optional] 
 **authorization** | **str**|  | [optional] 

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

# **update_news_api_v1_content_cms_news_update_news_id_put**
> object update_news_api_v1_content_cms_news_update_news_id_put(news_id, title=title, content=content, image=image, is_active=is_active, authorization=authorization)

Update news (admin only)

Update a news article. Requires admin role.

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
    api_instance = zhs_api.ContentCMSApi(api_client)
    news_id = 56 # int | 
    title = 'title_example' # str |  (optional)
    content = 'content_example' # str |  (optional)
    image = 'image_example' # str |  (optional)
    is_active = 56 # int |  (optional)
    authorization = 'authorization_example' # str |  (optional)

    try:
        # Update news (admin only)
        api_response = api_instance.update_news_api_v1_content_cms_news_update_news_id_put(news_id, title=title, content=content, image=image, is_active=is_active, authorization=authorization)
        print("The response of ContentCMSApi->update_news_api_v1_content_cms_news_update_news_id_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentCMSApi->update_news_api_v1_content_cms_news_update_news_id_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **news_id** | **int**|  | 
 **title** | **str**|  | [optional] 
 **content** | **str**|  | [optional] 
 **image** | **str**|  | [optional] 
 **is_active** | **int**|  | [optional] 
 **authorization** | **str**|  | [optional] 

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

# **update_notice_api_v1_content_cms_notice_update_notice_id_put**
> object update_notice_api_v1_content_cms_notice_update_notice_id_put(notice_id, notice_title=notice_title, notice_type=notice_type, notice_content=notice_content, status=status, authorization=authorization)

Update notice (admin only)

Update a system notice. Requires admin role.

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
    api_instance = zhs_api.ContentCMSApi(api_client)
    notice_id = 56 # int | 
    notice_title = 'notice_title_example' # str |  (optional)
    notice_type = 'notice_type_example' # str |  (optional)
    notice_content = 'notice_content_example' # str |  (optional)
    status = 'status_example' # str |  (optional)
    authorization = 'authorization_example' # str |  (optional)

    try:
        # Update notice (admin only)
        api_response = api_instance.update_notice_api_v1_content_cms_notice_update_notice_id_put(notice_id, notice_title=notice_title, notice_type=notice_type, notice_content=notice_content, status=status, authorization=authorization)
        print("The response of ContentCMSApi->update_notice_api_v1_content_cms_notice_update_notice_id_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ContentCMSApi->update_notice_api_v1_content_cms_notice_update_notice_id_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **notice_id** | **int**|  | 
 **notice_title** | **str**|  | [optional] 
 **notice_type** | **str**|  | [optional] 
 **notice_content** | **str**|  | [optional] 
 **status** | **str**|  | [optional] 
 **authorization** | **str**|  | [optional] 

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

