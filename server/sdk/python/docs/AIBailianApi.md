# zhs_api.AIBailianApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**bailian_chat_api_v1_ai_bailian_chat_post**](AIBailianApi.md#bailian_chat_api_v1_ai_bailian_chat_post) | **POST** /api/v1/ai/bailian/chat | 百炼应用对话


# **bailian_chat_api_v1_ai_bailian_chat_post**
> object bailian_chat_api_v1_ai_bailian_chat_post(bailian_chat_request)

百炼应用对话

Send a chat request to a Bailian (DashScope) application via HTTP.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.bailian_chat_request import BailianChatRequest
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
    api_instance = zhs_api.AIBailianApi(api_client)
    bailian_chat_request = zhs_api.BailianChatRequest() # BailianChatRequest | 

    try:
        # 百炼应用对话
        api_response = api_instance.bailian_chat_api_v1_ai_bailian_chat_post(bailian_chat_request)
        print("The response of AIBailianApi->bailian_chat_api_v1_ai_bailian_chat_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AIBailianApi->bailian_chat_api_v1_ai_bailian_chat_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bailian_chat_request** | [**BailianChatRequest**](BailianChatRequest.md)|  | 

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

