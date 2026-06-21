# AIDoubaoApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**doubaoChatApiV1AiDoubaoChatPost**](#doubaochatapiv1aidoubaochatpost) | **POST** /api/v1/ai/doubao/chat | Doubao chat completion|
|[**doubaoImageEditApiV1AiDoubaoImageEditPost**](#doubaoimageeditapiv1aidoubaoimageeditpost) | **POST** /api/v1/ai/doubao/image/edit | 豆包图片编辑|
|[**doubaoImageGenerateApiV1AiDoubaoImageGeneratePost**](#doubaoimagegenerateapiv1aidoubaoimagegeneratepost) | **POST** /api/v1/ai/doubao/image/generate | 豆包图片生成 (即梦 jimeng_t2i_v40)|
|[**doubaoSeedreamApiV1AiDoubaoImageSeedreamPost**](#doubaoseedreamapiv1aidoubaoimageseedreampost) | **POST** /api/v1/ai/doubao/image/seedream | Seedream 图片生成|
|[**doubaoStreamApiV1AiDoubaoChatStreamPost**](#doubaostreamapiv1aidoubaochatstreampost) | **POST** /api/v1/ai/doubao/chat/stream | Doubao streaming chat|
|[**doubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost**](#doubaovideogenerateapiv1aidoubaovideogeneratepost) | **POST** /api/v1/ai/doubao/video/generate | 豆包视频生成 (Seedance, async)|

# **doubaoChatApiV1AiDoubaoChatPost**
> any doubaoChatApiV1AiDoubaoChatPost()


### Example

```typescript
import {
    AIDoubaoApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIDoubaoApi(configuration);

let message: string; // (default to undefined)
let model: string; // (optional) (default to 'doubao-pro-32k')

const { status, data } = await apiInstance.doubaoChatApiV1AiDoubaoChatPost(
    message,
    model
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **message** | [**string**] |  | defaults to undefined|
| **model** | [**string**] |  | (optional) defaults to 'doubao-pro-32k'|


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
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **doubaoImageEditApiV1AiDoubaoImageEditPost**
> any doubaoImageEditApiV1AiDoubaoImageEditPost()

调用豆包图片编辑 API（/v3/images/edits）。

### Example

```typescript
import {
    AIDoubaoApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIDoubaoApi(configuration);

let prompt: string; //编辑指令 prompt (default to undefined)
let image: File; //待编辑的原始图片 (default to undefined)
let mask: File; //遮罩图片（可选），标记需要编辑的区域 (optional) (default to undefined)
let model: string; //图片编辑模型名称 (optional) (default to 'doubao-seedream-3-0-i2i-250415')
let size: string; //输出图片尺寸 (optional) (default to '1024x1024')
let n: number; //生成数量 (optional) (default to 1)
let strength: number; //编辑强度，0-1 (optional) (default to 0.8)
let responseFormat: string; //返回格式: url / b64_json (optional) (default to 'url')

const { status, data } = await apiInstance.doubaoImageEditApiV1AiDoubaoImageEditPost(
    prompt,
    image,
    mask,
    model,
    size,
    n,
    strength,
    responseFormat
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **prompt** | [**string**] | 编辑指令 prompt | defaults to undefined|
| **image** | [**File**] | 待编辑的原始图片 | defaults to undefined|
| **mask** | [**File**] | 遮罩图片（可选），标记需要编辑的区域 | (optional) defaults to undefined|
| **model** | [**string**] | 图片编辑模型名称 | (optional) defaults to 'doubao-seedream-3-0-i2i-250415'|
| **size** | [**string**] | 输出图片尺寸 | (optional) defaults to '1024x1024'|
| **n** | [**number**] | 生成数量 | (optional) defaults to 1|
| **strength** | [**number**] | 编辑强度，0-1 | (optional) defaults to 0.8|
| **responseFormat** | [**string**] | 返回格式: url / b64_json | (optional) defaults to 'url'|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **doubaoImageGenerateApiV1AiDoubaoImageGeneratePost**
> any doubaoImageGenerateApiV1AiDoubaoImageGeneratePost(doubaoImageRequest)

Submit a JiMeng text-to-image task via Volcengine CVSync2Async API, poll until complete, persist the image, deduct tokens, and return the URL.  Uses Volcengine V4 HMAC signing with DOUBAO_JM_API_KEY / DOUBAO_JM_SECRET_KEY.

### Example

```typescript
import {
    AIDoubaoApi,
    Configuration,
    DoubaoImageRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIDoubaoApi(configuration);

let doubaoImageRequest: DoubaoImageRequest; //

const { status, data } = await apiInstance.doubaoImageGenerateApiV1AiDoubaoImageGeneratePost(
    doubaoImageRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **doubaoImageRequest** | **DoubaoImageRequest**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **doubaoSeedreamApiV1AiDoubaoImageSeedreamPost**
> any doubaoSeedreamApiV1AiDoubaoImageSeedreamPost(seedreamImageRequest)

Call Doubao Seedream model for image generation via /v3/images/generations with Bearer token auth.  Mirrors the original doubao_image_proxy.py /doubao-seedream-generation endpoint.

### Example

```typescript
import {
    AIDoubaoApi,
    Configuration,
    SeedreamImageRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIDoubaoApi(configuration);

let seedreamImageRequest: SeedreamImageRequest; //

const { status, data } = await apiInstance.doubaoSeedreamApiV1AiDoubaoImageSeedreamPost(
    seedreamImageRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **seedreamImageRequest** | **SeedreamImageRequest**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **doubaoStreamApiV1AiDoubaoChatStreamPost**
> any doubaoStreamApiV1AiDoubaoChatStreamPost()


### Example

```typescript
import {
    AIDoubaoApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIDoubaoApi(configuration);

let message: string; // (default to undefined)
let model: string; // (optional) (default to 'doubao-pro-32k')

const { status, data } = await apiInstance.doubaoStreamApiV1AiDoubaoChatStreamPost(
    message,
    model
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **message** | [**string**] |  | defaults to undefined|
| **model** | [**string**] |  | (optional) defaults to 'doubao-pro-32k'|


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
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **doubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost**
> any doubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost(videoGenerateRequest)

Submit a Doubao Seedance video-generation task, poll until complete, persist the resulting video, deduct tokens, and return the video URL.  Mirrors the original doubao_video_proxy.py /video-generation endpoint.

### Example

```typescript
import {
    AIDoubaoApi,
    Configuration,
    VideoGenerateRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIDoubaoApi(configuration);

let videoGenerateRequest: VideoGenerateRequest; //

const { status, data } = await apiInstance.doubaoVideoGenerateApiV1AiDoubaoVideoGeneratePost(
    videoGenerateRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoGenerateRequest** | **VideoGenerateRequest**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

