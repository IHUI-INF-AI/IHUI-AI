# ReconciliationApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**alipayReconcileApiV1PaymentsAlipayGet**](#alipayreconcileapiv1paymentsalipayget) | **GET** /api/v1/payments/alipay | 拉取支付宝某天账单并对账|
|[**allReconcileApiV1PaymentsAllGet**](#allreconcileapiv1paymentsallget) | **GET** /api/v1/payments/all | 拉取支付宝 + 微信双边对账|
|[**autoReconcileApiV1PaymentsAutoPost**](#autoreconcileapiv1paymentsautopost) | **POST** /api/v1/payments/auto | 手动触发自动对账（昨天）|
|[**closeExpiredApiV1PaymentsCloseExpiredPost**](#closeexpiredapiv1paymentscloseexpiredpost) | **POST** /api/v1/payments/close_expired | 关闭 30 分钟未支付订单|
|[**listPendingApiV1PaymentsPendingGet**](#listpendingapiv1paymentspendingget) | **GET** /api/v1/payments/pending | 查询超时未支付订单|
|[**wechatReconcileApiV1PaymentsWechatGet**](#wechatreconcileapiv1paymentswechatget) | **GET** /api/v1/payments/wechat | 拉取微信某天账单并对账|

# **alipayReconcileApiV1PaymentsAlipayGet**
> any alipayReconcileApiV1PaymentsAlipayGet()


### Example

```typescript
import {
    ReconciliationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ReconciliationApi(configuration);

let billDate: string; //yyyy-MM-dd，默认昨天 (optional) (default to undefined)

const { status, data } = await apiInstance.alipayReconcileApiV1PaymentsAlipayGet(
    billDate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **billDate** | [**string**] | yyyy-MM-dd，默认昨天 | (optional) defaults to undefined|


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

# **allReconcileApiV1PaymentsAllGet**
> any allReconcileApiV1PaymentsAllGet()


### Example

```typescript
import {
    ReconciliationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ReconciliationApi(configuration);

let billDate: string; //yyyy-MM-dd，默认昨天 (optional) (default to undefined)

const { status, data } = await apiInstance.allReconcileApiV1PaymentsAllGet(
    billDate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **billDate** | [**string**] | yyyy-MM-dd，默认昨天 | (optional) defaults to undefined|


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

# **autoReconcileApiV1PaymentsAutoPost**
> any autoReconcileApiV1PaymentsAutoPost()


### Example

```typescript
import {
    ReconciliationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ReconciliationApi(configuration);

const { status, data } = await apiInstance.autoReconcileApiV1PaymentsAutoPost();
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

# **closeExpiredApiV1PaymentsCloseExpiredPost**
> any closeExpiredApiV1PaymentsCloseExpiredPost()


### Example

```typescript
import {
    ReconciliationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ReconciliationApi(configuration);

const { status, data } = await apiInstance.closeExpiredApiV1PaymentsCloseExpiredPost();
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

# **listPendingApiV1PaymentsPendingGet**
> any listPendingApiV1PaymentsPendingGet()


### Example

```typescript
import {
    ReconciliationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ReconciliationApi(configuration);

const { status, data } = await apiInstance.listPendingApiV1PaymentsPendingGet();
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

# **wechatReconcileApiV1PaymentsWechatGet**
> any wechatReconcileApiV1PaymentsWechatGet()


### Example

```typescript
import {
    ReconciliationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ReconciliationApi(configuration);

let billDate: string; //yyyy-MM-dd，默认昨天 (optional) (default to undefined)

const { status, data } = await apiInstance.wechatReconcileApiV1PaymentsWechatGet(
    billDate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **billDate** | [**string**] | yyyy-MM-dd，默认昨天 | (optional) defaults to undefined|


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

