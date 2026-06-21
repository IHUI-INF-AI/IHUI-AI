# AIAudioApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**audioChatApiV1AiAudioChatPost**](AIAudioApi.md#audiochatapiv1aiaudiochatpost) | **POST** /api/v1/ai/audio/chat | Audio chat — voice/text in, text+voice out |
| [**createSpeechApiV1AiAudioSpeechPost**](AIAudioApi.md#createspeechapiv1aiaudiospeechpost) | **POST** /api/v1/ai/audio/speech | Text-to-speech synthesis |
| [**downloadAudioApiV1AiAudioAudioDownloadGet**](AIAudioApi.md#downloadaudioapiv1aiaudioaudiodownloadget) | **GET** /api/v1/ai/audio/audio/download | Download audio by task_id |
| [**listVoicesApiV1AiAudioVoicesGet**](AIAudioApi.md#listvoicesapiv1aiaudiovoicesget) | **GET** /api/v1/ai/audio/voices | List available TTS voices |
| [**speechRecognizeApiV1AiAudioRecognizePost**](AIAudioApi.md#speechrecognizeapiv1aiaudiorecognizepost) | **POST** /api/v1/ai/audio/recognize | Speech recognition (ASR) |
| [**uploadAudioForRecognitionApiV1AiAudioAudioUploadPost**](AIAudioApi.md#uploadaudioforrecognitionapiv1aiaudioaudiouploadpost) | **POST** /api/v1/ai/audio/audio/upload | Upload audio file for speech recognition |



## audioChatApiV1AiAudioChatPost

> any audioChatApiV1AiAudioChatPost(audioChatRequest)

Audio chat — voice/text in, text+voice out

Chat with AI using voice or text, returns text reply and audio reply.  Flow: 1. If audio input: ASR to get text 2. AI chat completion 3. TTS on AI response text

### Example

```ts
import {
  Configuration,
  AIAudioApi,
} from '';
import type { AudioChatApiV1AiAudioChatPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIAudioApi(config);

  const body = {
    // AudioChatRequest
    audioChatRequest: ...,
  } satisfies AudioChatApiV1AiAudioChatPostRequest;

  try {
    const data = await api.audioChatApiV1AiAudioChatPost(body);
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
| **audioChatRequest** | [AudioChatRequest](AudioChatRequest.md) |  | |

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


## createSpeechApiV1AiAudioSpeechPost

> any createSpeechApiV1AiAudioSpeechPost(speechRequest)

Text-to-speech synthesis

Generate speech audio from text via DashScope CosyVoice.  Returns a downloadable audio file.

### Example

```ts
import {
  Configuration,
  AIAudioApi,
} from '';
import type { CreateSpeechApiV1AiAudioSpeechPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIAudioApi(config);

  const body = {
    // SpeechRequest
    speechRequest: ...,
  } satisfies CreateSpeechApiV1AiAudioSpeechPostRequest;

  try {
    const data = await api.createSpeechApiV1AiAudioSpeechPost(body);
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
| **speechRequest** | [SpeechRequest](SpeechRequest.md) |  | |

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


## downloadAudioApiV1AiAudioAudioDownloadGet

> any downloadAudioApiV1AiAudioAudioDownloadGet(taskId)

Download audio by task_id

Download audio result of an async TTS task.

### Example

```ts
import {
  Configuration,
  AIAudioApi,
} from '';
import type { DownloadAudioApiV1AiAudioAudioDownloadGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIAudioApi(config);

  const body = {
    // string
    taskId: taskId_example,
  } satisfies DownloadAudioApiV1AiAudioAudioDownloadGetRequest;

  try {
    const data = await api.downloadAudioApiV1AiAudioAudioDownloadGet(body);
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


## listVoicesApiV1AiAudioVoicesGet

> any listVoicesApiV1AiAudioVoicesGet()

List available TTS voices

Return curated CosyVoice voice list.  DashScope does not expose a dynamic list-voices API, so we return the well-known voices that CosyVoice supports.

### Example

```ts
import {
  Configuration,
  AIAudioApi,
} from '';
import type { ListVoicesApiV1AiAudioVoicesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIAudioApi(config);

  try {
    const data = await api.listVoicesApiV1AiAudioVoicesGet();
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## speechRecognizeApiV1AiAudioRecognizePost

> any speechRecognizeApiV1AiAudioRecognizePost(recognizeRequest)

Speech recognition (ASR)

Recognize speech in audio via DashScope Paraformer or qwen3-asr.  Accepts either a URL or base64-encoded audio data.

### Example

```ts
import {
  Configuration,
  AIAudioApi,
} from '';
import type { SpeechRecognizeApiV1AiAudioRecognizePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIAudioApi(config);

  const body = {
    // RecognizeRequest
    recognizeRequest: ...,
  } satisfies SpeechRecognizeApiV1AiAudioRecognizePostRequest;

  try {
    const data = await api.speechRecognizeApiV1AiAudioRecognizePost(body);
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
| **recognizeRequest** | [RecognizeRequest](RecognizeRequest.md) |  | |

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


## uploadAudioForRecognitionApiV1AiAudioAudioUploadPost

> any uploadAudioForRecognitionApiV1AiAudioAudioUploadPost(file, model, language)

Upload audio file for speech recognition

Upload an audio file and perform speech recognition.  Accepts wav, mp3, pcm, flac, m4a formats.

### Example

```ts
import {
  Configuration,
  AIAudioApi,
} from '';
import type { UploadAudioForRecognitionApiV1AiAudioAudioUploadPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIAudioApi(config);

  const body = {
    // Blob
    file: BINARY_DATA_HERE,
    // string (optional)
    model: model_example,
    // string (optional)
    language: language_example,
  } satisfies UploadAudioForRecognitionApiV1AiAudioAudioUploadPostRequest;

  try {
    const data = await api.uploadAudioForRecognitionApiV1AiAudioAudioUploadPost(body);
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
| **file** | `Blob` |  | [Defaults to `undefined`] |
| **model** | `string` |  | [Optional] [Defaults to `&#39;paraformer-v2&#39;`] |
| **language** | `string` |  | [Optional] [Defaults to `undefined`] |

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

