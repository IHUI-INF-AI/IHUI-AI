# AISora2Api

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**generateVideoApiV1AiSora2GenerateVideoPost**](#generatevideoapiv1aisora2generatevideopost) | **POST** /api/v1/ai/sora2/generate/video | Sora2/Veo AI 视频生成|
|[**queryVideoApiV1AiSora2VideoTaskIdGet**](#queryvideoapiv1aisora2videotaskidget) | **GET** /api/v1/ai/sora2/video/{task_id} | 查询Sora2视频生成任务状态|

# **generateVideoApiV1AiSora2GenerateVideoPost**
> any generateVideoApiV1AiSora2GenerateVideoPost(generateVideoRequest)

Submit a video generation task via the yunwu.ai proxy.  Flow (matching original luyala_proxy.py): 1. POST to create video task -> returns task id 2. Sync poll for up to 5 minutes (30 x 10s) 3. If not done, return pending + continue background poll for 10 minutes

### Example

```typescript
import {
    AISora2Api,
    Configuration,
    GenerateVideoRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AISora2Api(configuration);

let generateVideoRequest: GenerateVideoRequest; //

const { status, data } = await apiInstance.generateVideoApiV1AiSora2GenerateVideoPost(
    generateVideoRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **generateVideoRequest** | **GenerateVideoRequest**|  | |


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

# **queryVideoApiV1AiSora2VideoTaskIdGet**
> any queryVideoApiV1AiSora2VideoTaskIdGet()

Query the status and result of a Sora 2 video generation task.

### Example

```typescript
import {
    AISora2Api,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AISora2Api(configuration);

let taskId: string; // (default to undefined)

const { status, data } = await apiInstance.queryVideoApiV1AiSora2VideoTaskIdGet(
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

