# AIDashScopeApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**audioModelsApiV1AiDashscopeAudioModelsGet**](AIDashScopeApi.md#audiomodelsapiv1aidashscopeaudiomodelsget) | **GET** /api/v1/ai/dashscope/audio/models | List supported ASR models |
| [**audioRecognizeApiV1AiDashscopeAudioRecognizePost**](AIDashScopeApi.md#audiorecognizeapiv1aidashscopeaudiorecognizepost) | **POST** /api/v1/ai/dashscope/audio/recognize | Audio speech recognition |
| [**dashscopeChatApiV1AiDashscopeChatPost**](AIDashScopeApi.md#dashscopechatapiv1aidashscopechatpost) | **POST** /api/v1/ai/dashscope/chat | DashScope chat completion |
| [**dashscopeStreamApiV1AiDashscopeChatStreamPost**](AIDashScopeApi.md#dashscopestreamapiv1aidashscopechatstreampost) | **POST** /api/v1/ai/dashscope/chat/stream | DashScope streaming chat |
| [**imageEditApiV1AiDashscopeImageEditPost**](AIDashScopeApi.md#imageeditapiv1aidashscopeimageeditpost) | **POST** /api/v1/ai/dashscope/image/edit | DashScope image editing (standard) |
| [**imageEditSimpleApiV1AiDashscopeImageEditSimplePost**](AIDashScopeApi.md#imageeditsimpleapiv1aidashscopeimageeditsimplepost) | **POST** /api/v1/ai/dashscope/image/edit/simple | Simple DashScope image editing |
| [**imageGenerateApiV1AiDashscopeImageGenerateModelPost**](AIDashScopeApi.md#imagegenerateapiv1aidashscopeimagegeneratemodelpost) | **POST** /api/v1/ai/dashscope/image/generate/{model} | DashScope image generation |
| [**imageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet**](AIDashScopeApi.md#imagetaskstatusapiv1aidashscopeimagetasktaskidget) | **GET** /api/v1/ai/dashscope/image/task/{task_id} | Query image generation task status |
| [**imageToImageApiV1AiDashscopeImageToImagePost**](AIDashScopeApi.md#imagetoimageapiv1aidashscopeimagetoimagepost) | **POST** /api/v1/ai/dashscope/image-to-image | DashScope image-to-image |
| [**videoSynthesisApiV1AiDashscopeVideoSynthesisPost**](AIDashScopeApi.md#videosynthesisapiv1aidashscopevideosynthesispost) | **POST** /api/v1/ai/dashscope/video/synthesis | Submit video synthesis task |
| [**videoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet**](AIDashScopeApi.md#videotaskstatusapiv1aidashscopevideotaskstaskidget) | **GET** /api/v1/ai/dashscope/video/tasks/{task_id} | Query video synthesis task status |
| [**visionChatApiV1AiDashscopeVisionChatPost**](AIDashScopeApi.md#visionchatapiv1aidashscopevisionchatpost) | **POST** /api/v1/ai/dashscope/vision/chat | Vision multi-modal chat |



## audioModelsApiV1AiDashscopeAudioModelsGet

> any audioModelsApiV1AiDashscopeAudioModelsGet()

List supported ASR models

Return the list of supported audio recognition models.

### Example

```ts
import {
  Configuration,
  AIDashScopeApi,
} from '';
import type { AudioModelsApiV1AiDashscopeAudioModelsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AIDashScopeApi();

  try {
    const data = await api.audioModelsApiV1AiDashscopeAudioModelsGet();
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

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## audioRecognizeApiV1AiDashscopeAudioRecognizePost

> any audioRecognizeApiV1AiDashscopeAudioRecognizePost(audioRecognizeRequest)

Audio speech recognition

Recognise speech in audio via DashScope MultiModalConversation ASR.  Uses the DashScope multi-modal-generation HTTP endpoint. Includes token balance check, cost deduction, and conversation recording.

### Example

```ts
import {
  Configuration,
  AIDashScopeApi,
} from '';
import type { AudioRecognizeApiV1AiDashscopeAudioRecognizePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIDashScopeApi(config);

  const body = {
    // AudioRecognizeRequest
    audioRecognizeRequest: ...,
  } satisfies AudioRecognizeApiV1AiDashscopeAudioRecognizePostRequest;

  try {
    const data = await api.audioRecognizeApiV1AiDashscopeAudioRecognizePost(body);
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
| **audioRecognizeRequest** | [AudioRecognizeRequest](AudioRecognizeRequest.md) |  | |

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


## dashscopeChatApiV1AiDashscopeChatPost

> any dashscopeChatApiV1AiDashscopeChatPost(message, model)

DashScope chat completion

### Example

```ts
import {
  Configuration,
  AIDashScopeApi,
} from '';
import type { DashscopeChatApiV1AiDashscopeChatPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIDashScopeApi(config);

  const body = {
    // string
    message: message_example,
    // string (optional)
    model: model_example,
  } satisfies DashscopeChatApiV1AiDashscopeChatPostRequest;

  try {
    const data = await api.dashscopeChatApiV1AiDashscopeChatPost(body);
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
| **model** | `string` |  | [Optional] [Defaults to `&#39;qwen-turbo&#39;`] |

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


## dashscopeStreamApiV1AiDashscopeChatStreamPost

> any dashscopeStreamApiV1AiDashscopeChatStreamPost(message, model)

DashScope streaming chat

### Example

```ts
import {
  Configuration,
  AIDashScopeApi,
} from '';
import type { DashscopeStreamApiV1AiDashscopeChatStreamPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIDashScopeApi(config);

  const body = {
    // string
    message: message_example,
    // string (optional)
    model: model_example,
  } satisfies DashscopeStreamApiV1AiDashscopeChatStreamPostRequest;

  try {
    const data = await api.dashscopeStreamApiV1AiDashscopeChatStreamPost(body);
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
| **model** | `string` |  | [Optional] [Defaults to `&#39;qwen-turbo&#39;`] |

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


## imageEditApiV1AiDashscopeImageEditPost

> any imageEditApiV1AiDashscopeImageEditPost(imageEditBody)

DashScope image editing (standard)

Edit an image using a mask and prompt.  Returns task_id for async models.  For synchronous models (e.g. wan2.1-image-edit) the result image URL is returned directly.

### Example

```ts
import {
  Configuration,
  AIDashScopeApi,
} from '';
import type { ImageEditApiV1AiDashscopeImageEditPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIDashScopeApi(config);

  const body = {
    // ImageEditBody
    imageEditBody: ...,
  } satisfies ImageEditApiV1AiDashscopeImageEditPostRequest;

  try {
    const data = await api.imageEditApiV1AiDashscopeImageEditPost(body);
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
| **imageEditBody** | [ImageEditBody](ImageEditBody.md) |  | |

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


## imageEditSimpleApiV1AiDashscopeImageEditSimplePost

> any imageEditSimpleApiV1AiDashscopeImageEditSimplePost(simpleEditBody)

Simple DashScope image editing

Simple image editing using qwen-image-edit model (background removal, style transfer, etc.).

### Example

```ts
import {
  Configuration,
  AIDashScopeApi,
} from '';
import type { ImageEditSimpleApiV1AiDashscopeImageEditSimplePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIDashScopeApi(config);

  const body = {
    // SimpleEditBody
    simpleEditBody: ...,
  } satisfies ImageEditSimpleApiV1AiDashscopeImageEditSimplePostRequest;

  try {
    const data = await api.imageEditSimpleApiV1AiDashscopeImageEditSimplePost(body);
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
| **simpleEditBody** | [SimpleEditBody](SimpleEditBody.md) |  | |

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


## imageGenerateApiV1AiDashscopeImageGenerateModelPost

> any imageGenerateApiV1AiDashscopeImageGenerateModelPost(model, appApiV1AiDashscopeRouteImageGenerateBody)

DashScope image generation

Submit an async text-to-image task.  When *sync&#x3D;false* (default) only &#x60;&#x60;task_id&#x60;&#x60; is returned; poll with &#x60;&#x60;GET /image/task/{task_id}&#x60;&#x60;. When *sync&#x3D;true* the endpoint polls until the task finishes and returns the image URL(s) directly.

### Example

```ts
import {
  Configuration,
  AIDashScopeApi,
} from '';
import type { ImageGenerateApiV1AiDashscopeImageGenerateModelPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIDashScopeApi(config);

  const body = {
    // string
    model: model_example,
    // AppApiV1AiDashscopeRouteImageGenerateBody
    appApiV1AiDashscopeRouteImageGenerateBody: ...,
  } satisfies ImageGenerateApiV1AiDashscopeImageGenerateModelPostRequest;

  try {
    const data = await api.imageGenerateApiV1AiDashscopeImageGenerateModelPost(body);
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
| **model** | `string` |  | [Defaults to `undefined`] |
| **appApiV1AiDashscopeRouteImageGenerateBody** | [AppApiV1AiDashscopeRouteImageGenerateBody](AppApiV1AiDashscopeRouteImageGenerateBody.md) |  | |

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


## imageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet

> any imageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet(taskId)

Query image generation task status

Poll a DashScope async task; returns status and image URLs when SUCCEEDED.

### Example

```ts
import {
  Configuration,
  AIDashScopeApi,
} from '';
import type { ImageTaskStatusApiV1AiDashscopeImageTaskTaskIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIDashScopeApi(config);

  const body = {
    // string
    taskId: taskId_example,
  } satisfies ImageTaskStatusApiV1AiDashscopeImageTaskTaskIdGetRequest;

  try {
    const data = await api.imageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet(body);
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
| **taskId** | `string` |  | [Defaults to `undefined`] |

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


## imageToImageApiV1AiDashscopeImageToImagePost

> any imageToImageApiV1AiDashscopeImageToImagePost(imageToImageBody)

DashScope image-to-image

Transform an image guided by a text prompt. Returns task_id for async models.

### Example

```ts
import {
  Configuration,
  AIDashScopeApi,
} from '';
import type { ImageToImageApiV1AiDashscopeImageToImagePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIDashScopeApi(config);

  const body = {
    // ImageToImageBody
    imageToImageBody: ...,
  } satisfies ImageToImageApiV1AiDashscopeImageToImagePostRequest;

  try {
    const data = await api.imageToImageApiV1AiDashscopeImageToImagePost(body);
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
| **imageToImageBody** | [ImageToImageBody](ImageToImageBody.md) |  | |

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


## videoSynthesisApiV1AiDashscopeVideoSynthesisPost

> any videoSynthesisApiV1AiDashscopeVideoSynthesisPost(videoSynthesisRequest)

Submit video synthesis task

Submit an async video generation task to DashScope.  Uses the &#x60;&#x60;video_generation&#x60;&#x60; HTTP endpoint with &#x60;&#x60;X-DashScope-Async&#x60;&#x60;. Returns a &#x60;&#x60;task_id&#x60;&#x60;; poll with &#x60;&#x60;GET /video/tasks/{task_id}&#x60;&#x60;.

### Example

```ts
import {
  Configuration,
  AIDashScopeApi,
} from '';
import type { VideoSynthesisApiV1AiDashscopeVideoSynthesisPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIDashScopeApi(config);

  const body = {
    // VideoSynthesisRequest
    videoSynthesisRequest: ...,
  } satisfies VideoSynthesisApiV1AiDashscopeVideoSynthesisPostRequest;

  try {
    const data = await api.videoSynthesisApiV1AiDashscopeVideoSynthesisPost(body);
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
| **videoSynthesisRequest** | [VideoSynthesisRequest](VideoSynthesisRequest.md) |  | |

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


## videoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet

> any videoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet(taskId)

Query video synthesis task status

Query the status / result of an async video synthesis task.

### Example

```ts
import {
  Configuration,
  AIDashScopeApi,
} from '';
import type { VideoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIDashScopeApi(config);

  const body = {
    // string
    taskId: taskId_example,
  } satisfies VideoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGetRequest;

  try {
    const data = await api.videoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet(body);
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
| **taskId** | `string` |  | [Defaults to `undefined`] |

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


## visionChatApiV1AiDashscopeVisionChatPost

> any visionChatApiV1AiDashscopeVisionChatPost(visionChatRequest)

Vision multi-modal chat

Chat with images + text via DashScope MultiModalConversation.  Supports models like &#x60;&#x60;qwen-vl-plus&#x60;&#x60;, &#x60;&#x60;qwen-vl-max&#x60;&#x60;, &#x60;&#x60;qwen-vl-plus-latest&#x60;&#x60;.

### Example

```ts
import {
  Configuration,
  AIDashScopeApi,
} from '';
import type { VisionChatApiV1AiDashscopeVisionChatPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIDashScopeApi(config);

  const body = {
    // VisionChatRequest
    visionChatRequest: ...,
  } satisfies VisionChatApiV1AiDashscopeVisionChatPostRequest;

  try {
    const data = await api.visionChatApiV1AiDashscopeVisionChatPost(body);
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
| **visionChatRequest** | [VisionChatRequest](VisionChatRequest.md) |  | |

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

