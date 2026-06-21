# zhs_api.DeepSeekChatApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**deepseek_chat_api_v1_chat_chat_post**](DeepSeekChatApi.md#deepseek_chat_api_v1_chat_chat_post) | **POST** /api/v1/chat/chat | DeepSeek 同步聊天
[**deepseek_chat_stream_api_v1_chat_chat_stream_post**](DeepSeekChatApi.md#deepseek_chat_stream_api_v1_chat_chat_stream_post) | **POST** /api/v1/chat/chat/stream | DeepSeek 流式聊天（SSE）


# **deepseek_chat_api_v1_chat_chat_post**
> object deepseek_chat_api_v1_chat_chat_post(message, model=model)

DeepSeek 同步聊天

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
    api_instance = zhs_api.DeepSeekChatApi(api_client)
    message = 'message_example' # str | 
    model = 'deepseek-chat' # str |  (optional) (default to 'deepseek-chat')

    try:
        # DeepSeek 同步聊天
        api_response = api_instance.deepseek_chat_api_v1_chat_chat_post(message, model=model)
        print("The response of DeepSeekChatApi->deepseek_chat_api_v1_chat_chat_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DeepSeekChatApi->deepseek_chat_api_v1_chat_chat_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **message** | **str**|  | 
 **model** | **str**|  | [optional] [default to &#39;deepseek-chat&#39;]

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

# **deepseek_chat_stream_api_v1_chat_chat_stream_post**
> object deepseek_chat_stream_api_v1_chat_chat_stream_post(message, model=model)

DeepSeek 流式聊天（SSE）

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
    api_instance = zhs_api.DeepSeekChatApi(api_client)
    message = 'message_example' # str | 
    model = 'deepseek-chat' # str |  (optional) (default to 'deepseek-chat')

    try:
        # DeepSeek 流式聊天（SSE）
        api_response = api_instance.deepseek_chat_stream_api_v1_chat_chat_stream_post(message, model=model)
        print("The response of DeepSeekChatApi->deepseek_chat_stream_api_v1_chat_chat_stream_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DeepSeekChatApi->deepseek_chat_stream_api_v1_chat_chat_stream_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **message** | **str**|  | 
 **model** | **str**|  | [optional] [default to &#39;deepseek-chat&#39;]

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

