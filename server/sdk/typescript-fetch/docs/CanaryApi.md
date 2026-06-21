# CanaryApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getCanaryStageApiV1CanaryCanaryStageGet**](CanaryApi.md#getcanarystageapiv1canarycanarystageget) | **GET** /api/v1/canary/canary/stage | Get Canary Stage |
| [**getCanaryStageApiV1CanaryCanaryStageGet_0**](CanaryApi.md#getcanarystageapiv1canarycanarystageget_0) | **GET** /api/v1/canary/canary/stage | Get Canary Stage |
| [**postCanaryFailureApiV1CanaryCanaryFailurePost**](CanaryApi.md#postcanaryfailureapiv1canarycanaryfailurepost) | **POST** /api/v1/canary/canary/failure | Post Canary Failure |
| [**postCanaryFailureApiV1CanaryCanaryFailurePost_0**](CanaryApi.md#postcanaryfailureapiv1canarycanaryfailurepost_0) | **POST** /api/v1/canary/canary/failure | Post Canary Failure |
| [**postCanaryPromoteApiV1CanaryCanaryPromotePost**](CanaryApi.md#postcanarypromoteapiv1canarycanarypromotepost) | **POST** /api/v1/canary/canary/promote | Post Canary Promote |
| [**postCanaryPromoteApiV1CanaryCanaryPromotePost_0**](CanaryApi.md#postcanarypromoteapiv1canarycanarypromotepost_0) | **POST** /api/v1/canary/canary/promote | Post Canary Promote |
| [**postCanaryResetApiV1CanaryCanaryResetPost**](CanaryApi.md#postcanaryresetapiv1canarycanaryresetpost) | **POST** /api/v1/canary/canary/reset | Post Canary Reset |
| [**postCanaryResetApiV1CanaryCanaryResetPost_0**](CanaryApi.md#postcanaryresetapiv1canarycanaryresetpost_0) | **POST** /api/v1/canary/canary/reset | Post Canary Reset |
| [**postCanaryRollbackApiV1CanaryCanaryRollbackPost**](CanaryApi.md#postcanaryrollbackapiv1canarycanaryrollbackpost) | **POST** /api/v1/canary/canary/rollback | Post Canary Rollback |
| [**postCanaryRollbackApiV1CanaryCanaryRollbackPost_0**](CanaryApi.md#postcanaryrollbackapiv1canarycanaryrollbackpost_0) | **POST** /api/v1/canary/canary/rollback | Post Canary Rollback |
| [**postCanaryTrafficApiV1CanaryCanaryTrafficPost**](CanaryApi.md#postcanarytrafficapiv1canarycanarytrafficpost) | **POST** /api/v1/canary/canary/traffic | Post Canary Traffic |
| [**postCanaryTrafficApiV1CanaryCanaryTrafficPost_0**](CanaryApi.md#postcanarytrafficapiv1canarycanarytrafficpost_0) | **POST** /api/v1/canary/canary/traffic | Post Canary Traffic |



## getCanaryStageApiV1CanaryCanaryStageGet

> CanaryResponse getCanaryStageApiV1CanaryCanaryStageGet()

Get Canary Stage

查询当前 canary 阶段状态 (建议 133: 需 admin 角色).

### Example

```ts
import {
  Configuration,
  CanaryApi,
} from '';
import type { GetCanaryStageApiV1CanaryCanaryStageGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CanaryApi(config);

  try {
    const data = await api.getCanaryStageApiV1CanaryCanaryStageGet();
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

[**CanaryResponse**](CanaryResponse.md)

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


## getCanaryStageApiV1CanaryCanaryStageGet_0

> CanaryResponse getCanaryStageApiV1CanaryCanaryStageGet_0()

Get Canary Stage

查询当前 canary 阶段状态 (建议 133: 需 admin 角色).

### Example

```ts
import {
  Configuration,
  CanaryApi,
} from '';
import type { GetCanaryStageApiV1CanaryCanaryStageGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CanaryApi(config);

  try {
    const data = await api.getCanaryStageApiV1CanaryCanaryStageGet_0();
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

[**CanaryResponse**](CanaryResponse.md)

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


## postCanaryFailureApiV1CanaryCanaryFailurePost

> CanaryResponse postCanaryFailureApiV1CanaryCanaryFailurePost(failureRequest)

Post Canary Failure

标记一次失败 (累计达阈值自动回滚, 建议 133: 需 admin 角色).

### Example

```ts
import {
  Configuration,
  CanaryApi,
} from '';
import type { PostCanaryFailureApiV1CanaryCanaryFailurePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CanaryApi(config);

  const body = {
    // FailureRequest
    failureRequest: ...,
  } satisfies PostCanaryFailureApiV1CanaryCanaryFailurePostRequest;

  try {
    const data = await api.postCanaryFailureApiV1CanaryCanaryFailurePost(body);
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
| **failureRequest** | [FailureRequest](FailureRequest.md) |  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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


## postCanaryFailureApiV1CanaryCanaryFailurePost_0

> CanaryResponse postCanaryFailureApiV1CanaryCanaryFailurePost_0(failureRequest)

Post Canary Failure

标记一次失败 (累计达阈值自动回滚, 建议 133: 需 admin 角色).

### Example

```ts
import {
  Configuration,
  CanaryApi,
} from '';
import type { PostCanaryFailureApiV1CanaryCanaryFailurePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CanaryApi(config);

  const body = {
    // FailureRequest
    failureRequest: ...,
  } satisfies PostCanaryFailureApiV1CanaryCanaryFailurePost0Request;

  try {
    const data = await api.postCanaryFailureApiV1CanaryCanaryFailurePost_0(body);
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
| **failureRequest** | [FailureRequest](FailureRequest.md) |  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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


## postCanaryPromoteApiV1CanaryCanaryPromotePost

> CanaryResponse postCanaryPromoteApiV1CanaryCanaryPromotePost(promoteRequest)

Post Canary Promote

提升到下一阶段 (受 cooldown 约束, 建议 133: 需 admin 角色).

### Example

```ts
import {
  Configuration,
  CanaryApi,
} from '';
import type { PostCanaryPromoteApiV1CanaryCanaryPromotePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CanaryApi(config);

  const body = {
    // PromoteRequest
    promoteRequest: ...,
  } satisfies PostCanaryPromoteApiV1CanaryCanaryPromotePostRequest;

  try {
    const data = await api.postCanaryPromoteApiV1CanaryCanaryPromotePost(body);
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
| **promoteRequest** | [PromoteRequest](PromoteRequest.md) |  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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


## postCanaryPromoteApiV1CanaryCanaryPromotePost_0

> CanaryResponse postCanaryPromoteApiV1CanaryCanaryPromotePost_0(promoteRequest)

Post Canary Promote

提升到下一阶段 (受 cooldown 约束, 建议 133: 需 admin 角色).

### Example

```ts
import {
  Configuration,
  CanaryApi,
} from '';
import type { PostCanaryPromoteApiV1CanaryCanaryPromotePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CanaryApi(config);

  const body = {
    // PromoteRequest
    promoteRequest: ...,
  } satisfies PostCanaryPromoteApiV1CanaryCanaryPromotePost0Request;

  try {
    const data = await api.postCanaryPromoteApiV1CanaryCanaryPromotePost_0(body);
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
| **promoteRequest** | [PromoteRequest](PromoteRequest.md) |  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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


## postCanaryResetApiV1CanaryCanaryResetPost

> CanaryResponse postCanaryResetApiV1CanaryCanaryResetPost(resetRequest)

Post Canary Reset

重置到 STAGE_0 (新灰度周期, 建议 133: 需 admin 角色).

### Example

```ts
import {
  Configuration,
  CanaryApi,
} from '';
import type { PostCanaryResetApiV1CanaryCanaryResetPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CanaryApi(config);

  const body = {
    // ResetRequest
    resetRequest: ...,
  } satisfies PostCanaryResetApiV1CanaryCanaryResetPostRequest;

  try {
    const data = await api.postCanaryResetApiV1CanaryCanaryResetPost(body);
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
| **resetRequest** | [ResetRequest](ResetRequest.md) |  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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


## postCanaryResetApiV1CanaryCanaryResetPost_0

> CanaryResponse postCanaryResetApiV1CanaryCanaryResetPost_0(resetRequest)

Post Canary Reset

重置到 STAGE_0 (新灰度周期, 建议 133: 需 admin 角色).

### Example

```ts
import {
  Configuration,
  CanaryApi,
} from '';
import type { PostCanaryResetApiV1CanaryCanaryResetPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CanaryApi(config);

  const body = {
    // ResetRequest
    resetRequest: ...,
  } satisfies PostCanaryResetApiV1CanaryCanaryResetPost0Request;

  try {
    const data = await api.postCanaryResetApiV1CanaryCanaryResetPost_0(body);
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
| **resetRequest** | [ResetRequest](ResetRequest.md) |  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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


## postCanaryRollbackApiV1CanaryCanaryRollbackPost

> CanaryResponse postCanaryRollbackApiV1CanaryCanaryRollbackPost(rollbackRequest)

Post Canary Rollback

回滚到上一阶段 (不受 cooldown 限制, 建议 133: 需 admin 角色).

### Example

```ts
import {
  Configuration,
  CanaryApi,
} from '';
import type { PostCanaryRollbackApiV1CanaryCanaryRollbackPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CanaryApi(config);

  const body = {
    // RollbackRequest
    rollbackRequest: ...,
  } satisfies PostCanaryRollbackApiV1CanaryCanaryRollbackPostRequest;

  try {
    const data = await api.postCanaryRollbackApiV1CanaryCanaryRollbackPost(body);
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
| **rollbackRequest** | [RollbackRequest](RollbackRequest.md) |  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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


## postCanaryRollbackApiV1CanaryCanaryRollbackPost_0

> CanaryResponse postCanaryRollbackApiV1CanaryCanaryRollbackPost_0(rollbackRequest)

Post Canary Rollback

回滚到上一阶段 (不受 cooldown 限制, 建议 133: 需 admin 角色).

### Example

```ts
import {
  Configuration,
  CanaryApi,
} from '';
import type { PostCanaryRollbackApiV1CanaryCanaryRollbackPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CanaryApi(config);

  const body = {
    // RollbackRequest
    rollbackRequest: ...,
  } satisfies PostCanaryRollbackApiV1CanaryCanaryRollbackPost0Request;

  try {
    const data = await api.postCanaryRollbackApiV1CanaryCanaryRollbackPost_0(body);
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
| **rollbackRequest** | [RollbackRequest](RollbackRequest.md) |  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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


## postCanaryTrafficApiV1CanaryCanaryTrafficPost

> CanaryResponse postCanaryTrafficApiV1CanaryCanaryTrafficPost(trafficRequest)

Post Canary Traffic

报告阶段内流量数 (建议 133: 需 admin 角色).

### Example

```ts
import {
  Configuration,
  CanaryApi,
} from '';
import type { PostCanaryTrafficApiV1CanaryCanaryTrafficPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CanaryApi(config);

  const body = {
    // TrafficRequest
    trafficRequest: ...,
  } satisfies PostCanaryTrafficApiV1CanaryCanaryTrafficPostRequest;

  try {
    const data = await api.postCanaryTrafficApiV1CanaryCanaryTrafficPost(body);
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
| **trafficRequest** | [TrafficRequest](TrafficRequest.md) |  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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


## postCanaryTrafficApiV1CanaryCanaryTrafficPost_0

> CanaryResponse postCanaryTrafficApiV1CanaryCanaryTrafficPost_0(trafficRequest)

Post Canary Traffic

报告阶段内流量数 (建议 133: 需 admin 角色).

### Example

```ts
import {
  Configuration,
  CanaryApi,
} from '';
import type { PostCanaryTrafficApiV1CanaryCanaryTrafficPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CanaryApi(config);

  const body = {
    // TrafficRequest
    trafficRequest: ...,
  } satisfies PostCanaryTrafficApiV1CanaryCanaryTrafficPost0Request;

  try {
    const data = await api.postCanaryTrafficApiV1CanaryCanaryTrafficPost_0(body);
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
| **trafficRequest** | [TrafficRequest](TrafficRequest.md) |  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

