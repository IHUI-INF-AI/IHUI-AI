# PaymentFundApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createFundOrderApiV1PaymentsCreateOrderPost**](PaymentFundApi.md#createfundorderapiv1paymentscreateorderpost) | **POST** /api/v1/payments/createOrder | 创建基金充值订单 |
| [**fundTransferApiV1PaymentsTransferPost**](PaymentFundApi.md#fundtransferapiv1paymentstransferpost) | **POST** /api/v1/payments/transfer | 银行转账 |
| [**fundWechatPayApiV1PaymentsWechatPayPost**](PaymentFundApi.md#fundwechatpayapiv1paymentswechatpaypost) | **POST** /api/v1/payments/wechatPay | 基金微信支付 |
| [**fundWithdrawalApiV1PaymentsWithdrawalPost**](PaymentFundApi.md#fundwithdrawalapiv1paymentswithdrawalpost) | **POST** /api/v1/payments/withdrawal | 基金提现 |



## createFundOrderApiV1PaymentsCreateOrderPost

> any createFundOrderApiV1PaymentsCreateOrderPost(amount, productId, orderType)

创建基金充值订单

对应 Java: FundController.createOrder — 创建充值订单并返回支付参数.

### Example

```ts
import {
  Configuration,
  PaymentFundApi,
} from '';
import type { CreateFundOrderApiV1PaymentsCreateOrderPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PaymentFundApi(config);

  const body = {
    // number | 充值金额（元）
    amount: 8.14,
    // string (optional)
    productId: productId_example,
    // number (optional)
    orderType: 56,
  } satisfies CreateFundOrderApiV1PaymentsCreateOrderPostRequest;

  try {
    const data = await api.createFundOrderApiV1PaymentsCreateOrderPost(body);
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
| **amount** | `number` | 充值金额（元） | [Defaults to `undefined`] |
| **productId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **orderType** | `number` |  | [Optional] [Defaults to `0`] |

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


## fundTransferApiV1PaymentsTransferPost

> any fundTransferApiV1PaymentsTransferPost(amount, bankAccount, bankName)

银行转账

对应 Java: FundController.transfer — 银行转账（审核后执行）.

### Example

```ts
import {
  Configuration,
  PaymentFundApi,
} from '';
import type { FundTransferApiV1PaymentsTransferPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PaymentFundApi(config);

  const body = {
    // number | 转账金额（分）
    amount: 56,
    // string | 收款账号
    bankAccount: bankAccount_example,
    // string | 收款银行 (optional)
    bankName: bankName_example,
  } satisfies FundTransferApiV1PaymentsTransferPostRequest;

  try {
    const data = await api.fundTransferApiV1PaymentsTransferPost(body);
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
| **amount** | `number` | 转账金额（分） | [Defaults to `undefined`] |
| **bankAccount** | `string` | 收款账号 | [Defaults to `undefined`] |
| **bankName** | `string` | 收款银行 | [Optional] [Defaults to `&#39;&#39;`] |

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


## fundWechatPayApiV1PaymentsWechatPayPost

> any fundWechatPayApiV1PaymentsWechatPayPost(outTradeNo, totalFee)

基金微信支付

对应 Java: FundController.wechatPay — 调用微信支付 JSAPI 下单.

### Example

```ts
import {
  Configuration,
  PaymentFundApi,
} from '';
import type { FundWechatPayApiV1PaymentsWechatPayPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PaymentFundApi(config);

  const body = {
    // string | 订单号
    outTradeNo: outTradeNo_example,
    // number | 金额（分）
    totalFee: 56,
  } satisfies FundWechatPayApiV1PaymentsWechatPayPostRequest;

  try {
    const data = await api.fundWechatPayApiV1PaymentsWechatPayPost(body);
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
| **outTradeNo** | `string` | 订单号 | [Defaults to `undefined`] |
| **totalFee** | `number` | 金额（分） | [Defaults to `undefined`] |

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


## fundWithdrawalApiV1PaymentsWithdrawalPost

> any fundWithdrawalApiV1PaymentsWithdrawalPost(amount)

基金提现

对应 Java: FundController.withdrawal — 申请提现（扣除 2% 手续费）.

### Example

```ts
import {
  Configuration,
  PaymentFundApi,
} from '';
import type { FundWithdrawalApiV1PaymentsWithdrawalPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PaymentFundApi(config);

  const body = {
    // number | 提现金额（分）
    amount: 56,
  } satisfies FundWithdrawalApiV1PaymentsWithdrawalPostRequest;

  try {
    const data = await api.fundWithdrawalApiV1PaymentsWithdrawalPost(body);
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
| **amount** | `number` | 提现金额（分） | [Defaults to `undefined`] |

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

