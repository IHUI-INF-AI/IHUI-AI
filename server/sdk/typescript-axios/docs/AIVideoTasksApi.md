# AIVideoTasksApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getVideoTaskApiV1AiTaskIdGet**](#getvideotaskapiv1aitaskidget) | **GET** /api/v1/ai/{task_id} | 任务详情|
|[**listVideoTasksApiV1AiListGet**](#listvideotasksapiv1ailistget) | **GET** /api/v1/ai/list | 视频任务列表|

# **getVideoTaskApiV1AiTaskIdGet**
> any getVideoTaskApiV1AiTaskIdGet()


### Example

```typescript
import {
    AIVideoTasksApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIVideoTasksApi(configuration);

let taskId: string; // (default to undefined)

const { status, data } = await apiInstance.getVideoTaskApiV1AiTaskIdGet(
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

# **listVideoTasksApiV1AiListGet**
> any listVideoTasksApiV1AiListGet()


### Example

```typescript
import {
    AIVideoTasksApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIVideoTasksApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: string; //任务状态过滤: accepted / processing / completed / failed (optional) (default to undefined)

const { status, data } = await apiInstance.listVideoTasksApiV1AiListGet(
    page,
    limit,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **status** | [**string**] | 任务状态过滤: accepted / processing / completed / failed | (optional) defaults to undefined|


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

