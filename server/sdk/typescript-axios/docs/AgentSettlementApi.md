# AgentSettlementApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**listUnsettledApiV1AgentsUnsettledGet**](#listunsettledapiv1agentsunsettledget) | **GET** /api/v1/agents/unsettled | 查询未结算记录|
|[**settlementSummaryApiV1AgentsSummaryGet**](#settlementsummaryapiv1agentssummaryget) | **GET** /api/v1/agents/summary | 结算汇总|
|[**triggerSettleApiV1AgentsSettlePost**](#triggersettleapiv1agentssettlepost) | **POST** /api/v1/agents/settle | 触发单条结算|

# **listUnsettledApiV1AgentsUnsettledGet**
> any listUnsettledApiV1AgentsUnsettledGet()


### Example

```typescript
import {
    AgentSettlementApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentSettlementApi(configuration);

const { status, data } = await apiInstance.listUnsettledApiV1AgentsUnsettledGet();
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

# **settlementSummaryApiV1AgentsSummaryGet**
> any settlementSummaryApiV1AgentsSummaryGet()


### Example

```typescript
import {
    AgentSettlementApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentSettlementApi(configuration);

const { status, data } = await apiInstance.settlementSummaryApiV1AgentsSummaryGet();
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

# **triggerSettleApiV1AgentsSettlePost**
> any triggerSettleApiV1AgentsSettlePost()


### Example

```typescript
import {
    AgentSettlementApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentSettlementApi(configuration);

let settlementId: string; // (default to undefined)

const { status, data } = await apiInstance.triggerSettleApiV1AgentsSettlePost(
    settlementId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **settlementId** | [**string**] |  | defaults to undefined|


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

