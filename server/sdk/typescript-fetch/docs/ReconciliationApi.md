# ReconciliationApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**alipayReconcileApiV1PaymentsAlipayGet**](ReconciliationApi.md#alipayreconcileapiv1paymentsalipayget) | **GET** /api/v1/payments/alipay | 拉取支付宝某天账单并对账 |
| [**allReconcileApiV1PaymentsAllGet**](ReconciliationApi.md#allreconcileapiv1paymentsallget) | **GET** /api/v1/payments/all | 拉取支付宝 + 微信双边对账 |
| [**autoReconcileApiV1PaymentsAutoPost**](ReconciliationApi.md#autoreconcileapiv1paymentsautopost) | **POST** /api/v1/payments/auto | 手动触发自动对账（昨天） |
| [**closeExpiredApiV1PaymentsCloseExpiredPost**](ReconciliationApi.md#closeexpiredapiv1paymentscloseexpiredpost) | **POST** /api/v1/payments/close_expired | 关闭 30 分钟未支付订单 |
| [**listPendingApiV1PaymentsPendingGet**](ReconciliationApi.md#listpendingapiv1paymentspendingget) | **GET** /api/v1/payments/pending | 查询超时未支付订单 |
| [**wechatReconcileApiV1PaymentsWechatGet**](ReconciliationApi.md#wechatreconcileapiv1paymentswechatget) | **GET** /api/v1/payments/wechat | 拉取微信某天账单并对账 |



## alipayReconcileApiV1PaymentsAlipayGet

> any alipayReconcileApiV1PaymentsAlipayGet(billDate)

拉取支付宝某天账单并对账

### Example

```ts
import {
  Configuration,
  ReconciliationApi,
} from '';
import type { AlipayReconcileApiV1PaymentsAlipayGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ReconciliationApi();

  const body = {
    // string | yyyy-MM-dd，默认昨天 (optional)
    billDate: billDate_example,
  } satisfies AlipayReconcileApiV1PaymentsAlipayGetRequest;

  try {
    const data = await api.alipayReconcileApiV1PaymentsAlipayGet(body);
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
| **billDate** | `string` | yyyy-MM-dd，默认昨天 | [Optional] [Defaults to `undefined`] |

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


## allReconcileApiV1PaymentsAllGet

> any allReconcileApiV1PaymentsAllGet(billDate)

拉取支付宝 + 微信双边对账

### Example

```ts
import {
  Configuration,
  ReconciliationApi,
} from '';
import type { AllReconcileApiV1PaymentsAllGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReconciliationApi(config);

  const body = {
    // string | yyyy-MM-dd，默认昨天 (optional)
    billDate: billDate_example,
  } satisfies AllReconcileApiV1PaymentsAllGetRequest;

  try {
    const data = await api.allReconcileApiV1PaymentsAllGet(body);
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
| **billDate** | `string` | yyyy-MM-dd，默认昨天 | [Optional] [Defaults to `undefined`] |

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


## autoReconcileApiV1PaymentsAutoPost

> any autoReconcileApiV1PaymentsAutoPost()

手动触发自动对账（昨天）

### Example

```ts
import {
  Configuration,
  ReconciliationApi,
} from '';
import type { AutoReconcileApiV1PaymentsAutoPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReconciliationApi(config);

  try {
    const data = await api.autoReconcileApiV1PaymentsAutoPost();
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


## closeExpiredApiV1PaymentsCloseExpiredPost

> any closeExpiredApiV1PaymentsCloseExpiredPost()

关闭 30 分钟未支付订单

### Example

```ts
import {
  Configuration,
  ReconciliationApi,
} from '';
import type { CloseExpiredApiV1PaymentsCloseExpiredPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReconciliationApi(config);

  try {
    const data = await api.closeExpiredApiV1PaymentsCloseExpiredPost();
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


## listPendingApiV1PaymentsPendingGet

> any listPendingApiV1PaymentsPendingGet()

查询超时未支付订单

### Example

```ts
import {
  Configuration,
  ReconciliationApi,
} from '';
import type { ListPendingApiV1PaymentsPendingGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReconciliationApi(config);

  try {
    const data = await api.listPendingApiV1PaymentsPendingGet();
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


## wechatReconcileApiV1PaymentsWechatGet

> any wechatReconcileApiV1PaymentsWechatGet(billDate)

拉取微信某天账单并对账

### Example

```ts
import {
  Configuration,
  ReconciliationApi,
} from '';
import type { WechatReconcileApiV1PaymentsWechatGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ReconciliationApi();

  const body = {
    // string | yyyy-MM-dd，默认昨天 (optional)
    billDate: billDate_example,
  } satisfies WechatReconcileApiV1PaymentsWechatGetRequest;

  try {
    const data = await api.wechatReconcileApiV1PaymentsWechatGet(body);
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
| **billDate** | `string` | yyyy-MM-dd，默认昨天 | [Optional] [Defaults to `undefined`] |

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

