# AISora2Api

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**generateVideoApiV1AiSora2GenerateVideoPost**](AISora2Api.md#generatevideoapiv1aisora2generatevideopost) | **POST** /api/v1/ai/sora2/generate/video | Sora2/Veo AI 视频生成 |
| [**queryVideoApiV1AiSora2VideoTaskIdGet**](AISora2Api.md#queryvideoapiv1aisora2videotaskidget) | **GET** /api/v1/ai/sora2/video/{task_id} | 查询Sora2视频生成任务状态 |



## generateVideoApiV1AiSora2GenerateVideoPost

> any generateVideoApiV1AiSora2GenerateVideoPost(generateVideoRequest)

Sora2/Veo AI 视频生成

Submit a video generation task via the yunwu.ai proxy.  Flow (matching original luyala_proxy.py): 1. POST to create video task -&gt; returns task id 2. Sync poll for up to 5 minutes (30 x 10s) 3. If not done, return pending + continue background poll for 10 minutes

### Example

```ts
import {
  Configuration,
  AISora2Api,
} from '';
import type { GenerateVideoApiV1AiSora2GenerateVideoPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AISora2Api(config);

  const body = {
    // GenerateVideoRequest
    generateVideoRequest: ...,
  } satisfies GenerateVideoApiV1AiSora2GenerateVideoPostRequest;

  try {
    const data = await api.generateVideoApiV1AiSora2GenerateVideoPost(body);
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
| **generateVideoRequest** | [GenerateVideoRequest](GenerateVideoRequest.md) |  | |

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


## queryVideoApiV1AiSora2VideoTaskIdGet

> any queryVideoApiV1AiSora2VideoTaskIdGet(taskId)

查询Sora2视频生成任务状态

Query the status and result of a Sora 2 video generation task.

### Example

```ts
import {
  Configuration,
  AISora2Api,
} from '';
import type { QueryVideoApiV1AiSora2VideoTaskIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AISora2Api(config);

  const body = {
    // string
    taskId: taskId_example,
  } satisfies QueryVideoApiV1AiSora2VideoTaskIdGetRequest;

  try {
    const data = await api.queryVideoApiV1AiSora2VideoTaskIdGet(body);
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

