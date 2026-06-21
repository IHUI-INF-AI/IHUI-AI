# zhs_api.ChatHistoryApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_chat_api_v1_chat_create_post**](ChatHistoryApi.md#create_chat_api_v1_chat_create_post) | **POST** /api/v1/chat/create | Create a chat record
[**delete_chat_api_v1_chat_chat_id_delete**](ChatHistoryApi.md#delete_chat_api_v1_chat_chat_id_delete) | **DELETE** /api/v1/chat/{chat_id} | Delete a chat record
[**query_chats_api_v1_chat_query_post**](ChatHistoryApi.md#query_chats_api_v1_chat_query_post) | **POST** /api/v1/chat/query | Query chat records
[**update_chat_mark_api_v1_chat_chat_id_mark_put**](ChatHistoryApi.md#update_chat_mark_api_v1_chat_chat_id_mark_put) | **PUT** /api/v1/chat/{chat_id}/mark | Update chat mark/label


# **create_chat_api_v1_chat_create_post**
> object create_chat_api_v1_chat_create_post(chat_create_body)

Create a chat record

Create a new user-model chat record.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.chat_create_body import ChatCreateBody
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
    api_instance = zhs_api.ChatHistoryApi(api_client)
    chat_create_body = zhs_api.ChatCreateBody() # ChatCreateBody | 

    try:
        # Create a chat record
        api_response = api_instance.create_chat_api_v1_chat_create_post(chat_create_body)
        print("The response of ChatHistoryApi->create_chat_api_v1_chat_create_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatHistoryApi->create_chat_api_v1_chat_create_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **chat_create_body** | [**ChatCreateBody**](ChatCreateBody.md)|  | 

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

# **delete_chat_api_v1_chat_chat_id_delete**
> object delete_chat_api_v1_chat_chat_id_delete(chat_id)

Delete a chat record

Delete a chat record owned by the authenticated user.

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
    api_instance = zhs_api.ChatHistoryApi(api_client)
    chat_id = 56 # int | 

    try:
        # Delete a chat record
        api_response = api_instance.delete_chat_api_v1_chat_chat_id_delete(chat_id)
        print("The response of ChatHistoryApi->delete_chat_api_v1_chat_chat_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatHistoryApi->delete_chat_api_v1_chat_chat_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **chat_id** | **int**|  | 

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

# **query_chats_api_v1_chat_query_post**
> object query_chats_api_v1_chat_query_post(chat_query_body, page=page, limit=limit)

Query chat records

Query chat records for the authenticated user, optionally filtered by model_name.
Joins with zhs_ai_model_info to include model source and icon.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.chat_query_body import ChatQueryBody
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
    api_instance = zhs_api.ChatHistoryApi(api_client)
    chat_query_body = zhs_api.ChatQueryBody() # ChatQueryBody | 
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # Query chat records
        api_response = api_instance.query_chats_api_v1_chat_query_post(chat_query_body, page=page, limit=limit)
        print("The response of ChatHistoryApi->query_chats_api_v1_chat_query_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatHistoryApi->query_chats_api_v1_chat_query_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **chat_query_body** | [**ChatQueryBody**](ChatQueryBody.md)|  | 
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]

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

# **update_chat_mark_api_v1_chat_chat_id_mark_put**
> object update_chat_mark_api_v1_chat_chat_id_mark_put(chat_id, chat_mark_body)

Update chat mark/label

Update the mark (label/summary) of a chat record owned by the user.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.chat_mark_body import ChatMarkBody
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
    api_instance = zhs_api.ChatHistoryApi(api_client)
    chat_id = 56 # int | 
    chat_mark_body = zhs_api.ChatMarkBody() # ChatMarkBody | 

    try:
        # Update chat mark/label
        api_response = api_instance.update_chat_mark_api_v1_chat_chat_id_mark_put(chat_id, chat_mark_body)
        print("The response of ChatHistoryApi->update_chat_mark_api_v1_chat_chat_id_mark_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ChatHistoryApi->update_chat_mark_api_v1_chat_chat_id_mark_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **chat_id** | **int**|  | 
 **chat_mark_body** | [**ChatMarkBody**](ChatMarkBody.md)|  | 

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

