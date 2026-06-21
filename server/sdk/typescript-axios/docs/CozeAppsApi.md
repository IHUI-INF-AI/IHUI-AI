# CozeAppsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**listApiAppsApiV1CozeAppsAppsListApiAppsGet**](#listapiappsapiv1cozeappsappslistapiappsget) | **GET** /api/v1/coze/apps/apps/list_api_apps | List Api Apps|
|[**listApiAppsApiV1CozeAppsAppsListApiAppsGet_0**](#listapiappsapiv1cozeappsappslistapiappsget_0) | **GET** /api/v1/coze/apps/apps/list_api_apps | List Api Apps|
|[**listAppEventsApiV1CozeAppsAppsEventsGet**](#listappeventsapiv1cozeappsappseventsget) | **GET** /api/v1/coze/apps/apps/events | List App Events|
|[**listAppEventsApiV1CozeAppsAppsEventsGet_0**](#listappeventsapiv1cozeappsappseventsget_0) | **GET** /api/v1/coze/apps/apps/events | List App Events|
|[**listAppsApiV1CozeAppsAppsListGet**](#listappsapiv1cozeappsappslistget) | **GET** /api/v1/coze/apps/apps/list | List Apps|
|[**listAppsApiV1CozeAppsAppsListGet_0**](#listappsapiv1cozeappsappslistget_0) | **GET** /api/v1/coze/apps/apps/list | List Apps|

# **listApiAppsApiV1CozeAppsAppsListApiAppsGet**
> any listApiAppsApiV1CozeAppsAppsListApiAppsGet()


### Example

```typescript
import {
    CozeAppsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAppsApi(configuration);

let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listApiAppsApiV1CozeAppsAppsListApiAppsGet(
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **size** | [**number**] |  | (optional) defaults to 20|


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

# **listApiAppsApiV1CozeAppsAppsListApiAppsGet_0**
> any listApiAppsApiV1CozeAppsAppsListApiAppsGet_0()


### Example

```typescript
import {
    CozeAppsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAppsApi(configuration);

let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listApiAppsApiV1CozeAppsAppsListApiAppsGet_0(
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **size** | [**number**] |  | (optional) defaults to 20|


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

# **listAppEventsApiV1CozeAppsAppsEventsGet**
> any listAppEventsApiV1CozeAppsAppsEventsGet()


### Example

```typescript
import {
    CozeAppsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAppsApi(configuration);

let appId: string; // (default to undefined)
let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listAppEventsApiV1CozeAppsAppsEventsGet(
    appId,
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **appId** | [**string**] |  | defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **size** | [**number**] |  | (optional) defaults to 20|


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

# **listAppEventsApiV1CozeAppsAppsEventsGet_0**
> any listAppEventsApiV1CozeAppsAppsEventsGet_0()


### Example

```typescript
import {
    CozeAppsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAppsApi(configuration);

let appId: string; // (default to undefined)
let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listAppEventsApiV1CozeAppsAppsEventsGet_0(
    appId,
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **appId** | [**string**] |  | defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **size** | [**number**] |  | (optional) defaults to 20|


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

# **listAppsApiV1CozeAppsAppsListGet**
> any listAppsApiV1CozeAppsAppsListGet()


### Example

```typescript
import {
    CozeAppsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAppsApi(configuration);

let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listAppsApiV1CozeAppsAppsListGet(
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **size** | [**number**] |  | (optional) defaults to 20|


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

# **listAppsApiV1CozeAppsAppsListGet_0**
> any listAppsApiV1CozeAppsAppsListGet_0()


### Example

```typescript
import {
    CozeAppsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAppsApi(configuration);

let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listAppsApiV1CozeAppsAppsListGet_0(
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **size** | [**number**] |  | (optional) defaults to 20|


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

