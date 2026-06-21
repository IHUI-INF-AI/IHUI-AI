# ChatHistoryApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createChatApiV1ChatCreatePost**](ChatHistoryApi.md#createchatapiv1chatcreatepost) | **POST** /api/v1/chat/create | Create a chat record |
| [**deleteChatApiV1ChatChatIdDelete**](ChatHistoryApi.md#deletechatapiv1chatchatiddelete) | **DELETE** /api/v1/chat/{chat_id} | Delete a chat record |
| [**queryChatsApiV1ChatQueryPost**](ChatHistoryApi.md#querychatsapiv1chatquerypost) | **POST** /api/v1/chat/query | Query chat records |
| [**updateChatMarkApiV1ChatChatIdMarkPut**](ChatHistoryApi.md#updatechatmarkapiv1chatchatidmarkput) | **PUT** /api/v1/chat/{chat_id}/mark | Update chat mark/label |



## createChatApiV1ChatCreatePost

> any createChatApiV1ChatCreatePost(chatCreateBody)

Create a chat record

Create a new user-model chat record.

### Example

```ts
import {
  Configuration,
  ChatHistoryApi,
} from '';
import type { CreateChatApiV1ChatCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatHistoryApi(config);

  const body = {
    // ChatCreateBody
    chatCreateBody: ...,
  } satisfies CreateChatApiV1ChatCreatePostRequest;

  try {
    const data = await api.createChatApiV1ChatCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **chatCreateBody** | [ChatCreateBody](ChatCreateBody.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteChatApiV1ChatChatIdDelete

> any deleteChatApiV1ChatChatIdDelete(chatId)

Delete a chat record

Delete a chat record owned by the authenticated user.

### Example

```ts
import {
  Configuration,
  ChatHistoryApi,
} from '';
import type { DeleteChatApiV1ChatChatIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatHistoryApi(config);

  const body = {
    // number
    chatId: 56,
  } satisfies DeleteChatApiV1ChatChatIdDeleteRequest;

  try {
    const data = await api.deleteChatApiV1ChatChatIdDelete(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **chatId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## queryChatsApiV1ChatQueryPost

> any queryChatsApiV1ChatQueryPost(chatQueryBody, page, limit)

Query chat records

Query chat records for the authenticated user, optionally filtered by model_name. Joins with zhs_ai_model_info to include model source and icon.

### Example

```ts
import {
  Configuration,
  ChatHistoryApi,
} from '';
import type { QueryChatsApiV1ChatQueryPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatHistoryApi(config);

  const body = {
    // ChatQueryBody
    chatQueryBody: ...,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies QueryChatsApiV1ChatQueryPostRequest;

  try {
    const data = await api.queryChatsApiV1ChatQueryPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **chatQueryBody** | [ChatQueryBody](ChatQueryBody.md) |  | |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateChatMarkApiV1ChatChatIdMarkPut

> any updateChatMarkApiV1ChatChatIdMarkPut(chatId, chatMarkBody)

Update chat mark/label

Update the mark (label/summary) of a chat record owned by the user.

### Example

```ts
import {
  Configuration,
  ChatHistoryApi,
} from '';
import type { UpdateChatMarkApiV1ChatChatIdMarkPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatHistoryApi(config);

  const body = {
    // number
    chatId: 56,
    // ChatMarkBody
    chatMarkBody: ...,
  } satisfies UpdateChatMarkApiV1ChatChatIdMarkPutRequest;

  try {
    const data = await api.updateChatMarkApiV1ChatChatIdMarkPut(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **chatId** | `number` |  | [Defaults to `undefined`] |
| **chatMarkBody** | [ChatMarkBody](ChatMarkBody.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

