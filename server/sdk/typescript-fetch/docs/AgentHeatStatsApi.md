# AgentHeatStatsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**agentHeatApiV1AgentsAgentAgentIdGet**](AgentHeatStatsApi.md#agentheatapiv1agentsagentagentidget) | **GET** /api/v1/agents/agent/{agent_id} | 查询 Agent 热度（按日聚合） |
| [**hitApiV1AgentsHitPost**](AgentHeatStatsApi.md#hitapiv1agentshitpost) | **POST** /api/v1/agents/hit | 记录一次 Agent 命中（内部调用） |
| [**topAgentsApiV1AgentsTopGet**](AgentHeatStatsApi.md#topagentsapiv1agentstopget) | **GET** /api/v1/agents/top | 热度 TOP 榜 |



## agentHeatApiV1AgentsAgentAgentIdGet

> any agentHeatApiV1AgentsAgentAgentIdGet(agentId, days)

查询 Agent 热度（按日聚合）

### Example

```ts
import {
  Configuration,
  AgentHeatStatsApi,
} from '';
import type { AgentHeatApiV1AgentsAgentAgentIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentHeatStatsApi();

  const body = {
    // string
    agentId: agentId_example,
    // number (optional)
    days: 56,
  } satisfies AgentHeatApiV1AgentsAgentAgentIdGetRequest;

  try {
    const data = await api.agentHeatApiV1AgentsAgentAgentIdGet(body);
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
| **agentId** | `string` |  | [Defaults to `undefined`] |
| **days** | `number` |  | [Optional] [Defaults to `7`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## hitApiV1AgentsHitPost

> any hitApiV1AgentsHitPost(agentId)

记录一次 Agent 命中（内部调用）

累加当日 hit_count。无对应行时新建。

### Example

```ts
import {
  Configuration,
  AgentHeatStatsApi,
} from '';
import type { HitApiV1AgentsHitPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentHeatStatsApi();

  const body = {
    // string
    agentId: agentId_example,
  } satisfies HitApiV1AgentsHitPostRequest;

  try {
    const data = await api.hitApiV1AgentsHitPost(body);
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
| **agentId** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## topAgentsApiV1AgentsTopGet

> any topAgentsApiV1AgentsTopGet(days, limit)

热度 TOP 榜

### Example

```ts
import {
  Configuration,
  AgentHeatStatsApi,
} from '';
import type { TopAgentsApiV1AgentsTopGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentHeatStatsApi();

  const body = {
    // number (optional)
    days: 56,
    // number (optional)
    limit: 56,
  } satisfies TopAgentsApiV1AgentsTopGetRequest;

  try {
    const data = await api.topAgentsApiV1AgentsTopGet(body);
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
| **days** | `number` |  | [Optional] [Defaults to `7`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

