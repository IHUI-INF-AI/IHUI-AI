# TBoxApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**activateDeviceApiV1TboxDeviceDeviceNoActivatePost**](TBoxApi.md#activatedeviceapiv1tboxdevicedevicenoactivatepost) | **POST** /api/v1/tbox/device/{device_no}/activate | 激活设备 |
| [**activateDeviceApiV1TboxDeviceDeviceNoActivatePost_0**](TBoxApi.md#activatedeviceapiv1tboxdevicedevicenoactivatepost_0) | **POST** /api/v1/tbox/device/{device_no}/activate | 激活设备 |
| [**getDeviceApiV1TboxDeviceDeviceNoGet**](TBoxApi.md#getdeviceapiv1tboxdevicedevicenoget) | **GET** /api/v1/tbox/device/{device_no} | 设备详情 |
| [**getDeviceApiV1TboxDeviceDeviceNoGet_0**](TBoxApi.md#getdeviceapiv1tboxdevicedevicenoget_0) | **GET** /api/v1/tbox/device/{device_no} | 设备详情 |
| [**heartbeatApiV1TboxDeviceHeartbeatPost**](TBoxApi.md#heartbeatapiv1tboxdeviceheartbeatpost) | **POST** /api/v1/tbox/device/heartbeat | 设备心跳 |
| [**heartbeatApiV1TboxDeviceHeartbeatPost_0**](TBoxApi.md#heartbeatapiv1tboxdeviceheartbeatpost_0) | **POST** /api/v1/tbox/device/heartbeat | 设备心跳 |
| [**listCommandsApiV1TboxCommandListGet**](TBoxApi.md#listcommandsapiv1tboxcommandlistget) | **GET** /api/v1/tbox/command/list | 指令列表 |
| [**listCommandsApiV1TboxCommandListGet_0**](TBoxApi.md#listcommandsapiv1tboxcommandlistget_0) | **GET** /api/v1/tbox/command/list | 指令列表 |
| [**listDevicesApiV1TboxDeviceListGet**](TBoxApi.md#listdevicesapiv1tboxdevicelistget) | **GET** /api/v1/tbox/device/list | 设备列表 |
| [**listDevicesApiV1TboxDeviceListGet_0**](TBoxApi.md#listdevicesapiv1tboxdevicelistget_0) | **GET** /api/v1/tbox/device/list | 设备列表 |
| [**registerDeviceApiV1TboxDevicePost**](TBoxApi.md#registerdeviceapiv1tboxdevicepost) | **POST** /api/v1/tbox/device | 注册设备 |
| [**registerDeviceApiV1TboxDevicePost_0**](TBoxApi.md#registerdeviceapiv1tboxdevicepost_0) | **POST** /api/v1/tbox/device | 注册设备 |
| [**sendCommandApiV1TboxDeviceDeviceNoCommandPost**](TBoxApi.md#sendcommandapiv1tboxdevicedevicenocommandpost) | **POST** /api/v1/tbox/device/{device_no}/command | 下发指令 |
| [**sendCommandApiV1TboxDeviceDeviceNoCommandPost_0**](TBoxApi.md#sendcommandapiv1tboxdevicedevicenocommandpost_0) | **POST** /api/v1/tbox/device/{device_no}/command | 下发指令 |



## activateDeviceApiV1TboxDeviceDeviceNoActivatePost

> any activateDeviceApiV1TboxDeviceDeviceNoActivatePost(deviceNo, userId, userName)

激活设备

### Example

```ts
import {
  Configuration,
  TBoxApi,
} from '';
import type { ActivateDeviceApiV1TboxDeviceDeviceNoActivatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TBoxApi();

  const body = {
    // string
    deviceNo: deviceNo_example,
    // string
    userId: userId_example,
    // string (optional)
    userName: userName_example,
  } satisfies ActivateDeviceApiV1TboxDeviceDeviceNoActivatePostRequest;

  try {
    const data = await api.activateDeviceApiV1TboxDeviceDeviceNoActivatePost(body);
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
| **deviceNo** | `string` |  | [Defaults to `undefined`] |
| **userId** | `string` |  | [Defaults to `undefined`] |
| **userName** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## activateDeviceApiV1TboxDeviceDeviceNoActivatePost_0

> any activateDeviceApiV1TboxDeviceDeviceNoActivatePost_0(deviceNo, userId, userName)

激活设备

### Example

```ts
import {
  Configuration,
  TBoxApi,
} from '';
import type { ActivateDeviceApiV1TboxDeviceDeviceNoActivatePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TBoxApi();

  const body = {
    // string
    deviceNo: deviceNo_example,
    // string
    userId: userId_example,
    // string (optional)
    userName: userName_example,
  } satisfies ActivateDeviceApiV1TboxDeviceDeviceNoActivatePost0Request;

  try {
    const data = await api.activateDeviceApiV1TboxDeviceDeviceNoActivatePost_0(body);
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
| **deviceNo** | `string` |  | [Defaults to `undefined`] |
| **userId** | `string` |  | [Defaults to `undefined`] |
| **userName** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## getDeviceApiV1TboxDeviceDeviceNoGet

> any getDeviceApiV1TboxDeviceDeviceNoGet(deviceNo)

设备详情

### Example

```ts
import {
  Configuration,
  TBoxApi,
} from '';
import type { GetDeviceApiV1TboxDeviceDeviceNoGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TBoxApi();

  const body = {
    // string
    deviceNo: deviceNo_example,
  } satisfies GetDeviceApiV1TboxDeviceDeviceNoGetRequest;

  try {
    const data = await api.getDeviceApiV1TboxDeviceDeviceNoGet(body);
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
| **deviceNo** | `string` |  | [Defaults to `undefined`] |

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


## getDeviceApiV1TboxDeviceDeviceNoGet_0

> any getDeviceApiV1TboxDeviceDeviceNoGet_0(deviceNo)

设备详情

### Example

```ts
import {
  Configuration,
  TBoxApi,
} from '';
import type { GetDeviceApiV1TboxDeviceDeviceNoGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TBoxApi();

  const body = {
    // string
    deviceNo: deviceNo_example,
  } satisfies GetDeviceApiV1TboxDeviceDeviceNoGet0Request;

  try {
    const data = await api.getDeviceApiV1TboxDeviceDeviceNoGet_0(body);
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
| **deviceNo** | `string` |  | [Defaults to `undefined`] |

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


## heartbeatApiV1TboxDeviceHeartbeatPost

> any heartbeatApiV1TboxDeviceHeartbeatPost(deviceNo, isOnline, signalStrength, battery, location)

设备心跳

### Example

```ts
import {
  Configuration,
  TBoxApi,
} from '';
import type { HeartbeatApiV1TboxDeviceHeartbeatPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TBoxApi();

  const body = {
    // string
    deviceNo: deviceNo_example,
    // boolean (optional)
    isOnline: true,
    // number (optional)
    signalStrength: 56,
    // number (optional)
    battery: 56,
    // string (optional)
    location: location_example,
  } satisfies HeartbeatApiV1TboxDeviceHeartbeatPostRequest;

  try {
    const data = await api.heartbeatApiV1TboxDeviceHeartbeatPost(body);
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
| **deviceNo** | `string` |  | [Defaults to `undefined`] |
| **isOnline** | `boolean` |  | [Optional] [Defaults to `true`] |
| **signalStrength** | `number` |  | [Optional] [Defaults to `0`] |
| **battery** | `number` |  | [Optional] [Defaults to `0`] |
| **location** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## heartbeatApiV1TboxDeviceHeartbeatPost_0

> any heartbeatApiV1TboxDeviceHeartbeatPost_0(deviceNo, isOnline, signalStrength, battery, location)

设备心跳

### Example

```ts
import {
  Configuration,
  TBoxApi,
} from '';
import type { HeartbeatApiV1TboxDeviceHeartbeatPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TBoxApi();

  const body = {
    // string
    deviceNo: deviceNo_example,
    // boolean (optional)
    isOnline: true,
    // number (optional)
    signalStrength: 56,
    // number (optional)
    battery: 56,
    // string (optional)
    location: location_example,
  } satisfies HeartbeatApiV1TboxDeviceHeartbeatPost0Request;

  try {
    const data = await api.heartbeatApiV1TboxDeviceHeartbeatPost_0(body);
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
| **deviceNo** | `string` |  | [Defaults to `undefined`] |
| **isOnline** | `boolean` |  | [Optional] [Defaults to `true`] |
| **signalStrength** | `number` |  | [Optional] [Defaults to `0`] |
| **battery** | `number` |  | [Optional] [Defaults to `0`] |
| **location** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## listCommandsApiV1TboxCommandListGet

> any listCommandsApiV1TboxCommandListGet(page, limit, deviceNo, status)

指令列表

### Example

```ts
import {
  Configuration,
  TBoxApi,
} from '';
import type { ListCommandsApiV1TboxCommandListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TBoxApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    deviceNo: deviceNo_example,
    // number (optional)
    status: 56,
  } satisfies ListCommandsApiV1TboxCommandListGetRequest;

  try {
    const data = await api.listCommandsApiV1TboxCommandListGet(body);
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
| **deviceNo** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## listCommandsApiV1TboxCommandListGet_0

> any listCommandsApiV1TboxCommandListGet_0(page, limit, deviceNo, status)

指令列表

### Example

```ts
import {
  Configuration,
  TBoxApi,
} from '';
import type { ListCommandsApiV1TboxCommandListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TBoxApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    deviceNo: deviceNo_example,
    // number (optional)
    status: 56,
  } satisfies ListCommandsApiV1TboxCommandListGet0Request;

  try {
    const data = await api.listCommandsApiV1TboxCommandListGet_0(body);
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
| **deviceNo** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## listDevicesApiV1TboxDeviceListGet

> any listDevicesApiV1TboxDeviceListGet(page, limit, userId, deviceType, status, isOnline)

设备列表

### Example

```ts
import {
  Configuration,
  TBoxApi,
} from '';
import type { ListDevicesApiV1TboxDeviceListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TBoxApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    userId: userId_example,
    // string (optional)
    deviceType: deviceType_example,
    // number (optional)
    status: 56,
    // boolean (optional)
    isOnline: true,
  } satisfies ListDevicesApiV1TboxDeviceListGetRequest;

  try {
    const data = await api.listDevicesApiV1TboxDeviceListGet(body);
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
| **deviceType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **isOnline** | `boolean` |  | [Optional] [Defaults to `undefined`] |

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


## listDevicesApiV1TboxDeviceListGet_0

> any listDevicesApiV1TboxDeviceListGet_0(page, limit, userId, deviceType, status, isOnline)

设备列表

### Example

```ts
import {
  Configuration,
  TBoxApi,
} from '';
import type { ListDevicesApiV1TboxDeviceListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TBoxApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    userId: userId_example,
    // string (optional)
    deviceType: deviceType_example,
    // number (optional)
    status: 56,
    // boolean (optional)
    isOnline: true,
  } satisfies ListDevicesApiV1TboxDeviceListGet0Request;

  try {
    const data = await api.listDevicesApiV1TboxDeviceListGet_0(body);
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
| **deviceType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **isOnline** | `boolean` |  | [Optional] [Defaults to `undefined`] |

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


## registerDeviceApiV1TboxDevicePost

> any registerDeviceApiV1TboxDevicePost(deviceNo, deviceName, deviceType, model, brand, iccid, imei, firmware)

注册设备

### Example

```ts
import {
  Configuration,
  TBoxApi,
} from '';
import type { RegisterDeviceApiV1TboxDevicePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TBoxApi();

  const body = {
    // string
    deviceNo: deviceNo_example,
    // string (optional)
    deviceName: deviceName_example,
    // string (optional)
    deviceType: deviceType_example,
    // string (optional)
    model: model_example,
    // string (optional)
    brand: brand_example,
    // string (optional)
    iccid: iccid_example,
    // string (optional)
    imei: imei_example,
    // string (optional)
    firmware: firmware_example,
  } satisfies RegisterDeviceApiV1TboxDevicePostRequest;

  try {
    const data = await api.registerDeviceApiV1TboxDevicePost(body);
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
| **deviceNo** | `string` |  | [Defaults to `undefined`] |
| **deviceName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **deviceType** | `string` |  | [Optional] [Defaults to `&#39;tbox&#39;`] |
| **model** | `string` |  | [Optional] [Defaults to `undefined`] |
| **brand** | `string` |  | [Optional] [Defaults to `undefined`] |
| **iccid** | `string` |  | [Optional] [Defaults to `undefined`] |
| **imei** | `string` |  | [Optional] [Defaults to `undefined`] |
| **firmware** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## registerDeviceApiV1TboxDevicePost_0

> any registerDeviceApiV1TboxDevicePost_0(deviceNo, deviceName, deviceType, model, brand, iccid, imei, firmware)

注册设备

### Example

```ts
import {
  Configuration,
  TBoxApi,
} from '';
import type { RegisterDeviceApiV1TboxDevicePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TBoxApi();

  const body = {
    // string
    deviceNo: deviceNo_example,
    // string (optional)
    deviceName: deviceName_example,
    // string (optional)
    deviceType: deviceType_example,
    // string (optional)
    model: model_example,
    // string (optional)
    brand: brand_example,
    // string (optional)
    iccid: iccid_example,
    // string (optional)
    imei: imei_example,
    // string (optional)
    firmware: firmware_example,
  } satisfies RegisterDeviceApiV1TboxDevicePost0Request;

  try {
    const data = await api.registerDeviceApiV1TboxDevicePost_0(body);
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
| **deviceNo** | `string` |  | [Defaults to `undefined`] |
| **deviceName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **deviceType** | `string` |  | [Optional] [Defaults to `&#39;tbox&#39;`] |
| **model** | `string` |  | [Optional] [Defaults to `undefined`] |
| **brand** | `string` |  | [Optional] [Defaults to `undefined`] |
| **iccid** | `string` |  | [Optional] [Defaults to `undefined`] |
| **imei** | `string` |  | [Optional] [Defaults to `undefined`] |
| **firmware** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## sendCommandApiV1TboxDeviceDeviceNoCommandPost

> any sendCommandApiV1TboxDeviceDeviceNoCommandPost(deviceNo, command, params)

下发指令

### Example

```ts
import {
  Configuration,
  TBoxApi,
} from '';
import type { SendCommandApiV1TboxDeviceDeviceNoCommandPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TBoxApi();

  const body = {
    // string
    deviceNo: deviceNo_example,
    // string
    command: command_example,
    // string (optional)
    params: params_example,
  } satisfies SendCommandApiV1TboxDeviceDeviceNoCommandPostRequest;

  try {
    const data = await api.sendCommandApiV1TboxDeviceDeviceNoCommandPost(body);
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
| **deviceNo** | `string` |  | [Defaults to `undefined`] |
| **command** | `string` |  | [Defaults to `undefined`] |
| **params** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## sendCommandApiV1TboxDeviceDeviceNoCommandPost_0

> any sendCommandApiV1TboxDeviceDeviceNoCommandPost_0(deviceNo, command, params)

下发指令

### Example

```ts
import {
  Configuration,
  TBoxApi,
} from '';
import type { SendCommandApiV1TboxDeviceDeviceNoCommandPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TBoxApi();

  const body = {
    // string
    deviceNo: deviceNo_example,
    // string
    command: command_example,
    // string (optional)
    params: params_example,
  } satisfies SendCommandApiV1TboxDeviceDeviceNoCommandPost0Request;

  try {
    const data = await api.sendCommandApiV1TboxDeviceDeviceNoCommandPost_0(body);
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
| **deviceNo** | `string` |  | [Defaults to `undefined`] |
| **command** | `string` |  | [Defaults to `undefined`] |
| **params** | `string` |  | [Optional] [Defaults to `undefined`] |

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

