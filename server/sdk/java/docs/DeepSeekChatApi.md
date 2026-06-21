# DeepSeekChatApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**deepseekChatApiV1ChatChatPost**](DeepSeekChatApi.md#deepseekChatApiV1ChatChatPost) | **POST** /api/v1/chat/chat | DeepSeek 同步聊天 |
| [**deepseekChatStreamApiV1ChatChatStreamPost**](DeepSeekChatApi.md#deepseekChatStreamApiV1ChatChatStreamPost) | **POST** /api/v1/chat/chat/stream | DeepSeek 流式聊天（SSE） |


<a id="deepseekChatApiV1ChatChatPost"></a>
# **deepseekChatApiV1ChatChatPost**
> Object deepseekChatApiV1ChatChatPost(message, model)

DeepSeek 同步聊天

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.DeepSeekChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    DeepSeekChatApi apiInstance = new DeepSeekChatApi(defaultClient);
    String message = "message_example"; // String | 
    String model = "deepseek-chat"; // String | 
    try {
      Object result = apiInstance.deepseekChatApiV1ChatChatPost(message, model);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling DeepSeekChatApi#deepseekChatApiV1ChatChatPost");
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
| **message** | **String**|  | |
| **model** | **String**|  | [optional] [default to deepseek-chat] |

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

<a id="deepseekChatStreamApiV1ChatChatStreamPost"></a>
# **deepseekChatStreamApiV1ChatChatStreamPost**
> Object deepseekChatStreamApiV1ChatChatStreamPost(message, model)

DeepSeek 流式聊天（SSE）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.DeepSeekChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    DeepSeekChatApi apiInstance = new DeepSeekChatApi(defaultClient);
    String message = "message_example"; // String | 
    String model = "deepseek-chat"; // String | 
    try {
      Object result = apiInstance.deepseekChatStreamApiV1ChatChatStreamPost(message, model);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling DeepSeekChatApi#deepseekChatStreamApiV1ChatChatStreamPost");
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
| **message** | **String**|  | |
| **model** | **String**|  | [optional] [default to deepseek-chat] |

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

