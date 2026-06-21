# zhs_api.SearchApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**add_hot_keyword_api_v1_search_hot_keyword_post**](SearchApi.md#add_hot_keyword_api_v1_search_hot_keyword_post) | **POST** /api/v1/search/hot/keyword | 添加热搜词
[**add_hot_keyword_api_v1_search_hot_keyword_post_0**](SearchApi.md#add_hot_keyword_api_v1_search_hot_keyword_post_0) | **POST** /api/v1/search/hot/keyword | 添加热搜词
[**add_index_api_v1_search_index_post**](SearchApi.md#add_index_api_v1_search_index_post) | **POST** /api/v1/search/index | 添加/更新索引
[**add_index_api_v1_search_index_post_0**](SearchApi.md#add_index_api_v1_search_index_post_0) | **POST** /api/v1/search/index | 添加/更新索引
[**delete_by_target_api_v1_search_index_by_target_delete**](SearchApi.md#delete_by_target_api_v1_search_index_by_target_delete) | **DELETE** /api/v1/search/index/by-target | 按目标删除索引
[**delete_by_target_api_v1_search_index_by_target_delete_0**](SearchApi.md#delete_by_target_api_v1_search_index_by_target_delete_0) | **DELETE** /api/v1/search/index/by-target | 按目标删除索引
[**delete_hot_keyword_api_v1_search_hot_keyword_kid_delete**](SearchApi.md#delete_hot_keyword_api_v1_search_hot_keyword_kid_delete) | **DELETE** /api/v1/search/hot/keyword/{kid} | 删除热搜词
[**delete_hot_keyword_api_v1_search_hot_keyword_kid_delete_0**](SearchApi.md#delete_hot_keyword_api_v1_search_hot_keyword_kid_delete_0) | **DELETE** /api/v1/search/hot/keyword/{kid} | 删除热搜词
[**delete_index_api_v1_search_index_idx_id_delete**](SearchApi.md#delete_index_api_v1_search_index_idx_id_delete) | **DELETE** /api/v1/search/index/{idx_id} | 删除索引
[**delete_index_api_v1_search_index_idx_id_delete_0**](SearchApi.md#delete_index_api_v1_search_index_idx_id_delete_0) | **DELETE** /api/v1/search/index/{idx_id} | 删除索引
[**hot_keywords_api_v1_search_hot_get**](SearchApi.md#hot_keywords_api_v1_search_hot_get) | **GET** /api/v1/search/hot | 热搜词
[**hot_keywords_api_v1_search_hot_get_0**](SearchApi.md#hot_keywords_api_v1_search_hot_get_0) | **GET** /api/v1/search/hot | 热搜词
[**query_api_v1_search_query_get**](SearchApi.md#query_api_v1_search_query_get) | **GET** /api/v1/search/query | 全文搜索
[**query_api_v1_search_query_get_0**](SearchApi.md#query_api_v1_search_query_get_0) | **GET** /api/v1/search/query | 全文搜索
[**search_log_list**](SearchApi.md#search_log_list) | **GET** /api/v1/search/log/list | 搜索日志
[**search_log_list_0**](SearchApi.md#search_log_list_0) | **GET** /api/v1/search/log/list | 搜索日志
[**suggest_api_v1_search_suggest_get**](SearchApi.md#suggest_api_v1_search_suggest_get) | **GET** /api/v1/search/suggest | 搜索建议
[**suggest_api_v1_search_suggest_get_0**](SearchApi.md#suggest_api_v1_search_suggest_get_0) | **GET** /api/v1/search/suggest | 搜索建议


# **add_hot_keyword_api_v1_search_hot_keyword_post**
> object add_hot_keyword_api_v1_search_hot_keyword_post(keyword, is_hot=is_hot, sort_order=sort_order)

添加热搜词

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
    api_instance = zhs_api.SearchApi(api_client)
    keyword = 'keyword_example' # str | 
    is_hot = False # bool |  (optional) (default to False)
    sort_order = 0 # int |  (optional) (default to 0)

    try:
        # 添加热搜词
        api_response = api_instance.add_hot_keyword_api_v1_search_hot_keyword_post(keyword, is_hot=is_hot, sort_order=sort_order)
        print("The response of SearchApi->add_hot_keyword_api_v1_search_hot_keyword_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->add_hot_keyword_api_v1_search_hot_keyword_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **keyword** | **str**|  | 
 **is_hot** | **bool**|  | [optional] [default to False]
 **sort_order** | **int**|  | [optional] [default to 0]

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

# **add_hot_keyword_api_v1_search_hot_keyword_post_0**
> object add_hot_keyword_api_v1_search_hot_keyword_post_0(keyword, is_hot=is_hot, sort_order=sort_order)

添加热搜词

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
    api_instance = zhs_api.SearchApi(api_client)
    keyword = 'keyword_example' # str | 
    is_hot = False # bool |  (optional) (default to False)
    sort_order = 0 # int |  (optional) (default to 0)

    try:
        # 添加热搜词
        api_response = api_instance.add_hot_keyword_api_v1_search_hot_keyword_post_0(keyword, is_hot=is_hot, sort_order=sort_order)
        print("The response of SearchApi->add_hot_keyword_api_v1_search_hot_keyword_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->add_hot_keyword_api_v1_search_hot_keyword_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **keyword** | **str**|  | 
 **is_hot** | **bool**|  | [optional] [default to False]
 **sort_order** | **int**|  | [optional] [default to 0]

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

# **add_index_api_v1_search_index_post**
> object add_index_api_v1_search_index_post(target_type, target_id, title, content=content, keywords=keywords, category=category, tags=tags, cover=cover, url=url, user_id=user_id, user_name=user_name, weight=weight)

添加/更新索引

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
    api_instance = zhs_api.SearchApi(api_client)
    target_type = 'target_type_example' # str | 
    target_id = 56 # int | 
    title = 'title_example' # str | 
    content = 'content_example' # str |  (optional)
    keywords = 'keywords_example' # str |  (optional)
    category = 'category_example' # str |  (optional)
    tags = 'tags_example' # str |  (optional)
    cover = 'cover_example' # str |  (optional)
    url = 'url_example' # str |  (optional)
    user_id = 'user_id_example' # str |  (optional)
    user_name = 'user_name_example' # str |  (optional)
    weight = 0 # int |  (optional) (default to 0)

    try:
        # 添加/更新索引
        api_response = api_instance.add_index_api_v1_search_index_post(target_type, target_id, title, content=content, keywords=keywords, category=category, tags=tags, cover=cover, url=url, user_id=user_id, user_name=user_name, weight=weight)
        print("The response of SearchApi->add_index_api_v1_search_index_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->add_index_api_v1_search_index_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **target_type** | **str**|  | 
 **target_id** | **int**|  | 
 **title** | **str**|  | 
 **content** | **str**|  | [optional] 
 **keywords** | **str**|  | [optional] 
 **category** | **str**|  | [optional] 
 **tags** | **str**|  | [optional] 
 **cover** | **str**|  | [optional] 
 **url** | **str**|  | [optional] 
 **user_id** | **str**|  | [optional] 
 **user_name** | **str**|  | [optional] 
 **weight** | **int**|  | [optional] [default to 0]

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

# **add_index_api_v1_search_index_post_0**
> object add_index_api_v1_search_index_post_0(target_type, target_id, title, content=content, keywords=keywords, category=category, tags=tags, cover=cover, url=url, user_id=user_id, user_name=user_name, weight=weight)

添加/更新索引

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
    api_instance = zhs_api.SearchApi(api_client)
    target_type = 'target_type_example' # str | 
    target_id = 56 # int | 
    title = 'title_example' # str | 
    content = 'content_example' # str |  (optional)
    keywords = 'keywords_example' # str |  (optional)
    category = 'category_example' # str |  (optional)
    tags = 'tags_example' # str |  (optional)
    cover = 'cover_example' # str |  (optional)
    url = 'url_example' # str |  (optional)
    user_id = 'user_id_example' # str |  (optional)
    user_name = 'user_name_example' # str |  (optional)
    weight = 0 # int |  (optional) (default to 0)

    try:
        # 添加/更新索引
        api_response = api_instance.add_index_api_v1_search_index_post_0(target_type, target_id, title, content=content, keywords=keywords, category=category, tags=tags, cover=cover, url=url, user_id=user_id, user_name=user_name, weight=weight)
        print("The response of SearchApi->add_index_api_v1_search_index_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->add_index_api_v1_search_index_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **target_type** | **str**|  | 
 **target_id** | **int**|  | 
 **title** | **str**|  | 
 **content** | **str**|  | [optional] 
 **keywords** | **str**|  | [optional] 
 **category** | **str**|  | [optional] 
 **tags** | **str**|  | [optional] 
 **cover** | **str**|  | [optional] 
 **url** | **str**|  | [optional] 
 **user_id** | **str**|  | [optional] 
 **user_name** | **str**|  | [optional] 
 **weight** | **int**|  | [optional] [default to 0]

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

# **delete_by_target_api_v1_search_index_by_target_delete**
> object delete_by_target_api_v1_search_index_by_target_delete(target_type, target_id)

按目标删除索引

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
    api_instance = zhs_api.SearchApi(api_client)
    target_type = 'target_type_example' # str | 
    target_id = 56 # int | 

    try:
        # 按目标删除索引
        api_response = api_instance.delete_by_target_api_v1_search_index_by_target_delete(target_type, target_id)
        print("The response of SearchApi->delete_by_target_api_v1_search_index_by_target_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->delete_by_target_api_v1_search_index_by_target_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **target_type** | **str**|  | 
 **target_id** | **int**|  | 

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

# **delete_by_target_api_v1_search_index_by_target_delete_0**
> object delete_by_target_api_v1_search_index_by_target_delete_0(target_type, target_id)

按目标删除索引

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
    api_instance = zhs_api.SearchApi(api_client)
    target_type = 'target_type_example' # str | 
    target_id = 56 # int | 

    try:
        # 按目标删除索引
        api_response = api_instance.delete_by_target_api_v1_search_index_by_target_delete_0(target_type, target_id)
        print("The response of SearchApi->delete_by_target_api_v1_search_index_by_target_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->delete_by_target_api_v1_search_index_by_target_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **target_type** | **str**|  | 
 **target_id** | **int**|  | 

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

# **delete_hot_keyword_api_v1_search_hot_keyword_kid_delete**
> object delete_hot_keyword_api_v1_search_hot_keyword_kid_delete(kid)

删除热搜词

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
    api_instance = zhs_api.SearchApi(api_client)
    kid = 56 # int | 

    try:
        # 删除热搜词
        api_response = api_instance.delete_hot_keyword_api_v1_search_hot_keyword_kid_delete(kid)
        print("The response of SearchApi->delete_hot_keyword_api_v1_search_hot_keyword_kid_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->delete_hot_keyword_api_v1_search_hot_keyword_kid_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **kid** | **int**|  | 

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

# **delete_hot_keyword_api_v1_search_hot_keyword_kid_delete_0**
> object delete_hot_keyword_api_v1_search_hot_keyword_kid_delete_0(kid)

删除热搜词

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
    api_instance = zhs_api.SearchApi(api_client)
    kid = 56 # int | 

    try:
        # 删除热搜词
        api_response = api_instance.delete_hot_keyword_api_v1_search_hot_keyword_kid_delete_0(kid)
        print("The response of SearchApi->delete_hot_keyword_api_v1_search_hot_keyword_kid_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->delete_hot_keyword_api_v1_search_hot_keyword_kid_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **kid** | **int**|  | 

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

# **delete_index_api_v1_search_index_idx_id_delete**
> object delete_index_api_v1_search_index_idx_id_delete(idx_id)

删除索引

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
    api_instance = zhs_api.SearchApi(api_client)
    idx_id = 56 # int | 

    try:
        # 删除索引
        api_response = api_instance.delete_index_api_v1_search_index_idx_id_delete(idx_id)
        print("The response of SearchApi->delete_index_api_v1_search_index_idx_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->delete_index_api_v1_search_index_idx_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **idx_id** | **int**|  | 

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

# **delete_index_api_v1_search_index_idx_id_delete_0**
> object delete_index_api_v1_search_index_idx_id_delete_0(idx_id)

删除索引

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
    api_instance = zhs_api.SearchApi(api_client)
    idx_id = 56 # int | 

    try:
        # 删除索引
        api_response = api_instance.delete_index_api_v1_search_index_idx_id_delete_0(idx_id)
        print("The response of SearchApi->delete_index_api_v1_search_index_idx_id_delete_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->delete_index_api_v1_search_index_idx_id_delete_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **idx_id** | **int**|  | 

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

# **hot_keywords_api_v1_search_hot_get**
> object hot_keywords_api_v1_search_hot_get(limit=limit)

热搜词

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
    api_instance = zhs_api.SearchApi(api_client)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 热搜词
        api_response = api_instance.hot_keywords_api_v1_search_hot_get(limit=limit)
        print("The response of SearchApi->hot_keywords_api_v1_search_hot_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->hot_keywords_api_v1_search_hot_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
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

# **hot_keywords_api_v1_search_hot_get_0**
> object hot_keywords_api_v1_search_hot_get_0(limit=limit)

热搜词

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
    api_instance = zhs_api.SearchApi(api_client)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # 热搜词
        api_response = api_instance.hot_keywords_api_v1_search_hot_get_0(limit=limit)
        print("The response of SearchApi->hot_keywords_api_v1_search_hot_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->hot_keywords_api_v1_search_hot_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
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

# **query_api_v1_search_query_get**
> object query_api_v1_search_query_get(keyword, page=page, limit=limit, target_type=target_type, category=category, order_by=order_by)

全文搜索

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
    api_instance = zhs_api.SearchApi(api_client)
    keyword = 'keyword_example' # str | 
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    target_type = 'target_type_example' # str |  (optional)
    category = 'category_example' # str |  (optional)
    order_by = 'order_by_example' # str |  (optional)

    try:
        # 全文搜索
        api_response = api_instance.query_api_v1_search_query_get(keyword, page=page, limit=limit, target_type=target_type, category=category, order_by=order_by)
        print("The response of SearchApi->query_api_v1_search_query_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->query_api_v1_search_query_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **keyword** | **str**|  | 
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **target_type** | **str**|  | [optional] 
 **category** | **str**|  | [optional] 
 **order_by** | **str**|  | [optional] 

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

# **query_api_v1_search_query_get_0**
> object query_api_v1_search_query_get_0(keyword, page=page, limit=limit, target_type=target_type, category=category, order_by=order_by)

全文搜索

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
    api_instance = zhs_api.SearchApi(api_client)
    keyword = 'keyword_example' # str | 
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    target_type = 'target_type_example' # str |  (optional)
    category = 'category_example' # str |  (optional)
    order_by = 'order_by_example' # str |  (optional)

    try:
        # 全文搜索
        api_response = api_instance.query_api_v1_search_query_get_0(keyword, page=page, limit=limit, target_type=target_type, category=category, order_by=order_by)
        print("The response of SearchApi->query_api_v1_search_query_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->query_api_v1_search_query_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **keyword** | **str**|  | 
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **target_type** | **str**|  | [optional] 
 **category** | **str**|  | [optional] 
 **order_by** | **str**|  | [optional] 

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

# **search_log_list**
> object search_log_list(page=page, limit=limit, user_id=user_id, keyword=keyword)

搜索日志

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
    api_instance = zhs_api.SearchApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    user_id = 'user_id_example' # str |  (optional)
    keyword = 'keyword_example' # str |  (optional)

    try:
        # 搜索日志
        api_response = api_instance.search_log_list(page=page, limit=limit, user_id=user_id, keyword=keyword)
        print("The response of SearchApi->search_log_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->search_log_list: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **user_id** | **str**|  | [optional] 
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

# **search_log_list_0**
> object search_log_list_0(page=page, limit=limit, user_id=user_id, keyword=keyword)

搜索日志

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
    api_instance = zhs_api.SearchApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    user_id = 'user_id_example' # str |  (optional)
    keyword = 'keyword_example' # str |  (optional)

    try:
        # 搜索日志
        api_response = api_instance.search_log_list_0(page=page, limit=limit, user_id=user_id, keyword=keyword)
        print("The response of SearchApi->search_log_list_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->search_log_list_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **user_id** | **str**|  | [optional] 
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

# **suggest_api_v1_search_suggest_get**
> object suggest_api_v1_search_suggest_get(keyword, limit=limit)

搜索建议

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
    api_instance = zhs_api.SearchApi(api_client)
    keyword = 'keyword_example' # str | 
    limit = 10 # int |  (optional) (default to 10)

    try:
        # 搜索建议
        api_response = api_instance.suggest_api_v1_search_suggest_get(keyword, limit=limit)
        print("The response of SearchApi->suggest_api_v1_search_suggest_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->suggest_api_v1_search_suggest_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **keyword** | **str**|  | 
 **limit** | **int**|  | [optional] [default to 10]

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

# **suggest_api_v1_search_suggest_get_0**
> object suggest_api_v1_search_suggest_get_0(keyword, limit=limit)

搜索建议

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
    api_instance = zhs_api.SearchApi(api_client)
    keyword = 'keyword_example' # str | 
    limit = 10 # int |  (optional) (default to 10)

    try:
        # 搜索建议
        api_response = api_instance.suggest_api_v1_search_suggest_get_0(keyword, limit=limit)
        print("The response of SearchApi->suggest_api_v1_search_suggest_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->suggest_api_v1_search_suggest_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **keyword** | **str**|  | 
 **limit** | **int**|  | [optional] [default to 10]

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

