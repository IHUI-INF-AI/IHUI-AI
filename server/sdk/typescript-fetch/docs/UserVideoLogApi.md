# UserVideoLogApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**recordWatchApiV1UserVideoLogRecordPost**](UserVideoLogApi.md#recordwatchapiv1uservideologrecordpost) | **POST** /api/v1/user-video-log/record | 记录视频观看 |
| [**recordWatchApiV1UserVideoLogRecordPost_0**](UserVideoLogApi.md#recordwatchapiv1uservideologrecordpost_0) | **POST** /api/v1/user-video-log/record | 记录视频观看 |
| [**statsApiV1UserVideoLogStatsGet**](UserVideoLogApi.md#statsapiv1uservideologstatsget) | **GET** /api/v1/user-video-log/stats | 观看统计 |
| [**statsApiV1UserVideoLogStatsGet_0**](UserVideoLogApi.md#statsapiv1uservideologstatsget_0) | **GET** /api/v1/user-video-log/stats | 观看统计 |
| [**userVideoLogList**](UserVideoLogApi.md#uservideologlist) | **GET** /api/v1/user-video-log/list | 我的观看记录 |
| [**userVideoLogList_0**](UserVideoLogApi.md#uservideologlist_0) | **GET** /api/v1/user-video-log/list | 我的观看记录 |



## recordWatchApiV1UserVideoLogRecordPost

> any recordWatchApiV1UserVideoLogRecordPost(videoId, duration, watched, device, ip, isCompleted, isFinished, videoTitle)

记录视频观看

### Example

```ts
import {
  Configuration,
  UserVideoLogApi,
} from '';
import type { RecordWatchApiV1UserVideoLogRecordPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserVideoLogApi();

  const body = {
    // number
    videoId: 56,
    // number (optional)
    duration: 56,
    // number (optional)
    watched: 56,
    // string (optional)
    device: device_example,
    // string (optional)
    ip: ip_example,
    // boolean (optional)
    isCompleted: true,
    // boolean (optional)
    isFinished: true,
    // string (optional)
    videoTitle: videoTitle_example,
  } satisfies RecordWatchApiV1UserVideoLogRecordPostRequest;

  try {
    const data = await api.recordWatchApiV1UserVideoLogRecordPost(body);
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
| **duration** | `number` |  | [Optional] [Defaults to `0`] |
| **watched** | `number` |  | [Optional] [Defaults to `0`] |
| **device** | `string` |  | [Optional] [Defaults to `undefined`] |
| **ip** | `string` |  | [Optional] [Defaults to `undefined`] |
| **isCompleted** | `boolean` |  | [Optional] [Defaults to `false`] |
| **isFinished** | `boolean` |  | [Optional] [Defaults to `false`] |
| **videoTitle** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## recordWatchApiV1UserVideoLogRecordPost_0

> any recordWatchApiV1UserVideoLogRecordPost_0(videoId, duration, watched, device, ip, isCompleted, isFinished, videoTitle)

记录视频观看

### Example

```ts
import {
  Configuration,
  UserVideoLogApi,
} from '';
import type { RecordWatchApiV1UserVideoLogRecordPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserVideoLogApi();

  const body = {
    // number
    videoId: 56,
    // number (optional)
    duration: 56,
    // number (optional)
    watched: 56,
    // string (optional)
    device: device_example,
    // string (optional)
    ip: ip_example,
    // boolean (optional)
    isCompleted: true,
    // boolean (optional)
    isFinished: true,
    // string (optional)
    videoTitle: videoTitle_example,
  } satisfies RecordWatchApiV1UserVideoLogRecordPost0Request;

  try {
    const data = await api.recordWatchApiV1UserVideoLogRecordPost_0(body);
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
| **duration** | `number` |  | [Optional] [Defaults to `0`] |
| **watched** | `number` |  | [Optional] [Defaults to `0`] |
| **device** | `string` |  | [Optional] [Defaults to `undefined`] |
| **ip** | `string` |  | [Optional] [Defaults to `undefined`] |
| **isCompleted** | `boolean` |  | [Optional] [Defaults to `false`] |
| **isFinished** | `boolean` |  | [Optional] [Defaults to `false`] |
| **videoTitle** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## statsApiV1UserVideoLogStatsGet

> any statsApiV1UserVideoLogStatsGet()

观看统计

### Example

```ts
import {
  Configuration,
  UserVideoLogApi,
} from '';
import type { StatsApiV1UserVideoLogStatsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserVideoLogApi();

  try {
    const data = await api.statsApiV1UserVideoLogStatsGet();
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


## statsApiV1UserVideoLogStatsGet_0

> any statsApiV1UserVideoLogStatsGet_0()

观看统计

### Example

```ts
import {
  Configuration,
  UserVideoLogApi,
} from '';
import type { StatsApiV1UserVideoLogStatsGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserVideoLogApi();

  try {
    const data = await api.statsApiV1UserVideoLogStatsGet_0();
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


## userVideoLogList

> any userVideoLogList(page, limit, videoId, isFinished)

我的观看记录

### Example

```ts
import {
  Configuration,
  UserVideoLogApi,
} from '';
import type { UserVideoLogListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserVideoLogApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    videoId: 56,
    // boolean (optional)
    isFinished: true,
  } satisfies UserVideoLogListRequest;

  try {
    const data = await api.userVideoLogList(body);
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
| **isFinished** | `boolean` |  | [Optional] [Defaults to `undefined`] |

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


## userVideoLogList_0

> any userVideoLogList_0(page, limit, videoId, isFinished)

我的观看记录

### Example

```ts
import {
  Configuration,
  UserVideoLogApi,
} from '';
import type { UserVideoLogList0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserVideoLogApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    videoId: 56,
    // boolean (optional)
    isFinished: true,
  } satisfies UserVideoLogList0Request;

  try {
    const data = await api.userVideoLogList_0(body);
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
| **isFinished** | `boolean` |  | [Optional] [Defaults to `undefined`] |

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

