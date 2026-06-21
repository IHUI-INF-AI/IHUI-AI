# AgentUseDetailApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**agentUsedetailDailyStats**](AgentUseDetailApi.md#agentusedetaildailystats) | **GET** /api/v1/agent-usedetail/stats/daily | 日统计 |
| [**agentUsedetailDailyStats_0**](AgentUseDetailApi.md#agentusedetaildailystats_0) | **GET** /api/v1/agent-usedetail/stats/daily | 日统计 |
| [**listDetailsApiV1AgentUsedetailListGet**](AgentUseDetailApi.md#listdetailsapiv1agentusedetaillistget) | **GET** /api/v1/agent-usedetail/list | 使用明细 |
| [**listDetailsApiV1AgentUsedetailListGet_0**](AgentUseDetailApi.md#listdetailsapiv1agentusedetaillistget_0) | **GET** /api/v1/agent-usedetail/list | 使用明细 |
| [**recordUsageApiV1AgentUsedetailRecordPost**](AgentUseDetailApi.md#recordusageapiv1agentusedetailrecordpost) | **POST** /api/v1/agent-usedetail/record | 记录使用 |
| [**recordUsageApiV1AgentUsedetailRecordPost_0**](AgentUseDetailApi.md#recordusageapiv1agentusedetailrecordpost_0) | **POST** /api/v1/agent-usedetail/record | 记录使用 |
| [**summaryStatsApiV1AgentUsedetailStatsSummaryGet**](AgentUseDetailApi.md#summarystatsapiv1agentusedetailstatssummaryget) | **GET** /api/v1/agent-usedetail/stats/summary | 汇总统计 |
| [**summaryStatsApiV1AgentUsedetailStatsSummaryGet_0**](AgentUseDetailApi.md#summarystatsapiv1agentusedetailstatssummaryget_0) | **GET** /api/v1/agent-usedetail/stats/summary | 汇总统计 |



## agentUsedetailDailyStats

> any agentUsedetailDailyStats(agentId, startDate, endDate)

日统计

### Example

```ts
import {
  Configuration,
  AgentUseDetailApi,
} from '';
import type { AgentUsedetailDailyStatsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentUseDetailApi();

  const body = {
    // string (optional)
    agentId: agentId_example,
    // string (optional)
    startDate: startDate_example,
    // string (optional)
    endDate: endDate_example,
  } satisfies AgentUsedetailDailyStatsRequest;

  try {
    const data = await api.agentUsedetailDailyStats(body);
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
| **agentId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **startDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **endDate** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## agentUsedetailDailyStats_0

> any agentUsedetailDailyStats_0(agentId, startDate, endDate)

日统计

### Example

```ts
import {
  Configuration,
  AgentUseDetailApi,
} from '';
import type { AgentUsedetailDailyStats0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentUseDetailApi();

  const body = {
    // string (optional)
    agentId: agentId_example,
    // string (optional)
    startDate: startDate_example,
    // string (optional)
    endDate: endDate_example,
  } satisfies AgentUsedetailDailyStats0Request;

  try {
    const data = await api.agentUsedetailDailyStats_0(body);
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
| **agentId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **startDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **endDate** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## listDetailsApiV1AgentUsedetailListGet

> any listDetailsApiV1AgentUsedetailListGet(page, limit, agentId, userId, type, startDate, endDate)

使用明细

### Example

```ts
import {
  Configuration,
  AgentUseDetailApi,
} from '';
import type { ListDetailsApiV1AgentUsedetailListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentUseDetailApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    agentId: agentId_example,
    // string (optional)
    userId: userId_example,
    // string (optional)
    type: type_example,
    // string (optional)
    startDate: startDate_example,
    // string (optional)
    endDate: endDate_example,
  } satisfies ListDetailsApiV1AgentUsedetailListGetRequest;

  try {
    const data = await api.listDetailsApiV1AgentUsedetailListGet(body);
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
| **agentId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |
| **startDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **endDate** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## listDetailsApiV1AgentUsedetailListGet_0

> any listDetailsApiV1AgentUsedetailListGet_0(page, limit, agentId, userId, type, startDate, endDate)

使用明细

### Example

```ts
import {
  Configuration,
  AgentUseDetailApi,
} from '';
import type { ListDetailsApiV1AgentUsedetailListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentUseDetailApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    agentId: agentId_example,
    // string (optional)
    userId: userId_example,
    // string (optional)
    type: type_example,
    // string (optional)
    startDate: startDate_example,
    // string (optional)
    endDate: endDate_example,
  } satisfies ListDetailsApiV1AgentUsedetailListGet0Request;

  try {
    const data = await api.listDetailsApiV1AgentUsedetailListGet_0(body);
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
| **agentId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |
| **startDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **endDate** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## recordUsageApiV1AgentUsedetailRecordPost

> any recordUsageApiV1AgentUsedetailRecordPost(agentId, userId, type, model, tokens, amount, cost, requestId, status, remark)

记录使用

### Example

```ts
import {
  Configuration,
  AgentUseDetailApi,
} from '';
import type { RecordUsageApiV1AgentUsedetailRecordPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentUseDetailApi();

  const body = {
    // string
    agentId: agentId_example,
    // string
    userId: userId_example,
    // string (optional)
    type: type_example,
    // string (optional)
    model: model_example,
    // number (optional)
    tokens: 56,
    // number (optional)
    amount: 8.14,
    // number (optional)
    cost: 8.14,
    // string (optional)
    requestId: requestId_example,
    // number (optional)
    status: 56,
    // string (optional)
    remark: remark_example,
  } satisfies RecordUsageApiV1AgentUsedetailRecordPostRequest;

  try {
    const data = await api.recordUsageApiV1AgentUsedetailRecordPost(body);
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
| **userId** | `string` |  | [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;consume&#39;`] |
| **model** | `string` |  | [Optional] [Defaults to `undefined`] |
| **tokens** | `number` |  | [Optional] [Defaults to `0`] |
| **amount** | `number` |  | [Optional] [Defaults to `0`] |
| **cost** | `number` |  | [Optional] [Defaults to `0`] |
| **requestId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `1`] |
| **remark** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## recordUsageApiV1AgentUsedetailRecordPost_0

> any recordUsageApiV1AgentUsedetailRecordPost_0(agentId, userId, type, model, tokens, amount, cost, requestId, status, remark)

记录使用

### Example

```ts
import {
  Configuration,
  AgentUseDetailApi,
} from '';
import type { RecordUsageApiV1AgentUsedetailRecordPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentUseDetailApi();

  const body = {
    // string
    agentId: agentId_example,
    // string
    userId: userId_example,
    // string (optional)
    type: type_example,
    // string (optional)
    model: model_example,
    // number (optional)
    tokens: 56,
    // number (optional)
    amount: 8.14,
    // number (optional)
    cost: 8.14,
    // string (optional)
    requestId: requestId_example,
    // number (optional)
    status: 56,
    // string (optional)
    remark: remark_example,
  } satisfies RecordUsageApiV1AgentUsedetailRecordPost0Request;

  try {
    const data = await api.recordUsageApiV1AgentUsedetailRecordPost_0(body);
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
| **userId** | `string` |  | [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;consume&#39;`] |
| **model** | `string` |  | [Optional] [Defaults to `undefined`] |
| **tokens** | `number` |  | [Optional] [Defaults to `0`] |
| **amount** | `number` |  | [Optional] [Defaults to `0`] |
| **cost** | `number` |  | [Optional] [Defaults to `0`] |
| **requestId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `1`] |
| **remark** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## summaryStatsApiV1AgentUsedetailStatsSummaryGet

> any summaryStatsApiV1AgentUsedetailStatsSummaryGet(agentId, startDate, endDate)

汇总统计

### Example

```ts
import {
  Configuration,
  AgentUseDetailApi,
} from '';
import type { SummaryStatsApiV1AgentUsedetailStatsSummaryGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentUseDetailApi();

  const body = {
    // string (optional)
    agentId: agentId_example,
    // string (optional)
    startDate: startDate_example,
    // string (optional)
    endDate: endDate_example,
  } satisfies SummaryStatsApiV1AgentUsedetailStatsSummaryGetRequest;

  try {
    const data = await api.summaryStatsApiV1AgentUsedetailStatsSummaryGet(body);
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
| **agentId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **startDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **endDate** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## summaryStatsApiV1AgentUsedetailStatsSummaryGet_0

> any summaryStatsApiV1AgentUsedetailStatsSummaryGet_0(agentId, startDate, endDate)

汇总统计

### Example

```ts
import {
  Configuration,
  AgentUseDetailApi,
} from '';
import type { SummaryStatsApiV1AgentUsedetailStatsSummaryGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentUseDetailApi();

  const body = {
    // string (optional)
    agentId: agentId_example,
    // string (optional)
    startDate: startDate_example,
    // string (optional)
    endDate: endDate_example,
  } satisfies SummaryStatsApiV1AgentUsedetailStatsSummaryGet0Request;

  try {
    const data = await api.summaryStatsApiV1AgentUsedetailStatsSummaryGet_0(body);
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
| **agentId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **startDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **endDate** | `string` |  | [Optional] [Defaults to `undefined`] |

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

