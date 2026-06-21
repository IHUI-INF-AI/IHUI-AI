# zhs_api.CozeConversationsApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_feedback_api_v1_coze_conversations_conversations_messages_feedback_post**](CozeConversationsApi.md#create_feedback_api_v1_coze_conversations_conversations_messages_feedback_post) | **POST** /api/v1/coze/conversations/conversations/messages/feedback | Create Feedback
[**list_conversations_api_v1_coze_conversations_conversations_post**](CozeConversationsApi.md#list_conversations_api_v1_coze_conversations_conversations_post) | **POST** /api/v1/coze/conversations/conversations | List Conversations
[**list_messages_api_v1_coze_conversations_conversations_messages_post**](CozeConversationsApi.md#list_messages_api_v1_coze_conversations_conversations_messages_post) | **POST** /api/v1/coze/conversations/conversations/messages | List Messages
[**retrieve_conversation_api_v1_coze_conversations_conversations_retrieve_post**](CozeConversationsApi.md#retrieve_conversation_api_v1_coze_conversations_conversations_retrieve_post) | **POST** /api/v1/coze/conversations/conversations/retrieve | Retrieve Conversation


# **create_feedback_api_v1_coze_conversations_conversations_messages_feedback_post**
> object create_feedback_api_v1_coze_conversations_conversations_messages_feedback_post(feedback_req)

Create Feedback

### Example


```python
import zhs_api
from zhs_api.models.feedback_req import FeedbackReq
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
    api_instance = zhs_api.CozeConversationsApi(api_client)
    feedback_req = zhs_api.FeedbackReq() # FeedbackReq | 

    try:
        # Create Feedback
        api_response = api_instance.create_feedback_api_v1_coze_conversations_conversations_messages_feedback_post(feedback_req)
        print("The response of CozeConversationsApi->create_feedback_api_v1_coze_conversations_conversations_messages_feedback_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeConversationsApi->create_feedback_api_v1_coze_conversations_conversations_messages_feedback_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **feedback_req** | [**FeedbackReq**](FeedbackReq.md)|  | 

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

# **list_conversations_api_v1_coze_conversations_conversations_post**
> object list_conversations_api_v1_coze_conversations_conversations_post(list_conv_req)

List Conversations

### Example


```python
import zhs_api
from zhs_api.models.list_conv_req import ListConvReq
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
    api_instance = zhs_api.CozeConversationsApi(api_client)
    list_conv_req = zhs_api.ListConvReq() # ListConvReq | 

    try:
        # List Conversations
        api_response = api_instance.list_conversations_api_v1_coze_conversations_conversations_post(list_conv_req)
        print("The response of CozeConversationsApi->list_conversations_api_v1_coze_conversations_conversations_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeConversationsApi->list_conversations_api_v1_coze_conversations_conversations_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **list_conv_req** | [**ListConvReq**](ListConvReq.md)|  | 

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

# **list_messages_api_v1_coze_conversations_conversations_messages_post**
> object list_messages_api_v1_coze_conversations_conversations_messages_post(list_msg_req)

List Messages

### Example


```python
import zhs_api
from zhs_api.models.list_msg_req import ListMsgReq
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
    api_instance = zhs_api.CozeConversationsApi(api_client)
    list_msg_req = zhs_api.ListMsgReq() # ListMsgReq | 

    try:
        # List Messages
        api_response = api_instance.list_messages_api_v1_coze_conversations_conversations_messages_post(list_msg_req)
        print("The response of CozeConversationsApi->list_messages_api_v1_coze_conversations_conversations_messages_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeConversationsApi->list_messages_api_v1_coze_conversations_conversations_messages_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **list_msg_req** | [**ListMsgReq**](ListMsgReq.md)|  | 

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

# **retrieve_conversation_api_v1_coze_conversations_conversations_retrieve_post**
> object retrieve_conversation_api_v1_coze_conversations_conversations_retrieve_post(retrieve_req)

Retrieve Conversation

### Example


```python
import zhs_api
from zhs_api.models.retrieve_req import RetrieveReq
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
    api_instance = zhs_api.CozeConversationsApi(api_client)
    retrieve_req = zhs_api.RetrieveReq() # RetrieveReq | 

    try:
        # Retrieve Conversation
        api_response = api_instance.retrieve_conversation_api_v1_coze_conversations_conversations_retrieve_post(retrieve_req)
        print("The response of CozeConversationsApi->retrieve_conversation_api_v1_coze_conversations_conversations_retrieve_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeConversationsApi->retrieve_conversation_api_v1_coze_conversations_conversations_retrieve_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **retrieve_req** | [**RetrieveReq**](RetrieveReq.md)|  | 

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

