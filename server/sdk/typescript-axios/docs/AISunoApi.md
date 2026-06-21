# AISunoApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**generateMusicApiV1AiSunoGenerateMusicPost**](#generatemusicapiv1aisunogeneratemusicpost) | **POST** /api/v1/ai/suno/generate/music | Suno AI 音乐生成|
|[**queryMusicApiV1AiSunoQueryMusicTaskIdGet**](#querymusicapiv1aisunoquerymusictaskidget) | **GET** /api/v1/ai/suno/query/music/{task_id} | 查询Suno音乐任务状态|

# **generateMusicApiV1AiSunoGenerateMusicPost**
> any generateMusicApiV1AiSunoGenerateMusicPost(generateMusicRequest)

Submit a music generation task via the Suno API. Returns task ID that can be polled with /query/music.  Suno API flow (matching original langchain_api_mini.py): 1. POST to create task -> returns task_id 2. GET to poll task status until completed

### Example

```typescript
import {
    AISunoApi,
    Configuration,
    GenerateMusicRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AISunoApi(configuration);

let generateMusicRequest: GenerateMusicRequest; //

const { status, data } = await apiInstance.generateMusicApiV1AiSunoGenerateMusicPost(
    generateMusicRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **generateMusicRequest** | **GenerateMusicRequest**|  | |


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

# **queryMusicApiV1AiSunoQueryMusicTaskIdGet**
> any queryMusicApiV1AiSunoQueryMusicTaskIdGet()

Poll the status of a Suno music generation task.  Returns the music URLs when completed.

### Example

```typescript
import {
    AISunoApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AISunoApi(configuration);

let taskId: string; // (default to undefined)

const { status, data } = await apiInstance.queryMusicApiV1AiSunoQueryMusicTaskIdGet(
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

