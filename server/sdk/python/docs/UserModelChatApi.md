# zhs_api.UserModelChatApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**image_api_v1_user_model_chat_image_post**](UserModelChatApi.md#image_api_v1_user_model_chat_image_post) | **POST** /api/v1/user-model-chat/image | AI模型生图
[**image_api_v1_user_model_chat_image_post_0**](UserModelChatApi.md#image_api_v1_user_model_chat_image_post_0) | **POST** /api/v1/user-model-chat/image | AI模型生图
[**list_models_api_v1_user_model_chat_list_get**](UserModelChatApi.md#list_models_api_v1_user_model_chat_list_get) | **GET** /api/v1/user-model-chat/list | 可用模型列表
[**list_models_api_v1_user_model_chat_list_get_0**](UserModelChatApi.md#list_models_api_v1_user_model_chat_list_get_0) | **GET** /api/v1/user-model-chat/list | 可用模型列表
[**user_model_chat_chat**](UserModelChatApi.md#user_model_chat_chat) | **POST** /api/v1/user-model-chat/chat | AI模型对话
[**user_model_chat_chat_0**](UserModelChatApi.md#user_model_chat_chat_0) | **POST** /api/v1/user-model-chat/chat | AI模型对话


# **image_api_v1_user_model_chat_image_post**
> object image_api_v1_user_model_chat_image_post(body_image_api_v1_user_model_chat_image_post, api_key=api_key, api_base=api_base)

AI模型生图

### Example


```python
import zhs_api
from zhs_api.models.body_image_api_v1_user_model_chat_image_post import BodyImageApiV1UserModelChatImagePost
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
    api_instance = zhs_api.UserModelChatApi(api_client)
    body_image_api_v1_user_model_chat_image_post = zhs_api.BodyImageApiV1UserModelChatImagePost() # BodyImageApiV1UserModelChatImagePost | 
    api_key = 'api_key_example' # str |  (optional)
    api_base = 'api_base_example' # str |  (optional)

    try:
        # AI模型生图
        api_response = api_instance.image_api_v1_user_model_chat_image_post(body_image_api_v1_user_model_chat_image_post, api_key=api_key, api_base=api_base)
        print("The response of UserModelChatApi->image_api_v1_user_model_chat_image_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserModelChatApi->image_api_v1_user_model_chat_image_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_image_api_v1_user_model_chat_image_post** | [**BodyImageApiV1UserModelChatImagePost**](BodyImageApiV1UserModelChatImagePost.md)|  | 
 **api_key** | **str**|  | [optional] 
 **api_base** | **str**|  | [optional] 

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

# **image_api_v1_user_model_chat_image_post_0**
> object image_api_v1_user_model_chat_image_post_0(body_image_api_v1_user_model_chat_image_post, api_key=api_key, api_base=api_base)

AI模型生图

### Example


```python
import zhs_api
from zhs_api.models.body_image_api_v1_user_model_chat_image_post import BodyImageApiV1UserModelChatImagePost
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
    api_instance = zhs_api.UserModelChatApi(api_client)
    body_image_api_v1_user_model_chat_image_post = zhs_api.BodyImageApiV1UserModelChatImagePost() # BodyImageApiV1UserModelChatImagePost | 
    api_key = 'api_key_example' # str |  (optional)
    api_base = 'api_base_example' # str |  (optional)

    try:
        # AI模型生图
        api_response = api_instance.image_api_v1_user_model_chat_image_post_0(body_image_api_v1_user_model_chat_image_post, api_key=api_key, api_base=api_base)
        print("The response of UserModelChatApi->image_api_v1_user_model_chat_image_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserModelChatApi->image_api_v1_user_model_chat_image_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_image_api_v1_user_model_chat_image_post** | [**BodyImageApiV1UserModelChatImagePost**](BodyImageApiV1UserModelChatImagePost.md)|  | 
 **api_key** | **str**|  | [optional] 
 **api_base** | **str**|  | [optional] 

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

# **list_models_api_v1_user_model_chat_list_get**
> object list_models_api_v1_user_model_chat_list_get()

可用模型列表

获取支持的AI模型列表

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
    api_instance = zhs_api.UserModelChatApi(api_client)

    try:
        # 可用模型列表
        api_response = api_instance.list_models_api_v1_user_model_chat_list_get()
        print("The response of UserModelChatApi->list_models_api_v1_user_model_chat_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserModelChatApi->list_models_api_v1_user_model_chat_list_get: %s\n" % e)
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

# **list_models_api_v1_user_model_chat_list_get_0**
> object list_models_api_v1_user_model_chat_list_get_0()

可用模型列表

获取支持的AI模型列表

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
    api_instance = zhs_api.UserModelChatApi(api_client)

    try:
        # 可用模型列表
        api_response = api_instance.list_models_api_v1_user_model_chat_list_get_0()
        print("The response of UserModelChatApi->list_models_api_v1_user_model_chat_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserModelChatApi->list_models_api_v1_user_model_chat_list_get_0: %s\n" % e)
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

# **user_model_chat_chat**
> object user_model_chat_chat(body_user_model_chat_chat, api_key=api_key, api_base=api_base)

AI模型对话

用户直接调用AI模型对话（不绑定Agent）

### Example


```python
import zhs_api
from zhs_api.models.body_user_model_chat_chat import BodyUserModelChatChat
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
    api_instance = zhs_api.UserModelChatApi(api_client)
    body_user_model_chat_chat = zhs_api.BodyUserModelChatChat() # BodyUserModelChatChat | 
    api_key = 'api_key_example' # str |  (optional)
    api_base = 'api_base_example' # str |  (optional)

    try:
        # AI模型对话
        api_response = api_instance.user_model_chat_chat(body_user_model_chat_chat, api_key=api_key, api_base=api_base)
        print("The response of UserModelChatApi->user_model_chat_chat:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserModelChatApi->user_model_chat_chat: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_user_model_chat_chat** | [**BodyUserModelChatChat**](BodyUserModelChatChat.md)|  | 
 **api_key** | **str**|  | [optional] 
 **api_base** | **str**|  | [optional] 

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

# **user_model_chat_chat_0**
> object user_model_chat_chat_0(body_user_model_chat_chat, api_key=api_key, api_base=api_base)

AI模型对话

用户直接调用AI模型对话（不绑定Agent）

### Example


```python
import zhs_api
from zhs_api.models.body_user_model_chat_chat import BodyUserModelChatChat
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
    api_instance = zhs_api.UserModelChatApi(api_client)
    body_user_model_chat_chat = zhs_api.BodyUserModelChatChat() # BodyUserModelChatChat | 
    api_key = 'api_key_example' # str |  (optional)
    api_base = 'api_base_example' # str |  (optional)

    try:
        # AI模型对话
        api_response = api_instance.user_model_chat_chat_0(body_user_model_chat_chat, api_key=api_key, api_base=api_base)
        print("The response of UserModelChatApi->user_model_chat_chat_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UserModelChatApi->user_model_chat_chat_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_user_model_chat_chat** | [**BodyUserModelChatChat**](BodyUserModelChatChat.md)|  | 
 **api_key** | **str**|  | [optional] 
 **api_base** | **str**|  | [optional] 

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

