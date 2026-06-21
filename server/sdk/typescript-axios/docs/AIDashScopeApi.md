# AIDashScopeApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**audioModelsApiV1AiDashscopeAudioModelsGet**](#audiomodelsapiv1aidashscopeaudiomodelsget) | **GET** /api/v1/ai/dashscope/audio/models | List supported ASR models|
|[**audioRecognizeApiV1AiDashscopeAudioRecognizePost**](#audiorecognizeapiv1aidashscopeaudiorecognizepost) | **POST** /api/v1/ai/dashscope/audio/recognize | Audio speech recognition|
|[**dashscopeChatApiV1AiDashscopeChatPost**](#dashscopechatapiv1aidashscopechatpost) | **POST** /api/v1/ai/dashscope/chat | DashScope chat completion|
|[**dashscopeStreamApiV1AiDashscopeChatStreamPost**](#dashscopestreamapiv1aidashscopechatstreampost) | **POST** /api/v1/ai/dashscope/chat/stream | DashScope streaming chat|
|[**imageEditApiV1AiDashscopeImageEditPost**](#imageeditapiv1aidashscopeimageeditpost) | **POST** /api/v1/ai/dashscope/image/edit | DashScope image editing (standard)|
|[**imageEditSimpleApiV1AiDashscopeImageEditSimplePost**](#imageeditsimpleapiv1aidashscopeimageeditsimplepost) | **POST** /api/v1/ai/dashscope/image/edit/simple | Simple DashScope image editing|
|[**imageGenerateApiV1AiDashscopeImageGenerateModelPost**](#imagegenerateapiv1aidashscopeimagegeneratemodelpost) | **POST** /api/v1/ai/dashscope/image/generate/{model} | DashScope image generation|
|[**imageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet**](#imagetaskstatusapiv1aidashscopeimagetasktaskidget) | **GET** /api/v1/ai/dashscope/image/task/{task_id} | Query image generation task status|
|[**imageToImageApiV1AiDashscopeImageToImagePost**](#imagetoimageapiv1aidashscopeimagetoimagepost) | **POST** /api/v1/ai/dashscope/image-to-image | DashScope image-to-image|
|[**videoSynthesisApiV1AiDashscopeVideoSynthesisPost**](#videosynthesisapiv1aidashscopevideosynthesispost) | **POST** /api/v1/ai/dashscope/video/synthesis | Submit video synthesis task|
|[**videoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet**](#videotaskstatusapiv1aidashscopevideotaskstaskidget) | **GET** /api/v1/ai/dashscope/video/tasks/{task_id} | Query video synthesis task status|
|[**visionChatApiV1AiDashscopeVisionChatPost**](#visionchatapiv1aidashscopevisionchatpost) | **POST** /api/v1/ai/dashscope/vision/chat | Vision multi-modal chat|

# **audioModelsApiV1AiDashscopeAudioModelsGet**
> any audioModelsApiV1AiDashscopeAudioModelsGet()

Return the list of supported audio recognition models.

### Example

```typescript
import {
    AIDashScopeApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIDashScopeApi(configuration);

const { status, data } = await apiInstance.audioModelsApiV1AiDashscopeAudioModelsGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **audioRecognizeApiV1AiDashscopeAudioRecognizePost**
> any audioRecognizeApiV1AiDashscopeAudioRecognizePost(audioRecognizeRequest)

Recognise speech in audio via DashScope MultiModalConversation ASR.  Uses the DashScope multi-modal-generation HTTP endpoint. Includes token balance check, cost deduction, and conversation recording.

### Example

```typescript
import {
    AIDashScopeApi,
    Configuration,
    AudioRecognizeRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIDashScopeApi(configuration);

let audioRecognizeRequest: AudioRecognizeRequest; //

const { status, data } = await apiInstance.audioRecognizeApiV1AiDashscopeAudioRecognizePost(
    audioRecognizeRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **audioRecognizeRequest** | **AudioRecognizeRequest**|  | |


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

# **dashscopeChatApiV1AiDashscopeChatPost**
> any dashscopeChatApiV1AiDashscopeChatPost()


### Example

```typescript
import {
    AIDashScopeApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIDashScopeApi(configuration);

let message: string; // (default to undefined)
let model: string; // (optional) (default to 'qwen-turbo')

const { status, data } = await apiInstance.dashscopeChatApiV1AiDashscopeChatPost(
    message,
    model
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **message** | [**string**] |  | defaults to undefined|
| **model** | [**string**] |  | (optional) defaults to 'qwen-turbo'|


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

# **dashscopeStreamApiV1AiDashscopeChatStreamPost**
> any dashscopeStreamApiV1AiDashscopeChatStreamPost()


### Example

```typescript
import {
    AIDashScopeApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIDashScopeApi(configuration);

let message: string; // (default to undefined)
let model: string; // (optional) (default to 'qwen-turbo')

const { status, data } = await apiInstance.dashscopeStreamApiV1AiDashscopeChatStreamPost(
    message,
    model
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **message** | [**string**] |  | defaults to undefined|
| **model** | [**string**] |  | (optional) defaults to 'qwen-turbo'|


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

# **imageEditApiV1AiDashscopeImageEditPost**
> any imageEditApiV1AiDashscopeImageEditPost(imageEditBody)

Edit an image using a mask and prompt.  Returns task_id for async models.  For synchronous models (e.g. wan2.1-image-edit) the result image URL is returned directly.

### Example

```typescript
import {
    AIDashScopeApi,
    Configuration,
    ImageEditBody
} from './api';

const configuration = new Configuration();
const apiInstance = new AIDashScopeApi(configuration);

let imageEditBody: ImageEditBody; //

const { status, data } = await apiInstance.imageEditApiV1AiDashscopeImageEditPost(
    imageEditBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imageEditBody** | **ImageEditBody**|  | |


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

# **imageEditSimpleApiV1AiDashscopeImageEditSimplePost**
> any imageEditSimpleApiV1AiDashscopeImageEditSimplePost(simpleEditBody)

Simple image editing using qwen-image-edit model (background removal, style transfer, etc.).

### Example

```typescript
import {
    AIDashScopeApi,
    Configuration,
    SimpleEditBody
} from './api';

const configuration = new Configuration();
const apiInstance = new AIDashScopeApi(configuration);

let simpleEditBody: SimpleEditBody; //

const { status, data } = await apiInstance.imageEditSimpleApiV1AiDashscopeImageEditSimplePost(
    simpleEditBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **simpleEditBody** | **SimpleEditBody**|  | |


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

# **imageGenerateApiV1AiDashscopeImageGenerateModelPost**
> any imageGenerateApiV1AiDashscopeImageGenerateModelPost(appApiV1AiDashscopeRouteImageGenerateBody)

Submit an async text-to-image task.  When *sync=false* (default) only ``task_id`` is returned; poll with ``GET /image/task/{task_id}``. When *sync=true* the endpoint polls until the task finishes and returns the image URL(s) directly.

### Example

```typescript
import {
    AIDashScopeApi,
    Configuration,
    AppApiV1AiDashscopeRouteImageGenerateBody
} from './api';

const configuration = new Configuration();
const apiInstance = new AIDashScopeApi(configuration);

let model: string; // (default to undefined)
let appApiV1AiDashscopeRouteImageGenerateBody: AppApiV1AiDashscopeRouteImageGenerateBody; //

const { status, data } = await apiInstance.imageGenerateApiV1AiDashscopeImageGenerateModelPost(
    model,
    appApiV1AiDashscopeRouteImageGenerateBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **appApiV1AiDashscopeRouteImageGenerateBody** | **AppApiV1AiDashscopeRouteImageGenerateBody**|  | |
| **model** | [**string**] |  | defaults to undefined|


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

# **imageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet**
> any imageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet()

Poll a DashScope async task; returns status and image URLs when SUCCEEDED.

### Example

```typescript
import {
    AIDashScopeApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIDashScopeApi(configuration);

let taskId: string; // (default to undefined)

const { status, data } = await apiInstance.imageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet(
    taskId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **taskId** | [**string**] |  | defaults to undefined|


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

# **imageToImageApiV1AiDashscopeImageToImagePost**
> any imageToImageApiV1AiDashscopeImageToImagePost(imageToImageBody)

Transform an image guided by a text prompt. Returns task_id for async models.

### Example

```typescript
import {
    AIDashScopeApi,
    Configuration,
    ImageToImageBody
} from './api';

const configuration = new Configuration();
const apiInstance = new AIDashScopeApi(configuration);

let imageToImageBody: ImageToImageBody; //

const { status, data } = await apiInstance.imageToImageApiV1AiDashscopeImageToImagePost(
    imageToImageBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imageToImageBody** | **ImageToImageBody**|  | |


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

# **videoSynthesisApiV1AiDashscopeVideoSynthesisPost**
> any videoSynthesisApiV1AiDashscopeVideoSynthesisPost(videoSynthesisRequest)

Submit an async video generation task to DashScope.  Uses the ``video_generation`` HTTP endpoint with ``X-DashScope-Async``. Returns a ``task_id``; poll with ``GET /video/tasks/{task_id}``.

### Example

```typescript
import {
    AIDashScopeApi,
    Configuration,
    VideoSynthesisRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIDashScopeApi(configuration);

let videoSynthesisRequest: VideoSynthesisRequest; //

const { status, data } = await apiInstance.videoSynthesisApiV1AiDashscopeVideoSynthesisPost(
    videoSynthesisRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoSynthesisRequest** | **VideoSynthesisRequest**|  | |


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

# **videoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet**
> any videoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet()

Query the status / result of an async video synthesis task.

### Example

```typescript
import {
    AIDashScopeApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIDashScopeApi(configuration);

let taskId: string; // (default to undefined)

const { status, data } = await apiInstance.videoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet(
    taskId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **taskId** | [**string**] |  | defaults to undefined|


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

# **visionChatApiV1AiDashscopeVisionChatPost**
> any visionChatApiV1AiDashscopeVisionChatPost(visionChatRequest)

Chat with images + text via DashScope MultiModalConversation.  Supports models like ``qwen-vl-plus``, ``qwen-vl-max``, ``qwen-vl-plus-latest``.

### Example

```typescript
import {
    AIDashScopeApi,
    Configuration,
    VisionChatRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIDashScopeApi(configuration);

let visionChatRequest: VisionChatRequest; //

const { status, data } = await apiInstance.visionChatApiV1AiDashscopeVisionChatPost(
    visionChatRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **visionChatRequest** | **VisionChatRequest**|  | |


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

