# AgentPurchaseApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**expirePurchaseApiV1AgentsRecordIdExpirePut**](AgentPurchaseApi.md#expirePurchaseApiV1AgentsRecordIdExpirePut) | **PUT** /api/v1/agents/{record_id}/expire | Mark purchase record as expired |
| [**getPurchaseByOrderApiV1AgentsOrderOrderNoGet**](AgentPurchaseApi.md#getPurchaseByOrderApiV1AgentsOrderOrderNoGet) | **GET** /api/v1/agents/order/{order_no} | Query by order number |
| [**getPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet**](AgentPurchaseApi.md#getPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet) | **GET** /api/v1/agents/user/{user_uuid}/agent/{agent_id} | Query by user and agent |
| [**listExpiredPurchasesApiV1AgentsExpiredGet**](AgentPurchaseApi.md#listExpiredPurchasesApiV1AgentsExpiredGet) | **GET** /api/v1/agents/expired | List expired purchase records |


<a id="expirePurchaseApiV1AgentsRecordIdExpirePut"></a>
# **expirePurchaseApiV1AgentsRecordIdExpirePut**
> Object expirePurchaseApiV1AgentsRecordIdExpirePut(recordId)

Mark purchase record as expired

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentPurchaseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentPurchaseApi apiInstance = new AgentPurchaseApi(defaultClient);
    Integer recordId = 56; // Integer | 
    try {
      Object result = apiInstance.expirePurchaseApiV1AgentsRecordIdExpirePut(recordId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentPurchaseApi#expirePurchaseApiV1AgentsRecordIdExpirePut");
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
| **recordId** | **Integer**|  | |

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

<a id="getPurchaseByOrderApiV1AgentsOrderOrderNoGet"></a>
# **getPurchaseByOrderApiV1AgentsOrderOrderNoGet**
> Object getPurchaseByOrderApiV1AgentsOrderOrderNoGet(orderNo)

Query by order number

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentPurchaseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentPurchaseApi apiInstance = new AgentPurchaseApi(defaultClient);
    String orderNo = "orderNo_example"; // String | 
    try {
      Object result = apiInstance.getPurchaseByOrderApiV1AgentsOrderOrderNoGet(orderNo);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentPurchaseApi#getPurchaseByOrderApiV1AgentsOrderOrderNoGet");
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
| **orderNo** | **String**|  | |

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

<a id="getPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet"></a>
# **getPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet**
> Object getPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet(userUuid, agentId, page, limit)

Query by user and agent

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentPurchaseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentPurchaseApi apiInstance = new AgentPurchaseApi(defaultClient);
    String userUuid = "userUuid_example"; // String | 
    String agentId = "agentId_example"; // String | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.getPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet(userUuid, agentId, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentPurchaseApi#getPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet");
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
| **userUuid** | **String**|  | |
| **agentId** | **String**|  | |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |

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

<a id="listExpiredPurchasesApiV1AgentsExpiredGet"></a>
# **listExpiredPurchasesApiV1AgentsExpiredGet**
> Object listExpiredPurchasesApiV1AgentsExpiredGet(page, limit)

List expired purchase records

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentPurchaseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentPurchaseApi apiInstance = new AgentPurchaseApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listExpiredPurchasesApiV1AgentsExpiredGet(page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentPurchaseApi#listExpiredPurchasesApiV1AgentsExpiredGet");
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

