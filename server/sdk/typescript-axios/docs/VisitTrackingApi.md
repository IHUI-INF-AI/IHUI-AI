# VisitTrackingApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**logListApiV1VisitLogListGet**](#loglistapiv1visitloglistget) | **GET** /api/v1/visit/log/list | 访问日志|
|[**logListApiV1VisitLogListGet_0**](#loglistapiv1visitloglistget_0) | **GET** /api/v1/visit/log/list | 访问日志|
|[**pageStatsApiV1VisitStatsPageGet**](#pagestatsapiv1visitstatspageget) | **GET** /api/v1/visit/stats/page | 页面统计|
|[**pageStatsApiV1VisitStatsPageGet_0**](#pagestatsapiv1visitstatspageget_0) | **GET** /api/v1/visit/stats/page | 页面统计|
|[**recordPageApiV1VisitPageRecordPost**](#recordpageapiv1visitpagerecordpost) | **POST** /api/v1/visit/page/record | 记录页面访问|
|[**recordPageApiV1VisitPageRecordPost_0**](#recordpageapiv1visitpagerecordpost_0) | **POST** /api/v1/visit/page/record | 记录页面访问|
|[**recordSourceApiV1VisitSourceRecordPost**](#recordsourceapiv1visitsourcerecordpost) | **POST** /api/v1/visit/source/record | 记录来源|
|[**recordSourceApiV1VisitSourceRecordPost_0**](#recordsourceapiv1visitsourcerecordpost_0) | **POST** /api/v1/visit/source/record | 记录来源|
|[**sourceStatsApiV1VisitStatsSourceGet**](#sourcestatsapiv1visitstatssourceget) | **GET** /api/v1/visit/stats/source | 来源统计|
|[**sourceStatsApiV1VisitStatsSourceGet_0**](#sourcestatsapiv1visitstatssourceget_0) | **GET** /api/v1/visit/stats/source | 来源统计|
|[**todayStatsApiV1VisitStatsTodayGet**](#todaystatsapiv1visitstatstodayget) | **GET** /api/v1/visit/stats/today | 今日实时统计|
|[**todayStatsApiV1VisitStatsTodayGet_0**](#todaystatsapiv1visitstatstodayget_0) | **GET** /api/v1/visit/stats/today | 今日实时统计|
|[**trackApiV1VisitTrackPost**](#trackapiv1visittrackpost) | **POST** /api/v1/visit/track | 记录访问|
|[**trackApiV1VisitTrackPost_0**](#trackapiv1visittrackpost_0) | **POST** /api/v1/visit/track | 记录访问|
|[**visitDailyStats**](#visitdailystats) | **GET** /api/v1/visit/stats/daily | 每日访问统计|
|[**visitDailyStats_0**](#visitdailystats_0) | **GET** /api/v1/visit/stats/daily | 每日访问统计|

# **logListApiV1VisitLogListGet**
> any logListApiV1VisitLogListGet()


### Example

```typescript
import {
    VisitTrackingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VisitTrackingApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let userId: string; // (optional) (default to undefined)
let path: string; // (optional) (default to undefined)
let targetType: string; // (optional) (default to undefined)
let startDate: string; // (optional) (default to undefined)
let endDate: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.logListApiV1VisitLogListGet(
    page,
    limit,
    userId,
    path,
    targetType,
    startDate,
    endDate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **path** | [**string**] |  | (optional) defaults to undefined|
| **targetType** | [**string**] |  | (optional) defaults to undefined|
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

# **logListApiV1VisitLogListGet_0**
> any logListApiV1VisitLogListGet_0()


### Example

```typescript
import {
    VisitTrackingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VisitTrackingApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let userId: string; // (optional) (default to undefined)
let path: string; // (optional) (default to undefined)
let targetType: string; // (optional) (default to undefined)
let startDate: string; // (optional) (default to undefined)
let endDate: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.logListApiV1VisitLogListGet_0(
    page,
    limit,
    userId,
    path,
    targetType,
    startDate,
    endDate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **path** | [**string**] |  | (optional) defaults to undefined|
| **targetType** | [**string**] |  | (optional) defaults to undefined|
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

# **pageStatsApiV1VisitStatsPageGet**
> any pageStatsApiV1VisitStatsPageGet()


### Example

```typescript
import {
    VisitTrackingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VisitTrackingApi(configuration);

let startDate: string; // (optional) (default to undefined)
let endDate: string; // (optional) (default to undefined)
let limit: number; // (optional) (default to 50)

const { status, data } = await apiInstance.pageStatsApiV1VisitStatsPageGet(
    startDate,
    endDate,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **startDate** | [**string**] |  | (optional) defaults to undefined|
| **endDate** | [**string**] |  | (optional) defaults to undefined|
| **limit** | [**number**] |  | (optional) defaults to 50|


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

# **pageStatsApiV1VisitStatsPageGet_0**
> any pageStatsApiV1VisitStatsPageGet_0()


### Example

```typescript
import {
    VisitTrackingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VisitTrackingApi(configuration);

let startDate: string; // (optional) (default to undefined)
let endDate: string; // (optional) (default to undefined)
let limit: number; // (optional) (default to 50)

const { status, data } = await apiInstance.pageStatsApiV1VisitStatsPageGet_0(
    startDate,
    endDate,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **startDate** | [**string**] |  | (optional) defaults to undefined|
| **endDate** | [**string**] |  | (optional) defaults to undefined|
| **limit** | [**number**] |  | (optional) defaults to 50|


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

# **recordPageApiV1VisitPageRecordPost**
> any recordPageApiV1VisitPageRecordPost()


### Example

```typescript
import {
    VisitTrackingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VisitTrackingApi(configuration);

let path: string; // (default to undefined)
let statDate: string; // (optional) (default to undefined)
let duration: number; // (optional) (default to 0)

const { status, data } = await apiInstance.recordPageApiV1VisitPageRecordPost(
    path,
    statDate,
    duration
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **path** | [**string**] |  | defaults to undefined|
| **statDate** | [**string**] |  | (optional) defaults to undefined|
| **duration** | [**number**] |  | (optional) defaults to 0|


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

# **recordPageApiV1VisitPageRecordPost_0**
> any recordPageApiV1VisitPageRecordPost_0()


### Example

```typescript
import {
    VisitTrackingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VisitTrackingApi(configuration);

let path: string; // (default to undefined)
let statDate: string; // (optional) (default to undefined)
let duration: number; // (optional) (default to 0)

const { status, data } = await apiInstance.recordPageApiV1VisitPageRecordPost_0(
    path,
    statDate,
    duration
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **path** | [**string**] |  | defaults to undefined|
| **statDate** | [**string**] |  | (optional) defaults to undefined|
| **duration** | [**number**] |  | (optional) defaults to 0|


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

# **recordSourceApiV1VisitSourceRecordPost**
> any recordSourceApiV1VisitSourceRecordPost()


### Example

```typescript
import {
    VisitTrackingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VisitTrackingApi(configuration);

let source: string; // (default to undefined)
let statDate: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.recordSourceApiV1VisitSourceRecordPost(
    source,
    statDate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **source** | [**string**] |  | defaults to undefined|
| **statDate** | [**string**] |  | (optional) defaults to undefined|


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

# **recordSourceApiV1VisitSourceRecordPost_0**
> any recordSourceApiV1VisitSourceRecordPost_0()


### Example

```typescript
import {
    VisitTrackingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VisitTrackingApi(configuration);

let source: string; // (default to undefined)
let statDate: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.recordSourceApiV1VisitSourceRecordPost_0(
    source,
    statDate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **source** | [**string**] |  | defaults to undefined|
| **statDate** | [**string**] |  | (optional) defaults to undefined|


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

# **sourceStatsApiV1VisitStatsSourceGet**
> any sourceStatsApiV1VisitStatsSourceGet()


### Example

```typescript
import {
    VisitTrackingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VisitTrackingApi(configuration);

let startDate: string; // (optional) (default to undefined)
let endDate: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.sourceStatsApiV1VisitStatsSourceGet(
    startDate,
    endDate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
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

# **sourceStatsApiV1VisitStatsSourceGet_0**
> any sourceStatsApiV1VisitStatsSourceGet_0()


### Example

```typescript
import {
    VisitTrackingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VisitTrackingApi(configuration);

let startDate: string; // (optional) (default to undefined)
let endDate: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.sourceStatsApiV1VisitStatsSourceGet_0(
    startDate,
    endDate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
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

# **todayStatsApiV1VisitStatsTodayGet**
> any todayStatsApiV1VisitStatsTodayGet()


### Example

```typescript
import {
    VisitTrackingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VisitTrackingApi(configuration);

const { status, data } = await apiInstance.todayStatsApiV1VisitStatsTodayGet();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **todayStatsApiV1VisitStatsTodayGet_0**
> any todayStatsApiV1VisitStatsTodayGet_0()


### Example

```typescript
import {
    VisitTrackingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VisitTrackingApi(configuration);

const { status, data } = await apiInstance.todayStatsApiV1VisitStatsTodayGet_0();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **trackApiV1VisitTrackPost**
> any trackApiV1VisitTrackPost()


### Example

```typescript
import {
    VisitTrackingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VisitTrackingApi(configuration);

let path: string; // (default to undefined)
let method: string; // (optional) (default to undefined)
let queryParams: string; // (optional) (default to undefined)
let referer: string; // (optional) (default to undefined)
let userAgent: string; // (optional) (default to undefined)
let ip: string; // (optional) (default to undefined)
let device: string; // (optional) (default to undefined)
let os: string; // (optional) (default to undefined)
let browser: string; // (optional) (default to undefined)
let targetType: string; // (optional) (default to undefined)
let targetId: string; // (optional) (default to undefined)
let duration: number; // (optional) (default to 0)
let source: string; // (optional) (default to undefined)
let sessionId: string; // (optional) (default to undefined)
let userId: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.trackApiV1VisitTrackPost(
    path,
    method,
    queryParams,
    referer,
    userAgent,
    ip,
    device,
    os,
    browser,
    targetType,
    targetId,
    duration,
    source,
    sessionId,
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **path** | [**string**] |  | defaults to undefined|
| **method** | [**string**] |  | (optional) defaults to undefined|
| **queryParams** | [**string**] |  | (optional) defaults to undefined|
| **referer** | [**string**] |  | (optional) defaults to undefined|
| **userAgent** | [**string**] |  | (optional) defaults to undefined|
| **ip** | [**string**] |  | (optional) defaults to undefined|
| **device** | [**string**] |  | (optional) defaults to undefined|
| **os** | [**string**] |  | (optional) defaults to undefined|
| **browser** | [**string**] |  | (optional) defaults to undefined|
| **targetType** | [**string**] |  | (optional) defaults to undefined|
| **targetId** | [**string**] |  | (optional) defaults to undefined|
| **duration** | [**number**] |  | (optional) defaults to 0|
| **source** | [**string**] |  | (optional) defaults to undefined|
| **sessionId** | [**string**] |  | (optional) defaults to undefined|
| **userId** | [**string**] |  | (optional) defaults to undefined|


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

# **trackApiV1VisitTrackPost_0**
> any trackApiV1VisitTrackPost_0()


### Example

```typescript
import {
    VisitTrackingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VisitTrackingApi(configuration);

let path: string; // (default to undefined)
let method: string; // (optional) (default to undefined)
let queryParams: string; // (optional) (default to undefined)
let referer: string; // (optional) (default to undefined)
let userAgent: string; // (optional) (default to undefined)
let ip: string; // (optional) (default to undefined)
let device: string; // (optional) (default to undefined)
let os: string; // (optional) (default to undefined)
let browser: string; // (optional) (default to undefined)
let targetType: string; // (optional) (default to undefined)
let targetId: string; // (optional) (default to undefined)
let duration: number; // (optional) (default to 0)
let source: string; // (optional) (default to undefined)
let sessionId: string; // (optional) (default to undefined)
let userId: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.trackApiV1VisitTrackPost_0(
    path,
    method,
    queryParams,
    referer,
    userAgent,
    ip,
    device,
    os,
    browser,
    targetType,
    targetId,
    duration,
    source,
    sessionId,
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **path** | [**string**] |  | defaults to undefined|
| **method** | [**string**] |  | (optional) defaults to undefined|
| **queryParams** | [**string**] |  | (optional) defaults to undefined|
| **referer** | [**string**] |  | (optional) defaults to undefined|
| **userAgent** | [**string**] |  | (optional) defaults to undefined|
| **ip** | [**string**] |  | (optional) defaults to undefined|
| **device** | [**string**] |  | (optional) defaults to undefined|
| **os** | [**string**] |  | (optional) defaults to undefined|
| **browser** | [**string**] |  | (optional) defaults to undefined|
| **targetType** | [**string**] |  | (optional) defaults to undefined|
| **targetId** | [**string**] |  | (optional) defaults to undefined|
| **duration** | [**number**] |  | (optional) defaults to 0|
| **source** | [**string**] |  | (optional) defaults to undefined|
| **sessionId** | [**string**] |  | (optional) defaults to undefined|
| **userId** | [**string**] |  | (optional) defaults to undefined|


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

# **visitDailyStats**
> any visitDailyStats()


### Example

```typescript
import {
    VisitTrackingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VisitTrackingApi(configuration);

let startDate: string; // (optional) (default to undefined)
let endDate: string; // (optional) (default to undefined)
let targetType: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.visitDailyStats(
    startDate,
    endDate,
    targetType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **startDate** | [**string**] |  | (optional) defaults to undefined|
| **endDate** | [**string**] |  | (optional) defaults to undefined|
| **targetType** | [**string**] |  | (optional) defaults to undefined|


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

# **visitDailyStats_0**
> any visitDailyStats_0()


### Example

```typescript
import {
    VisitTrackingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VisitTrackingApi(configuration);

let startDate: string; // (optional) (default to undefined)
let endDate: string; // (optional) (default to undefined)
let targetType: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.visitDailyStats_0(
    startDate,
    endDate,
    targetType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **startDate** | [**string**] |  | (optional) defaults to undefined|
| **endDate** | [**string**] |  | (optional) defaults to undefined|
| **targetType** | [**string**] |  | (optional) defaults to undefined|


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

