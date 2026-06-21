# FinanceMarginApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminAdjustBalanceApiV1FinanceTargetUserUuidPut**](#adminadjustbalanceapiv1financetargetuseruuidput) | **PUT** /api/v1/finance/{target_user_uuid} | 管理员直接调整用户 Token 余额|
|[**checkBalanceApiV1FinanceCheckGet**](#checkbalanceapiv1financecheckget) | **GET** /api/v1/finance/check | 检查余额是否充足|
|[**deductApiV1FinanceDeductPost**](#deductapiv1financedeductpost) | **POST** /api/v1/finance/deduct | 扣减用户 token（内部调用）|
|[**expireApiV1FinanceExpirePost**](#expireapiv1financeexpirepost) | **POST** /api/v1/finance/expire | 过期清零（管理员/定时任务）|
|[**getBalanceApiV1FinanceBalanceGet**](#getbalanceapiv1financebalanceget) | **GET** /api/v1/finance/balance | 查询用户 token 余额（Redis 缓存 5 分钟）|
|[**grantCommissionApiV1FinanceCommissionPost**](#grantcommissionapiv1financecommissionpost) | **POST** /api/v1/finance/commission | 佣金入账（邀请分成）|
|[**listFlowsApiV1FinanceFlowsGet**](#listflowsapiv1financeflowsget) | **GET** /api/v1/finance/flows | 用户 token 流水（支持按类型过滤）|
|[**listTokenFlowAdminApiV1FinanceFlowListGet**](#listtokenflowadminapiv1financeflowlistget) | **GET** /api/v1/finance/flow/list | Token 操作流水列表（管理员）|
|[**rechargeApiV1FinanceRechargePost**](#rechargeapiv1financerechargepost) | **POST** /api/v1/finance/recharge | 充值 token（与支付订单配合使用）|
|[**refundTokenApiV1FinanceRefundPost**](#refundtokenapiv1financerefundpost) | **POST** /api/v1/finance/refund | Token 回退（退还指定数量 token 到用户余额）|

# **adminAdjustBalanceApiV1FinanceTargetUserUuidPut**
> any adminAdjustBalanceApiV1FinanceTargetUserUuidPut()

P15-C2 改造: 改用 require_login + 内部 role 断言, 避免 FastAPI 0.116 + Python 3.13 对 Depends(require_role(\"admin\")) 嵌套闭包的签名解析报错 (no signature for builtin str).

### Example

```typescript
import {
    FinanceMarginApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceMarginApi(configuration);

let targetUserUuid: string; // (default to undefined)
let quantity: number; //调整数量（正数增加/负数扣减） (default to undefined)
let reason: string; //操作原因 (optional) (default to '管理员调整')

const { status, data } = await apiInstance.adminAdjustBalanceApiV1FinanceTargetUserUuidPut(
    targetUserUuid,
    quantity,
    reason
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetUserUuid** | [**string**] |  | defaults to undefined|
| **quantity** | [**number**] | 调整数量（正数增加/负数扣减） | defaults to undefined|
| **reason** | [**string**] | 操作原因 | (optional) defaults to '管理员调整'|


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

# **checkBalanceApiV1FinanceCheckGet**
> any checkBalanceApiV1FinanceCheckGet()


### Example

```typescript
import {
    FinanceMarginApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceMarginApi(configuration);

let minTokens: number; //所需 token 数 (default to undefined)

const { status, data } = await apiInstance.checkBalanceApiV1FinanceCheckGet(
    minTokens
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **minTokens** | [**number**] | 所需 token 数 | defaults to undefined|


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

# **deductApiV1FinanceDeductPost**
> any deductApiV1FinanceDeductPost()


### Example

```typescript
import {
    FinanceMarginApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceMarginApi(configuration);

let quantity: number; //扣减数量 (default to undefined)
let remark: string; //操作描述 (optional) (default to '')

const { status, data } = await apiInstance.deductApiV1FinanceDeductPost(
    quantity,
    remark
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **quantity** | [**number**] | 扣减数量 | defaults to undefined|
| **remark** | [**string**] | 操作描述 | (optional) defaults to ''|


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

# **expireApiV1FinanceExpirePost**
> any expireApiV1FinanceExpirePost()


### Example

```typescript
import {
    FinanceMarginApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceMarginApi(configuration);

let quantity: number; //过期数量 (default to undefined)
let source: string; // (optional) (default to '到期清零')

const { status, data } = await apiInstance.expireApiV1FinanceExpirePost(
    quantity,
    source
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **quantity** | [**number**] | 过期数量 | defaults to undefined|
| **source** | [**string**] |  | (optional) defaults to '到期清零'|


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

# **getBalanceApiV1FinanceBalanceGet**
> any getBalanceApiV1FinanceBalanceGet()


### Example

```typescript
import {
    FinanceMarginApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceMarginApi(configuration);

const { status, data } = await apiInstance.getBalanceApiV1FinanceBalanceGet();
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

# **grantCommissionApiV1FinanceCommissionPost**
> any grantCommissionApiV1FinanceCommissionPost()


### Example

```typescript
import {
    FinanceMarginApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceMarginApi(configuration);

let quantity: number; //佣金数量 (default to undefined)
let invitedUserId: string; //被邀请人 uuid (optional) (default to '')
let source: string; //来源 (optional) (default to 'invite')

const { status, data } = await apiInstance.grantCommissionApiV1FinanceCommissionPost(
    quantity,
    invitedUserId,
    source
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **quantity** | [**number**] | 佣金数量 | defaults to undefined|
| **invitedUserId** | [**string**] | 被邀请人 uuid | (optional) defaults to ''|
| **source** | [**string**] | 来源 | (optional) defaults to 'invite'|


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

# **listFlowsApiV1FinanceFlowsGet**
> any listFlowsApiV1FinanceFlowsGet()


### Example

```typescript
import {
    FinanceMarginApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceMarginApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let opType: number; //0=充值 1=扣减 2=过期 3=退款 4=佣金 (optional) (default to undefined)

const { status, data } = await apiInstance.listFlowsApiV1FinanceFlowsGet(
    page,
    limit,
    opType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **opType** | [**number**] | 0&#x3D;充值 1&#x3D;扣减 2&#x3D;过期 3&#x3D;退款 4&#x3D;佣金 | (optional) defaults to undefined|


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

# **listTokenFlowAdminApiV1FinanceFlowListGet**
> any listTokenFlowAdminApiV1FinanceFlowListGet()


### Example

```typescript
import {
    FinanceMarginApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceMarginApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let userId: string; //按用户 UUID 过滤 (optional) (default to undefined)
let opType: number; //操作类型过滤 (optional) (default to undefined)

const { status, data } = await apiInstance.listTokenFlowAdminApiV1FinanceFlowListGet(
    page,
    limit,
    userId,
    opType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **userId** | [**string**] | 按用户 UUID 过滤 | (optional) defaults to undefined|
| **opType** | [**number**] | 操作类型过滤 | (optional) defaults to undefined|


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

# **rechargeApiV1FinanceRechargePost**
> any rechargeApiV1FinanceRechargePost()


### Example

```typescript
import {
    FinanceMarginApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceMarginApi(configuration);

let quantity: number; //充值数量 (default to undefined)
let outTradeNo: string; //支付订单号 (default to undefined)

const { status, data } = await apiInstance.rechargeApiV1FinanceRechargePost(
    quantity,
    outTradeNo
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **quantity** | [**number**] | 充值数量 | defaults to undefined|
| **outTradeNo** | [**string**] | 支付订单号 | defaults to undefined|


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

# **refundTokenApiV1FinanceRefundPost**
> any refundTokenApiV1FinanceRefundPost()


### Example

```typescript
import {
    FinanceMarginApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceMarginApi(configuration);

let quantity: number; //回退数量 (default to undefined)
let remark: string; //操作说明 (optional) (default to '')

const { status, data } = await apiInstance.refundTokenApiV1FinanceRefundPost(
    quantity,
    remark
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **quantity** | [**number**] | 回退数量 | defaults to undefined|
| **remark** | [**string**] | 操作说明 | (optional) defaults to ''|


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

