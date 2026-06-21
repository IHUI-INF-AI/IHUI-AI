# zhs_api.TestApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**docs_page_api_v1_test_docs_page_get**](TestApi.md#docs_page_api_v1_test_docs_page_get) | **GET** /api/v1/test/docs-page | API文档页面
[**docs_page_api_v1_test_docs_page_get_0**](TestApi.md#docs_page_api_v1_test_docs_page_get_0) | **GET** /api/v1/test/docs-page | API文档页面
[**health_api_v1_test_health_get**](TestApi.md#health_api_v1_test_health_get) | **GET** /api/v1/test/health | 健康检查
[**health_api_v1_test_health_get_0**](TestApi.md#health_api_v1_test_health_get_0) | **GET** /api/v1/test/health | 健康检查
[**index_api_v1_test_get**](TestApi.md#index_api_v1_test_get) | **GET** /api/v1/test | 测试页面首页
[**index_api_v1_test_get_0**](TestApi.md#index_api_v1_test_get_0) | **GET** /api/v1/test | 测试页面首页


# **docs_page_api_v1_test_docs_page_get**
> str docs_page_api_v1_test_docs_page_get()

API文档页面

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
    api_instance = zhs_api.TestApi(api_client)

    try:
        # API文档页面
        api_response = api_instance.docs_page_api_v1_test_docs_page_get()
        print("The response of TestApi->docs_page_api_v1_test_docs_page_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TestApi->docs_page_api_v1_test_docs_page_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**str**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: text/html

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **docs_page_api_v1_test_docs_page_get_0**
> str docs_page_api_v1_test_docs_page_get_0()

API文档页面

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
    api_instance = zhs_api.TestApi(api_client)

    try:
        # API文档页面
        api_response = api_instance.docs_page_api_v1_test_docs_page_get_0()
        print("The response of TestApi->docs_page_api_v1_test_docs_page_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TestApi->docs_page_api_v1_test_docs_page_get_0: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**str**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: text/html

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **health_api_v1_test_health_get**
> object health_api_v1_test_health_get()

健康检查

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
    api_instance = zhs_api.TestApi(api_client)

    try:
        # 健康检查
        api_response = api_instance.health_api_v1_test_health_get()
        print("The response of TestApi->health_api_v1_test_health_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TestApi->health_api_v1_test_health_get: %s\n" % e)
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

# **health_api_v1_test_health_get_0**
> object health_api_v1_test_health_get_0()

健康检查

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
    api_instance = zhs_api.TestApi(api_client)

    try:
        # 健康检查
        api_response = api_instance.health_api_v1_test_health_get_0()
        print("The response of TestApi->health_api_v1_test_health_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TestApi->health_api_v1_test_health_get_0: %s\n" % e)
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

# **index_api_v1_test_get**
> str index_api_v1_test_get()

测试页面首页

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
    api_instance = zhs_api.TestApi(api_client)

    try:
        # 测试页面首页
        api_response = api_instance.index_api_v1_test_get()
        print("The response of TestApi->index_api_v1_test_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TestApi->index_api_v1_test_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**str**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: text/html

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **index_api_v1_test_get_0**
> str index_api_v1_test_get_0()

测试页面首页

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
    api_instance = zhs_api.TestApi(api_client)

    try:
        # 测试页面首页
        api_response = api_instance.index_api_v1_test_get_0()
        print("The response of TestApi->index_api_v1_test_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TestApi->index_api_v1_test_get_0: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**str**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: text/html

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

