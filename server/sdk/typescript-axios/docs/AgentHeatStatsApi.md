# AgentHeatStatsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**agentHeatApiV1AgentsAgentAgentIdGet**](#agentheatapiv1agentsagentagentidget) | **GET** /api/v1/agents/agent/{agent_id} | 查询 Agent 热度（按日聚合）|
|[**hitApiV1AgentsHitPost**](#hitapiv1agentshitpost) | **POST** /api/v1/agents/hit | 记录一次 Agent 命中（内部调用）|
|[**topAgentsApiV1AgentsTopGet**](#topagentsapiv1agentstopget) | **GET** /api/v1/agents/top | 热度 TOP 榜|

# **agentHeatApiV1AgentsAgentAgentIdGet**
> any agentHeatApiV1AgentsAgentAgentIdGet()


### Example

```typescript
import {
    AgentHeatStatsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentHeatStatsApi(configuration);

let agentId: string; // (default to undefined)
let days: number; // (optional) (default to 7)

const { status, data } = await apiInstance.agentHeatApiV1AgentsAgentAgentIdGet(
    agentId,
    days
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|
| **days** | [**number**] |  | (optional) defaults to 7|


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

# **hitApiV1AgentsHitPost**
> any hitApiV1AgentsHitPost()

累加当日 hit_count。无对应行时新建。

### Example

```typescript
import {
    AgentHeatStatsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentHeatStatsApi(configuration);

let agentId: string; // (default to undefined)

const { status, data } = await apiInstance.hitApiV1AgentsHitPost(
    agentId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|


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

# **topAgentsApiV1AgentsTopGet**
> any topAgentsApiV1AgentsTopGet()


### Example

```typescript
import {
    AgentHeatStatsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentHeatStatsApi(configuration);

let days: number; // (optional) (default to 7)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.topAgentsApiV1AgentsTopGet(
    days,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **days** | [**number**] |  | (optional) defaults to 7|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

