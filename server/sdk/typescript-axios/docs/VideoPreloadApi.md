# VideoPreloadApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createPreloadApiV1VideoPreloadPost**](#createpreloadapiv1videopreloadpost) | **POST** /api/v1/video-preload | 创建预读任务|
|[**createPreloadApiV1VideoPreloadPost_0**](#createpreloadapiv1videopreloadpost_0) | **POST** /api/v1/video-preload | 创建预读任务|
|[**deletePreloadApiV1VideoPreloadPidDelete**](#deletepreloadapiv1videopreloadpiddelete) | **DELETE** /api/v1/video-preload/{pid} | 删除预读任务|
|[**deletePreloadApiV1VideoPreloadPidDelete_0**](#deletepreloadapiv1videopreloadpiddelete_0) | **DELETE** /api/v1/video-preload/{pid} | 删除预读任务|
|[**listPreloadsApiV1VideoPreloadListGet**](#listpreloadsapiv1videopreloadlistget) | **GET** /api/v1/video-preload/list | 我的预读任务|
|[**listPreloadsApiV1VideoPreloadListGet_0**](#listpreloadsapiv1videopreloadlistget_0) | **GET** /api/v1/video-preload/list | 我的预读任务|
|[**markCompleteApiV1VideoPreloadPidCompletePut**](#markcompleteapiv1videopreloadpidcompleteput) | **PUT** /api/v1/video-preload/{pid}/complete | 标记完成|
|[**markCompleteApiV1VideoPreloadPidCompletePut_0**](#markcompleteapiv1videopreloadpidcompleteput_0) | **PUT** /api/v1/video-preload/{pid}/complete | 标记完成|

# **createPreloadApiV1VideoPreloadPost**
> any createPreloadApiV1VideoPreloadPost()


### Example

```typescript
import {
    VideoPreloadApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadApi(configuration);

let videoId: number; // (default to undefined)
let startTime: number; // (optional) (default to 0)
let endTime: number; // (optional) (default to 0)
let isChunked: boolean; // (optional) (default to true)
let videoUrl: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createPreloadApiV1VideoPreloadPost(
    videoId,
    startTime,
    endTime,
    isChunked,
    videoUrl
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoId** | [**number**] |  | defaults to undefined|
| **startTime** | [**number**] |  | (optional) defaults to 0|
| **endTime** | [**number**] |  | (optional) defaults to 0|
| **isChunked** | [**boolean**] |  | (optional) defaults to true|
| **videoUrl** | [**string**] |  | (optional) defaults to undefined|


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

# **createPreloadApiV1VideoPreloadPost_0**
> any createPreloadApiV1VideoPreloadPost_0()


### Example

```typescript
import {
    VideoPreloadApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadApi(configuration);

let videoId: number; // (default to undefined)
let startTime: number; // (optional) (default to 0)
let endTime: number; // (optional) (default to 0)
let isChunked: boolean; // (optional) (default to true)
let videoUrl: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createPreloadApiV1VideoPreloadPost_0(
    videoId,
    startTime,
    endTime,
    isChunked,
    videoUrl
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoId** | [**number**] |  | defaults to undefined|
| **startTime** | [**number**] |  | (optional) defaults to 0|
| **endTime** | [**number**] |  | (optional) defaults to 0|
| **isChunked** | [**boolean**] |  | (optional) defaults to true|
| **videoUrl** | [**string**] |  | (optional) defaults to undefined|


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

# **deletePreloadApiV1VideoPreloadPidDelete**
> any deletePreloadApiV1VideoPreloadPidDelete()


### Example

```typescript
import {
    VideoPreloadApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadApi(configuration);

let pid: number; // (default to undefined)

const { status, data } = await apiInstance.deletePreloadApiV1VideoPreloadPidDelete(
    pid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|


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

# **deletePreloadApiV1VideoPreloadPidDelete_0**
> any deletePreloadApiV1VideoPreloadPidDelete_0()


### Example

```typescript
import {
    VideoPreloadApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadApi(configuration);

let pid: number; // (default to undefined)

const { status, data } = await apiInstance.deletePreloadApiV1VideoPreloadPidDelete_0(
    pid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|


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

# **listPreloadsApiV1VideoPreloadListGet**
> any listPreloadsApiV1VideoPreloadListGet()


### Example

```typescript
import {
    VideoPreloadApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let videoId: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listPreloadsApiV1VideoPreloadListGet(
    page,
    limit,
    videoId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **videoId** | [**number**] |  | (optional) defaults to undefined|


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

# **listPreloadsApiV1VideoPreloadListGet_0**
> any listPreloadsApiV1VideoPreloadListGet_0()


### Example

```typescript
import {
    VideoPreloadApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let videoId: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listPreloadsApiV1VideoPreloadListGet_0(
    page,
    limit,
    videoId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **videoId** | [**number**] |  | (optional) defaults to undefined|


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

# **markCompleteApiV1VideoPreloadPidCompletePut**
> any markCompleteApiV1VideoPreloadPidCompletePut()


### Example

```typescript
import {
    VideoPreloadApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadApi(configuration);

let pid: number; // (default to undefined)

const { status, data } = await apiInstance.markCompleteApiV1VideoPreloadPidCompletePut(
    pid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|


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

# **markCompleteApiV1VideoPreloadPidCompletePut_0**
> any markCompleteApiV1VideoPreloadPidCompletePut_0()


### Example

```typescript
import {
    VideoPreloadApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VideoPreloadApi(configuration);

let pid: number; // (default to undefined)

const { status, data } = await apiInstance.markCompleteApiV1VideoPreloadPidCompletePut_0(
    pid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|


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

