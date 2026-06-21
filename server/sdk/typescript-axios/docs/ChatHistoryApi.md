# ChatHistoryApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createChatApiV1ChatCreatePost**](#createchatapiv1chatcreatepost) | **POST** /api/v1/chat/create | Create a chat record|
|[**deleteChatApiV1ChatChatIdDelete**](#deletechatapiv1chatchatiddelete) | **DELETE** /api/v1/chat/{chat_id} | Delete a chat record|
|[**queryChatsApiV1ChatQueryPost**](#querychatsapiv1chatquerypost) | **POST** /api/v1/chat/query | Query chat records|
|[**updateChatMarkApiV1ChatChatIdMarkPut**](#updatechatmarkapiv1chatchatidmarkput) | **PUT** /api/v1/chat/{chat_id}/mark | Update chat mark/label|

# **createChatApiV1ChatCreatePost**
> any createChatApiV1ChatCreatePost(chatCreateBody)

Create a new user-model chat record.

### Example

```typescript
import {
    ChatHistoryApi,
    Configuration,
    ChatCreateBody
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatHistoryApi(configuration);

let chatCreateBody: ChatCreateBody; //

const { status, data } = await apiInstance.createChatApiV1ChatCreatePost(
    chatCreateBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **chatCreateBody** | **ChatCreateBody**|  | |


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

# **deleteChatApiV1ChatChatIdDelete**
> any deleteChatApiV1ChatChatIdDelete()

Delete a chat record owned by the authenticated user.

### Example

```typescript
import {
    ChatHistoryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatHistoryApi(configuration);

let chatId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteChatApiV1ChatChatIdDelete(
    chatId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **chatId** | [**number**] |  | defaults to undefined|


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

# **queryChatsApiV1ChatQueryPost**
> any queryChatsApiV1ChatQueryPost(chatQueryBody)

Query chat records for the authenticated user, optionally filtered by model_name. Joins with zhs_ai_model_info to include model source and icon.

### Example

```typescript
import {
    ChatHistoryApi,
    Configuration,
    ChatQueryBody
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatHistoryApi(configuration);

let chatQueryBody: ChatQueryBody; //
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.queryChatsApiV1ChatQueryPost(
    chatQueryBody,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **chatQueryBody** | **ChatQueryBody**|  | |
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

# **updateChatMarkApiV1ChatChatIdMarkPut**
> any updateChatMarkApiV1ChatChatIdMarkPut(chatMarkBody)

Update the mark (label/summary) of a chat record owned by the user.

### Example

```typescript
import {
    ChatHistoryApi,
    Configuration,
    ChatMarkBody
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatHistoryApi(configuration);

let chatId: number; // (default to undefined)
let chatMarkBody: ChatMarkBody; //

const { status, data } = await apiInstance.updateChatMarkApiV1ChatChatIdMarkPut(
    chatId,
    chatMarkBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **chatMarkBody** | **ChatMarkBody**|  | |
| **chatId** | [**number**] |  | defaults to undefined|


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

