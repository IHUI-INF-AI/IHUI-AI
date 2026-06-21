# WeChatPayApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**checkStatusApiV1PaymentsWechatStatusOutTradeNoGet**](#checkstatusapiv1paymentswechatstatusouttradenoget) | **GET** /api/v1/payments/wechat/status/{out_trade_no} | Check payment status|
|[**consecutiveProductApiV1PaymentsWechatConsecutiveProductGet**](#consecutiveproductapiv1paymentswechatconsecutiveproductget) | **GET** /api/v1/payments/wechat/consecutive/product | Query consecutive subscription products|
|[**createWxPayAndroidApiV1PaymentsWechatAndroidCreatePost**](#createwxpayandroidapiv1paymentswechatandroidcreatepost) | **POST** /api/v1/payments/wechat/android/create | Create WeChat Pay order (Android app)|
|[**createWxPayApiV1PaymentsWechatCreatePost**](#createwxpayapiv1paymentswechatcreatepost) | **POST** /api/v1/payments/wechat/create | Create WeChat Pay order (JSAPI / mini program)|
|[**createWxPayCourseApiV1PaymentsWechatCourseCreatePost**](#createwxpaycourseapiv1paymentswechatcoursecreatepost) | **POST** /api/v1/payments/wechat/course/create | Create WeChat Pay order (course)|
|[**queryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost**](#querybytradenoapiv1paymentswechatquerybytradenopost) | **POST** /api/v1/payments/wechat/query/by-trade-no | Query by merchant trade number|
|[**wxPayCloseApiV1PaymentsWechatClosePost**](#wxpaycloseapiv1paymentswechatclosepost) | **POST** /api/v1/payments/wechat/close | Close WeChat Pay order|
|[**wxPayNotifyApiV1PaymentsWechatNotifyPost**](#wxpaynotifyapiv1paymentswechatnotifypost) | **POST** /api/v1/payments/wechat/notify | WeChat Pay V3 async callback|
|[**wxPayQueryApiV1PaymentsWechatQueryPost**](#wxpayqueryapiv1paymentswechatquerypost) | **POST** /api/v1/payments/wechat/query | Query WeChat Pay order|
|[**wxPayRefundApiV1PaymentsWechatRefundPost**](#wxpayrefundapiv1paymentswechatrefundpost) | **POST** /api/v1/payments/wechat/refund | Refund WeChat Pay order|
|[**wxRefundNotifyApiV1PaymentsWechatNotifyRefundPost**](#wxrefundnotifyapiv1paymentswechatnotifyrefundpost) | **POST** /api/v1/payments/wechat/notify/refund | WeChat Pay refund callback|
|[**wxTransferNotifyApiV1PaymentsWechatNotifyTransferPost**](#wxtransfernotifyapiv1paymentswechatnotifytransferpost) | **POST** /api/v1/payments/wechat/notify/transfer | WeChat Pay transfer callback|

# **checkStatusApiV1PaymentsWechatStatusOutTradeNoGet**
> any checkStatusApiV1PaymentsWechatStatusOutTradeNoGet()


### Example

```typescript
import {
    WeChatPayApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatPayApi(configuration);

let outTradeNo: string; // (default to undefined)

const { status, data } = await apiInstance.checkStatusApiV1PaymentsWechatStatusOutTradeNoGet(
    outTradeNo
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **outTradeNo** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **consecutiveProductApiV1PaymentsWechatConsecutiveProductGet**
> any consecutiveProductApiV1PaymentsWechatConsecutiveProductGet()

Query consecutive subscription (monthly/annual) product list.

### Example

```typescript
import {
    WeChatPayApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatPayApi(configuration);

const { status, data } = await apiInstance.consecutiveProductApiV1PaymentsWechatConsecutiveProductGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createWxPayAndroidApiV1PaymentsWechatAndroidCreatePost**
> any createWxPayAndroidApiV1PaymentsWechatAndroidCreatePost()

Matches Java PayManagementController.wxPay + PayAndroidServiceImpl.pay.  Android uses APP payment API (not JSAPI), uses separate APP_ID, and notify URL is wx.app.notify (WX_ANDROID_NOTIFY_URL).

### Example

```typescript
import {
    WeChatPayApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatPayApi(configuration);

let amount: number; // (default to undefined)
let productId: string; // (optional) (default to undefined)
let orderType: number; // (optional) (default to 0)
let description: string; // (optional) (default to 'Purchase')

const { status, data } = await apiInstance.createWxPayAndroidApiV1PaymentsWechatAndroidCreatePost(
    amount,
    productId,
    orderType,
    description
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **amount** | [**number**] |  | defaults to undefined|
| **productId** | [**string**] |  | (optional) defaults to undefined|
| **orderType** | [**number**] |  | (optional) defaults to 0|
| **description** | [**string**] |  | (optional) defaults to 'Purchase'|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createWxPayApiV1PaymentsWechatCreatePost**
> any createWxPayApiV1PaymentsWechatCreatePost()

Matches Java WXPayNowController.initiatePay + WXPayNowServiceImpl.pay.

### Example

```typescript
import {
    WeChatPayApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatPayApi(configuration);

let amount: number; //Amount in fen (default to undefined)
let openId: string; //WeChat openid (default to undefined)
let productId: string; // (optional) (default to undefined)
let orderType: number; //0=token,1=activity,2=identity,3=agent (optional) (default to 0)
let description: string; // (optional) (default to 'Purchase')

const { status, data } = await apiInstance.createWxPayApiV1PaymentsWechatCreatePost(
    amount,
    openId,
    productId,
    orderType,
    description
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **amount** | [**number**] | Amount in fen | defaults to undefined|
| **openId** | [**string**] | WeChat openid | defaults to undefined|
| **productId** | [**string**] |  | (optional) defaults to undefined|
| **orderType** | [**number**] | 0&#x3D;token,1&#x3D;activity,2&#x3D;identity,3&#x3D;agent | (optional) defaults to 0|
| **description** | [**string**] |  | (optional) defaults to 'Purchase'|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createWxPayCourseApiV1PaymentsWechatCourseCreatePost**
> any createWxPayCourseApiV1PaymentsWechatCourseCreatePost()

Create a course payment order.

### Example

```typescript
import {
    WeChatPayApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatPayApi(configuration);

let amount: number; // (default to undefined)
let courseId: string; // (default to undefined)

const { status, data } = await apiInstance.createWxPayCourseApiV1PaymentsWechatCourseCreatePost(
    amount,
    courseId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **amount** | [**number**] |  | defaults to undefined|
| **courseId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **queryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost**
> any queryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost()

Query local order and WeChat payment status.

### Example

```typescript
import {
    WeChatPayApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatPayApi(configuration);

let outTradeNo: string; // (default to undefined)

const { status, data } = await apiInstance.queryByTradeNoApiV1PaymentsWechatQueryByTradeNoPost(
    outTradeNo
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **outTradeNo** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **wxPayCloseApiV1PaymentsWechatClosePost**
> any wxPayCloseApiV1PaymentsWechatClosePost()

Matches Java WXPayNowServiceImpl.closeOrder -- updates status to 4 (closed).

### Example

```typescript
import {
    WeChatPayApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatPayApi(configuration);

let outTradeNo: string; // (default to undefined)

const { status, data } = await apiInstance.wxPayCloseApiV1PaymentsWechatClosePost(
    outTradeNo
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **outTradeNo** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **wxPayNotifyApiV1PaymentsWechatNotifyPost**
> any wxPayNotifyApiV1PaymentsWechatNotifyPost()

WeChat Pay V3 callback with idempotency protection.  This endpoint handles payment success notifications from WeChat Pay V3. Implements idempotency to prevent duplicate order status updates when WeChat retries the callback.

### Example

```typescript
import {
    WeChatPayApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatPayApi(configuration);

let wechatpaySerial: string; // (optional) (default to undefined)
let wechatpaySignature: string; // (optional) (default to undefined)
let wechatpayTimestamp: string; // (optional) (default to undefined)
let wechatpayNonce: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.wxPayNotifyApiV1PaymentsWechatNotifyPost(
    wechatpaySerial,
    wechatpaySignature,
    wechatpayTimestamp,
    wechatpayNonce
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **wechatpaySerial** | [**string**] |  | (optional) defaults to undefined|
| **wechatpaySignature** | [**string**] |  | (optional) defaults to undefined|
| **wechatpayTimestamp** | [**string**] |  | (optional) defaults to undefined|
| **wechatpayNonce** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **wxPayQueryApiV1PaymentsWechatQueryPost**
> any wxPayQueryApiV1PaymentsWechatQueryPost()


### Example

```typescript
import {
    WeChatPayApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatPayApi(configuration);

let outTradeNo: string; // (default to undefined)

const { status, data } = await apiInstance.wxPayQueryApiV1PaymentsWechatQueryPost(
    outTradeNo
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **outTradeNo** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **wxPayRefundApiV1PaymentsWechatRefundPost**
> any wxPayRefundApiV1PaymentsWechatRefundPost()

Matches Java WXPayNowServiceImpl.refunds.  Note: Java refund code has a bug -- it calls setOutTradeNo(outRefundNo) overwriting the original out_trade_no. Python uses out_refund_no correctly.

### Example

```typescript
import {
    WeChatPayApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatPayApi(configuration);

let outTradeNo: string; // (default to undefined)
let refundAmount: number; //Refund amount in fen (default to undefined)
let reason: string; // (optional) (default to 'User requested refund')

const { status, data } = await apiInstance.wxPayRefundApiV1PaymentsWechatRefundPost(
    outTradeNo,
    refundAmount,
    reason
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **outTradeNo** | [**string**] |  | defaults to undefined|
| **refundAmount** | [**number**] | Refund amount in fen | defaults to undefined|
| **reason** | [**string**] |  | (optional) defaults to 'User requested refund'|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **wxRefundNotifyApiV1PaymentsWechatNotifyRefundPost**
> any wxRefundNotifyApiV1PaymentsWechatNotifyRefundPost()

WeChat Pay refund callback with idempotency protection.

### Example

```typescript
import {
    WeChatPayApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatPayApi(configuration);

let wechatpaySerial: string; // (optional) (default to undefined)
let wechatpaySignature: string; // (optional) (default to undefined)
let wechatpayTimestamp: string; // (optional) (default to undefined)
let wechatpayNonce: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.wxRefundNotifyApiV1PaymentsWechatNotifyRefundPost(
    wechatpaySerial,
    wechatpaySignature,
    wechatpayTimestamp,
    wechatpayNonce
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **wechatpaySerial** | [**string**] |  | (optional) defaults to undefined|
| **wechatpaySignature** | [**string**] |  | (optional) defaults to undefined|
| **wechatpayTimestamp** | [**string**] |  | (optional) defaults to undefined|
| **wechatpayNonce** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **wxTransferNotifyApiV1PaymentsWechatNotifyTransferPost**
> any wxTransferNotifyApiV1PaymentsWechatNotifyTransferPost()

WeChat Pay transfer (withdrawal) callback with idempotency.

### Example

```typescript
import {
    WeChatPayApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatPayApi(configuration);

let wechatpaySerial: string; // (optional) (default to undefined)
let wechatpaySignature: string; // (optional) (default to undefined)
let wechatpayTimestamp: string; // (optional) (default to undefined)
let wechatpayNonce: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.wxTransferNotifyApiV1PaymentsWechatNotifyTransferPost(
    wechatpaySerial,
    wechatpaySignature,
    wechatpayTimestamp,
    wechatpayNonce
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **wechatpaySerial** | [**string**] |  | (optional) defaults to undefined|
| **wechatpaySignature** | [**string**] |  | (optional) defaults to undefined|
| **wechatpayTimestamp** | [**string**] |  | (optional) defaults to undefined|
| **wechatpayNonce** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

