# MonitorBackfillProgressApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**backfillHistoryApiV1MonitorBackfillHistoryGet**](#backfillhistoryapiv1monitorbackfillhistoryget) | **GET** /api/v1/monitor/backfill/history | Backfill 最近历史事件|
|[**backfillProgressApiV1MonitorBackfillProgressGet**](#backfillprogressapiv1monitorbackfillprogressget) | **GET** /api/v1/monitor/backfill/progress | Backfill 实时进度 (SSE)|
|[**backfillResetApiV1MonitorBackfillResetPost**](#backfillresetapiv1monitorbackfillresetpost) | **POST** /api/v1/monitor/backfill/reset | 重置 backfill 状态|
|[**backfillStatusApiV1MonitorBackfillStatusGet**](#backfillstatusapiv1monitorbackfillstatusget) | **GET** /api/v1/monitor/backfill/status | Backfill 状态快照|

# **backfillHistoryApiV1MonitorBackfillHistoryGet**
> any backfillHistoryApiV1MonitorBackfillHistoryGet()


### Example

```typescript
import {
    MonitorBackfillProgressApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorBackfillProgressApi(configuration);

let limit: number; // (optional) (default to 50)

const { status, data } = await apiInstance.backfillHistoryApiV1MonitorBackfillHistoryGet(
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **limit** | [**number**] |  | (optional) defaults to 50|


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

# **backfillProgressApiV1MonitorBackfillProgressGet**
> any backfillProgressApiV1MonitorBackfillProgressGet()

Server-Sent Events: 实时推送 backfill 进度.  数据格式 (每行一条 SSE 事件):     event: started     data: {\"event_type\": \"started\", \"table\": \"users\", \"total\": 10000, ...}      event: tenant_progress     data: {\"event_type\": \"tenant_progress\", \"table\": \"users\", \"tenant_id\": 1, \"processed\": 500, \"total\": 2000, ...}      event: heartbeat     data: {\"event_type\": \"heartbeat\", ...}

### Example

```typescript
import {
    MonitorBackfillProgressApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorBackfillProgressApi(configuration);

const { status, data } = await apiInstance.backfillProgressApiV1MonitorBackfillProgressGet();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **backfillResetApiV1MonitorBackfillResetPost**
> any backfillResetApiV1MonitorBackfillResetPost()


### Example

```typescript
import {
    MonitorBackfillProgressApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorBackfillProgressApi(configuration);

const { status, data } = await apiInstance.backfillResetApiV1MonitorBackfillResetPost();
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

# **backfillStatusApiV1MonitorBackfillStatusGet**
> any backfillStatusApiV1MonitorBackfillStatusGet()


### Example

```typescript
import {
    MonitorBackfillProgressApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorBackfillProgressApi(configuration);

const { status, data } = await apiInstance.backfillStatusApiV1MonitorBackfillStatusGet();
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

