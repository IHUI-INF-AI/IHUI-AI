# DeepSeekChatApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**deepseekChatApiV1ChatChatPost**](DeepSeekChatApi.md#deepseekchatapiv1chatchatpost) | **POST** /api/v1/chat/chat | DeepSeek 同步聊天 |
| [**deepseekChatStreamApiV1ChatChatStreamPost**](DeepSeekChatApi.md#deepseekchatstreamapiv1chatchatstreampost) | **POST** /api/v1/chat/chat/stream | DeepSeek 流式聊天（SSE） |



## deepseekChatApiV1ChatChatPost

> any deepseekChatApiV1ChatChatPost(message, model)

DeepSeek 同步聊天

### Example

```ts
import {
  Configuration,
  DeepSeekChatApi,
} from '';
import type { DeepseekChatApiV1ChatChatPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DeepSeekChatApi(config);

  const body = {
    // string
    message: message_example,
    // string (optional)
    model: model_example,
  } satisfies DeepseekChatApiV1ChatChatPostRequest;

  try {
    const data = await api.deepseekChatApiV1ChatChatPost(body);
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
| **message** | `string` |  | [Defaults to `undefined`] |
| **model** | `string` |  | [Optional] [Defaults to `&#39;deepseek-chat&#39;`] |

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
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deepseekChatStreamApiV1ChatChatStreamPost

> any deepseekChatStreamApiV1ChatChatStreamPost(message, model)

DeepSeek 流式聊天（SSE）

### Example

```ts
import {
  Configuration,
  DeepSeekChatApi,
} from '';
import type { DeepseekChatStreamApiV1ChatChatStreamPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DeepSeekChatApi(config);

  const body = {
    // string
    message: message_example,
    // string (optional)
    model: model_example,
  } satisfies DeepseekChatStreamApiV1ChatChatStreamPostRequest;

  try {
    const data = await api.deepseekChatStreamApiV1ChatChatStreamPost(body);
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
| **message** | `string` |  | [Defaults to `undefined`] |
| **model** | `string` |  | [Optional] [Defaults to `&#39;deepseek-chat&#39;`] |

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
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

