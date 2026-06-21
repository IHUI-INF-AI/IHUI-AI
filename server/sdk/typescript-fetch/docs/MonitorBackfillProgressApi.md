# MonitorBackfillProgressApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**backfillHistoryApiV1MonitorBackfillHistoryGet**](MonitorBackfillProgressApi.md#backfillhistoryapiv1monitorbackfillhistoryget) | **GET** /api/v1/monitor/backfill/history | Backfill 最近历史事件 |
| [**backfillProgressApiV1MonitorBackfillProgressGet**](MonitorBackfillProgressApi.md#backfillprogressapiv1monitorbackfillprogressget) | **GET** /api/v1/monitor/backfill/progress | Backfill 实时进度 (SSE) |
| [**backfillResetApiV1MonitorBackfillResetPost**](MonitorBackfillProgressApi.md#backfillresetapiv1monitorbackfillresetpost) | **POST** /api/v1/monitor/backfill/reset | 重置 backfill 状态 |
| [**backfillStatusApiV1MonitorBackfillStatusGet**](MonitorBackfillProgressApi.md#backfillstatusapiv1monitorbackfillstatusget) | **GET** /api/v1/monitor/backfill/status | Backfill 状态快照 |



## backfillHistoryApiV1MonitorBackfillHistoryGet

> any backfillHistoryApiV1MonitorBackfillHistoryGet(limit)

Backfill 最近历史事件

### Example

```ts
import {
  Configuration,
  MonitorBackfillProgressApi,
} from '';
import type { BackfillHistoryApiV1MonitorBackfillHistoryGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorBackfillProgressApi(config);

  const body = {
    // number (optional)
    limit: 56,
  } satisfies BackfillHistoryApiV1MonitorBackfillHistoryGetRequest;

  try {
    const data = await api.backfillHistoryApiV1MonitorBackfillHistoryGet(body);
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
| **limit** | `number` |  | [Optional] [Defaults to `50`] |

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


## backfillProgressApiV1MonitorBackfillProgressGet

> any backfillProgressApiV1MonitorBackfillProgressGet()

Backfill 实时进度 (SSE)

Server-Sent Events: 实时推送 backfill 进度.  数据格式 (每行一条 SSE 事件):     event: started     data: {\&quot;event_type\&quot;: \&quot;started\&quot;, \&quot;table\&quot;: \&quot;users\&quot;, \&quot;total\&quot;: 10000, ...}      event: tenant_progress     data: {\&quot;event_type\&quot;: \&quot;tenant_progress\&quot;, \&quot;table\&quot;: \&quot;users\&quot;, \&quot;tenant_id\&quot;: 1, \&quot;processed\&quot;: 500, \&quot;total\&quot;: 2000, ...}      event: heartbeat     data: {\&quot;event_type\&quot;: \&quot;heartbeat\&quot;, ...}

### Example

```ts
import {
  Configuration,
  MonitorBackfillProgressApi,
} from '';
import type { BackfillProgressApiV1MonitorBackfillProgressGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MonitorBackfillProgressApi();

  try {
    const data = await api.backfillProgressApiV1MonitorBackfillProgressGet();
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

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## backfillResetApiV1MonitorBackfillResetPost

> any backfillResetApiV1MonitorBackfillResetPost()

重置 backfill 状态

### Example

```ts
import {
  Configuration,
  MonitorBackfillProgressApi,
} from '';
import type { BackfillResetApiV1MonitorBackfillResetPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorBackfillProgressApi(config);

  try {
    const data = await api.backfillResetApiV1MonitorBackfillResetPost();
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


## backfillStatusApiV1MonitorBackfillStatusGet

> any backfillStatusApiV1MonitorBackfillStatusGet()

Backfill 状态快照

### Example

```ts
import {
  Configuration,
  MonitorBackfillProgressApi,
} from '';
import type { BackfillStatusApiV1MonitorBackfillStatusGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorBackfillProgressApi(config);

  try {
    const data = await api.backfillStatusApiV1MonitorBackfillStatusGet();
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

