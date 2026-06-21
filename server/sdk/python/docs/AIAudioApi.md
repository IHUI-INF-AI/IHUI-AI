# zhs_api.AIAudioApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**audio_chat_api_v1_ai_audio_chat_post**](AIAudioApi.md#audio_chat_api_v1_ai_audio_chat_post) | **POST** /api/v1/ai/audio/chat | Audio chat — voice/text in, text+voice out
[**create_speech_api_v1_ai_audio_speech_post**](AIAudioApi.md#create_speech_api_v1_ai_audio_speech_post) | **POST** /api/v1/ai/audio/speech | Text-to-speech synthesis
[**download_audio_api_v1_ai_audio_audio_download_get**](AIAudioApi.md#download_audio_api_v1_ai_audio_audio_download_get) | **GET** /api/v1/ai/audio/audio/download | Download audio by task_id
[**list_voices_api_v1_ai_audio_voices_get**](AIAudioApi.md#list_voices_api_v1_ai_audio_voices_get) | **GET** /api/v1/ai/audio/voices | List available TTS voices
[**speech_recognize_api_v1_ai_audio_recognize_post**](AIAudioApi.md#speech_recognize_api_v1_ai_audio_recognize_post) | **POST** /api/v1/ai/audio/recognize | Speech recognition (ASR)
[**upload_audio_for_recognition_api_v1_ai_audio_audio_upload_post**](AIAudioApi.md#upload_audio_for_recognition_api_v1_ai_audio_audio_upload_post) | **POST** /api/v1/ai/audio/audio/upload | Upload audio file for speech recognition


# **audio_chat_api_v1_ai_audio_chat_post**
> object audio_chat_api_v1_ai_audio_chat_post(audio_chat_request)

Audio chat — voice/text in, text+voice out

Chat with AI using voice or text, returns text reply and audio reply.

Flow:
1. If audio input: ASR to get text
2. AI chat completion
3. TTS on AI response text

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.audio_chat_request import AudioChatRequest
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.AIAudioApi(api_client)
    audio_chat_request = zhs_api.AudioChatRequest() # AudioChatRequest | 

    try:
        # Audio chat — voice/text in, text+voice out
        api_response = api_instance.audio_chat_api_v1_ai_audio_chat_post(audio_chat_request)
        print("The response of AIAudioApi->audio_chat_api_v1_ai_audio_chat_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIAudioApi->audio_chat_api_v1_ai_audio_chat_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **audio_chat_request** | [**AudioChatRequest**](AudioChatRequest.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **create_speech_api_v1_ai_audio_speech_post**
> object create_speech_api_v1_ai_audio_speech_post(speech_request)

Text-to-speech synthesis

Generate speech audio from text via DashScope CosyVoice.

Returns a downloadable audio file.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.speech_request import SpeechRequest
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.AIAudioApi(api_client)
    speech_request = zhs_api.SpeechRequest() # SpeechRequest | 

    try:
        # Text-to-speech synthesis
        api_response = api_instance.create_speech_api_v1_ai_audio_speech_post(speech_request)
        print("The response of AIAudioApi->create_speech_api_v1_ai_audio_speech_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIAudioApi->create_speech_api_v1_ai_audio_speech_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **speech_request** | [**SpeechRequest**](SpeechRequest.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **download_audio_api_v1_ai_audio_audio_download_get**
> object download_audio_api_v1_ai_audio_audio_download_get(task_id)

Download audio by task_id

Download audio result of an async TTS task.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.AIAudioApi(api_client)
    task_id = 'task_id_example' # str | 

    try:
        # Download audio by task_id
        api_response = api_instance.download_audio_api_v1_ai_audio_audio_download_get(task_id)
        print("The response of AIAudioApi->download_audio_api_v1_ai_audio_audio_download_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIAudioApi->download_audio_api_v1_ai_audio_audio_download_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **task_id** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_voices_api_v1_ai_audio_voices_get**
> object list_voices_api_v1_ai_audio_voices_get()

List available TTS voices

Return curated CosyVoice voice list.

DashScope does not expose a dynamic list-voices API, so we return the
well-known voices that CosyVoice supports.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.AIAudioApi(api_client)

    try:
        # List available TTS voices
        api_response = api_instance.list_voices_api_v1_ai_audio_voices_get()
        print("The response of AIAudioApi->list_voices_api_v1_ai_audio_voices_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIAudioApi->list_voices_api_v1_ai_audio_voices_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **speech_recognize_api_v1_ai_audio_recognize_post**
> object speech_recognize_api_v1_ai_audio_recognize_post(recognize_request)

Speech recognition (ASR)

Recognize speech in audio via DashScope Paraformer or qwen3-asr.

Accepts either a URL or base64-encoded audio data.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.recognize_request import RecognizeRequest
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.AIAudioApi(api_client)
    recognize_request = zhs_api.RecognizeRequest() # RecognizeRequest | 

    try:
        # Speech recognition (ASR)
        api_response = api_instance.speech_recognize_api_v1_ai_audio_recognize_post(recognize_request)
        print("The response of AIAudioApi->speech_recognize_api_v1_ai_audio_recognize_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIAudioApi->speech_recognize_api_v1_ai_audio_recognize_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **recognize_request** | [**RecognizeRequest**](RecognizeRequest.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **upload_audio_for_recognition_api_v1_ai_audio_audio_upload_post**
> object upload_audio_for_recognition_api_v1_ai_audio_audio_upload_post(file, model=model, language=language)

Upload audio file for speech recognition

Upload an audio file and perform speech recognition.

Accepts wav, mp3, pcm, flac, m4a formats.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.AIAudioApi(api_client)
    file = None # bytes | 
    model = 'paraformer-v2' # str |  (optional) (default to 'paraformer-v2')
    language = 'language_example' # str |  (optional)

    try:
        # Upload audio file for speech recognition
        api_response = api_instance.upload_audio_for_recognition_api_v1_ai_audio_audio_upload_post(file, model=model, language=language)
        print("The response of AIAudioApi->upload_audio_for_recognition_api_v1_ai_audio_audio_upload_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIAudioApi->upload_audio_for_recognition_api_v1_ai_audio_audio_upload_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file** | **bytes**|  | 
 **model** | **str**|  | [optional] [default to &#39;paraformer-v2&#39;]
 **language** | **str**|  | [optional] 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

