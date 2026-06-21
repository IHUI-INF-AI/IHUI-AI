# AIGeminiApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**geminiChatApiV1AiGeminiChatPost**](AIGeminiApi.md#geminichatapiv1aigeminichatpost) | **POST** /api/v1/ai/gemini/chat | Gemini AI 对话 (直接API) |
| [**geminiProxyChatApiV1AiGeminiChatCompletionsPost**](AIGeminiApi.md#geminiproxychatapiv1aigeminichatcompletionspost) | **POST** /api/v1/ai/gemini/chat/completions | Gemini AI 对话 (OpenAI兼容代理) |



## geminiChatApiV1AiGeminiChatPost

> any geminiChatApiV1AiGeminiChatPost(geminiChatRequest)

Gemini AI 对话 (直接API)

Send a chat request directly to Google Gemini API and return the response.

### Example

```ts
import {
  Configuration,
  AIGeminiApi,
} from '';
import type { GeminiChatApiV1AiGeminiChatPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIGeminiApi(config);

  const body = {
    // GeminiChatRequest
    geminiChatRequest: ...,
  } satisfies GeminiChatApiV1AiGeminiChatPostRequest;

  try {
    const data = await api.geminiChatApiV1AiGeminiChatPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **geminiChatRequest** | [GeminiChatRequest](GeminiChatRequest.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## geminiProxyChatApiV1AiGeminiChatCompletionsPost

> any geminiProxyChatApiV1AiGeminiChatCompletionsPost()

Gemini AI 对话 (OpenAI兼容代理)

Gemini via OpenAI-compatible proxy (yunwu.ai). Mirrors the original luyala_proxy.py /chat/completions endpoint.  Accepts OpenAI-style messages and forwards to the proxy. Supports inline base64 image extraction and upload.

### Example

```ts
import {
  Configuration,
  AIGeminiApi,
} from '';
import type { GeminiProxyChatApiV1AiGeminiChatCompletionsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIGeminiApi(config);

  try {
    const data = await api.geminiProxyChatApiV1AiGeminiChatCompletionsPost();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

