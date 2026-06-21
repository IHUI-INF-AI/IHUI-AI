# VideoPreloadApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createPreloadApiV1VideoPreloadPost**](VideoPreloadApi.md#createpreloadapiv1videopreloadpost) | **POST** /api/v1/video-preload | 创建预读任务 |
| [**createPreloadApiV1VideoPreloadPost_0**](VideoPreloadApi.md#createpreloadapiv1videopreloadpost_0) | **POST** /api/v1/video-preload | 创建预读任务 |
| [**deletePreloadApiV1VideoPreloadPidDelete**](VideoPreloadApi.md#deletepreloadapiv1videopreloadpiddelete) | **DELETE** /api/v1/video-preload/{pid} | 删除预读任务 |
| [**deletePreloadApiV1VideoPreloadPidDelete_0**](VideoPreloadApi.md#deletepreloadapiv1videopreloadpiddelete_0) | **DELETE** /api/v1/video-preload/{pid} | 删除预读任务 |
| [**listPreloadsApiV1VideoPreloadListGet**](VideoPreloadApi.md#listpreloadsapiv1videopreloadlistget) | **GET** /api/v1/video-preload/list | 我的预读任务 |
| [**listPreloadsApiV1VideoPreloadListGet_0**](VideoPreloadApi.md#listpreloadsapiv1videopreloadlistget_0) | **GET** /api/v1/video-preload/list | 我的预读任务 |
| [**markCompleteApiV1VideoPreloadPidCompletePut**](VideoPreloadApi.md#markcompleteapiv1videopreloadpidcompleteput) | **PUT** /api/v1/video-preload/{pid}/complete | 标记完成 |
| [**markCompleteApiV1VideoPreloadPidCompletePut_0**](VideoPreloadApi.md#markcompleteapiv1videopreloadpidcompleteput_0) | **PUT** /api/v1/video-preload/{pid}/complete | 标记完成 |



## createPreloadApiV1VideoPreloadPost

> any createPreloadApiV1VideoPreloadPost(videoId, startTime, endTime, isChunked, videoUrl)

创建预读任务

### Example

```ts
import {
  Configuration,
  VideoPreloadApi,
} from '';
import type { CreatePreloadApiV1VideoPreloadPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadApi();

  const body = {
    // number
    videoId: 56,
    // number (optional)
    startTime: 56,
    // number (optional)
    endTime: 56,
    // boolean (optional)
    isChunked: true,
    // string (optional)
    videoUrl: videoUrl_example,
  } satisfies CreatePreloadApiV1VideoPreloadPostRequest;

  try {
    const data = await api.createPreloadApiV1VideoPreloadPost(body);
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
| **videoId** | `number` |  | [Defaults to `undefined`] |
| **startTime** | `number` |  | [Optional] [Defaults to `0`] |
| **endTime** | `number` |  | [Optional] [Defaults to `0`] |
| **isChunked** | `boolean` |  | [Optional] [Defaults to `true`] |
| **videoUrl** | `string` |  | [Optional] [Defaults to `undefined`] |

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
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createPreloadApiV1VideoPreloadPost_0

> any createPreloadApiV1VideoPreloadPost_0(videoId, startTime, endTime, isChunked, videoUrl)

创建预读任务

### Example

```ts
import {
  Configuration,
  VideoPreloadApi,
} from '';
import type { CreatePreloadApiV1VideoPreloadPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadApi();

  const body = {
    // number
    videoId: 56,
    // number (optional)
    startTime: 56,
    // number (optional)
    endTime: 56,
    // boolean (optional)
    isChunked: true,
    // string (optional)
    videoUrl: videoUrl_example,
  } satisfies CreatePreloadApiV1VideoPreloadPost0Request;

  try {
    const data = await api.createPreloadApiV1VideoPreloadPost_0(body);
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
| **videoId** | `number` |  | [Defaults to `undefined`] |
| **startTime** | `number` |  | [Optional] [Defaults to `0`] |
| **endTime** | `number` |  | [Optional] [Defaults to `0`] |
| **isChunked** | `boolean` |  | [Optional] [Defaults to `true`] |
| **videoUrl** | `string` |  | [Optional] [Defaults to `undefined`] |

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
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deletePreloadApiV1VideoPreloadPidDelete

> any deletePreloadApiV1VideoPreloadPidDelete(pid)

删除预读任务

### Example

```ts
import {
  Configuration,
  VideoPreloadApi,
} from '';
import type { DeletePreloadApiV1VideoPreloadPidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadApi();

  const body = {
    // number
    pid: 56,
  } satisfies DeletePreloadApiV1VideoPreloadPidDeleteRequest;

  try {
    const data = await api.deletePreloadApiV1VideoPreloadPidDelete(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |

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
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deletePreloadApiV1VideoPreloadPidDelete_0

> any deletePreloadApiV1VideoPreloadPidDelete_0(pid)

删除预读任务

### Example

```ts
import {
  Configuration,
  VideoPreloadApi,
} from '';
import type { DeletePreloadApiV1VideoPreloadPidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadApi();

  const body = {
    // number
    pid: 56,
  } satisfies DeletePreloadApiV1VideoPreloadPidDelete0Request;

  try {
    const data = await api.deletePreloadApiV1VideoPreloadPidDelete_0(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |

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
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listPreloadsApiV1VideoPreloadListGet

> any listPreloadsApiV1VideoPreloadListGet(page, limit, videoId)

我的预读任务

### Example

```ts
import {
  Configuration,
  VideoPreloadApi,
} from '';
import type { ListPreloadsApiV1VideoPreloadListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    videoId: 56,
  } satisfies ListPreloadsApiV1VideoPreloadListGetRequest;

  try {
    const data = await api.listPreloadsApiV1VideoPreloadListGet(body);
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
| **videoId** | `number` |  | [Optional] [Defaults to `undefined`] |

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
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listPreloadsApiV1VideoPreloadListGet_0

> any listPreloadsApiV1VideoPreloadListGet_0(page, limit, videoId)

我的预读任务

### Example

```ts
import {
  Configuration,
  VideoPreloadApi,
} from '';
import type { ListPreloadsApiV1VideoPreloadListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    videoId: 56,
  } satisfies ListPreloadsApiV1VideoPreloadListGet0Request;

  try {
    const data = await api.listPreloadsApiV1VideoPreloadListGet_0(body);
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
| **videoId** | `number` |  | [Optional] [Defaults to `undefined`] |

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
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## markCompleteApiV1VideoPreloadPidCompletePut

> any markCompleteApiV1VideoPreloadPidCompletePut(pid)

标记完成

### Example

```ts
import {
  Configuration,
  VideoPreloadApi,
} from '';
import type { MarkCompleteApiV1VideoPreloadPidCompletePutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadApi();

  const body = {
    // number
    pid: 56,
  } satisfies MarkCompleteApiV1VideoPreloadPidCompletePutRequest;

  try {
    const data = await api.markCompleteApiV1VideoPreloadPidCompletePut(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |

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
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## markCompleteApiV1VideoPreloadPidCompletePut_0

> any markCompleteApiV1VideoPreloadPidCompletePut_0(pid)

标记完成

### Example

```ts
import {
  Configuration,
  VideoPreloadApi,
} from '';
import type { MarkCompleteApiV1VideoPreloadPidCompletePut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VideoPreloadApi();

  const body = {
    // number
    pid: 56,
  } satisfies MarkCompleteApiV1VideoPreloadPidCompletePut0Request;

  try {
    const data = await api.markCompleteApiV1VideoPreloadPidCompletePut_0(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |

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
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

