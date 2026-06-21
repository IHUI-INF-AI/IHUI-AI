# CozeAsyncWorkflowsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**runWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost**](CozeAsyncWorkflowsApi.md#runWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost) | **POST** /api/v1/coze/workflows/async/workflows/async | Run Workflow Async |
| [**streamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost**](CozeAsyncWorkflowsApi.md#streamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost) | **POST** /api/v1/coze/workflows/async/workflows/async/stream | Stream Workflow Async |
| [**workflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost**](CozeAsyncWorkflowsApi.md#workflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost) | **POST** /api/v1/coze/workflows/async/workflows/async/chat | Workflow Chat |


<a id="runWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost"></a>
# **runWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost**
> Object runWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost(asyncWorkflowReq)

Run Workflow Async

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAsyncWorkflowsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAsyncWorkflowsApi apiInstance = new CozeAsyncWorkflowsApi(defaultClient);
    AsyncWorkflowReq asyncWorkflowReq = new AsyncWorkflowReq(); // AsyncWorkflowReq | 
    try {
      Object result = apiInstance.runWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost(asyncWorkflowReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAsyncWorkflowsApi#runWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost");
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
| **asyncWorkflowReq** | [**AsyncWorkflowReq**](AsyncWorkflowReq.md)|  | |

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

<a id="streamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost"></a>
# **streamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost**
> Object streamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost(asyncWorkflowStreamReq)

Stream Workflow Async

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAsyncWorkflowsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAsyncWorkflowsApi apiInstance = new CozeAsyncWorkflowsApi(defaultClient);
    AsyncWorkflowStreamReq asyncWorkflowStreamReq = new AsyncWorkflowStreamReq(); // AsyncWorkflowStreamReq | 
    try {
      Object result = apiInstance.streamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost(asyncWorkflowStreamReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAsyncWorkflowsApi#streamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost");
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
| **asyncWorkflowStreamReq** | [**AsyncWorkflowStreamReq**](AsyncWorkflowStreamReq.md)|  | |

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

<a id="workflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost"></a>
# **workflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost**
> Object workflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost(asyncWorkflowStreamReq)

Workflow Chat

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAsyncWorkflowsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAsyncWorkflowsApi apiInstance = new CozeAsyncWorkflowsApi(defaultClient);
    AsyncWorkflowStreamReq asyncWorkflowStreamReq = new AsyncWorkflowStreamReq(); // AsyncWorkflowStreamReq | 
    try {
      Object result = apiInstance.workflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost(asyncWorkflowStreamReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAsyncWorkflowsApi#workflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost");
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
| **asyncWorkflowStreamReq** | [**AsyncWorkflowStreamReq**](AsyncWorkflowStreamReq.md)|  | |

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

