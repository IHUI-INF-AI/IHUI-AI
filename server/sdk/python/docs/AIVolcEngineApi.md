# zhs_api.AIVolcEngineApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**jimeng31_generate_api_v1_ai_volcengine_jimeng_generate_post**](AIVolcEngineApi.md#jimeng31_generate_api_v1_ai_volcengine_jimeng_generate_post) | **POST** /api/v1/ai/volcengine/jimeng/generate | JiMeng 3.1 generation
[**jimeng4_image_api_v1_ai_volcengine_jimeng_image_post**](AIVolcEngineApi.md#jimeng4_image_api_v1_ai_volcengine_jimeng_image_post) | **POST** /api/v1/ai/volcengine/jimeng/image | JiMeng 4.0 text-to-image (async)
[**jimeng4_process_api_v1_ai_volcengine_jimeng4_process_post**](AIVolcEngineApi.md#jimeng4_process_api_v1_ai_volcengine_jimeng4_process_post) | **POST** /api/v1/ai/volcengine/jimeng4/process | 即梦4.0 CVProcess 通用转发
[**ping_api_v1_ai_volcengine_ping_get**](AIVolcEngineApi.md#ping_api_v1_ai_volcengine_ping_get) | **GET** /api/v1/ai/volcengine/ping | Health check
[**visual_proxy_api_v1_ai_volcengine_visual_req_key_post**](AIVolcEngineApi.md#visual_proxy_api_v1_ai_volcengine_visual_req_key_post) | **POST** /api/v1/ai/volcengine/visual/{req_key} | 火山视觉通用代理 (CVSync2Async async submit+poll)


# **jimeng31_generate_api_v1_ai_volcengine_jimeng_generate_post**
> object jimeng31_generate_api_v1_ai_volcengine_jimeng_generate_post(jimeng31_request)

JiMeng 3.1 generation

Proxy a JiMeng 3.1 generation request via CVProcess.

### Example


```python
import zhs_api
from zhs_api.models.jimeng31_request import Jimeng31Request
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
    api_instance = zhs_api.AIVolcEngineApi(api_client)
    jimeng31_request = zhs_api.Jimeng31Request() # Jimeng31Request | 

    try:
        # JiMeng 3.1 generation
        api_response = api_instance.jimeng31_generate_api_v1_ai_volcengine_jimeng_generate_post(jimeng31_request)
        print("The response of AIVolcEngineApi->jimeng31_generate_api_v1_ai_volcengine_jimeng_generate_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIVolcEngineApi->jimeng31_generate_api_v1_ai_volcengine_jimeng_generate_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **jimeng31_request** | [**Jimeng31Request**](Jimeng31Request.md)|  | 

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

# **jimeng4_image_api_v1_ai_volcengine_jimeng_image_post**
> object jimeng4_image_api_v1_ai_volcengine_jimeng_image_post(jimeng4_image_request)

JiMeng 4.0 text-to-image (async)

Submit a JiMeng 4.0 image generation task via CVSync2Async,
poll until complete, and return image URLs / base64 data.

### Example


```python
import zhs_api
from zhs_api.models.jimeng4_image_request import Jimeng4ImageRequest
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
    api_instance = zhs_api.AIVolcEngineApi(api_client)
    jimeng4_image_request = zhs_api.Jimeng4ImageRequest() # Jimeng4ImageRequest | 

    try:
        # JiMeng 4.0 text-to-image (async)
        api_response = api_instance.jimeng4_image_api_v1_ai_volcengine_jimeng_image_post(jimeng4_image_request)
        print("The response of AIVolcEngineApi->jimeng4_image_api_v1_ai_volcengine_jimeng_image_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIVolcEngineApi->jimeng4_image_api_v1_ai_volcengine_jimeng_image_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **jimeng4_image_request** | [**Jimeng4ImageRequest**](Jimeng4ImageRequest.md)|  | 

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

# **jimeng4_process_api_v1_ai_volcengine_jimeng4_process_post**
> object jimeng4_process_api_v1_ai_volcengine_jimeng4_process_post(jimeng4_process_request)

即梦4.0 CVProcess 通用转发

JiMeng 4.0 CVProcess generic proxy.
Forwards the body (with arbitrary extra fields) via CVProcess to Volcengine.
Mirrors the original volcengine_visual_proxy.py /jimeng4/process endpoint.

### Example


```python
import zhs_api
from zhs_api.models.jimeng4_process_request import Jimeng4ProcessRequest
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
    api_instance = zhs_api.AIVolcEngineApi(api_client)
    jimeng4_process_request = zhs_api.Jimeng4ProcessRequest() # Jimeng4ProcessRequest | 

    try:
        # 即梦4.0 CVProcess 通用转发
        api_response = api_instance.jimeng4_process_api_v1_ai_volcengine_jimeng4_process_post(jimeng4_process_request)
        print("The response of AIVolcEngineApi->jimeng4_process_api_v1_ai_volcengine_jimeng4_process_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIVolcEngineApi->jimeng4_process_api_v1_ai_volcengine_jimeng4_process_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **jimeng4_process_request** | [**Jimeng4ProcessRequest**](Jimeng4ProcessRequest.md)|  | 

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

# **ping_api_v1_ai_volcengine_ping_get**
> object ping_api_v1_ai_volcengine_ping_get()

Health check

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
    api_instance = zhs_api.AIVolcEngineApi(api_client)

    try:
        # Health check
        api_response = api_instance.ping_api_v1_ai_volcengine_ping_get()
        print("The response of AIVolcEngineApi->ping_api_v1_ai_volcengine_ping_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIVolcEngineApi->ping_api_v1_ai_volcengine_ping_get: %s\n" % e)
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

# **visual_proxy_api_v1_ai_volcengine_visual_req_key_post**
> object visual_proxy_api_v1_ai_volcengine_visual_req_key_post(req_key, visual_generic_request)

火山视觉通用代理 (CVSync2Async async submit+poll)

Submit a Volcengine visual task (text-to-video, image-to-video, etc.)
via CVSync2Async, poll until complete, persist the resulting video,
deduct tokens, and return the video URL.

Mirrors the original volcengine_visual_proxy.py /visual/{req_key} endpoint.

### Example


```python
import zhs_api
from zhs_api.models.visual_generic_request import VisualGenericRequest
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
    api_instance = zhs_api.AIVolcEngineApi(api_client)
    req_key = 'req_key_example' # str | 
    visual_generic_request = zhs_api.VisualGenericRequest() # VisualGenericRequest | 

    try:
        # 火山视觉通用代理 (CVSync2Async async submit+poll)
        api_response = api_instance.visual_proxy_api_v1_ai_volcengine_visual_req_key_post(req_key, visual_generic_request)
        print("The response of AIVolcEngineApi->visual_proxy_api_v1_ai_volcengine_visual_req_key_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIVolcEngineApi->visual_proxy_api_v1_ai_volcengine_visual_req_key_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **req_key** | **str**|  | 
 **visual_generic_request** | [**VisualGenericRequest**](VisualGenericRequest.md)|  | 

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

