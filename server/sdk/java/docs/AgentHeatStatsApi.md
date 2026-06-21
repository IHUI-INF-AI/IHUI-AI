# AgentHeatStatsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**agentHeatApiV1AgentsAgentAgentIdGet**](AgentHeatStatsApi.md#agentHeatApiV1AgentsAgentAgentIdGet) | **GET** /api/v1/agents/agent/{agent_id} | 查询 Agent 热度（按日聚合） |
| [**hitApiV1AgentsHitPost**](AgentHeatStatsApi.md#hitApiV1AgentsHitPost) | **POST** /api/v1/agents/hit | 记录一次 Agent 命中（内部调用） |
| [**topAgentsApiV1AgentsTopGet**](AgentHeatStatsApi.md#topAgentsApiV1AgentsTopGet) | **GET** /api/v1/agents/top | 热度 TOP 榜 |


<a id="agentHeatApiV1AgentsAgentAgentIdGet"></a>
# **agentHeatApiV1AgentsAgentAgentIdGet**
> Object agentHeatApiV1AgentsAgentAgentIdGet(agentId, days)

查询 Agent 热度（按日聚合）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentHeatStatsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentHeatStatsApi apiInstance = new AgentHeatStatsApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    Integer days = 7; // Integer | 
    try {
      Object result = apiInstance.agentHeatApiV1AgentsAgentAgentIdGet(agentId, days);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentHeatStatsApi#agentHeatApiV1AgentsAgentAgentIdGet");
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
| **days** | **Integer**|  | [optional] [default to 7] |

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

<a id="hitApiV1AgentsHitPost"></a>
# **hitApiV1AgentsHitPost**
> Object hitApiV1AgentsHitPost(agentId)

记录一次 Agent 命中（内部调用）

累加当日 hit_count。无对应行时新建。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentHeatStatsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentHeatStatsApi apiInstance = new AgentHeatStatsApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    try {
      Object result = apiInstance.hitApiV1AgentsHitPost(agentId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentHeatStatsApi#hitApiV1AgentsHitPost");
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

<a id="topAgentsApiV1AgentsTopGet"></a>
# **topAgentsApiV1AgentsTopGet**
> Object topAgentsApiV1AgentsTopGet(days, limit)

热度 TOP 榜

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentHeatStatsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentHeatStatsApi apiInstance = new AgentHeatStatsApi(defaultClient);
    Integer days = 7; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.topAgentsApiV1AgentsTopGet(days, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentHeatStatsApi#topAgentsApiV1AgentsTopGet");
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
| **days** | **Integer**|  | [optional] [default to 7] |
| **limit** | **Integer**|  | [optional] [default to 20] |

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

