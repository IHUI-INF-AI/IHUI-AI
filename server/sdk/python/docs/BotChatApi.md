# zhs_api.BotChatApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**chat_with_bot_api_v1_bots_send_post**](BotChatApi.md#chat_with_bot_api_v1_bots_send_post) | **POST** /api/v1/bots/send | Send message to bot
[**list_conversations_api_v1_bots_conversations_get**](BotChatApi.md#list_conversations_api_v1_bots_conversations_get) | **GET** /api/v1/bots/conversations | List conversations
[**list_messages_api_v1_bots_messages_post**](BotChatApi.md#list_messages_api_v1_bots_messages_post) | **POST** /api/v1/bots/messages | 消息列表
[**message_feedback_api_v1_bots_messages_feedback_post**](BotChatApi.md#message_feedback_api_v1_bots_messages_feedback_post) | **POST** /api/v1/bots/messages/feedback | 消息反馈
[**retrieve_conversation_api_v1_bots_retrieve_post**](BotChatApi.md#retrieve_conversation_api_v1_bots_retrieve_post) | **POST** /api/v1/bots/retrieve | 检索会话


# **chat_with_bot_api_v1_bots_send_post**
> object chat_with_bot_api_v1_bots_send_post(bot_id, message, conversation_id=conversation_id)

Send message to bot

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
    api_instance = zhs_api.BotChatApi(api_client)
    bot_id = 'bot_id_example' # str | 
    message = 'message_example' # str | 
    conversation_id = 'conversation_id_example' # str |  (optional)

    try:
        # Send message to bot
        api_response = api_instance.chat_with_bot_api_v1_bots_send_post(bot_id, message, conversation_id=conversation_id)
        print("The response of BotChatApi->chat_with_bot_api_v1_bots_send_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling BotChatApi->chat_with_bot_api_v1_bots_send_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bot_id** | **str**|  | 
 **message** | **str**|  | 
 **conversation_id** | **str**|  | [optional] 

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

# **list_conversations_api_v1_bots_conversations_get**
> object list_conversations_api_v1_bots_conversations_get(bot_id, page=page, size=size)

List conversations

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
    api_instance = zhs_api.BotChatApi(api_client)
    bot_id = 'bot_id_example' # str | 
    page = 1 # int |  (optional) (default to 1)
    size = 20 # int |  (optional) (default to 20)

    try:
        # List conversations
        api_response = api_instance.list_conversations_api_v1_bots_conversations_get(bot_id, page=page, size=size)
        print("The response of BotChatApi->list_conversations_api_v1_bots_conversations_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling BotChatApi->list_conversations_api_v1_bots_conversations_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bot_id** | **str**|  | 
 **page** | **int**|  | [optional] [default to 1]
 **size** | **int**|  | [optional] [default to 20]

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

# **list_messages_api_v1_bots_messages_post**
> object list_messages_api_v1_bots_messages_post(conversation_id, bot_id=bot_id, page=page, size=size)

消息列表

获取指定会话的消息列表。

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
    api_instance = zhs_api.BotChatApi(api_client)
    conversation_id = 'conversation_id_example' # str | 
    bot_id = 'bot_id_example' # str |  (optional)
    page = 1 # int |  (optional) (default to 1)
    size = 20 # int |  (optional) (default to 20)

    try:
        # 消息列表
        api_response = api_instance.list_messages_api_v1_bots_messages_post(conversation_id, bot_id=bot_id, page=page, size=size)
        print("The response of BotChatApi->list_messages_api_v1_bots_messages_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling BotChatApi->list_messages_api_v1_bots_messages_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **conversation_id** | **str**|  | 
 **bot_id** | **str**|  | [optional] 
 **page** | **int**|  | [optional] [default to 1]
 **size** | **int**|  | [optional] [default to 20]

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

# **message_feedback_api_v1_bots_messages_feedback_post**
> object message_feedback_api_v1_bots_messages_feedback_post(message_id, conversation_id, feedback_type, content=content)

消息反馈

对消息进行点赞/踩反馈。

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
    api_instance = zhs_api.BotChatApi(api_client)
    message_id = 'message_id_example' # str | 
    conversation_id = 'conversation_id_example' # str | 
    feedback_type = 'feedback_type_example' # str | like / dislike
    content = '' # str | 反馈内容 (optional) (default to '')

    try:
        # 消息反馈
        api_response = api_instance.message_feedback_api_v1_bots_messages_feedback_post(message_id, conversation_id, feedback_type, content=content)
        print("The response of BotChatApi->message_feedback_api_v1_bots_messages_feedback_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling BotChatApi->message_feedback_api_v1_bots_messages_feedback_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **message_id** | **str**|  | 
 **conversation_id** | **str**|  | 
 **feedback_type** | **str**| like / dislike | 
 **content** | **str**| 反馈内容 | [optional] [default to &#39;&#39;]

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

# **retrieve_conversation_api_v1_bots_retrieve_post**
> object retrieve_conversation_api_v1_bots_retrieve_post(conversation_id)

检索会话

检索指定会话详情。

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
    api_instance = zhs_api.BotChatApi(api_client)
    conversation_id = 'conversation_id_example' # str | 

    try:
        # 检索会话
        api_response = api_instance.retrieve_conversation_api_v1_bots_retrieve_post(conversation_id)
        print("The response of BotChatApi->retrieve_conversation_api_v1_bots_retrieve_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling BotChatApi->retrieve_conversation_api_v1_bots_retrieve_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **conversation_id** | **str**|  | 

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

