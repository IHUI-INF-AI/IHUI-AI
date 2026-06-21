# CanaryApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getCanaryStageApiV1CanaryCanaryStageGet**](#getcanarystageapiv1canarycanarystageget) | **GET** /api/v1/canary/canary/stage | Get Canary Stage|
|[**getCanaryStageApiV1CanaryCanaryStageGet_0**](#getcanarystageapiv1canarycanarystageget_0) | **GET** /api/v1/canary/canary/stage | Get Canary Stage|
|[**postCanaryFailureApiV1CanaryCanaryFailurePost**](#postcanaryfailureapiv1canarycanaryfailurepost) | **POST** /api/v1/canary/canary/failure | Post Canary Failure|
|[**postCanaryFailureApiV1CanaryCanaryFailurePost_0**](#postcanaryfailureapiv1canarycanaryfailurepost_0) | **POST** /api/v1/canary/canary/failure | Post Canary Failure|
|[**postCanaryPromoteApiV1CanaryCanaryPromotePost**](#postcanarypromoteapiv1canarycanarypromotepost) | **POST** /api/v1/canary/canary/promote | Post Canary Promote|
|[**postCanaryPromoteApiV1CanaryCanaryPromotePost_0**](#postcanarypromoteapiv1canarycanarypromotepost_0) | **POST** /api/v1/canary/canary/promote | Post Canary Promote|
|[**postCanaryResetApiV1CanaryCanaryResetPost**](#postcanaryresetapiv1canarycanaryresetpost) | **POST** /api/v1/canary/canary/reset | Post Canary Reset|
|[**postCanaryResetApiV1CanaryCanaryResetPost_0**](#postcanaryresetapiv1canarycanaryresetpost_0) | **POST** /api/v1/canary/canary/reset | Post Canary Reset|
|[**postCanaryRollbackApiV1CanaryCanaryRollbackPost**](#postcanaryrollbackapiv1canarycanaryrollbackpost) | **POST** /api/v1/canary/canary/rollback | Post Canary Rollback|
|[**postCanaryRollbackApiV1CanaryCanaryRollbackPost_0**](#postcanaryrollbackapiv1canarycanaryrollbackpost_0) | **POST** /api/v1/canary/canary/rollback | Post Canary Rollback|
|[**postCanaryTrafficApiV1CanaryCanaryTrafficPost**](#postcanarytrafficapiv1canarycanarytrafficpost) | **POST** /api/v1/canary/canary/traffic | Post Canary Traffic|
|[**postCanaryTrafficApiV1CanaryCanaryTrafficPost_0**](#postcanarytrafficapiv1canarycanarytrafficpost_0) | **POST** /api/v1/canary/canary/traffic | Post Canary Traffic|

# **getCanaryStageApiV1CanaryCanaryStageGet**
> CanaryResponse getCanaryStageApiV1CanaryCanaryStageGet()

查询当前 canary 阶段状态 (建议 133: 需 admin 角色).

### Example

```typescript
import {
    CanaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CanaryApi(configuration);

const { status, data } = await apiInstance.getCanaryStageApiV1CanaryCanaryStageGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**CanaryResponse**

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

# **getCanaryStageApiV1CanaryCanaryStageGet_0**
> CanaryResponse getCanaryStageApiV1CanaryCanaryStageGet_0()

查询当前 canary 阶段状态 (建议 133: 需 admin 角色).

### Example

```typescript
import {
    CanaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CanaryApi(configuration);

const { status, data } = await apiInstance.getCanaryStageApiV1CanaryCanaryStageGet_0();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**CanaryResponse**

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

# **postCanaryFailureApiV1CanaryCanaryFailurePost**
> CanaryResponse postCanaryFailureApiV1CanaryCanaryFailurePost(failureRequest)

标记一次失败 (累计达阈值自动回滚, 建议 133: 需 admin 角色).

### Example

```typescript
import {
    CanaryApi,
    Configuration,
    FailureRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new CanaryApi(configuration);

let failureRequest: FailureRequest; //

const { status, data } = await apiInstance.postCanaryFailureApiV1CanaryCanaryFailurePost(
    failureRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **failureRequest** | **FailureRequest**|  | |


### Return type

**CanaryResponse**

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

# **postCanaryFailureApiV1CanaryCanaryFailurePost_0**
> CanaryResponse postCanaryFailureApiV1CanaryCanaryFailurePost_0(failureRequest)

标记一次失败 (累计达阈值自动回滚, 建议 133: 需 admin 角色).

### Example

```typescript
import {
    CanaryApi,
    Configuration,
    FailureRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new CanaryApi(configuration);

let failureRequest: FailureRequest; //

const { status, data } = await apiInstance.postCanaryFailureApiV1CanaryCanaryFailurePost_0(
    failureRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **failureRequest** | **FailureRequest**|  | |


### Return type

**CanaryResponse**

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

# **postCanaryPromoteApiV1CanaryCanaryPromotePost**
> CanaryResponse postCanaryPromoteApiV1CanaryCanaryPromotePost(promoteRequest)

提升到下一阶段 (受 cooldown 约束, 建议 133: 需 admin 角色).

### Example

```typescript
import {
    CanaryApi,
    Configuration,
    PromoteRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new CanaryApi(configuration);

let promoteRequest: PromoteRequest; //

const { status, data } = await apiInstance.postCanaryPromoteApiV1CanaryCanaryPromotePost(
    promoteRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **promoteRequest** | **PromoteRequest**|  | |


### Return type

**CanaryResponse**

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

# **postCanaryPromoteApiV1CanaryCanaryPromotePost_0**
> CanaryResponse postCanaryPromoteApiV1CanaryCanaryPromotePost_0(promoteRequest)

提升到下一阶段 (受 cooldown 约束, 建议 133: 需 admin 角色).

### Example

```typescript
import {
    CanaryApi,
    Configuration,
    PromoteRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new CanaryApi(configuration);

let promoteRequest: PromoteRequest; //

const { status, data } = await apiInstance.postCanaryPromoteApiV1CanaryCanaryPromotePost_0(
    promoteRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **promoteRequest** | **PromoteRequest**|  | |


### Return type

**CanaryResponse**

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

# **postCanaryResetApiV1CanaryCanaryResetPost**
> CanaryResponse postCanaryResetApiV1CanaryCanaryResetPost(resetRequest)

重置到 STAGE_0 (新灰度周期, 建议 133: 需 admin 角色).

### Example

```typescript
import {
    CanaryApi,
    Configuration,
    ResetRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new CanaryApi(configuration);

let resetRequest: ResetRequest; //

const { status, data } = await apiInstance.postCanaryResetApiV1CanaryCanaryResetPost(
    resetRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **resetRequest** | **ResetRequest**|  | |


### Return type

**CanaryResponse**

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

# **postCanaryResetApiV1CanaryCanaryResetPost_0**
> CanaryResponse postCanaryResetApiV1CanaryCanaryResetPost_0(resetRequest)

重置到 STAGE_0 (新灰度周期, 建议 133: 需 admin 角色).

### Example

```typescript
import {
    CanaryApi,
    Configuration,
    ResetRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new CanaryApi(configuration);

let resetRequest: ResetRequest; //

const { status, data } = await apiInstance.postCanaryResetApiV1CanaryCanaryResetPost_0(
    resetRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **resetRequest** | **ResetRequest**|  | |


### Return type

**CanaryResponse**

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

# **postCanaryRollbackApiV1CanaryCanaryRollbackPost**
> CanaryResponse postCanaryRollbackApiV1CanaryCanaryRollbackPost(rollbackRequest)

回滚到上一阶段 (不受 cooldown 限制, 建议 133: 需 admin 角色).

### Example

```typescript
import {
    CanaryApi,
    Configuration,
    RollbackRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new CanaryApi(configuration);

let rollbackRequest: RollbackRequest; //

const { status, data } = await apiInstance.postCanaryRollbackApiV1CanaryCanaryRollbackPost(
    rollbackRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **rollbackRequest** | **RollbackRequest**|  | |


### Return type

**CanaryResponse**

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

# **postCanaryRollbackApiV1CanaryCanaryRollbackPost_0**
> CanaryResponse postCanaryRollbackApiV1CanaryCanaryRollbackPost_0(rollbackRequest)

回滚到上一阶段 (不受 cooldown 限制, 建议 133: 需 admin 角色).

### Example

```typescript
import {
    CanaryApi,
    Configuration,
    RollbackRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new CanaryApi(configuration);

let rollbackRequest: RollbackRequest; //

const { status, data } = await apiInstance.postCanaryRollbackApiV1CanaryCanaryRollbackPost_0(
    rollbackRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **rollbackRequest** | **RollbackRequest**|  | |


### Return type

**CanaryResponse**

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

# **postCanaryTrafficApiV1CanaryCanaryTrafficPost**
> CanaryResponse postCanaryTrafficApiV1CanaryCanaryTrafficPost(trafficRequest)

报告阶段内流量数 (建议 133: 需 admin 角色).

### Example

```typescript
import {
    CanaryApi,
    Configuration,
    TrafficRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new CanaryApi(configuration);

let trafficRequest: TrafficRequest; //

const { status, data } = await apiInstance.postCanaryTrafficApiV1CanaryCanaryTrafficPost(
    trafficRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **trafficRequest** | **TrafficRequest**|  | |


### Return type

**CanaryResponse**

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

# **postCanaryTrafficApiV1CanaryCanaryTrafficPost_0**
> CanaryResponse postCanaryTrafficApiV1CanaryCanaryTrafficPost_0(trafficRequest)

报告阶段内流量数 (建议 133: 需 admin 角色).

### Example

```typescript
import {
    CanaryApi,
    Configuration,
    TrafficRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new CanaryApi(configuration);

let trafficRequest: TrafficRequest; //

const { status, data } = await apiInstance.postCanaryTrafficApiV1CanaryCanaryTrafficPost_0(
    trafficRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **trafficRequest** | **TrafficRequest**|  | |


### Return type

**CanaryResponse**

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

