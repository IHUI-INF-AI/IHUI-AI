# FinanceCommissionApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**listOrdersApiV1FinanceOrdersGet**](FinanceCommissionApi.md#listOrdersApiV1FinanceOrdersGet) | **GET** /api/v1/finance/orders | 我的订单列表（分页+筛选） |
| [**settleCommissionApiV1FinanceSettleCommissionIdPost**](FinanceCommissionApi.md#settleCommissionApiV1FinanceSettleCommissionIdPost) | **POST** /api/v1/finance/settle/{commission_id} | 手动结算佣金流水 |


<a id="listOrdersApiV1FinanceOrdersGet"></a>
# **listOrdersApiV1FinanceOrdersGet**
> Object listOrdersApiV1FinanceOrdersGet(page, limit, orderType, status)

我的订单列表（分页+筛选）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceCommissionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceCommissionApi apiInstance = new FinanceCommissionApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer orderType = 56; // Integer | 订单类型：0=token 1=activity 2=identity 3=agent
    Integer status = 56; // Integer | 订单状态：0=待支付 1=已支付 2=已退款 3=已取消
    try {
      Object result = apiInstance.listOrdersApiV1FinanceOrdersGet(page, limit, orderType, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceCommissionApi#listOrdersApiV1FinanceOrdersGet");
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
| **orderType** | **Integer**| 订单类型：0&#x3D;token 1&#x3D;activity 2&#x3D;identity 3&#x3D;agent | [optional] |
| **status** | **Integer**| 订单状态：0&#x3D;待支付 1&#x3D;已支付 2&#x3D;已退款 3&#x3D;已取消 | [optional] |

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

<a id="settleCommissionApiV1FinanceSettleCommissionIdPost"></a>
# **settleCommissionApiV1FinanceSettleCommissionIdPost**
> Object settleCommissionApiV1FinanceSettleCommissionIdPost(commissionId)

手动结算佣金流水

Mirrors Java updateByIdToSettle: manually mark a commission flow as settled (type&#x3D;1).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceCommissionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceCommissionApi apiInstance = new FinanceCommissionApi(defaultClient);
    Integer commissionId = 56; // Integer | 
    try {
      Object result = apiInstance.settleCommissionApiV1FinanceSettleCommissionIdPost(commissionId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceCommissionApi#settleCommissionApiV1FinanceSettleCommissionIdPost");
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
| **commissionId** | **Integer**|  | |

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

