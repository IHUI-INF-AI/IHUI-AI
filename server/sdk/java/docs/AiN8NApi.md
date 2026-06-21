# AiN8NApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addAgentApiV1AiN8nAddAgentPost**](AiN8NApi.md#addAgentApiV1AiN8nAddAgentPost) | **POST** /api/v1/ai/n8n/addAgent | 通过N8N接口新增智能体 |
| [**getN8nWorkflowsApiV1AiN8nWorkflowsPost**](AiN8NApi.md#getN8nWorkflowsApiV1AiN8nWorkflowsPost) | **POST** /api/v1/ai/n8n/workflows | 查询N8N工作流列表 |
| [**runWorkflowApiV1AiN8nWorkflowRunPost**](AiN8NApi.md#runWorkflowApiV1AiN8nWorkflowRunPost) | **POST** /api/v1/ai/n8n/workflow/run | 运行N8N工作流 |


<a id="addAgentApiV1AiN8nAddAgentPost"></a>
# **addAgentApiV1AiN8nAddAgentPost**
> Object addAgentApiV1AiN8nAddAgentPost(addAgentRequest)

通过N8N接口新增智能体

Add a new agent to the agents table and create an examination record. Matches the original n8n_proxy.py /addAgent endpoint.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiN8NApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiN8NApi apiInstance = new AiN8NApi(defaultClient);
    AddAgentRequest addAgentRequest = new AddAgentRequest(); // AddAgentRequest | 
    try {
      Object result = apiInstance.addAgentApiV1AiN8nAddAgentPost(addAgentRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiN8NApi#addAgentApiV1AiN8nAddAgentPost");
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
| **addAgentRequest** | [**AddAgentRequest**](AddAgentRequest.md)|  | |

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

<a id="getN8nWorkflowsApiV1AiN8nWorkflowsPost"></a>
# **getN8nWorkflowsApiV1AiN8nWorkflowsPost**
> Object getN8nWorkflowsApiV1AiN8nWorkflowsPost(n8NWorkflowsRequest)

查询N8N工作流列表

Queries n8n workflows and returns a formatted list. Matches the original n8n_proxy.py /workflows endpoint.  /cozeZhsApi/n8n/workflows -&gt; POST here

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiN8NApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AiN8NApi apiInstance = new AiN8NApi(defaultClient);
    N8NWorkflowsRequest n8NWorkflowsRequest = new N8NWorkflowsRequest(); // N8NWorkflowsRequest | 
    try {
      Object result = apiInstance.getN8nWorkflowsApiV1AiN8nWorkflowsPost(n8NWorkflowsRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiN8NApi#getN8nWorkflowsApiV1AiN8nWorkflowsPost");
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
| **n8NWorkflowsRequest** | [**N8NWorkflowsRequest**](N8NWorkflowsRequest.md)|  | |

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

<a id="runWorkflowApiV1AiN8nWorkflowRunPost"></a>
# **runWorkflowApiV1AiN8nWorkflowRunPost**
> Object runWorkflowApiV1AiN8nWorkflowRunPost(workflowRunRequest)

运行N8N工作流

Trigger an N8N workflow execution via webhook or API.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiN8NApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiN8NApi apiInstance = new AiN8NApi(defaultClient);
    WorkflowRunRequest workflowRunRequest = new WorkflowRunRequest(); // WorkflowRunRequest | 
    try {
      Object result = apiInstance.runWorkflowApiV1AiN8nWorkflowRunPost(workflowRunRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiN8NApi#runWorkflowApiV1AiN8nWorkflowRunPost");
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
| **workflowRunRequest** | [**WorkflowRunRequest**](WorkflowRunRequest.md)|  | |

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

