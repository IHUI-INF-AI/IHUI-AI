# WeChatPayApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**checkStatusApiV1PaymentsWechatStatusOutTradeNoGet**](WeChatPayApi.md#checkStatusApiV1PaymentsWechatStatusOutTradeNoGet) | **GET** /api/v1/payments/wechat/status/{out_trade_no} | Check payment status |
| [**consecutiveProductApiV1PaymentsWechatConsecutiveProductGet**](WeChatPayApi.md#consecutiveProductApiV1PaymentsWechatConsecutiveProductGet) | **GET** /api/v1/payments/wechat/consecutive/product | Query consecutive subscription products |
| [**createWxPayAndroidApiV1PaymentsWechatAndroidCreatePost**](WeChatPayApi.md#createWxPayAndroidApiV1PaymentsWechatAndroidCreatePost) | **POST** /api/v1/payments/wechat/android/create | Create WeChat Pay order (Android app) |
| [**createWxPayApiV1PaymentsWechatCreatePost**](WeChatPayApi.md#createWxPayApiV1PaymentsWechatCreatePost) | **POST** /api/v1/payments/wechat/create | Create WeChat Pay order (JSAPI / mini program) |
| [**createWxPayCourseApiV1PaymentsWechatCourseCreatePost**](WeChatPayApi.md#createWxPayCourseApiV1PaymentsWechatCourseCreatePost) | **POST** /api/v1/payments/wechat/course/create | Create WeChat Pay order (course) |
| [**queryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost**](WeChatPayApi.md#queryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost) | **POST** /api/v1/payments/wechat/query/by-trade-no | Query by merchant trade number |
| [**wxPayCloseApiV1PaymentsWechatClosePost**](WeChatPayApi.md#wxPayCloseApiV1PaymentsWechatClosePost) | **POST** /api/v1/payments/wechat/close | Close WeChat Pay order |
| [**wxPayNotifyApiV1PaymentsWechatNotifyPost**](WeChatPayApi.md#wxPayNotifyApiV1PaymentsWechatNotifyPost) | **POST** /api/v1/payments/wechat/notify | WeChat Pay V3 async callback |
| [**wxPayQueryApiV1PaymentsWechatQueryPost**](WeChatPayApi.md#wxPayQueryApiV1PaymentsWechatQueryPost) | **POST** /api/v1/payments/wechat/query | Query WeChat Pay order |
| [**wxPayRefundApiV1PaymentsWechatRefundPost**](WeChatPayApi.md#wxPayRefundApiV1PaymentsWechatRefundPost) | **POST** /api/v1/payments/wechat/refund | Refund WeChat Pay order |
| [**wxRefundNotifyApiV1PaymentsWechatNotifyRefundPost**](WeChatPayApi.md#wxRefundNotifyApiV1PaymentsWechatNotifyRefundPost) | **POST** /api/v1/payments/wechat/notify/refund | WeChat Pay refund callback |
| [**wxTransferNotifyApiV1PaymentsWechatNotifyTransferPost**](WeChatPayApi.md#wxTransferNotifyApiV1PaymentsWechatNotifyTransferPost) | **POST** /api/v1/payments/wechat/notify/transfer | WeChat Pay transfer callback |


<a id="checkStatusApiV1PaymentsWechatStatusOutTradeNoGet"></a>
# **checkStatusApiV1PaymentsWechatStatusOutTradeNoGet**
> Object checkStatusApiV1PaymentsWechatStatusOutTradeNoGet(outTradeNo)

Check payment status

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatPayApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    WeChatPayApi apiInstance = new WeChatPayApi(defaultClient);
    String outTradeNo = "outTradeNo_example"; // String | 
    try {
      Object result = apiInstance.checkStatusApiV1PaymentsWechatStatusOutTradeNoGet(outTradeNo);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatPayApi#checkStatusApiV1PaymentsWechatStatusOutTradeNoGet");
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

<a id="consecutiveProductApiV1PaymentsWechatConsecutiveProductGet"></a>
# **consecutiveProductApiV1PaymentsWechatConsecutiveProductGet**
> Object consecutiveProductApiV1PaymentsWechatConsecutiveProductGet()

Query consecutive subscription products

Query consecutive subscription (monthly/annual) product list.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatPayApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WeChatPayApi apiInstance = new WeChatPayApi(defaultClient);
    try {
      Object result = apiInstance.consecutiveProductApiV1PaymentsWechatConsecutiveProductGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatPayApi#consecutiveProductApiV1PaymentsWechatConsecutiveProductGet");
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

<a id="createWxPayAndroidApiV1PaymentsWechatAndroidCreatePost"></a>
# **createWxPayAndroidApiV1PaymentsWechatAndroidCreatePost**
> Object createWxPayAndroidApiV1PaymentsWechatAndroidCreatePost(amount, productId, orderType, description)

Create WeChat Pay order (Android app)

Matches Java PayManagementController.wxPay + PayAndroidServiceImpl.pay.  Android uses APP payment API (not JSAPI), uses separate APP_ID, and notify URL is wx.app.notify (WX_ANDROID_NOTIFY_URL).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatPayApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WeChatPayApi apiInstance = new WeChatPayApi(defaultClient);
    Integer amount = 56; // Integer | 
    String productId = "productId_example"; // String | 
    Integer orderType = 0; // Integer | 
    String description = "Purchase"; // String | 
    try {
      Object result = apiInstance.createWxPayAndroidApiV1PaymentsWechatAndroidCreatePost(amount, productId, orderType, description);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatPayApi#createWxPayAndroidApiV1PaymentsWechatAndroidCreatePost");
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
| **amount** | **Integer**|  | |
| **productId** | **String**|  | [optional] |
| **orderType** | **Integer**|  | [optional] [default to 0] |
| **description** | **String**|  | [optional] [default to Purchase] |

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

<a id="createWxPayApiV1PaymentsWechatCreatePost"></a>
# **createWxPayApiV1PaymentsWechatCreatePost**
> Object createWxPayApiV1PaymentsWechatCreatePost(amount, openId, productId, orderType, description)

Create WeChat Pay order (JSAPI / mini program)

Matches Java WXPayNowController.initiatePay + WXPayNowServiceImpl.pay.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatPayApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WeChatPayApi apiInstance = new WeChatPayApi(defaultClient);
    Integer amount = 56; // Integer | Amount in fen
    String openId = "openId_example"; // String | WeChat openid
    String productId = "productId_example"; // String | 
    Integer orderType = 0; // Integer | 0=token,1=activity,2=identity,3=agent
    String description = "Purchase"; // String | 
    try {
      Object result = apiInstance.createWxPayApiV1PaymentsWechatCreatePost(amount, openId, productId, orderType, description);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatPayApi#createWxPayApiV1PaymentsWechatCreatePost");
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
| **amount** | **Integer**| Amount in fen | |
| **openId** | **String**| WeChat openid | |
| **productId** | **String**|  | [optional] |
| **orderType** | **Integer**| 0&#x3D;token,1&#x3D;activity,2&#x3D;identity,3&#x3D;agent | [optional] [default to 0] |
| **description** | **String**|  | [optional] [default to Purchase] |

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

<a id="createWxPayCourseApiV1PaymentsWechatCourseCreatePost"></a>
# **createWxPayCourseApiV1PaymentsWechatCourseCreatePost**
> Object createWxPayCourseApiV1PaymentsWechatCourseCreatePost(amount, courseId)

Create WeChat Pay order (course)

Create a course payment order.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatPayApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WeChatPayApi apiInstance = new WeChatPayApi(defaultClient);
    Integer amount = 56; // Integer | 
    String courseId = "courseId_example"; // String | 
    try {
      Object result = apiInstance.createWxPayCourseApiV1PaymentsWechatCourseCreatePost(amount, courseId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatPayApi#createWxPayCourseApiV1PaymentsWechatCourseCreatePost");
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
| **amount** | **Integer**|  | |
| **courseId** | **String**|  | |

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

<a id="queryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost"></a>
# **queryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost**
> Object queryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost(outTradeNo)

Query by merchant trade number

Query local order and WeChat payment status.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatPayApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    WeChatPayApi apiInstance = new WeChatPayApi(defaultClient);
    String outTradeNo = "outTradeNo_example"; // String | 
    try {
      Object result = apiInstance.queryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost(outTradeNo);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatPayApi#queryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost");
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

<a id="wxPayCloseApiV1PaymentsWechatClosePost"></a>
# **wxPayCloseApiV1PaymentsWechatClosePost**
> Object wxPayCloseApiV1PaymentsWechatClosePost(outTradeNo)

Close WeChat Pay order

Matches Java WXPayNowServiceImpl.closeOrder -- updates status to 4 (closed).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatPayApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    WeChatPayApi apiInstance = new WeChatPayApi(defaultClient);
    String outTradeNo = "outTradeNo_example"; // String | 
    try {
      Object result = apiInstance.wxPayCloseApiV1PaymentsWechatClosePost(outTradeNo);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatPayApi#wxPayCloseApiV1PaymentsWechatClosePost");
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

<a id="wxPayNotifyApiV1PaymentsWechatNotifyPost"></a>
# **wxPayNotifyApiV1PaymentsWechatNotifyPost**
> Object wxPayNotifyApiV1PaymentsWechatNotifyPost(wechatpaySerial, wechatpaySignature, wechatpayTimestamp, wechatpayNonce)

WeChat Pay V3 async callback

WeChat Pay V3 callback with idempotency protection.  This endpoint handles payment success notifications from WeChat Pay V3. Implements idempotency to prevent duplicate order status updates when WeChat retries the callback.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatPayApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    WeChatPayApi apiInstance = new WeChatPayApi(defaultClient);
    String wechatpaySerial = "wechatpaySerial_example"; // String | 
    String wechatpaySignature = "wechatpaySignature_example"; // String | 
    String wechatpayTimestamp = "wechatpayTimestamp_example"; // String | 
    String wechatpayNonce = "wechatpayNonce_example"; // String | 
    try {
      Object result = apiInstance.wxPayNotifyApiV1PaymentsWechatNotifyPost(wechatpaySerial, wechatpaySignature, wechatpayTimestamp, wechatpayNonce);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatPayApi#wxPayNotifyApiV1PaymentsWechatNotifyPost");
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
| **wechatpaySerial** | **String**|  | [optional] |
| **wechatpaySignature** | **String**|  | [optional] |
| **wechatpayTimestamp** | **String**|  | [optional] |
| **wechatpayNonce** | **String**|  | [optional] |

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

<a id="wxPayQueryApiV1PaymentsWechatQueryPost"></a>
# **wxPayQueryApiV1PaymentsWechatQueryPost**
> Object wxPayQueryApiV1PaymentsWechatQueryPost(outTradeNo)

Query WeChat Pay order

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatPayApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    WeChatPayApi apiInstance = new WeChatPayApi(defaultClient);
    String outTradeNo = "outTradeNo_example"; // String | 
    try {
      Object result = apiInstance.wxPayQueryApiV1PaymentsWechatQueryPost(outTradeNo);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatPayApi#wxPayQueryApiV1PaymentsWechatQueryPost");
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

<a id="wxPayRefundApiV1PaymentsWechatRefundPost"></a>
# **wxPayRefundApiV1PaymentsWechatRefundPost**
> Object wxPayRefundApiV1PaymentsWechatRefundPost(outTradeNo, refundAmount, reason)

Refund WeChat Pay order

Matches Java WXPayNowServiceImpl.refunds.  Note: Java refund code has a bug -- it calls setOutTradeNo(outRefundNo) overwriting the original out_trade_no. Python uses out_refund_no correctly.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatPayApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    WeChatPayApi apiInstance = new WeChatPayApi(defaultClient);
    String outTradeNo = "outTradeNo_example"; // String | 
    Integer refundAmount = 56; // Integer | Refund amount in fen
    String reason = "User requested refund"; // String | 
    try {
      Object result = apiInstance.wxPayRefundApiV1PaymentsWechatRefundPost(outTradeNo, refundAmount, reason);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatPayApi#wxPayRefundApiV1PaymentsWechatRefundPost");
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
| **refundAmount** | **Integer**| Refund amount in fen | |
| **reason** | **String**|  | [optional] [default to User requested refund] |

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

<a id="wxRefundNotifyApiV1PaymentsWechatNotifyRefundPost"></a>
# **wxRefundNotifyApiV1PaymentsWechatNotifyRefundPost**
> Object wxRefundNotifyApiV1PaymentsWechatNotifyRefundPost(wechatpaySerial, wechatpaySignature, wechatpayTimestamp, wechatpayNonce)

WeChat Pay refund callback

WeChat Pay refund callback with idempotency protection.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatPayApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    WeChatPayApi apiInstance = new WeChatPayApi(defaultClient);
    String wechatpaySerial = "wechatpaySerial_example"; // String | 
    String wechatpaySignature = "wechatpaySignature_example"; // String | 
    String wechatpayTimestamp = "wechatpayTimestamp_example"; // String | 
    String wechatpayNonce = "wechatpayNonce_example"; // String | 
    try {
      Object result = apiInstance.wxRefundNotifyApiV1PaymentsWechatNotifyRefundPost(wechatpaySerial, wechatpaySignature, wechatpayTimestamp, wechatpayNonce);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatPayApi#wxRefundNotifyApiV1PaymentsWechatNotifyRefundPost");
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
| **wechatpaySerial** | **String**|  | [optional] |
| **wechatpaySignature** | **String**|  | [optional] |
| **wechatpayTimestamp** | **String**|  | [optional] |
| **wechatpayNonce** | **String**|  | [optional] |

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

<a id="wxTransferNotifyApiV1PaymentsWechatNotifyTransferPost"></a>
# **wxTransferNotifyApiV1PaymentsWechatNotifyTransferPost**
> Object wxTransferNotifyApiV1PaymentsWechatNotifyTransferPost(wechatpaySerial, wechatpaySignature, wechatpayTimestamp, wechatpayNonce)

WeChat Pay transfer callback

WeChat Pay transfer (withdrawal) callback with idempotency.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatPayApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    WeChatPayApi apiInstance = new WeChatPayApi(defaultClient);
    String wechatpaySerial = "wechatpaySerial_example"; // String | 
    String wechatpaySignature = "wechatpaySignature_example"; // String | 
    String wechatpayTimestamp = "wechatpayTimestamp_example"; // String | 
    String wechatpayNonce = "wechatpayNonce_example"; // String | 
    try {
      Object result = apiInstance.wxTransferNotifyApiV1PaymentsWechatNotifyTransferPost(wechatpaySerial, wechatpaySignature, wechatpayTimestamp, wechatpayNonce);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatPayApi#wxTransferNotifyApiV1PaymentsWechatNotifyTransferPost");
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
| **wechatpaySerial** | **String**|  | [optional] |
| **wechatpaySignature** | **String**|  | [optional] |
| **wechatpayTimestamp** | **String**|  | [optional] |
| **wechatpayNonce** | **String**|  | [optional] |

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

