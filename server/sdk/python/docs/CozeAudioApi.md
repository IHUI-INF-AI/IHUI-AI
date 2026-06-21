# zhs_api.CozeAudioApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**chat_audio_api_v1_coze_audio_audio_chat_audio_post**](CozeAudioApi.md#chat_audio_api_v1_coze_audio_audio_chat_audio_post) | **POST** /api/v1/coze/audio/audio/chat-audio | Chat Audio
[**create_speech_api_v1_coze_audio_audio_speech_post**](CozeAudioApi.md#create_speech_api_v1_coze_audio_audio_speech_post) | **POST** /api/v1/coze/audio/audio/speech | Create Speech
[**create_voiceprint_api_v1_coze_audio_audio_voiceprints_post**](CozeAudioApi.md#create_voiceprint_api_v1_coze_audio_audio_voiceprints_post) | **POST** /api/v1/coze/audio/audio/voiceprints | Create Voiceprint
[**delete_voiceprint_api_v1_coze_audio_audio_voiceprints_delete**](CozeAudioApi.md#delete_voiceprint_api_v1_coze_audio_audio_voiceprints_delete) | **DELETE** /api/v1/coze/audio/audio/voiceprints | Delete Voiceprint
[**list_voiceprints_api_v1_coze_audio_audio_voiceprints_get**](CozeAudioApi.md#list_voiceprints_api_v1_coze_audio_audio_voiceprints_get) | **GET** /api/v1/coze/audio/audio/voiceprints | List Voiceprints
[**list_voices_api_v1_coze_audio_audio_voices_get**](CozeAudioApi.md#list_voices_api_v1_coze_audio_audio_voices_get) | **GET** /api/v1/coze/audio/audio/voices | List Voices
[**update_voiceprint_api_v1_coze_audio_audio_voiceprints_put**](CozeAudioApi.md#update_voiceprint_api_v1_coze_audio_audio_voiceprints_put) | **PUT** /api/v1/coze/audio/audio/voiceprints | Update Voiceprint


# **chat_audio_api_v1_coze_audio_audio_chat_audio_post**
> object chat_audio_api_v1_coze_audio_audio_chat_audio_post(chat_audio_req)

Chat Audio

### Example


```python
import zhs_api
from zhs_api.models.chat_audio_req import ChatAudioReq
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CozeAudioApi(api_client)
    chat_audio_req = zhs_api.ChatAudioReq() # ChatAudioReq | 

    try:
        # Chat Audio
        api_response = api_instance.chat_audio_api_v1_coze_audio_audio_chat_audio_post(chat_audio_req)
        print("The response of CozeAudioApi->chat_audio_api_v1_coze_audio_audio_chat_audio_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeAudioApi->chat_audio_api_v1_coze_audio_audio_chat_audio_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **chat_audio_req** | [**ChatAudioReq**](ChatAudioReq.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **create_speech_api_v1_coze_audio_audio_speech_post**
> object create_speech_api_v1_coze_audio_audio_speech_post(speech_req)

Create Speech

### Example


```python
import zhs_api
from zhs_api.models.speech_req import SpeechReq
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CozeAudioApi(api_client)
    speech_req = zhs_api.SpeechReq() # SpeechReq | 

    try:
        # Create Speech
        api_response = api_instance.create_speech_api_v1_coze_audio_audio_speech_post(speech_req)
        print("The response of CozeAudioApi->create_speech_api_v1_coze_audio_audio_speech_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeAudioApi->create_speech_api_v1_coze_audio_audio_speech_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **speech_req** | [**SpeechReq**](SpeechReq.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **create_voiceprint_api_v1_coze_audio_audio_voiceprints_post**
> object create_voiceprint_api_v1_coze_audio_audio_voiceprints_post(voiceprint_create_req)

Create Voiceprint

### Example


```python
import zhs_api
from zhs_api.models.voiceprint_create_req import VoiceprintCreateReq
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CozeAudioApi(api_client)
    voiceprint_create_req = zhs_api.VoiceprintCreateReq() # VoiceprintCreateReq | 

    try:
        # Create Voiceprint
        api_response = api_instance.create_voiceprint_api_v1_coze_audio_audio_voiceprints_post(voiceprint_create_req)
        print("The response of CozeAudioApi->create_voiceprint_api_v1_coze_audio_audio_voiceprints_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeAudioApi->create_voiceprint_api_v1_coze_audio_audio_voiceprints_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **voiceprint_create_req** | [**VoiceprintCreateReq**](VoiceprintCreateReq.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **delete_voiceprint_api_v1_coze_audio_audio_voiceprints_delete**
> object delete_voiceprint_api_v1_coze_audio_audio_voiceprints_delete(voiceprint_delete_req)

Delete Voiceprint

### Example


```python
import zhs_api
from zhs_api.models.voiceprint_delete_req import VoiceprintDeleteReq
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CozeAudioApi(api_client)
    voiceprint_delete_req = zhs_api.VoiceprintDeleteReq() # VoiceprintDeleteReq | 

    try:
        # Delete Voiceprint
        api_response = api_instance.delete_voiceprint_api_v1_coze_audio_audio_voiceprints_delete(voiceprint_delete_req)
        print("The response of CozeAudioApi->delete_voiceprint_api_v1_coze_audio_audio_voiceprints_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeAudioApi->delete_voiceprint_api_v1_coze_audio_audio_voiceprints_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **voiceprint_delete_req** | [**VoiceprintDeleteReq**](VoiceprintDeleteReq.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_voiceprints_api_v1_coze_audio_audio_voiceprints_get**
> object list_voiceprints_api_v1_coze_audio_audio_voiceprints_get()

List Voiceprints

### Example


```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CozeAudioApi(api_client)

    try:
        # List Voiceprints
        api_response = api_instance.list_voiceprints_api_v1_coze_audio_audio_voiceprints_get()
        print("The response of CozeAudioApi->list_voiceprints_api_v1_coze_audio_audio_voiceprints_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeAudioApi->list_voiceprints_api_v1_coze_audio_audio_voiceprints_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_voices_api_v1_coze_audio_audio_voices_get**
> object list_voices_api_v1_coze_audio_audio_voices_get(filter_type=filter_type)

List Voices

### Example


```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CozeAudioApi(api_client)
    filter_type = 'filter_type_example' # str |  (optional)

    try:
        # List Voices
        api_response = api_instance.list_voices_api_v1_coze_audio_audio_voices_get(filter_type=filter_type)
        print("The response of CozeAudioApi->list_voices_api_v1_coze_audio_audio_voices_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeAudioApi->list_voices_api_v1_coze_audio_audio_voices_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **filter_type** | **str**|  | [optional] 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **update_voiceprint_api_v1_coze_audio_audio_voiceprints_put**
> object update_voiceprint_api_v1_coze_audio_audio_voiceprints_put(voiceprint_update_req)

Update Voiceprint

### Example


```python
import zhs_api
from zhs_api.models.voiceprint_update_req import VoiceprintUpdateReq
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CozeAudioApi(api_client)
    voiceprint_update_req = zhs_api.VoiceprintUpdateReq() # VoiceprintUpdateReq | 

    try:
        # Update Voiceprint
        api_response = api_instance.update_voiceprint_api_v1_coze_audio_audio_voiceprints_put(voiceprint_update_req)
        print("The response of CozeAudioApi->update_voiceprint_api_v1_coze_audio_audio_voiceprints_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeAudioApi->update_voiceprint_api_v1_coze_audio_audio_voiceprints_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **voiceprint_update_req** | [**VoiceprintUpdateReq**](VoiceprintUpdateReq.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

