# zhs_api.CozeChatAudioApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**one_to_one_audio_api_v1_coze_chat_audio_chat_audio_one_to_one_post**](CozeChatAudioApi.md#one_to_one_audio_api_v1_coze_chat_audio_chat_audio_one_to_one_post) | **POST** /api/v1/coze/chat-audio/chat-audio/one-to-one | One To One Audio
[**plugin_audio_chat_api_v1_coze_chat_audio_chat_audio_plugin_post**](CozeChatAudioApi.md#plugin_audio_chat_api_v1_coze_chat_audio_chat_audio_plugin_post) | **POST** /api/v1/coze/chat-audio/chat-audio/plugin | Plugin Audio Chat
[**simple_audio_chat_api_v1_coze_chat_audio_chat_audio_simple_post**](CozeChatAudioApi.md#simple_audio_chat_api_v1_coze_chat_audio_chat_audio_simple_post) | **POST** /api/v1/coze/chat-audio/chat-audio/simple | Simple Audio Chat


# **one_to_one_audio_api_v1_coze_chat_audio_chat_audio_one_to_one_post**
> object one_to_one_audio_api_v1_coze_chat_audio_chat_audio_one_to_one_post(one_to_one_audio_req)

One To One Audio

### Example


```python
import zhs_api
from zhs_api.models.one_to_one_audio_req import OneToOneAudioReq
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
    api_instance = zhs_api.CozeChatAudioApi(api_client)
    one_to_one_audio_req = zhs_api.OneToOneAudioReq() # OneToOneAudioReq | 

    try:
        # One To One Audio
        api_response = api_instance.one_to_one_audio_api_v1_coze_chat_audio_chat_audio_one_to_one_post(one_to_one_audio_req)
        print("The response of CozeChatAudioApi->one_to_one_audio_api_v1_coze_chat_audio_chat_audio_one_to_one_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeChatAudioApi->one_to_one_audio_api_v1_coze_chat_audio_chat_audio_one_to_one_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **one_to_one_audio_req** | [**OneToOneAudioReq**](OneToOneAudioReq.md)|  | 

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

# **plugin_audio_chat_api_v1_coze_chat_audio_chat_audio_plugin_post**
> object plugin_audio_chat_api_v1_coze_chat_audio_chat_audio_plugin_post(plugin_audio_req)

Plugin Audio Chat

### Example


```python
import zhs_api
from zhs_api.models.plugin_audio_req import PluginAudioReq
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
    api_instance = zhs_api.CozeChatAudioApi(api_client)
    plugin_audio_req = zhs_api.PluginAudioReq() # PluginAudioReq | 

    try:
        # Plugin Audio Chat
        api_response = api_instance.plugin_audio_chat_api_v1_coze_chat_audio_chat_audio_plugin_post(plugin_audio_req)
        print("The response of CozeChatAudioApi->plugin_audio_chat_api_v1_coze_chat_audio_chat_audio_plugin_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeChatAudioApi->plugin_audio_chat_api_v1_coze_chat_audio_chat_audio_plugin_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **plugin_audio_req** | [**PluginAudioReq**](PluginAudioReq.md)|  | 

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

# **simple_audio_chat_api_v1_coze_chat_audio_chat_audio_simple_post**
> object simple_audio_chat_api_v1_coze_chat_audio_chat_audio_simple_post(simple_audio_req)

Simple Audio Chat

### Example


```python
import zhs_api
from zhs_api.models.simple_audio_req import SimpleAudioReq
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
    api_instance = zhs_api.CozeChatAudioApi(api_client)
    simple_audio_req = zhs_api.SimpleAudioReq() # SimpleAudioReq | 

    try:
        # Simple Audio Chat
        api_response = api_instance.simple_audio_chat_api_v1_coze_chat_audio_chat_audio_simple_post(simple_audio_req)
        print("The response of CozeChatAudioApi->simple_audio_chat_api_v1_coze_chat_audio_chat_audio_simple_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeChatAudioApi->simple_audio_chat_api_v1_coze_chat_audio_chat_audio_simple_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **simple_audio_req** | [**SimpleAudioReq**](SimpleAudioReq.md)|  | 

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

