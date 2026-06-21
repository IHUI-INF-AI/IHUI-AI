# AppVersionApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**checkUpdateApiV1AppVersionCheckGet**](#checkupdateapiv1appversioncheckget) | **GET** /api/v1/app-version/check | 检查更新|
|[**checkUpdateApiV1AppVersionCheckGet_0**](#checkupdateapiv1appversioncheckget_0) | **GET** /api/v1/app-version/check | 检查更新|
|[**createVersionApiV1AppVersionPost**](#createversionapiv1appversionpost) | **POST** /api/v1/app-version | 新增版本|
|[**createVersionApiV1AppVersionPost_0**](#createversionapiv1appversionpost_0) | **POST** /api/v1/app-version | 新增版本|
|[**deleteVersionApiV1AppVersionVidDelete**](#deleteversionapiv1appversionviddelete) | **DELETE** /api/v1/app-version/{vid} | 删除版本|
|[**deleteVersionApiV1AppVersionVidDelete_0**](#deleteversionapiv1appversionviddelete_0) | **DELETE** /api/v1/app-version/{vid} | 删除版本|
|[**listVersionsApiV1AppVersionListGet**](#listversionsapiv1appversionlistget) | **GET** /api/v1/app-version/list | 版本列表|
|[**listVersionsApiV1AppVersionListGet_0**](#listversionsapiv1appversionlistget_0) | **GET** /api/v1/app-version/list | 版本列表|
|[**updateVersionApiV1AppVersionVidPut**](#updateversionapiv1appversionvidput) | **PUT** /api/v1/app-version/{vid} | 修改版本|
|[**updateVersionApiV1AppVersionVidPut_0**](#updateversionapiv1appversionvidput_0) | **PUT** /api/v1/app-version/{vid} | 修改版本|

# **checkUpdateApiV1AppVersionCheckGet**
> any checkUpdateApiV1AppVersionCheckGet()


### Example

```typescript
import {
    AppVersionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AppVersionApi(configuration);

let platform: string; // (default to undefined)
let currentVersion: string; // (default to undefined)
let build: number; // (optional) (default to 0)

const { status, data } = await apiInstance.checkUpdateApiV1AppVersionCheckGet(
    platform,
    currentVersion,
    build
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **platform** | [**string**] |  | defaults to undefined|
| **currentVersion** | [**string**] |  | defaults to undefined|
| **build** | [**number**] |  | (optional) defaults to 0|


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

# **checkUpdateApiV1AppVersionCheckGet_0**
> any checkUpdateApiV1AppVersionCheckGet_0()


### Example

```typescript
import {
    AppVersionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AppVersionApi(configuration);

let platform: string; // (default to undefined)
let currentVersion: string; // (default to undefined)
let build: number; // (optional) (default to 0)

const { status, data } = await apiInstance.checkUpdateApiV1AppVersionCheckGet_0(
    platform,
    currentVersion,
    build
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **platform** | [**string**] |  | defaults to undefined|
| **currentVersion** | [**string**] |  | defaults to undefined|
| **build** | [**number**] |  | (optional) defaults to 0|


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

# **createVersionApiV1AppVersionPost**
> any createVersionApiV1AppVersionPost()


### Example

```typescript
import {
    AppVersionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AppVersionApi(configuration);

let platform: string; // (default to undefined)
let version: string; // (default to undefined)
let title: string; // (default to undefined)
let content: string; // (default to undefined)
let build: number; // (optional) (default to 1)
let downloadUrl: string; // (optional) (default to undefined)
let isForce: boolean; // (optional) (default to false)
let isSilent: boolean; // (optional) (default to false)
let minVersion: string; // (optional) (default to undefined)
let grayRatio: number; // (optional) (default to 0)
let fileSize: number; // (optional) (default to 0)
let md5: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createVersionApiV1AppVersionPost(
    platform,
    version,
    title,
    content,
    build,
    downloadUrl,
    isForce,
    isSilent,
    minVersion,
    grayRatio,
    fileSize,
    md5
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **platform** | [**string**] |  | defaults to undefined|
| **version** | [**string**] |  | defaults to undefined|
| **title** | [**string**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **build** | [**number**] |  | (optional) defaults to 1|
| **downloadUrl** | [**string**] |  | (optional) defaults to undefined|
| **isForce** | [**boolean**] |  | (optional) defaults to false|
| **isSilent** | [**boolean**] |  | (optional) defaults to false|
| **minVersion** | [**string**] |  | (optional) defaults to undefined|
| **grayRatio** | [**number**] |  | (optional) defaults to 0|
| **fileSize** | [**number**] |  | (optional) defaults to 0|
| **md5** | [**string**] |  | (optional) defaults to undefined|


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

# **createVersionApiV1AppVersionPost_0**
> any createVersionApiV1AppVersionPost_0()


### Example

```typescript
import {
    AppVersionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AppVersionApi(configuration);

let platform: string; // (default to undefined)
let version: string; // (default to undefined)
let title: string; // (default to undefined)
let content: string; // (default to undefined)
let build: number; // (optional) (default to 1)
let downloadUrl: string; // (optional) (default to undefined)
let isForce: boolean; // (optional) (default to false)
let isSilent: boolean; // (optional) (default to false)
let minVersion: string; // (optional) (default to undefined)
let grayRatio: number; // (optional) (default to 0)
let fileSize: number; // (optional) (default to 0)
let md5: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createVersionApiV1AppVersionPost_0(
    platform,
    version,
    title,
    content,
    build,
    downloadUrl,
    isForce,
    isSilent,
    minVersion,
    grayRatio,
    fileSize,
    md5
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **platform** | [**string**] |  | defaults to undefined|
| **version** | [**string**] |  | defaults to undefined|
| **title** | [**string**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **build** | [**number**] |  | (optional) defaults to 1|
| **downloadUrl** | [**string**] |  | (optional) defaults to undefined|
| **isForce** | [**boolean**] |  | (optional) defaults to false|
| **isSilent** | [**boolean**] |  | (optional) defaults to false|
| **minVersion** | [**string**] |  | (optional) defaults to undefined|
| **grayRatio** | [**number**] |  | (optional) defaults to 0|
| **fileSize** | [**number**] |  | (optional) defaults to 0|
| **md5** | [**string**] |  | (optional) defaults to undefined|


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

# **deleteVersionApiV1AppVersionVidDelete**
> any deleteVersionApiV1AppVersionVidDelete()


### Example

```typescript
import {
    AppVersionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AppVersionApi(configuration);

let vid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteVersionApiV1AppVersionVidDelete(
    vid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **vid** | [**number**] |  | defaults to undefined|


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

# **deleteVersionApiV1AppVersionVidDelete_0**
> any deleteVersionApiV1AppVersionVidDelete_0()


### Example

```typescript
import {
    AppVersionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AppVersionApi(configuration);

let vid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteVersionApiV1AppVersionVidDelete_0(
    vid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **vid** | [**number**] |  | defaults to undefined|


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

# **listVersionsApiV1AppVersionListGet**
> any listVersionsApiV1AppVersionListGet()


### Example

```typescript
import {
    AppVersionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AppVersionApi(configuration);

let platform: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listVersionsApiV1AppVersionListGet(
    platform,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **platform** | [**string**] |  | (optional) defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

# **listVersionsApiV1AppVersionListGet_0**
> any listVersionsApiV1AppVersionListGet_0()


### Example

```typescript
import {
    AppVersionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AppVersionApi(configuration);

let platform: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listVersionsApiV1AppVersionListGet_0(
    platform,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **platform** | [**string**] |  | (optional) defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

# **updateVersionApiV1AppVersionVidPut**
> any updateVersionApiV1AppVersionVidPut()


### Example

```typescript
import {
    AppVersionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AppVersionApi(configuration);

let vid: number; // (default to undefined)
let title: string; // (optional) (default to undefined)
let content: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let isForce: boolean; // (optional) (default to undefined)
let downloadUrl: string; // (optional) (default to undefined)
let grayRatio: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateVersionApiV1AppVersionVidPut(
    vid,
    title,
    content,
    status,
    isForce,
    downloadUrl,
    grayRatio
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **vid** | [**number**] |  | defaults to undefined|
| **title** | [**string**] |  | (optional) defaults to undefined|
| **content** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **isForce** | [**boolean**] |  | (optional) defaults to undefined|
| **downloadUrl** | [**string**] |  | (optional) defaults to undefined|
| **grayRatio** | [**number**] |  | (optional) defaults to undefined|


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

# **updateVersionApiV1AppVersionVidPut_0**
> any updateVersionApiV1AppVersionVidPut_0()


### Example

```typescript
import {
    AppVersionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AppVersionApi(configuration);

let vid: number; // (default to undefined)
let title: string; // (optional) (default to undefined)
let content: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let isForce: boolean; // (optional) (default to undefined)
let downloadUrl: string; // (optional) (default to undefined)
let grayRatio: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateVersionApiV1AppVersionVidPut_0(
    vid,
    title,
    content,
    status,
    isForce,
    downloadUrl,
    grayRatio
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **vid** | [**number**] |  | defaults to undefined|
| **title** | [**string**] |  | (optional) defaults to undefined|
| **content** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **isForce** | [**boolean**] |  | (optional) defaults to undefined|
| **downloadUrl** | [**string**] |  | (optional) defaults to undefined|
| **grayRatio** | [**number**] |  | (optional) defaults to undefined|


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

