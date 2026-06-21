# FinanceWithdrawalApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**applyAgentWithdrawalApiV1FinanceAgentApplyPost**](#applyagentwithdrawalapiv1financeagentapplypost) | **POST** /api/v1/finance/agent/apply | Agent 收益提现申请|
|[**applyWithdrawalApiV1FinanceApplyPost**](#applywithdrawalapiv1financeapplypost) | **POST** /api/v1/finance/apply | 申请提现|
|[**availableBalanceApiV1FinanceAvailableGet**](#availablebalanceapiv1financeavailableget) | **GET** /api/v1/finance/available | 个人可收款查询|
|[**listAgentWithdrawalsApiV1FinanceAgentListGet**](#listagentwithdrawalsapiv1financeagentlistget) | **GET** /api/v1/finance/agent/list | Agent 提现记录|
|[**listWithdrawalsApiV1FinanceListGet**](#listwithdrawalsapiv1financelistget) | **GET** /api/v1/finance/list | 我的提现记录|
|[**withdrawalSummaryApiV1FinanceSummaryGet**](#withdrawalsummaryapiv1financesummaryget) | **GET** /api/v1/finance/summary | 提现详情面板数据（总提现/待审核/已到账）|

# **applyAgentWithdrawalApiV1FinanceAgentApplyPost**
> any applyAgentWithdrawalApiV1FinanceAgentApplyPost()


### Example

```typescript
import {
    FinanceWithdrawalApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceWithdrawalApi(configuration);

let amount: number; //提现金额（分） (default to undefined)

const { status, data } = await apiInstance.applyAgentWithdrawalApiV1FinanceAgentApplyPost(
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

# **applyWithdrawalApiV1FinanceApplyPost**
> any applyWithdrawalApiV1FinanceApplyPost()


### Example

```typescript
import {
    FinanceWithdrawalApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceWithdrawalApi(configuration);

let amount: number; //提现金额（分） (default to undefined)

const { status, data } = await apiInstance.applyWithdrawalApiV1FinanceApplyPost(
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

# **availableBalanceApiV1FinanceAvailableGet**
> any availableBalanceApiV1FinanceAvailableGet()


### Example

```typescript
import {
    FinanceWithdrawalApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceWithdrawalApi(configuration);

const { status, data } = await apiInstance.availableBalanceApiV1FinanceAvailableGet();
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

# **listAgentWithdrawalsApiV1FinanceAgentListGet**
> any listAgentWithdrawalsApiV1FinanceAgentListGet()


### Example

```typescript
import {
    FinanceWithdrawalApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceWithdrawalApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listAgentWithdrawalsApiV1FinanceAgentListGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

# **listWithdrawalsApiV1FinanceListGet**
> any listWithdrawalsApiV1FinanceListGet()


### Example

```typescript
import {
    FinanceWithdrawalApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceWithdrawalApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listWithdrawalsApiV1FinanceListGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

# **withdrawalSummaryApiV1FinanceSummaryGet**
> any withdrawalSummaryApiV1FinanceSummaryGet()


### Example

```typescript
import {
    FinanceWithdrawalApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceWithdrawalApi(configuration);

const { status, data } = await apiInstance.withdrawalSummaryApiV1FinanceSummaryGet();
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

