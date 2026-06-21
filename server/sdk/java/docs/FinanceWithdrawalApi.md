# FinanceWithdrawalApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**applyAgentWithdrawalApiV1FinanceAgentApplyPost**](FinanceWithdrawalApi.md#applyAgentWithdrawalApiV1FinanceAgentApplyPost) | **POST** /api/v1/finance/agent/apply | Agent 收益提现申请 |
| [**applyWithdrawalApiV1FinanceApplyPost**](FinanceWithdrawalApi.md#applyWithdrawalApiV1FinanceApplyPost) | **POST** /api/v1/finance/apply | 申请提现 |
| [**availableBalanceApiV1FinanceAvailableGet**](FinanceWithdrawalApi.md#availableBalanceApiV1FinanceAvailableGet) | **GET** /api/v1/finance/available | 个人可收款查询 |
| [**listAgentWithdrawalsApiV1FinanceAgentListGet**](FinanceWithdrawalApi.md#listAgentWithdrawalsApiV1FinanceAgentListGet) | **GET** /api/v1/finance/agent/list | Agent 提现记录 |
| [**listWithdrawalsApiV1FinanceListGet**](FinanceWithdrawalApi.md#listWithdrawalsApiV1FinanceListGet) | **GET** /api/v1/finance/list | 我的提现记录 |
| [**withdrawalSummaryApiV1FinanceSummaryGet**](FinanceWithdrawalApi.md#withdrawalSummaryApiV1FinanceSummaryGet) | **GET** /api/v1/finance/summary | 提现详情面板数据（总提现/待审核/已到账） |


<a id="applyAgentWithdrawalApiV1FinanceAgentApplyPost"></a>
# **applyAgentWithdrawalApiV1FinanceAgentApplyPost**
> Object applyAgentWithdrawalApiV1FinanceAgentApplyPost(amount)

Agent 收益提现申请

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceWithdrawalApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceWithdrawalApi apiInstance = new FinanceWithdrawalApi(defaultClient);
    Integer amount = 56; // Integer | 提现金额（分）
    try {
      Object result = apiInstance.applyAgentWithdrawalApiV1FinanceAgentApplyPost(amount);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceWithdrawalApi#applyAgentWithdrawalApiV1FinanceAgentApplyPost");
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

<a id="applyWithdrawalApiV1FinanceApplyPost"></a>
# **applyWithdrawalApiV1FinanceApplyPost**
> Object applyWithdrawalApiV1FinanceApplyPost(amount)

申请提现

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceWithdrawalApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceWithdrawalApi apiInstance = new FinanceWithdrawalApi(defaultClient);
    Integer amount = 56; // Integer | 提现金额（分）
    try {
      Object result = apiInstance.applyWithdrawalApiV1FinanceApplyPost(amount);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceWithdrawalApi#applyWithdrawalApiV1FinanceApplyPost");
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

<a id="availableBalanceApiV1FinanceAvailableGet"></a>
# **availableBalanceApiV1FinanceAvailableGet**
> Object availableBalanceApiV1FinanceAvailableGet()

个人可收款查询

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceWithdrawalApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceWithdrawalApi apiInstance = new FinanceWithdrawalApi(defaultClient);
    try {
      Object result = apiInstance.availableBalanceApiV1FinanceAvailableGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceWithdrawalApi#availableBalanceApiV1FinanceAvailableGet");
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

<a id="listAgentWithdrawalsApiV1FinanceAgentListGet"></a>
# **listAgentWithdrawalsApiV1FinanceAgentListGet**
> Object listAgentWithdrawalsApiV1FinanceAgentListGet(page, limit)

Agent 提现记录

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceWithdrawalApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceWithdrawalApi apiInstance = new FinanceWithdrawalApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listAgentWithdrawalsApiV1FinanceAgentListGet(page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceWithdrawalApi#listAgentWithdrawalsApiV1FinanceAgentListGet");
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

<a id="listWithdrawalsApiV1FinanceListGet"></a>
# **listWithdrawalsApiV1FinanceListGet**
> Object listWithdrawalsApiV1FinanceListGet(page, limit)

我的提现记录

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceWithdrawalApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceWithdrawalApi apiInstance = new FinanceWithdrawalApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listWithdrawalsApiV1FinanceListGet(page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceWithdrawalApi#listWithdrawalsApiV1FinanceListGet");
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

<a id="withdrawalSummaryApiV1FinanceSummaryGet"></a>
# **withdrawalSummaryApiV1FinanceSummaryGet**
> Object withdrawalSummaryApiV1FinanceSummaryGet()

提现详情面板数据（总提现/待审核/已到账）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceWithdrawalApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceWithdrawalApi apiInstance = new FinanceWithdrawalApi(defaultClient);
    try {
      Object result = apiInstance.withdrawalSummaryApiV1FinanceSummaryGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceWithdrawalApi#withdrawalSummaryApiV1FinanceSummaryGet");
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

