# ScheduleApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createScheduleApiV1SchedulePost**](ScheduleApi.md#createscheduleapiv1schedulepost) | **POST** /api/v1/schedule | 创建日程 |
| [**createScheduleApiV1SchedulePost_0**](ScheduleApi.md#createscheduleapiv1schedulepost_0) | **POST** /api/v1/schedule | 创建日程 |
| [**deleteScheduleApiV1ScheduleSidDelete**](ScheduleApi.md#deletescheduleapiv1schedulesiddelete) | **DELETE** /api/v1/schedule/{sid} | 删除日程 |
| [**deleteScheduleApiV1ScheduleSidDelete_0**](ScheduleApi.md#deletescheduleapiv1schedulesiddelete_0) | **DELETE** /api/v1/schedule/{sid} | 删除日程 |
| [**listSchedulesApiV1ScheduleListGet**](ScheduleApi.md#listschedulesapiv1schedulelistget) | **GET** /api/v1/schedule/list | 我的日程 |
| [**listSchedulesApiV1ScheduleListGet_0**](ScheduleApi.md#listschedulesapiv1schedulelistget_0) | **GET** /api/v1/schedule/list | 我的日程 |
| [**updateScheduleApiV1ScheduleSidPut**](ScheduleApi.md#updatescheduleapiv1schedulesidput) | **PUT** /api/v1/schedule/{sid} | 修改日程 |
| [**updateScheduleApiV1ScheduleSidPut_0**](ScheduleApi.md#updatescheduleapiv1schedulesidput_0) | **PUT** /api/v1/schedule/{sid} | 修改日程 |



## createScheduleApiV1SchedulePost

> any createScheduleApiV1SchedulePost(title, startTime, description, endTime, allDay, type, color, remindBefore, location, refId, refType)

创建日程

### Example

```ts
import {
  Configuration,
  ScheduleApi,
} from '';
import type { CreateScheduleApiV1SchedulePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ScheduleApi();

  const body = {
    // string
    title: title_example,
    // Date
    startTime: 2013-10-20T19:20:30+01:00,
    // string (optional)
    description: description_example,
    // Date (optional)
    endTime: 2013-10-20T19:20:30+01:00,
    // boolean (optional)
    allDay: true,
    // string (optional)
    type: type_example,
    // string (optional)
    color: color_example,
    // number (optional)
    remindBefore: 56,
    // string (optional)
    location: location_example,
    // string (optional)
    refId: refId_example,
    // string (optional)
    refType: refType_example,
  } satisfies CreateScheduleApiV1SchedulePostRequest;

  try {
    const data = await api.createScheduleApiV1SchedulePost(body);
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
| **title** | `string` |  | [Defaults to `undefined`] |
| **startTime** | `Date` |  | [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **endTime** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **allDay** | `boolean` |  | [Optional] [Defaults to `false`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;personal&#39;`] |
| **color** | `string` |  | [Optional] [Defaults to `undefined`] |
| **remindBefore** | `number` |  | [Optional] [Defaults to `0`] |
| **location** | `string` |  | [Optional] [Defaults to `undefined`] |
| **refId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **refType** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## createScheduleApiV1SchedulePost_0

> any createScheduleApiV1SchedulePost_0(title, startTime, description, endTime, allDay, type, color, remindBefore, location, refId, refType)

创建日程

### Example

```ts
import {
  Configuration,
  ScheduleApi,
} from '';
import type { CreateScheduleApiV1SchedulePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ScheduleApi();

  const body = {
    // string
    title: title_example,
    // Date
    startTime: 2013-10-20T19:20:30+01:00,
    // string (optional)
    description: description_example,
    // Date (optional)
    endTime: 2013-10-20T19:20:30+01:00,
    // boolean (optional)
    allDay: true,
    // string (optional)
    type: type_example,
    // string (optional)
    color: color_example,
    // number (optional)
    remindBefore: 56,
    // string (optional)
    location: location_example,
    // string (optional)
    refId: refId_example,
    // string (optional)
    refType: refType_example,
  } satisfies CreateScheduleApiV1SchedulePost0Request;

  try {
    const data = await api.createScheduleApiV1SchedulePost_0(body);
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
| **title** | `string` |  | [Defaults to `undefined`] |
| **startTime** | `Date` |  | [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **endTime** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **allDay** | `boolean` |  | [Optional] [Defaults to `false`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;personal&#39;`] |
| **color** | `string` |  | [Optional] [Defaults to `undefined`] |
| **remindBefore** | `number` |  | [Optional] [Defaults to `0`] |
| **location** | `string` |  | [Optional] [Defaults to `undefined`] |
| **refId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **refType** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## deleteScheduleApiV1ScheduleSidDelete

> any deleteScheduleApiV1ScheduleSidDelete(sid)

删除日程

### Example

```ts
import {
  Configuration,
  ScheduleApi,
} from '';
import type { DeleteScheduleApiV1ScheduleSidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ScheduleApi();

  const body = {
    // number
    sid: 56,
  } satisfies DeleteScheduleApiV1ScheduleSidDeleteRequest;

  try {
    const data = await api.deleteScheduleApiV1ScheduleSidDelete(body);
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
| **sid** | `number` |  | [Defaults to `undefined`] |

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


## deleteScheduleApiV1ScheduleSidDelete_0

> any deleteScheduleApiV1ScheduleSidDelete_0(sid)

删除日程

### Example

```ts
import {
  Configuration,
  ScheduleApi,
} from '';
import type { DeleteScheduleApiV1ScheduleSidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ScheduleApi();

  const body = {
    // number
    sid: 56,
  } satisfies DeleteScheduleApiV1ScheduleSidDelete0Request;

  try {
    const data = await api.deleteScheduleApiV1ScheduleSidDelete_0(body);
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
| **sid** | `number` |  | [Defaults to `undefined`] |

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


## listSchedulesApiV1ScheduleListGet

> any listSchedulesApiV1ScheduleListGet(page, limit, type, startDate, endDate)

我的日程

### Example

```ts
import {
  Configuration,
  ScheduleApi,
} from '';
import type { ListSchedulesApiV1ScheduleListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ScheduleApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    type: type_example,
    // string (optional)
    startDate: startDate_example,
    // string (optional)
    endDate: endDate_example,
  } satisfies ListSchedulesApiV1ScheduleListGetRequest;

  try {
    const data = await api.listSchedulesApiV1ScheduleListGet(body);
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
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## listSchedulesApiV1ScheduleListGet_0

> any listSchedulesApiV1ScheduleListGet_0(page, limit, type, startDate, endDate)

我的日程

### Example

```ts
import {
  Configuration,
  ScheduleApi,
} from '';
import type { ListSchedulesApiV1ScheduleListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ScheduleApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    type: type_example,
    // string (optional)
    startDate: startDate_example,
    // string (optional)
    endDate: endDate_example,
  } satisfies ListSchedulesApiV1ScheduleListGet0Request;

  try {
    const data = await api.listSchedulesApiV1ScheduleListGet_0(body);
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
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## updateScheduleApiV1ScheduleSidPut

> any updateScheduleApiV1ScheduleSidPut(sid, title, description, startTime, endTime, status, color)

修改日程

### Example

```ts
import {
  Configuration,
  ScheduleApi,
} from '';
import type { UpdateScheduleApiV1ScheduleSidPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ScheduleApi();

  const body = {
    // number
    sid: 56,
    // string (optional)
    title: title_example,
    // string (optional)
    description: description_example,
    // Date (optional)
    startTime: 2013-10-20T19:20:30+01:00,
    // Date (optional)
    endTime: 2013-10-20T19:20:30+01:00,
    // number (optional)
    status: 56,
    // string (optional)
    color: color_example,
  } satisfies UpdateScheduleApiV1ScheduleSidPutRequest;

  try {
    const data = await api.updateScheduleApiV1ScheduleSidPut(body);
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
| **sid** | `number` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **startTime** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **endTime** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **color** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## updateScheduleApiV1ScheduleSidPut_0

> any updateScheduleApiV1ScheduleSidPut_0(sid, title, description, startTime, endTime, status, color)

修改日程

### Example

```ts
import {
  Configuration,
  ScheduleApi,
} from '';
import type { UpdateScheduleApiV1ScheduleSidPut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ScheduleApi();

  const body = {
    // number
    sid: 56,
    // string (optional)
    title: title_example,
    // string (optional)
    description: description_example,
    // Date (optional)
    startTime: 2013-10-20T19:20:30+01:00,
    // Date (optional)
    endTime: 2013-10-20T19:20:30+01:00,
    // number (optional)
    status: 56,
    // string (optional)
    color: color_example,
  } satisfies UpdateScheduleApiV1ScheduleSidPut0Request;

  try {
    const data = await api.updateScheduleApiV1ScheduleSidPut_0(body);
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
| **sid** | `number` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **startTime** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **endTime** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **color** | `string` |  | [Optional] [Defaults to `undefined`] |

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

