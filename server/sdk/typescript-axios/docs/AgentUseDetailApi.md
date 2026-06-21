# AgentUseDetailApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**agentUsedetailDailyStats**](#agentusedetaildailystats) | **GET** /api/v1/agent-usedetail/stats/daily | 日统计|
|[**agentUsedetailDailyStats_0**](#agentusedetaildailystats_0) | **GET** /api/v1/agent-usedetail/stats/daily | 日统计|
|[**listDetailsApiV1AgentUsedetailListGet**](#listdetailsapiv1agentusedetaillistget) | **GET** /api/v1/agent-usedetail/list | 使用明细|
|[**listDetailsApiV1AgentUsedetailListGet_0**](#listdetailsapiv1agentusedetaillistget_0) | **GET** /api/v1/agent-usedetail/list | 使用明细|
|[**recordUsageApiV1AgentUsedetailRecordPost**](#recordusageapiv1agentusedetailrecordpost) | **POST** /api/v1/agent-usedetail/record | 记录使用|
|[**recordUsageApiV1AgentUsedetailRecordPost_0**](#recordusageapiv1agentusedetailrecordpost_0) | **POST** /api/v1/agent-usedetail/record | 记录使用|
|[**summaryStatsApiV1AgentUsedetailStatsSummaryGet**](#summarystatsapiv1agentusedetailstatssummaryget) | **GET** /api/v1/agent-usedetail/stats/summary | 汇总统计|
|[**summaryStatsApiV1AgentUsedetailStatsSummaryGet_0**](#summarystatsapiv1agentusedetailstatssummaryget_0) | **GET** /api/v1/agent-usedetail/stats/summary | 汇总统计|

# **agentUsedetailDailyStats**
> any agentUsedetailDailyStats()


### Example

```typescript
import {
    AgentUseDetailApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentUseDetailApi(configuration);

let agentId: string; // (optional) (default to undefined)
let startDate: string; // (optional) (default to undefined)
let endDate: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.agentUsedetailDailyStats(
    agentId,
    startDate,
    endDate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | (optional) defaults to undefined|
| **startDate** | [**string**] |  | (optional) defaults to undefined|
| **endDate** | [**string**] |  | (optional) defaults to undefined|


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

# **agentUsedetailDailyStats_0**
> any agentUsedetailDailyStats_0()


### Example

```typescript
import {
    AgentUseDetailApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentUseDetailApi(configuration);

let agentId: string; // (optional) (default to undefined)
let startDate: string; // (optional) (default to undefined)
let endDate: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.agentUsedetailDailyStats_0(
    agentId,
    startDate,
    endDate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | (optional) defaults to undefined|
| **startDate** | [**string**] |  | (optional) defaults to undefined|
| **endDate** | [**string**] |  | (optional) defaults to undefined|


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

# **listDetailsApiV1AgentUsedetailListGet**
> any listDetailsApiV1AgentUsedetailListGet()


### Example

```typescript
import {
    AgentUseDetailApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentUseDetailApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let agentId: string; // (optional) (default to undefined)
let userId: string; // (optional) (default to undefined)
let type: string; // (optional) (default to undefined)
let startDate: string; // (optional) (default to undefined)
let endDate: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listDetailsApiV1AgentUsedetailListGet(
    page,
    limit,
    agentId,
    userId,
    type,
    startDate,
    endDate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **agentId** | [**string**] |  | (optional) defaults to undefined|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to undefined|
| **startDate** | [**string**] |  | (optional) defaults to undefined|
| **endDate** | [**string**] |  | (optional) defaults to undefined|


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

# **listDetailsApiV1AgentUsedetailListGet_0**
> any listDetailsApiV1AgentUsedetailListGet_0()


### Example

```typescript
import {
    AgentUseDetailApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentUseDetailApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let agentId: string; // (optional) (default to undefined)
let userId: string; // (optional) (default to undefined)
let type: string; // (optional) (default to undefined)
let startDate: string; // (optional) (default to undefined)
let endDate: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listDetailsApiV1AgentUsedetailListGet_0(
    page,
    limit,
    agentId,
    userId,
    type,
    startDate,
    endDate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **agentId** | [**string**] |  | (optional) defaults to undefined|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to undefined|
| **startDate** | [**string**] |  | (optional) defaults to undefined|
| **endDate** | [**string**] |  | (optional) defaults to undefined|


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

# **recordUsageApiV1AgentUsedetailRecordPost**
> any recordUsageApiV1AgentUsedetailRecordPost()


### Example

```typescript
import {
    AgentUseDetailApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentUseDetailApi(configuration);

let agentId: string; // (default to undefined)
let userId: string; // (default to undefined)
let type: string; // (optional) (default to 'consume')
let model: string; // (optional) (default to undefined)
let tokens: number; // (optional) (default to 0)
let amount: number; // (optional) (default to 0)
let cost: number; // (optional) (default to 0)
let requestId: string; // (optional) (default to undefined)
let status: number; // (optional) (default to 1)
let remark: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.recordUsageApiV1AgentUsedetailRecordPost(
    agentId,
    userId,
    type,
    model,
    tokens,
    amount,
    cost,
    requestId,
    status,
    remark
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|
| **userId** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'consume'|
| **model** | [**string**] |  | (optional) defaults to undefined|
| **tokens** | [**number**] |  | (optional) defaults to 0|
| **amount** | [**number**] |  | (optional) defaults to 0|
| **cost** | [**number**] |  | (optional) defaults to 0|
| **requestId** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to 1|
| **remark** | [**string**] |  | (optional) defaults to undefined|


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

# **recordUsageApiV1AgentUsedetailRecordPost_0**
> any recordUsageApiV1AgentUsedetailRecordPost_0()


### Example

```typescript
import {
    AgentUseDetailApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentUseDetailApi(configuration);

let agentId: string; // (default to undefined)
let userId: string; // (default to undefined)
let type: string; // (optional) (default to 'consume')
let model: string; // (optional) (default to undefined)
let tokens: number; // (optional) (default to 0)
let amount: number; // (optional) (default to 0)
let cost: number; // (optional) (default to 0)
let requestId: string; // (optional) (default to undefined)
let status: number; // (optional) (default to 1)
let remark: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.recordUsageApiV1AgentUsedetailRecordPost_0(
    agentId,
    userId,
    type,
    model,
    tokens,
    amount,
    cost,
    requestId,
    status,
    remark
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|
| **userId** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'consume'|
| **model** | [**string**] |  | (optional) defaults to undefined|
| **tokens** | [**number**] |  | (optional) defaults to 0|
| **amount** | [**number**] |  | (optional) defaults to 0|
| **cost** | [**number**] |  | (optional) defaults to 0|
| **requestId** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to 1|
| **remark** | [**string**] |  | (optional) defaults to undefined|


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

# **summaryStatsApiV1AgentUsedetailStatsSummaryGet**
> any summaryStatsApiV1AgentUsedetailStatsSummaryGet()


### Example

```typescript
import {
    AgentUseDetailApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentUseDetailApi(configuration);

let agentId: string; // (optional) (default to undefined)
let startDate: string; // (optional) (default to undefined)
let endDate: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.summaryStatsApiV1AgentUsedetailStatsSummaryGet(
    agentId,
    startDate,
    endDate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | (optional) defaults to undefined|
| **startDate** | [**string**] |  | (optional) defaults to undefined|
| **endDate** | [**string**] |  | (optional) defaults to undefined|


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

# **summaryStatsApiV1AgentUsedetailStatsSummaryGet_0**
> any summaryStatsApiV1AgentUsedetailStatsSummaryGet_0()


### Example

```typescript
import {
    AgentUseDetailApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentUseDetailApi(configuration);

let agentId: string; // (optional) (default to undefined)
let startDate: string; // (optional) (default to undefined)
let endDate: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.summaryStatsApiV1AgentUsedetailStatsSummaryGet_0(
    agentId,
    startDate,
    endDate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | (optional) defaults to undefined|
| **startDate** | [**string**] |  | (optional) defaults to undefined|
| **endDate** | [**string**] |  | (optional) defaults to undefined|


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

