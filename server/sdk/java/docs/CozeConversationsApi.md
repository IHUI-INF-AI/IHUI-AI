# CozeConversationsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost**](CozeConversationsApi.md#createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost) | **POST** /api/v1/coze/conversations/conversations/messages/feedback | Create Feedback |
| [**createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0**](CozeConversationsApi.md#createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0) | **POST** /api/v1/coze/conversations/conversations/messages/feedback | Create Feedback |
| [**listConversationsApiV1CozeConversationsConversationsPost**](CozeConversationsApi.md#listConversationsApiV1CozeConversationsConversationsPost) | **POST** /api/v1/coze/conversations/conversations | List Conversations |
| [**listConversationsApiV1CozeConversationsConversationsPost_0**](CozeConversationsApi.md#listConversationsApiV1CozeConversationsConversationsPost_0) | **POST** /api/v1/coze/conversations/conversations | List Conversations |
| [**listMessagesApiV1CozeConversationsConversationsMessagesPost**](CozeConversationsApi.md#listMessagesApiV1CozeConversationsConversationsMessagesPost) | **POST** /api/v1/coze/conversations/conversations/messages | List Messages |
| [**listMessagesApiV1CozeConversationsConversationsMessagesPost_0**](CozeConversationsApi.md#listMessagesApiV1CozeConversationsConversationsMessagesPost_0) | **POST** /api/v1/coze/conversations/conversations/messages | List Messages |
| [**retrieveConversationApiV1CozeConversationsConversationsRetrievePost**](CozeConversationsApi.md#retrieveConversationApiV1CozeConversationsConversationsRetrievePost) | **POST** /api/v1/coze/conversations/conversations/retrieve | Retrieve Conversation |
| [**retrieveConversationApiV1CozeConversationsConversationsRetrievePost_0**](CozeConversationsApi.md#retrieveConversationApiV1CozeConversationsConversationsRetrievePost_0) | **POST** /api/v1/coze/conversations/conversations/retrieve | Retrieve Conversation |


<a id="createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost"></a>
# **createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost**
> Object createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost(feedbackReq)

Create Feedback

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeConversationsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeConversationsApi apiInstance = new CozeConversationsApi(defaultClient);
    FeedbackReq feedbackReq = new FeedbackReq(); // FeedbackReq | 
    try {
      Object result = apiInstance.createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost(feedbackReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeConversationsApi#createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost");
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
| **feedbackReq** | [**FeedbackReq**](FeedbackReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0"></a>
# **createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0**
> Object createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0(feedbackReq)

Create Feedback

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeConversationsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeConversationsApi apiInstance = new CozeConversationsApi(defaultClient);
    FeedbackReq feedbackReq = new FeedbackReq(); // FeedbackReq | 
    try {
      Object result = apiInstance.createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0(feedbackReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeConversationsApi#createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0");
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
| **feedbackReq** | [**FeedbackReq**](FeedbackReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listConversationsApiV1CozeConversationsConversationsPost"></a>
# **listConversationsApiV1CozeConversationsConversationsPost**
> Object listConversationsApiV1CozeConversationsConversationsPost(listConvReq)

List Conversations

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeConversationsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeConversationsApi apiInstance = new CozeConversationsApi(defaultClient);
    ListConvReq listConvReq = new ListConvReq(); // ListConvReq | 
    try {
      Object result = apiInstance.listConversationsApiV1CozeConversationsConversationsPost(listConvReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeConversationsApi#listConversationsApiV1CozeConversationsConversationsPost");
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
| **listConvReq** | [**ListConvReq**](ListConvReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listConversationsApiV1CozeConversationsConversationsPost_0"></a>
# **listConversationsApiV1CozeConversationsConversationsPost_0**
> Object listConversationsApiV1CozeConversationsConversationsPost_0(listConvReq)

List Conversations

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeConversationsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeConversationsApi apiInstance = new CozeConversationsApi(defaultClient);
    ListConvReq listConvReq = new ListConvReq(); // ListConvReq | 
    try {
      Object result = apiInstance.listConversationsApiV1CozeConversationsConversationsPost_0(listConvReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeConversationsApi#listConversationsApiV1CozeConversationsConversationsPost_0");
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
| **listConvReq** | [**ListConvReq**](ListConvReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listMessagesApiV1CozeConversationsConversationsMessagesPost"></a>
# **listMessagesApiV1CozeConversationsConversationsMessagesPost**
> Object listMessagesApiV1CozeConversationsConversationsMessagesPost(listMsgReq)

List Messages

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeConversationsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeConversationsApi apiInstance = new CozeConversationsApi(defaultClient);
    ListMsgReq listMsgReq = new ListMsgReq(); // ListMsgReq | 
    try {
      Object result = apiInstance.listMessagesApiV1CozeConversationsConversationsMessagesPost(listMsgReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeConversationsApi#listMessagesApiV1CozeConversationsConversationsMessagesPost");
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
| **listMsgReq** | [**ListMsgReq**](ListMsgReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listMessagesApiV1CozeConversationsConversationsMessagesPost_0"></a>
# **listMessagesApiV1CozeConversationsConversationsMessagesPost_0**
> Object listMessagesApiV1CozeConversationsConversationsMessagesPost_0(listMsgReq)

List Messages

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeConversationsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeConversationsApi apiInstance = new CozeConversationsApi(defaultClient);
    ListMsgReq listMsgReq = new ListMsgReq(); // ListMsgReq | 
    try {
      Object result = apiInstance.listMessagesApiV1CozeConversationsConversationsMessagesPost_0(listMsgReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeConversationsApi#listMessagesApiV1CozeConversationsConversationsMessagesPost_0");
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
| **listMsgReq** | [**ListMsgReq**](ListMsgReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="retrieveConversationApiV1CozeConversationsConversationsRetrievePost"></a>
# **retrieveConversationApiV1CozeConversationsConversationsRetrievePost**
> Object retrieveConversationApiV1CozeConversationsConversationsRetrievePost(retrieveReq)

Retrieve Conversation

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeConversationsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeConversationsApi apiInstance = new CozeConversationsApi(defaultClient);
    RetrieveReq retrieveReq = new RetrieveReq(); // RetrieveReq | 
    try {
      Object result = apiInstance.retrieveConversationApiV1CozeConversationsConversationsRetrievePost(retrieveReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeConversationsApi#retrieveConversationApiV1CozeConversationsConversationsRetrievePost");
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
| **retrieveReq** | [**RetrieveReq**](RetrieveReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="retrieveConversationApiV1CozeConversationsConversationsRetrievePost_0"></a>
# **retrieveConversationApiV1CozeConversationsConversationsRetrievePost_0**
> Object retrieveConversationApiV1CozeConversationsConversationsRetrievePost_0(retrieveReq)

Retrieve Conversation

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeConversationsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeConversationsApi apiInstance = new CozeConversationsApi(defaultClient);
    RetrieveReq retrieveReq = new RetrieveReq(); // RetrieveReq | 
    try {
      Object result = apiInstance.retrieveConversationApiV1CozeConversationsConversationsRetrievePost_0(retrieveReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeConversationsApi#retrieveConversationApiV1CozeConversationsConversationsRetrievePost_0");
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
| **retrieveReq** | [**RetrieveReq**](RetrieveReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

