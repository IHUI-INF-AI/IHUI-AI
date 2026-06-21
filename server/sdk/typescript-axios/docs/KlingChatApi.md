# KlingChatApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**klingImageGenerateApiV1ChatImageGeneratePost**](#klingimagegenerateapiv1chatimagegeneratepost) | **POST** /api/v1/chat/image/generate | Kling text-to-image generation|
|[**klingImageToVideoApiV1ChatVideoImageToVideoPost**](#klingimagetovideoapiv1chatvideoimagetovideopost) | **POST** /api/v1/chat/video/image-to-video | Kling image-to-video generation|
|[**klingLipSyncApiV1ChatVideoLipSyncPost**](#klinglipsyncapiv1chatvideolipsyncpost) | **POST** /api/v1/chat/video/lip-sync | Kling lip-sync video creation|
|[**klingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost**](#klinglipsynconeshotapiv1chatvideolipsynconeshotpost) | **POST** /api/v1/chat/video/lip-sync/one-shot | Kling one-shot lip-sync|
|[**klingQueryTaskApiV1ChatTaskTaskIdGet**](#klingquerytaskapiv1chattasktaskidget) | **GET** /api/v1/chat/task/{task_id} | Query Kling task status|
|[**klingVideoGenerateApiV1ChatVideoGeneratePost**](#klingvideogenerateapiv1chatvideogeneratepost) | **POST** /api/v1/chat/video/generate | Kling text-to-video generation|
|[**klingVideoIdentifyApiV1ChatVideoIdentifyPost**](#klingvideoidentifyapiv1chatvideoidentifypost) | **POST** /api/v1/chat/video/identify | Kling face identification|

# **klingImageGenerateApiV1ChatImageGeneratePost**
> any klingImageGenerateApiV1ChatImageGeneratePost(appApiV1ChatKlingImageGenerateBody)

Submit a text-to-image task.  Returns task_id for polling.

### Example

```typescript
import {
    KlingChatApi,
    Configuration,
    AppApiV1ChatKlingImageGenerateBody
} from './api';

const configuration = new Configuration();
const apiInstance = new KlingChatApi(configuration);

let appApiV1ChatKlingImageGenerateBody: AppApiV1ChatKlingImageGenerateBody; //

const { status, data } = await apiInstance.klingImageGenerateApiV1ChatImageGeneratePost(
    appApiV1ChatKlingImageGenerateBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **appApiV1ChatKlingImageGenerateBody** | **AppApiV1ChatKlingImageGenerateBody**|  | |


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

# **klingImageToVideoApiV1ChatVideoImageToVideoPost**
> any klingImageToVideoApiV1ChatVideoImageToVideoPost(imageToVideoBody)

Submit an image-to-video task.  Returns task_id for polling.

### Example

```typescript
import {
    KlingChatApi,
    Configuration,
    ImageToVideoBody
} from './api';

const configuration = new Configuration();
const apiInstance = new KlingChatApi(configuration);

let imageToVideoBody: ImageToVideoBody; //

const { status, data } = await apiInstance.klingImageToVideoApiV1ChatVideoImageToVideoPost(
    imageToVideoBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imageToVideoBody** | **ImageToVideoBody**|  | |


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

# **klingLipSyncApiV1ChatVideoLipSyncPost**
> any klingLipSyncApiV1ChatVideoLipSyncPost(lipSyncBody)

Create an advanced-lip-sync task.  Polls synchronously up to 5 min, then falls back to background polling.  Returns the final video URL when available, or a pending task reference.

### Example

```typescript
import {
    KlingChatApi,
    Configuration,
    LipSyncBody
} from './api';

const configuration = new Configuration();
const apiInstance = new KlingChatApi(configuration);

let lipSyncBody: LipSyncBody; //

const { status, data } = await apiInstance.klingLipSyncApiV1ChatVideoLipSyncPost(
    lipSyncBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **lipSyncBody** | **LipSyncBody**|  | |


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

# **klingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost**
> any klingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost(lipSyncOneShotBody)

End-to-end: face identification -> create lip-sync task -> sync poll -> persist/charge -> return result.

### Example

```typescript
import {
    KlingChatApi,
    Configuration,
    LipSyncOneShotBody
} from './api';

const configuration = new Configuration();
const apiInstance = new KlingChatApi(configuration);

let lipSyncOneShotBody: LipSyncOneShotBody; //

const { status, data } = await apiInstance.klingLipSyncOneShotApiV1ChatVideoLipSyncOneShotPost(
    lipSyncOneShotBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **lipSyncOneShotBody** | **LipSyncOneShotBody**|  | |


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

# **klingQueryTaskApiV1ChatTaskTaskIdGet**
> any klingQueryTaskApiV1ChatTaskTaskIdGet()

Query status of a Kling async task.  task_type: ``video`` (text2video / image2video), ``image`` (text2image), or ``lip-sync`` (advanced-lip-sync).

### Example

```typescript
import {
    KlingChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new KlingChatApi(configuration);

let taskId: string; // (default to undefined)
let taskType: string; // (optional) (default to 'video')

const { status, data } = await apiInstance.klingQueryTaskApiV1ChatTaskTaskIdGet(
    taskId,
    taskType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **taskId** | [**string**] |  | defaults to undefined|
| **taskType** | [**string**] |  | (optional) defaults to 'video'|


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

# **klingVideoGenerateApiV1ChatVideoGeneratePost**
> any klingVideoGenerateApiV1ChatVideoGeneratePost(videoGenerateBody)

Submit a text-to-video task via Kling API.  Returns task_id for polling.

### Example

```typescript
import {
    KlingChatApi,
    Configuration,
    VideoGenerateBody
} from './api';

const configuration = new Configuration();
const apiInstance = new KlingChatApi(configuration);

let videoGenerateBody: VideoGenerateBody; //

const { status, data } = await apiInstance.klingVideoGenerateApiV1ChatVideoGeneratePost(
    videoGenerateBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoGenerateBody** | **VideoGenerateBody**|  | |


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

# **klingVideoIdentifyApiV1ChatVideoIdentifyPost**
> any klingVideoIdentifyApiV1ChatVideoIdentifyPost()

Proxy face identification: POST /v1/videos/identify-face.  Body: { user_uuid, video_id | video_url (XOR) } Returns session_id and face_data for lip-sync creation.

### Example

```typescript
import {
    KlingChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new KlingChatApi(configuration);

const { status, data } = await apiInstance.klingVideoIdentifyApiV1ChatVideoIdentifyPost();
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

