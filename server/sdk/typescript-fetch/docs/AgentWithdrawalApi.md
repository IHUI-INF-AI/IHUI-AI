# AgentWithdrawalApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**applyWithdrawalApiV1AgentsApplyPost**](AgentWithdrawalApi.md#applywithdrawalapiv1agentsapplypost) | **POST** /api/v1/agents/apply | 申请 Agent 提现 |
| [**getWithdrawalApiV1AgentsWithdrawalIdGet**](AgentWithdrawalApi.md#getwithdrawalapiv1agentswithdrawalidget) | **GET** /api/v1/agents/{withdrawal_id} | 提现详情 |



## applyWithdrawalApiV1AgentsApplyPost

> any applyWithdrawalApiV1AgentsApplyPost(amount, orderIds)

申请 Agent 提现

### Example

```ts
import {
  Configuration,
  AgentWithdrawalApi,
} from '';
import type { ApplyWithdrawalApiV1AgentsApplyPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentWithdrawalApi(config);

  const body = {
    // number | 提现金额（分）
    amount: 56,
    // string | 关联订单号，逗号分隔 (optional)
    orderIds: orderIds_example,
  } satisfies ApplyWithdrawalApiV1AgentsApplyPostRequest;

  try {
    const data = await api.applyWithdrawalApiV1AgentsApplyPost(body);
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
| **orderIds** | `string` | 关联订单号，逗号分隔 | [Optional] [Defaults to `&#39;&#39;`] |

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


## getWithdrawalApiV1AgentsWithdrawalIdGet

> any getWithdrawalApiV1AgentsWithdrawalIdGet(withdrawalId)

提现详情

### Example

```ts
import {
  Configuration,
  AgentWithdrawalApi,
} from '';
import type { GetWithdrawalApiV1AgentsWithdrawalIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentWithdrawalApi(config);

  const body = {
    // string
    withdrawalId: withdrawalId_example,
  } satisfies GetWithdrawalApiV1AgentsWithdrawalIdGetRequest;

  try {
    const data = await api.getWithdrawalApiV1AgentsWithdrawalIdGet(body);
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
| **withdrawalId** | `string` |  | [Defaults to `undefined`] |

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

