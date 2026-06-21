# AISunoApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**generateMusicApiV1AiSunoGenerateMusicPost**](AISunoApi.md#generatemusicapiv1aisunogeneratemusicpost) | **POST** /api/v1/ai/suno/generate/music | Suno AI 音乐生成 |
| [**queryMusicApiV1AiSunoQueryMusicTaskIdGet**](AISunoApi.md#querymusicapiv1aisunoquerymusictaskidget) | **GET** /api/v1/ai/suno/query/music/{task_id} | 查询Suno音乐任务状态 |



## generateMusicApiV1AiSunoGenerateMusicPost

> any generateMusicApiV1AiSunoGenerateMusicPost(generateMusicRequest)

Suno AI 音乐生成

Submit a music generation task via the Suno API. Returns task ID that can be polled with /query/music.  Suno API flow (matching original langchain_api_mini.py): 1. POST to create task -&gt; returns task_id 2. GET to poll task status until completed

### Example

```ts
import {
  Configuration,
  AISunoApi,
} from '';
import type { GenerateMusicApiV1AiSunoGenerateMusicPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AISunoApi(config);

  const body = {
    // GenerateMusicRequest
    generateMusicRequest: ...,
  } satisfies GenerateMusicApiV1AiSunoGenerateMusicPostRequest;

  try {
    const data = await api.generateMusicApiV1AiSunoGenerateMusicPost(body);
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
| **generateMusicRequest** | [GenerateMusicRequest](GenerateMusicRequest.md) |  | |

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


## queryMusicApiV1AiSunoQueryMusicTaskIdGet

> any queryMusicApiV1AiSunoQueryMusicTaskIdGet(taskId)

查询Suno音乐任务状态

Poll the status of a Suno music generation task.  Returns the music URLs when completed.

### Example

```ts
import {
  Configuration,
  AISunoApi,
} from '';
import type { QueryMusicApiV1AiSunoQueryMusicTaskIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AISunoApi(config);

  const body = {
    // string
    taskId: taskId_example,
  } satisfies QueryMusicApiV1AiSunoQueryMusicTaskIdGetRequest;

  try {
    const data = await api.queryMusicApiV1AiSunoQueryMusicTaskIdGet(body);
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

