# AiAudioApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**audioChatApiV1AiAudioChatPost**](AiAudioApi.md#audioChatApiV1AiAudioChatPost) | **POST** /api/v1/ai/audio/chat | Audio chat — voice/text in, text+voice out |
| [**createSpeechApiV1AiAudioSpeechPost**](AiAudioApi.md#createSpeechApiV1AiAudioSpeechPost) | **POST** /api/v1/ai/audio/speech | Text-to-speech synthesis |
| [**downloadAudioApiV1AiAudioAudioDownloadGet**](AiAudioApi.md#downloadAudioApiV1AiAudioAudioDownloadGet) | **GET** /api/v1/ai/audio/audio/download | Download audio by task_id |
| [**listVoicesApiV1AiAudioVoicesGet**](AiAudioApi.md#listVoicesApiV1AiAudioVoicesGet) | **GET** /api/v1/ai/audio/voices | List available TTS voices |
| [**speechRecognizeApiV1AiAudioRecognizePost**](AiAudioApi.md#speechRecognizeApiV1AiAudioRecognizePost) | **POST** /api/v1/ai/audio/recognize | Speech recognition (ASR) |
| [**uploadAudioForRecognitionApiV1AiAudioAudioUploadPost**](AiAudioApi.md#uploadAudioForRecognitionApiV1AiAudioAudioUploadPost) | **POST** /api/v1/ai/audio/audio/upload | Upload audio file for speech recognition |


<a id="audioChatApiV1AiAudioChatPost"></a>
# **audioChatApiV1AiAudioChatPost**
> Object audioChatApiV1AiAudioChatPost(audioChatRequest)

Audio chat — voice/text in, text+voice out

Chat with AI using voice or text, returns text reply and audio reply.  Flow: 1. If audio input: ASR to get text 2. AI chat completion 3. TTS on AI response text

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiAudioApi apiInstance = new AiAudioApi(defaultClient);
    AudioChatRequest audioChatRequest = new AudioChatRequest(); // AudioChatRequest | 
    try {
      Object result = apiInstance.audioChatApiV1AiAudioChatPost(audioChatRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiAudioApi#audioChatApiV1AiAudioChatPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **audioChatRequest** | [**AudioChatRequest**](AudioChatRequest.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createSpeechApiV1AiAudioSpeechPost"></a>
# **createSpeechApiV1AiAudioSpeechPost**
> Object createSpeechApiV1AiAudioSpeechPost(speechRequest)

Text-to-speech synthesis

Generate speech audio from text via DashScope CosyVoice.  Returns a downloadable audio file.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiAudioApi apiInstance = new AiAudioApi(defaultClient);
    SpeechRequest speechRequest = new SpeechRequest(); // SpeechRequest | 
    try {
      Object result = apiInstance.createSpeechApiV1AiAudioSpeechPost(speechRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiAudioApi#createSpeechApiV1AiAudioSpeechPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **speechRequest** | [**SpeechRequest**](SpeechRequest.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="downloadAudioApiV1AiAudioAudioDownloadGet"></a>
# **downloadAudioApiV1AiAudioAudioDownloadGet**
> Object downloadAudioApiV1AiAudioAudioDownloadGet(taskId)

Download audio by task_id

Download audio result of an async TTS task.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiAudioApi apiInstance = new AiAudioApi(defaultClient);
    String taskId = "taskId_example"; // String | 
    try {
      Object result = apiInstance.downloadAudioApiV1AiAudioAudioDownloadGet(taskId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiAudioApi#downloadAudioApiV1AiAudioAudioDownloadGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **taskId** | **String**|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listVoicesApiV1AiAudioVoicesGet"></a>
# **listVoicesApiV1AiAudioVoicesGet**
> Object listVoicesApiV1AiAudioVoicesGet()

List available TTS voices

Return curated CosyVoice voice list.  DashScope does not expose a dynamic list-voices API, so we return the well-known voices that CosyVoice supports.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiAudioApi apiInstance = new AiAudioApi(defaultClient);
    try {
      Object result = apiInstance.listVoicesApiV1AiAudioVoicesGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiAudioApi#listVoicesApiV1AiAudioVoicesGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="speechRecognizeApiV1AiAudioRecognizePost"></a>
# **speechRecognizeApiV1AiAudioRecognizePost**
> Object speechRecognizeApiV1AiAudioRecognizePost(recognizeRequest)

Speech recognition (ASR)

Recognize speech in audio via DashScope Paraformer or qwen3-asr.  Accepts either a URL or base64-encoded audio data.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiAudioApi apiInstance = new AiAudioApi(defaultClient);
    RecognizeRequest recognizeRequest = new RecognizeRequest(); // RecognizeRequest | 
    try {
      Object result = apiInstance.speechRecognizeApiV1AiAudioRecognizePost(recognizeRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiAudioApi#speechRecognizeApiV1AiAudioRecognizePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **recognizeRequest** | [**RecognizeRequest**](RecognizeRequest.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="uploadAudioForRecognitionApiV1AiAudioAudioUploadPost"></a>
# **uploadAudioForRecognitionApiV1AiAudioAudioUploadPost**
> Object uploadAudioForRecognitionApiV1AiAudioAudioUploadPost(_file, model, language)

Upload audio file for speech recognition

Upload an audio file and perform speech recognition.  Accepts wav, mp3, pcm, flac, m4a formats.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiAudioApi apiInstance = new AiAudioApi(defaultClient);
    File _file = new File("/path/to/file"); // File | 
    String model = "paraformer-v2"; // String | 
    String language = "language_example"; // String | 
    try {
      Object result = apiInstance.uploadAudioForRecognitionApiV1AiAudioAudioUploadPost(_file, model, language);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiAudioApi#uploadAudioForRecognitionApiV1AiAudioAudioUploadPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **_file** | **File**|  | |
| **model** | **String**|  | [optional] [default to paraformer-v2] |
| **language** | **String**|  | [optional] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

