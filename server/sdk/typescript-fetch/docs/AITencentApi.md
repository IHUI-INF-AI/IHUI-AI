# AITencentApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet**](AITencentApi.md#getactivejobsapiv1aitencenthunyuan3dactivejobsget) | **GET** /api/v1/ai/tencent/hunyuan3d/active-jobs | 查看当前活跃任务 |
| [**queryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet**](AITencentApi.md#queryhunyuan3dapiv1aitencenthunyuan3dtasktaskidget) | **GET** /api/v1/ai/tencent/hunyuan3d/task/{task_id} | 查询混元3D任务状态 |
| [**queryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost**](AITencentApi.md#queryhunyuan3dpostapiv1aitencenthunyuan3dquerypost) | **POST** /api/v1/ai/tencent/hunyuan3d/query | 查询混元3D任务状态 |
| [**submitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost**](AITencentApi.md#submithunyuan3dapiv1aitencenthunyuan3dsubmitpost) | **POST** /api/v1/ai/tencent/hunyuan3d/submit | 提交混元3D任务 |



## getActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet

> any getActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet()

查看当前活跃任务

View currently active polling jobs.

### Example

```ts
import {
  Configuration,
  AITencentApi,
} from '';
import type { GetActiveJobsApiV1AiTencentHunyuan3dActiveJobsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AITencentApi(config);

  try {
    const data = await api.getActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet();
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


## queryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet

> any queryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet(taskId)

查询混元3D任务状态

Query the status and result of a Hunyuan 3D task via path parameter.

### Example

```ts
import {
  Configuration,
  AITencentApi,
} from '';
import type { QueryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AITencentApi(config);

  const body = {
    // string
    taskId: taskId_example,
  } satisfies QueryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGetRequest;

  try {
    const data = await api.queryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet(body);
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
| **taskId** | `string` |  | [Defaults to `undefined`] |

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


## queryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost

> any queryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost(queryHunyuan3DRequest)

查询混元3D任务状态

Query the status and result of a Hunyuan 3D task via POST body.

### Example

```ts
import {
  Configuration,
  AITencentApi,
} from '';
import type { QueryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AITencentApi(config);

  const body = {
    // QueryHunyuan3DRequest
    queryHunyuan3DRequest: ...,
  } satisfies QueryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPostRequest;

  try {
    const data = await api.queryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost(body);
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
| **queryHunyuan3DRequest** | [QueryHunyuan3DRequest](QueryHunyuan3DRequest.md) |  | |

### Return type

**any**

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


## submitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost

> any submitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost(submitHunyuan3DRequest)

提交混元3D任务

Submit a Hunyuan 3D model generation task (text-to-3D or image-to-3D).

### Example

```ts
import {
  Configuration,
  AITencentApi,
} from '';
import type { SubmitHunyuan3dApiV1AiTencentHunyuan3dSubmitPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AITencentApi(config);

  const body = {
    // SubmitHunyuan3DRequest
    submitHunyuan3DRequest: ...,
  } satisfies SubmitHunyuan3dApiV1AiTencentHunyuan3dSubmitPostRequest;

  try {
    const data = await api.submitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost(body);
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
| **submitHunyuan3DRequest** | [SubmitHunyuan3DRequest](SubmitHunyuan3DRequest.md) |  | |

### Return type

**any**

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

