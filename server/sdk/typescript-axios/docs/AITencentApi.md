# AITencentApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet**](#getactivejobsapiv1aitencenthunyuan3dactivejobsget) | **GET** /api/v1/ai/tencent/hunyuan3d/active-jobs | 查看当前活跃任务|
|[**queryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet**](#queryhunyuan3dapiv1aitencenthunyuan3dtasktaskidget) | **GET** /api/v1/ai/tencent/hunyuan3d/task/{task_id} | 查询混元3D任务状态|
|[**queryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost**](#queryhunyuan3dpostapiv1aitencenthunyuan3dquerypost) | **POST** /api/v1/ai/tencent/hunyuan3d/query | 查询混元3D任务状态|
|[**submitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost**](#submithunyuan3dapiv1aitencenthunyuan3dsubmitpost) | **POST** /api/v1/ai/tencent/hunyuan3d/submit | 提交混元3D任务|

# **getActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet**
> any getActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet()

View currently active polling jobs.

### Example

```typescript
import {
    AITencentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AITencentApi(configuration);

const { status, data } = await apiInstance.getActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet();
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

# **queryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet**
> any queryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet()

Query the status and result of a Hunyuan 3D task via path parameter.

### Example

```typescript
import {
    AITencentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AITencentApi(configuration);

let taskId: string; // (default to undefined)

const { status, data } = await apiInstance.queryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet(
    taskId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **taskId** | [**string**] |  | defaults to undefined|


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

# **queryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost**
> any queryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost(queryHunyuan3DRequest)

Query the status and result of a Hunyuan 3D task via POST body.

### Example

```typescript
import {
    AITencentApi,
    Configuration,
    QueryHunyuan3DRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AITencentApi(configuration);

let queryHunyuan3DRequest: QueryHunyuan3DRequest; //

const { status, data } = await apiInstance.queryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost(
    queryHunyuan3DRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **queryHunyuan3DRequest** | **QueryHunyuan3DRequest**|  | |


### Return type

**any**

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

# **submitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost**
> any submitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost(submitHunyuan3DRequest)

Submit a Hunyuan 3D model generation task (text-to-3D or image-to-3D).

### Example

```typescript
import {
    AITencentApi,
    Configuration,
    SubmitHunyuan3DRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AITencentApi(configuration);

let submitHunyuan3DRequest: SubmitHunyuan3DRequest; //

const { status, data } = await apiInstance.submitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost(
    submitHunyuan3DRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **submitHunyuan3DRequest** | **SubmitHunyuan3DRequest**|  | |


### Return type

**any**

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

