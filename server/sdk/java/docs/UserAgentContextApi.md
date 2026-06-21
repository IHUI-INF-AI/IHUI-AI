# UserAgentContextApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addContextApiV1UserAgentContextPost**](UserAgentContextApi.md#addContextApiV1UserAgentContextPost) | **POST** /api/v1/user-agent-context | 添加上下文消息 |
| [**addContextApiV1UserAgentContextPost_0**](UserAgentContextApi.md#addContextApiV1UserAgentContextPost_0) | **POST** /api/v1/user-agent-context | 添加上下文消息 |
| [**clearContextApiV1UserAgentContextDelete**](UserAgentContextApi.md#clearContextApiV1UserAgentContextDelete) | **DELETE** /api/v1/user-agent-context | 清空上下文 |
| [**clearContextApiV1UserAgentContextDelete_0**](UserAgentContextApi.md#clearContextApiV1UserAgentContextDelete_0) | **DELETE** /api/v1/user-agent-context | 清空上下文 |
| [**listContextApiV1UserAgentContextListGet**](UserAgentContextApi.md#listContextApiV1UserAgentContextListGet) | **GET** /api/v1/user-agent-context/list | 获取上下文 |
| [**listContextApiV1UserAgentContextListGet_0**](UserAgentContextApi.md#listContextApiV1UserAgentContextListGet_0) | **GET** /api/v1/user-agent-context/list | 获取上下文 |
| [**listSummariesApiV1UserAgentContextSummaryListGet**](UserAgentContextApi.md#listSummariesApiV1UserAgentContextSummaryListGet) | **GET** /api/v1/user-agent-context/summary/list | 总结列表 |
| [**listSummariesApiV1UserAgentContextSummaryListGet_0**](UserAgentContextApi.md#listSummariesApiV1UserAgentContextSummaryListGet_0) | **GET** /api/v1/user-agent-context/summary/list | 总结列表 |
| [**summarizeContextApiV1UserAgentContextSummaryPost**](UserAgentContextApi.md#summarizeContextApiV1UserAgentContextSummaryPost) | **POST** /api/v1/user-agent-context/summary | 总结上下文 |
| [**summarizeContextApiV1UserAgentContextSummaryPost_0**](UserAgentContextApi.md#summarizeContextApiV1UserAgentContextSummaryPost_0) | **POST** /api/v1/user-agent-context/summary | 总结上下文 |


<a id="addContextApiV1UserAgentContextPost"></a>
# **addContextApiV1UserAgentContextPost**
> Object addContextApiV1UserAgentContextPost(agentId, sessionId, role, content, contentType, tokens, model)

添加上下文消息

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserAgentContextApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserAgentContextApi apiInstance = new UserAgentContextApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    String sessionId = "sessionId_example"; // String | 
    String role = "role_example"; // String | 
    String content = "content_example"; // String | 
    String contentType = "text"; // String | 
    Integer tokens = 0; // Integer | 
    String model = "model_example"; // String | 
    try {
      Object result = apiInstance.addContextApiV1UserAgentContextPost(agentId, sessionId, role, content, contentType, tokens, model);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserAgentContextApi#addContextApiV1UserAgentContextPost");
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
| **agentId** | **String**|  | |
| **sessionId** | **String**|  | |
| **role** | **String**|  | |
| **content** | **String**|  | |
| **contentType** | **String**|  | [optional] [default to text] |
| **tokens** | **Integer**|  | [optional] [default to 0] |
| **model** | **String**|  | [optional] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="addContextApiV1UserAgentContextPost_0"></a>
# **addContextApiV1UserAgentContextPost_0**
> Object addContextApiV1UserAgentContextPost_0(agentId, sessionId, role, content, contentType, tokens, model)

添加上下文消息

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserAgentContextApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserAgentContextApi apiInstance = new UserAgentContextApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    String sessionId = "sessionId_example"; // String | 
    String role = "role_example"; // String | 
    String content = "content_example"; // String | 
    String contentType = "text"; // String | 
    Integer tokens = 0; // Integer | 
    String model = "model_example"; // String | 
    try {
      Object result = apiInstance.addContextApiV1UserAgentContextPost_0(agentId, sessionId, role, content, contentType, tokens, model);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserAgentContextApi#addContextApiV1UserAgentContextPost_0");
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
| **agentId** | **String**|  | |
| **sessionId** | **String**|  | |
| **role** | **String**|  | |
| **content** | **String**|  | |
| **contentType** | **String**|  | [optional] [default to text] |
| **tokens** | **Integer**|  | [optional] [default to 0] |
| **model** | **String**|  | [optional] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="clearContextApiV1UserAgentContextDelete"></a>
# **clearContextApiV1UserAgentContextDelete**
> Object clearContextApiV1UserAgentContextDelete(agentId, sessionId)

清空上下文

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserAgentContextApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserAgentContextApi apiInstance = new UserAgentContextApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    String sessionId = "sessionId_example"; // String | 
    try {
      Object result = apiInstance.clearContextApiV1UserAgentContextDelete(agentId, sessionId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserAgentContextApi#clearContextApiV1UserAgentContextDelete");
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
| **agentId** | **String**|  | |
| **sessionId** | **String**|  | [optional] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="clearContextApiV1UserAgentContextDelete_0"></a>
# **clearContextApiV1UserAgentContextDelete_0**
> Object clearContextApiV1UserAgentContextDelete_0(agentId, sessionId)

清空上下文

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserAgentContextApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserAgentContextApi apiInstance = new UserAgentContextApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    String sessionId = "sessionId_example"; // String | 
    try {
      Object result = apiInstance.clearContextApiV1UserAgentContextDelete_0(agentId, sessionId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserAgentContextApi#clearContextApiV1UserAgentContextDelete_0");
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
| **agentId** | **String**|  | |
| **sessionId** | **String**|  | [optional] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listContextApiV1UserAgentContextListGet"></a>
# **listContextApiV1UserAgentContextListGet**
> Object listContextApiV1UserAgentContextListGet(agentId, sessionId, limit)

获取上下文

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserAgentContextApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserAgentContextApi apiInstance = new UserAgentContextApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    String sessionId = "sessionId_example"; // String | 
    Integer limit = 50; // Integer | 
    try {
      Object result = apiInstance.listContextApiV1UserAgentContextListGet(agentId, sessionId, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserAgentContextApi#listContextApiV1UserAgentContextListGet");
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
| **agentId** | **String**|  | |
| **sessionId** | **String**|  | [optional] |
| **limit** | **Integer**|  | [optional] [default to 50] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listContextApiV1UserAgentContextListGet_0"></a>
# **listContextApiV1UserAgentContextListGet_0**
> Object listContextApiV1UserAgentContextListGet_0(agentId, sessionId, limit)

获取上下文

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserAgentContextApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserAgentContextApi apiInstance = new UserAgentContextApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    String sessionId = "sessionId_example"; // String | 
    Integer limit = 50; // Integer | 
    try {
      Object result = apiInstance.listContextApiV1UserAgentContextListGet_0(agentId, sessionId, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserAgentContextApi#listContextApiV1UserAgentContextListGet_0");
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
| **agentId** | **String**|  | |
| **sessionId** | **String**|  | [optional] |
| **limit** | **Integer**|  | [optional] [default to 50] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listSummariesApiV1UserAgentContextSummaryListGet"></a>
# **listSummariesApiV1UserAgentContextSummaryListGet**
> Object listSummariesApiV1UserAgentContextSummaryListGet(agentId, limit)

总结列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserAgentContextApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserAgentContextApi apiInstance = new UserAgentContextApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    Integer limit = 10; // Integer | 
    try {
      Object result = apiInstance.listSummariesApiV1UserAgentContextSummaryListGet(agentId, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserAgentContextApi#listSummariesApiV1UserAgentContextSummaryListGet");
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
| **agentId** | **String**|  | |
| **limit** | **Integer**|  | [optional] [default to 10] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listSummariesApiV1UserAgentContextSummaryListGet_0"></a>
# **listSummariesApiV1UserAgentContextSummaryListGet_0**
> Object listSummariesApiV1UserAgentContextSummaryListGet_0(agentId, limit)

总结列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserAgentContextApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserAgentContextApi apiInstance = new UserAgentContextApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    Integer limit = 10; // Integer | 
    try {
      Object result = apiInstance.listSummariesApiV1UserAgentContextSummaryListGet_0(agentId, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserAgentContextApi#listSummariesApiV1UserAgentContextSummaryListGet_0");
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
| **agentId** | **String**|  | |
| **limit** | **Integer**|  | [optional] [default to 10] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="summarizeContextApiV1UserAgentContextSummaryPost"></a>
# **summarizeContextApiV1UserAgentContextSummaryPost**
> Object summarizeContextApiV1UserAgentContextSummaryPost(agentId, summary, sessionId, startId, endId, tokens)

总结上下文

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserAgentContextApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserAgentContextApi apiInstance = new UserAgentContextApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    String summary = "summary_example"; // String | 
    String sessionId = "sessionId_example"; // String | 
    Integer startId = 0; // Integer | 
    Integer endId = 0; // Integer | 
    Integer tokens = 0; // Integer | 
    try {
      Object result = apiInstance.summarizeContextApiV1UserAgentContextSummaryPost(agentId, summary, sessionId, startId, endId, tokens);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserAgentContextApi#summarizeContextApiV1UserAgentContextSummaryPost");
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
| **agentId** | **String**|  | |
| **summary** | **String**|  | |
| **sessionId** | **String**|  | [optional] |
| **startId** | **Integer**|  | [optional] [default to 0] |
| **endId** | **Integer**|  | [optional] [default to 0] |
| **tokens** | **Integer**|  | [optional] [default to 0] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="summarizeContextApiV1UserAgentContextSummaryPost_0"></a>
# **summarizeContextApiV1UserAgentContextSummaryPost_0**
> Object summarizeContextApiV1UserAgentContextSummaryPost_0(agentId, summary, sessionId, startId, endId, tokens)

总结上下文

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserAgentContextApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserAgentContextApi apiInstance = new UserAgentContextApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    String summary = "summary_example"; // String | 
    String sessionId = "sessionId_example"; // String | 
    Integer startId = 0; // Integer | 
    Integer endId = 0; // Integer | 
    Integer tokens = 0; // Integer | 
    try {
      Object result = apiInstance.summarizeContextApiV1UserAgentContextSummaryPost_0(agentId, summary, sessionId, startId, endId, tokens);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserAgentContextApi#summarizeContextApiV1UserAgentContextSummaryPost_0");
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
| **agentId** | **String**|  | |
| **summary** | **String**|  | |
| **sessionId** | **String**|  | [optional] |
| **startId** | **Integer**|  | [optional] [default to 0] |
| **endId** | **Integer**|  | [optional] [default to 0] |
| **tokens** | **Integer**|  | [optional] [default to 0] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

