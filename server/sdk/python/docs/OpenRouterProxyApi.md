# zhs_api.OpenRouterProxyApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**credits_api_v1_openrouter_proxy_credits_get**](OpenRouterProxyApi.md#credits_api_v1_openrouter_proxy_credits_get) | **GET** /api/v1/openrouter-proxy/credits | 账户额度
[**credits_api_v1_openrouter_proxy_credits_get_0**](OpenRouterProxyApi.md#credits_api_v1_openrouter_proxy_credits_get_0) | **GET** /api/v1/openrouter-proxy/credits | 账户额度
[**openrouter_chat**](OpenRouterProxyApi.md#openrouter_chat) | **POST** /api/v1/openrouter-proxy/chat | OpenRouter对话
[**openrouter_chat_0**](OpenRouterProxyApi.md#openrouter_chat_0) | **POST** /api/v1/openrouter-proxy/chat | OpenRouter对话
[**openrouter_completion**](OpenRouterProxyApi.md#openrouter_completion) | **POST** /api/v1/openrouter-proxy/completion | OpenRouter文本补全
[**openrouter_completion_0**](OpenRouterProxyApi.md#openrouter_completion_0) | **POST** /api/v1/openrouter-proxy/completion | OpenRouter文本补全
[**openrouter_embeddings**](OpenRouterProxyApi.md#openrouter_embeddings) | **POST** /api/v1/openrouter-proxy/embeddings | OpenRouter Embeddings
[**openrouter_embeddings_0**](OpenRouterProxyApi.md#openrouter_embeddings_0) | **POST** /api/v1/openrouter-proxy/embeddings | OpenRouter Embeddings
[**openrouter_models**](OpenRouterProxyApi.md#openrouter_models) | **GET** /api/v1/openrouter-proxy/models | 可用模型列表
[**openrouter_models_0**](OpenRouterProxyApi.md#openrouter_models_0) | **GET** /api/v1/openrouter-proxy/models | 可用模型列表


# **credits_api_v1_openrouter_proxy_credits_get**
> object credits_api_v1_openrouter_proxy_credits_get(api_key=api_key)

账户额度

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
    api_instance = zhs_api.OpenRouterProxyApi(api_client)
    api_key = '' # str |  (optional) (default to '')

    try:
        # 账户额度
        api_response = api_instance.credits_api_v1_openrouter_proxy_credits_get(api_key=api_key)
        print("The response of OpenRouterProxyApi->credits_api_v1_openrouter_proxy_credits_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OpenRouterProxyApi->credits_api_v1_openrouter_proxy_credits_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **api_key** | **str**|  | [optional] [default to &#39;&#39;]

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

# **credits_api_v1_openrouter_proxy_credits_get_0**
> object credits_api_v1_openrouter_proxy_credits_get_0(api_key=api_key)

账户额度

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
    api_instance = zhs_api.OpenRouterProxyApi(api_client)
    api_key = '' # str |  (optional) (default to '')

    try:
        # 账户额度
        api_response = api_instance.credits_api_v1_openrouter_proxy_credits_get_0(api_key=api_key)
        print("The response of OpenRouterProxyApi->credits_api_v1_openrouter_proxy_credits_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OpenRouterProxyApi->credits_api_v1_openrouter_proxy_credits_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **api_key** | **str**|  | [optional] [default to &#39;&#39;]

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

# **openrouter_chat**
> object openrouter_chat(body_openrouter_chat, api_key=api_key)

OpenRouter对话

### Example


```python
import zhs_api
from zhs_api.models.body_openrouter_chat import BodyOpenrouterChat
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
    api_instance = zhs_api.OpenRouterProxyApi(api_client)
    body_openrouter_chat = zhs_api.BodyOpenrouterChat() # BodyOpenrouterChat | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # OpenRouter对话
        api_response = api_instance.openrouter_chat(body_openrouter_chat, api_key=api_key)
        print("The response of OpenRouterProxyApi->openrouter_chat:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OpenRouterProxyApi->openrouter_chat: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_openrouter_chat** | [**BodyOpenrouterChat**](BodyOpenrouterChat.md)|  | 
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

# **openrouter_chat_0**
> object openrouter_chat_0(body_openrouter_chat, api_key=api_key)

OpenRouter对话

### Example


```python
import zhs_api
from zhs_api.models.body_openrouter_chat import BodyOpenrouterChat
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
    api_instance = zhs_api.OpenRouterProxyApi(api_client)
    body_openrouter_chat = zhs_api.BodyOpenrouterChat() # BodyOpenrouterChat | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # OpenRouter对话
        api_response = api_instance.openrouter_chat_0(body_openrouter_chat, api_key=api_key)
        print("The response of OpenRouterProxyApi->openrouter_chat_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OpenRouterProxyApi->openrouter_chat_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_openrouter_chat** | [**BodyOpenrouterChat**](BodyOpenrouterChat.md)|  | 
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

# **openrouter_completion**
> object openrouter_completion(body_openrouter_completion, api_key=api_key)

OpenRouter文本补全

### Example


```python
import zhs_api
from zhs_api.models.body_openrouter_completion import BodyOpenrouterCompletion
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
    api_instance = zhs_api.OpenRouterProxyApi(api_client)
    body_openrouter_completion = zhs_api.BodyOpenrouterCompletion() # BodyOpenrouterCompletion | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # OpenRouter文本补全
        api_response = api_instance.openrouter_completion(body_openrouter_completion, api_key=api_key)
        print("The response of OpenRouterProxyApi->openrouter_completion:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OpenRouterProxyApi->openrouter_completion: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_openrouter_completion** | [**BodyOpenrouterCompletion**](BodyOpenrouterCompletion.md)|  | 
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

# **openrouter_completion_0**
> object openrouter_completion_0(body_openrouter_completion, api_key=api_key)

OpenRouter文本补全

### Example


```python
import zhs_api
from zhs_api.models.body_openrouter_completion import BodyOpenrouterCompletion
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
    api_instance = zhs_api.OpenRouterProxyApi(api_client)
    body_openrouter_completion = zhs_api.BodyOpenrouterCompletion() # BodyOpenrouterCompletion | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # OpenRouter文本补全
        api_response = api_instance.openrouter_completion_0(body_openrouter_completion, api_key=api_key)
        print("The response of OpenRouterProxyApi->openrouter_completion_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OpenRouterProxyApi->openrouter_completion_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_openrouter_completion** | [**BodyOpenrouterCompletion**](BodyOpenrouterCompletion.md)|  | 
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

# **openrouter_embeddings**
> object openrouter_embeddings(body_openrouter_embeddings, api_key=api_key)

OpenRouter Embeddings

### Example


```python
import zhs_api
from zhs_api.models.body_openrouter_embeddings import BodyOpenrouterEmbeddings
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
    api_instance = zhs_api.OpenRouterProxyApi(api_client)
    body_openrouter_embeddings = zhs_api.BodyOpenrouterEmbeddings() # BodyOpenrouterEmbeddings | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # OpenRouter Embeddings
        api_response = api_instance.openrouter_embeddings(body_openrouter_embeddings, api_key=api_key)
        print("The response of OpenRouterProxyApi->openrouter_embeddings:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OpenRouterProxyApi->openrouter_embeddings: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_openrouter_embeddings** | [**BodyOpenrouterEmbeddings**](BodyOpenrouterEmbeddings.md)|  | 
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

# **openrouter_embeddings_0**
> object openrouter_embeddings_0(body_openrouter_embeddings, api_key=api_key)

OpenRouter Embeddings

### Example


```python
import zhs_api
from zhs_api.models.body_openrouter_embeddings import BodyOpenrouterEmbeddings
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
    api_instance = zhs_api.OpenRouterProxyApi(api_client)
    body_openrouter_embeddings = zhs_api.BodyOpenrouterEmbeddings() # BodyOpenrouterEmbeddings | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # OpenRouter Embeddings
        api_response = api_instance.openrouter_embeddings_0(body_openrouter_embeddings, api_key=api_key)
        print("The response of OpenRouterProxyApi->openrouter_embeddings_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OpenRouterProxyApi->openrouter_embeddings_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_openrouter_embeddings** | [**BodyOpenrouterEmbeddings**](BodyOpenrouterEmbeddings.md)|  | 
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

# **openrouter_models**
> object openrouter_models()

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
    api_instance = zhs_api.OpenRouterProxyApi(api_client)

    try:
        # 可用模型列表
        api_response = api_instance.openrouter_models()
        print("The response of OpenRouterProxyApi->openrouter_models:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OpenRouterProxyApi->openrouter_models: %s\n" % e)
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

# **openrouter_models_0**
> object openrouter_models_0()

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
    api_instance = zhs_api.OpenRouterProxyApi(api_client)

    try:
        # 可用模型列表
        api_response = api_instance.openrouter_models_0()
        print("The response of OpenRouterProxyApi->openrouter_models_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling OpenRouterProxyApi->openrouter_models_0: %s\n" % e)
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

