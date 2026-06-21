# FinanceWithdrawalApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**applyAgentWithdrawalApiV1FinanceAgentApplyPost**](FinanceWithdrawalApi.md#applyagentwithdrawalapiv1financeagentapplypost) | **POST** /api/v1/finance/agent/apply | Agent 收益提现申请 |
| [**applyWithdrawalApiV1FinanceApplyPost**](FinanceWithdrawalApi.md#applywithdrawalapiv1financeapplypost) | **POST** /api/v1/finance/apply | 申请提现 |
| [**availableBalanceApiV1FinanceAvailableGet**](FinanceWithdrawalApi.md#availablebalanceapiv1financeavailableget) | **GET** /api/v1/finance/available | 个人可收款查询 |
| [**listAgentWithdrawalsApiV1FinanceAgentListGet**](FinanceWithdrawalApi.md#listagentwithdrawalsapiv1financeagentlistget) | **GET** /api/v1/finance/agent/list | Agent 提现记录 |
| [**listWithdrawalsApiV1FinanceListGet**](FinanceWithdrawalApi.md#listwithdrawalsapiv1financelistget) | **GET** /api/v1/finance/list | 我的提现记录 |
| [**withdrawalSummaryApiV1FinanceSummaryGet**](FinanceWithdrawalApi.md#withdrawalsummaryapiv1financesummaryget) | **GET** /api/v1/finance/summary | 提现详情面板数据（总提现/待审核/已到账） |



## applyAgentWithdrawalApiV1FinanceAgentApplyPost

> any applyAgentWithdrawalApiV1FinanceAgentApplyPost(amount)

Agent 收益提现申请

### Example

```ts
import {
  Configuration,
  FinanceWithdrawalApi,
} from '';
import type { ApplyAgentWithdrawalApiV1FinanceAgentApplyPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceWithdrawalApi(config);

  const body = {
    // number | 提现金额（分）
    amount: 56,
  } satisfies ApplyAgentWithdrawalApiV1FinanceAgentApplyPostRequest;

  try {
    const data = await api.applyAgentWithdrawalApiV1FinanceAgentApplyPost(body);
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


## applyWithdrawalApiV1FinanceApplyPost

> any applyWithdrawalApiV1FinanceApplyPost(amount)

申请提现

### Example

```ts
import {
  Configuration,
  FinanceWithdrawalApi,
} from '';
import type { ApplyWithdrawalApiV1FinanceApplyPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceWithdrawalApi(config);

  const body = {
    // number | 提现金额（分）
    amount: 56,
  } satisfies ApplyWithdrawalApiV1FinanceApplyPostRequest;

  try {
    const data = await api.applyWithdrawalApiV1FinanceApplyPost(body);
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


## availableBalanceApiV1FinanceAvailableGet

> any availableBalanceApiV1FinanceAvailableGet()

个人可收款查询

### Example

```ts
import {
  Configuration,
  FinanceWithdrawalApi,
} from '';
import type { AvailableBalanceApiV1FinanceAvailableGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceWithdrawalApi(config);

  try {
    const data = await api.availableBalanceApiV1FinanceAvailableGet();
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


## listAgentWithdrawalsApiV1FinanceAgentListGet

> any listAgentWithdrawalsApiV1FinanceAgentListGet(page, limit)

Agent 提现记录

### Example

```ts
import {
  Configuration,
  FinanceWithdrawalApi,
} from '';
import type { ListAgentWithdrawalsApiV1FinanceAgentListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceWithdrawalApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListAgentWithdrawalsApiV1FinanceAgentListGetRequest;

  try {
    const data = await api.listAgentWithdrawalsApiV1FinanceAgentListGet(body);
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


## listWithdrawalsApiV1FinanceListGet

> any listWithdrawalsApiV1FinanceListGet(page, limit)

我的提现记录

### Example

```ts
import {
  Configuration,
  FinanceWithdrawalApi,
} from '';
import type { ListWithdrawalsApiV1FinanceListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceWithdrawalApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListWithdrawalsApiV1FinanceListGetRequest;

  try {
    const data = await api.listWithdrawalsApiV1FinanceListGet(body);
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


## withdrawalSummaryApiV1FinanceSummaryGet

> any withdrawalSummaryApiV1FinanceSummaryGet()

提现详情面板数据（总提现/待审核/已到账）

### Example

```ts
import {
  Configuration,
  FinanceWithdrawalApi,
} from '';
import type { WithdrawalSummaryApiV1FinanceSummaryGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceWithdrawalApi(config);

  try {
    const data = await api.withdrawalSummaryApiV1FinanceSummaryGet();
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

