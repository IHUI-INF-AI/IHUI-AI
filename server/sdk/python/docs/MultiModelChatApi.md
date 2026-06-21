# zhs_api.MultiModelChatApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**list_vendors_api_v1_chat_vendors_get**](MultiModelChatApi.md#list_vendors_api_v1_chat_vendors_get) | **GET** /api/v1/chat/vendors | 列出支持的 AI 厂商
[**multi_vendor_chat_api_v1_chat_multi_post**](MultiModelChatApi.md#multi_vendor_chat_api_v1_chat_multi_post) | **POST** /api/v1/chat/multi | 同时调用多个厂商并返回结果列表（用于对比评测）
[**vendor_chat_api_v1_chat_vendor_chat_post**](MultiModelChatApi.md#vendor_chat_api_v1_chat_vendor_chat_post) | **POST** /api/v1/chat/{vendor}/chat | 多厂商同步聊天
[**vendor_chat_stream_api_v1_chat_vendor_chat_stream_post**](MultiModelChatApi.md#vendor_chat_stream_api_v1_chat_vendor_chat_stream_post) | **POST** /api/v1/chat/{vendor}/chat/stream | 多厂商流式聊天（SSE）


# **list_vendors_api_v1_chat_vendors_get**
> object list_vendors_api_v1_chat_vendors_get()

列出支持的 AI 厂商

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
    api_instance = zhs_api.MultiModelChatApi(api_client)

    try:
        # 列出支持的 AI 厂商
        api_response = api_instance.list_vendors_api_v1_chat_vendors_get()
        print("The response of MultiModelChatApi->list_vendors_api_v1_chat_vendors_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MultiModelChatApi->list_vendors_api_v1_chat_vendors_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **multi_vendor_chat_api_v1_chat_multi_post**
> object multi_vendor_chat_api_v1_chat_multi_post(vendors, message, model=model)

同时调用多个厂商并返回结果列表（用于对比评测）

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
    api_instance = zhs_api.MultiModelChatApi(api_client)
    vendors = 'vendors_example' # str | 逗号分隔的厂商列表，如 zhipu,openrouter
    message = 'message_example' # str | 
    model = 'gpt-3.5-turbo' # str |  (optional) (default to 'gpt-3.5-turbo')

    try:
        # 同时调用多个厂商并返回结果列表（用于对比评测）
        api_response = api_instance.multi_vendor_chat_api_v1_chat_multi_post(vendors, message, model=model)
        print("The response of MultiModelChatApi->multi_vendor_chat_api_v1_chat_multi_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MultiModelChatApi->multi_vendor_chat_api_v1_chat_multi_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **vendors** | **str**| 逗号分隔的厂商列表，如 zhipu,openrouter | 
 **message** | **str**|  | 
 **model** | **str**|  | [optional] [default to &#39;gpt-3.5-turbo&#39;]

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

# **vendor_chat_api_v1_chat_vendor_chat_post**
> object vendor_chat_api_v1_chat_vendor_chat_post(vendor, model, message)

多厂商同步聊天

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
    api_instance = zhs_api.MultiModelChatApi(api_client)
    vendor = 'vendor_example' # str | 
    model = 'model_example' # str | 
    message = 'message_example' # str | 

    try:
        # 多厂商同步聊天
        api_response = api_instance.vendor_chat_api_v1_chat_vendor_chat_post(vendor, model, message)
        print("The response of MultiModelChatApi->vendor_chat_api_v1_chat_vendor_chat_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MultiModelChatApi->vendor_chat_api_v1_chat_vendor_chat_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **vendor** | **str**|  | 
 **model** | **str**|  | 
 **message** | **str**|  | 

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

# **vendor_chat_stream_api_v1_chat_vendor_chat_stream_post**
> object vendor_chat_stream_api_v1_chat_vendor_chat_stream_post(vendor, model, message)

多厂商流式聊天（SSE）

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
    api_instance = zhs_api.MultiModelChatApi(api_client)
    vendor = 'vendor_example' # str | 
    model = 'model_example' # str | 
    message = 'message_example' # str | 

    try:
        # 多厂商流式聊天（SSE）
        api_response = api_instance.vendor_chat_stream_api_v1_chat_vendor_chat_stream_post(vendor, model, message)
        print("The response of MultiModelChatApi->vendor_chat_stream_api_v1_chat_vendor_chat_stream_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MultiModelChatApi->vendor_chat_stream_api_v1_chat_vendor_chat_stream_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **vendor** | **str**|  | 
 **model** | **str**|  | 
 **message** | **str**|  | 

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

