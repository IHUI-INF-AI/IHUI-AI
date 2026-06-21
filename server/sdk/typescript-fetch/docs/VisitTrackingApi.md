# VisitTrackingApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**logListApiV1VisitLogListGet**](VisitTrackingApi.md#loglistapiv1visitloglistget) | **GET** /api/v1/visit/log/list | 访问日志 |
| [**logListApiV1VisitLogListGet_0**](VisitTrackingApi.md#loglistapiv1visitloglistget_0) | **GET** /api/v1/visit/log/list | 访问日志 |
| [**pageStatsApiV1VisitStatsPageGet**](VisitTrackingApi.md#pagestatsapiv1visitstatspageget) | **GET** /api/v1/visit/stats/page | 页面统计 |
| [**pageStatsApiV1VisitStatsPageGet_0**](VisitTrackingApi.md#pagestatsapiv1visitstatspageget_0) | **GET** /api/v1/visit/stats/page | 页面统计 |
| [**recordPageApiV1VisitPageRecordPost**](VisitTrackingApi.md#recordpageapiv1visitpagerecordpost) | **POST** /api/v1/visit/page/record | 记录页面访问 |
| [**recordPageApiV1VisitPageRecordPost_0**](VisitTrackingApi.md#recordpageapiv1visitpagerecordpost_0) | **POST** /api/v1/visit/page/record | 记录页面访问 |
| [**recordSourceApiV1VisitSourceRecordPost**](VisitTrackingApi.md#recordsourceapiv1visitsourcerecordpost) | **POST** /api/v1/visit/source/record | 记录来源 |
| [**recordSourceApiV1VisitSourceRecordPost_0**](VisitTrackingApi.md#recordsourceapiv1visitsourcerecordpost_0) | **POST** /api/v1/visit/source/record | 记录来源 |
| [**sourceStatsApiV1VisitStatsSourceGet**](VisitTrackingApi.md#sourcestatsapiv1visitstatssourceget) | **GET** /api/v1/visit/stats/source | 来源统计 |
| [**sourceStatsApiV1VisitStatsSourceGet_0**](VisitTrackingApi.md#sourcestatsapiv1visitstatssourceget_0) | **GET** /api/v1/visit/stats/source | 来源统计 |
| [**todayStatsApiV1VisitStatsTodayGet**](VisitTrackingApi.md#todaystatsapiv1visitstatstodayget) | **GET** /api/v1/visit/stats/today | 今日实时统计 |
| [**todayStatsApiV1VisitStatsTodayGet_0**](VisitTrackingApi.md#todaystatsapiv1visitstatstodayget_0) | **GET** /api/v1/visit/stats/today | 今日实时统计 |
| [**trackApiV1VisitTrackPost**](VisitTrackingApi.md#trackapiv1visittrackpost) | **POST** /api/v1/visit/track | 记录访问 |
| [**trackApiV1VisitTrackPost_0**](VisitTrackingApi.md#trackapiv1visittrackpost_0) | **POST** /api/v1/visit/track | 记录访问 |
| [**visitDailyStats**](VisitTrackingApi.md#visitdailystats) | **GET** /api/v1/visit/stats/daily | 每日访问统计 |
| [**visitDailyStats_0**](VisitTrackingApi.md#visitdailystats_0) | **GET** /api/v1/visit/stats/daily | 每日访问统计 |



## logListApiV1VisitLogListGet

> any logListApiV1VisitLogListGet(page, limit, userId, path, targetType, startDate, endDate)

访问日志

### Example

```ts
import {
  Configuration,
  VisitTrackingApi,
} from '';
import type { LogListApiV1VisitLogListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VisitTrackingApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    userId: userId_example,
    // string (optional)
    path: path_example,
    // string (optional)
    targetType: targetType_example,
    // string (optional)
    startDate: startDate_example,
    // string (optional)
    endDate: endDate_example,
  } satisfies LogListApiV1VisitLogListGetRequest;

  try {
    const data = await api.logListApiV1VisitLogListGet(body);
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
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **path** | `string` |  | [Optional] [Defaults to `undefined`] |
| **targetType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **startDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **endDate** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## logListApiV1VisitLogListGet_0

> any logListApiV1VisitLogListGet_0(page, limit, userId, path, targetType, startDate, endDate)

访问日志

### Example

```ts
import {
  Configuration,
  VisitTrackingApi,
} from '';
import type { LogListApiV1VisitLogListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VisitTrackingApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    userId: userId_example,
    // string (optional)
    path: path_example,
    // string (optional)
    targetType: targetType_example,
    // string (optional)
    startDate: startDate_example,
    // string (optional)
    endDate: endDate_example,
  } satisfies LogListApiV1VisitLogListGet0Request;

  try {
    const data = await api.logListApiV1VisitLogListGet_0(body);
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
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **path** | `string` |  | [Optional] [Defaults to `undefined`] |
| **targetType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **startDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **endDate** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## pageStatsApiV1VisitStatsPageGet

> any pageStatsApiV1VisitStatsPageGet(startDate, endDate, limit)

页面统计

### Example

```ts
import {
  Configuration,
  VisitTrackingApi,
} from '';
import type { PageStatsApiV1VisitStatsPageGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VisitTrackingApi();

  const body = {
    // string (optional)
    startDate: startDate_example,
    // string (optional)
    endDate: endDate_example,
    // number (optional)
    limit: 56,
  } satisfies PageStatsApiV1VisitStatsPageGetRequest;

  try {
    const data = await api.pageStatsApiV1VisitStatsPageGet(body);
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
| **startDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **endDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **limit** | `number` |  | [Optional] [Defaults to `50`] |

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


## pageStatsApiV1VisitStatsPageGet_0

> any pageStatsApiV1VisitStatsPageGet_0(startDate, endDate, limit)

页面统计

### Example

```ts
import {
  Configuration,
  VisitTrackingApi,
} from '';
import type { PageStatsApiV1VisitStatsPageGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VisitTrackingApi();

  const body = {
    // string (optional)
    startDate: startDate_example,
    // string (optional)
    endDate: endDate_example,
    // number (optional)
    limit: 56,
  } satisfies PageStatsApiV1VisitStatsPageGet0Request;

  try {
    const data = await api.pageStatsApiV1VisitStatsPageGet_0(body);
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
| **startDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **endDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **limit** | `number` |  | [Optional] [Defaults to `50`] |

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


## recordPageApiV1VisitPageRecordPost

> any recordPageApiV1VisitPageRecordPost(path, statDate, duration)

记录页面访问

### Example

```ts
import {
  Configuration,
  VisitTrackingApi,
} from '';
import type { RecordPageApiV1VisitPageRecordPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VisitTrackingApi();

  const body = {
    // string
    path: path_example,
    // string (optional)
    statDate: statDate_example,
    // number (optional)
    duration: 56,
  } satisfies RecordPageApiV1VisitPageRecordPostRequest;

  try {
    const data = await api.recordPageApiV1VisitPageRecordPost(body);
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
| **path** | `string` |  | [Defaults to `undefined`] |
| **statDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **duration** | `number` |  | [Optional] [Defaults to `0`] |

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


## recordPageApiV1VisitPageRecordPost_0

> any recordPageApiV1VisitPageRecordPost_0(path, statDate, duration)

记录页面访问

### Example

```ts
import {
  Configuration,
  VisitTrackingApi,
} from '';
import type { RecordPageApiV1VisitPageRecordPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VisitTrackingApi();

  const body = {
    // string
    path: path_example,
    // string (optional)
    statDate: statDate_example,
    // number (optional)
    duration: 56,
  } satisfies RecordPageApiV1VisitPageRecordPost0Request;

  try {
    const data = await api.recordPageApiV1VisitPageRecordPost_0(body);
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
| **path** | `string` |  | [Defaults to `undefined`] |
| **statDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **duration** | `number` |  | [Optional] [Defaults to `0`] |

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


## recordSourceApiV1VisitSourceRecordPost

> any recordSourceApiV1VisitSourceRecordPost(source, statDate)

记录来源

### Example

```ts
import {
  Configuration,
  VisitTrackingApi,
} from '';
import type { RecordSourceApiV1VisitSourceRecordPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VisitTrackingApi();

  const body = {
    // string
    source: source_example,
    // string (optional)
    statDate: statDate_example,
  } satisfies RecordSourceApiV1VisitSourceRecordPostRequest;

  try {
    const data = await api.recordSourceApiV1VisitSourceRecordPost(body);
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
| **source** | `string` |  | [Defaults to `undefined`] |
| **statDate** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## recordSourceApiV1VisitSourceRecordPost_0

> any recordSourceApiV1VisitSourceRecordPost_0(source, statDate)

记录来源

### Example

```ts
import {
  Configuration,
  VisitTrackingApi,
} from '';
import type { RecordSourceApiV1VisitSourceRecordPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VisitTrackingApi();

  const body = {
    // string
    source: source_example,
    // string (optional)
    statDate: statDate_example,
  } satisfies RecordSourceApiV1VisitSourceRecordPost0Request;

  try {
    const data = await api.recordSourceApiV1VisitSourceRecordPost_0(body);
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
| **source** | `string` |  | [Defaults to `undefined`] |
| **statDate** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## sourceStatsApiV1VisitStatsSourceGet

> any sourceStatsApiV1VisitStatsSourceGet(startDate, endDate)

来源统计

### Example

```ts
import {
  Configuration,
  VisitTrackingApi,
} from '';
import type { SourceStatsApiV1VisitStatsSourceGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VisitTrackingApi();

  const body = {
    // string (optional)
    startDate: startDate_example,
    // string (optional)
    endDate: endDate_example,
  } satisfies SourceStatsApiV1VisitStatsSourceGetRequest;

  try {
    const data = await api.sourceStatsApiV1VisitStatsSourceGet(body);
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
| **startDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **endDate** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## sourceStatsApiV1VisitStatsSourceGet_0

> any sourceStatsApiV1VisitStatsSourceGet_0(startDate, endDate)

来源统计

### Example

```ts
import {
  Configuration,
  VisitTrackingApi,
} from '';
import type { SourceStatsApiV1VisitStatsSourceGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VisitTrackingApi();

  const body = {
    // string (optional)
    startDate: startDate_example,
    // string (optional)
    endDate: endDate_example,
  } satisfies SourceStatsApiV1VisitStatsSourceGet0Request;

  try {
    const data = await api.sourceStatsApiV1VisitStatsSourceGet_0(body);
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
| **startDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **endDate** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## todayStatsApiV1VisitStatsTodayGet

> any todayStatsApiV1VisitStatsTodayGet()

今日实时统计

### Example

```ts
import {
  Configuration,
  VisitTrackingApi,
} from '';
import type { TodayStatsApiV1VisitStatsTodayGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VisitTrackingApi();

  try {
    const data = await api.todayStatsApiV1VisitStatsTodayGet();
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


## todayStatsApiV1VisitStatsTodayGet_0

> any todayStatsApiV1VisitStatsTodayGet_0()

今日实时统计

### Example

```ts
import {
  Configuration,
  VisitTrackingApi,
} from '';
import type { TodayStatsApiV1VisitStatsTodayGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VisitTrackingApi();

  try {
    const data = await api.todayStatsApiV1VisitStatsTodayGet_0();
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


## trackApiV1VisitTrackPost

> any trackApiV1VisitTrackPost(path, method, queryParams, referer, userAgent, ip, device, os, browser, targetType, targetId, duration, source, sessionId, userId)

记录访问

### Example

```ts
import {
  Configuration,
  VisitTrackingApi,
} from '';
import type { TrackApiV1VisitTrackPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VisitTrackingApi();

  const body = {
    // string
    path: path_example,
    // string (optional)
    method: method_example,
    // string (optional)
    queryParams: queryParams_example,
    // string (optional)
    referer: referer_example,
    // string (optional)
    userAgent: userAgent_example,
    // string (optional)
    ip: ip_example,
    // string (optional)
    device: device_example,
    // string (optional)
    os: os_example,
    // string (optional)
    browser: browser_example,
    // string (optional)
    targetType: targetType_example,
    // string (optional)
    targetId: targetId_example,
    // number (optional)
    duration: 56,
    // string (optional)
    source: source_example,
    // string (optional)
    sessionId: sessionId_example,
    // string (optional)
    userId: userId_example,
  } satisfies TrackApiV1VisitTrackPostRequest;

  try {
    const data = await api.trackApiV1VisitTrackPost(body);
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
| **path** | `string` |  | [Defaults to `undefined`] |
| **method** | `string` |  | [Optional] [Defaults to `undefined`] |
| **queryParams** | `string` |  | [Optional] [Defaults to `undefined`] |
| **referer** | `string` |  | [Optional] [Defaults to `undefined`] |
| **userAgent** | `string` |  | [Optional] [Defaults to `undefined`] |
| **ip** | `string` |  | [Optional] [Defaults to `undefined`] |
| **device** | `string` |  | [Optional] [Defaults to `undefined`] |
| **os** | `string` |  | [Optional] [Defaults to `undefined`] |
| **browser** | `string` |  | [Optional] [Defaults to `undefined`] |
| **targetType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **targetId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **duration** | `number` |  | [Optional] [Defaults to `0`] |
| **source** | `string` |  | [Optional] [Defaults to `undefined`] |
| **sessionId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## trackApiV1VisitTrackPost_0

> any trackApiV1VisitTrackPost_0(path, method, queryParams, referer, userAgent, ip, device, os, browser, targetType, targetId, duration, source, sessionId, userId)

记录访问

### Example

```ts
import {
  Configuration,
  VisitTrackingApi,
} from '';
import type { TrackApiV1VisitTrackPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VisitTrackingApi();

  const body = {
    // string
    path: path_example,
    // string (optional)
    method: method_example,
    // string (optional)
    queryParams: queryParams_example,
    // string (optional)
    referer: referer_example,
    // string (optional)
    userAgent: userAgent_example,
    // string (optional)
    ip: ip_example,
    // string (optional)
    device: device_example,
    // string (optional)
    os: os_example,
    // string (optional)
    browser: browser_example,
    // string (optional)
    targetType: targetType_example,
    // string (optional)
    targetId: targetId_example,
    // number (optional)
    duration: 56,
    // string (optional)
    source: source_example,
    // string (optional)
    sessionId: sessionId_example,
    // string (optional)
    userId: userId_example,
  } satisfies TrackApiV1VisitTrackPost0Request;

  try {
    const data = await api.trackApiV1VisitTrackPost_0(body);
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
| **path** | `string` |  | [Defaults to `undefined`] |
| **method** | `string` |  | [Optional] [Defaults to `undefined`] |
| **queryParams** | `string` |  | [Optional] [Defaults to `undefined`] |
| **referer** | `string` |  | [Optional] [Defaults to `undefined`] |
| **userAgent** | `string` |  | [Optional] [Defaults to `undefined`] |
| **ip** | `string` |  | [Optional] [Defaults to `undefined`] |
| **device** | `string` |  | [Optional] [Defaults to `undefined`] |
| **os** | `string` |  | [Optional] [Defaults to `undefined`] |
| **browser** | `string` |  | [Optional] [Defaults to `undefined`] |
| **targetType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **targetId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **duration** | `number` |  | [Optional] [Defaults to `0`] |
| **source** | `string` |  | [Optional] [Defaults to `undefined`] |
| **sessionId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## visitDailyStats

> any visitDailyStats(startDate, endDate, targetType)

每日访问统计

### Example

```ts
import {
  Configuration,
  VisitTrackingApi,
} from '';
import type { VisitDailyStatsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VisitTrackingApi();

  const body = {
    // string (optional)
    startDate: startDate_example,
    // string (optional)
    endDate: endDate_example,
    // string (optional)
    targetType: targetType_example,
  } satisfies VisitDailyStatsRequest;

  try {
    const data = await api.visitDailyStats(body);
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
| **startDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **endDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **targetType** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## visitDailyStats_0

> any visitDailyStats_0(startDate, endDate, targetType)

每日访问统计

### Example

```ts
import {
  Configuration,
  VisitTrackingApi,
} from '';
import type { VisitDailyStats0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new VisitTrackingApi();

  const body = {
    // string (optional)
    startDate: startDate_example,
    // string (optional)
    endDate: endDate_example,
    // string (optional)
    targetType: targetType_example,
  } satisfies VisitDailyStats0Request;

  try {
    const data = await api.visitDailyStats_0(body);
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
| **startDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **endDate** | `string` |  | [Optional] [Defaults to `undefined`] |
| **targetType** | `string` |  | [Optional] [Defaults to `undefined`] |

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

