# AIAudioApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**audioChatApiV1AiAudioChatPost**](#audiochatapiv1aiaudiochatpost) | **POST** /api/v1/ai/audio/chat | Audio chat — voice/text in, text+voice out|
|[**createSpeechApiV1AiAudioSpeechPost**](#createspeechapiv1aiaudiospeechpost) | **POST** /api/v1/ai/audio/speech | Text-to-speech synthesis|
|[**downloadAudioApiV1AiAudioAudioDownloadGet**](#downloadaudioapiv1aiaudioaudiodownloadget) | **GET** /api/v1/ai/audio/audio/download | Download audio by task_id|
|[**listVoicesApiV1AiAudioVoicesGet**](#listvoicesapiv1aiaudiovoicesget) | **GET** /api/v1/ai/audio/voices | List available TTS voices|
|[**speechRecognizeApiV1AiAudioRecognizePost**](#speechrecognizeapiv1aiaudiorecognizepost) | **POST** /api/v1/ai/audio/recognize | Speech recognition (ASR)|
|[**uploadAudioForRecognitionApiV1AiAudioAudioUploadPost**](#uploadaudioforrecognitionapiv1aiaudioaudiouploadpost) | **POST** /api/v1/ai/audio/audio/upload | Upload audio file for speech recognition|

# **audioChatApiV1AiAudioChatPost**
> any audioChatApiV1AiAudioChatPost(audioChatRequest)

Chat with AI using voice or text, returns text reply and audio reply.  Flow: 1. If audio input: ASR to get text 2. AI chat completion 3. TTS on AI response text

### Example

```typescript
import {
    AIAudioApi,
    Configuration,
    AudioChatRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIAudioApi(configuration);

let audioChatRequest: AudioChatRequest; //

const { status, data } = await apiInstance.audioChatApiV1AiAudioChatPost(
    audioChatRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **audioChatRequest** | **AudioChatRequest**|  | |


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

# **createSpeechApiV1AiAudioSpeechPost**
> any createSpeechApiV1AiAudioSpeechPost(speechRequest)

Generate speech audio from text via DashScope CosyVoice.  Returns a downloadable audio file.

### Example

```typescript
import {
    AIAudioApi,
    Configuration,
    SpeechRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIAudioApi(configuration);

let speechRequest: SpeechRequest; //

const { status, data } = await apiInstance.createSpeechApiV1AiAudioSpeechPost(
    speechRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **speechRequest** | **SpeechRequest**|  | |


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

# **downloadAudioApiV1AiAudioAudioDownloadGet**
> any downloadAudioApiV1AiAudioAudioDownloadGet()

Download audio result of an async TTS task.

### Example

```typescript
import {
    AIAudioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIAudioApi(configuration);

let taskId: string; // (default to undefined)

const { status, data } = await apiInstance.downloadAudioApiV1AiAudioAudioDownloadGet(
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

# **listVoicesApiV1AiAudioVoicesGet**
> any listVoicesApiV1AiAudioVoicesGet()

Return curated CosyVoice voice list.  DashScope does not expose a dynamic list-voices API, so we return the well-known voices that CosyVoice supports.

### Example

```typescript
import {
    AIAudioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIAudioApi(configuration);

const { status, data } = await apiInstance.listVoicesApiV1AiAudioVoicesGet();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **speechRecognizeApiV1AiAudioRecognizePost**
> any speechRecognizeApiV1AiAudioRecognizePost(recognizeRequest)

Recognize speech in audio via DashScope Paraformer or qwen3-asr.  Accepts either a URL or base64-encoded audio data.

### Example

```typescript
import {
    AIAudioApi,
    Configuration,
    RecognizeRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIAudioApi(configuration);

let recognizeRequest: RecognizeRequest; //

const { status, data } = await apiInstance.speechRecognizeApiV1AiAudioRecognizePost(
    recognizeRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **recognizeRequest** | **RecognizeRequest**|  | |


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

# **uploadAudioForRecognitionApiV1AiAudioAudioUploadPost**
> any uploadAudioForRecognitionApiV1AiAudioAudioUploadPost()

Upload an audio file and perform speech recognition.  Accepts wav, mp3, pcm, flac, m4a formats.

### Example

```typescript
import {
    AIAudioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIAudioApi(configuration);

let file: File; // (default to undefined)
let model: string; // (optional) (default to 'paraformer-v2')
let language: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.uploadAudioForRecognitionApiV1AiAudioAudioUploadPost(
    file,
    model,
    language
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **file** | [**File**] |  | defaults to undefined|
| **model** | [**string**] |  | (optional) defaults to 'paraformer-v2'|
| **language** | [**string**] |  | (optional) defaults to undefined|


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

