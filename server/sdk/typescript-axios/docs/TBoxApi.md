# TBoxApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**activateDeviceApiV1TboxDeviceDeviceNoActivatePost**](#activatedeviceapiv1tboxdevicedevicenoactivatepost) | **POST** /api/v1/tbox/device/{device_no}/activate | 激活设备|
|[**activateDeviceApiV1TboxDeviceDeviceNoActivatePost_0**](#activatedeviceapiv1tboxdevicedevicenoactivatepost_0) | **POST** /api/v1/tbox/device/{device_no}/activate | 激活设备|
|[**getDeviceApiV1TboxDeviceDeviceNoGet**](#getdeviceapiv1tboxdevicedevicenoget) | **GET** /api/v1/tbox/device/{device_no} | 设备详情|
|[**getDeviceApiV1TboxDeviceDeviceNoGet_0**](#getdeviceapiv1tboxdevicedevicenoget_0) | **GET** /api/v1/tbox/device/{device_no} | 设备详情|
|[**heartbeatApiV1TboxDeviceHeartbeatPost**](#heartbeatapiv1tboxdeviceheartbeatpost) | **POST** /api/v1/tbox/device/heartbeat | 设备心跳|
|[**heartbeatApiV1TboxDeviceHeartbeatPost_0**](#heartbeatapiv1tboxdeviceheartbeatpost_0) | **POST** /api/v1/tbox/device/heartbeat | 设备心跳|
|[**listCommandsApiV1TboxCommandListGet**](#listcommandsapiv1tboxcommandlistget) | **GET** /api/v1/tbox/command/list | 指令列表|
|[**listCommandsApiV1TboxCommandListGet_0**](#listcommandsapiv1tboxcommandlistget_0) | **GET** /api/v1/tbox/command/list | 指令列表|
|[**listDevicesApiV1TboxDeviceListGet**](#listdevicesapiv1tboxdevicelistget) | **GET** /api/v1/tbox/device/list | 设备列表|
|[**listDevicesApiV1TboxDeviceListGet_0**](#listdevicesapiv1tboxdevicelistget_0) | **GET** /api/v1/tbox/device/list | 设备列表|
|[**registerDeviceApiV1TboxDevicePost**](#registerdeviceapiv1tboxdevicepost) | **POST** /api/v1/tbox/device | 注册设备|
|[**registerDeviceApiV1TboxDevicePost_0**](#registerdeviceapiv1tboxdevicepost_0) | **POST** /api/v1/tbox/device | 注册设备|
|[**sendCommandApiV1TboxDeviceDeviceNoCommandPost**](#sendcommandapiv1tboxdevicedevicenocommandpost) | **POST** /api/v1/tbox/device/{device_no}/command | 下发指令|
|[**sendCommandApiV1TboxDeviceDeviceNoCommandPost_0**](#sendcommandapiv1tboxdevicedevicenocommandpost_0) | **POST** /api/v1/tbox/device/{device_no}/command | 下发指令|

# **activateDeviceApiV1TboxDeviceDeviceNoActivatePost**
> any activateDeviceApiV1TboxDeviceDeviceNoActivatePost()


### Example

```typescript
import {
    TBoxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TBoxApi(configuration);

let deviceNo: string; // (default to undefined)
let userId: string; // (default to undefined)
let userName: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.activateDeviceApiV1TboxDeviceDeviceNoActivatePost(
    deviceNo,
    userId,
    userName
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **deviceNo** | [**string**] |  | defaults to undefined|
| **userId** | [**string**] |  | defaults to undefined|
| **userName** | [**string**] |  | (optional) defaults to undefined|


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

# **activateDeviceApiV1TboxDeviceDeviceNoActivatePost_0**
> any activateDeviceApiV1TboxDeviceDeviceNoActivatePost_0()


### Example

```typescript
import {
    TBoxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TBoxApi(configuration);

let deviceNo: string; // (default to undefined)
let userId: string; // (default to undefined)
let userName: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.activateDeviceApiV1TboxDeviceDeviceNoActivatePost_0(
    deviceNo,
    userId,
    userName
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **deviceNo** | [**string**] |  | defaults to undefined|
| **userId** | [**string**] |  | defaults to undefined|
| **userName** | [**string**] |  | (optional) defaults to undefined|


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

# **getDeviceApiV1TboxDeviceDeviceNoGet**
> any getDeviceApiV1TboxDeviceDeviceNoGet()


### Example

```typescript
import {
    TBoxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TBoxApi(configuration);

let deviceNo: string; // (default to undefined)

const { status, data } = await apiInstance.getDeviceApiV1TboxDeviceDeviceNoGet(
    deviceNo
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **deviceNo** | [**string**] |  | defaults to undefined|


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

# **getDeviceApiV1TboxDeviceDeviceNoGet_0**
> any getDeviceApiV1TboxDeviceDeviceNoGet_0()


### Example

```typescript
import {
    TBoxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TBoxApi(configuration);

let deviceNo: string; // (default to undefined)

const { status, data } = await apiInstance.getDeviceApiV1TboxDeviceDeviceNoGet_0(
    deviceNo
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **deviceNo** | [**string**] |  | defaults to undefined|


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

# **heartbeatApiV1TboxDeviceHeartbeatPost**
> any heartbeatApiV1TboxDeviceHeartbeatPost()


### Example

```typescript
import {
    TBoxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TBoxApi(configuration);

let deviceNo: string; // (default to undefined)
let isOnline: boolean; // (optional) (default to true)
let signalStrength: number; // (optional) (default to 0)
let battery: number; // (optional) (default to 0)
let location: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.heartbeatApiV1TboxDeviceHeartbeatPost(
    deviceNo,
    isOnline,
    signalStrength,
    battery,
    location
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **deviceNo** | [**string**] |  | defaults to undefined|
| **isOnline** | [**boolean**] |  | (optional) defaults to true|
| **signalStrength** | [**number**] |  | (optional) defaults to 0|
| **battery** | [**number**] |  | (optional) defaults to 0|
| **location** | [**string**] |  | (optional) defaults to undefined|


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

# **heartbeatApiV1TboxDeviceHeartbeatPost_0**
> any heartbeatApiV1TboxDeviceHeartbeatPost_0()


### Example

```typescript
import {
    TBoxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TBoxApi(configuration);

let deviceNo: string; // (default to undefined)
let isOnline: boolean; // (optional) (default to true)
let signalStrength: number; // (optional) (default to 0)
let battery: number; // (optional) (default to 0)
let location: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.heartbeatApiV1TboxDeviceHeartbeatPost_0(
    deviceNo,
    isOnline,
    signalStrength,
    battery,
    location
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **deviceNo** | [**string**] |  | defaults to undefined|
| **isOnline** | [**boolean**] |  | (optional) defaults to true|
| **signalStrength** | [**number**] |  | (optional) defaults to 0|
| **battery** | [**number**] |  | (optional) defaults to 0|
| **location** | [**string**] |  | (optional) defaults to undefined|


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

# **listCommandsApiV1TboxCommandListGet**
> any listCommandsApiV1TboxCommandListGet()


### Example

```typescript
import {
    TBoxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TBoxApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let deviceNo: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listCommandsApiV1TboxCommandListGet(
    page,
    limit,
    deviceNo,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **deviceNo** | [**string**] |  | (optional) defaults to undefined|
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

# **listCommandsApiV1TboxCommandListGet_0**
> any listCommandsApiV1TboxCommandListGet_0()


### Example

```typescript
import {
    TBoxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TBoxApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let deviceNo: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listCommandsApiV1TboxCommandListGet_0(
    page,
    limit,
    deviceNo,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **deviceNo** | [**string**] |  | (optional) defaults to undefined|
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

# **listDevicesApiV1TboxDeviceListGet**
> any listDevicesApiV1TboxDeviceListGet()


### Example

```typescript
import {
    TBoxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TBoxApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let userId: string; // (optional) (default to undefined)
let deviceType: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let isOnline: boolean; // (optional) (default to undefined)

const { status, data } = await apiInstance.listDevicesApiV1TboxDeviceListGet(
    page,
    limit,
    userId,
    deviceType,
    status,
    isOnline
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **deviceType** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **isOnline** | [**boolean**] |  | (optional) defaults to undefined|


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

# **listDevicesApiV1TboxDeviceListGet_0**
> any listDevicesApiV1TboxDeviceListGet_0()


### Example

```typescript
import {
    TBoxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TBoxApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let userId: string; // (optional) (default to undefined)
let deviceType: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let isOnline: boolean; // (optional) (default to undefined)

const { status, data } = await apiInstance.listDevicesApiV1TboxDeviceListGet_0(
    page,
    limit,
    userId,
    deviceType,
    status,
    isOnline
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **deviceType** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **isOnline** | [**boolean**] |  | (optional) defaults to undefined|


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

# **registerDeviceApiV1TboxDevicePost**
> any registerDeviceApiV1TboxDevicePost()


### Example

```typescript
import {
    TBoxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TBoxApi(configuration);

let deviceNo: string; // (default to undefined)
let deviceName: string; // (optional) (default to undefined)
let deviceType: string; // (optional) (default to 'tbox')
let model: string; // (optional) (default to undefined)
let brand: string; // (optional) (default to undefined)
let iccid: string; // (optional) (default to undefined)
let imei: string; // (optional) (default to undefined)
let firmware: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.registerDeviceApiV1TboxDevicePost(
    deviceNo,
    deviceName,
    deviceType,
    model,
    brand,
    iccid,
    imei,
    firmware
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **deviceNo** | [**string**] |  | defaults to undefined|
| **deviceName** | [**string**] |  | (optional) defaults to undefined|
| **deviceType** | [**string**] |  | (optional) defaults to 'tbox'|
| **model** | [**string**] |  | (optional) defaults to undefined|
| **brand** | [**string**] |  | (optional) defaults to undefined|
| **iccid** | [**string**] |  | (optional) defaults to undefined|
| **imei** | [**string**] |  | (optional) defaults to undefined|
| **firmware** | [**string**] |  | (optional) defaults to undefined|


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

# **registerDeviceApiV1TboxDevicePost_0**
> any registerDeviceApiV1TboxDevicePost_0()


### Example

```typescript
import {
    TBoxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TBoxApi(configuration);

let deviceNo: string; // (default to undefined)
let deviceName: string; // (optional) (default to undefined)
let deviceType: string; // (optional) (default to 'tbox')
let model: string; // (optional) (default to undefined)
let brand: string; // (optional) (default to undefined)
let iccid: string; // (optional) (default to undefined)
let imei: string; // (optional) (default to undefined)
let firmware: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.registerDeviceApiV1TboxDevicePost_0(
    deviceNo,
    deviceName,
    deviceType,
    model,
    brand,
    iccid,
    imei,
    firmware
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **deviceNo** | [**string**] |  | defaults to undefined|
| **deviceName** | [**string**] |  | (optional) defaults to undefined|
| **deviceType** | [**string**] |  | (optional) defaults to 'tbox'|
| **model** | [**string**] |  | (optional) defaults to undefined|
| **brand** | [**string**] |  | (optional) defaults to undefined|
| **iccid** | [**string**] |  | (optional) defaults to undefined|
| **imei** | [**string**] |  | (optional) defaults to undefined|
| **firmware** | [**string**] |  | (optional) defaults to undefined|


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

# **sendCommandApiV1TboxDeviceDeviceNoCommandPost**
> any sendCommandApiV1TboxDeviceDeviceNoCommandPost()


### Example

```typescript
import {
    TBoxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TBoxApi(configuration);

let deviceNo: string; // (default to undefined)
let command: string; // (default to undefined)
let params: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.sendCommandApiV1TboxDeviceDeviceNoCommandPost(
    deviceNo,
    command,
    params
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **deviceNo** | [**string**] |  | defaults to undefined|
| **command** | [**string**] |  | defaults to undefined|
| **params** | [**string**] |  | (optional) defaults to undefined|


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

# **sendCommandApiV1TboxDeviceDeviceNoCommandPost_0**
> any sendCommandApiV1TboxDeviceDeviceNoCommandPost_0()


### Example

```typescript
import {
    TBoxApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TBoxApi(configuration);

let deviceNo: string; // (default to undefined)
let command: string; // (default to undefined)
let params: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.sendCommandApiV1TboxDeviceDeviceNoCommandPost_0(
    deviceNo,
    command,
    params
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **deviceNo** | [**string**] |  | defaults to undefined|
| **command** | [**string**] |  | defaults to undefined|
| **params** | [**string**] |  | (optional) defaults to undefined|


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

