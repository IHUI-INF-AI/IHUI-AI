# AgentSettlementApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**listUnsettledApiV1AgentsUnsettledGet**](AgentSettlementApi.md#listUnsettledApiV1AgentsUnsettledGet) | **GET** /api/v1/agents/unsettled | 查询未结算记录 |
| [**settlementSummaryApiV1AgentsSummaryGet**](AgentSettlementApi.md#settlementSummaryApiV1AgentsSummaryGet) | **GET** /api/v1/agents/summary | 结算汇总 |
| [**triggerSettleApiV1AgentsSettlePost**](AgentSettlementApi.md#triggerSettleApiV1AgentsSettlePost) | **POST** /api/v1/agents/settle | 触发单条结算 |


<a id="listUnsettledApiV1AgentsUnsettledGet"></a>
# **listUnsettledApiV1AgentsUnsettledGet**
> Object listUnsettledApiV1AgentsUnsettledGet()

查询未结算记录

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentSettlementApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentSettlementApi apiInstance = new AgentSettlementApi(defaultClient);
    try {
      Object result = apiInstance.listUnsettledApiV1AgentsUnsettledGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentSettlementApi#listUnsettledApiV1AgentsUnsettledGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

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

<a id="settlementSummaryApiV1AgentsSummaryGet"></a>
# **settlementSummaryApiV1AgentsSummaryGet**
> Object settlementSummaryApiV1AgentsSummaryGet()

结算汇总

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentSettlementApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentSettlementApi apiInstance = new AgentSettlementApi(defaultClient);
    try {
      Object result = apiInstance.settlementSummaryApiV1AgentsSummaryGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentSettlementApi#settlementSummaryApiV1AgentsSummaryGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

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

<a id="triggerSettleApiV1AgentsSettlePost"></a>
# **triggerSettleApiV1AgentsSettlePost**
> Object triggerSettleApiV1AgentsSettlePost(settlementId)

触发单条结算

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentSettlementApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentSettlementApi apiInstance = new AgentSettlementApi(defaultClient);
    String settlementId = "settlementId_example"; // String | 
    try {
      Object result = apiInstance.triggerSettleApiV1AgentsSettlePost(settlementId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentSettlementApi#triggerSettleApiV1AgentsSettlePost");
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
| **settlementId** | **String**|  | |

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

