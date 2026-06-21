# BotChatApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**chatWithBotApiV1BotsSendPost**](#chatwithbotapiv1botssendpost) | **POST** /api/v1/bots/send | Send message to bot|
|[**listConversationsApiV1BotsConversationsGet**](#listconversationsapiv1botsconversationsget) | **GET** /api/v1/bots/conversations | List conversations|
|[**listMessagesApiV1BotsMessagesPost**](#listmessagesapiv1botsmessagespost) | **POST** /api/v1/bots/messages | 消息列表|
|[**messageFeedbackApiV1BotsMessagesFeedbackPost**](#messagefeedbackapiv1botsmessagesfeedbackpost) | **POST** /api/v1/bots/messages/feedback | 消息反馈|
|[**retrieveConversationApiV1BotsRetrievePost**](#retrieveconversationapiv1botsretrievepost) | **POST** /api/v1/bots/retrieve | 检索会话|

# **chatWithBotApiV1BotsSendPost**
> any chatWithBotApiV1BotsSendPost()


### Example

```typescript
import {
    BotChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BotChatApi(configuration);

let botId: string; // (default to undefined)
let message: string; // (default to undefined)
let conversationId: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.chatWithBotApiV1BotsSendPost(
    botId,
    message,
    conversationId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **botId** | [**string**] |  | defaults to undefined|
| **message** | [**string**] |  | defaults to undefined|
| **conversationId** | [**string**] |  | (optional) defaults to undefined|


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

# **listConversationsApiV1BotsConversationsGet**
> any listConversationsApiV1BotsConversationsGet()


### Example

```typescript
import {
    BotChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BotChatApi(configuration);

let botId: string; // (default to undefined)
let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listConversationsApiV1BotsConversationsGet(
    botId,
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **botId** | [**string**] |  | defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **size** | [**number**] |  | (optional) defaults to 20|


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

# **listMessagesApiV1BotsMessagesPost**
> any listMessagesApiV1BotsMessagesPost()

获取指定会话的消息列表。

### Example

```typescript
import {
    BotChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BotChatApi(configuration);

let conversationId: string; // (default to undefined)
let botId: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listMessagesApiV1BotsMessagesPost(
    conversationId,
    botId,
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **conversationId** | [**string**] |  | defaults to undefined|
| **botId** | [**string**] |  | (optional) defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **size** | [**number**] |  | (optional) defaults to 20|


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

# **messageFeedbackApiV1BotsMessagesFeedbackPost**
> any messageFeedbackApiV1BotsMessagesFeedbackPost()

对消息进行点赞/踩反馈。

### Example

```typescript
import {
    BotChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BotChatApi(configuration);

let messageId: string; // (default to undefined)
let conversationId: string; // (default to undefined)
let feedbackType: string; //like / dislike (default to undefined)
let content: string; //反馈内容 (optional) (default to '')

const { status, data } = await apiInstance.messageFeedbackApiV1BotsMessagesFeedbackPost(
    messageId,
    conversationId,
    feedbackType,
    content
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **messageId** | [**string**] |  | defaults to undefined|
| **conversationId** | [**string**] |  | defaults to undefined|
| **feedbackType** | [**string**] | like / dislike | defaults to undefined|
| **content** | [**string**] | 反馈内容 | (optional) defaults to ''|


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

# **retrieveConversationApiV1BotsRetrievePost**
> any retrieveConversationApiV1BotsRetrievePost()

检索指定会话详情。

### Example

```typescript
import {
    BotChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BotChatApi(configuration);

let conversationId: string; // (default to undefined)

const { status, data } = await apiInstance.retrieveConversationApiV1BotsRetrievePost(
    conversationId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **conversationId** | [**string**] |  | defaults to undefined|


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

