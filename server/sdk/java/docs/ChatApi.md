# ChatApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**chatWithBillingApiV1ChatChatWithBillingPost**](ChatApi.md#chatWithBillingApiV1ChatChatWithBillingPost) | **POST** /api/v1/chat/chat-with-billing | Chat with token billing |
| [**createConversationApiV1ChatConversationCreatePost**](ChatApi.md#createConversationApiV1ChatConversationCreatePost) | **POST** /api/v1/chat/conversation/create | Create Coze conversation |
| [**createDatasetApiV1ChatDatasetsCreatePost**](ChatApi.md#createDatasetApiV1ChatDatasetsCreatePost) | **POST** /api/v1/chat/datasets/create | Create Coze dataset |
| [**listConversationsApiV1ChatConversationsListPost**](ChatApi.md#listConversationsApiV1ChatConversationsListPost) | **POST** /api/v1/chat/conversations/list | List Coze conversations |
| [**listDatasetsApiV1ChatDatasetsListPost**](ChatApi.md#listDatasetsApiV1ChatDatasetsListPost) | **POST** /api/v1/chat/datasets/list | List Coze datasets |
| [**listDocumentsApiV1ChatDocumentsListPost**](ChatApi.md#listDocumentsApiV1ChatDocumentsListPost) | **POST** /api/v1/chat/documents/list | List Coze dataset documents |
| [**listMessagesApiV1ChatMessagesListPost**](ChatApi.md#listMessagesApiV1ChatMessagesListPost) | **POST** /api/v1/chat/messages/list | List Coze conversation messages |
| [**messageFeedbackApiV1ChatMessagesFeedbackPost**](ChatApi.md#messageFeedbackApiV1ChatMessagesFeedbackPost) | **POST** /api/v1/chat/messages/feedback | Coze message feedback |
| [**resumeWorkflowApiV1ChatWorkflowRunResumePost**](ChatApi.md#resumeWorkflowApiV1ChatWorkflowRunResumePost) | **POST** /api/v1/chat/workflow/run/resume | Resume interrupted Coze workflow |
| [**resumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost**](ChatApi.md#resumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost) | **POST** /api/v1/chat/workflow/run/resume/stream | Resume interrupted Coze workflow (stream) |
| [**retrieveConversationApiV1ChatConversationsRetrievePost**](ChatApi.md#retrieveConversationApiV1ChatConversationsRetrievePost) | **POST** /api/v1/chat/conversations/retrieve | Retrieve Coze conversation |
| [**runWorkflowApiV1ChatWorkflowRunPost**](ChatApi.md#runWorkflowApiV1ChatWorkflowRunPost) | **POST** /api/v1/chat/workflow/run | Run Coze workflow (sync) |
| [**runWorkflowStreamApiV1ChatWorkflowRunStreamPost**](ChatApi.md#runWorkflowStreamApiV1ChatWorkflowRunStreamPost) | **POST** /api/v1/chat/workflow/run/stream | Run Coze workflow (stream) |
| [**sendMessageApiV1ChatMessagePost**](ChatApi.md#sendMessageApiV1ChatMessagePost) | **POST** /api/v1/chat/message | Send chat message via Coze (sync) |
| [**sendMessageStreamApiV1ChatMessageStreamPost**](ChatApi.md#sendMessageStreamApiV1ChatMessageStreamPost) | **POST** /api/v1/chat/message/stream | Send chat message via Coze (SSE stream) |
| [**uploadDocumentApiV1ChatDocumentsUploadPost**](ChatApi.md#uploadDocumentApiV1ChatDocumentsUploadPost) | **POST** /api/v1/chat/documents/upload | Upload document to Coze dataset (multipart) |
| [**workflowHistoryApiV1ChatWorkflowRunHistoryPost**](ChatApi.md#workflowHistoryApiV1ChatWorkflowRunHistoryPost) | **POST** /api/v1/chat/workflow/run/history | Get Coze workflow run history |


<a id="chatWithBillingApiV1ChatChatWithBillingPost"></a>
# **chatWithBillingApiV1ChatChatWithBillingPost**
> Object chatWithBillingApiV1ChatChatWithBillingPost(botId, message, costTokens)

Chat with token billing

带计费的聊天：先扣 token，再转发到 Coze。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatApi apiInstance = new ChatApi(defaultClient);
    String botId = "botId_example"; // String | 
    String message = "message_example"; // String | 
    Integer costTokens = 100; // Integer | 本次聊天扣减 token 数
    try {
      Object result = apiInstance.chatWithBillingApiV1ChatChatWithBillingPost(botId, message, costTokens);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatApi#chatWithBillingApiV1ChatChatWithBillingPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **botId** | **String**|  | |
| **message** | **String**|  | |
| **costTokens** | **Integer**| 本次聊天扣减 token 数 | [optional] [default to 100] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createConversationApiV1ChatConversationCreatePost"></a>
# **createConversationApiV1ChatConversationCreatePost**
> Object createConversationApiV1ChatConversationCreatePost(botId)

Create Coze conversation

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatApi apiInstance = new ChatApi(defaultClient);
    String botId = "botId_example"; // String | 
    try {
      Object result = apiInstance.createConversationApiV1ChatConversationCreatePost(botId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatApi#createConversationApiV1ChatConversationCreatePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **botId** | **String**|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createDatasetApiV1ChatDatasetsCreatePost"></a>
# **createDatasetApiV1ChatDatasetsCreatePost**
> Object createDatasetApiV1ChatDatasetsCreatePost(name, spaceId)

Create Coze dataset

创建数据集。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatApi apiInstance = new ChatApi(defaultClient);
    String name = "name_example"; // String | 
    String spaceId = ""; // String | Workspace ID, defaults to configured account
    try {
      Object result = apiInstance.createDatasetApiV1ChatDatasetsCreatePost(name, spaceId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatApi#createDatasetApiV1ChatDatasetsCreatePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **name** | **String**|  | |
| **spaceId** | **String**| Workspace ID, defaults to configured account | [optional] [default to ] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listConversationsApiV1ChatConversationsListPost"></a>
# **listConversationsApiV1ChatConversationsListPost**
> Object listConversationsApiV1ChatConversationsListPost(botId, userId, page, size)

List Coze conversations

获取对话列表。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatApi apiInstance = new ChatApi(defaultClient);
    String botId = "botId_example"; // String | 
    String userId = "userId_example"; // String | 
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.listConversationsApiV1ChatConversationsListPost(botId, userId, page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatApi#listConversationsApiV1ChatConversationsListPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **botId** | **String**|  | |
| **userId** | **String**|  | |
| **page** | **Integer**|  | [optional] [default to 1] |
| **size** | **Integer**|  | [optional] [default to 20] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listDatasetsApiV1ChatDatasetsListPost"></a>
# **listDatasetsApiV1ChatDatasetsListPost**
> Object listDatasetsApiV1ChatDatasetsListPost(spaceId, page, size)

List Coze datasets

获取数据集列表。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatApi apiInstance = new ChatApi(defaultClient);
    String spaceId = ""; // String | Workspace ID
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.listDatasetsApiV1ChatDatasetsListPost(spaceId, page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatApi#listDatasetsApiV1ChatDatasetsListPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **spaceId** | **String**| Workspace ID | [optional] [default to ] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **size** | **Integer**|  | [optional] [default to 20] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listDocumentsApiV1ChatDocumentsListPost"></a>
# **listDocumentsApiV1ChatDocumentsListPost**
> Object listDocumentsApiV1ChatDocumentsListPost(datasetId, page, size)

List Coze dataset documents

获取数据集下的文档列表。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatApi apiInstance = new ChatApi(defaultClient);
    String datasetId = "datasetId_example"; // String | 
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.listDocumentsApiV1ChatDocumentsListPost(datasetId, page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatApi#listDocumentsApiV1ChatDocumentsListPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **datasetId** | **String**|  | |
| **page** | **Integer**|  | [optional] [default to 1] |
| **size** | **Integer**|  | [optional] [default to 20] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listMessagesApiV1ChatMessagesListPost"></a>
# **listMessagesApiV1ChatMessagesListPost**
> Object listMessagesApiV1ChatMessagesListPost(conversationId, botId, page, size)

List Coze conversation messages

获取对话消息列表。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatApi apiInstance = new ChatApi(defaultClient);
    String conversationId = "conversationId_example"; // String | 
    String botId = ""; // String | 
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.listMessagesApiV1ChatMessagesListPost(conversationId, botId, page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatApi#listMessagesApiV1ChatMessagesListPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **conversationId** | **String**|  | |
| **botId** | **String**|  | [optional] [default to ] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **size** | **Integer**|  | [optional] [default to 20] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="messageFeedbackApiV1ChatMessagesFeedbackPost"></a>
# **messageFeedbackApiV1ChatMessagesFeedbackPost**
> Object messageFeedbackApiV1ChatMessagesFeedbackPost(messageId, conversationId, feedbackType, content)

Coze message feedback

消息反馈（点赞/点踩）。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatApi apiInstance = new ChatApi(defaultClient);
    String messageId = "messageId_example"; // String | 
    String conversationId = "conversationId_example"; // String | 
    String feedbackType = "feedbackType_example"; // String | like / dislike
    String content = ""; // String | 
    try {
      Object result = apiInstance.messageFeedbackApiV1ChatMessagesFeedbackPost(messageId, conversationId, feedbackType, content);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatApi#messageFeedbackApiV1ChatMessagesFeedbackPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **messageId** | **String**|  | |
| **conversationId** | **String**|  | |
| **feedbackType** | **String**| like / dislike | |
| **content** | **String**|  | [optional] [default to ] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="resumeWorkflowApiV1ChatWorkflowRunResumePost"></a>
# **resumeWorkflowApiV1ChatWorkflowRunResumePost**
> Object resumeWorkflowApiV1ChatWorkflowRunResumePost(workflowId, eventId, interruptType, resumeData)

Resume interrupted Coze workflow

恢复被中断的工作流。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatApi apiInstance = new ChatApi(defaultClient);
    String workflowId = "workflowId_example"; // String | 
    String eventId = "eventId_example"; // String | 
    String interruptType = "interruptType_example"; // String | 
    String resumeData = "{}"; // String | JSON string
    try {
      Object result = apiInstance.resumeWorkflowApiV1ChatWorkflowRunResumePost(workflowId, eventId, interruptType, resumeData);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatApi#resumeWorkflowApiV1ChatWorkflowRunResumePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **workflowId** | **String**|  | |
| **eventId** | **String**|  | |
| **interruptType** | **String**|  | |
| **resumeData** | **String**| JSON string | [optional] [default to {}] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="resumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost"></a>
# **resumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost**
> Object resumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost(workflowId, eventId, interruptType, resumeData)

Resume interrupted Coze workflow (stream)

流式恢复被中断的工作流。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatApi apiInstance = new ChatApi(defaultClient);
    String workflowId = "workflowId_example"; // String | 
    String eventId = "eventId_example"; // String | 
    String interruptType = "interruptType_example"; // String | 
    String resumeData = "{}"; // String | JSON string
    try {
      Object result = apiInstance.resumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost(workflowId, eventId, interruptType, resumeData);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatApi#resumeWorkflowStreamApiV1ChatWorkflowRunResumeStreamPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **workflowId** | **String**|  | |
| **eventId** | **String**|  | |
| **interruptType** | **String**|  | |
| **resumeData** | **String**| JSON string | [optional] [default to {}] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="retrieveConversationApiV1ChatConversationsRetrievePost"></a>
# **retrieveConversationApiV1ChatConversationsRetrievePost**
> Object retrieveConversationApiV1ChatConversationsRetrievePost(conversationId)

Retrieve Coze conversation

获取对话详情。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatApi apiInstance = new ChatApi(defaultClient);
    String conversationId = "conversationId_example"; // String | 
    try {
      Object result = apiInstance.retrieveConversationApiV1ChatConversationsRetrievePost(conversationId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatApi#retrieveConversationApiV1ChatConversationsRetrievePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **conversationId** | **String**|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="runWorkflowApiV1ChatWorkflowRunPost"></a>
# **runWorkflowApiV1ChatWorkflowRunPost**
> Object runWorkflowApiV1ChatWorkflowRunPost(workflowId, parameters)

Run Coze workflow (sync)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatApi apiInstance = new ChatApi(defaultClient);
    String workflowId = "workflowId_example"; // String | 
    String parameters = "{}"; // String | JSON 字符串
    try {
      Object result = apiInstance.runWorkflowApiV1ChatWorkflowRunPost(workflowId, parameters);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatApi#runWorkflowApiV1ChatWorkflowRunPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **workflowId** | **String**|  | |
| **parameters** | **String**| JSON 字符串 | [optional] [default to {}] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="runWorkflowStreamApiV1ChatWorkflowRunStreamPost"></a>
# **runWorkflowStreamApiV1ChatWorkflowRunStreamPost**
> Object runWorkflowStreamApiV1ChatWorkflowRunStreamPost(workflowId, parameters)

Run Coze workflow (stream)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatApi apiInstance = new ChatApi(defaultClient);
    String workflowId = "workflowId_example"; // String | 
    String parameters = "{}"; // String | 
    try {
      Object result = apiInstance.runWorkflowStreamApiV1ChatWorkflowRunStreamPost(workflowId, parameters);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatApi#runWorkflowStreamApiV1ChatWorkflowRunStreamPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **workflowId** | **String**|  | |
| **parameters** | **String**|  | [optional] [default to {}] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="sendMessageApiV1ChatMessagePost"></a>
# **sendMessageApiV1ChatMessagePost**
> Object sendMessageApiV1ChatMessagePost(botId, message, conversationId)

Send chat message via Coze (sync)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatApi apiInstance = new ChatApi(defaultClient);
    String botId = "botId_example"; // String | 
    String message = "message_example"; // String | 
    String conversationId = "conversationId_example"; // String | 
    try {
      Object result = apiInstance.sendMessageApiV1ChatMessagePost(botId, message, conversationId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatApi#sendMessageApiV1ChatMessagePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **botId** | **String**|  | |
| **message** | **String**|  | |
| **conversationId** | **String**|  | [optional] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="sendMessageStreamApiV1ChatMessageStreamPost"></a>
# **sendMessageStreamApiV1ChatMessageStreamPost**
> Object sendMessageStreamApiV1ChatMessageStreamPost(botId, message, conversationId)

Send chat message via Coze (SSE stream)

流式聊天：通过 SSE 把 Coze 增量事件转发给前端。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatApi apiInstance = new ChatApi(defaultClient);
    String botId = "botId_example"; // String | 
    String message = "message_example"; // String | 
    String conversationId = "conversationId_example"; // String | 
    try {
      Object result = apiInstance.sendMessageStreamApiV1ChatMessageStreamPost(botId, message, conversationId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatApi#sendMessageStreamApiV1ChatMessageStreamPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **botId** | **String**|  | |
| **message** | **String**|  | |
| **conversationId** | **String**|  | [optional] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="uploadDocumentApiV1ChatDocumentsUploadPost"></a>
# **uploadDocumentApiV1ChatDocumentsUploadPost**
> Object uploadDocumentApiV1ChatDocumentsUploadPost(datasetId, documentName, upload)

Upload document to Coze dataset (multipart)

上传文档到数据集（multipart/form-data）。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatApi apiInstance = new ChatApi(defaultClient);
    String datasetId = "datasetId_example"; // String | 
    String documentName = "documentName_example"; // String | 
    File upload = new File("/path/to/file"); // File | 
    try {
      Object result = apiInstance.uploadDocumentApiV1ChatDocumentsUploadPost(datasetId, documentName, upload);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatApi#uploadDocumentApiV1ChatDocumentsUploadPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **datasetId** | **String**|  | |
| **documentName** | **String**|  | |
| **upload** | **File**|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="workflowHistoryApiV1ChatWorkflowRunHistoryPost"></a>
# **workflowHistoryApiV1ChatWorkflowRunHistoryPost**
> Object workflowHistoryApiV1ChatWorkflowRunHistoryPost(workflowId, executeId)

Get Coze workflow run history

获取工作流执行历史。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatApi apiInstance = new ChatApi(defaultClient);
    String workflowId = "workflowId_example"; // String | 
    String executeId = "executeId_example"; // String | 
    try {
      Object result = apiInstance.workflowHistoryApiV1ChatWorkflowRunHistoryPost(workflowId, executeId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatApi#workflowHistoryApiV1ChatWorkflowRunHistoryPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **workflowId** | **String**|  | |
| **executeId** | **String**|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

