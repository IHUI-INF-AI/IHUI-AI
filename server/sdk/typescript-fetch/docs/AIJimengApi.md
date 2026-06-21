# AIJimengApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**jimeng4ImageApiV1AiJimeng4Post**](AIJimengApi.md#jimeng4imageapiv1aijimeng4post) | **POST** /api/v1/ai/jimeng4 | 即梦 4.0 文字生成图片（兼容旧路径） |



## jimeng4ImageApiV1AiJimeng4Post

> any jimeng4ImageApiV1AiJimeng4Post(jimeng4ImageRequest)

即梦 4.0 文字生成图片（兼容旧路径）

Submit a JiMeng 4.0 image generation task via CVSync2Async, poll until complete, and return image URLs / base64 data.

### Example

```ts
import {
  Configuration,
  AIJimengApi,
} from '';
import type { Jimeng4ImageApiV1AiJimeng4PostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AIJimengApi();

  const body = {
    // Jimeng4ImageRequest
    jimeng4ImageRequest: ...,
  } satisfies Jimeng4ImageApiV1AiJimeng4PostRequest;

  try {
    const data = await api.jimeng4ImageApiV1AiJimeng4Post(body);
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
| **jimeng4ImageRequest** | [Jimeng4ImageRequest](Jimeng4ImageRequest.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

