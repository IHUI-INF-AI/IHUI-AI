# AiBailianApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**bailianChatApiV1AiBailianChatPost**](AiBailianApi.md#bailianChatApiV1AiBailianChatPost) | **POST** /api/v1/ai/bailian/chat | 百炼应用对话 |


<a id="bailianChatApiV1AiBailianChatPost"></a>
# **bailianChatApiV1AiBailianChatPost**
> Object bailianChatApiV1AiBailianChatPost(bailianChatRequest)

百炼应用对话

Send a chat request to a Bailian (DashScope) application via HTTP.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiBailianApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiBailianApi apiInstance = new AiBailianApi(defaultClient);
    BailianChatRequest bailianChatRequest = new BailianChatRequest(); // BailianChatRequest | 
    try {
      Object result = apiInstance.bailianChatApiV1AiBailianChatPost(bailianChatRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiBailianApi#bailianChatApiV1AiBailianChatPost");
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
| **bailianChatRequest** | [**BailianChatRequest**](BailianChatRequest.md)|  | |

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

