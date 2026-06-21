# AlipayApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**alipayQueryApiV1PaymentsAlipayQueryPost**](AlipayApi.md#alipayQueryApiV1PaymentsAlipayQueryPost) | **POST** /api/v1/payments/alipay/query | Query Alipay order |
| [**alipayRefundApiV1PaymentsAlipayRefundPost**](AlipayApi.md#alipayRefundApiV1PaymentsAlipayRefundPost) | **POST** /api/v1/payments/alipay/refund | Alipay 退款（调用 alipay.trade.refund） |
| [**createAlipayApiV1PaymentsAlipayCreatePost**](AlipayApi.md#createAlipayApiV1PaymentsAlipayCreatePost) | **POST** /api/v1/payments/alipay/create | Create Alipay PC / H5 page pay |
| [**createAlipayAppApiV1PaymentsAlipayAppCreatePost**](AlipayApi.md#createAlipayAppApiV1PaymentsAlipayAppCreatePost) | **POST** /api/v1/payments/alipay/app/create | Create Alipay order for mobile app |


<a id="alipayQueryApiV1PaymentsAlipayQueryPost"></a>
# **alipayQueryApiV1PaymentsAlipayQueryPost**
> Object alipayQueryApiV1PaymentsAlipayQueryPost(outTradeNo)

Query Alipay order

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AlipayApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AlipayApi apiInstance = new AlipayApi(defaultClient);
    String outTradeNo = "outTradeNo_example"; // String | 
    try {
      Object result = apiInstance.alipayQueryApiV1PaymentsAlipayQueryPost(outTradeNo);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AlipayApi#alipayQueryApiV1PaymentsAlipayQueryPost");
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
| **outTradeNo** | **String**|  | |

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

<a id="alipayRefundApiV1PaymentsAlipayRefundPost"></a>
# **alipayRefundApiV1PaymentsAlipayRefundPost**
> Object alipayRefundApiV1PaymentsAlipayRefundPost(outTradeNo, refundAmount, reason)

Alipay 退款（调用 alipay.trade.refund）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AlipayApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AlipayApi apiInstance = new AlipayApi(defaultClient);
    String outTradeNo = "outTradeNo_example"; // String | 
    BigDecimal refundAmount = new BigDecimal(78); // BigDecimal | 退款金额（元）
    String reason = "用户申请退款"; // String | 
    try {
      Object result = apiInstance.alipayRefundApiV1PaymentsAlipayRefundPost(outTradeNo, refundAmount, reason);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AlipayApi#alipayRefundApiV1PaymentsAlipayRefundPost");
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
| **outTradeNo** | **String**|  | |
| **refundAmount** | **BigDecimal**| 退款金额（元） | |
| **reason** | **String**|  | [optional] [default to 用户申请退款] |

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

<a id="createAlipayApiV1PaymentsAlipayCreatePost"></a>
# **createAlipayApiV1PaymentsAlipayCreatePost**
> Object createAlipayApiV1PaymentsAlipayCreatePost(amount, productId, orderType, subject)

Create Alipay PC / H5 page pay

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AlipayApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AlipayApi apiInstance = new AlipayApi(defaultClient);
    BigDecimal amount = new BigDecimal(78); // BigDecimal | 金额（元）
    String productId = "productId_example"; // String | 
    Integer orderType = 0; // Integer | 
    String subject = "订单支付"; // String | 
    try {
      Object result = apiInstance.createAlipayApiV1PaymentsAlipayCreatePost(amount, productId, orderType, subject);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AlipayApi#createAlipayApiV1PaymentsAlipayCreatePost");
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
| **amount** | **BigDecimal**| 金额（元） | |
| **productId** | **String**|  | [optional] |
| **orderType** | **Integer**|  | [optional] [default to 0] |
| **subject** | **String**|  | [optional] [default to 订单支付] |

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

<a id="createAlipayAppApiV1PaymentsAlipayAppCreatePost"></a>
# **createAlipayAppApiV1PaymentsAlipayAppCreatePost**
> Object createAlipayAppApiV1PaymentsAlipayAppCreatePost(amount, productId, orderType, subject)

Create Alipay order for mobile app

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AlipayApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AlipayApi apiInstance = new AlipayApi(defaultClient);
    BigDecimal amount = new BigDecimal(78); // BigDecimal | 
    String productId = "productId_example"; // String | 
    Integer orderType = 0; // Integer | 
    String subject = "订单支付"; // String | 
    try {
      Object result = apiInstance.createAlipayAppApiV1PaymentsAlipayAppCreatePost(amount, productId, orderType, subject);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AlipayApi#createAlipayAppApiV1PaymentsAlipayAppCreatePost");
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
| **amount** | **BigDecimal**|  | |
| **productId** | **String**|  | [optional] |
| **orderType** | **Integer**|  | [optional] [default to 0] |
| **subject** | **String**|  | [optional] [default to 订单支付] |

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

