# AgentWithdrawalApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**applyWithdrawalApiV1AgentsApplyPost**](#applywithdrawalapiv1agentsapplypost) | **POST** /api/v1/agents/apply | 申请 Agent 提现|
|[**getWithdrawalApiV1AgentsWithdrawalIdGet**](#getwithdrawalapiv1agentswithdrawalidget) | **GET** /api/v1/agents/{withdrawal_id} | 提现详情|

# **applyWithdrawalApiV1AgentsApplyPost**
> any applyWithdrawalApiV1AgentsApplyPost()


### Example

```typescript
import {
    AgentWithdrawalApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentWithdrawalApi(configuration);

let amount: number; //提现金额（分） (default to undefined)
let orderIds: string; //关联订单号，逗号分隔 (optional) (default to '')

const { status, data } = await apiInstance.applyWithdrawalApiV1AgentsApplyPost(
    amount,
    orderIds
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **amount** | [**number**] | 提现金额（分） | defaults to undefined|
| **orderIds** | [**string**] | 关联订单号，逗号分隔 | (optional) defaults to ''|


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

# **getWithdrawalApiV1AgentsWithdrawalIdGet**
> any getWithdrawalApiV1AgentsWithdrawalIdGet()


### Example

```typescript
import {
    AgentWithdrawalApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentWithdrawalApi(configuration);

let withdrawalId: string; // (default to undefined)

const { status, data } = await apiInstance.getWithdrawalApiV1AgentsWithdrawalIdGet(
    withdrawalId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **withdrawalId** | [**string**] |  | defaults to undefined|


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

