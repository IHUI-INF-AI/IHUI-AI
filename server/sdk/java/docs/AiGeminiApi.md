# AiGeminiApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**geminiChatApiV1AiGeminiChatPost**](AiGeminiApi.md#geminiChatApiV1AiGeminiChatPost) | **POST** /api/v1/ai/gemini/chat | Gemini AI 对话 (直接API) |
| [**geminiProxyChatApiV1AiGeminiChatCompletionsPost**](AiGeminiApi.md#geminiProxyChatApiV1AiGeminiChatCompletionsPost) | **POST** /api/v1/ai/gemini/chat/completions | Gemini AI 对话 (OpenAI兼容代理) |


<a id="geminiChatApiV1AiGeminiChatPost"></a>
# **geminiChatApiV1AiGeminiChatPost**
> Object geminiChatApiV1AiGeminiChatPost(geminiChatRequest)

Gemini AI 对话 (直接API)

Send a chat request directly to Google Gemini API and return the response.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiGeminiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiGeminiApi apiInstance = new AiGeminiApi(defaultClient);
    GeminiChatRequest geminiChatRequest = new GeminiChatRequest(); // GeminiChatRequest | 
    try {
      Object result = apiInstance.geminiChatApiV1AiGeminiChatPost(geminiChatRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiGeminiApi#geminiChatApiV1AiGeminiChatPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **geminiChatRequest** | [**GeminiChatRequest**](GeminiChatRequest.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="geminiProxyChatApiV1AiGeminiChatCompletionsPost"></a>
# **geminiProxyChatApiV1AiGeminiChatCompletionsPost**
> Object geminiProxyChatApiV1AiGeminiChatCompletionsPost()

Gemini AI 对话 (OpenAI兼容代理)

Gemini via OpenAI-compatible proxy (yunwu.ai). Mirrors the original luyala_proxy.py /chat/completions endpoint.  Accepts OpenAI-style messages and forwards to the proxy. Supports inline base64 image extraction and upload.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiGeminiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiGeminiApi apiInstance = new AiGeminiApi(defaultClient);
    try {
      Object result = apiInstance.geminiProxyChatApiV1AiGeminiChatCompletionsPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiGeminiApi#geminiProxyChatApiV1AiGeminiChatCompletionsPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

