# zhs_api.LuyalaProxyApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**luyala_chat**](LuyalaProxyApi.md#luyala_chat) | **POST** /api/v1/luyala-proxy/chat | 露雅拉对话
[**luyala_chat_0**](LuyalaProxyApi.md#luyala_chat_0) | **POST** /api/v1/luyala-proxy/chat | 露雅拉对话
[**luyala_completion**](LuyalaProxyApi.md#luyala_completion) | **POST** /api/v1/luyala-proxy/completion | 露雅拉文本补全
[**luyala_completion_0**](LuyalaProxyApi.md#luyala_completion_0) | **POST** /api/v1/luyala-proxy/completion | 露雅拉文本补全
[**luyala_embeddings**](LuyalaProxyApi.md#luyala_embeddings) | **POST** /api/v1/luyala-proxy/embeddings | 露雅拉Embedding
[**luyala_embeddings_0**](LuyalaProxyApi.md#luyala_embeddings_0) | **POST** /api/v1/luyala-proxy/embeddings | 露雅拉Embedding
[**luyala_models**](LuyalaProxyApi.md#luyala_models) | **GET** /api/v1/luyala-proxy/models | 可用模型列表
[**luyala_models_0**](LuyalaProxyApi.md#luyala_models_0) | **GET** /api/v1/luyala-proxy/models | 可用模型列表


# **luyala_chat**
> object luyala_chat(body_luyala_chat, api_key=api_key)

露雅拉对话

### Example


```python
import zhs_api
from zhs_api.models.body_luyala_chat import BodyLuyalaChat
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
    api_instance = zhs_api.LuyalaProxyApi(api_client)
    body_luyala_chat = zhs_api.BodyLuyalaChat() # BodyLuyalaChat | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 露雅拉对话
        api_response = api_instance.luyala_chat(body_luyala_chat, api_key=api_key)
        print("The response of LuyalaProxyApi->luyala_chat:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LuyalaProxyApi->luyala_chat: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_luyala_chat** | [**BodyLuyalaChat**](BodyLuyalaChat.md)|  | 
 **api_key** | **str**|  | [optional] 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **luyala_chat_0**
> object luyala_chat_0(body_luyala_chat, api_key=api_key)

露雅拉对话

### Example


```python
import zhs_api
from zhs_api.models.body_luyala_chat import BodyLuyalaChat
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
    api_instance = zhs_api.LuyalaProxyApi(api_client)
    body_luyala_chat = zhs_api.BodyLuyalaChat() # BodyLuyalaChat | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 露雅拉对话
        api_response = api_instance.luyala_chat_0(body_luyala_chat, api_key=api_key)
        print("The response of LuyalaProxyApi->luyala_chat_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LuyalaProxyApi->luyala_chat_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_luyala_chat** | [**BodyLuyalaChat**](BodyLuyalaChat.md)|  | 
 **api_key** | **str**|  | [optional] 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **luyala_completion**
> object luyala_completion(body_luyala_completion, api_key=api_key)

露雅拉文本补全

### Example


```python
import zhs_api
from zhs_api.models.body_luyala_completion import BodyLuyalaCompletion
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
    api_instance = zhs_api.LuyalaProxyApi(api_client)
    body_luyala_completion = zhs_api.BodyLuyalaCompletion() # BodyLuyalaCompletion | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 露雅拉文本补全
        api_response = api_instance.luyala_completion(body_luyala_completion, api_key=api_key)
        print("The response of LuyalaProxyApi->luyala_completion:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LuyalaProxyApi->luyala_completion: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_luyala_completion** | [**BodyLuyalaCompletion**](BodyLuyalaCompletion.md)|  | 
 **api_key** | **str**|  | [optional] 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **luyala_completion_0**
> object luyala_completion_0(body_luyala_completion, api_key=api_key)

露雅拉文本补全

### Example


```python
import zhs_api
from zhs_api.models.body_luyala_completion import BodyLuyalaCompletion
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
    api_instance = zhs_api.LuyalaProxyApi(api_client)
    body_luyala_completion = zhs_api.BodyLuyalaCompletion() # BodyLuyalaCompletion | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 露雅拉文本补全
        api_response = api_instance.luyala_completion_0(body_luyala_completion, api_key=api_key)
        print("The response of LuyalaProxyApi->luyala_completion_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LuyalaProxyApi->luyala_completion_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_luyala_completion** | [**BodyLuyalaCompletion**](BodyLuyalaCompletion.md)|  | 
 **api_key** | **str**|  | [optional] 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **luyala_embeddings**
> object luyala_embeddings(body_luyala_embeddings, api_key=api_key)

露雅拉Embedding

### Example


```python
import zhs_api
from zhs_api.models.body_luyala_embeddings import BodyLuyalaEmbeddings
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
    api_instance = zhs_api.LuyalaProxyApi(api_client)
    body_luyala_embeddings = zhs_api.BodyLuyalaEmbeddings() # BodyLuyalaEmbeddings | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 露雅拉Embedding
        api_response = api_instance.luyala_embeddings(body_luyala_embeddings, api_key=api_key)
        print("The response of LuyalaProxyApi->luyala_embeddings:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LuyalaProxyApi->luyala_embeddings: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_luyala_embeddings** | [**BodyLuyalaEmbeddings**](BodyLuyalaEmbeddings.md)|  | 
 **api_key** | **str**|  | [optional] 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **luyala_embeddings_0**
> object luyala_embeddings_0(body_luyala_embeddings, api_key=api_key)

露雅拉Embedding

### Example


```python
import zhs_api
from zhs_api.models.body_luyala_embeddings import BodyLuyalaEmbeddings
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
    api_instance = zhs_api.LuyalaProxyApi(api_client)
    body_luyala_embeddings = zhs_api.BodyLuyalaEmbeddings() # BodyLuyalaEmbeddings | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 露雅拉Embedding
        api_response = api_instance.luyala_embeddings_0(body_luyala_embeddings, api_key=api_key)
        print("The response of LuyalaProxyApi->luyala_embeddings_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LuyalaProxyApi->luyala_embeddings_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_luyala_embeddings** | [**BodyLuyalaEmbeddings**](BodyLuyalaEmbeddings.md)|  | 
 **api_key** | **str**|  | [optional] 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **luyala_models**
> object luyala_models()

可用模型列表

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
    api_instance = zhs_api.LuyalaProxyApi(api_client)

    try:
        # 可用模型列表
        api_response = api_instance.luyala_models()
        print("The response of LuyalaProxyApi->luyala_models:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LuyalaProxyApi->luyala_models: %s\n" % e)
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

# **luyala_models_0**
> object luyala_models_0()

可用模型列表

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
    api_instance = zhs_api.LuyalaProxyApi(api_client)

    try:
        # 可用模型列表
        api_response = api_instance.luyala_models_0()
        print("The response of LuyalaProxyApi->luyala_models_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LuyalaProxyApi->luyala_models_0: %s\n" % e)
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

