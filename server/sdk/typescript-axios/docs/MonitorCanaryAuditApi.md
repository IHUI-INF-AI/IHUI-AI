# MonitorCanaryAuditApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost**](#canaryauditcleanupapiv1monitorcanaryauditcleanuppost) | **POST** /api/v1/monitor/canary-audit/cleanup | Canary Audit Cleanup|
|[**canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0**](#canaryauditcleanupapiv1monitorcanaryauditcleanuppost_0) | **POST** /api/v1/monitor/canary-audit/cleanup | Canary Audit Cleanup|
|[**canaryAuditStatsApiV1MonitorCanaryAuditStatsGet**](#canaryauditstatsapiv1monitorcanaryauditstatsget) | **GET** /api/v1/monitor/canary-audit/stats | Canary Audit Stats|
|[**canaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0**](#canaryauditstatsapiv1monitorcanaryauditstatsget_0) | **GET** /api/v1/monitor/canary-audit/stats | Canary Audit Stats|
|[**queryCanaryAuditApiV1MonitorCanaryAuditGet**](#querycanaryauditapiv1monitorcanaryauditget) | **GET** /api/v1/monitor/canary-audit | Query Canary Audit|
|[**queryCanaryAuditApiV1MonitorCanaryAuditGet_0**](#querycanaryauditapiv1monitorcanaryauditget_0) | **GET** /api/v1/monitor/canary-audit | Query Canary Audit|

# **canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost**
> ApiResponse canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost()

手动触发过期清理 (按 store._retention_days).

### Example

```typescript
import {
    MonitorCanaryAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorCanaryAuditApi(configuration);

const { status, data } = await apiInstance.canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**ApiResponse**

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

# **canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0**
> ApiResponse canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0()

手动触发过期清理 (按 store._retention_days).

### Example

```typescript
import {
    MonitorCanaryAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorCanaryAuditApi(configuration);

const { status, data } = await apiInstance.canaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**ApiResponse**

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

# **canaryAuditStatsApiV1MonitorCanaryAuditStatsGet**
> ApiResponse canaryAuditStatsApiV1MonitorCanaryAuditStatsGet()

审计统计 (按 source 分组 + 总数).

### Example

```typescript
import {
    MonitorCanaryAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorCanaryAuditApi(configuration);

const { status, data } = await apiInstance.canaryAuditStatsApiV1MonitorCanaryAuditStatsGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**ApiResponse**

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

# **canaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0**
> ApiResponse canaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0()

审计统计 (按 source 分组 + 总数).

### Example

```typescript
import {
    MonitorCanaryAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorCanaryAuditApi(configuration);

const { status, data } = await apiInstance.canaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**ApiResponse**

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

# **queryCanaryAuditApiV1MonitorCanaryAuditGet**
> ApiResponse queryCanaryAuditApiV1MonitorCanaryAuditGet()

查 Canary 审计日志 (按时间倒序).

### Example

```typescript
import {
    MonitorCanaryAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorCanaryAuditApi(configuration);

let limit: number; //返回条数限制 (optional) (default to 100)
let source: string; //controller / promoter / override (optional) (default to undefined)
let action: string; //事件类型过滤 (optional) (default to undefined)
let sinceTs: number; //起始时间戳 (optional) (default to undefined)
let untilTs: number; //结束时间戳 (optional) (default to undefined)

const { status, data } = await apiInstance.queryCanaryAuditApiV1MonitorCanaryAuditGet(
    limit,
    source,
    action,
    sinceTs,
    untilTs
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **limit** | [**number**] | 返回条数限制 | (optional) defaults to 100|
| **source** | [**string**] | controller / promoter / override | (optional) defaults to undefined|
| **action** | [**string**] | 事件类型过滤 | (optional) defaults to undefined|
| **sinceTs** | [**number**] | 起始时间戳 | (optional) defaults to undefined|
| **untilTs** | [**number**] | 结束时间戳 | (optional) defaults to undefined|


### Return type

**ApiResponse**

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

# **queryCanaryAuditApiV1MonitorCanaryAuditGet_0**
> ApiResponse queryCanaryAuditApiV1MonitorCanaryAuditGet_0()

查 Canary 审计日志 (按时间倒序).

### Example

```typescript
import {
    MonitorCanaryAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorCanaryAuditApi(configuration);

let limit: number; //返回条数限制 (optional) (default to 100)
let source: string; //controller / promoter / override (optional) (default to undefined)
let action: string; //事件类型过滤 (optional) (default to undefined)
let sinceTs: number; //起始时间戳 (optional) (default to undefined)
let untilTs: number; //结束时间戳 (optional) (default to undefined)

const { status, data } = await apiInstance.queryCanaryAuditApiV1MonitorCanaryAuditGet_0(
    limit,
    source,
    action,
    sinceTs,
    untilTs
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **limit** | [**number**] | 返回条数限制 | (optional) defaults to 100|
| **source** | [**string**] | controller / promoter / override | (optional) defaults to undefined|
| **action** | [**string**] | 事件类型过滤 | (optional) defaults to undefined|
| **sinceTs** | [**number**] | 起始时间戳 | (optional) defaults to undefined|
| **untilTs** | [**number**] | 结束时间戳 | (optional) defaults to undefined|


### Return type

**ApiResponse**

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

