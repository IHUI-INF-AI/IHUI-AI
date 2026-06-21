# AgentRulesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**acceptNeedTaskApiV1AgentsNeedTaskAcceptPost**](AgentRulesApi.md#acceptNeedTaskApiV1AgentsNeedTaskAcceptPost) | **POST** /api/v1/agents/need-task/accept | 接单需求任务 |
| [**completeNeedTaskApiV1AgentsNeedTaskCompletePost**](AgentRulesApi.md#completeNeedTaskApiV1AgentsNeedTaskCompletePost) | **POST** /api/v1/agents/need-task/complete | 完成需求任务 |
| [**createNeedTaskApiV1AgentsNeedTaskCreatePost**](AgentRulesApi.md#createNeedTaskApiV1AgentsNeedTaskCreatePost) | **POST** /api/v1/agents/need-task/create | 创建需求任务 |
| [**listNeedTasksApiV1AgentsNeedTaskListGet**](AgentRulesApi.md#listNeedTasksApiV1AgentsNeedTaskListGet) | **GET** /api/v1/agents/need-task/list | 需求任务列表 |
| [**toggleRuleApiV1AgentsTogglePost**](AgentRulesApi.md#toggleRuleApiV1AgentsTogglePost) | **POST** /api/v1/agents/toggle | 启用/禁用规则 |


<a id="acceptNeedTaskApiV1AgentsNeedTaskAcceptPost"></a>
# **acceptNeedTaskApiV1AgentsNeedTaskAcceptPost**
> Object acceptNeedTaskApiV1AgentsNeedTaskAcceptPost(taskId)

接单需求任务

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentRulesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentRulesApi apiInstance = new AgentRulesApi(defaultClient);
    Integer taskId = 56; // Integer | 
    try {
      Object result = apiInstance.acceptNeedTaskApiV1AgentsNeedTaskAcceptPost(taskId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentRulesApi#acceptNeedTaskApiV1AgentsNeedTaskAcceptPost");
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
| **taskId** | **Integer**|  | |

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

<a id="completeNeedTaskApiV1AgentsNeedTaskCompletePost"></a>
# **completeNeedTaskApiV1AgentsNeedTaskCompletePost**
> Object completeNeedTaskApiV1AgentsNeedTaskCompletePost(taskId)

完成需求任务

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentRulesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentRulesApi apiInstance = new AgentRulesApi(defaultClient);
    Integer taskId = 56; // Integer | 
    try {
      Object result = apiInstance.completeNeedTaskApiV1AgentsNeedTaskCompletePost(taskId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentRulesApi#completeNeedTaskApiV1AgentsNeedTaskCompletePost");
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
| **taskId** | **Integer**|  | |

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

<a id="createNeedTaskApiV1AgentsNeedTaskCreatePost"></a>
# **createNeedTaskApiV1AgentsNeedTaskCreatePost**
> Object createNeedTaskApiV1AgentsNeedTaskCreatePost(taskName, taskDesc, agentId, rewardTokens, deadline)

创建需求任务

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentRulesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentRulesApi apiInstance = new AgentRulesApi(defaultClient);
    String taskName = "taskName_example"; // String | 
    String taskDesc = ""; // String | 
    String agentId = ""; // String | 
    Integer rewardTokens = 0; // Integer | 
    String deadline = "deadline_example"; // String | ISO 时间字符串
    try {
      Object result = apiInstance.createNeedTaskApiV1AgentsNeedTaskCreatePost(taskName, taskDesc, agentId, rewardTokens, deadline);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentRulesApi#createNeedTaskApiV1AgentsNeedTaskCreatePost");
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
| **taskName** | **String**|  | |
| **taskDesc** | **String**|  | [optional] [default to ] |
| **agentId** | **String**|  | [optional] [default to ] |
| **rewardTokens** | **Integer**|  | [optional] [default to 0] |
| **deadline** | **String**| ISO 时间字符串 | [optional] |

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

<a id="listNeedTasksApiV1AgentsNeedTaskListGet"></a>
# **listNeedTasksApiV1AgentsNeedTaskListGet**
> Object listNeedTasksApiV1AgentsNeedTaskListGet(page, limit, status)

需求任务列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentRulesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentRulesApi apiInstance = new AgentRulesApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.listNeedTasksApiV1AgentsNeedTaskListGet(page, limit, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentRulesApi#listNeedTasksApiV1AgentsNeedTaskListGet");
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
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **status** | **Integer**|  | [optional] |

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

<a id="toggleRuleApiV1AgentsTogglePost"></a>
# **toggleRuleApiV1AgentsTogglePost**
> Object toggleRuleApiV1AgentsTogglePost(ruleId, status)

启用/禁用规则

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentRulesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentRulesApi apiInstance = new AgentRulesApi(defaultClient);
    Integer ruleId = 56; // Integer | 
    Integer status = 56; // Integer | 0 禁用 1 启用
    try {
      Object result = apiInstance.toggleRuleApiV1AgentsTogglePost(ruleId, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentRulesApi#toggleRuleApiV1AgentsTogglePost");
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
| **ruleId** | **Integer**|  | |
| **status** | **Integer**| 0 禁用 1 启用 | |

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

