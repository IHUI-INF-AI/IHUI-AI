# KlingChatApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**klingImageGenerateApiV1ChatImageGeneratePost**](KlingChatApi.md#klingimagegenerateapiv1chatimagegeneratepost) | **POST** /api/v1/chat/image/generate | Kling text-to-image generation |
| [**klingImageToVideoApiV1ChatVideoImageToVideoPost**](KlingChatApi.md#klingimagetovideoapiv1chatvideoimagetovideopost) | **POST** /api/v1/chat/video/image-to-video | Kling image-to-video generation |
| [**klingLipSyncApiV1ChatVideoLipSyncPost**](KlingChatApi.md#klinglipsyncapiv1chatvideolipsyncpost) | **POST** /api/v1/chat/video/lip-sync | Kling lip-sync video creation |
| [**klingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost**](KlingChatApi.md#klinglipsynconeshotapiv1chatvideolipsynconeshotpost) | **POST** /api/v1/chat/video/lip-sync/one-shot | Kling one-shot lip-sync |
| [**klingQueryTaskApiV1ChatTaskTaskIdGet**](KlingChatApi.md#klingquerytaskapiv1chattasktaskidget) | **GET** /api/v1/chat/task/{task_id} | Query Kling task status |
| [**klingVideoGenerateApiV1ChatVideoGeneratePost**](KlingChatApi.md#klingvideogenerateapiv1chatvideogeneratepost) | **POST** /api/v1/chat/video/generate | Kling text-to-video generation |
| [**klingVideoIdentifyApiV1ChatVideoIdentifyPost**](KlingChatApi.md#klingvideoidentifyapiv1chatvideoidentifypost) | **POST** /api/v1/chat/video/identify | Kling face identification |



## klingImageGenerateApiV1ChatImageGeneratePost

> any klingImageGenerateApiV1ChatImageGeneratePost(appApiV1ChatKlingImageGenerateBody)

Kling text-to-image generation

Submit a text-to-image task.  Returns task_id for polling.

### Example

```ts
import {
  Configuration,
  KlingChatApi,
} from '';
import type { KlingImageGenerateApiV1ChatImageGeneratePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new KlingChatApi(config);

  const body = {
    // AppApiV1ChatKlingImageGenerateBody
    appApiV1ChatKlingImageGenerateBody: ...,
  } satisfies KlingImageGenerateApiV1ChatImageGeneratePostRequest;

  try {
    const data = await api.klingImageGenerateApiV1ChatImageGeneratePost(body);
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
| **appApiV1ChatKlingImageGenerateBody** | [AppApiV1ChatKlingImageGenerateBody](AppApiV1ChatKlingImageGenerateBody.md) |  | |

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


## klingImageToVideoApiV1ChatVideoImageToVideoPost

> any klingImageToVideoApiV1ChatVideoImageToVideoPost(imageToVideoBody)

Kling image-to-video generation

Submit an image-to-video task.  Returns task_id for polling.

### Example

```ts
import {
  Configuration,
  KlingChatApi,
} from '';
import type { KlingImageToVideoApiV1ChatVideoImageToVideoPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new KlingChatApi(config);

  const body = {
    // ImageToVideoBody
    imageToVideoBody: ...,
  } satisfies KlingImageToVideoApiV1ChatVideoImageToVideoPostRequest;

  try {
    const data = await api.klingImageToVideoApiV1ChatVideoImageToVideoPost(body);
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
| **imageToVideoBody** | [ImageToVideoBody](ImageToVideoBody.md) |  | |

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


## klingLipSyncApiV1ChatVideoLipSyncPost

> any klingLipSyncApiV1ChatVideoLipSyncPost(lipSyncBody)

Kling lip-sync video creation

Create an advanced-lip-sync task.  Polls synchronously up to 5 min, then falls back to background polling.  Returns the final video URL when available, or a pending task reference.

### Example

```ts
import {
  Configuration,
  KlingChatApi,
} from '';
import type { KlingLipSyncApiV1ChatVideoLipSyncPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new KlingChatApi();

  const body = {
    // LipSyncBody
    lipSyncBody: ...,
  } satisfies KlingLipSyncApiV1ChatVideoLipSyncPostRequest;

  try {
    const data = await api.klingLipSyncApiV1ChatVideoLipSyncPost(body);
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
| **lipSyncBody** | [LipSyncBody](LipSyncBody.md) |  | |

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


## klingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost

> any klingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost(lipSyncOneShotBody)

Kling one-shot lip-sync

End-to-end: face identification -&gt; create lip-sync task -&gt; sync poll -&gt; persist/charge -&gt; return result.

### Example

```ts
import {
  Configuration,
  KlingChatApi,
} from '';
import type { KlingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new KlingChatApi();

  const body = {
    // LipSyncOneShotBody
    lipSyncOneShotBody: ...,
  } satisfies KlingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPostRequest;

  try {
    const data = await api.klingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost(body);
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
| **lipSyncOneShotBody** | [LipSyncOneShotBody](LipSyncOneShotBody.md) |  | |

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


## klingQueryTaskApiV1ChatTaskTaskIdGet

> any klingQueryTaskApiV1ChatTaskTaskIdGet(taskId, taskType)

Query Kling task status

Query status of a Kling async task.  task_type: &#x60;&#x60;video&#x60;&#x60; (text2video / image2video), &#x60;&#x60;image&#x60;&#x60; (text2image), or &#x60;&#x60;lip-sync&#x60;&#x60; (advanced-lip-sync).

### Example

```ts
import {
  Configuration,
  KlingChatApi,
} from '';
import type { KlingQueryTaskApiV1ChatTaskTaskIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new KlingChatApi(config);

  const body = {
    // string
    taskId: taskId_example,
    // string (optional)
    taskType: taskType_example,
  } satisfies KlingQueryTaskApiV1ChatTaskTaskIdGetRequest;

  try {
    const data = await api.klingQueryTaskApiV1ChatTaskTaskIdGet(body);
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
| **taskType** | `string` |  | [Optional] [Defaults to `&#39;video&#39;`] |

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


## klingVideoGenerateApiV1ChatVideoGeneratePost

> any klingVideoGenerateApiV1ChatVideoGeneratePost(videoGenerateBody)

Kling text-to-video generation

Submit a text-to-video task via Kling API.  Returns task_id for polling.

### Example

```ts
import {
  Configuration,
  KlingChatApi,
} from '';
import type { KlingVideoGenerateApiV1ChatVideoGeneratePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new KlingChatApi(config);

  const body = {
    // VideoGenerateBody
    videoGenerateBody: ...,
  } satisfies KlingVideoGenerateApiV1ChatVideoGeneratePostRequest;

  try {
    const data = await api.klingVideoGenerateApiV1ChatVideoGeneratePost(body);
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
| **videoGenerateBody** | [VideoGenerateBody](VideoGenerateBody.md) |  | |

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


## klingVideoIdentifyApiV1ChatVideoIdentifyPost

> any klingVideoIdentifyApiV1ChatVideoIdentifyPost()

Kling face identification

Proxy face identification: POST /v1/videos/identify-face.  Body: { user_uuid, video_id | video_url (XOR) } Returns session_id and face_data for lip-sync creation.

### Example

```ts
import {
  Configuration,
  KlingChatApi,
} from '';
import type { KlingVideoIdentifyApiV1ChatVideoIdentifyPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new KlingChatApi();

  try {
    const data = await api.klingVideoIdentifyApiV1ChatVideoIdentifyPost();
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

