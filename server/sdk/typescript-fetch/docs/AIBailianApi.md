# AIBailianApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**bailianChatApiV1AiBailianChatPost**](AIBailianApi.md#bailianchatapiv1aibailianchatpost) | **POST** /api/v1/ai/bailian/chat | 百炼应用对话 |



## bailianChatApiV1AiBailianChatPost

> any bailianChatApiV1AiBailianChatPost(bailianChatRequest)

百炼应用对话

Send a chat request to a Bailian (DashScope) application via HTTP.

### Example

```ts
import {
  Configuration,
  AIBailianApi,
} from '';
import type { BailianChatApiV1AiBailianChatPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIBailianApi(config);

  const body = {
    // BailianChatRequest
    bailianChatRequest: ...,
  } satisfies BailianChatApiV1AiBailianChatPostRequest;

  try {
    const data = await api.bailianChatApiV1AiBailianChatPost(body);
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
| **bailianChatRequest** | [BailianChatRequest](BailianChatRequest.md) |  | |

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

