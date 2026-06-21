# zhs_api.AIVoiceprintApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**add_voiceprint_api_v1_ai_audio_groups_group_id_users_post**](AIVoiceprintApi.md#add_voiceprint_api_v1_ai_audio_groups_group_id_users_post) | **POST** /api/v1/ai/audio/groups/{group_id}/users | Add voiceprint to group
[**add_voiceprint_upload_api_v1_ai_audio_groups_group_id_users_upload_post**](AIVoiceprintApi.md#add_voiceprint_upload_api_v1_ai_audio_groups_group_id_users_upload_post) | **POST** /api/v1/ai/audio/groups/{group_id}/users/upload | Add voiceprint via file upload
[**create_voiceprint_group_api_v1_ai_audio_groups_create_post**](AIVoiceprintApi.md#create_voiceprint_group_api_v1_ai_audio_groups_create_post) | **POST** /api/v1/ai/audio/groups/create | Create voiceprint group
[**delete_voiceprint_api_v1_ai_audio_groups_group_id_users_feature_id_delete**](AIVoiceprintApi.md#delete_voiceprint_api_v1_ai_audio_groups_group_id_users_feature_id_delete) | **DELETE** /api/v1/ai/audio/groups/{group_id}/users/{feature_id} | Delete voiceprint from group
[**identify_speaker_api_v1_ai_audio_identify_post**](AIVoiceprintApi.md#identify_speaker_api_v1_ai_audio_identify_post) | **POST** /api/v1/ai/audio/identify | Identify speaker from audio
[**identify_speaker_upload_api_v1_ai_audio_groups_group_id_identify_post**](AIVoiceprintApi.md#identify_speaker_upload_api_v1_ai_audio_groups_group_id_identify_post) | **POST** /api/v1/ai/audio/groups/{group_id}/identify | Identify speaker (file upload)
[**list_voiceprint_groups_api_v1_ai_audio_groups_list_get**](AIVoiceprintApi.md#list_voiceprint_groups_api_v1_ai_audio_groups_list_get) | **GET** /api/v1/ai/audio/groups/list | List voiceprint groups
[**list_voiceprints_api_v1_ai_audio_groups_group_id_users_get**](AIVoiceprintApi.md#list_voiceprints_api_v1_ai_audio_groups_group_id_users_get) | **GET** /api/v1/ai/audio/groups/{group_id}/users | List voiceprints in group


# **add_voiceprint_api_v1_ai_audio_groups_group_id_users_post**
> object add_voiceprint_api_v1_ai_audio_groups_group_id_users_post(group_id, voiceprint_feature_create)

Add voiceprint to group

Add a voiceprint feature (speaker profile) to a group.

Provide either audio_url or audio_base64 containing the speaker's voice sample.
The audio will be processed by DashScope to extract voice characteristics.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.voiceprint_feature_create import VoiceprintFeatureCreate
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
    api_instance = zhs_api.AIVoiceprintApi(api_client)
    group_id = 'group_id_example' # str | 
    voiceprint_feature_create = zhs_api.VoiceprintFeatureCreate() # VoiceprintFeatureCreate | 

    try:
        # Add voiceprint to group
        api_response = api_instance.add_voiceprint_api_v1_ai_audio_groups_group_id_users_post(group_id, voiceprint_feature_create)
        print("The response of AIVoiceprintApi->add_voiceprint_api_v1_ai_audio_groups_group_id_users_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIVoiceprintApi->add_voiceprint_api_v1_ai_audio_groups_group_id_users_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **group_id** | **str**|  | 
 **voiceprint_feature_create** | [**VoiceprintFeatureCreate**](VoiceprintFeatureCreate.md)|  | 

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

# **add_voiceprint_upload_api_v1_ai_audio_groups_group_id_users_upload_post**
> object add_voiceprint_upload_api_v1_ai_audio_groups_group_id_users_upload_post(group_id, file, name, desc=desc)

Add voiceprint via file upload

Add a voiceprint feature by uploading an audio file.

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
    api_instance = zhs_api.AIVoiceprintApi(api_client)
    group_id = 'group_id_example' # str | 
    file = None # bytes | 
    name = 'name_example' # str | 
    desc = 'desc_example' # str |  (optional)

    try:
        # Add voiceprint via file upload
        api_response = api_instance.add_voiceprint_upload_api_v1_ai_audio_groups_group_id_users_upload_post(group_id, file, name, desc=desc)
        print("The response of AIVoiceprintApi->add_voiceprint_upload_api_v1_ai_audio_groups_group_id_users_upload_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIVoiceprintApi->add_voiceprint_upload_api_v1_ai_audio_groups_group_id_users_upload_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **group_id** | **str**|  | 
 **file** | **bytes**|  | 
 **name** | **str**|  | 
 **desc** | **str**|  | [optional] 

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

# **create_voiceprint_group_api_v1_ai_audio_groups_create_post**
> object create_voiceprint_group_api_v1_ai_audio_groups_create_post(voiceprint_group_create)

Create voiceprint group

Create a new voiceprint group for organizing speaker profiles.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.voiceprint_group_create import VoiceprintGroupCreate
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
    api_instance = zhs_api.AIVoiceprintApi(api_client)
    voiceprint_group_create = zhs_api.VoiceprintGroupCreate() # VoiceprintGroupCreate | 

    try:
        # Create voiceprint group
        api_response = api_instance.create_voiceprint_group_api_v1_ai_audio_groups_create_post(voiceprint_group_create)
        print("The response of AIVoiceprintApi->create_voiceprint_group_api_v1_ai_audio_groups_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIVoiceprintApi->create_voiceprint_group_api_v1_ai_audio_groups_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **voiceprint_group_create** | [**VoiceprintGroupCreate**](VoiceprintGroupCreate.md)|  | 

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

# **delete_voiceprint_api_v1_ai_audio_groups_group_id_users_feature_id_delete**
> object delete_voiceprint_api_v1_ai_audio_groups_group_id_users_feature_id_delete(group_id, feature_id)

Delete voiceprint from group

Delete a voiceprint feature from a group.

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
    api_instance = zhs_api.AIVoiceprintApi(api_client)
    group_id = 'group_id_example' # str | 
    feature_id = 'feature_id_example' # str | 

    try:
        # Delete voiceprint from group
        api_response = api_instance.delete_voiceprint_api_v1_ai_audio_groups_group_id_users_feature_id_delete(group_id, feature_id)
        print("The response of AIVoiceprintApi->delete_voiceprint_api_v1_ai_audio_groups_group_id_users_feature_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIVoiceprintApi->delete_voiceprint_api_v1_ai_audio_groups_group_id_users_feature_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **group_id** | **str**|  | 
 **feature_id** | **str**|  | 

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

# **identify_speaker_api_v1_ai_audio_identify_post**
> object identify_speaker_api_v1_ai_audio_identify_post(speaker_identify_request)

Identify speaker from audio

Identify a speaker by comparing audio against voiceprint group features.

Uses DashScope ASR to transcribe the audio, then compares against
registered voiceprints in the specified group.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.speaker_identify_request import SpeakerIdentifyRequest
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
    api_instance = zhs_api.AIVoiceprintApi(api_client)
    speaker_identify_request = zhs_api.SpeakerIdentifyRequest() # SpeakerIdentifyRequest | 

    try:
        # Identify speaker from audio
        api_response = api_instance.identify_speaker_api_v1_ai_audio_identify_post(speaker_identify_request)
        print("The response of AIVoiceprintApi->identify_speaker_api_v1_ai_audio_identify_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIVoiceprintApi->identify_speaker_api_v1_ai_audio_identify_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **speaker_identify_request** | [**SpeakerIdentifyRequest**](SpeakerIdentifyRequest.md)|  | 

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

# **identify_speaker_upload_api_v1_ai_audio_groups_group_id_identify_post**
> object identify_speaker_upload_api_v1_ai_audio_groups_group_id_identify_post(group_id, file)

Identify speaker (file upload)

Identify a speaker by uploading an audio file.

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
    api_instance = zhs_api.AIVoiceprintApi(api_client)
    group_id = 'group_id_example' # str | 
    file = None # bytes | 

    try:
        # Identify speaker (file upload)
        api_response = api_instance.identify_speaker_upload_api_v1_ai_audio_groups_group_id_identify_post(group_id, file)
        print("The response of AIVoiceprintApi->identify_speaker_upload_api_v1_ai_audio_groups_group_id_identify_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIVoiceprintApi->identify_speaker_upload_api_v1_ai_audio_groups_group_id_identify_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **group_id** | **str**|  | 
 **file** | **bytes**|  | 

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

# **list_voiceprint_groups_api_v1_ai_audio_groups_list_get**
> object list_voiceprint_groups_api_v1_ai_audio_groups_list_get()

List voiceprint groups

List all voiceprint groups.

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
    api_instance = zhs_api.AIVoiceprintApi(api_client)

    try:
        # List voiceprint groups
        api_response = api_instance.list_voiceprint_groups_api_v1_ai_audio_groups_list_get()
        print("The response of AIVoiceprintApi->list_voiceprint_groups_api_v1_ai_audio_groups_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIVoiceprintApi->list_voiceprint_groups_api_v1_ai_audio_groups_list_get: %s\n" % e)
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

# **list_voiceprints_api_v1_ai_audio_groups_group_id_users_get**
> object list_voiceprints_api_v1_ai_audio_groups_group_id_users_get(group_id)

List voiceprints in group

List all voiceprint features in a group.

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
    api_instance = zhs_api.AIVoiceprintApi(api_client)
    group_id = 'group_id_example' # str | 

    try:
        # List voiceprints in group
        api_response = api_instance.list_voiceprints_api_v1_ai_audio_groups_group_id_users_get(group_id)
        print("The response of AIVoiceprintApi->list_voiceprints_api_v1_ai_audio_groups_group_id_users_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIVoiceprintApi->list_voiceprints_api_v1_ai_audio_groups_group_id_users_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **group_id** | **str**|  | 

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

