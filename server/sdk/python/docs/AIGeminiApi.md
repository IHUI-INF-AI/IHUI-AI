# zhs_api.AIGeminiApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**gemini_chat_api_v1_ai_gemini_chat_post**](AIGeminiApi.md#gemini_chat_api_v1_ai_gemini_chat_post) | **POST** /api/v1/ai/gemini/chat | Gemini AI 对话 (直接API)
[**gemini_proxy_chat_api_v1_ai_gemini_chat_completions_post**](AIGeminiApi.md#gemini_proxy_chat_api_v1_ai_gemini_chat_completions_post) | **POST** /api/v1/ai/gemini/chat/completions | Gemini AI 对话 (OpenAI兼容代理)


# **gemini_chat_api_v1_ai_gemini_chat_post**
> object gemini_chat_api_v1_ai_gemini_chat_post(gemini_chat_request)

Gemini AI 对话 (直接API)

Send a chat request directly to Google Gemini API and return the response.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.gemini_chat_request import GeminiChatRequest
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
    api_instance = zhs_api.AIGeminiApi(api_client)
    gemini_chat_request = zhs_api.GeminiChatRequest() # GeminiChatRequest | 

    try:
        # Gemini AI 对话 (直接API)
        api_response = api_instance.gemini_chat_api_v1_ai_gemini_chat_post(gemini_chat_request)
        print("The response of AIGeminiApi->gemini_chat_api_v1_ai_gemini_chat_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIGeminiApi->gemini_chat_api_v1_ai_gemini_chat_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gemini_chat_request** | [**GeminiChatRequest**](GeminiChatRequest.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **gemini_proxy_chat_api_v1_ai_gemini_chat_completions_post**
> object gemini_proxy_chat_api_v1_ai_gemini_chat_completions_post()

Gemini AI 对话 (OpenAI兼容代理)

Gemini via OpenAI-compatible proxy (yunwu.ai).
Mirrors the original luyala_proxy.py /chat/completions endpoint.

Accepts OpenAI-style messages and forwards to the proxy.
Supports inline base64 image extraction and upload.

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
    api_instance = zhs_api.AIGeminiApi(api_client)

    try:
        # Gemini AI 对话 (OpenAI兼容代理)
        api_response = api_instance.gemini_proxy_chat_api_v1_ai_gemini_chat_completions_post()
        print("The response of AIGeminiApi->gemini_proxy_chat_api_v1_ai_gemini_chat_completions_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIGeminiApi->gemini_proxy_chat_api_v1_ai_gemini_chat_completions_post: %s\n" % e)
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

