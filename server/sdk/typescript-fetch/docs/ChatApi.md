# ChatApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**chatWithBillingApiV1ChatChatWithBillingPost**](ChatApi.md#chatwithbillingapiv1chatchatwithbillingpost) | **POST** /api/v1/chat/chat-with-billing | Chat with token billing |
| [**createConversationApiV1ChatConversationCreatePost**](ChatApi.md#createconversationapiv1chatconversationcreatepost) | **POST** /api/v1/chat/conversation/create | Create Coze conversation |
| [**createDatasetApiV1ChatDatasetsCreatePost**](ChatApi.md#createdatasetapiv1chatdatasetscreatepost) | **POST** /api/v1/chat/datasets/create | Create Coze dataset |
| [**listConversationsApiV1ChatConversationsListPost**](ChatApi.md#listconversationsapiv1chatconversationslistpost) | **POST** /api/v1/chat/conversations/list | List Coze conversations |
| [**listDatasetsApiV1ChatDatasetsListPost**](ChatApi.md#listdatasetsapiv1chatdatasetslistpost) | **POST** /api/v1/chat/datasets/list | List Coze datasets |
| [**listDocumentsApiV1ChatDocumentsListPost**](ChatApi.md#listdocumentsapiv1chatdocumentslistpost) | **POST** /api/v1/chat/documents/list | List Coze dataset documents |
| [**listMessagesApiV1ChatMessagesListPost**](ChatApi.md#listmessagesapiv1chatmessageslistpost) | **POST** /api/v1/chat/messages/list | List Coze conversation messages |
| [**messageFeedbackApiV1ChatMessagesFeedbackPost**](ChatApi.md#messagefeedbackapiv1chatmessagesfeedbackpost) | **POST** /api/v1/chat/messages/feedback | Coze message feedback |
| [**resumeWorkflowApiV1ChatWorkflowRunResumePost**](ChatApi.md#resumeworkflowapiv1chatworkflowrunresumepost) | **POST** /api/v1/chat/workflow/run/resume | Resume interrupted Coze workflow |
| [**resumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost**](ChatApi.md#resumeworkflowstreamapiv1chatworkflowrunresumestreampost) | **POST** /api/v1/chat/workflow/run/resume/stream | Resume interrupted Coze workflow (stream) |
| [**retrieveConversationApiV1ChatConversationsRetrievePost**](ChatApi.md#retrieveconversationapiv1chatconversationsretrievepost) | **POST** /api/v1/chat/conversations/retrieve | Retrieve Coze conversation |
| [**runWorkflowApiV1ChatWorkflowRunPost**](ChatApi.md#runworkflowapiv1chatworkflowrunpost) | **POST** /api/v1/chat/workflow/run | Run Coze workflow (sync) |
| [**runWorkflowStreamApiV1ChatWorkflowRunStreamPost**](ChatApi.md#runworkflowstreamapiv1chatworkflowrunstreampost) | **POST** /api/v1/chat/workflow/run/stream | Run Coze workflow (stream) |
| [**sendMessageApiV1ChatMessagePost**](ChatApi.md#sendmessageapiv1chatmessagepost) | **POST** /api/v1/chat/message | Send chat message via Coze (sync) |
| [**sendMessageStreamApiV1ChatMessageStreamPost**](ChatApi.md#sendmessagestreamapiv1chatmessagestreampost) | **POST** /api/v1/chat/message/stream | Send chat message via Coze (SSE stream) |
| [**uploadDocumentApiV1ChatDocumentsUploadPost**](ChatApi.md#uploaddocumentapiv1chatdocumentsuploadpost) | **POST** /api/v1/chat/documents/upload | Upload document to Coze dataset (multipart) |
| [**workflowHistoryApiV1ChatWorkflowRunHistoryPost**](ChatApi.md#workflowhistoryapiv1chatworkflowrunhistorypost) | **POST** /api/v1/chat/workflow/run/history | Get Coze workflow run history |



## chatWithBillingApiV1ChatChatWithBillingPost

> any chatWithBillingApiV1ChatChatWithBillingPost(botId, message, costTokens)

Chat with token billing

带计费的聊天：先扣 token，再转发到 Coze。

### Example

```ts
import {
  Configuration,
  ChatApi,
} from '';
import type { ChatWithBillingApiV1ChatChatWithBillingPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatApi(config);

  const body = {
    // string
    botId: botId_example,
    // string
    message: message_example,
    // number | 本次聊天扣减 token 数 (optional)
    costTokens: 56,
  } satisfies ChatWithBillingApiV1ChatChatWithBillingPostRequest;

  try {
    const data = await api.chatWithBillingApiV1ChatChatWithBillingPost(body);
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
| **costTokens** | `number` | 本次聊天扣减 token 数 | [Optional] [Defaults to `100`] |

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


## createConversationApiV1ChatConversationCreatePost

> any createConversationApiV1ChatConversationCreatePost(botId)

Create Coze conversation

### Example

```ts
import {
  Configuration,
  ChatApi,
} from '';
import type { CreateConversationApiV1ChatConversationCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatApi(config);

  const body = {
    // string
    botId: botId_example,
  } satisfies CreateConversationApiV1ChatConversationCreatePostRequest;

  try {
    const data = await api.createConversationApiV1ChatConversationCreatePost(body);
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


## createDatasetApiV1ChatDatasetsCreatePost

> any createDatasetApiV1ChatDatasetsCreatePost(name, spaceId)

Create Coze dataset

创建数据集。

### Example

```ts
import {
  Configuration,
  ChatApi,
} from '';
import type { CreateDatasetApiV1ChatDatasetsCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatApi(config);

  const body = {
    // string
    name: name_example,
    // string | Workspace ID, defaults to configured account (optional)
    spaceId: spaceId_example,
  } satisfies CreateDatasetApiV1ChatDatasetsCreatePostRequest;

  try {
    const data = await api.createDatasetApiV1ChatDatasetsCreatePost(body);
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
| **name** | `string` |  | [Defaults to `undefined`] |
| **spaceId** | `string` | Workspace ID, defaults to configured account | [Optional] [Defaults to `&#39;&#39;`] |

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


## listConversationsApiV1ChatConversationsListPost

> any listConversationsApiV1ChatConversationsListPost(botId, userId, page, size)

List Coze conversations

获取对话列表。

### Example

```ts
import {
  Configuration,
  ChatApi,
} from '';
import type { ListConversationsApiV1ChatConversationsListPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatApi(config);

  const body = {
    // string
    botId: botId_example,
    // string
    userId: userId_example,
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies ListConversationsApiV1ChatConversationsListPostRequest;

  try {
    const data = await api.listConversationsApiV1ChatConversationsListPost(body);
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
| **userId** | `string` |  | [Defaults to `undefined`] |
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


## listDatasetsApiV1ChatDatasetsListPost

> any listDatasetsApiV1ChatDatasetsListPost(spaceId, page, size)

List Coze datasets

获取数据集列表。

### Example

```ts
import {
  Configuration,
  ChatApi,
} from '';
import type { ListDatasetsApiV1ChatDatasetsListPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatApi(config);

  const body = {
    // string | Workspace ID (optional)
    spaceId: spaceId_example,
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies ListDatasetsApiV1ChatDatasetsListPostRequest;

  try {
    const data = await api.listDatasetsApiV1ChatDatasetsListPost(body);
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
| **spaceId** | `string` | Workspace ID | [Optional] [Defaults to `&#39;&#39;`] |
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


## listDocumentsApiV1ChatDocumentsListPost

> any listDocumentsApiV1ChatDocumentsListPost(datasetId, page, size)

List Coze dataset documents

获取数据集下的文档列表。

### Example

```ts
import {
  Configuration,
  ChatApi,
} from '';
import type { ListDocumentsApiV1ChatDocumentsListPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatApi(config);

  const body = {
    // string
    datasetId: datasetId_example,
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies ListDocumentsApiV1ChatDocumentsListPostRequest;

  try {
    const data = await api.listDocumentsApiV1ChatDocumentsListPost(body);
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
| **datasetId** | `string` |  | [Defaults to `undefined`] |
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


## listMessagesApiV1ChatMessagesListPost

> any listMessagesApiV1ChatMessagesListPost(conversationId, botId, page, size)

List Coze conversation messages

获取对话消息列表。

### Example

```ts
import {
  Configuration,
  ChatApi,
} from '';
import type { ListMessagesApiV1ChatMessagesListPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatApi(config);

  const body = {
    // string
    conversationId: conversationId_example,
    // string (optional)
    botId: botId_example,
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies ListMessagesApiV1ChatMessagesListPostRequest;

  try {
    const data = await api.listMessagesApiV1ChatMessagesListPost(body);
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
| **botId** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
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


## messageFeedbackApiV1ChatMessagesFeedbackPost

> any messageFeedbackApiV1ChatMessagesFeedbackPost(messageId, conversationId, feedbackType, content)

Coze message feedback

消息反馈（点赞/点踩）。

### Example

```ts
import {
  Configuration,
  ChatApi,
} from '';
import type { MessageFeedbackApiV1ChatMessagesFeedbackPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatApi(config);

  const body = {
    // string
    messageId: messageId_example,
    // string
    conversationId: conversationId_example,
    // string | like / dislike
    feedbackType: feedbackType_example,
    // string (optional)
    content: content_example,
  } satisfies MessageFeedbackApiV1ChatMessagesFeedbackPostRequest;

  try {
    const data = await api.messageFeedbackApiV1ChatMessagesFeedbackPost(body);
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
| **content** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |

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


## resumeWorkflowApiV1ChatWorkflowRunResumePost

> any resumeWorkflowApiV1ChatWorkflowRunResumePost(workflowId, eventId, interruptType, resumeData)

Resume interrupted Coze workflow

恢复被中断的工作流。

### Example

```ts
import {
  Configuration,
  ChatApi,
} from '';
import type { ResumeWorkflowApiV1ChatWorkflowRunResumePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatApi(config);

  const body = {
    // string
    workflowId: workflowId_example,
    // string
    eventId: eventId_example,
    // string
    interruptType: interruptType_example,
    // string | JSON string (optional)
    resumeData: resumeData_example,
  } satisfies ResumeWorkflowApiV1ChatWorkflowRunResumePostRequest;

  try {
    const data = await api.resumeWorkflowApiV1ChatWorkflowRunResumePost(body);
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
| **workflowId** | `string` |  | [Defaults to `undefined`] |
| **eventId** | `string` |  | [Defaults to `undefined`] |
| **interruptType** | `string` |  | [Defaults to `undefined`] |
| **resumeData** | `string` | JSON string | [Optional] [Defaults to `&#39;{}&#39;`] |

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


## resumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost

> any resumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost(workflowId, eventId, interruptType, resumeData)

Resume interrupted Coze workflow (stream)

流式恢复被中断的工作流。

### Example

```ts
import {
  Configuration,
  ChatApi,
} from '';
import type { ResumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatApi(config);

  const body = {
    // string
    workflowId: workflowId_example,
    // string
    eventId: eventId_example,
    // string
    interruptType: interruptType_example,
    // string | JSON string (optional)
    resumeData: resumeData_example,
  } satisfies ResumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPostRequest;

  try {
    const data = await api.resumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost(body);
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
| **workflowId** | `string` |  | [Defaults to `undefined`] |
| **eventId** | `string` |  | [Defaults to `undefined`] |
| **interruptType** | `string` |  | [Defaults to `undefined`] |
| **resumeData** | `string` | JSON string | [Optional] [Defaults to `&#39;{}&#39;`] |

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


## retrieveConversationApiV1ChatConversationsRetrievePost

> any retrieveConversationApiV1ChatConversationsRetrievePost(conversationId)

Retrieve Coze conversation

获取对话详情。

### Example

```ts
import {
  Configuration,
  ChatApi,
} from '';
import type { RetrieveConversationApiV1ChatConversationsRetrievePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatApi(config);

  const body = {
    // string
    conversationId: conversationId_example,
  } satisfies RetrieveConversationApiV1ChatConversationsRetrievePostRequest;

  try {
    const data = await api.retrieveConversationApiV1ChatConversationsRetrievePost(body);
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


## runWorkflowApiV1ChatWorkflowRunPost

> any runWorkflowApiV1ChatWorkflowRunPost(workflowId, parameters)

Run Coze workflow (sync)

### Example

```ts
import {
  Configuration,
  ChatApi,
} from '';
import type { RunWorkflowApiV1ChatWorkflowRunPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatApi(config);

  const body = {
    // string
    workflowId: workflowId_example,
    // string | JSON 字符串 (optional)
    parameters: parameters_example,
  } satisfies RunWorkflowApiV1ChatWorkflowRunPostRequest;

  try {
    const data = await api.runWorkflowApiV1ChatWorkflowRunPost(body);
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
| **workflowId** | `string` |  | [Defaults to `undefined`] |
| **parameters** | `string` | JSON 字符串 | [Optional] [Defaults to `&#39;{}&#39;`] |

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


## runWorkflowStreamApiV1ChatWorkflowRunStreamPost

> any runWorkflowStreamApiV1ChatWorkflowRunStreamPost(workflowId, parameters)

Run Coze workflow (stream)

### Example

```ts
import {
  Configuration,
  ChatApi,
} from '';
import type { RunWorkflowStreamApiV1ChatWorkflowRunStreamPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatApi(config);

  const body = {
    // string
    workflowId: workflowId_example,
    // string (optional)
    parameters: parameters_example,
  } satisfies RunWorkflowStreamApiV1ChatWorkflowRunStreamPostRequest;

  try {
    const data = await api.runWorkflowStreamApiV1ChatWorkflowRunStreamPost(body);
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
| **workflowId** | `string` |  | [Defaults to `undefined`] |
| **parameters** | `string` |  | [Optional] [Defaults to `&#39;{}&#39;`] |

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


## sendMessageApiV1ChatMessagePost

> any sendMessageApiV1ChatMessagePost(botId, message, conversationId)

Send chat message via Coze (sync)

### Example

```ts
import {
  Configuration,
  ChatApi,
} from '';
import type { SendMessageApiV1ChatMessagePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatApi(config);

  const body = {
    // string
    botId: botId_example,
    // string
    message: message_example,
    // string (optional)
    conversationId: conversationId_example,
  } satisfies SendMessageApiV1ChatMessagePostRequest;

  try {
    const data = await api.sendMessageApiV1ChatMessagePost(body);
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


## sendMessageStreamApiV1ChatMessageStreamPost

> any sendMessageStreamApiV1ChatMessageStreamPost(botId, message, conversationId)

Send chat message via Coze (SSE stream)

流式聊天：通过 SSE 把 Coze 增量事件转发给前端。

### Example

```ts
import {
  Configuration,
  ChatApi,
} from '';
import type { SendMessageStreamApiV1ChatMessageStreamPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatApi(config);

  const body = {
    // string
    botId: botId_example,
    // string
    message: message_example,
    // string (optional)
    conversationId: conversationId_example,
  } satisfies SendMessageStreamApiV1ChatMessageStreamPostRequest;

  try {
    const data = await api.sendMessageStreamApiV1ChatMessageStreamPost(body);
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


## uploadDocumentApiV1ChatDocumentsUploadPost

> any uploadDocumentApiV1ChatDocumentsUploadPost(datasetId, documentName, upload)

Upload document to Coze dataset (multipart)

上传文档到数据集（multipart/form-data）。

### Example

```ts
import {
  Configuration,
  ChatApi,
} from '';
import type { UploadDocumentApiV1ChatDocumentsUploadPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatApi(config);

  const body = {
    // string
    datasetId: datasetId_example,
    // string
    documentName: documentName_example,
    // Blob
    upload: BINARY_DATA_HERE,
  } satisfies UploadDocumentApiV1ChatDocumentsUploadPostRequest;

  try {
    const data = await api.uploadDocumentApiV1ChatDocumentsUploadPost(body);
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
| **datasetId** | `string` |  | [Defaults to `undefined`] |
| **documentName** | `string` |  | [Defaults to `undefined`] |
| **upload** | `Blob` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## workflowHistoryApiV1ChatWorkflowRunHistoryPost

> any workflowHistoryApiV1ChatWorkflowRunHistoryPost(workflowId, executeId)

Get Coze workflow run history

获取工作流执行历史。

### Example

```ts
import {
  Configuration,
  ChatApi,
} from '';
import type { WorkflowHistoryApiV1ChatWorkflowRunHistoryPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ChatApi(config);

  const body = {
    // string
    workflowId: workflowId_example,
    // string
    executeId: executeId_example,
  } satisfies WorkflowHistoryApiV1ChatWorkflowRunHistoryPostRequest;

  try {
    const data = await api.workflowHistoryApiV1ChatWorkflowRunHistoryPost(body);
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
| **workflowId** | `string` |  | [Defaults to `undefined`] |
| **executeId** | `string` |  | [Defaults to `undefined`] |

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

