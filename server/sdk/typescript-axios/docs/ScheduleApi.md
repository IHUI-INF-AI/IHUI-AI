# ScheduleApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createScheduleApiV1SchedulePost**](#createscheduleapiv1schedulepost) | **POST** /api/v1/schedule | 创建日程|
|[**createScheduleApiV1SchedulePost_0**](#createscheduleapiv1schedulepost_0) | **POST** /api/v1/schedule | 创建日程|
|[**deleteScheduleApiV1ScheduleSidDelete**](#deletescheduleapiv1schedulesiddelete) | **DELETE** /api/v1/schedule/{sid} | 删除日程|
|[**deleteScheduleApiV1ScheduleSidDelete_0**](#deletescheduleapiv1schedulesiddelete_0) | **DELETE** /api/v1/schedule/{sid} | 删除日程|
|[**listSchedulesApiV1ScheduleListGet**](#listschedulesapiv1schedulelistget) | **GET** /api/v1/schedule/list | 我的日程|
|[**listSchedulesApiV1ScheduleListGet_0**](#listschedulesapiv1schedulelistget_0) | **GET** /api/v1/schedule/list | 我的日程|
|[**updateScheduleApiV1ScheduleSidPut**](#updatescheduleapiv1schedulesidput) | **PUT** /api/v1/schedule/{sid} | 修改日程|
|[**updateScheduleApiV1ScheduleSidPut_0**](#updatescheduleapiv1schedulesidput_0) | **PUT** /api/v1/schedule/{sid} | 修改日程|

# **createScheduleApiV1SchedulePost**
> any createScheduleApiV1SchedulePost()


### Example

```typescript
import {
    ScheduleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ScheduleApi(configuration);

let title: string; // (default to undefined)
let startTime: string; // (default to undefined)
let description: string; // (optional) (default to undefined)
let endTime: string; // (optional) (default to undefined)
let allDay: boolean; // (optional) (default to false)
let type: string; // (optional) (default to 'personal')
let color: string; // (optional) (default to undefined)
let remindBefore: number; // (optional) (default to 0)
let location: string; // (optional) (default to undefined)
let refId: string; // (optional) (default to undefined)
let refType: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createScheduleApiV1SchedulePost(
    title,
    startTime,
    description,
    endTime,
    allDay,
    type,
    color,
    remindBefore,
    location,
    refId,
    refType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | defaults to undefined|
| **startTime** | [**string**] |  | defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **endTime** | [**string**] |  | (optional) defaults to undefined|
| **allDay** | [**boolean**] |  | (optional) defaults to false|
| **type** | [**string**] |  | (optional) defaults to 'personal'|
| **color** | [**string**] |  | (optional) defaults to undefined|
| **remindBefore** | [**number**] |  | (optional) defaults to 0|
| **location** | [**string**] |  | (optional) defaults to undefined|
| **refId** | [**string**] |  | (optional) defaults to undefined|
| **refType** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createScheduleApiV1SchedulePost_0**
> any createScheduleApiV1SchedulePost_0()


### Example

```typescript
import {
    ScheduleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ScheduleApi(configuration);

let title: string; // (default to undefined)
let startTime: string; // (default to undefined)
let description: string; // (optional) (default to undefined)
let endTime: string; // (optional) (default to undefined)
let allDay: boolean; // (optional) (default to false)
let type: string; // (optional) (default to 'personal')
let color: string; // (optional) (default to undefined)
let remindBefore: number; // (optional) (default to 0)
let location: string; // (optional) (default to undefined)
let refId: string; // (optional) (default to undefined)
let refType: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createScheduleApiV1SchedulePost_0(
    title,
    startTime,
    description,
    endTime,
    allDay,
    type,
    color,
    remindBefore,
    location,
    refId,
    refType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | defaults to undefined|
| **startTime** | [**string**] |  | defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **endTime** | [**string**] |  | (optional) defaults to undefined|
| **allDay** | [**boolean**] |  | (optional) defaults to false|
| **type** | [**string**] |  | (optional) defaults to 'personal'|
| **color** | [**string**] |  | (optional) defaults to undefined|
| **remindBefore** | [**number**] |  | (optional) defaults to 0|
| **location** | [**string**] |  | (optional) defaults to undefined|
| **refId** | [**string**] |  | (optional) defaults to undefined|
| **refType** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteScheduleApiV1ScheduleSidDelete**
> any deleteScheduleApiV1ScheduleSidDelete()


### Example

```typescript
import {
    ScheduleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ScheduleApi(configuration);

let sid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteScheduleApiV1ScheduleSidDelete(
    sid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sid** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteScheduleApiV1ScheduleSidDelete_0**
> any deleteScheduleApiV1ScheduleSidDelete_0()


### Example

```typescript
import {
    ScheduleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ScheduleApi(configuration);

let sid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteScheduleApiV1ScheduleSidDelete_0(
    sid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sid** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listSchedulesApiV1ScheduleListGet**
> any listSchedulesApiV1ScheduleListGet()


### Example

```typescript
import {
    ScheduleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ScheduleApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let type: string; // (optional) (default to undefined)
let startDate: string; // (optional) (default to undefined)
let endDate: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listSchedulesApiV1ScheduleListGet(
    page,
    limit,
    type,
    startDate,
    endDate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **type** | [**string**] |  | (optional) defaults to undefined|
| **startDate** | [**string**] |  | (optional) defaults to undefined|
| **endDate** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listSchedulesApiV1ScheduleListGet_0**
> any listSchedulesApiV1ScheduleListGet_0()


### Example

```typescript
import {
    ScheduleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ScheduleApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let type: string; // (optional) (default to undefined)
let startDate: string; // (optional) (default to undefined)
let endDate: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listSchedulesApiV1ScheduleListGet_0(
    page,
    limit,
    type,
    startDate,
    endDate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **type** | [**string**] |  | (optional) defaults to undefined|
| **startDate** | [**string**] |  | (optional) defaults to undefined|
| **endDate** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateScheduleApiV1ScheduleSidPut**
> any updateScheduleApiV1ScheduleSidPut()


### Example

```typescript
import {
    ScheduleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ScheduleApi(configuration);

let sid: number; // (default to undefined)
let title: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)
let startTime: string; // (optional) (default to undefined)
let endTime: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let color: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateScheduleApiV1ScheduleSidPut(
    sid,
    title,
    description,
    startTime,
    endTime,
    status,
    color
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sid** | [**number**] |  | defaults to undefined|
| **title** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **startTime** | [**string**] |  | (optional) defaults to undefined|
| **endTime** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **color** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateScheduleApiV1ScheduleSidPut_0**
> any updateScheduleApiV1ScheduleSidPut_0()


### Example

```typescript
import {
    ScheduleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ScheduleApi(configuration);

let sid: number; // (default to undefined)
let title: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)
let startTime: string; // (optional) (default to undefined)
let endTime: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let color: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateScheduleApiV1ScheduleSidPut_0(
    sid,
    title,
    description,
    startTime,
    endTime,
    status,
    color
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sid** | [**number**] |  | defaults to undefined|
| **title** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **startTime** | [**string**] |  | (optional) defaults to undefined|
| **endTime** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **color** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

