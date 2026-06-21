# zhs_api.KlingChatApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**kling_image_generate_api_v1_chat_image_generate_post**](KlingChatApi.md#kling_image_generate_api_v1_chat_image_generate_post) | **POST** /api/v1/chat/image/generate | Kling text-to-image generation
[**kling_image_to_video_api_v1_chat_video_image_to_video_post**](KlingChatApi.md#kling_image_to_video_api_v1_chat_video_image_to_video_post) | **POST** /api/v1/chat/video/image-to-video | Kling image-to-video generation
[**kling_lip_sync_api_v1_chat_video_lip_sync_post**](KlingChatApi.md#kling_lip_sync_api_v1_chat_video_lip_sync_post) | **POST** /api/v1/chat/video/lip-sync | Kling lip-sync video creation
[**kling_lip_sync_one_shot_api_v1_chat_video_lip_sync_one_shot_post**](KlingChatApi.md#kling_lip_sync_one_shot_api_v1_chat_video_lip_sync_one_shot_post) | **POST** /api/v1/chat/video/lip-sync/one-shot | Kling one-shot lip-sync
[**kling_query_task_api_v1_chat_task_task_id_get**](KlingChatApi.md#kling_query_task_api_v1_chat_task_task_id_get) | **GET** /api/v1/chat/task/{task_id} | Query Kling task status
[**kling_video_generate_api_v1_chat_video_generate_post**](KlingChatApi.md#kling_video_generate_api_v1_chat_video_generate_post) | **POST** /api/v1/chat/video/generate | Kling text-to-video generation
[**kling_video_identify_api_v1_chat_video_identify_post**](KlingChatApi.md#kling_video_identify_api_v1_chat_video_identify_post) | **POST** /api/v1/chat/video/identify | Kling face identification


# **kling_image_generate_api_v1_chat_image_generate_post**
> object kling_image_generate_api_v1_chat_image_generate_post(app_api_v1_chat_kling_image_generate_body)

Kling text-to-image generation

Submit a text-to-image task.  Returns task_id for polling.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.app_api_v1_chat_kling_image_generate_body import AppApiV1ChatKlingImageGenerateBody
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
    api_instance = zhs_api.KlingChatApi(api_client)
    app_api_v1_chat_kling_image_generate_body = zhs_api.AppApiV1ChatKlingImageGenerateBody() # AppApiV1ChatKlingImageGenerateBody | 

    try:
        # Kling text-to-image generation
        api_response = api_instance.kling_image_generate_api_v1_chat_image_generate_post(app_api_v1_chat_kling_image_generate_body)
        print("The response of KlingChatApi->kling_image_generate_api_v1_chat_image_generate_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling KlingChatApi->kling_image_generate_api_v1_chat_image_generate_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **app_api_v1_chat_kling_image_generate_body** | [**AppApiV1ChatKlingImageGenerateBody**](AppApiV1ChatKlingImageGenerateBody.md)|  | 

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

# **kling_image_to_video_api_v1_chat_video_image_to_video_post**
> object kling_image_to_video_api_v1_chat_video_image_to_video_post(image_to_video_body)

Kling image-to-video generation

Submit an image-to-video task.  Returns task_id for polling.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.image_to_video_body import ImageToVideoBody
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
    api_instance = zhs_api.KlingChatApi(api_client)
    image_to_video_body = zhs_api.ImageToVideoBody() # ImageToVideoBody | 

    try:
        # Kling image-to-video generation
        api_response = api_instance.kling_image_to_video_api_v1_chat_video_image_to_video_post(image_to_video_body)
        print("The response of KlingChatApi->kling_image_to_video_api_v1_chat_video_image_to_video_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling KlingChatApi->kling_image_to_video_api_v1_chat_video_image_to_video_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **image_to_video_body** | [**ImageToVideoBody**](ImageToVideoBody.md)|  | 

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

# **kling_lip_sync_api_v1_chat_video_lip_sync_post**
> object kling_lip_sync_api_v1_chat_video_lip_sync_post(lip_sync_body)

Kling lip-sync video creation

Create an advanced-lip-sync task.  Polls synchronously up to 5 min,
then falls back to background polling.  Returns the final video URL
when available, or a pending task reference.

### Example


```python
import zhs_api
from zhs_api.models.lip_sync_body import LipSyncBody
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
    api_instance = zhs_api.KlingChatApi(api_client)
    lip_sync_body = zhs_api.LipSyncBody() # LipSyncBody | 

    try:
        # Kling lip-sync video creation
        api_response = api_instance.kling_lip_sync_api_v1_chat_video_lip_sync_post(lip_sync_body)
        print("The response of KlingChatApi->kling_lip_sync_api_v1_chat_video_lip_sync_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling KlingChatApi->kling_lip_sync_api_v1_chat_video_lip_sync_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **lip_sync_body** | [**LipSyncBody**](LipSyncBody.md)|  | 

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

# **kling_lip_sync_one_shot_api_v1_chat_video_lip_sync_one_shot_post**
> object kling_lip_sync_one_shot_api_v1_chat_video_lip_sync_one_shot_post(lip_sync_one_shot_body)

Kling one-shot lip-sync

End-to-end: face identification -> create lip-sync task -> sync poll -> persist/charge -> return result.

### Example


```python
import zhs_api
from zhs_api.models.lip_sync_one_shot_body import LipSyncOneShotBody
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
    api_instance = zhs_api.KlingChatApi(api_client)
    lip_sync_one_shot_body = zhs_api.LipSyncOneShotBody() # LipSyncOneShotBody | 

    try:
        # Kling one-shot lip-sync
        api_response = api_instance.kling_lip_sync_one_shot_api_v1_chat_video_lip_sync_one_shot_post(lip_sync_one_shot_body)
        print("The response of KlingChatApi->kling_lip_sync_one_shot_api_v1_chat_video_lip_sync_one_shot_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling KlingChatApi->kling_lip_sync_one_shot_api_v1_chat_video_lip_sync_one_shot_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **lip_sync_one_shot_body** | [**LipSyncOneShotBody**](LipSyncOneShotBody.md)|  | 

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

# **kling_query_task_api_v1_chat_task_task_id_get**
> object kling_query_task_api_v1_chat_task_task_id_get(task_id, task_type=task_type)

Query Kling task status

Query status of a Kling async task.

task_type: ``video`` (text2video / image2video), ``image`` (text2image),
or ``lip-sync`` (advanced-lip-sync).

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
    api_instance = zhs_api.KlingChatApi(api_client)
    task_id = 'task_id_example' # str | 
    task_type = 'video' # str |  (optional) (default to 'video')

    try:
        # Query Kling task status
        api_response = api_instance.kling_query_task_api_v1_chat_task_task_id_get(task_id, task_type=task_type)
        print("The response of KlingChatApi->kling_query_task_api_v1_chat_task_task_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling KlingChatApi->kling_query_task_api_v1_chat_task_task_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **task_id** | **str**|  | 
 **task_type** | **str**|  | [optional] [default to &#39;video&#39;]

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

# **kling_video_generate_api_v1_chat_video_generate_post**
> object kling_video_generate_api_v1_chat_video_generate_post(video_generate_body)

Kling text-to-video generation

Submit a text-to-video task via Kling API.  Returns task_id for polling.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.video_generate_body import VideoGenerateBody
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
    api_instance = zhs_api.KlingChatApi(api_client)
    video_generate_body = zhs_api.VideoGenerateBody() # VideoGenerateBody | 

    try:
        # Kling text-to-video generation
        api_response = api_instance.kling_video_generate_api_v1_chat_video_generate_post(video_generate_body)
        print("The response of KlingChatApi->kling_video_generate_api_v1_chat_video_generate_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling KlingChatApi->kling_video_generate_api_v1_chat_video_generate_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_generate_body** | [**VideoGenerateBody**](VideoGenerateBody.md)|  | 

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

# **kling_video_identify_api_v1_chat_video_identify_post**
> object kling_video_identify_api_v1_chat_video_identify_post()

Kling face identification

Proxy face identification: POST /v1/videos/identify-face.

Body: { user_uuid, video_id | video_url (XOR) }
Returns session_id and face_data for lip-sync creation.

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
    api_instance = zhs_api.KlingChatApi(api_client)

    try:
        # Kling face identification
        api_response = api_instance.kling_video_identify_api_v1_chat_video_identify_post()
        print("The response of KlingChatApi->kling_video_identify_api_v1_chat_video_identify_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling KlingChatApi->kling_video_identify_api_v1_chat_video_identify_post: %s\n" % e)
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

