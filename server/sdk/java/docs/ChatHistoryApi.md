# ChatHistoryApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createChatApiV1ChatCreatePost**](ChatHistoryApi.md#createChatApiV1ChatCreatePost) | **POST** /api/v1/chat/create | Create a chat record |
| [**deleteChatApiV1ChatChatIdDelete**](ChatHistoryApi.md#deleteChatApiV1ChatChatIdDelete) | **DELETE** /api/v1/chat/{chat_id} | Delete a chat record |
| [**queryChatsApiV1ChatQueryPost**](ChatHistoryApi.md#queryChatsApiV1ChatQueryPost) | **POST** /api/v1/chat/query | Query chat records |
| [**updateChatMarkApiV1ChatChatIdMarkPut**](ChatHistoryApi.md#updateChatMarkApiV1ChatChatIdMarkPut) | **PUT** /api/v1/chat/{chat_id}/mark | Update chat mark/label |


<a id="createChatApiV1ChatCreatePost"></a>
# **createChatApiV1ChatCreatePost**
> Object createChatApiV1ChatCreatePost(chatCreateBody)

Create a chat record

Create a new user-model chat record.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatHistoryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatHistoryApi apiInstance = new ChatHistoryApi(defaultClient);
    ChatCreateBody chatCreateBody = new ChatCreateBody(); // ChatCreateBody | 
    try {
      Object result = apiInstance.createChatApiV1ChatCreatePost(chatCreateBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatHistoryApi#createChatApiV1ChatCreatePost");
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
| **chatCreateBody** | [**ChatCreateBody**](ChatCreateBody.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="deleteChatApiV1ChatChatIdDelete"></a>
# **deleteChatApiV1ChatChatIdDelete**
> Object deleteChatApiV1ChatChatIdDelete(chatId)

Delete a chat record

Delete a chat record owned by the authenticated user.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatHistoryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatHistoryApi apiInstance = new ChatHistoryApi(defaultClient);
    Integer chatId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteChatApiV1ChatChatIdDelete(chatId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatHistoryApi#deleteChatApiV1ChatChatIdDelete");
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
| **chatId** | **Integer**|  | |

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

<a id="queryChatsApiV1ChatQueryPost"></a>
# **queryChatsApiV1ChatQueryPost**
> Object queryChatsApiV1ChatQueryPost(chatQueryBody, page, limit)

Query chat records

Query chat records for the authenticated user, optionally filtered by model_name. Joins with zhs_ai_model_info to include model source and icon.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatHistoryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatHistoryApi apiInstance = new ChatHistoryApi(defaultClient);
    ChatQueryBody chatQueryBody = new ChatQueryBody(); // ChatQueryBody | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.queryChatsApiV1ChatQueryPost(chatQueryBody, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatHistoryApi#queryChatsApiV1ChatQueryPost");
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
| **chatQueryBody** | [**ChatQueryBody**](ChatQueryBody.md)|  | |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="updateChatMarkApiV1ChatChatIdMarkPut"></a>
# **updateChatMarkApiV1ChatChatIdMarkPut**
> Object updateChatMarkApiV1ChatChatIdMarkPut(chatId, chatMarkBody)

Update chat mark/label

Update the mark (label/summary) of a chat record owned by the user.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ChatHistoryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ChatHistoryApi apiInstance = new ChatHistoryApi(defaultClient);
    Integer chatId = 56; // Integer | 
    ChatMarkBody chatMarkBody = new ChatMarkBody(); // ChatMarkBody | 
    try {
      Object result = apiInstance.updateChatMarkApiV1ChatChatIdMarkPut(chatId, chatMarkBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ChatHistoryApi#updateChatMarkApiV1ChatChatIdMarkPut");
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
| **chatId** | **Integer**|  | |
| **chatMarkBody** | [**ChatMarkBody**](ChatMarkBody.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

