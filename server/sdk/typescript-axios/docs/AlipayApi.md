# AlipayApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**alipayQueryApiV1PaymentsAlipayQueryPost**](#alipayqueryapiv1paymentsalipayquerypost) | **POST** /api/v1/payments/alipay/query | Query Alipay order|
|[**alipayRefundApiV1PaymentsAlipayRefundPost**](#alipayrefundapiv1paymentsalipayrefundpost) | **POST** /api/v1/payments/alipay/refund | Alipay 退款（调用 alipay.trade.refund）|
|[**createAlipayApiV1PaymentsAlipayCreatePost**](#createalipayapiv1paymentsalipaycreatepost) | **POST** /api/v1/payments/alipay/create | Create Alipay PC / H5 page pay|
|[**createAlipayAppApiV1PaymentsAlipayAppCreatePost**](#createalipayappapiv1paymentsalipayappcreatepost) | **POST** /api/v1/payments/alipay/app/create | Create Alipay order for mobile app|

# **alipayQueryApiV1PaymentsAlipayQueryPost**
> any alipayQueryApiV1PaymentsAlipayQueryPost()


### Example

```typescript
import {
    AlipayApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AlipayApi(configuration);

let outTradeNo: string; // (default to undefined)

const { status, data } = await apiInstance.alipayQueryApiV1PaymentsAlipayQueryPost(
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

# **alipayRefundApiV1PaymentsAlipayRefundPost**
> any alipayRefundApiV1PaymentsAlipayRefundPost()


### Example

```typescript
import {
    AlipayApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AlipayApi(configuration);

let outTradeNo: string; // (default to undefined)
let refundAmount: number; //退款金额（元） (default to undefined)
let reason: string; // (optional) (default to '用户申请退款')

const { status, data } = await apiInstance.alipayRefundApiV1PaymentsAlipayRefundPost(
    outTradeNo,
    refundAmount,
    reason
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **outTradeNo** | [**string**] |  | defaults to undefined|
| **refundAmount** | [**number**] | 退款金额（元） | defaults to undefined|
| **reason** | [**string**] |  | (optional) defaults to '用户申请退款'|


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

# **createAlipayApiV1PaymentsAlipayCreatePost**
> any createAlipayApiV1PaymentsAlipayCreatePost()


### Example

```typescript
import {
    AlipayApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AlipayApi(configuration);

let amount: number; //金额（元） (default to undefined)
let productId: string; // (optional) (default to undefined)
let orderType: number; // (optional) (default to 0)
let subject: string; // (optional) (default to '订单支付')

const { status, data } = await apiInstance.createAlipayApiV1PaymentsAlipayCreatePost(
    amount,
    productId,
    orderType,
    subject
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **amount** | [**number**] | 金额（元） | defaults to undefined|
| **productId** | [**string**] |  | (optional) defaults to undefined|
| **orderType** | [**number**] |  | (optional) defaults to 0|
| **subject** | [**string**] |  | (optional) defaults to '订单支付'|


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

# **createAlipayAppApiV1PaymentsAlipayAppCreatePost**
> any createAlipayAppApiV1PaymentsAlipayAppCreatePost()


### Example

```typescript
import {
    AlipayApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AlipayApi(configuration);

let amount: number; // (default to undefined)
let productId: string; // (optional) (default to undefined)
let orderType: number; // (optional) (default to 0)
let subject: string; // (optional) (default to '订单支付')

const { status, data } = await apiInstance.createAlipayAppApiV1PaymentsAlipayAppCreatePost(
    amount,
    productId,
    orderType,
    subject
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **amount** | [**number**] |  | defaults to undefined|
| **productId** | [**string**] |  | (optional) defaults to undefined|
| **orderType** | [**number**] |  | (optional) defaults to 0|
| **subject** | [**string**] |  | (optional) defaults to '订单支付'|


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

