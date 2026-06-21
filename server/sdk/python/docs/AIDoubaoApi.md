# zhs_api.AIDoubaoApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**doubao_chat_api_v1_ai_doubao_chat_post**](AIDoubaoApi.md#doubao_chat_api_v1_ai_doubao_chat_post) | **POST** /api/v1/ai/doubao/chat | Doubao chat completion
[**doubao_image_edit_api_v1_ai_doubao_image_edit_post**](AIDoubaoApi.md#doubao_image_edit_api_v1_ai_doubao_image_edit_post) | **POST** /api/v1/ai/doubao/image/edit | 豆包图片编辑
[**doubao_image_generate_api_v1_ai_doubao_image_generate_post**](AIDoubaoApi.md#doubao_image_generate_api_v1_ai_doubao_image_generate_post) | **POST** /api/v1/ai/doubao/image/generate | 豆包图片生成 (即梦 jimeng_t2i_v40)
[**doubao_seedream_api_v1_ai_doubao_image_seedream_post**](AIDoubaoApi.md#doubao_seedream_api_v1_ai_doubao_image_seedream_post) | **POST** /api/v1/ai/doubao/image/seedream | Seedream 图片生成
[**doubao_stream_api_v1_ai_doubao_chat_stream_post**](AIDoubaoApi.md#doubao_stream_api_v1_ai_doubao_chat_stream_post) | **POST** /api/v1/ai/doubao/chat/stream | Doubao streaming chat
[**doubao_video_generate_api_v1_ai_doubao_video_generate_post**](AIDoubaoApi.md#doubao_video_generate_api_v1_ai_doubao_video_generate_post) | **POST** /api/v1/ai/doubao/video/generate | 豆包视频生成 (Seedance, async)


# **doubao_chat_api_v1_ai_doubao_chat_post**
> object doubao_chat_api_v1_ai_doubao_chat_post(message, model=model)

Doubao chat completion

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
    api_instance = zhs_api.AIDoubaoApi(api_client)
    message = 'message_example' # str | 
    model = 'doubao-pro-32k' # str |  (optional) (default to 'doubao-pro-32k')

    try:
        # Doubao chat completion
        api_response = api_instance.doubao_chat_api_v1_ai_doubao_chat_post(message, model=model)
        print("The response of AIDoubaoApi->doubao_chat_api_v1_ai_doubao_chat_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIDoubaoApi->doubao_chat_api_v1_ai_doubao_chat_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **message** | **str**|  | 
 **model** | **str**|  | [optional] [default to &#39;doubao-pro-32k&#39;]

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

# **doubao_image_edit_api_v1_ai_doubao_image_edit_post**
> object doubao_image_edit_api_v1_ai_doubao_image_edit_post(prompt, image, mask=mask, model=model, size=size, n=n, strength=strength, response_format=response_format)

豆包图片编辑

调用豆包图片编辑 API（/v3/images/edits）。

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
    api_instance = zhs_api.AIDoubaoApi(api_client)
    prompt = 'prompt_example' # str | 编辑指令 prompt
    image = None # bytes | 待编辑的原始图片
    mask = None # bytes | 遮罩图片（可选），标记需要编辑的区域 (optional)
    model = 'doubao-seedream-3-0-i2i-250415' # str | 图片编辑模型名称 (optional) (default to 'doubao-seedream-3-0-i2i-250415')
    size = '1024x1024' # str | 输出图片尺寸 (optional) (default to '1024x1024')
    n = 1 # int | 生成数量 (optional) (default to 1)
    strength = 0.8 # float | 编辑强度，0-1 (optional) (default to 0.8)
    response_format = 'url' # str | 返回格式: url / b64_json (optional) (default to 'url')

    try:
        # 豆包图片编辑
        api_response = api_instance.doubao_image_edit_api_v1_ai_doubao_image_edit_post(prompt, image, mask=mask, model=model, size=size, n=n, strength=strength, response_format=response_format)
        print("The response of AIDoubaoApi->doubao_image_edit_api_v1_ai_doubao_image_edit_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIDoubaoApi->doubao_image_edit_api_v1_ai_doubao_image_edit_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **prompt** | **str**| 编辑指令 prompt | 
 **image** | **bytes**| 待编辑的原始图片 | 
 **mask** | **bytes**| 遮罩图片（可选），标记需要编辑的区域 | [optional] 
 **model** | **str**| 图片编辑模型名称 | [optional] [default to &#39;doubao-seedream-3-0-i2i-250415&#39;]
 **size** | **str**| 输出图片尺寸 | [optional] [default to &#39;1024x1024&#39;]
 **n** | **int**| 生成数量 | [optional] [default to 1]
 **strength** | **float**| 编辑强度，0-1 | [optional] [default to 0.8]
 **response_format** | **str**| 返回格式: url / b64_json | [optional] [default to &#39;url&#39;]

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

# **doubao_image_generate_api_v1_ai_doubao_image_generate_post**
> object doubao_image_generate_api_v1_ai_doubao_image_generate_post(doubao_image_request)

豆包图片生成 (即梦 jimeng_t2i_v40)

Submit a JiMeng text-to-image task via Volcengine CVSync2Async API,
poll until complete, persist the image, deduct tokens, and return the URL.

Uses Volcengine V4 HMAC signing with DOUBAO_JM_API_KEY / DOUBAO_JM_SECRET_KEY.

### Example


```python
import zhs_api
from zhs_api.models.doubao_image_request import DoubaoImageRequest
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
    api_instance = zhs_api.AIDoubaoApi(api_client)
    doubao_image_request = zhs_api.DoubaoImageRequest() # DoubaoImageRequest | 

    try:
        # 豆包图片生成 (即梦 jimeng_t2i_v40)
        api_response = api_instance.doubao_image_generate_api_v1_ai_doubao_image_generate_post(doubao_image_request)
        print("The response of AIDoubaoApi->doubao_image_generate_api_v1_ai_doubao_image_generate_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIDoubaoApi->doubao_image_generate_api_v1_ai_doubao_image_generate_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **doubao_image_request** | [**DoubaoImageRequest**](DoubaoImageRequest.md)|  | 

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

# **doubao_seedream_api_v1_ai_doubao_image_seedream_post**
> object doubao_seedream_api_v1_ai_doubao_image_seedream_post(seedream_image_request)

Seedream 图片生成

Call Doubao Seedream model for image generation via /v3/images/generations
with Bearer token auth.  Mirrors the original doubao_image_proxy.py
/doubao-seedream-generation endpoint.

### Example


```python
import zhs_api
from zhs_api.models.seedream_image_request import SeedreamImageRequest
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
    api_instance = zhs_api.AIDoubaoApi(api_client)
    seedream_image_request = zhs_api.SeedreamImageRequest() # SeedreamImageRequest | 

    try:
        # Seedream 图片生成
        api_response = api_instance.doubao_seedream_api_v1_ai_doubao_image_seedream_post(seedream_image_request)
        print("The response of AIDoubaoApi->doubao_seedream_api_v1_ai_doubao_image_seedream_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIDoubaoApi->doubao_seedream_api_v1_ai_doubao_image_seedream_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **seedream_image_request** | [**SeedreamImageRequest**](SeedreamImageRequest.md)|  | 

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

# **doubao_stream_api_v1_ai_doubao_chat_stream_post**
> object doubao_stream_api_v1_ai_doubao_chat_stream_post(message, model=model)

Doubao streaming chat

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
    api_instance = zhs_api.AIDoubaoApi(api_client)
    message = 'message_example' # str | 
    model = 'doubao-pro-32k' # str |  (optional) (default to 'doubao-pro-32k')

    try:
        # Doubao streaming chat
        api_response = api_instance.doubao_stream_api_v1_ai_doubao_chat_stream_post(message, model=model)
        print("The response of AIDoubaoApi->doubao_stream_api_v1_ai_doubao_chat_stream_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIDoubaoApi->doubao_stream_api_v1_ai_doubao_chat_stream_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **message** | **str**|  | 
 **model** | **str**|  | [optional] [default to &#39;doubao-pro-32k&#39;]

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

# **doubao_video_generate_api_v1_ai_doubao_video_generate_post**
> object doubao_video_generate_api_v1_ai_doubao_video_generate_post(video_generate_request)

豆包视频生成 (Seedance, async)

Submit a Doubao Seedance video-generation task, poll until complete,
persist the resulting video, deduct tokens, and return the video URL.

Mirrors the original doubao_video_proxy.py /video-generation endpoint.

### Example


```python
import zhs_api
from zhs_api.models.video_generate_request import VideoGenerateRequest
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
    api_instance = zhs_api.AIDoubaoApi(api_client)
    video_generate_request = zhs_api.VideoGenerateRequest() # VideoGenerateRequest | 

    try:
        # 豆包视频生成 (Seedance, async)
        api_response = api_instance.doubao_video_generate_api_v1_ai_doubao_video_generate_post(video_generate_request)
        print("The response of AIDoubaoApi->doubao_video_generate_api_v1_ai_doubao_video_generate_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIDoubaoApi->doubao_video_generate_api_v1_ai_doubao_video_generate_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **video_generate_request** | [**VideoGenerateRequest**](VideoGenerateRequest.md)|  | 

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

