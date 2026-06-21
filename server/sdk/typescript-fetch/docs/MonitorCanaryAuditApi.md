# MonitorCanaryAuditApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost**](MonitorCanaryAuditApi.md#canaryauditcleanupapiv1monitorcanaryauditcleanuppost) | **POST** /api/v1/monitor/canary-audit/cleanup | Canary Audit Cleanup |
| [**canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0**](MonitorCanaryAuditApi.md#canaryauditcleanupapiv1monitorcanaryauditcleanuppost_0) | **POST** /api/v1/monitor/canary-audit/cleanup | Canary Audit Cleanup |
| [**canaryAuditStatsApiV1MonitorCanaryAuditStatsGet**](MonitorCanaryAuditApi.md#canaryauditstatsapiv1monitorcanaryauditstatsget) | **GET** /api/v1/monitor/canary-audit/stats | Canary Audit Stats |
| [**canaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0**](MonitorCanaryAuditApi.md#canaryauditstatsapiv1monitorcanaryauditstatsget_0) | **GET** /api/v1/monitor/canary-audit/stats | Canary Audit Stats |
| [**queryCanaryAuditApiV1MonitorCanaryAuditGet**](MonitorCanaryAuditApi.md#querycanaryauditapiv1monitorcanaryauditget) | **GET** /api/v1/monitor/canary-audit | Query Canary Audit |
| [**queryCanaryAuditApiV1MonitorCanaryAuditGet_0**](MonitorCanaryAuditApi.md#querycanaryauditapiv1monitorcanaryauditget_0) | **GET** /api/v1/monitor/canary-audit | Query Canary Audit |



## canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost

> ModelApiResponse canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost()

Canary Audit Cleanup

手动触发过期清理 (按 store._retention_days).

### Example

```ts
import {
  Configuration,
  MonitorCanaryAuditApi,
} from '';
import type { CanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorCanaryAuditApi(config);

  try {
    const data = await api.canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost();
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

[**ModelApiResponse**](ModelApiResponse.md)

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


## canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0

> ModelApiResponse canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0()

Canary Audit Cleanup

手动触发过期清理 (按 store._retention_days).

### Example

```ts
import {
  Configuration,
  MonitorCanaryAuditApi,
} from '';
import type { CanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorCanaryAuditApi(config);

  try {
    const data = await api.canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0();
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

[**ModelApiResponse**](ModelApiResponse.md)

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


## canaryAuditStatsApiV1MonitorCanaryAuditStatsGet

> ModelApiResponse canaryAuditStatsApiV1MonitorCanaryAuditStatsGet()

Canary Audit Stats

审计统计 (按 source 分组 + 总数).

### Example

```ts
import {
  Configuration,
  MonitorCanaryAuditApi,
} from '';
import type { CanaryAuditStatsApiV1MonitorCanaryAuditStatsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorCanaryAuditApi(config);

  try {
    const data = await api.canaryAuditStatsApiV1MonitorCanaryAuditStatsGet();
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

[**ModelApiResponse**](ModelApiResponse.md)

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


## canaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0

> ModelApiResponse canaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0()

Canary Audit Stats

审计统计 (按 source 分组 + 总数).

### Example

```ts
import {
  Configuration,
  MonitorCanaryAuditApi,
} from '';
import type { CanaryAuditStatsApiV1MonitorCanaryAuditStatsGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorCanaryAuditApi(config);

  try {
    const data = await api.canaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0();
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

[**ModelApiResponse**](ModelApiResponse.md)

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


## queryCanaryAuditApiV1MonitorCanaryAuditGet

> ModelApiResponse queryCanaryAuditApiV1MonitorCanaryAuditGet(limit, source, action, sinceTs, untilTs)

Query Canary Audit

查 Canary 审计日志 (按时间倒序).

### Example

```ts
import {
  Configuration,
  MonitorCanaryAuditApi,
} from '';
import type { QueryCanaryAuditApiV1MonitorCanaryAuditGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorCanaryAuditApi(config);

  const body = {
    // number | 返回条数限制 (optional)
    limit: 56,
    // string | controller / promoter / override (optional)
    source: source_example,
    // string | 事件类型过滤 (optional)
    action: action_example,
    // number | 起始时间戳 (optional)
    sinceTs: 8.14,
    // number | 结束时间戳 (optional)
    untilTs: 8.14,
  } satisfies QueryCanaryAuditApiV1MonitorCanaryAuditGetRequest;

  try {
    const data = await api.queryCanaryAuditApiV1MonitorCanaryAuditGet(body);
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
| **limit** | `number` | 返回条数限制 | [Optional] [Defaults to `100`] |
| **source** | `string` | controller / promoter / override | [Optional] [Defaults to `undefined`] |
| **action** | `string` | 事件类型过滤 | [Optional] [Defaults to `undefined`] |
| **sinceTs** | `number` | 起始时间戳 | [Optional] [Defaults to `undefined`] |
| **untilTs** | `number` | 结束时间戳 | [Optional] [Defaults to `undefined`] |

### Return type

[**ModelApiResponse**](ModelApiResponse.md)

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


## queryCanaryAuditApiV1MonitorCanaryAuditGet_0

> ModelApiResponse queryCanaryAuditApiV1MonitorCanaryAuditGet_0(limit, source, action, sinceTs, untilTs)

Query Canary Audit

查 Canary 审计日志 (按时间倒序).

### Example

```ts
import {
  Configuration,
  MonitorCanaryAuditApi,
} from '';
import type { QueryCanaryAuditApiV1MonitorCanaryAuditGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorCanaryAuditApi(config);

  const body = {
    // number | 返回条数限制 (optional)
    limit: 56,
    // string | controller / promoter / override (optional)
    source: source_example,
    // string | 事件类型过滤 (optional)
    action: action_example,
    // number | 起始时间戳 (optional)
    sinceTs: 8.14,
    // number | 结束时间戳 (optional)
    untilTs: 8.14,
  } satisfies QueryCanaryAuditApiV1MonitorCanaryAuditGet0Request;

  try {
    const data = await api.queryCanaryAuditApiV1MonitorCanaryAuditGet_0(body);
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
| **limit** | `number` | 返回条数限制 | [Optional] [Defaults to `100`] |
| **source** | `string` | controller / promoter / override | [Optional] [Defaults to `undefined`] |
| **action** | `string` | 事件类型过滤 | [Optional] [Defaults to `undefined`] |
| **sinceTs** | `number` | 起始时间戳 | [Optional] [Defaults to `undefined`] |
| **untilTs** | `number` | 结束时间戳 | [Optional] [Defaults to `undefined`] |

### Return type

[**ModelApiResponse**](ModelApiResponse.md)

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

