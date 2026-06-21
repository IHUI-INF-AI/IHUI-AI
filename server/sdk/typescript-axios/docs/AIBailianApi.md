# AIBailianApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**bailianChatApiV1AiBailianChatPost**](#bailianchatapiv1aibailianchatpost) | **POST** /api/v1/ai/bailian/chat | 百炼应用对话|

# **bailianChatApiV1AiBailianChatPost**
> any bailianChatApiV1AiBailianChatPost(bailianChatRequest)

Send a chat request to a Bailian (DashScope) application via HTTP.

### Example

```typescript
import {
    AIBailianApi,
    Configuration,
    BailianChatRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIBailianApi(configuration);

let bailianChatRequest: BailianChatRequest; //

const { status, data } = await apiInstance.bailianChatApiV1AiBailianChatPost(
    bailianChatRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bailianChatRequest** | **BailianChatRequest**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

