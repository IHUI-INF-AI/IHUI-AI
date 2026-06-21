# zhs_api.AIJimengApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**jimeng4_image_api_v1_ai_jimeng4_post**](AIJimengApi.md#jimeng4_image_api_v1_ai_jimeng4_post) | **POST** /api/v1/ai/jimeng4 | 即梦 4.0 文字生成图片（兼容旧路径）


# **jimeng4_image_api_v1_ai_jimeng4_post**
> object jimeng4_image_api_v1_ai_jimeng4_post(jimeng4_image_request)

即梦 4.0 文字生成图片（兼容旧路径）

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
    api_instance = zhs_api.AIJimengApi(api_client)
    jimeng4_image_request = zhs_api.Jimeng4ImageRequest() # Jimeng4ImageRequest | 

    try:
        # 即梦 4.0 文字生成图片（兼容旧路径）
        api_response = api_instance.jimeng4_image_api_v1_ai_jimeng4_post(jimeng4_image_request)
        print("The response of AIJimengApi->jimeng4_image_api_v1_ai_jimeng4_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIJimengApi->jimeng4_image_api_v1_ai_jimeng4_post: %s\n" % e)
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

