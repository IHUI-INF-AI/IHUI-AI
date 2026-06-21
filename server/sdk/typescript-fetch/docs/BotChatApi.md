# BotChatApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**chatWithBotApiV1BotsSendPost**](BotChatApi.md#chatwithbotapiv1botssendpost) | **POST** /api/v1/bots/send | Send message to bot |
| [**listConversationsApiV1BotsConversationsGet**](BotChatApi.md#listconversationsapiv1botsconversationsget) | **GET** /api/v1/bots/conversations | List conversations |
| [**listMessagesApiV1BotsMessagesPost**](BotChatApi.md#listmessagesapiv1botsmessagespost) | **POST** /api/v1/bots/messages | 消息列表 |
| [**messageFeedbackApiV1BotsMessagesFeedbackPost**](BotChatApi.md#messagefeedbackapiv1botsmessagesfeedbackpost) | **POST** /api/v1/bots/messages/feedback | 消息反馈 |
| [**retrieveConversationApiV1BotsRetrievePost**](BotChatApi.md#retrieveconversationapiv1botsretrievepost) | **POST** /api/v1/bots/retrieve | 检索会话 |



## chatWithBotApiV1BotsSendPost

> any chatWithBotApiV1BotsSendPost(botId, message, conversationId)

Send message to bot

### Example

```ts
import {
  Configuration,
  BotChatApi,
} from '';
import type { ChatWithBotApiV1BotsSendPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BotChatApi(config);

  const body = {
    // string
    botId: botId_example,
    // string
    message: message_example,
    // string (optional)
    conversationId: conversationId_example,
  } satisfies ChatWithBotApiV1BotsSendPostRequest;

  try {
    const data = await api.chatWithBotApiV1BotsSendPost(body);
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
| **botId** | `string` |  | [Defaults to `undefined`] |
| **message** | `string` |  | [Defaults to `undefined`] |
| **conversationId** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## listConversationsApiV1BotsConversationsGet

> any listConversationsApiV1BotsConversationsGet(botId, page, size)

List conversations

### Example

```ts
import {
  Configuration,
  BotChatApi,
} from '';
import type { ListConversationsApiV1BotsConversationsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BotChatApi(config);

  const body = {
    // string
    botId: botId_example,
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies ListConversationsApiV1BotsConversationsGetRequest;

  try {
    const data = await api.listConversationsApiV1BotsConversationsGet(body);
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
| **botId** | `string` |  | [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **size** | `number` |  | [Optional] [Defaults to `20`] |

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


## listMessagesApiV1BotsMessagesPost

> any listMessagesApiV1BotsMessagesPost(conversationId, botId, page, size)

消息列表

获取指定会话的消息列表。

### Example

```ts
import {
  Configuration,
  BotChatApi,
} from '';
import type { ListMessagesApiV1BotsMessagesPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BotChatApi(config);

  const body = {
    // string
    conversationId: conversationId_example,
    // string (optional)
    botId: botId_example,
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies ListMessagesApiV1BotsMessagesPostRequest;

  try {
    const data = await api.listMessagesApiV1BotsMessagesPost(body);
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
| **conversationId** | `string` |  | [Defaults to `undefined`] |
| **botId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **size** | `number` |  | [Optional] [Defaults to `20`] |

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


## messageFeedbackApiV1BotsMessagesFeedbackPost

> any messageFeedbackApiV1BotsMessagesFeedbackPost(messageId, conversationId, feedbackType, content)

消息反馈

对消息进行点赞/踩反馈。

### Example

```ts
import {
  Configuration,
  BotChatApi,
} from '';
import type { MessageFeedbackApiV1BotsMessagesFeedbackPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BotChatApi(config);

  const body = {
    // string
    messageId: messageId_example,
    // string
    conversationId: conversationId_example,
    // string | like / dislike
    feedbackType: feedbackType_example,
    // string | 反馈内容 (optional)
    content: content_example,
  } satisfies MessageFeedbackApiV1BotsMessagesFeedbackPostRequest;

  try {
    const data = await api.messageFeedbackApiV1BotsMessagesFeedbackPost(body);
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
| **messageId** | `string` |  | [Defaults to `undefined`] |
| **conversationId** | `string` |  | [Defaults to `undefined`] |
| **feedbackType** | `string` | like / dislike | [Defaults to `undefined`] |
| **content** | `string` | 反馈内容 | [Optional] [Defaults to `&#39;&#39;`] |

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


## retrieveConversationApiV1BotsRetrievePost

> any retrieveConversationApiV1BotsRetrievePost(conversationId)

检索会话

检索指定会话详情。

### Example

```ts
import {
  Configuration,
  BotChatApi,
} from '';
import type { RetrieveConversationApiV1BotsRetrievePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BotChatApi(config);

  const body = {
    // string
    conversationId: conversationId_example,
  } satisfies RetrieveConversationApiV1BotsRetrievePostRequest;

  try {
    const data = await api.retrieveConversationApiV1BotsRetrievePost(body);
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
| **conversationId** | `string` |  | [Defaults to `undefined`] |

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

