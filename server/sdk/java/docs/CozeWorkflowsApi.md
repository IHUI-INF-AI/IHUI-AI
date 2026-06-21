# CozeWorkflowsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost**](CozeWorkflowsApi.md#createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost) | **POST** /api/v1/coze/workflows/workflows/runs | Create Workflow Run |
| [**createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0**](CozeWorkflowsApi.md#createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0) | **POST** /api/v1/coze/workflows/workflows/runs | Create Workflow Run |
| [**getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost**](CozeWorkflowsApi.md#getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost) | **POST** /api/v1/coze/workflows/workflows/runs/execute-nodes | Get Node History |
| [**getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0**](CozeWorkflowsApi.md#getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0) | **POST** /api/v1/coze/workflows/workflows/runs/execute-nodes | Get Node History |
| [**getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost**](CozeWorkflowsApi.md#getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost) | **POST** /api/v1/coze/workflows/workflows/runs/history | Get Run History |
| [**getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0**](CozeWorkflowsApi.md#getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0) | **POST** /api/v1/coze/workflows/workflows/runs/history | Get Run History |
| [**resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost**](CozeWorkflowsApi.md#resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost) | **POST** /api/v1/coze/workflows/workflows/runs/resume | Resume Workflow |
| [**resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0**](CozeWorkflowsApi.md#resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0) | **POST** /api/v1/coze/workflows/workflows/runs/resume | Resume Workflow |
| [**searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost**](CozeWorkflowsApi.md#searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost) | **POST** /api/v1/coze/workflows/workflows/search/model/workflow/run | Search Model Workflow |
| [**searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0**](CozeWorkflowsApi.md#searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0) | **POST** /api/v1/coze/workflows/workflows/search/model/workflow/run | Search Model Workflow |
| [**streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost**](CozeWorkflowsApi.md#streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost) | **POST** /api/v1/coze/workflows/workflows/runs/stream | Stream Workflow |
| [**streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0**](CozeWorkflowsApi.md#streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0) | **POST** /api/v1/coze/workflows/workflows/runs/stream | Stream Workflow |


<a id="createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost"></a>
# **createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost**
> Object createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost(workflowRunReq)

Create Workflow Run

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeWorkflowsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeWorkflowsApi apiInstance = new CozeWorkflowsApi(defaultClient);
    WorkflowRunReq workflowRunReq = new WorkflowRunReq(); // WorkflowRunReq | 
    try {
      Object result = apiInstance.createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost(workflowRunReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeWorkflowsApi#createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost");
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
| **workflowRunReq** | [**WorkflowRunReq**](WorkflowRunReq.md)|  | |

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

<a id="createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0"></a>
# **createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0**
> Object createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0(workflowRunReq)

Create Workflow Run

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeWorkflowsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeWorkflowsApi apiInstance = new CozeWorkflowsApi(defaultClient);
    WorkflowRunReq workflowRunReq = new WorkflowRunReq(); // WorkflowRunReq | 
    try {
      Object result = apiInstance.createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0(workflowRunReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeWorkflowsApi#createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0");
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
| **workflowRunReq** | [**WorkflowRunReq**](WorkflowRunReq.md)|  | |

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

<a id="getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost"></a>
# **getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost**
> Object getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost(workflowNodeExecuteReq)

Get Node History

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeWorkflowsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeWorkflowsApi apiInstance = new CozeWorkflowsApi(defaultClient);
    WorkflowNodeExecuteReq workflowNodeExecuteReq = new WorkflowNodeExecuteReq(); // WorkflowNodeExecuteReq | 
    try {
      Object result = apiInstance.getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost(workflowNodeExecuteReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeWorkflowsApi#getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost");
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
| **workflowNodeExecuteReq** | [**WorkflowNodeExecuteReq**](WorkflowNodeExecuteReq.md)|  | |

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

<a id="getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0"></a>
# **getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0**
> Object getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0(workflowNodeExecuteReq)

Get Node History

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeWorkflowsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeWorkflowsApi apiInstance = new CozeWorkflowsApi(defaultClient);
    WorkflowNodeExecuteReq workflowNodeExecuteReq = new WorkflowNodeExecuteReq(); // WorkflowNodeExecuteReq | 
    try {
      Object result = apiInstance.getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0(workflowNodeExecuteReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeWorkflowsApi#getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0");
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
| **workflowNodeExecuteReq** | [**WorkflowNodeExecuteReq**](WorkflowNodeExecuteReq.md)|  | |

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

<a id="getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost"></a>
# **getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost**
> Object getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost(workflowRunHistoryReq)

Get Run History

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeWorkflowsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeWorkflowsApi apiInstance = new CozeWorkflowsApi(defaultClient);
    WorkflowRunHistoryReq workflowRunHistoryReq = new WorkflowRunHistoryReq(); // WorkflowRunHistoryReq | 
    try {
      Object result = apiInstance.getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost(workflowRunHistoryReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeWorkflowsApi#getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost");
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
| **workflowRunHistoryReq** | [**WorkflowRunHistoryReq**](WorkflowRunHistoryReq.md)|  | |

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

<a id="getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0"></a>
# **getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0**
> Object getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0(workflowRunHistoryReq)

Get Run History

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeWorkflowsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeWorkflowsApi apiInstance = new CozeWorkflowsApi(defaultClient);
    WorkflowRunHistoryReq workflowRunHistoryReq = new WorkflowRunHistoryReq(); // WorkflowRunHistoryReq | 
    try {
      Object result = apiInstance.getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0(workflowRunHistoryReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeWorkflowsApi#getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0");
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
| **workflowRunHistoryReq** | [**WorkflowRunHistoryReq**](WorkflowRunHistoryReq.md)|  | |

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

<a id="resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost"></a>
# **resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost**
> Object resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost(workflowResumeReq)

Resume Workflow

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeWorkflowsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeWorkflowsApi apiInstance = new CozeWorkflowsApi(defaultClient);
    WorkflowResumeReq workflowResumeReq = new WorkflowResumeReq(); // WorkflowResumeReq | 
    try {
      Object result = apiInstance.resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost(workflowResumeReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeWorkflowsApi#resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost");
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
| **workflowResumeReq** | [**WorkflowResumeReq**](WorkflowResumeReq.md)|  | |

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

<a id="resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0"></a>
# **resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0**
> Object resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0(workflowResumeReq)

Resume Workflow

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeWorkflowsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeWorkflowsApi apiInstance = new CozeWorkflowsApi(defaultClient);
    WorkflowResumeReq workflowResumeReq = new WorkflowResumeReq(); // WorkflowResumeReq | 
    try {
      Object result = apiInstance.resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0(workflowResumeReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeWorkflowsApi#resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0");
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
| **workflowResumeReq** | [**WorkflowResumeReq**](WorkflowResumeReq.md)|  | |

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

<a id="searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost"></a>
# **searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost**
> Object searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost(modelSearchReq)

Search Model Workflow

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeWorkflowsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeWorkflowsApi apiInstance = new CozeWorkflowsApi(defaultClient);
    ModelSearchReq modelSearchReq = new ModelSearchReq(); // ModelSearchReq | 
    try {
      Object result = apiInstance.searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost(modelSearchReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeWorkflowsApi#searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost");
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
| **modelSearchReq** | [**ModelSearchReq**](ModelSearchReq.md)|  | |

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

<a id="searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0"></a>
# **searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0**
> Object searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0(modelSearchReq)

Search Model Workflow

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeWorkflowsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeWorkflowsApi apiInstance = new CozeWorkflowsApi(defaultClient);
    ModelSearchReq modelSearchReq = new ModelSearchReq(); // ModelSearchReq | 
    try {
      Object result = apiInstance.searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0(modelSearchReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeWorkflowsApi#searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0");
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
| **modelSearchReq** | [**ModelSearchReq**](ModelSearchReq.md)|  | |

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

<a id="streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost"></a>
# **streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost**
> Object streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost(workflowRunReq)

Stream Workflow

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeWorkflowsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeWorkflowsApi apiInstance = new CozeWorkflowsApi(defaultClient);
    WorkflowRunReq workflowRunReq = new WorkflowRunReq(); // WorkflowRunReq | 
    try {
      Object result = apiInstance.streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost(workflowRunReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeWorkflowsApi#streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost");
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
| **workflowRunReq** | [**WorkflowRunReq**](WorkflowRunReq.md)|  | |

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

<a id="streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0"></a>
# **streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0**
> Object streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0(workflowRunReq)

Stream Workflow

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeWorkflowsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeWorkflowsApi apiInstance = new CozeWorkflowsApi(defaultClient);
    WorkflowRunReq workflowRunReq = new WorkflowRunReq(); // WorkflowRunReq | 
    try {
      Object result = apiInstance.streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0(workflowRunReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeWorkflowsApi#streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0");
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
| **workflowRunReq** | [**WorkflowRunReq**](WorkflowRunReq.md)|  | |

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

