# ChatApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**chatWithBillingApiV1ChatChatWithBillingPost**](#chatwithbillingapiv1chatchatwithbillingpost) | **POST** /api/v1/chat/chat-with-billing | Chat with token billing|
|[**createConversationApiV1ChatConversationCreatePost**](#createconversationapiv1chatconversationcreatepost) | **POST** /api/v1/chat/conversation/create | Create Coze conversation|
|[**createDatasetApiV1ChatDatasetsCreatePost**](#createdatasetapiv1chatdatasetscreatepost) | **POST** /api/v1/chat/datasets/create | Create Coze dataset|
|[**listConversationsApiV1ChatConversationsListPost**](#listconversationsapiv1chatconversationslistpost) | **POST** /api/v1/chat/conversations/list | List Coze conversations|
|[**listDatasetsApiV1ChatDatasetsListPost**](#listdatasetsapiv1chatdatasetslistpost) | **POST** /api/v1/chat/datasets/list | List Coze datasets|
|[**listDocumentsApiV1ChatDocumentsListPost**](#listdocumentsapiv1chatdocumentslistpost) | **POST** /api/v1/chat/documents/list | List Coze dataset documents|
|[**listMessagesApiV1ChatMessagesListPost**](#listmessagesapiv1chatmessageslistpost) | **POST** /api/v1/chat/messages/list | List Coze conversation messages|
|[**messageFeedbackApiV1ChatMessagesFeedbackPost**](#messagefeedbackapiv1chatmessagesfeedbackpost) | **POST** /api/v1/chat/messages/feedback | Coze message feedback|
|[**resumeWorkflowApiV1ChatWorkflowRunResumePost**](#resumeworkflowapiv1chatworkflowrunresumepost) | **POST** /api/v1/chat/workflow/run/resume | Resume interrupted Coze workflow|
|[**resumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost**](#resumeworkflowstreamapiv1chatworkflowrunresumestreampost) | **POST** /api/v1/chat/workflow/run/resume/stream | Resume interrupted Coze workflow (stream)|
|[**retrieveConversationApiV1ChatConversationsRetrievePost**](#retrieveconversationapiv1chatconversationsretrievepost) | **POST** /api/v1/chat/conversations/retrieve | Retrieve Coze conversation|
|[**runWorkflowApiV1ChatWorkflowRunPost**](#runworkflowapiv1chatworkflowrunpost) | **POST** /api/v1/chat/workflow/run | Run Coze workflow (sync)|
|[**runWorkflowStreamApiV1ChatWorkflowRunStreamPost**](#runworkflowstreamapiv1chatworkflowrunstreampost) | **POST** /api/v1/chat/workflow/run/stream | Run Coze workflow (stream)|
|[**sendMessageApiV1ChatMessagePost**](#sendmessageapiv1chatmessagepost) | **POST** /api/v1/chat/message | Send chat message via Coze (sync)|
|[**sendMessageStreamApiV1ChatMessageStreamPost**](#sendmessagestreamapiv1chatmessagestreampost) | **POST** /api/v1/chat/message/stream | Send chat message via Coze (SSE stream)|
|[**uploadDocumentApiV1ChatDocumentsUploadPost**](#uploaddocumentapiv1chatdocumentsuploadpost) | **POST** /api/v1/chat/documents/upload | Upload document to Coze dataset (multipart)|
|[**workflowHistoryApiV1ChatWorkflowRunHistoryPost**](#workflowhistoryapiv1chatworkflowrunhistorypost) | **POST** /api/v1/chat/workflow/run/history | Get Coze workflow run history|

# **chatWithBillingApiV1ChatChatWithBillingPost**
> any chatWithBillingApiV1ChatChatWithBillingPost()

带计费的聊天：先扣 token，再转发到 Coze。

### Example

```typescript
import {
    ChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatApi(configuration);

let botId: string; // (default to undefined)
let message: string; // (default to undefined)
let costTokens: number; //本次聊天扣减 token 数 (optional) (default to 100)

const { status, data } = await apiInstance.chatWithBillingApiV1ChatChatWithBillingPost(
    botId,
    message,
    costTokens
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **botId** | [**string**] |  | defaults to undefined|
| **message** | [**string**] |  | defaults to undefined|
| **costTokens** | [**number**] | 本次聊天扣减 token 数 | (optional) defaults to 100|


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

# **createConversationApiV1ChatConversationCreatePost**
> any createConversationApiV1ChatConversationCreatePost()


### Example

```typescript
import {
    ChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatApi(configuration);

let botId: string; // (default to undefined)

const { status, data } = await apiInstance.createConversationApiV1ChatConversationCreatePost(
    botId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **botId** | [**string**] |  | defaults to undefined|


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

# **createDatasetApiV1ChatDatasetsCreatePost**
> any createDatasetApiV1ChatDatasetsCreatePost()

创建数据集。

### Example

```typescript
import {
    ChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatApi(configuration);

let name: string; // (default to undefined)
let spaceId: string; //Workspace ID, defaults to configured account (optional) (default to '')

const { status, data } = await apiInstance.createDatasetApiV1ChatDatasetsCreatePost(
    name,
    spaceId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | defaults to undefined|
| **spaceId** | [**string**] | Workspace ID, defaults to configured account | (optional) defaults to ''|


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

# **listConversationsApiV1ChatConversationsListPost**
> any listConversationsApiV1ChatConversationsListPost()

获取对话列表。

### Example

```typescript
import {
    ChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatApi(configuration);

let botId: string; // (default to undefined)
let userId: string; // (default to undefined)
let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listConversationsApiV1ChatConversationsListPost(
    botId,
    userId,
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **botId** | [**string**] |  | defaults to undefined|
| **userId** | [**string**] |  | defaults to undefined|
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

# **listDatasetsApiV1ChatDatasetsListPost**
> any listDatasetsApiV1ChatDatasetsListPost()

获取数据集列表。

### Example

```typescript
import {
    ChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatApi(configuration);

let spaceId: string; //Workspace ID (optional) (default to '')
let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listDatasetsApiV1ChatDatasetsListPost(
    spaceId,
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **spaceId** | [**string**] | Workspace ID | (optional) defaults to ''|
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

# **listDocumentsApiV1ChatDocumentsListPost**
> any listDocumentsApiV1ChatDocumentsListPost()

获取数据集下的文档列表。

### Example

```typescript
import {
    ChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatApi(configuration);

let datasetId: string; // (default to undefined)
let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listDocumentsApiV1ChatDocumentsListPost(
    datasetId,
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **datasetId** | [**string**] |  | defaults to undefined|
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

# **listMessagesApiV1ChatMessagesListPost**
> any listMessagesApiV1ChatMessagesListPost()

获取对话消息列表。

### Example

```typescript
import {
    ChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatApi(configuration);

let conversationId: string; // (default to undefined)
let botId: string; // (optional) (default to '')
let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listMessagesApiV1ChatMessagesListPost(
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
| **botId** | [**string**] |  | (optional) defaults to ''|
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

# **messageFeedbackApiV1ChatMessagesFeedbackPost**
> any messageFeedbackApiV1ChatMessagesFeedbackPost()

消息反馈（点赞/点踩）。

### Example

```typescript
import {
    ChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatApi(configuration);

let messageId: string; // (default to undefined)
let conversationId: string; // (default to undefined)
let feedbackType: string; //like / dislike (default to undefined)
let content: string; // (optional) (default to '')

const { status, data } = await apiInstance.messageFeedbackApiV1ChatMessagesFeedbackPost(
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
| **content** | [**string**] |  | (optional) defaults to ''|


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

# **resumeWorkflowApiV1ChatWorkflowRunResumePost**
> any resumeWorkflowApiV1ChatWorkflowRunResumePost()

恢复被中断的工作流。

### Example

```typescript
import {
    ChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatApi(configuration);

let workflowId: string; // (default to undefined)
let eventId: string; // (default to undefined)
let interruptType: string; // (default to undefined)
let resumeData: string; //JSON string (optional) (default to '{}')

const { status, data } = await apiInstance.resumeWorkflowApiV1ChatWorkflowRunResumePost(
    workflowId,
    eventId,
    interruptType,
    resumeData
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowId** | [**string**] |  | defaults to undefined|
| **eventId** | [**string**] |  | defaults to undefined|
| **interruptType** | [**string**] |  | defaults to undefined|
| **resumeData** | [**string**] | JSON string | (optional) defaults to '{}'|


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

# **resumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost**
> any resumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost()

流式恢复被中断的工作流。

### Example

```typescript
import {
    ChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatApi(configuration);

let workflowId: string; // (default to undefined)
let eventId: string; // (default to undefined)
let interruptType: string; // (default to undefined)
let resumeData: string; //JSON string (optional) (default to '{}')

const { status, data } = await apiInstance.resumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost(
    workflowId,
    eventId,
    interruptType,
    resumeData
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowId** | [**string**] |  | defaults to undefined|
| **eventId** | [**string**] |  | defaults to undefined|
| **interruptType** | [**string**] |  | defaults to undefined|
| **resumeData** | [**string**] | JSON string | (optional) defaults to '{}'|


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

# **retrieveConversationApiV1ChatConversationsRetrievePost**
> any retrieveConversationApiV1ChatConversationsRetrievePost()

获取对话详情。

### Example

```typescript
import {
    ChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatApi(configuration);

let conversationId: string; // (default to undefined)

const { status, data } = await apiInstance.retrieveConversationApiV1ChatConversationsRetrievePost(
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

# **runWorkflowApiV1ChatWorkflowRunPost**
> any runWorkflowApiV1ChatWorkflowRunPost()


### Example

```typescript
import {
    ChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatApi(configuration);

let workflowId: string; // (default to undefined)
let parameters: string; //JSON 字符串 (optional) (default to '{}')

const { status, data } = await apiInstance.runWorkflowApiV1ChatWorkflowRunPost(
    workflowId,
    parameters
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowId** | [**string**] |  | defaults to undefined|
| **parameters** | [**string**] | JSON 字符串 | (optional) defaults to '{}'|


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

# **runWorkflowStreamApiV1ChatWorkflowRunStreamPost**
> any runWorkflowStreamApiV1ChatWorkflowRunStreamPost()


### Example

```typescript
import {
    ChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatApi(configuration);

let workflowId: string; // (default to undefined)
let parameters: string; // (optional) (default to '{}')

const { status, data } = await apiInstance.runWorkflowStreamApiV1ChatWorkflowRunStreamPost(
    workflowId,
    parameters
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowId** | [**string**] |  | defaults to undefined|
| **parameters** | [**string**] |  | (optional) defaults to '{}'|


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

# **sendMessageApiV1ChatMessagePost**
> any sendMessageApiV1ChatMessagePost()


### Example

```typescript
import {
    ChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatApi(configuration);

let botId: string; // (default to undefined)
let message: string; // (default to undefined)
let conversationId: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.sendMessageApiV1ChatMessagePost(
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

# **sendMessageStreamApiV1ChatMessageStreamPost**
> any sendMessageStreamApiV1ChatMessageStreamPost()

流式聊天：通过 SSE 把 Coze 增量事件转发给前端。

### Example

```typescript
import {
    ChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatApi(configuration);

let botId: string; // (default to undefined)
let message: string; // (default to undefined)
let conversationId: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.sendMessageStreamApiV1ChatMessageStreamPost(
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

# **uploadDocumentApiV1ChatDocumentsUploadPost**
> any uploadDocumentApiV1ChatDocumentsUploadPost()

上传文档到数据集（multipart/form-data）。

### Example

```typescript
import {
    ChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatApi(configuration);

let datasetId: string; // (default to undefined)
let documentName: string; // (default to undefined)
let upload: File; // (default to undefined)

const { status, data } = await apiInstance.uploadDocumentApiV1ChatDocumentsUploadPost(
    datasetId,
    documentName,
    upload
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **datasetId** | [**string**] |  | defaults to undefined|
| **documentName** | [**string**] |  | defaults to undefined|
| **upload** | [**File**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **workflowHistoryApiV1ChatWorkflowRunHistoryPost**
> any workflowHistoryApiV1ChatWorkflowRunHistoryPost()

获取工作流执行历史。

### Example

```typescript
import {
    ChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChatApi(configuration);

let workflowId: string; // (default to undefined)
let executeId: string; // (default to undefined)

const { status, data } = await apiInstance.workflowHistoryApiV1ChatWorkflowRunHistoryPost(
    workflowId,
    executeId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowId** | [**string**] |  | defaults to undefined|
| **executeId** | [**string**] |  | defaults to undefined|


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

