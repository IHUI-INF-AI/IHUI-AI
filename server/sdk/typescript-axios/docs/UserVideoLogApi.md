# UserVideoLogApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**recordWatchApiV1UserVideoLogRecordPost**](#recordwatchapiv1uservideologrecordpost) | **POST** /api/v1/user-video-log/record | 记录视频观看|
|[**recordWatchApiV1UserVideoLogRecordPost_0**](#recordwatchapiv1uservideologrecordpost_0) | **POST** /api/v1/user-video-log/record | 记录视频观看|
|[**statsApiV1UserVideoLogStatsGet**](#statsapiv1uservideologstatsget) | **GET** /api/v1/user-video-log/stats | 观看统计|
|[**statsApiV1UserVideoLogStatsGet_0**](#statsapiv1uservideologstatsget_0) | **GET** /api/v1/user-video-log/stats | 观看统计|
|[**userVideoLogList**](#uservideologlist) | **GET** /api/v1/user-video-log/list | 我的观看记录|
|[**userVideoLogList_0**](#uservideologlist_0) | **GET** /api/v1/user-video-log/list | 我的观看记录|

# **recordWatchApiV1UserVideoLogRecordPost**
> any recordWatchApiV1UserVideoLogRecordPost()


### Example

```typescript
import {
    UserVideoLogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserVideoLogApi(configuration);

let videoId: number; // (default to undefined)
let duration: number; // (optional) (default to 0)
let watched: number; // (optional) (default to 0)
let device: string; // (optional) (default to undefined)
let ip: string; // (optional) (default to undefined)
let isCompleted: boolean; // (optional) (default to false)
let isFinished: boolean; // (optional) (default to false)
let videoTitle: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.recordWatchApiV1UserVideoLogRecordPost(
    videoId,
    duration,
    watched,
    device,
    ip,
    isCompleted,
    isFinished,
    videoTitle
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoId** | [**number**] |  | defaults to undefined|
| **duration** | [**number**] |  | (optional) defaults to 0|
| **watched** | [**number**] |  | (optional) defaults to 0|
| **device** | [**string**] |  | (optional) defaults to undefined|
| **ip** | [**string**] |  | (optional) defaults to undefined|
| **isCompleted** | [**boolean**] |  | (optional) defaults to false|
| **isFinished** | [**boolean**] |  | (optional) defaults to false|
| **videoTitle** | [**string**] |  | (optional) defaults to undefined|


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

# **recordWatchApiV1UserVideoLogRecordPost_0**
> any recordWatchApiV1UserVideoLogRecordPost_0()


### Example

```typescript
import {
    UserVideoLogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserVideoLogApi(configuration);

let videoId: number; // (default to undefined)
let duration: number; // (optional) (default to 0)
let watched: number; // (optional) (default to 0)
let device: string; // (optional) (default to undefined)
let ip: string; // (optional) (default to undefined)
let isCompleted: boolean; // (optional) (default to false)
let isFinished: boolean; // (optional) (default to false)
let videoTitle: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.recordWatchApiV1UserVideoLogRecordPost_0(
    videoId,
    duration,
    watched,
    device,
    ip,
    isCompleted,
    isFinished,
    videoTitle
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoId** | [**number**] |  | defaults to undefined|
| **duration** | [**number**] |  | (optional) defaults to 0|
| **watched** | [**number**] |  | (optional) defaults to 0|
| **device** | [**string**] |  | (optional) defaults to undefined|
| **ip** | [**string**] |  | (optional) defaults to undefined|
| **isCompleted** | [**boolean**] |  | (optional) defaults to false|
| **isFinished** | [**boolean**] |  | (optional) defaults to false|
| **videoTitle** | [**string**] |  | (optional) defaults to undefined|


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

# **statsApiV1UserVideoLogStatsGet**
> any statsApiV1UserVideoLogStatsGet()


### Example

```typescript
import {
    UserVideoLogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserVideoLogApi(configuration);

const { status, data } = await apiInstance.statsApiV1UserVideoLogStatsGet();
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

# **statsApiV1UserVideoLogStatsGet_0**
> any statsApiV1UserVideoLogStatsGet_0()


### Example

```typescript
import {
    UserVideoLogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserVideoLogApi(configuration);

const { status, data } = await apiInstance.statsApiV1UserVideoLogStatsGet_0();
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

# **userVideoLogList**
> any userVideoLogList()


### Example

```typescript
import {
    UserVideoLogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserVideoLogApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let videoId: number; // (optional) (default to undefined)
let isFinished: boolean; // (optional) (default to undefined)

const { status, data } = await apiInstance.userVideoLogList(
    page,
    limit,
    videoId,
    isFinished
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **videoId** | [**number**] |  | (optional) defaults to undefined|
| **isFinished** | [**boolean**] |  | (optional) defaults to undefined|


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

# **userVideoLogList_0**
> any userVideoLogList_0()


### Example

```typescript
import {
    UserVideoLogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserVideoLogApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let videoId: number; // (optional) (default to undefined)
let isFinished: boolean; // (optional) (default to undefined)

const { status, data } = await apiInstance.userVideoLogList_0(
    page,
    limit,
    videoId,
    isFinished
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **videoId** | [**number**] |  | (optional) defaults to undefined|
| **isFinished** | [**boolean**] |  | (optional) defaults to undefined|


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

