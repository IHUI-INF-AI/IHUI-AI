# zhs_api.RankingApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**agent_ranking_api_v1_ranking_agent_get**](RankingApi.md#agent_ranking_api_v1_ranking_agent_get) | **GET** /api/v1/ranking/agent | Agent排行榜
[**agent_ranking_api_v1_ranking_agent_get_0**](RankingApi.md#agent_ranking_api_v1_ranking_agent_get_0) | **GET** /api/v1/ranking/agent | Agent排行榜
[**course_ranking_api_v1_ranking_course_get**](RankingApi.md#course_ranking_api_v1_ranking_course_get) | **GET** /api/v1/ranking/course | 课程排行榜
[**course_ranking_api_v1_ranking_course_get_0**](RankingApi.md#course_ranking_api_v1_ranking_course_get_0) | **GET** /api/v1/ranking/course | 课程排行榜
[**create_ranking_api_v1_ranking_post**](RankingApi.md#create_ranking_api_v1_ranking_post) | **POST** /api/v1/ranking | 创建榜单
[**create_ranking_api_v1_ranking_post_0**](RankingApi.md#create_ranking_api_v1_ranking_post_0) | **POST** /api/v1/ranking | 创建榜单
[**list_rankings_api_v1_ranking_list_get**](RankingApi.md#list_rankings_api_v1_ranking_list_get) | **GET** /api/v1/ranking/list | 排行榜列表
[**list_rankings_api_v1_ranking_list_get_0**](RankingApi.md#list_rankings_api_v1_ranking_list_get_0) | **GET** /api/v1/ranking/list | 排行榜列表
[**user_ranking_api_v1_ranking_user_get**](RankingApi.md#user_ranking_api_v1_ranking_user_get) | **GET** /api/v1/ranking/user | 用户积分排行榜
[**user_ranking_api_v1_ranking_user_get_0**](RankingApi.md#user_ranking_api_v1_ranking_user_get_0) | **GET** /api/v1/ranking/user | 用户积分排行榜


# **agent_ranking_api_v1_ranking_agent_get**
> object agent_ranking_api_v1_ranking_agent_get(period=period, limit=limit)

Agent排行榜

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
    api_instance = zhs_api.RankingApi(api_client)
    period = 'all' # str |  (optional) (default to 'all')
    limit = 50 # int |  (optional) (default to 50)

    try:
        # Agent排行榜
        api_response = api_instance.agent_ranking_api_v1_ranking_agent_get(period=period, limit=limit)
        print("The response of RankingApi->agent_ranking_api_v1_ranking_agent_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RankingApi->agent_ranking_api_v1_ranking_agent_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **period** | **str**|  | [optional] [default to &#39;all&#39;]
 **limit** | **int**|  | [optional] [default to 50]

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

# **agent_ranking_api_v1_ranking_agent_get_0**
> object agent_ranking_api_v1_ranking_agent_get_0(period=period, limit=limit)

Agent排行榜

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
    api_instance = zhs_api.RankingApi(api_client)
    period = 'all' # str |  (optional) (default to 'all')
    limit = 50 # int |  (optional) (default to 50)

    try:
        # Agent排行榜
        api_response = api_instance.agent_ranking_api_v1_ranking_agent_get_0(period=period, limit=limit)
        print("The response of RankingApi->agent_ranking_api_v1_ranking_agent_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RankingApi->agent_ranking_api_v1_ranking_agent_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **period** | **str**|  | [optional] [default to &#39;all&#39;]
 **limit** | **int**|  | [optional] [default to 50]

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

# **course_ranking_api_v1_ranking_course_get**
> object course_ranking_api_v1_ranking_course_get(limit=limit)

课程排行榜

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
    api_instance = zhs_api.RankingApi(api_client)
    limit = 50 # int |  (optional) (default to 50)

    try:
        # 课程排行榜
        api_response = api_instance.course_ranking_api_v1_ranking_course_get(limit=limit)
        print("The response of RankingApi->course_ranking_api_v1_ranking_course_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RankingApi->course_ranking_api_v1_ranking_course_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **int**|  | [optional] [default to 50]

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

# **course_ranking_api_v1_ranking_course_get_0**
> object course_ranking_api_v1_ranking_course_get_0(limit=limit)

课程排行榜

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
    api_instance = zhs_api.RankingApi(api_client)
    limit = 50 # int |  (optional) (default to 50)

    try:
        # 课程排行榜
        api_response = api_instance.course_ranking_api_v1_ranking_course_get_0(limit=limit)
        print("The response of RankingApi->course_ranking_api_v1_ranking_course_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RankingApi->course_ranking_api_v1_ranking_course_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **int**|  | [optional] [default to 50]

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

# **create_ranking_api_v1_ranking_post**
> object create_ranking_api_v1_ranking_post(name, code, type=type, period=period, description=description)

创建榜单

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
    api_instance = zhs_api.RankingApi(api_client)
    name = 'name_example' # str | 
    code = 'code_example' # str | 
    type = 'agent' # str |  (optional) (default to 'agent')
    period = 'day' # str |  (optional) (default to 'day')
    description = 'description_example' # str |  (optional)

    try:
        # 创建榜单
        api_response = api_instance.create_ranking_api_v1_ranking_post(name, code, type=type, period=period, description=description)
        print("The response of RankingApi->create_ranking_api_v1_ranking_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RankingApi->create_ranking_api_v1_ranking_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **str**|  | 
 **code** | **str**|  | 
 **type** | **str**|  | [optional] [default to &#39;agent&#39;]
 **period** | **str**|  | [optional] [default to &#39;day&#39;]
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

# **create_ranking_api_v1_ranking_post_0**
> object create_ranking_api_v1_ranking_post_0(name, code, type=type, period=period, description=description)

创建榜单

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
    api_instance = zhs_api.RankingApi(api_client)
    name = 'name_example' # str | 
    code = 'code_example' # str | 
    type = 'agent' # str |  (optional) (default to 'agent')
    period = 'day' # str |  (optional) (default to 'day')
    description = 'description_example' # str |  (optional)

    try:
        # 创建榜单
        api_response = api_instance.create_ranking_api_v1_ranking_post_0(name, code, type=type, period=period, description=description)
        print("The response of RankingApi->create_ranking_api_v1_ranking_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RankingApi->create_ranking_api_v1_ranking_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **str**|  | 
 **code** | **str**|  | 
 **type** | **str**|  | [optional] [default to &#39;agent&#39;]
 **period** | **str**|  | [optional] [default to &#39;day&#39;]
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

# **list_rankings_api_v1_ranking_list_get**
> object list_rankings_api_v1_ranking_list_get()

排行榜列表

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
    api_instance = zhs_api.RankingApi(api_client)

    try:
        # 排行榜列表
        api_response = api_instance.list_rankings_api_v1_ranking_list_get()
        print("The response of RankingApi->list_rankings_api_v1_ranking_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RankingApi->list_rankings_api_v1_ranking_list_get: %s\n" % e)
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

# **list_rankings_api_v1_ranking_list_get_0**
> object list_rankings_api_v1_ranking_list_get_0()

排行榜列表

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
    api_instance = zhs_api.RankingApi(api_client)

    try:
        # 排行榜列表
        api_response = api_instance.list_rankings_api_v1_ranking_list_get_0()
        print("The response of RankingApi->list_rankings_api_v1_ranking_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RankingApi->list_rankings_api_v1_ranking_list_get_0: %s\n" % e)
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

# **user_ranking_api_v1_ranking_user_get**
> object user_ranking_api_v1_ranking_user_get(period=period, limit=limit)

用户积分排行榜

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
    api_instance = zhs_api.RankingApi(api_client)
    period = 'all' # str |  (optional) (default to 'all')
    limit = 50 # int |  (optional) (default to 50)

    try:
        # 用户积分排行榜
        api_response = api_instance.user_ranking_api_v1_ranking_user_get(period=period, limit=limit)
        print("The response of RankingApi->user_ranking_api_v1_ranking_user_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RankingApi->user_ranking_api_v1_ranking_user_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **period** | **str**|  | [optional] [default to &#39;all&#39;]
 **limit** | **int**|  | [optional] [default to 50]

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

# **user_ranking_api_v1_ranking_user_get_0**
> object user_ranking_api_v1_ranking_user_get_0(period=period, limit=limit)

用户积分排行榜

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
    api_instance = zhs_api.RankingApi(api_client)
    period = 'all' # str |  (optional) (default to 'all')
    limit = 50 # int |  (optional) (default to 50)

    try:
        # 用户积分排行榜
        api_response = api_instance.user_ranking_api_v1_ranking_user_get_0(period=period, limit=limit)
        print("The response of RankingApi->user_ranking_api_v1_ranking_user_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling RankingApi->user_ranking_api_v1_ranking_user_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **period** | **str**|  | [optional] [default to &#39;all&#39;]
 **limit** | **int**|  | [optional] [default to 50]

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

