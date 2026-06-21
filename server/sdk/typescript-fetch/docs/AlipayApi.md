# AlipayApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**alipayQueryApiV1PaymentsAlipayQueryPost**](AlipayApi.md#alipayqueryapiv1paymentsalipayquerypost) | **POST** /api/v1/payments/alipay/query | Query Alipay order |
| [**alipayRefundApiV1PaymentsAlipayRefundPost**](AlipayApi.md#alipayrefundapiv1paymentsalipayrefundpost) | **POST** /api/v1/payments/alipay/refund | Alipay 退款（调用 alipay.trade.refund） |
| [**createAlipayApiV1PaymentsAlipayCreatePost**](AlipayApi.md#createalipayapiv1paymentsalipaycreatepost) | **POST** /api/v1/payments/alipay/create | Create Alipay PC / H5 page pay |
| [**createAlipayAppApiV1PaymentsAlipayAppCreatePost**](AlipayApi.md#createalipayappapiv1paymentsalipayappcreatepost) | **POST** /api/v1/payments/alipay/app/create | Create Alipay order for mobile app |



## alipayQueryApiV1PaymentsAlipayQueryPost

> any alipayQueryApiV1PaymentsAlipayQueryPost(outTradeNo)

Query Alipay order

### Example

```ts
import {
  Configuration,
  AlipayApi,
} from '';
import type { AlipayQueryApiV1PaymentsAlipayQueryPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AlipayApi();

  const body = {
    // string
    outTradeNo: outTradeNo_example,
  } satisfies AlipayQueryApiV1PaymentsAlipayQueryPostRequest;

  try {
    const data = await api.alipayQueryApiV1PaymentsAlipayQueryPost(body);
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


## alipayRefundApiV1PaymentsAlipayRefundPost

> any alipayRefundApiV1PaymentsAlipayRefundPost(outTradeNo, refundAmount, reason)

Alipay 退款（调用 alipay.trade.refund）

### Example

```ts
import {
  Configuration,
  AlipayApi,
} from '';
import type { AlipayRefundApiV1PaymentsAlipayRefundPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AlipayApi();

  const body = {
    // string
    outTradeNo: outTradeNo_example,
    // number | 退款金额（元）
    refundAmount: 8.14,
    // string (optional)
    reason: reason_example,
  } satisfies AlipayRefundApiV1PaymentsAlipayRefundPostRequest;

  try {
    const data = await api.alipayRefundApiV1PaymentsAlipayRefundPost(body);
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
| **refundAmount** | `number` | 退款金额（元） | [Defaults to `undefined`] |
| **reason** | `string` |  | [Optional] [Defaults to `&#39;用户申请退款&#39;`] |

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


## createAlipayApiV1PaymentsAlipayCreatePost

> any createAlipayApiV1PaymentsAlipayCreatePost(amount, productId, orderType, subject)

Create Alipay PC / H5 page pay

### Example

```ts
import {
  Configuration,
  AlipayApi,
} from '';
import type { CreateAlipayApiV1PaymentsAlipayCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AlipayApi(config);

  const body = {
    // number | 金额（元）
    amount: 8.14,
    // string (optional)
    productId: productId_example,
    // number (optional)
    orderType: 56,
    // string (optional)
    subject: subject_example,
  } satisfies CreateAlipayApiV1PaymentsAlipayCreatePostRequest;

  try {
    const data = await api.createAlipayApiV1PaymentsAlipayCreatePost(body);
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
| **amount** | `number` | 金额（元） | [Defaults to `undefined`] |
| **productId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **orderType** | `number` |  | [Optional] [Defaults to `0`] |
| **subject** | `string` |  | [Optional] [Defaults to `&#39;订单支付&#39;`] |

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


## createAlipayAppApiV1PaymentsAlipayAppCreatePost

> any createAlipayAppApiV1PaymentsAlipayAppCreatePost(amount, productId, orderType, subject)

Create Alipay order for mobile app

### Example

```ts
import {
  Configuration,
  AlipayApi,
} from '';
import type { CreateAlipayAppApiV1PaymentsAlipayAppCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AlipayApi(config);

  const body = {
    // number
    amount: 8.14,
    // string (optional)
    productId: productId_example,
    // number (optional)
    orderType: 56,
    // string (optional)
    subject: subject_example,
  } satisfies CreateAlipayAppApiV1PaymentsAlipayAppCreatePostRequest;

  try {
    const data = await api.createAlipayAppApiV1PaymentsAlipayAppCreatePost(body);
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
| **subject** | `string` |  | [Optional] [Defaults to `&#39;订单支付&#39;`] |

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

