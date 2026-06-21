# DeepSeekChatApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**deepseekChatApiV1ChatChatPost**](#deepseekchatapiv1chatchatpost) | **POST** /api/v1/chat/chat | DeepSeek 同步聊天|
|[**deepseekChatStreamApiV1ChatChatStreamPost**](#deepseekchatstreamapiv1chatchatstreampost) | **POST** /api/v1/chat/chat/stream | DeepSeek 流式聊天（SSE）|

# **deepseekChatApiV1ChatChatPost**
> any deepseekChatApiV1ChatChatPost()


### Example

```typescript
import {
    DeepSeekChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DeepSeekChatApi(configuration);

let message: string; // (default to undefined)
let model: string; // (optional) (default to 'deepseek-chat')

const { status, data } = await apiInstance.deepseekChatApiV1ChatChatPost(
    message,
    model
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **message** | [**string**] |  | defaults to undefined|
| **model** | [**string**] |  | (optional) defaults to 'deepseek-chat'|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deepseekChatStreamApiV1ChatChatStreamPost**
> any deepseekChatStreamApiV1ChatChatStreamPost()


### Example

```typescript
import {
    DeepSeekChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DeepSeekChatApi(configuration);

let message: string; // (default to undefined)
let model: string; // (optional) (default to 'deepseek-chat')

const { status, data } = await apiInstance.deepseekChatStreamApiV1ChatChatStreamPost(
    message,
    model
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **message** | [**string**] |  | defaults to undefined|
| **model** | [**string**] |  | (optional) defaults to 'deepseek-chat'|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

