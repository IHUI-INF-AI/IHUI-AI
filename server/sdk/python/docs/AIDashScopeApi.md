# zhs_api.AIDashScopeApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**audio_models_api_v1_ai_dashscope_audio_models_get**](AIDashScopeApi.md#audio_models_api_v1_ai_dashscope_audio_models_get) | **GET** /api/v1/ai/dashscope/audio/models | List supported ASR models
[**audio_recognize_api_v1_ai_dashscope_audio_recognize_post**](AIDashScopeApi.md#audio_recognize_api_v1_ai_dashscope_audio_recognize_post) | **POST** /api/v1/ai/dashscope/audio/recognize | Audio speech recognition
[**dashscope_chat_api_v1_ai_dashscope_chat_post**](AIDashScopeApi.md#dashscope_chat_api_v1_ai_dashscope_chat_post) | **POST** /api/v1/ai/dashscope/chat | DashScope chat completion
[**dashscope_stream_api_v1_ai_dashscope_chat_stream_post**](AIDashScopeApi.md#dashscope_stream_api_v1_ai_dashscope_chat_stream_post) | **POST** /api/v1/ai/dashscope/chat/stream | DashScope streaming chat
[**image_edit_api_v1_ai_dashscope_image_edit_post**](AIDashScopeApi.md#image_edit_api_v1_ai_dashscope_image_edit_post) | **POST** /api/v1/ai/dashscope/image/edit | DashScope image editing (standard)
[**image_edit_simple_api_v1_ai_dashscope_image_edit_simple_post**](AIDashScopeApi.md#image_edit_simple_api_v1_ai_dashscope_image_edit_simple_post) | **POST** /api/v1/ai/dashscope/image/edit/simple | Simple DashScope image editing
[**image_generate_api_v1_ai_dashscope_image_generate_model_post**](AIDashScopeApi.md#image_generate_api_v1_ai_dashscope_image_generate_model_post) | **POST** /api/v1/ai/dashscope/image/generate/{model} | DashScope image generation
[**image_task_status_api_v1_ai_dashscope_image_task_task_id_get**](AIDashScopeApi.md#image_task_status_api_v1_ai_dashscope_image_task_task_id_get) | **GET** /api/v1/ai/dashscope/image/task/{task_id} | Query image generation task status
[**image_to_image_api_v1_ai_dashscope_image_to_image_post**](AIDashScopeApi.md#image_to_image_api_v1_ai_dashscope_image_to_image_post) | **POST** /api/v1/ai/dashscope/image-to-image | DashScope image-to-image
[**video_synthesis_api_v1_ai_dashscope_video_synthesis_post**](AIDashScopeApi.md#video_synthesis_api_v1_ai_dashscope_video_synthesis_post) | **POST** /api/v1/ai/dashscope/video/synthesis | Submit video synthesis task
[**video_task_status_api_v1_ai_dashscope_video_tasks_task_id_get**](AIDashScopeApi.md#video_task_status_api_v1_ai_dashscope_video_tasks_task_id_get) | **GET** /api/v1/ai/dashscope/video/tasks/{task_id} | Query video synthesis task status
[**vision_chat_api_v1_ai_dashscope_vision_chat_post**](AIDashScopeApi.md#vision_chat_api_v1_ai_dashscope_vision_chat_post) | **POST** /api/v1/ai/dashscope/vision/chat | Vision multi-modal chat


# **audio_models_api_v1_ai_dashscope_audio_models_get**
> object audio_models_api_v1_ai_dashscope_audio_models_get()

List supported ASR models

Return the list of supported audio recognition models.

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
    api_instance = zhs_api.AIDashScopeApi(api_client)

    try:
        # List supported ASR models
        api_response = api_instance.audio_models_api_v1_ai_dashscope_audio_models_get()
        print("The response of AIDashScopeApi->audio_models_api_v1_ai_dashscope_audio_models_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIDashScopeApi->audio_models_api_v1_ai_dashscope_audio_models_get: %s\n" % e)
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

# **audio_recognize_api_v1_ai_dashscope_audio_recognize_post**
> object audio_recognize_api_v1_ai_dashscope_audio_recognize_post(audio_recognize_request)

Audio speech recognition

Recognise speech in audio via DashScope MultiModalConversation ASR.

Uses the DashScope multi-modal-generation HTTP endpoint.
Includes token balance check, cost deduction, and conversation recording.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.audio_recognize_request import AudioRecognizeRequest
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
    api_instance = zhs_api.AIDashScopeApi(api_client)
    audio_recognize_request = zhs_api.AudioRecognizeRequest() # AudioRecognizeRequest | 

    try:
        # Audio speech recognition
        api_response = api_instance.audio_recognize_api_v1_ai_dashscope_audio_recognize_post(audio_recognize_request)
        print("The response of AIDashScopeApi->audio_recognize_api_v1_ai_dashscope_audio_recognize_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIDashScopeApi->audio_recognize_api_v1_ai_dashscope_audio_recognize_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **audio_recognize_request** | [**AudioRecognizeRequest**](AudioRecognizeRequest.md)|  | 

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

# **dashscope_chat_api_v1_ai_dashscope_chat_post**
> object dashscope_chat_api_v1_ai_dashscope_chat_post(message, model=model)

DashScope chat completion

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
    api_instance = zhs_api.AIDashScopeApi(api_client)
    message = 'message_example' # str | 
    model = 'qwen-turbo' # str |  (optional) (default to 'qwen-turbo')

    try:
        # DashScope chat completion
        api_response = api_instance.dashscope_chat_api_v1_ai_dashscope_chat_post(message, model=model)
        print("The response of AIDashScopeApi->dashscope_chat_api_v1_ai_dashscope_chat_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIDashScopeApi->dashscope_chat_api_v1_ai_dashscope_chat_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **message** | **str**|  | 
 **model** | **str**|  | [optional] [default to &#39;qwen-turbo&#39;]

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

# **dashscope_stream_api_v1_ai_dashscope_chat_stream_post**
> object dashscope_stream_api_v1_ai_dashscope_chat_stream_post(message, model=model)

DashScope streaming chat

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
    api_instance = zhs_api.AIDashScopeApi(api_client)
    message = 'message_example' # str | 
    model = 'qwen-turbo' # str |  (optional) (default to 'qwen-turbo')

    try:
        # DashScope streaming chat
        api_response = api_instance.dashscope_stream_api_v1_ai_dashscope_chat_stream_post(message, model=model)
        print("The response of AIDashScopeApi->dashscope_stream_api_v1_ai_dashscope_chat_stream_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIDashScopeApi->dashscope_stream_api_v1_ai_dashscope_chat_stream_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **message** | **str**|  | 
 **model** | **str**|  | [optional] [default to &#39;qwen-turbo&#39;]

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

# **image_edit_api_v1_ai_dashscope_image_edit_post**
> object image_edit_api_v1_ai_dashscope_image_edit_post(image_edit_body)

DashScope image editing (standard)

Edit an image using a mask and prompt.  Returns task_id for async models.

For synchronous models (e.g. wan2.1-image-edit) the result image URL is
returned directly.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.image_edit_body import ImageEditBody
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
    api_instance = zhs_api.AIDashScopeApi(api_client)
    image_edit_body = zhs_api.ImageEditBody() # ImageEditBody | 

    try:
        # DashScope image editing (standard)
        api_response = api_instance.image_edit_api_v1_ai_dashscope_image_edit_post(image_edit_body)
        print("The response of AIDashScopeApi->image_edit_api_v1_ai_dashscope_image_edit_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIDashScopeApi->image_edit_api_v1_ai_dashscope_image_edit_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **image_edit_body** | [**ImageEditBody**](ImageEditBody.md)|  | 

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

# **image_edit_simple_api_v1_ai_dashscope_image_edit_simple_post**
> object image_edit_simple_api_v1_ai_dashscope_image_edit_simple_post(simple_edit_body)

Simple DashScope image editing

Simple image editing using qwen-image-edit model (background removal, style transfer, etc.).

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.simple_edit_body import SimpleEditBody
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
    api_instance = zhs_api.AIDashScopeApi(api_client)
    simple_edit_body = zhs_api.SimpleEditBody() # SimpleEditBody | 

    try:
        # Simple DashScope image editing
        api_response = api_instance.image_edit_simple_api_v1_ai_dashscope_image_edit_simple_post(simple_edit_body)
        print("The response of AIDashScopeApi->image_edit_simple_api_v1_ai_dashscope_image_edit_simple_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIDashScopeApi->image_edit_simple_api_v1_ai_dashscope_image_edit_simple_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **simple_edit_body** | [**SimpleEditBody**](SimpleEditBody.md)|  | 

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

# **image_generate_api_v1_ai_dashscope_image_generate_model_post**
> object image_generate_api_v1_ai_dashscope_image_generate_model_post(model, app_api_v1_ai_dashscope_route_image_generate_body)

DashScope image generation

Submit an async text-to-image task.

When *sync=false* (default) only ``task_id`` is returned; poll with
``GET /image/task/{task_id}``.
When *sync=true* the endpoint polls until the task finishes and returns
the image URL(s) directly.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.app_api_v1_ai_dashscope_route_image_generate_body import AppApiV1AiDashscopeRouteImageGenerateBody
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
    api_instance = zhs_api.AIDashScopeApi(api_client)
    model = 'model_example' # str | 
    app_api_v1_ai_dashscope_route_image_generate_body = zhs_api.AppApiV1AiDashscopeRouteImageGenerateBody() # AppApiV1AiDashscopeRouteImageGenerateBody | 

    try:
        # DashScope image generation
        api_response = api_instance.image_generate_api_v1_ai_dashscope_image_generate_model_post(model, app_api_v1_ai_dashscope_route_image_generate_body)
        print("The response of AIDashScopeApi->image_generate_api_v1_ai_dashscope_image_generate_model_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIDashScopeApi->image_generate_api_v1_ai_dashscope_image_generate_model_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **model** | **str**|  | 
 **app_api_v1_ai_dashscope_route_image_generate_body** | [**AppApiV1AiDashscopeRouteImageGenerateBody**](AppApiV1AiDashscopeRouteImageGenerateBody.md)|  | 

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

# **image_task_status_api_v1_ai_dashscope_image_task_task_id_get**
> object image_task_status_api_v1_ai_dashscope_image_task_task_id_get(task_id)

Query image generation task status

Poll a DashScope async task; returns status and image URLs when SUCCEEDED.

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
    api_instance = zhs_api.AIDashScopeApi(api_client)
    task_id = 'task_id_example' # str | 

    try:
        # Query image generation task status
        api_response = api_instance.image_task_status_api_v1_ai_dashscope_image_task_task_id_get(task_id)
        print("The response of AIDashScopeApi->image_task_status_api_v1_ai_dashscope_image_task_task_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIDashScopeApi->image_task_status_api_v1_ai_dashscope_image_task_task_id_get: %s\n" % e)
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

# **image_to_image_api_v1_ai_dashscope_image_to_image_post**
> object image_to_image_api_v1_ai_dashscope_image_to_image_post(image_to_image_body)

DashScope image-to-image

Transform an image guided by a text prompt. Returns task_id for async models.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.image_to_image_body import ImageToImageBody
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
    api_instance = zhs_api.AIDashScopeApi(api_client)
    image_to_image_body = zhs_api.ImageToImageBody() # ImageToImageBody | 

    try:
        # DashScope image-to-image
        api_response = api_instance.image_to_image_api_v1_ai_dashscope_image_to_image_post(image_to_image_body)
        print("The response of AIDashScopeApi->image_to_image_api_v1_ai_dashscope_image_to_image_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIDashScopeApi->image_to_image_api_v1_ai_dashscope_image_to_image_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **image_to_image_body** | [**ImageToImageBody**](ImageToImageBody.md)|  | 

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

# **video_synthesis_api_v1_ai_dashscope_video_synthesis_post**
> object video_synthesis_api_v1_ai_dashscope_video_synthesis_post(video_synthesis_request)

Submit video synthesis task

Submit an async video generation task to DashScope.

Uses the ``video_generation`` HTTP endpoint with ``X-DashScope-Async``.
Returns a ``task_id``; poll with ``GET /video/tasks/{task_id}``.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.video_synthesis_request import VideoSynthesisRequest
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
    api_instance = zhs_api.AIDashScopeApi(api_client)
    video_synthesis_request = zhs_api.VideoSynthesisRequest() # VideoSynthesisRequest | 

    try:
        # Submit video synthesis task
        api_response = api_instance.video_synthesis_api_v1_ai_dashscope_video_synthesis_post(video_synthesis_request)
        print("The response of AIDashScopeApi->video_synthesis_api_v1_ai_dashscope_video_synthesis_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIDashScopeApi->video_synthesis_api_v1_ai_dashscope_video_synthesis_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_synthesis_request** | [**VideoSynthesisRequest**](VideoSynthesisRequest.md)|  | 

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

# **video_task_status_api_v1_ai_dashscope_video_tasks_task_id_get**
> object video_task_status_api_v1_ai_dashscope_video_tasks_task_id_get(task_id)

Query video synthesis task status

Query the status / result of an async video synthesis task.

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
    api_instance = zhs_api.AIDashScopeApi(api_client)
    task_id = 'task_id_example' # str | 

    try:
        # Query video synthesis task status
        api_response = api_instance.video_task_status_api_v1_ai_dashscope_video_tasks_task_id_get(task_id)
        print("The response of AIDashScopeApi->video_task_status_api_v1_ai_dashscope_video_tasks_task_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIDashScopeApi->video_task_status_api_v1_ai_dashscope_video_tasks_task_id_get: %s\n" % e)
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

# **vision_chat_api_v1_ai_dashscope_vision_chat_post**
> object vision_chat_api_v1_ai_dashscope_vision_chat_post(vision_chat_request)

Vision multi-modal chat

Chat with images + text via DashScope MultiModalConversation.

Supports models like ``qwen-vl-plus``, ``qwen-vl-max``, ``qwen-vl-plus-latest``.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.vision_chat_request import VisionChatRequest
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
    api_instance = zhs_api.AIDashScopeApi(api_client)
    vision_chat_request = zhs_api.VisionChatRequest() # VisionChatRequest | 

    try:
        # Vision multi-modal chat
        api_response = api_instance.vision_chat_api_v1_ai_dashscope_vision_chat_post(vision_chat_request)
        print("The response of AIDashScopeApi->vision_chat_api_v1_ai_dashscope_vision_chat_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIDashScopeApi->vision_chat_api_v1_ai_dashscope_vision_chat_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **vision_chat_request** | [**VisionChatRequest**](VisionChatRequest.md)|  | 

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

