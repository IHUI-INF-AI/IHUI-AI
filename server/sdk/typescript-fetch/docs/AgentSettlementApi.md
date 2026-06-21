# AgentSettlementApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**listUnsettledApiV1AgentsUnsettledGet**](AgentSettlementApi.md#listunsettledapiv1agentsunsettledget) | **GET** /api/v1/agents/unsettled | 查询未结算记录 |
| [**settlementSummaryApiV1AgentsSummaryGet**](AgentSettlementApi.md#settlementsummaryapiv1agentssummaryget) | **GET** /api/v1/agents/summary | 结算汇总 |
| [**triggerSettleApiV1AgentsSettlePost**](AgentSettlementApi.md#triggersettleapiv1agentssettlepost) | **POST** /api/v1/agents/settle | 触发单条结算 |



## listUnsettledApiV1AgentsUnsettledGet

> any listUnsettledApiV1AgentsUnsettledGet()

查询未结算记录

### Example

```ts
import {
  Configuration,
  AgentSettlementApi,
} from '';
import type { ListUnsettledApiV1AgentsUnsettledGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentSettlementApi(config);

  try {
    const data = await api.listUnsettledApiV1AgentsUnsettledGet();
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


## settlementSummaryApiV1AgentsSummaryGet

> any settlementSummaryApiV1AgentsSummaryGet()

结算汇总

### Example

```ts
import {
  Configuration,
  AgentSettlementApi,
} from '';
import type { SettlementSummaryApiV1AgentsSummaryGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentSettlementApi(config);

  try {
    const data = await api.settlementSummaryApiV1AgentsSummaryGet();
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


## triggerSettleApiV1AgentsSettlePost

> any triggerSettleApiV1AgentsSettlePost(settlementId)

触发单条结算

### Example

```ts
import {
  Configuration,
  AgentSettlementApi,
} from '';
import type { TriggerSettleApiV1AgentsSettlePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentSettlementApi(config);

  const body = {
    // string
    settlementId: settlementId_example,
  } satisfies TriggerSettleApiV1AgentsSettlePostRequest;

  try {
    const data = await api.triggerSettleApiV1AgentsSettlePost(body);
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
| **settlementId** | `string` |  | [Defaults to `undefined`] |

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

