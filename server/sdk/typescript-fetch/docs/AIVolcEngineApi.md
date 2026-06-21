# AIVolcEngineApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**jimeng31GenerateApiV1AiVolcengineJimengGeneratePost**](AIVolcEngineApi.md#jimeng31generateapiv1aivolcenginejimenggeneratepost) | **POST** /api/v1/ai/volcengine/jimeng/generate | JiMeng 3.1 generation |
| [**jimeng4ImageApiV1AiVolcengineJimengImagePost**](AIVolcEngineApi.md#jimeng4imageapiv1aivolcenginejimengimagepost) | **POST** /api/v1/ai/volcengine/jimeng/image | JiMeng 4.0 text-to-image (async) |
| [**jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost**](AIVolcEngineApi.md#jimeng4processapiv1aivolcenginejimeng4processpost) | **POST** /api/v1/ai/volcengine/jimeng4/process | 即梦4.0 CVProcess 通用转发 |
| [**pingApiV1AiVolcenginePingGet**](AIVolcEngineApi.md#pingapiv1aivolcenginepingget) | **GET** /api/v1/ai/volcengine/ping | Health check |
| [**visualProxyApiV1AiVolcengineVisualReqKeyPost**](AIVolcEngineApi.md#visualproxyapiv1aivolcenginevisualreqkeypost) | **POST** /api/v1/ai/volcengine/visual/{req_key} | 火山视觉通用代理 (CVSync2Async async submit+poll) |



## jimeng31GenerateApiV1AiVolcengineJimengGeneratePost

> any jimeng31GenerateApiV1AiVolcengineJimengGeneratePost(jimeng31Request)

JiMeng 3.1 generation

Proxy a JiMeng 3.1 generation request via CVProcess.

### Example

```ts
import {
  Configuration,
  AIVolcEngineApi,
} from '';
import type { Jimeng31GenerateApiV1AiVolcengineJimengGeneratePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AIVolcEngineApi();

  const body = {
    // Jimeng31Request
    jimeng31Request: ...,
  } satisfies Jimeng31GenerateApiV1AiVolcengineJimengGeneratePostRequest;

  try {
    const data = await api.jimeng31GenerateApiV1AiVolcengineJimengGeneratePost(body);
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
| **jimeng31Request** | [Jimeng31Request](Jimeng31Request.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## jimeng4ImageApiV1AiVolcengineJimengImagePost

> any jimeng4ImageApiV1AiVolcengineJimengImagePost(jimeng4ImageRequest)

JiMeng 4.0 text-to-image (async)

Submit a JiMeng 4.0 image generation task via CVSync2Async, poll until complete, and return image URLs / base64 data.

### Example

```ts
import {
  Configuration,
  AIVolcEngineApi,
} from '';
import type { Jimeng4ImageApiV1AiVolcengineJimengImagePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AIVolcEngineApi();

  const body = {
    // Jimeng4ImageRequest
    jimeng4ImageRequest: ...,
  } satisfies Jimeng4ImageApiV1AiVolcengineJimengImagePostRequest;

  try {
    const data = await api.jimeng4ImageApiV1AiVolcengineJimengImagePost(body);
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
| **jimeng4ImageRequest** | [Jimeng4ImageRequest](Jimeng4ImageRequest.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost

> any jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost(jimeng4ProcessRequest)

即梦4.0 CVProcess 通用转发

JiMeng 4.0 CVProcess generic proxy. Forwards the body (with arbitrary extra fields) via CVProcess to Volcengine. Mirrors the original volcengine_visual_proxy.py /jimeng4/process endpoint.

### Example

```ts
import {
  Configuration,
  AIVolcEngineApi,
} from '';
import type { Jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AIVolcEngineApi();

  const body = {
    // Jimeng4ProcessRequest
    jimeng4ProcessRequest: ...,
  } satisfies Jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPostRequest;

  try {
    const data = await api.jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost(body);
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
| **jimeng4ProcessRequest** | [Jimeng4ProcessRequest](Jimeng4ProcessRequest.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## pingApiV1AiVolcenginePingGet

> any pingApiV1AiVolcenginePingGet()

Health check

### Example

```ts
import {
  Configuration,
  AIVolcEngineApi,
} from '';
import type { PingApiV1AiVolcenginePingGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AIVolcEngineApi();

  try {
    const data = await api.pingApiV1AiVolcenginePingGet();
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

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## visualProxyApiV1AiVolcengineVisualReqKeyPost

> any visualProxyApiV1AiVolcengineVisualReqKeyPost(reqKey, visualGenericRequest)

火山视觉通用代理 (CVSync2Async async submit+poll)

Submit a Volcengine visual task (text-to-video, image-to-video, etc.) via CVSync2Async, poll until complete, persist the resulting video, deduct tokens, and return the video URL.  Mirrors the original volcengine_visual_proxy.py /visual/{req_key} endpoint.

### Example

```ts
import {
  Configuration,
  AIVolcEngineApi,
} from '';
import type { VisualProxyApiV1AiVolcengineVisualReqKeyPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AIVolcEngineApi();

  const body = {
    // string
    reqKey: reqKey_example,
    // VisualGenericRequest
    visualGenericRequest: ...,
  } satisfies VisualProxyApiV1AiVolcengineVisualReqKeyPostRequest;

  try {
    const data = await api.visualProxyApiV1AiVolcengineVisualReqKeyPost(body);
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
| **reqKey** | `string` |  | [Defaults to `undefined`] |
| **visualGenericRequest** | [VisualGenericRequest](VisualGenericRequest.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

