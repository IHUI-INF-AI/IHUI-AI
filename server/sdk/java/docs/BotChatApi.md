# BotChatApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**chatWithBotApiV1BotsSendPost**](BotChatApi.md#chatWithBotApiV1BotsSendPost) | **POST** /api/v1/bots/send | Send message to bot |
| [**listConversationsApiV1BotsConversationsGet**](BotChatApi.md#listConversationsApiV1BotsConversationsGet) | **GET** /api/v1/bots/conversations | List conversations |
| [**listMessagesApiV1BotsMessagesPost**](BotChatApi.md#listMessagesApiV1BotsMessagesPost) | **POST** /api/v1/bots/messages | 消息列表 |
| [**messageFeedbackApiV1BotsMessagesFeedbackPost**](BotChatApi.md#messageFeedbackApiV1BotsMessagesFeedbackPost) | **POST** /api/v1/bots/messages/feedback | 消息反馈 |
| [**retrieveConversationApiV1BotsRetrievePost**](BotChatApi.md#retrieveConversationApiV1BotsRetrievePost) | **POST** /api/v1/bots/retrieve | 检索会话 |


<a id="chatWithBotApiV1BotsSendPost"></a>
# **chatWithBotApiV1BotsSendPost**
> Object chatWithBotApiV1BotsSendPost(botId, message, conversationId)

Send message to bot

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BotChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    BotChatApi apiInstance = new BotChatApi(defaultClient);
    String botId = "botId_example"; // String | 
    String message = "message_example"; // String | 
    String conversationId = "conversationId_example"; // String | 
    try {
      Object result = apiInstance.chatWithBotApiV1BotsSendPost(botId, message, conversationId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BotChatApi#chatWithBotApiV1BotsSendPost");
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

<a id="listConversationsApiV1BotsConversationsGet"></a>
# **listConversationsApiV1BotsConversationsGet**
> Object listConversationsApiV1BotsConversationsGet(botId, page, size)

List conversations

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BotChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    BotChatApi apiInstance = new BotChatApi(defaultClient);
    String botId = "botId_example"; // String | 
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.listConversationsApiV1BotsConversationsGet(botId, page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BotChatApi#listConversationsApiV1BotsConversationsGet");
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

<a id="listMessagesApiV1BotsMessagesPost"></a>
# **listMessagesApiV1BotsMessagesPost**
> Object listMessagesApiV1BotsMessagesPost(conversationId, botId, page, size)

消息列表

获取指定会话的消息列表。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BotChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    BotChatApi apiInstance = new BotChatApi(defaultClient);
    String conversationId = "conversationId_example"; // String | 
    String botId = "botId_example"; // String | 
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.listMessagesApiV1BotsMessagesPost(conversationId, botId, page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BotChatApi#listMessagesApiV1BotsMessagesPost");
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
| **botId** | **String**|  | [optional] |
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

<a id="messageFeedbackApiV1BotsMessagesFeedbackPost"></a>
# **messageFeedbackApiV1BotsMessagesFeedbackPost**
> Object messageFeedbackApiV1BotsMessagesFeedbackPost(messageId, conversationId, feedbackType, content)

消息反馈

对消息进行点赞/踩反馈。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BotChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    BotChatApi apiInstance = new BotChatApi(defaultClient);
    String messageId = "messageId_example"; // String | 
    String conversationId = "conversationId_example"; // String | 
    String feedbackType = "feedbackType_example"; // String | like / dislike
    String content = ""; // String | 反馈内容
    try {
      Object result = apiInstance.messageFeedbackApiV1BotsMessagesFeedbackPost(messageId, conversationId, feedbackType, content);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BotChatApi#messageFeedbackApiV1BotsMessagesFeedbackPost");
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
| **content** | **String**| 反馈内容 | [optional] [default to ] |

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

<a id="retrieveConversationApiV1BotsRetrievePost"></a>
# **retrieveConversationApiV1BotsRetrievePost**
> Object retrieveConversationApiV1BotsRetrievePost(conversationId)

检索会话

检索指定会话详情。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BotChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    BotChatApi apiInstance = new BotChatApi(defaultClient);
    String conversationId = "conversationId_example"; // String | 
    try {
      Object result = apiInstance.retrieveConversationApiV1BotsRetrievePost(conversationId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BotChatApi#retrieveConversationApiV1BotsRetrievePost");
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

