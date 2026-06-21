# AIGeminiApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**geminiChatApiV1AiGeminiChatPost**](#geminichatapiv1aigeminichatpost) | **POST** /api/v1/ai/gemini/chat | Gemini AI 对话 (直接API)|
|[**geminiProxyChatApiV1AiGeminiChatCompletionsPost**](#geminiproxychatapiv1aigeminichatcompletionspost) | **POST** /api/v1/ai/gemini/chat/completions | Gemini AI 对话 (OpenAI兼容代理)|

# **geminiChatApiV1AiGeminiChatPost**
> any geminiChatApiV1AiGeminiChatPost(geminiChatRequest)

Send a chat request directly to Google Gemini API and return the response.

### Example

```typescript
import {
    AIGeminiApi,
    Configuration,
    GeminiChatRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIGeminiApi(configuration);

let geminiChatRequest: GeminiChatRequest; //

const { status, data } = await apiInstance.geminiChatApiV1AiGeminiChatPost(
    geminiChatRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **geminiChatRequest** | **GeminiChatRequest**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **geminiProxyChatApiV1AiGeminiChatCompletionsPost**
> any geminiProxyChatApiV1AiGeminiChatCompletionsPost()

Gemini via OpenAI-compatible proxy (yunwu.ai). Mirrors the original luyala_proxy.py /chat/completions endpoint.  Accepts OpenAI-style messages and forwards to the proxy. Supports inline base64 image extraction and upload.

### Example

```typescript
import {
    AIGeminiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIGeminiApi(configuration);

const { status, data } = await apiInstance.geminiProxyChatApiV1AiGeminiChatCompletionsPost();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

