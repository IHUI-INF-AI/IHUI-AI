# MonitorCanaryPromoterApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getOverrideApiV1MonitorCanaryPromoterOverrideGet**](#getoverrideapiv1monitorcanarypromoteroverrideget) | **GET** /api/v1/monitor/canary-promoter/override | Get Override|
|[**getPromoterStatusApiV1MonitorCanaryPromoterStatusGet**](#getpromoterstatusapiv1monitorcanarypromoterstatusget) | **GET** /api/v1/monitor/canary-promoter/status | Get Promoter Status|
|[**postForcePromoteApiV1MonitorCanaryPromoterForcePromotePost**](#postforcepromoteapiv1monitorcanarypromoterforcepromotepost) | **POST** /api/v1/monitor/canary-promoter/force-promote | Post Force Promote|
|[**postForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost**](#postforcerollbackapiv1monitorcanarypromoterforcerollbackpost) | **POST** /api/v1/monitor/canary-promoter/force-rollback | Post Force Rollback|
|[**postPauseOverrideApiV1MonitorCanaryPromoterPausePost**](#postpauseoverrideapiv1monitorcanarypromoterpausepost) | **POST** /api/v1/monitor/canary-promoter/pause | Post Pause Override|
|[**postResumeOverrideApiV1MonitorCanaryPromoterResumePost**](#postresumeoverrideapiv1monitorcanarypromoterresumepost) | **POST** /api/v1/monitor/canary-promoter/resume | Post Resume Override|

# **getOverrideApiV1MonitorCanaryPromoterOverrideGet**
> ApiResponse getOverrideApiV1MonitorCanaryPromoterOverrideGet()

拿 override 详细状态 + 日志.

### Example

```typescript
import {
    MonitorCanaryPromoterApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorCanaryPromoterApi(configuration);

const { status, data } = await apiInstance.getOverrideApiV1MonitorCanaryPromoterOverrideGet();
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

# **getPromoterStatusApiV1MonitorCanaryPromoterStatusGet**
> ApiResponse getPromoterStatusApiV1MonitorCanaryPromoterStatusGet()

拿 CanaryAutoPromoter 完整状态 (含 override).

### Example

```typescript
import {
    MonitorCanaryPromoterApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorCanaryPromoterApi(configuration);

const { status, data } = await apiInstance.getPromoterStatusApiV1MonitorCanaryPromoterStatusGet();
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

# **postForcePromoteApiV1MonitorCanaryPromoterForcePromotePost**
> ApiResponse postForcePromoteApiV1MonitorCanaryPromoterForcePromotePost(forcePromoteRequest)

强制推进 1 步 (忽略所有检查 + override 暂停).

### Example

```typescript
import {
    MonitorCanaryPromoterApi,
    Configuration,
    ForcePromoteRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorCanaryPromoterApi(configuration);

let forcePromoteRequest: ForcePromoteRequest; //

const { status, data } = await apiInstance.postForcePromoteApiV1MonitorCanaryPromoterForcePromotePost(
    forcePromoteRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **forcePromoteRequest** | **ForcePromoteRequest**|  | |


### Return type

**ApiResponse**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost**
> ApiResponse postForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost(forceRollbackRequest)

强制回滚 (紧急, 不受 cooldown 约束).

### Example

```typescript
import {
    MonitorCanaryPromoterApi,
    Configuration,
    ForceRollbackRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorCanaryPromoterApi(configuration);

let forceRollbackRequest: ForceRollbackRequest; //

const { status, data } = await apiInstance.postForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost(
    forceRollbackRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **forceRollbackRequest** | **ForceRollbackRequest**|  | |


### Return type

**ApiResponse**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postPauseOverrideApiV1MonitorCanaryPromoterPausePost**
> ApiResponse postPauseOverrideApiV1MonitorCanaryPromoterPausePost(overridePauseRequest)

人工暂停自动推进 (override 模式).  与 promoter.pause() 不同: pause_override 写入 override_log 审计, 支持 until_ts 自动恢复, check_and_promote 会因 override_active 短路.

### Example

```typescript
import {
    MonitorCanaryPromoterApi,
    Configuration,
    OverridePauseRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorCanaryPromoterApi(configuration);

let overridePauseRequest: OverridePauseRequest; //

const { status, data } = await apiInstance.postPauseOverrideApiV1MonitorCanaryPromoterPausePost(
    overridePauseRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **overridePauseRequest** | **OverridePauseRequest**|  | |


### Return type

**ApiResponse**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postResumeOverrideApiV1MonitorCanaryPromoterResumePost**
> ApiResponse postResumeOverrideApiV1MonitorCanaryPromoterResumePost(overrideResumeRequest)

解除 override 暂停, 恢复自动检查.

### Example

```typescript
import {
    MonitorCanaryPromoterApi,
    Configuration,
    OverrideResumeRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorCanaryPromoterApi(configuration);

let overrideResumeRequest: OverrideResumeRequest; //

const { status, data } = await apiInstance.postResumeOverrideApiV1MonitorCanaryPromoterResumePost(
    overrideResumeRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **overrideResumeRequest** | **OverrideResumeRequest**|  | |


### Return type

**ApiResponse**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

