# AIVideoTasksApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getVideoTaskApiV1AiTaskIdGet**](AIVideoTasksApi.md#getvideotaskapiv1aitaskidget) | **GET** /api/v1/ai/{task_id} | 任务详情 |
| [**listVideoTasksApiV1AiListGet**](AIVideoTasksApi.md#listvideotasksapiv1ailistget) | **GET** /api/v1/ai/list | 视频任务列表 |



## getVideoTaskApiV1AiTaskIdGet

> any getVideoTaskApiV1AiTaskIdGet(taskId)

任务详情

### Example

```ts
import {
  Configuration,
  AIVideoTasksApi,
} from '';
import type { GetVideoTaskApiV1AiTaskIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIVideoTasksApi(config);

  const body = {
    // string
    taskId: taskId_example,
  } satisfies GetVideoTaskApiV1AiTaskIdGetRequest;

  try {
    const data = await api.getVideoTaskApiV1AiTaskIdGet(body);
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


## listVideoTasksApiV1AiListGet

> any listVideoTasksApiV1AiListGet(page, limit, status)

视频任务列表

### Example

```ts
import {
  Configuration,
  AIVideoTasksApi,
} from '';
import type { ListVideoTasksApiV1AiListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIVideoTasksApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string | 任务状态过滤: accepted / processing / completed / failed (optional)
    status: status_example,
  } satisfies ListVideoTasksApiV1AiListGetRequest;

  try {
    const data = await api.listVideoTasksApiV1AiListGet(body);
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
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **status** | `string` | 任务状态过滤: accepted / processing / completed / failed | [Optional] [Defaults to `undefined`] |

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

