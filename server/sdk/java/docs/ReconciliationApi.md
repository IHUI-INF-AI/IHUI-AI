# ReconciliationApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**alipayReconcileApiV1PaymentsAlipayGet**](ReconciliationApi.md#alipayReconcileApiV1PaymentsAlipayGet) | **GET** /api/v1/payments/alipay | 拉取支付宝某天账单并对账 |
| [**allReconcileApiV1PaymentsAllGet**](ReconciliationApi.md#allReconcileApiV1PaymentsAllGet) | **GET** /api/v1/payments/all | 拉取支付宝 + 微信双边对账 |
| [**autoReconcileApiV1PaymentsAutoPost**](ReconciliationApi.md#autoReconcileApiV1PaymentsAutoPost) | **POST** /api/v1/payments/auto | 手动触发自动对账（昨天） |
| [**closeExpiredApiV1PaymentsCloseExpiredPost**](ReconciliationApi.md#closeExpiredApiV1PaymentsCloseExpiredPost) | **POST** /api/v1/payments/close_expired | 关闭 30 分钟未支付订单 |
| [**listPendingApiV1PaymentsPendingGet**](ReconciliationApi.md#listPendingApiV1PaymentsPendingGet) | **GET** /api/v1/payments/pending | 查询超时未支付订单 |
| [**wechatReconcileApiV1PaymentsWechatGet**](ReconciliationApi.md#wechatReconcileApiV1PaymentsWechatGet) | **GET** /api/v1/payments/wechat | 拉取微信某天账单并对账 |


<a id="alipayReconcileApiV1PaymentsAlipayGet"></a>
# **alipayReconcileApiV1PaymentsAlipayGet**
> Object alipayReconcileApiV1PaymentsAlipayGet(billDate)

拉取支付宝某天账单并对账

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ReconciliationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ReconciliationApi apiInstance = new ReconciliationApi(defaultClient);
    String billDate = "billDate_example"; // String | yyyy-MM-dd，默认昨天
    try {
      Object result = apiInstance.alipayReconcileApiV1PaymentsAlipayGet(billDate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ReconciliationApi#alipayReconcileApiV1PaymentsAlipayGet");
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
| **billDate** | **String**| yyyy-MM-dd，默认昨天 | [optional] |

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

<a id="allReconcileApiV1PaymentsAllGet"></a>
# **allReconcileApiV1PaymentsAllGet**
> Object allReconcileApiV1PaymentsAllGet(billDate)

拉取支付宝 + 微信双边对账

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ReconciliationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ReconciliationApi apiInstance = new ReconciliationApi(defaultClient);
    String billDate = "billDate_example"; // String | yyyy-MM-dd，默认昨天
    try {
      Object result = apiInstance.allReconcileApiV1PaymentsAllGet(billDate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ReconciliationApi#allReconcileApiV1PaymentsAllGet");
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
| **billDate** | **String**| yyyy-MM-dd，默认昨天 | [optional] |

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

<a id="autoReconcileApiV1PaymentsAutoPost"></a>
# **autoReconcileApiV1PaymentsAutoPost**
> Object autoReconcileApiV1PaymentsAutoPost()

手动触发自动对账（昨天）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ReconciliationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ReconciliationApi apiInstance = new ReconciliationApi(defaultClient);
    try {
      Object result = apiInstance.autoReconcileApiV1PaymentsAutoPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ReconciliationApi#autoReconcileApiV1PaymentsAutoPost");
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

<a id="closeExpiredApiV1PaymentsCloseExpiredPost"></a>
# **closeExpiredApiV1PaymentsCloseExpiredPost**
> Object closeExpiredApiV1PaymentsCloseExpiredPost()

关闭 30 分钟未支付订单

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ReconciliationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ReconciliationApi apiInstance = new ReconciliationApi(defaultClient);
    try {
      Object result = apiInstance.closeExpiredApiV1PaymentsCloseExpiredPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ReconciliationApi#closeExpiredApiV1PaymentsCloseExpiredPost");
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

<a id="listPendingApiV1PaymentsPendingGet"></a>
# **listPendingApiV1PaymentsPendingGet**
> Object listPendingApiV1PaymentsPendingGet()

查询超时未支付订单

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ReconciliationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ReconciliationApi apiInstance = new ReconciliationApi(defaultClient);
    try {
      Object result = apiInstance.listPendingApiV1PaymentsPendingGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ReconciliationApi#listPendingApiV1PaymentsPendingGet");
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

<a id="wechatReconcileApiV1PaymentsWechatGet"></a>
# **wechatReconcileApiV1PaymentsWechatGet**
> Object wechatReconcileApiV1PaymentsWechatGet(billDate)

拉取微信某天账单并对账

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ReconciliationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ReconciliationApi apiInstance = new ReconciliationApi(defaultClient);
    String billDate = "billDate_example"; // String | yyyy-MM-dd，默认昨天
    try {
      Object result = apiInstance.wechatReconcileApiV1PaymentsWechatGet(billDate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ReconciliationApi#wechatReconcileApiV1PaymentsWechatGet");
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
| **billDate** | **String**| yyyy-MM-dd，默认昨天 | [optional] |

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

