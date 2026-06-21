# AgentWithdrawalApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**applyWithdrawalApiV1AgentsApplyPost**](AgentWithdrawalApi.md#applyWithdrawalApiV1AgentsApplyPost) | **POST** /api/v1/agents/apply | 申请 Agent 提现 |
| [**getWithdrawalApiV1AgentsWithdrawalIdGet**](AgentWithdrawalApi.md#getWithdrawalApiV1AgentsWithdrawalIdGet) | **GET** /api/v1/agents/{withdrawal_id} | 提现详情 |


<a id="applyWithdrawalApiV1AgentsApplyPost"></a>
# **applyWithdrawalApiV1AgentsApplyPost**
> Object applyWithdrawalApiV1AgentsApplyPost(amount, orderIds)

申请 Agent 提现

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentWithdrawalApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentWithdrawalApi apiInstance = new AgentWithdrawalApi(defaultClient);
    Integer amount = 56; // Integer | 提现金额（分）
    String orderIds = ""; // String | 关联订单号，逗号分隔
    try {
      Object result = apiInstance.applyWithdrawalApiV1AgentsApplyPost(amount, orderIds);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentWithdrawalApi#applyWithdrawalApiV1AgentsApplyPost");
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
| **amount** | **Integer**| 提现金额（分） | |
| **orderIds** | **String**| 关联订单号，逗号分隔 | [optional] [default to ] |

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

<a id="getWithdrawalApiV1AgentsWithdrawalIdGet"></a>
# **getWithdrawalApiV1AgentsWithdrawalIdGet**
> Object getWithdrawalApiV1AgentsWithdrawalIdGet(withdrawalId)

提现详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentWithdrawalApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentWithdrawalApi apiInstance = new AgentWithdrawalApi(defaultClient);
    String withdrawalId = "withdrawalId_example"; // String | 
    try {
      Object result = apiInstance.getWithdrawalApiV1AgentsWithdrawalIdGet(withdrawalId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentWithdrawalApi#getWithdrawalApiV1AgentsWithdrawalIdGet");
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
| **withdrawalId** | **String**|  | |

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

