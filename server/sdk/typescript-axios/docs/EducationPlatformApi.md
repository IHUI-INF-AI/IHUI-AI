# EducationPlatformApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createPlatformApiV1EducationPlatformPost**](#createplatformapiv1educationplatformpost) | **POST** /api/v1/education-platform | 新增教育平台|
|[**createPlatformApiV1EducationPlatformPost_0**](#createplatformapiv1educationplatformpost_0) | **POST** /api/v1/education-platform | 新增教育平台|
|[**deletePlatformApiV1EducationPlatformPidDelete**](#deleteplatformapiv1educationplatformpiddelete) | **DELETE** /api/v1/education-platform/{pid} | 删除教育平台|
|[**deletePlatformApiV1EducationPlatformPidDelete_0**](#deleteplatformapiv1educationplatformpiddelete_0) | **DELETE** /api/v1/education-platform/{pid} | 删除教育平台|
|[**listPlatformsApiV1EducationPlatformListGet**](#listplatformsapiv1educationplatformlistget) | **GET** /api/v1/education-platform/list | 教育平台列表|
|[**listPlatformsApiV1EducationPlatformListGet_0**](#listplatformsapiv1educationplatformlistget_0) | **GET** /api/v1/education-platform/list | 教育平台列表|
|[**syncLogApiV1EducationPlatformSyncLogGet**](#synclogapiv1educationplatformsynclogget) | **GET** /api/v1/education-platform/sync/log | 同步日志|
|[**syncLogApiV1EducationPlatformSyncLogGet_0**](#synclogapiv1educationplatformsynclogget_0) | **GET** /api/v1/education-platform/sync/log | 同步日志|
|[**syncPlatformApiV1EducationPlatformPidSyncPost**](#syncplatformapiv1educationplatformpidsyncpost) | **POST** /api/v1/education-platform/{pid}/sync | 同步数据|
|[**syncPlatformApiV1EducationPlatformPidSyncPost_0**](#syncplatformapiv1educationplatformpidsyncpost_0) | **POST** /api/v1/education-platform/{pid}/sync | 同步数据|
|[**updatePlatformApiV1EducationPlatformPidPut**](#updateplatformapiv1educationplatformpidput) | **PUT** /api/v1/education-platform/{pid} | 修改教育平台|
|[**updatePlatformApiV1EducationPlatformPidPut_0**](#updateplatformapiv1educationplatformpidput_0) | **PUT** /api/v1/education-platform/{pid} | 修改教育平台|

# **createPlatformApiV1EducationPlatformPost**
> any createPlatformApiV1EducationPlatformPost()


### Example

```typescript
import {
    EducationPlatformApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EducationPlatformApi(configuration);

let name: string; // (default to undefined)
let code: string; // (default to undefined)
let type: string; // (optional) (default to 'mooc')
let apiUrl: string; // (optional) (default to undefined)
let apiKey: string; // (optional) (default to undefined)
let apiSecret: string; // (optional) (default to undefined)
let config: string; // (optional) (default to undefined)
let syncUrl: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createPlatformApiV1EducationPlatformPost(
    name,
    code,
    type,
    apiUrl,
    apiKey,
    apiSecret,
    config,
    syncUrl,
    description
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | defaults to undefined|
| **code** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'mooc'|
| **apiUrl** | [**string**] |  | (optional) defaults to undefined|
| **apiKey** | [**string**] |  | (optional) defaults to undefined|
| **apiSecret** | [**string**] |  | (optional) defaults to undefined|
| **config** | [**string**] |  | (optional) defaults to undefined|
| **syncUrl** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|


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

# **createPlatformApiV1EducationPlatformPost_0**
> any createPlatformApiV1EducationPlatformPost_0()


### Example

```typescript
import {
    EducationPlatformApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EducationPlatformApi(configuration);

let name: string; // (default to undefined)
let code: string; // (default to undefined)
let type: string; // (optional) (default to 'mooc')
let apiUrl: string; // (optional) (default to undefined)
let apiKey: string; // (optional) (default to undefined)
let apiSecret: string; // (optional) (default to undefined)
let config: string; // (optional) (default to undefined)
let syncUrl: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createPlatformApiV1EducationPlatformPost_0(
    name,
    code,
    type,
    apiUrl,
    apiKey,
    apiSecret,
    config,
    syncUrl,
    description
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | defaults to undefined|
| **code** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'mooc'|
| **apiUrl** | [**string**] |  | (optional) defaults to undefined|
| **apiKey** | [**string**] |  | (optional) defaults to undefined|
| **apiSecret** | [**string**] |  | (optional) defaults to undefined|
| **config** | [**string**] |  | (optional) defaults to undefined|
| **syncUrl** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|


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

# **deletePlatformApiV1EducationPlatformPidDelete**
> any deletePlatformApiV1EducationPlatformPidDelete()


### Example

```typescript
import {
    EducationPlatformApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EducationPlatformApi(configuration);

let pid: number; // (default to undefined)

const { status, data } = await apiInstance.deletePlatformApiV1EducationPlatformPidDelete(
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

# **deletePlatformApiV1EducationPlatformPidDelete_0**
> any deletePlatformApiV1EducationPlatformPidDelete_0()


### Example

```typescript
import {
    EducationPlatformApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EducationPlatformApi(configuration);

let pid: number; // (default to undefined)

const { status, data } = await apiInstance.deletePlatformApiV1EducationPlatformPidDelete_0(
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

# **listPlatformsApiV1EducationPlatformListGet**
> any listPlatformsApiV1EducationPlatformListGet()


### Example

```typescript
import {
    EducationPlatformApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EducationPlatformApi(configuration);

let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listPlatformsApiV1EducationPlatformListGet(
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **status** | [**number**] |  | (optional) defaults to undefined|


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

# **listPlatformsApiV1EducationPlatformListGet_0**
> any listPlatformsApiV1EducationPlatformListGet_0()


### Example

```typescript
import {
    EducationPlatformApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EducationPlatformApi(configuration);

let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listPlatformsApiV1EducationPlatformListGet_0(
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **status** | [**number**] |  | (optional) defaults to undefined|


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

# **syncLogApiV1EducationPlatformSyncLogGet**
> any syncLogApiV1EducationPlatformSyncLogGet()


### Example

```typescript
import {
    EducationPlatformApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EducationPlatformApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let platformCode: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.syncLogApiV1EducationPlatformSyncLogGet(
    page,
    limit,
    platformCode
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **platformCode** | [**string**] |  | (optional) defaults to undefined|


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

# **syncLogApiV1EducationPlatformSyncLogGet_0**
> any syncLogApiV1EducationPlatformSyncLogGet_0()


### Example

```typescript
import {
    EducationPlatformApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EducationPlatformApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let platformCode: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.syncLogApiV1EducationPlatformSyncLogGet_0(
    page,
    limit,
    platformCode
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **platformCode** | [**string**] |  | (optional) defaults to undefined|


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

# **syncPlatformApiV1EducationPlatformPidSyncPost**
> any syncPlatformApiV1EducationPlatformPidSyncPost()


### Example

```typescript
import {
    EducationPlatformApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EducationPlatformApi(configuration);

let pid: number; // (default to undefined)
let type: string; // (optional) (default to 'course')
let syncType: string; // (optional) (default to 'pull')

const { status, data } = await apiInstance.syncPlatformApiV1EducationPlatformPidSyncPost(
    pid,
    type,
    syncType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'course'|
| **syncType** | [**string**] |  | (optional) defaults to 'pull'|


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

# **syncPlatformApiV1EducationPlatformPidSyncPost_0**
> any syncPlatformApiV1EducationPlatformPidSyncPost_0()


### Example

```typescript
import {
    EducationPlatformApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EducationPlatformApi(configuration);

let pid: number; // (default to undefined)
let type: string; // (optional) (default to 'course')
let syncType: string; // (optional) (default to 'pull')

const { status, data } = await apiInstance.syncPlatformApiV1EducationPlatformPidSyncPost_0(
    pid,
    type,
    syncType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'course'|
| **syncType** | [**string**] |  | (optional) defaults to 'pull'|


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

# **updatePlatformApiV1EducationPlatformPidPut**
> any updatePlatformApiV1EducationPlatformPidPut()


### Example

```typescript
import {
    EducationPlatformApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EducationPlatformApi(configuration);

let pid: number; // (default to undefined)
let name: string; // (optional) (default to undefined)
let apiUrl: string; // (optional) (default to undefined)
let apiKey: string; // (optional) (default to undefined)
let apiSecret: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let config: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.updatePlatformApiV1EducationPlatformPidPut(
    pid,
    name,
    apiUrl,
    apiKey,
    apiSecret,
    status,
    config
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **apiUrl** | [**string**] |  | (optional) defaults to undefined|
| **apiKey** | [**string**] |  | (optional) defaults to undefined|
| **apiSecret** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **config** | [**string**] |  | (optional) defaults to undefined|


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

# **updatePlatformApiV1EducationPlatformPidPut_0**
> any updatePlatformApiV1EducationPlatformPidPut_0()


### Example

```typescript
import {
    EducationPlatformApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EducationPlatformApi(configuration);

let pid: number; // (default to undefined)
let name: string; // (optional) (default to undefined)
let apiUrl: string; // (optional) (default to undefined)
let apiKey: string; // (optional) (default to undefined)
let apiSecret: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let config: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.updatePlatformApiV1EducationPlatformPidPut_0(
    pid,
    name,
    apiUrl,
    apiKey,
    apiSecret,
    status,
    config
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **apiUrl** | [**string**] |  | (optional) defaults to undefined|
| **apiKey** | [**string**] |  | (optional) defaults to undefined|
| **apiSecret** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **config** | [**string**] |  | (optional) defaults to undefined|


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

