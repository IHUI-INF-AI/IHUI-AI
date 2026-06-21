# WeChatPayApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**checkStatusApiV1PaymentsWechatStatusOutTradeNoGet**](WeChatPayApi.md#checkstatusapiv1paymentswechatstatusouttradenoget) | **GET** /api/v1/payments/wechat/status/{out_trade_no} | Check payment status |
| [**consecutiveProductApiV1PaymentsWechatConsecutiveProductGet**](WeChatPayApi.md#consecutiveproductapiv1paymentswechatconsecutiveproductget) | **GET** /api/v1/payments/wechat/consecutive/product | Query consecutive subscription products |
| [**createWxPayAndroidApiV1PaymentsWechatAndroidCreatePost**](WeChatPayApi.md#createwxpayandroidapiv1paymentswechatandroidcreatepost) | **POST** /api/v1/payments/wechat/android/create | Create WeChat Pay order (Android app) |
| [**createWxPayApiV1PaymentsWechatCreatePost**](WeChatPayApi.md#createwxpayapiv1paymentswechatcreatepost) | **POST** /api/v1/payments/wechat/create | Create WeChat Pay order (JSAPI / mini program) |
| [**createWxPayCourseApiV1PaymentsWechatCourseCreatePost**](WeChatPayApi.md#createwxpaycourseapiv1paymentswechatcoursecreatepost) | **POST** /api/v1/payments/wechat/course/create | Create WeChat Pay order (course) |
| [**queryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost**](WeChatPayApi.md#querybytradenoapiv1paymentswechatquerybytradenopost) | **POST** /api/v1/payments/wechat/query/by-trade-no | Query by merchant trade number |
| [**wxPayCloseApiV1PaymentsWechatClosePost**](WeChatPayApi.md#wxpaycloseapiv1paymentswechatclosepost) | **POST** /api/v1/payments/wechat/close | Close WeChat Pay order |
| [**wxPayNotifyApiV1PaymentsWechatNotifyPost**](WeChatPayApi.md#wxpaynotifyapiv1paymentswechatnotifypost) | **POST** /api/v1/payments/wechat/notify | WeChat Pay V3 async callback |
| [**wxPayQueryApiV1PaymentsWechatQueryPost**](WeChatPayApi.md#wxpayqueryapiv1paymentswechatquerypost) | **POST** /api/v1/payments/wechat/query | Query WeChat Pay order |
| [**wxPayRefundApiV1PaymentsWechatRefundPost**](WeChatPayApi.md#wxpayrefundapiv1paymentswechatrefundpost) | **POST** /api/v1/payments/wechat/refund | Refund WeChat Pay order |
| [**wxRefundNotifyApiV1PaymentsWechatNotifyRefundPost**](WeChatPayApi.md#wxrefundnotifyapiv1paymentswechatnotifyrefundpost) | **POST** /api/v1/payments/wechat/notify/refund | WeChat Pay refund callback |
| [**wxTransferNotifyApiV1PaymentsWechatNotifyTransferPost**](WeChatPayApi.md#wxtransfernotifyapiv1paymentswechatnotifytransferpost) | **POST** /api/v1/payments/wechat/notify/transfer | WeChat Pay transfer callback |



## checkStatusApiV1PaymentsWechatStatusOutTradeNoGet

> any checkStatusApiV1PaymentsWechatStatusOutTradeNoGet(outTradeNo)

Check payment status

### Example

```ts
import {
  Configuration,
  WeChatPayApi,
} from '';
import type { CheckStatusApiV1PaymentsWechatStatusOutTradeNoGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WeChatPayApi();

  const body = {
    // string
    outTradeNo: outTradeNo_example,
  } satisfies CheckStatusApiV1PaymentsWechatStatusOutTradeNoGetRequest;

  try {
    const data = await api.checkStatusApiV1PaymentsWechatStatusOutTradeNoGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **outTradeNo** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## consecutiveProductApiV1PaymentsWechatConsecutiveProductGet

> any consecutiveProductApiV1PaymentsWechatConsecutiveProductGet()

Query consecutive subscription products

Query consecutive subscription (monthly/annual) product list.

### Example

```ts
import {
  Configuration,
  WeChatPayApi,
} from '';
import type { ConsecutiveProductApiV1PaymentsWechatConsecutiveProductGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WeChatPayApi(config);

  try {
    const data = await api.consecutiveProductApiV1PaymentsWechatConsecutiveProductGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createWxPayAndroidApiV1PaymentsWechatAndroidCreatePost

> any createWxPayAndroidApiV1PaymentsWechatAndroidCreatePost(amount, productId, orderType, description)

Create WeChat Pay order (Android app)

Matches Java PayManagementController.wxPay + PayAndroidServiceImpl.pay.  Android uses APP payment API (not JSAPI), uses separate APP_ID, and notify URL is wx.app.notify (WX_ANDROID_NOTIFY_URL).

### Example

```ts
import {
  Configuration,
  WeChatPayApi,
} from '';
import type { CreateWxPayAndroidApiV1PaymentsWechatAndroidCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WeChatPayApi(config);

  const body = {
    // number
    amount: 56,
    // string (optional)
    productId: productId_example,
    // number (optional)
    orderType: 56,
    // string (optional)
    description: description_example,
  } satisfies CreateWxPayAndroidApiV1PaymentsWechatAndroidCreatePostRequest;

  try {
    const data = await api.createWxPayAndroidApiV1PaymentsWechatAndroidCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **amount** | `number` |  | [Defaults to `undefined`] |
| **productId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **orderType** | `number` |  | [Optional] [Defaults to `0`] |
| **description** | `string` |  | [Optional] [Defaults to `&#39;Purchase&#39;`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createWxPayApiV1PaymentsWechatCreatePost

> any createWxPayApiV1PaymentsWechatCreatePost(amount, openId, productId, orderType, description)

Create WeChat Pay order (JSAPI / mini program)

Matches Java WXPayNowController.initiatePay + WXPayNowServiceImpl.pay.

### Example

```ts
import {
  Configuration,
  WeChatPayApi,
} from '';
import type { CreateWxPayApiV1PaymentsWechatCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WeChatPayApi(config);

  const body = {
    // number | Amount in fen
    amount: 56,
    // string | WeChat openid
    openId: openId_example,
    // string (optional)
    productId: productId_example,
    // number | 0=token,1=activity,2=identity,3=agent (optional)
    orderType: 56,
    // string (optional)
    description: description_example,
  } satisfies CreateWxPayApiV1PaymentsWechatCreatePostRequest;

  try {
    const data = await api.createWxPayApiV1PaymentsWechatCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **amount** | `number` | Amount in fen | [Defaults to `undefined`] |
| **openId** | `string` | WeChat openid | [Defaults to `undefined`] |
| **productId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **orderType** | `number` | 0&#x3D;token,1&#x3D;activity,2&#x3D;identity,3&#x3D;agent | [Optional] [Defaults to `0`] |
| **description** | `string` |  | [Optional] [Defaults to `&#39;Purchase&#39;`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createWxPayCourseApiV1PaymentsWechatCourseCreatePost

> any createWxPayCourseApiV1PaymentsWechatCourseCreatePost(amount, courseId)

Create WeChat Pay order (course)

Create a course payment order.

### Example

```ts
import {
  Configuration,
  WeChatPayApi,
} from '';
import type { CreateWxPayCourseApiV1PaymentsWechatCourseCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WeChatPayApi(config);

  const body = {
    // number
    amount: 56,
    // string
    courseId: courseId_example,
  } satisfies CreateWxPayCourseApiV1PaymentsWechatCourseCreatePostRequest;

  try {
    const data = await api.createWxPayCourseApiV1PaymentsWechatCourseCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **amount** | `number` |  | [Defaults to `undefined`] |
| **courseId** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## queryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost

> any queryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost(outTradeNo)

Query by merchant trade number

Query local order and WeChat payment status.

### Example

```ts
import {
  Configuration,
  WeChatPayApi,
} from '';
import type { QueryByTradeNoApiV1PaymentsWechatQueryByTradeNoPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WeChatPayApi();

  const body = {
    // string
    outTradeNo: outTradeNo_example,
  } satisfies QueryByTradeNoApiV1PaymentsWechatQueryByTradeNoPostRequest;

  try {
    const data = await api.queryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **outTradeNo** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## wxPayCloseApiV1PaymentsWechatClosePost

> any wxPayCloseApiV1PaymentsWechatClosePost(outTradeNo)

Close WeChat Pay order

Matches Java WXPayNowServiceImpl.closeOrder -- updates status to 4 (closed).

### Example

```ts
import {
  Configuration,
  WeChatPayApi,
} from '';
import type { WxPayCloseApiV1PaymentsWechatClosePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WeChatPayApi();

  const body = {
    // string
    outTradeNo: outTradeNo_example,
  } satisfies WxPayCloseApiV1PaymentsWechatClosePostRequest;

  try {
    const data = await api.wxPayCloseApiV1PaymentsWechatClosePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **outTradeNo** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## wxPayNotifyApiV1PaymentsWechatNotifyPost

> any wxPayNotifyApiV1PaymentsWechatNotifyPost(wechatpaySerial, wechatpaySignature, wechatpayTimestamp, wechatpayNonce)

WeChat Pay V3 async callback

WeChat Pay V3 callback with idempotency protection.  This endpoint handles payment success notifications from WeChat Pay V3. Implements idempotency to prevent duplicate order status updates when WeChat retries the callback.

### Example

```ts
import {
  Configuration,
  WeChatPayApi,
} from '';
import type { WxPayNotifyApiV1PaymentsWechatNotifyPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WeChatPayApi();

  const body = {
    // string (optional)
    wechatpaySerial: wechatpaySerial_example,
    // string (optional)
    wechatpaySignature: wechatpaySignature_example,
    // string (optional)
    wechatpayTimestamp: wechatpayTimestamp_example,
    // string (optional)
    wechatpayNonce: wechatpayNonce_example,
  } satisfies WxPayNotifyApiV1PaymentsWechatNotifyPostRequest;

  try {
    const data = await api.wxPayNotifyApiV1PaymentsWechatNotifyPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **wechatpaySerial** | `string` |  | [Optional] [Defaults to `undefined`] |
| **wechatpaySignature** | `string` |  | [Optional] [Defaults to `undefined`] |
| **wechatpayTimestamp** | `string` |  | [Optional] [Defaults to `undefined`] |
| **wechatpayNonce** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## wxPayQueryApiV1PaymentsWechatQueryPost

> any wxPayQueryApiV1PaymentsWechatQueryPost(outTradeNo)

Query WeChat Pay order

### Example

```ts
import {
  Configuration,
  WeChatPayApi,
} from '';
import type { WxPayQueryApiV1PaymentsWechatQueryPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WeChatPayApi();

  const body = {
    // string
    outTradeNo: outTradeNo_example,
  } satisfies WxPayQueryApiV1PaymentsWechatQueryPostRequest;

  try {
    const data = await api.wxPayQueryApiV1PaymentsWechatQueryPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **outTradeNo** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## wxPayRefundApiV1PaymentsWechatRefundPost

> any wxPayRefundApiV1PaymentsWechatRefundPost(outTradeNo, refundAmount, reason)

Refund WeChat Pay order

Matches Java WXPayNowServiceImpl.refunds.  Note: Java refund code has a bug -- it calls setOutTradeNo(outRefundNo) overwriting the original out_trade_no. Python uses out_refund_no correctly.

### Example

```ts
import {
  Configuration,
  WeChatPayApi,
} from '';
import type { WxPayRefundApiV1PaymentsWechatRefundPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WeChatPayApi();

  const body = {
    // string
    outTradeNo: outTradeNo_example,
    // number | Refund amount in fen
    refundAmount: 56,
    // string (optional)
    reason: reason_example,
  } satisfies WxPayRefundApiV1PaymentsWechatRefundPostRequest;

  try {
    const data = await api.wxPayRefundApiV1PaymentsWechatRefundPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **outTradeNo** | `string` |  | [Defaults to `undefined`] |
| **refundAmount** | `number` | Refund amount in fen | [Defaults to `undefined`] |
| **reason** | `string` |  | [Optional] [Defaults to `&#39;User requested refund&#39;`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## wxRefundNotifyApiV1PaymentsWechatNotifyRefundPost

> any wxRefundNotifyApiV1PaymentsWechatNotifyRefundPost(wechatpaySerial, wechatpaySignature, wechatpayTimestamp, wechatpayNonce)

WeChat Pay refund callback

WeChat Pay refund callback with idempotency protection.

### Example

```ts
import {
  Configuration,
  WeChatPayApi,
} from '';
import type { WxRefundNotifyApiV1PaymentsWechatNotifyRefundPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WeChatPayApi();

  const body = {
    // string (optional)
    wechatpaySerial: wechatpaySerial_example,
    // string (optional)
    wechatpaySignature: wechatpaySignature_example,
    // string (optional)
    wechatpayTimestamp: wechatpayTimestamp_example,
    // string (optional)
    wechatpayNonce: wechatpayNonce_example,
  } satisfies WxRefundNotifyApiV1PaymentsWechatNotifyRefundPostRequest;

  try {
    const data = await api.wxRefundNotifyApiV1PaymentsWechatNotifyRefundPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **wechatpaySerial** | `string` |  | [Optional] [Defaults to `undefined`] |
| **wechatpaySignature** | `string` |  | [Optional] [Defaults to `undefined`] |
| **wechatpayTimestamp** | `string` |  | [Optional] [Defaults to `undefined`] |
| **wechatpayNonce** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## wxTransferNotifyApiV1PaymentsWechatNotifyTransferPost

> any wxTransferNotifyApiV1PaymentsWechatNotifyTransferPost(wechatpaySerial, wechatpaySignature, wechatpayTimestamp, wechatpayNonce)

WeChat Pay transfer callback

WeChat Pay transfer (withdrawal) callback with idempotency.

### Example

```ts
import {
  Configuration,
  WeChatPayApi,
} from '';
import type { WxTransferNotifyApiV1PaymentsWechatNotifyTransferPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WeChatPayApi();

  const body = {
    // string (optional)
    wechatpaySerial: wechatpaySerial_example,
    // string (optional)
    wechatpaySignature: wechatpaySignature_example,
    // string (optional)
    wechatpayTimestamp: wechatpayTimestamp_example,
    // string (optional)
    wechatpayNonce: wechatpayNonce_example,
  } satisfies WxTransferNotifyApiV1PaymentsWechatNotifyTransferPostRequest;

  try {
    const data = await api.wxTransferNotifyApiV1PaymentsWechatNotifyTransferPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **wechatpaySerial** | `string` |  | [Optional] [Defaults to `undefined`] |
| **wechatpaySignature** | `string` |  | [Optional] [Defaults to `undefined`] |
| **wechatpayTimestamp** | `string` |  | [Optional] [Defaults to `undefined`] |
| **wechatpayNonce** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

