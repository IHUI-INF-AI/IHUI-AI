# AgentsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**deleteApiV1AgentsAgentIdDelete**](AgentsApi.md#deleteApiV1AgentsAgentIdDelete) | **DELETE** /api/v1/agents/{agent_id} | Delete agent |
| [**getDetailApiV1AgentsAgentIdGet**](AgentsApi.md#getDetailApiV1AgentsAgentIdGet) | **GET** /api/v1/agents/{agent_id} | Get agent detail |
| [**updateApiV1AgentsAgentIdPut**](AgentsApi.md#updateApiV1AgentsAgentIdPut) | **PUT** /api/v1/agents/{agent_id} | Update agent |


<a id="deleteApiV1AgentsAgentIdDelete"></a>
# **deleteApiV1AgentsAgentIdDelete**
> Object deleteApiV1AgentsAgentIdDelete(agentId)

Delete agent

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentsApi apiInstance = new AgentsApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    try {
      Object result = apiInstance.deleteApiV1AgentsAgentIdDelete(agentId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentsApi#deleteApiV1AgentsAgentIdDelete");
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="getDetailApiV1AgentsAgentIdGet"></a>
# **getDetailApiV1AgentsAgentIdGet**
> Object getDetailApiV1AgentsAgentIdGet(agentId)

Get agent detail

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentsApi apiInstance = new AgentsApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    try {
      Object result = apiInstance.getDetailApiV1AgentsAgentIdGet(agentId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentsApi#getDetailApiV1AgentsAgentIdGet");
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="updateApiV1AgentsAgentIdPut"></a>
# **updateApiV1AgentsAgentIdPut**
> Object updateApiV1AgentsAgentIdPut(agentId, agentName, agentPrompt, publishStatus)

Update agent

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentsApi apiInstance = new AgentsApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    String agentName = "agentName_example"; // String | 
    String agentPrompt = "agentPrompt_example"; // String | 
    Integer publishStatus = 56; // Integer | 
    try {
      Object result = apiInstance.updateApiV1AgentsAgentIdPut(agentId, agentName, agentPrompt, publishStatus);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentsApi#updateApiV1AgentsAgentIdPut");
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
| **agentName** | **String**|  | [optional] |
| **agentPrompt** | **String**|  | [optional] |
| **publishStatus** | **Integer**|  | [optional] |

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

