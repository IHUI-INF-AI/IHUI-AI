# zhs_api.ChatApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**chat_with_billing_api_v1_chat_chat_with_billing_post**](ChatApi.md#chat_with_billing_api_v1_chat_chat_with_billing_post) | **POST** /api/v1/chat/chat-with-billing | Chat with token billing
[**create_conversation_api_v1_chat_conversation_create_post**](ChatApi.md#create_conversation_api_v1_chat_conversation_create_post) | **POST** /api/v1/chat/conversation/create | Create Coze conversation
[**create_dataset_api_v1_chat_datasets_create_post**](ChatApi.md#create_dataset_api_v1_chat_datasets_create_post) | **POST** /api/v1/chat/datasets/create | Create Coze dataset
[**list_conversations_api_v1_chat_conversations_list_post**](ChatApi.md#list_conversations_api_v1_chat_conversations_list_post) | **POST** /api/v1/chat/conversations/list | List Coze conversations
[**list_datasets_api_v1_chat_datasets_list_post**](ChatApi.md#list_datasets_api_v1_chat_datasets_list_post) | **POST** /api/v1/chat/datasets/list | List Coze datasets
[**list_documents_api_v1_chat_documents_list_post**](ChatApi.md#list_documents_api_v1_chat_documents_list_post) | **POST** /api/v1/chat/documents/list | List Coze dataset documents
[**list_messages_api_v1_chat_messages_list_post**](ChatApi.md#list_messages_api_v1_chat_messages_list_post) | **POST** /api/v1/chat/messages/list | List Coze conversation messages
[**message_feedback_api_v1_chat_messages_feedback_post**](ChatApi.md#message_feedback_api_v1_chat_messages_feedback_post) | **POST** /api/v1/chat/messages/feedback | Coze message feedback
[**resume_workflow_api_v1_chat_workflow_run_resume_post**](ChatApi.md#resume_workflow_api_v1_chat_workflow_run_resume_post) | **POST** /api/v1/chat/workflow/run/resume | Resume interrupted Coze workflow
[**resume_workflow_stream_api_v1_chat_workflow_run_resume_stream_post**](ChatApi.md#resume_workflow_stream_api_v1_chat_workflow_run_resume_stream_post) | **POST** /api/v1/chat/workflow/run/resume/stream | Resume interrupted Coze workflow (stream)
[**retrieve_conversation_api_v1_chat_conversations_retrieve_post**](ChatApi.md#retrieve_conversation_api_v1_chat_conversations_retrieve_post) | **POST** /api/v1/chat/conversations/retrieve | Retrieve Coze conversation
[**run_workflow_api_v1_chat_workflow_run_post**](ChatApi.md#run_workflow_api_v1_chat_workflow_run_post) | **POST** /api/v1/chat/workflow/run | Run Coze workflow (sync)
[**run_workflow_stream_api_v1_chat_workflow_run_stream_post**](ChatApi.md#run_workflow_stream_api_v1_chat_workflow_run_stream_post) | **POST** /api/v1/chat/workflow/run/stream | Run Coze workflow (stream)
[**send_message_api_v1_chat_message_post**](ChatApi.md#send_message_api_v1_chat_message_post) | **POST** /api/v1/chat/message | Send chat message via Coze (sync)
[**send_message_stream_api_v1_chat_message_stream_post**](ChatApi.md#send_message_stream_api_v1_chat_message_stream_post) | **POST** /api/v1/chat/message/stream | Send chat message via Coze (SSE stream)
[**upload_document_api_v1_chat_documents_upload_post**](ChatApi.md#upload_document_api_v1_chat_documents_upload_post) | **POST** /api/v1/chat/documents/upload | Upload document to Coze dataset (multipart)
[**workflow_history_api_v1_chat_workflow_run_history_post**](ChatApi.md#workflow_history_api_v1_chat_workflow_run_history_post) | **POST** /api/v1/chat/workflow/run/history | Get Coze workflow run history


# **chat_with_billing_api_v1_chat_chat_with_billing_post**
> object chat_with_billing_api_v1_chat_chat_with_billing_post(bot_id, message, cost_tokens=cost_tokens)

Chat with token billing

带计费的聊天：先扣 token，再转发到 Coze。

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
    api_instance = zhs_api.ChatApi(api_client)
    bot_id = 'bot_id_example' # str | 
    message = 'message_example' # str | 
    cost_tokens = 100 # int | 本次聊天扣减 token 数 (optional) (default to 100)

    try:
        # Chat with token billing
        api_response = api_instance.chat_with_billing_api_v1_chat_chat_with_billing_post(bot_id, message, cost_tokens=cost_tokens)
        print("The response of ChatApi->chat_with_billing_api_v1_chat_chat_with_billing_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatApi->chat_with_billing_api_v1_chat_chat_with_billing_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bot_id** | **str**|  | 
 **message** | **str**|  | 
 **cost_tokens** | **int**| 本次聊天扣减 token 数 | [optional] [default to 100]

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

# **create_conversation_api_v1_chat_conversation_create_post**
> object create_conversation_api_v1_chat_conversation_create_post(bot_id)

Create Coze conversation

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
    api_instance = zhs_api.ChatApi(api_client)
    bot_id = 'bot_id_example' # str | 

    try:
        # Create Coze conversation
        api_response = api_instance.create_conversation_api_v1_chat_conversation_create_post(bot_id)
        print("The response of ChatApi->create_conversation_api_v1_chat_conversation_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatApi->create_conversation_api_v1_chat_conversation_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bot_id** | **str**|  | 

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

# **create_dataset_api_v1_chat_datasets_create_post**
> object create_dataset_api_v1_chat_datasets_create_post(name, space_id=space_id)

Create Coze dataset

创建数据集。

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
    api_instance = zhs_api.ChatApi(api_client)
    name = 'name_example' # str | 
    space_id = '' # str | Workspace ID, defaults to configured account (optional) (default to '')

    try:
        # Create Coze dataset
        api_response = api_instance.create_dataset_api_v1_chat_datasets_create_post(name, space_id=space_id)
        print("The response of ChatApi->create_dataset_api_v1_chat_datasets_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatApi->create_dataset_api_v1_chat_datasets_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **str**|  | 
 **space_id** | **str**| Workspace ID, defaults to configured account | [optional] [default to &#39;&#39;]

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

# **list_conversations_api_v1_chat_conversations_list_post**
> object list_conversations_api_v1_chat_conversations_list_post(bot_id, user_id, page=page, size=size)

List Coze conversations

获取对话列表。

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
    api_instance = zhs_api.ChatApi(api_client)
    bot_id = 'bot_id_example' # str | 
    user_id = 'user_id_example' # str | 
    page = 1 # int |  (optional) (default to 1)
    size = 20 # int |  (optional) (default to 20)

    try:
        # List Coze conversations
        api_response = api_instance.list_conversations_api_v1_chat_conversations_list_post(bot_id, user_id, page=page, size=size)
        print("The response of ChatApi->list_conversations_api_v1_chat_conversations_list_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatApi->list_conversations_api_v1_chat_conversations_list_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bot_id** | **str**|  | 
 **user_id** | **str**|  | 
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

# **list_datasets_api_v1_chat_datasets_list_post**
> object list_datasets_api_v1_chat_datasets_list_post(space_id=space_id, page=page, size=size)

List Coze datasets

获取数据集列表。

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
    api_instance = zhs_api.ChatApi(api_client)
    space_id = '' # str | Workspace ID (optional) (default to '')
    page = 1 # int |  (optional) (default to 1)
    size = 20 # int |  (optional) (default to 20)

    try:
        # List Coze datasets
        api_response = api_instance.list_datasets_api_v1_chat_datasets_list_post(space_id=space_id, page=page, size=size)
        print("The response of ChatApi->list_datasets_api_v1_chat_datasets_list_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatApi->list_datasets_api_v1_chat_datasets_list_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **space_id** | **str**| Workspace ID | [optional] [default to &#39;&#39;]
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

# **list_documents_api_v1_chat_documents_list_post**
> object list_documents_api_v1_chat_documents_list_post(dataset_id, page=page, size=size)

List Coze dataset documents

获取数据集下的文档列表。

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
    api_instance = zhs_api.ChatApi(api_client)
    dataset_id = 'dataset_id_example' # str | 
    page = 1 # int |  (optional) (default to 1)
    size = 20 # int |  (optional) (default to 20)

    try:
        # List Coze dataset documents
        api_response = api_instance.list_documents_api_v1_chat_documents_list_post(dataset_id, page=page, size=size)
        print("The response of ChatApi->list_documents_api_v1_chat_documents_list_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatApi->list_documents_api_v1_chat_documents_list_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dataset_id** | **str**|  | 
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

# **list_messages_api_v1_chat_messages_list_post**
> object list_messages_api_v1_chat_messages_list_post(conversation_id, bot_id=bot_id, page=page, size=size)

List Coze conversation messages

获取对话消息列表。

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
    api_instance = zhs_api.ChatApi(api_client)
    conversation_id = 'conversation_id_example' # str | 
    bot_id = '' # str |  (optional) (default to '')
    page = 1 # int |  (optional) (default to 1)
    size = 20 # int |  (optional) (default to 20)

    try:
        # List Coze conversation messages
        api_response = api_instance.list_messages_api_v1_chat_messages_list_post(conversation_id, bot_id=bot_id, page=page, size=size)
        print("The response of ChatApi->list_messages_api_v1_chat_messages_list_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatApi->list_messages_api_v1_chat_messages_list_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **conversation_id** | **str**|  | 
 **bot_id** | **str**|  | [optional] [default to &#39;&#39;]
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

# **message_feedback_api_v1_chat_messages_feedback_post**
> object message_feedback_api_v1_chat_messages_feedback_post(message_id, conversation_id, feedback_type, content=content)

Coze message feedback

消息反馈（点赞/点踩）。

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
    api_instance = zhs_api.ChatApi(api_client)
    message_id = 'message_id_example' # str | 
    conversation_id = 'conversation_id_example' # str | 
    feedback_type = 'feedback_type_example' # str | like / dislike
    content = '' # str |  (optional) (default to '')

    try:
        # Coze message feedback
        api_response = api_instance.message_feedback_api_v1_chat_messages_feedback_post(message_id, conversation_id, feedback_type, content=content)
        print("The response of ChatApi->message_feedback_api_v1_chat_messages_feedback_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatApi->message_feedback_api_v1_chat_messages_feedback_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **message_id** | **str**|  | 
 **conversation_id** | **str**|  | 
 **feedback_type** | **str**| like / dislike | 
 **content** | **str**|  | [optional] [default to &#39;&#39;]

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

# **resume_workflow_api_v1_chat_workflow_run_resume_post**
> object resume_workflow_api_v1_chat_workflow_run_resume_post(workflow_id, event_id, interrupt_type, resume_data=resume_data)

Resume interrupted Coze workflow

恢复被中断的工作流。

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
    api_instance = zhs_api.ChatApi(api_client)
    workflow_id = 'workflow_id_example' # str | 
    event_id = 'event_id_example' # str | 
    interrupt_type = 'interrupt_type_example' # str | 
    resume_data = '{}' # str | JSON string (optional) (default to '{}')

    try:
        # Resume interrupted Coze workflow
        api_response = api_instance.resume_workflow_api_v1_chat_workflow_run_resume_post(workflow_id, event_id, interrupt_type, resume_data=resume_data)
        print("The response of ChatApi->resume_workflow_api_v1_chat_workflow_run_resume_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatApi->resume_workflow_api_v1_chat_workflow_run_resume_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflow_id** | **str**|  | 
 **event_id** | **str**|  | 
 **interrupt_type** | **str**|  | 
 **resume_data** | **str**| JSON string | [optional] [default to &#39;{}&#39;]

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

# **resume_workflow_stream_api_v1_chat_workflow_run_resume_stream_post**
> object resume_workflow_stream_api_v1_chat_workflow_run_resume_stream_post(workflow_id, event_id, interrupt_type, resume_data=resume_data)

Resume interrupted Coze workflow (stream)

流式恢复被中断的工作流。

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
    api_instance = zhs_api.ChatApi(api_client)
    workflow_id = 'workflow_id_example' # str | 
    event_id = 'event_id_example' # str | 
    interrupt_type = 'interrupt_type_example' # str | 
    resume_data = '{}' # str | JSON string (optional) (default to '{}')

    try:
        # Resume interrupted Coze workflow (stream)
        api_response = api_instance.resume_workflow_stream_api_v1_chat_workflow_run_resume_stream_post(workflow_id, event_id, interrupt_type, resume_data=resume_data)
        print("The response of ChatApi->resume_workflow_stream_api_v1_chat_workflow_run_resume_stream_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatApi->resume_workflow_stream_api_v1_chat_workflow_run_resume_stream_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflow_id** | **str**|  | 
 **event_id** | **str**|  | 
 **interrupt_type** | **str**|  | 
 **resume_data** | **str**| JSON string | [optional] [default to &#39;{}&#39;]

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

# **retrieve_conversation_api_v1_chat_conversations_retrieve_post**
> object retrieve_conversation_api_v1_chat_conversations_retrieve_post(conversation_id)

Retrieve Coze conversation

获取对话详情。

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
    api_instance = zhs_api.ChatApi(api_client)
    conversation_id = 'conversation_id_example' # str | 

    try:
        # Retrieve Coze conversation
        api_response = api_instance.retrieve_conversation_api_v1_chat_conversations_retrieve_post(conversation_id)
        print("The response of ChatApi->retrieve_conversation_api_v1_chat_conversations_retrieve_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatApi->retrieve_conversation_api_v1_chat_conversations_retrieve_post: %s\n" % e)
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

# **run_workflow_api_v1_chat_workflow_run_post**
> object run_workflow_api_v1_chat_workflow_run_post(workflow_id, parameters=parameters)

Run Coze workflow (sync)

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
    api_instance = zhs_api.ChatApi(api_client)
    workflow_id = 'workflow_id_example' # str | 
    parameters = '{}' # str | JSON 字符串 (optional) (default to '{}')

    try:
        # Run Coze workflow (sync)
        api_response = api_instance.run_workflow_api_v1_chat_workflow_run_post(workflow_id, parameters=parameters)
        print("The response of ChatApi->run_workflow_api_v1_chat_workflow_run_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatApi->run_workflow_api_v1_chat_workflow_run_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflow_id** | **str**|  | 
 **parameters** | **str**| JSON 字符串 | [optional] [default to &#39;{}&#39;]

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

# **run_workflow_stream_api_v1_chat_workflow_run_stream_post**
> object run_workflow_stream_api_v1_chat_workflow_run_stream_post(workflow_id, parameters=parameters)

Run Coze workflow (stream)

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
    api_instance = zhs_api.ChatApi(api_client)
    workflow_id = 'workflow_id_example' # str | 
    parameters = '{}' # str |  (optional) (default to '{}')

    try:
        # Run Coze workflow (stream)
        api_response = api_instance.run_workflow_stream_api_v1_chat_workflow_run_stream_post(workflow_id, parameters=parameters)
        print("The response of ChatApi->run_workflow_stream_api_v1_chat_workflow_run_stream_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatApi->run_workflow_stream_api_v1_chat_workflow_run_stream_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflow_id** | **str**|  | 
 **parameters** | **str**|  | [optional] [default to &#39;{}&#39;]

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

# **send_message_api_v1_chat_message_post**
> object send_message_api_v1_chat_message_post(bot_id, message, conversation_id=conversation_id)

Send chat message via Coze (sync)

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
    api_instance = zhs_api.ChatApi(api_client)
    bot_id = 'bot_id_example' # str | 
    message = 'message_example' # str | 
    conversation_id = 'conversation_id_example' # str |  (optional)

    try:
        # Send chat message via Coze (sync)
        api_response = api_instance.send_message_api_v1_chat_message_post(bot_id, message, conversation_id=conversation_id)
        print("The response of ChatApi->send_message_api_v1_chat_message_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatApi->send_message_api_v1_chat_message_post: %s\n" % e)
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

# **send_message_stream_api_v1_chat_message_stream_post**
> object send_message_stream_api_v1_chat_message_stream_post(bot_id, message, conversation_id=conversation_id)

Send chat message via Coze (SSE stream)

流式聊天：通过 SSE 把 Coze 增量事件转发给前端。

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
    api_instance = zhs_api.ChatApi(api_client)
    bot_id = 'bot_id_example' # str | 
    message = 'message_example' # str | 
    conversation_id = 'conversation_id_example' # str |  (optional)

    try:
        # Send chat message via Coze (SSE stream)
        api_response = api_instance.send_message_stream_api_v1_chat_message_stream_post(bot_id, message, conversation_id=conversation_id)
        print("The response of ChatApi->send_message_stream_api_v1_chat_message_stream_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatApi->send_message_stream_api_v1_chat_message_stream_post: %s\n" % e)
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

# **upload_document_api_v1_chat_documents_upload_post**
> object upload_document_api_v1_chat_documents_upload_post(dataset_id, document_name, upload)

Upload document to Coze dataset (multipart)

上传文档到数据集（multipart/form-data）。

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
    api_instance = zhs_api.ChatApi(api_client)
    dataset_id = 'dataset_id_example' # str | 
    document_name = 'document_name_example' # str | 
    upload = None # bytes | 

    try:
        # Upload document to Coze dataset (multipart)
        api_response = api_instance.upload_document_api_v1_chat_documents_upload_post(dataset_id, document_name, upload)
        print("The response of ChatApi->upload_document_api_v1_chat_documents_upload_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatApi->upload_document_api_v1_chat_documents_upload_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dataset_id** | **str**|  | 
 **document_name** | **str**|  | 
 **upload** | **bytes**|  | 

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

# **workflow_history_api_v1_chat_workflow_run_history_post**
> object workflow_history_api_v1_chat_workflow_run_history_post(workflow_id, execute_id)

Get Coze workflow run history

获取工作流执行历史。

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
    api_instance = zhs_api.ChatApi(api_client)
    workflow_id = 'workflow_id_example' # str | 
    execute_id = 'execute_id_example' # str | 

    try:
        # Get Coze workflow run history
        api_response = api_instance.workflow_history_api_v1_chat_workflow_run_history_post(workflow_id, execute_id)
        print("The response of ChatApi->workflow_history_api_v1_chat_workflow_run_history_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatApi->workflow_history_api_v1_chat_workflow_run_history_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workflow_id** | **str**|  | 
 **execute_id** | **str**|  | 

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

