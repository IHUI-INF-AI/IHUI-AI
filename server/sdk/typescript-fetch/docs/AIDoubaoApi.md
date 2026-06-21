# AIDoubaoApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**doubaoChatApiV1AiDoubaoChatPost**](AIDoubaoApi.md#doubaochatapiv1aidoubaochatpost) | **POST** /api/v1/ai/doubao/chat | Doubao chat completion |
| [**doubaoImageEditApiV1AiDoubaoImageEditPost**](AIDoubaoApi.md#doubaoimageeditapiv1aidoubaoimageeditpost) | **POST** /api/v1/ai/doubao/image/edit | 豆包图片编辑 |
| [**doubaoImageGenerateApiV1AiDoubaoImageGeneratePost**](AIDoubaoApi.md#doubaoimagegenerateapiv1aidoubaoimagegeneratepost) | **POST** /api/v1/ai/doubao/image/generate | 豆包图片生成 (即梦 jimeng_t2i_v40) |
| [**doubaoSeedreamApiV1AiDoubaoImageSeedreamPost**](AIDoubaoApi.md#doubaoseedreamapiv1aidoubaoimageseedreampost) | **POST** /api/v1/ai/doubao/image/seedream | Seedream 图片生成 |
| [**doubaoStreamApiV1AiDoubaoChatStreamPost**](AIDoubaoApi.md#doubaostreamapiv1aidoubaochatstreampost) | **POST** /api/v1/ai/doubao/chat/stream | Doubao streaming chat |
| [**doubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost**](AIDoubaoApi.md#doubaovideogenerateapiv1aidoubaovideogeneratepost) | **POST** /api/v1/ai/doubao/video/generate | 豆包视频生成 (Seedance, async) |



## doubaoChatApiV1AiDoubaoChatPost

> any doubaoChatApiV1AiDoubaoChatPost(message, model)

Doubao chat completion

### Example

```ts
import {
  Configuration,
  AIDoubaoApi,
} from '';
import type { DoubaoChatApiV1AiDoubaoChatPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIDoubaoApi(config);

  const body = {
    // string
    message: message_example,
    // string (optional)
    model: model_example,
  } satisfies DoubaoChatApiV1AiDoubaoChatPostRequest;

  try {
    const data = await api.doubaoChatApiV1AiDoubaoChatPost(body);
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
| **model** | `string` |  | [Optional] [Defaults to `&#39;doubao-pro-32k&#39;`] |

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


## doubaoImageEditApiV1AiDoubaoImageEditPost

> any doubaoImageEditApiV1AiDoubaoImageEditPost(prompt, image, mask, model, size, n, strength, responseFormat)

豆包图片编辑

调用豆包图片编辑 API（/v3/images/edits）。

### Example

```ts
import {
  Configuration,
  AIDoubaoApi,
} from '';
import type { DoubaoImageEditApiV1AiDoubaoImageEditPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIDoubaoApi(config);

  const body = {
    // string | 编辑指令 prompt
    prompt: prompt_example,
    // Blob | 待编辑的原始图片
    image: BINARY_DATA_HERE,
    // Blob | 遮罩图片（可选），标记需要编辑的区域 (optional)
    mask: BINARY_DATA_HERE,
    // string | 图片编辑模型名称 (optional)
    model: model_example,
    // string | 输出图片尺寸 (optional)
    size: size_example,
    // number | 生成数量 (optional)
    n: 56,
    // number | 编辑强度，0-1 (optional)
    strength: 8.14,
    // string | 返回格式: url / b64_json (optional)
    responseFormat: responseFormat_example,
  } satisfies DoubaoImageEditApiV1AiDoubaoImageEditPostRequest;

  try {
    const data = await api.doubaoImageEditApiV1AiDoubaoImageEditPost(body);
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
| **prompt** | `string` | 编辑指令 prompt | [Defaults to `undefined`] |
| **image** | `Blob` | 待编辑的原始图片 | [Defaults to `undefined`] |
| **mask** | `Blob` | 遮罩图片（可选），标记需要编辑的区域 | [Optional] [Defaults to `undefined`] |
| **model** | `string` | 图片编辑模型名称 | [Optional] [Defaults to `&#39;doubao-seedream-3-0-i2i-250415&#39;`] |
| **size** | `string` | 输出图片尺寸 | [Optional] [Defaults to `&#39;1024x1024&#39;`] |
| **n** | `number` | 生成数量 | [Optional] [Defaults to `1`] |
| **strength** | `number` | 编辑强度，0-1 | [Optional] [Defaults to `0.8`] |
| **responseFormat** | `string` | 返回格式: url / b64_json | [Optional] [Defaults to `&#39;url&#39;`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## doubaoImageGenerateApiV1AiDoubaoImageGeneratePost

> any doubaoImageGenerateApiV1AiDoubaoImageGeneratePost(doubaoImageRequest)

豆包图片生成 (即梦 jimeng_t2i_v40)

Submit a JiMeng text-to-image task via Volcengine CVSync2Async API, poll until complete, persist the image, deduct tokens, and return the URL.  Uses Volcengine V4 HMAC signing with DOUBAO_JM_API_KEY / DOUBAO_JM_SECRET_KEY.

### Example

```ts
import {
  Configuration,
  AIDoubaoApi,
} from '';
import type { DoubaoImageGenerateApiV1AiDoubaoImageGeneratePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AIDoubaoApi();

  const body = {
    // DoubaoImageRequest
    doubaoImageRequest: ...,
  } satisfies DoubaoImageGenerateApiV1AiDoubaoImageGeneratePostRequest;

  try {
    const data = await api.doubaoImageGenerateApiV1AiDoubaoImageGeneratePost(body);
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
| **doubaoImageRequest** | [DoubaoImageRequest](DoubaoImageRequest.md) |  | |

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


## doubaoSeedreamApiV1AiDoubaoImageSeedreamPost

> any doubaoSeedreamApiV1AiDoubaoImageSeedreamPost(seedreamImageRequest)

Seedream 图片生成

Call Doubao Seedream model for image generation via /v3/images/generations with Bearer token auth.  Mirrors the original doubao_image_proxy.py /doubao-seedream-generation endpoint.

### Example

```ts
import {
  Configuration,
  AIDoubaoApi,
} from '';
import type { DoubaoSeedreamApiV1AiDoubaoImageSeedreamPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AIDoubaoApi();

  const body = {
    // SeedreamImageRequest
    seedreamImageRequest: ...,
  } satisfies DoubaoSeedreamApiV1AiDoubaoImageSeedreamPostRequest;

  try {
    const data = await api.doubaoSeedreamApiV1AiDoubaoImageSeedreamPost(body);
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
| **seedreamImageRequest** | [SeedreamImageRequest](SeedreamImageRequest.md) |  | |

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


## doubaoStreamApiV1AiDoubaoChatStreamPost

> any doubaoStreamApiV1AiDoubaoChatStreamPost(message, model)

Doubao streaming chat

### Example

```ts
import {
  Configuration,
  AIDoubaoApi,
} from '';
import type { DoubaoStreamApiV1AiDoubaoChatStreamPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIDoubaoApi(config);

  const body = {
    // string
    message: message_example,
    // string (optional)
    model: model_example,
  } satisfies DoubaoStreamApiV1AiDoubaoChatStreamPostRequest;

  try {
    const data = await api.doubaoStreamApiV1AiDoubaoChatStreamPost(body);
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
| **model** | `string` |  | [Optional] [Defaults to `&#39;doubao-pro-32k&#39;`] |

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


## doubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost

> any doubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost(videoGenerateRequest)

豆包视频生成 (Seedance, async)

Submit a Doubao Seedance video-generation task, poll until complete, persist the resulting video, deduct tokens, and return the video URL.  Mirrors the original doubao_video_proxy.py /video-generation endpoint.

### Example

```ts
import {
  Configuration,
  AIDoubaoApi,
} from '';
import type { DoubaoVideoGenerateApiV1AiDoubaoVideoGeneratePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AIDoubaoApi();

  const body = {
    // VideoGenerateRequest
    videoGenerateRequest: ...,
  } satisfies DoubaoVideoGenerateApiV1AiDoubaoVideoGeneratePostRequest;

  try {
    const data = await api.doubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost(body);
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
| **videoGenerateRequest** | [VideoGenerateRequest](VideoGenerateRequest.md) |  | |

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

