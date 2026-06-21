# PaymentFundApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createFundOrderApiV1PaymentsCreateOrderPost**](PaymentFundApi.md#createFundOrderApiV1PaymentsCreateOrderPost) | **POST** /api/v1/payments/createOrder | 创建基金充值订单 |
| [**fundTransferApiV1PaymentsTransferPost**](PaymentFundApi.md#fundTransferApiV1PaymentsTransferPost) | **POST** /api/v1/payments/transfer | 银行转账 |
| [**fundWechatPayApiV1PaymentsWechatPayPost**](PaymentFundApi.md#fundWechatPayApiV1PaymentsWechatPayPost) | **POST** /api/v1/payments/wechatPay | 基金微信支付 |
| [**fundWithdrawalApiV1PaymentsWithdrawalPost**](PaymentFundApi.md#fundWithdrawalApiV1PaymentsWithdrawalPost) | **POST** /api/v1/payments/withdrawal | 基金提现 |


<a id="createFundOrderApiV1PaymentsCreateOrderPost"></a>
# **createFundOrderApiV1PaymentsCreateOrderPost**
> Object createFundOrderApiV1PaymentsCreateOrderPost(amount, productId, orderType)

创建基金充值订单

对应 Java: FundController.createOrder — 创建充值订单并返回支付参数.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.PaymentFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    PaymentFundApi apiInstance = new PaymentFundApi(defaultClient);
    BigDecimal amount = new BigDecimal(78); // BigDecimal | 充值金额（元）
    String productId = "productId_example"; // String | 
    Integer orderType = 0; // Integer | 
    try {
      Object result = apiInstance.createFundOrderApiV1PaymentsCreateOrderPost(amount, productId, orderType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling PaymentFundApi#createFundOrderApiV1PaymentsCreateOrderPost");
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
| **amount** | **BigDecimal**| 充值金额（元） | |
| **productId** | **String**|  | [optional] |
| **orderType** | **Integer**|  | [optional] [default to 0] |

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

<a id="fundTransferApiV1PaymentsTransferPost"></a>
# **fundTransferApiV1PaymentsTransferPost**
> Object fundTransferApiV1PaymentsTransferPost(amount, bankAccount, bankName)

银行转账

对应 Java: FundController.transfer — 银行转账（审核后执行）.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.PaymentFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    PaymentFundApi apiInstance = new PaymentFundApi(defaultClient);
    Integer amount = 56; // Integer | 转账金额（分）
    String bankAccount = "bankAccount_example"; // String | 收款账号
    String bankName = ""; // String | 收款银行
    try {
      Object result = apiInstance.fundTransferApiV1PaymentsTransferPost(amount, bankAccount, bankName);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling PaymentFundApi#fundTransferApiV1PaymentsTransferPost");
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
| **amount** | **Integer**| 转账金额（分） | |
| **bankAccount** | **String**| 收款账号 | |
| **bankName** | **String**| 收款银行 | [optional] [default to ] |

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

<a id="fundWechatPayApiV1PaymentsWechatPayPost"></a>
# **fundWechatPayApiV1PaymentsWechatPayPost**
> Object fundWechatPayApiV1PaymentsWechatPayPost(outTradeNo, totalFee)

基金微信支付

对应 Java: FundController.wechatPay — 调用微信支付 JSAPI 下单.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.PaymentFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    PaymentFundApi apiInstance = new PaymentFundApi(defaultClient);
    String outTradeNo = "outTradeNo_example"; // String | 订单号
    Integer totalFee = 56; // Integer | 金额（分）
    try {
      Object result = apiInstance.fundWechatPayApiV1PaymentsWechatPayPost(outTradeNo, totalFee);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling PaymentFundApi#fundWechatPayApiV1PaymentsWechatPayPost");
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
| **outTradeNo** | **String**| 订单号 | |
| **totalFee** | **Integer**| 金额（分） | |

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

<a id="fundWithdrawalApiV1PaymentsWithdrawalPost"></a>
# **fundWithdrawalApiV1PaymentsWithdrawalPost**
> Object fundWithdrawalApiV1PaymentsWithdrawalPost(amount)

基金提现

对应 Java: FundController.withdrawal — 申请提现（扣除 2% 手续费）.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.PaymentFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    PaymentFundApi apiInstance = new PaymentFundApi(defaultClient);
    Integer amount = 56; // Integer | 提现金额（分）
    try {
      Object result = apiInstance.fundWithdrawalApiV1PaymentsWithdrawalPost(amount);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling PaymentFundApi#fundWithdrawalApiV1PaymentsWithdrawalPost");
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

