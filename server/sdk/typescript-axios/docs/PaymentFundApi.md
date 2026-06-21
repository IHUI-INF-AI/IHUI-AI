# PaymentFundApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createFundOrderApiV1PaymentsCreateOrderPost**](#createfundorderapiv1paymentscreateorderpost) | **POST** /api/v1/payments/createOrder | 创建基金充值订单|
|[**fundTransferApiV1PaymentsTransferPost**](#fundtransferapiv1paymentstransferpost) | **POST** /api/v1/payments/transfer | 银行转账|
|[**fundWechatPayApiV1PaymentsWechatPayPost**](#fundwechatpayapiv1paymentswechatpaypost) | **POST** /api/v1/payments/wechatPay | 基金微信支付|
|[**fundWithdrawalApiV1PaymentsWithdrawalPost**](#fundwithdrawalapiv1paymentswithdrawalpost) | **POST** /api/v1/payments/withdrawal | 基金提现|

# **createFundOrderApiV1PaymentsCreateOrderPost**
> any createFundOrderApiV1PaymentsCreateOrderPost()

对应 Java: FundController.createOrder — 创建充值订单并返回支付参数.

### Example

```typescript
import {
    PaymentFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PaymentFundApi(configuration);

let amount: number; //充值金额（元） (default to undefined)
let productId: string; // (optional) (default to undefined)
let orderType: number; // (optional) (default to 0)

const { status, data } = await apiInstance.createFundOrderApiV1PaymentsCreateOrderPost(
    amount,
    productId,
    orderType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **amount** | [**number**] | 充值金额（元） | defaults to undefined|
| **productId** | [**string**] |  | (optional) defaults to undefined|
| **orderType** | [**number**] |  | (optional) defaults to 0|


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

# **fundTransferApiV1PaymentsTransferPost**
> any fundTransferApiV1PaymentsTransferPost()

对应 Java: FundController.transfer — 银行转账（审核后执行）.

### Example

```typescript
import {
    PaymentFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PaymentFundApi(configuration);

let amount: number; //转账金额（分） (default to undefined)
let bankAccount: string; //收款账号 (default to undefined)
let bankName: string; //收款银行 (optional) (default to '')

const { status, data } = await apiInstance.fundTransferApiV1PaymentsTransferPost(
    amount,
    bankAccount,
    bankName
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **amount** | [**number**] | 转账金额（分） | defaults to undefined|
| **bankAccount** | [**string**] | 收款账号 | defaults to undefined|
| **bankName** | [**string**] | 收款银行 | (optional) defaults to ''|


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

# **fundWechatPayApiV1PaymentsWechatPayPost**
> any fundWechatPayApiV1PaymentsWechatPayPost()

对应 Java: FundController.wechatPay — 调用微信支付 JSAPI 下单.

### Example

```typescript
import {
    PaymentFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PaymentFundApi(configuration);

let outTradeNo: string; //订单号 (default to undefined)
let totalFee: number; //金额（分） (default to undefined)

const { status, data } = await apiInstance.fundWechatPayApiV1PaymentsWechatPayPost(
    outTradeNo,
    totalFee
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **outTradeNo** | [**string**] | 订单号 | defaults to undefined|
| **totalFee** | [**number**] | 金额（分） | defaults to undefined|


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

# **fundWithdrawalApiV1PaymentsWithdrawalPost**
> any fundWithdrawalApiV1PaymentsWithdrawalPost()

对应 Java: FundController.withdrawal — 申请提现（扣除 2% 手续费）.

### Example

```typescript
import {
    PaymentFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PaymentFundApi(configuration);

let amount: number; //提现金额（分） (default to undefined)

const { status, data } = await apiInstance.fundWithdrawalApiV1PaymentsWithdrawalPost(
    amount
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **amount** | [**number**] | 提现金额（分） | defaults to undefined|


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

