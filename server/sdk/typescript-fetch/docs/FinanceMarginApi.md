# FinanceMarginApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**adminAdjustBalanceApiV1FinanceTargetUserUuidPut**](FinanceMarginApi.md#adminadjustbalanceapiv1financetargetuseruuidput) | **PUT** /api/v1/finance/{target_user_uuid} | 管理员直接调整用户 Token 余额 |
| [**checkBalanceApiV1FinanceCheckGet**](FinanceMarginApi.md#checkbalanceapiv1financecheckget) | **GET** /api/v1/finance/check | 检查余额是否充足 |
| [**deductApiV1FinanceDeductPost**](FinanceMarginApi.md#deductapiv1financedeductpost) | **POST** /api/v1/finance/deduct | 扣减用户 token（内部调用） |
| [**expireApiV1FinanceExpirePost**](FinanceMarginApi.md#expireapiv1financeexpirepost) | **POST** /api/v1/finance/expire | 过期清零（管理员/定时任务） |
| [**getBalanceApiV1FinanceBalanceGet**](FinanceMarginApi.md#getbalanceapiv1financebalanceget) | **GET** /api/v1/finance/balance | 查询用户 token 余额（Redis 缓存 5 分钟） |
| [**grantCommissionApiV1FinanceCommissionPost**](FinanceMarginApi.md#grantcommissionapiv1financecommissionpost) | **POST** /api/v1/finance/commission | 佣金入账（邀请分成） |
| [**listFlowsApiV1FinanceFlowsGet**](FinanceMarginApi.md#listflowsapiv1financeflowsget) | **GET** /api/v1/finance/flows | 用户 token 流水（支持按类型过滤） |
| [**listTokenFlowAdminApiV1FinanceFlowListGet**](FinanceMarginApi.md#listtokenflowadminapiv1financeflowlistget) | **GET** /api/v1/finance/flow/list | Token 操作流水列表（管理员） |
| [**rechargeApiV1FinanceRechargePost**](FinanceMarginApi.md#rechargeapiv1financerechargepost) | **POST** /api/v1/finance/recharge | 充值 token（与支付订单配合使用） |
| [**refundTokenApiV1FinanceRefundPost**](FinanceMarginApi.md#refundtokenapiv1financerefundpost) | **POST** /api/v1/finance/refund | Token 回退（退还指定数量 token 到用户余额） |



## adminAdjustBalanceApiV1FinanceTargetUserUuidPut

> any adminAdjustBalanceApiV1FinanceTargetUserUuidPut(targetUserUuid, quantity, reason)

管理员直接调整用户 Token 余额

P15-C2 改造: 改用 require_login + 内部 role 断言, 避免 FastAPI 0.116 + Python 3.13 对 Depends(require_role(\&quot;admin\&quot;)) 嵌套闭包的签名解析报错 (no signature for builtin str).

### Example

```ts
import {
  Configuration,
  FinanceMarginApi,
} from '';
import type { AdminAdjustBalanceApiV1FinanceTargetUserUuidPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceMarginApi(config);

  const body = {
    // string
    targetUserUuid: targetUserUuid_example,
    // number | 调整数量（正数增加/负数扣减）
    quantity: 56,
    // string | 操作原因 (optional)
    reason: reason_example,
  } satisfies AdminAdjustBalanceApiV1FinanceTargetUserUuidPutRequest;

  try {
    const data = await api.adminAdjustBalanceApiV1FinanceTargetUserUuidPut(body);
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
| **targetUserUuid** | `string` |  | [Defaults to `undefined`] |
| **quantity** | `number` | 调整数量（正数增加/负数扣减） | [Defaults to `undefined`] |
| **reason** | `string` | 操作原因 | [Optional] [Defaults to `&#39;管理员调整&#39;`] |

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


## checkBalanceApiV1FinanceCheckGet

> any checkBalanceApiV1FinanceCheckGet(minTokens)

检查余额是否充足

### Example

```ts
import {
  Configuration,
  FinanceMarginApi,
} from '';
import type { CheckBalanceApiV1FinanceCheckGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceMarginApi(config);

  const body = {
    // number | 所需 token 数
    minTokens: 56,
  } satisfies CheckBalanceApiV1FinanceCheckGetRequest;

  try {
    const data = await api.checkBalanceApiV1FinanceCheckGet(body);
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
| **minTokens** | `number` | 所需 token 数 | [Defaults to `undefined`] |

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


## deductApiV1FinanceDeductPost

> any deductApiV1FinanceDeductPost(quantity, remark)

扣减用户 token（内部调用）

### Example

```ts
import {
  Configuration,
  FinanceMarginApi,
} from '';
import type { DeductApiV1FinanceDeductPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceMarginApi(config);

  const body = {
    // number | 扣减数量
    quantity: 56,
    // string | 操作描述 (optional)
    remark: remark_example,
  } satisfies DeductApiV1FinanceDeductPostRequest;

  try {
    const data = await api.deductApiV1FinanceDeductPost(body);
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
| **quantity** | `number` | 扣减数量 | [Defaults to `undefined`] |
| **remark** | `string` | 操作描述 | [Optional] [Defaults to `&#39;&#39;`] |

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


## expireApiV1FinanceExpirePost

> any expireApiV1FinanceExpirePost(quantity, source)

过期清零（管理员/定时任务）

### Example

```ts
import {
  Configuration,
  FinanceMarginApi,
} from '';
import type { ExpireApiV1FinanceExpirePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceMarginApi(config);

  const body = {
    // number | 过期数量
    quantity: 56,
    // string (optional)
    source: source_example,
  } satisfies ExpireApiV1FinanceExpirePostRequest;

  try {
    const data = await api.expireApiV1FinanceExpirePost(body);
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
| **quantity** | `number` | 过期数量 | [Defaults to `undefined`] |
| **source** | `string` |  | [Optional] [Defaults to `&#39;到期清零&#39;`] |

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


## getBalanceApiV1FinanceBalanceGet

> any getBalanceApiV1FinanceBalanceGet()

查询用户 token 余额（Redis 缓存 5 分钟）

### Example

```ts
import {
  Configuration,
  FinanceMarginApi,
} from '';
import type { GetBalanceApiV1FinanceBalanceGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceMarginApi(config);

  try {
    const data = await api.getBalanceApiV1FinanceBalanceGet();
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


## grantCommissionApiV1FinanceCommissionPost

> any grantCommissionApiV1FinanceCommissionPost(quantity, invitedUserId, source)

佣金入账（邀请分成）

### Example

```ts
import {
  Configuration,
  FinanceMarginApi,
} from '';
import type { GrantCommissionApiV1FinanceCommissionPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceMarginApi(config);

  const body = {
    // number | 佣金数量
    quantity: 56,
    // string | 被邀请人 uuid (optional)
    invitedUserId: invitedUserId_example,
    // string | 来源 (optional)
    source: source_example,
  } satisfies GrantCommissionApiV1FinanceCommissionPostRequest;

  try {
    const data = await api.grantCommissionApiV1FinanceCommissionPost(body);
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
| **quantity** | `number` | 佣金数量 | [Defaults to `undefined`] |
| **invitedUserId** | `string` | 被邀请人 uuid | [Optional] [Defaults to `&#39;&#39;`] |
| **source** | `string` | 来源 | [Optional] [Defaults to `&#39;invite&#39;`] |

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


## listFlowsApiV1FinanceFlowsGet

> any listFlowsApiV1FinanceFlowsGet(page, limit, opType)

用户 token 流水（支持按类型过滤）

### Example

```ts
import {
  Configuration,
  FinanceMarginApi,
} from '';
import type { ListFlowsApiV1FinanceFlowsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceMarginApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number | 0=充值 1=扣减 2=过期 3=退款 4=佣金 (optional)
    opType: 56,
  } satisfies ListFlowsApiV1FinanceFlowsGetRequest;

  try {
    const data = await api.listFlowsApiV1FinanceFlowsGet(body);
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
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **opType** | `number` | 0&#x3D;充值 1&#x3D;扣减 2&#x3D;过期 3&#x3D;退款 4&#x3D;佣金 | [Optional] [Defaults to `undefined`] |

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


## listTokenFlowAdminApiV1FinanceFlowListGet

> any listTokenFlowAdminApiV1FinanceFlowListGet(page, limit, userId, opType)

Token 操作流水列表（管理员）

### Example

```ts
import {
  Configuration,
  FinanceMarginApi,
} from '';
import type { ListTokenFlowAdminApiV1FinanceFlowListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceMarginApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string | 按用户 UUID 过滤 (optional)
    userId: userId_example,
    // number | 操作类型过滤 (optional)
    opType: 56,
  } satisfies ListTokenFlowAdminApiV1FinanceFlowListGetRequest;

  try {
    const data = await api.listTokenFlowAdminApiV1FinanceFlowListGet(body);
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
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **userId** | `string` | 按用户 UUID 过滤 | [Optional] [Defaults to `undefined`] |
| **opType** | `number` | 操作类型过滤 | [Optional] [Defaults to `undefined`] |

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


## rechargeApiV1FinanceRechargePost

> any rechargeApiV1FinanceRechargePost(quantity, outTradeNo)

充值 token（与支付订单配合使用）

### Example

```ts
import {
  Configuration,
  FinanceMarginApi,
} from '';
import type { RechargeApiV1FinanceRechargePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceMarginApi(config);

  const body = {
    // number | 充值数量
    quantity: 56,
    // string | 支付订单号
    outTradeNo: outTradeNo_example,
  } satisfies RechargeApiV1FinanceRechargePostRequest;

  try {
    const data = await api.rechargeApiV1FinanceRechargePost(body);
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
| **quantity** | `number` | 充值数量 | [Defaults to `undefined`] |
| **outTradeNo** | `string` | 支付订单号 | [Defaults to `undefined`] |

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


## refundTokenApiV1FinanceRefundPost

> any refundTokenApiV1FinanceRefundPost(quantity, remark)

Token 回退（退还指定数量 token 到用户余额）

### Example

```ts
import {
  Configuration,
  FinanceMarginApi,
} from '';
import type { RefundTokenApiV1FinanceRefundPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceMarginApi(config);

  const body = {
    // number | 回退数量
    quantity: 56,
    // string | 操作说明 (optional)
    remark: remark_example,
  } satisfies RefundTokenApiV1FinanceRefundPostRequest;

  try {
    const data = await api.refundTokenApiV1FinanceRefundPost(body);
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
| **quantity** | `number` | 回退数量 | [Defaults to `undefined`] |
| **remark** | `string` | 操作说明 | [Optional] [Defaults to `&#39;&#39;`] |

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

