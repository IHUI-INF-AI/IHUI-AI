# MonitorCanaryPromoterApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getOverrideApiV1MonitorCanaryPromoterOverrideGet**](MonitorCanaryPromoterApi.md#getoverrideapiv1monitorcanarypromoteroverrideget) | **GET** /api/v1/monitor/canary-promoter/override | Get Override |
| [**getPromoterStatusApiV1MonitorCanaryPromoterStatusGet**](MonitorCanaryPromoterApi.md#getpromoterstatusapiv1monitorcanarypromoterstatusget) | **GET** /api/v1/monitor/canary-promoter/status | Get Promoter Status |
| [**postForcePromoteApiV1MonitorCanaryPromoterForcePromotePost**](MonitorCanaryPromoterApi.md#postforcepromoteapiv1monitorcanarypromoterforcepromotepost) | **POST** /api/v1/monitor/canary-promoter/force-promote | Post Force Promote |
| [**postForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost**](MonitorCanaryPromoterApi.md#postforcerollbackapiv1monitorcanarypromoterforcerollbackpost) | **POST** /api/v1/monitor/canary-promoter/force-rollback | Post Force Rollback |
| [**postPauseOverrideApiV1MonitorCanaryPromoterPausePost**](MonitorCanaryPromoterApi.md#postpauseoverrideapiv1monitorcanarypromoterpausepost) | **POST** /api/v1/monitor/canary-promoter/pause | Post Pause Override |
| [**postResumeOverrideApiV1MonitorCanaryPromoterResumePost**](MonitorCanaryPromoterApi.md#postresumeoverrideapiv1monitorcanarypromoterresumepost) | **POST** /api/v1/monitor/canary-promoter/resume | Post Resume Override |



## getOverrideApiV1MonitorCanaryPromoterOverrideGet

> ModelApiResponse getOverrideApiV1MonitorCanaryPromoterOverrideGet()

Get Override

拿 override 详细状态 + 日志.

### Example

```ts
import {
  Configuration,
  MonitorCanaryPromoterApi,
} from '';
import type { GetOverrideApiV1MonitorCanaryPromoterOverrideGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorCanaryPromoterApi(config);

  try {
    const data = await api.getOverrideApiV1MonitorCanaryPromoterOverrideGet();
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


## getPromoterStatusApiV1MonitorCanaryPromoterStatusGet

> ModelApiResponse getPromoterStatusApiV1MonitorCanaryPromoterStatusGet()

Get Promoter Status

拿 CanaryAutoPromoter 完整状态 (含 override).

### Example

```ts
import {
  Configuration,
  MonitorCanaryPromoterApi,
} from '';
import type { GetPromoterStatusApiV1MonitorCanaryPromoterStatusGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorCanaryPromoterApi(config);

  try {
    const data = await api.getPromoterStatusApiV1MonitorCanaryPromoterStatusGet();
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


## postForcePromoteApiV1MonitorCanaryPromoterForcePromotePost

> ModelApiResponse postForcePromoteApiV1MonitorCanaryPromoterForcePromotePost(forcePromoteRequest)

Post Force Promote

强制推进 1 步 (忽略所有检查 + override 暂停).

### Example

```ts
import {
  Configuration,
  MonitorCanaryPromoterApi,
} from '';
import type { PostForcePromoteApiV1MonitorCanaryPromoterForcePromotePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorCanaryPromoterApi(config);

  const body = {
    // ForcePromoteRequest
    forcePromoteRequest: ...,
  } satisfies PostForcePromoteApiV1MonitorCanaryPromoterForcePromotePostRequest;

  try {
    const data = await api.postForcePromoteApiV1MonitorCanaryPromoterForcePromotePost(body);
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
| **forcePromoteRequest** | [ForcePromoteRequest](ForcePromoteRequest.md) |  | |

### Return type

[**ModelApiResponse**](ModelApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## postForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost

> ModelApiResponse postForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost(forceRollbackRequest)

Post Force Rollback

强制回滚 (紧急, 不受 cooldown 约束).

### Example

```ts
import {
  Configuration,
  MonitorCanaryPromoterApi,
} from '';
import type { PostForceRollbackApiV1MonitorCanaryPromoterForceRollbackPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorCanaryPromoterApi(config);

  const body = {
    // ForceRollbackRequest
    forceRollbackRequest: ...,
  } satisfies PostForceRollbackApiV1MonitorCanaryPromoterForceRollbackPostRequest;

  try {
    const data = await api.postForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost(body);
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
| **forceRollbackRequest** | [ForceRollbackRequest](ForceRollbackRequest.md) |  | |

### Return type

[**ModelApiResponse**](ModelApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## postPauseOverrideApiV1MonitorCanaryPromoterPausePost

> ModelApiResponse postPauseOverrideApiV1MonitorCanaryPromoterPausePost(overridePauseRequest)

Post Pause Override

人工暂停自动推进 (override 模式).  与 promoter.pause() 不同: pause_override 写入 override_log 审计, 支持 until_ts 自动恢复, check_and_promote 会因 override_active 短路.

### Example

```ts
import {
  Configuration,
  MonitorCanaryPromoterApi,
} from '';
import type { PostPauseOverrideApiV1MonitorCanaryPromoterPausePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorCanaryPromoterApi(config);

  const body = {
    // OverridePauseRequest
    overridePauseRequest: ...,
  } satisfies PostPauseOverrideApiV1MonitorCanaryPromoterPausePostRequest;

  try {
    const data = await api.postPauseOverrideApiV1MonitorCanaryPromoterPausePost(body);
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
| **overridePauseRequest** | [OverridePauseRequest](OverridePauseRequest.md) |  | |

### Return type

[**ModelApiResponse**](ModelApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## postResumeOverrideApiV1MonitorCanaryPromoterResumePost

> ModelApiResponse postResumeOverrideApiV1MonitorCanaryPromoterResumePost(overrideResumeRequest)

Post Resume Override

解除 override 暂停, 恢复自动检查.

### Example

```ts
import {
  Configuration,
  MonitorCanaryPromoterApi,
} from '';
import type { PostResumeOverrideApiV1MonitorCanaryPromoterResumePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorCanaryPromoterApi(config);

  const body = {
    // OverrideResumeRequest
    overrideResumeRequest: ...,
  } satisfies PostResumeOverrideApiV1MonitorCanaryPromoterResumePostRequest;

  try {
    const data = await api.postResumeOverrideApiV1MonitorCanaryPromoterResumePost(body);
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
| **overrideResumeRequest** | [OverrideResumeRequest](OverrideResumeRequest.md) |  | |

### Return type

[**ModelApiResponse**](ModelApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

