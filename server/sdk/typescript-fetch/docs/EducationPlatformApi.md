# EducationPlatformApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createPlatformApiV1EducationPlatformPost**](EducationPlatformApi.md#createplatformapiv1educationplatformpost) | **POST** /api/v1/education-platform | 新增教育平台 |
| [**createPlatformApiV1EducationPlatformPost_0**](EducationPlatformApi.md#createplatformapiv1educationplatformpost_0) | **POST** /api/v1/education-platform | 新增教育平台 |
| [**deletePlatformApiV1EducationPlatformPidDelete**](EducationPlatformApi.md#deleteplatformapiv1educationplatformpiddelete) | **DELETE** /api/v1/education-platform/{pid} | 删除教育平台 |
| [**deletePlatformApiV1EducationPlatformPidDelete_0**](EducationPlatformApi.md#deleteplatformapiv1educationplatformpiddelete_0) | **DELETE** /api/v1/education-platform/{pid} | 删除教育平台 |
| [**listPlatformsApiV1EducationPlatformListGet**](EducationPlatformApi.md#listplatformsapiv1educationplatformlistget) | **GET** /api/v1/education-platform/list | 教育平台列表 |
| [**listPlatformsApiV1EducationPlatformListGet_0**](EducationPlatformApi.md#listplatformsapiv1educationplatformlistget_0) | **GET** /api/v1/education-platform/list | 教育平台列表 |
| [**syncLogApiV1EducationPlatformSyncLogGet**](EducationPlatformApi.md#synclogapiv1educationplatformsynclogget) | **GET** /api/v1/education-platform/sync/log | 同步日志 |
| [**syncLogApiV1EducationPlatformSyncLogGet_0**](EducationPlatformApi.md#synclogapiv1educationplatformsynclogget_0) | **GET** /api/v1/education-platform/sync/log | 同步日志 |
| [**syncPlatformApiV1EducationPlatformPidSyncPost**](EducationPlatformApi.md#syncplatformapiv1educationplatformpidsyncpost) | **POST** /api/v1/education-platform/{pid}/sync | 同步数据 |
| [**syncPlatformApiV1EducationPlatformPidSyncPost_0**](EducationPlatformApi.md#syncplatformapiv1educationplatformpidsyncpost_0) | **POST** /api/v1/education-platform/{pid}/sync | 同步数据 |
| [**updatePlatformApiV1EducationPlatformPidPut**](EducationPlatformApi.md#updateplatformapiv1educationplatformpidput) | **PUT** /api/v1/education-platform/{pid} | 修改教育平台 |
| [**updatePlatformApiV1EducationPlatformPidPut_0**](EducationPlatformApi.md#updateplatformapiv1educationplatformpidput_0) | **PUT** /api/v1/education-platform/{pid} | 修改教育平台 |



## createPlatformApiV1EducationPlatformPost

> any createPlatformApiV1EducationPlatformPost(name, code, type, apiUrl, apiKey, apiSecret, config, syncUrl, description)

新增教育平台

### Example

```ts
import {
  Configuration,
  EducationPlatformApi,
} from '';
import type { CreatePlatformApiV1EducationPlatformPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EducationPlatformApi();

  const body = {
    // string
    name: name_example,
    // string
    code: code_example,
    // string (optional)
    type: type_example,
    // string (optional)
    apiUrl: apiUrl_example,
    // string (optional)
    apiKey: apiKey_example,
    // string (optional)
    apiSecret: apiSecret_example,
    // string (optional)
    config: config_example,
    // string (optional)
    syncUrl: syncUrl_example,
    // string (optional)
    description: description_example,
  } satisfies CreatePlatformApiV1EducationPlatformPostRequest;

  try {
    const data = await api.createPlatformApiV1EducationPlatformPost(body);
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
| **name** | `string` |  | [Defaults to `undefined`] |
| **code** | `string` |  | [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;mooc&#39;`] |
| **apiUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **apiKey** | `string` |  | [Optional] [Defaults to `undefined`] |
| **apiSecret** | `string` |  | [Optional] [Defaults to `undefined`] |
| **config** | `string` |  | [Optional] [Defaults to `undefined`] |
| **syncUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## createPlatformApiV1EducationPlatformPost_0

> any createPlatformApiV1EducationPlatformPost_0(name, code, type, apiUrl, apiKey, apiSecret, config, syncUrl, description)

新增教育平台

### Example

```ts
import {
  Configuration,
  EducationPlatformApi,
} from '';
import type { CreatePlatformApiV1EducationPlatformPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EducationPlatformApi();

  const body = {
    // string
    name: name_example,
    // string
    code: code_example,
    // string (optional)
    type: type_example,
    // string (optional)
    apiUrl: apiUrl_example,
    // string (optional)
    apiKey: apiKey_example,
    // string (optional)
    apiSecret: apiSecret_example,
    // string (optional)
    config: config_example,
    // string (optional)
    syncUrl: syncUrl_example,
    // string (optional)
    description: description_example,
  } satisfies CreatePlatformApiV1EducationPlatformPost0Request;

  try {
    const data = await api.createPlatformApiV1EducationPlatformPost_0(body);
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
| **name** | `string` |  | [Defaults to `undefined`] |
| **code** | `string` |  | [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;mooc&#39;`] |
| **apiUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **apiKey** | `string` |  | [Optional] [Defaults to `undefined`] |
| **apiSecret** | `string` |  | [Optional] [Defaults to `undefined`] |
| **config** | `string` |  | [Optional] [Defaults to `undefined`] |
| **syncUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## deletePlatformApiV1EducationPlatformPidDelete

> any deletePlatformApiV1EducationPlatformPidDelete(pid)

删除教育平台

### Example

```ts
import {
  Configuration,
  EducationPlatformApi,
} from '';
import type { DeletePlatformApiV1EducationPlatformPidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EducationPlatformApi();

  const body = {
    // number
    pid: 56,
  } satisfies DeletePlatformApiV1EducationPlatformPidDeleteRequest;

  try {
    const data = await api.deletePlatformApiV1EducationPlatformPidDelete(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |

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


## deletePlatformApiV1EducationPlatformPidDelete_0

> any deletePlatformApiV1EducationPlatformPidDelete_0(pid)

删除教育平台

### Example

```ts
import {
  Configuration,
  EducationPlatformApi,
} from '';
import type { DeletePlatformApiV1EducationPlatformPidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EducationPlatformApi();

  const body = {
    // number
    pid: 56,
  } satisfies DeletePlatformApiV1EducationPlatformPidDelete0Request;

  try {
    const data = await api.deletePlatformApiV1EducationPlatformPidDelete_0(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |

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


## listPlatformsApiV1EducationPlatformListGet

> any listPlatformsApiV1EducationPlatformListGet(status)

教育平台列表

### Example

```ts
import {
  Configuration,
  EducationPlatformApi,
} from '';
import type { ListPlatformsApiV1EducationPlatformListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EducationPlatformApi();

  const body = {
    // number (optional)
    status: 56,
  } satisfies ListPlatformsApiV1EducationPlatformListGetRequest;

  try {
    const data = await api.listPlatformsApiV1EducationPlatformListGet(body);
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


## listPlatformsApiV1EducationPlatformListGet_0

> any listPlatformsApiV1EducationPlatformListGet_0(status)

教育平台列表

### Example

```ts
import {
  Configuration,
  EducationPlatformApi,
} from '';
import type { ListPlatformsApiV1EducationPlatformListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EducationPlatformApi();

  const body = {
    // number (optional)
    status: 56,
  } satisfies ListPlatformsApiV1EducationPlatformListGet0Request;

  try {
    const data = await api.listPlatformsApiV1EducationPlatformListGet_0(body);
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


## syncLogApiV1EducationPlatformSyncLogGet

> any syncLogApiV1EducationPlatformSyncLogGet(page, limit, platformCode)

同步日志

### Example

```ts
import {
  Configuration,
  EducationPlatformApi,
} from '';
import type { SyncLogApiV1EducationPlatformSyncLogGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EducationPlatformApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    platformCode: platformCode_example,
  } satisfies SyncLogApiV1EducationPlatformSyncLogGetRequest;

  try {
    const data = await api.syncLogApiV1EducationPlatformSyncLogGet(body);
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
| **platformCode** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## syncLogApiV1EducationPlatformSyncLogGet_0

> any syncLogApiV1EducationPlatformSyncLogGet_0(page, limit, platformCode)

同步日志

### Example

```ts
import {
  Configuration,
  EducationPlatformApi,
} from '';
import type { SyncLogApiV1EducationPlatformSyncLogGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EducationPlatformApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    platformCode: platformCode_example,
  } satisfies SyncLogApiV1EducationPlatformSyncLogGet0Request;

  try {
    const data = await api.syncLogApiV1EducationPlatformSyncLogGet_0(body);
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
| **platformCode** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## syncPlatformApiV1EducationPlatformPidSyncPost

> any syncPlatformApiV1EducationPlatformPidSyncPost(pid, type, syncType)

同步数据

### Example

```ts
import {
  Configuration,
  EducationPlatformApi,
} from '';
import type { SyncPlatformApiV1EducationPlatformPidSyncPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EducationPlatformApi();

  const body = {
    // number
    pid: 56,
    // string (optional)
    type: type_example,
    // string (optional)
    syncType: syncType_example,
  } satisfies SyncPlatformApiV1EducationPlatformPidSyncPostRequest;

  try {
    const data = await api.syncPlatformApiV1EducationPlatformPidSyncPost(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;course&#39;`] |
| **syncType** | `string` |  | [Optional] [Defaults to `&#39;pull&#39;`] |

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


## syncPlatformApiV1EducationPlatformPidSyncPost_0

> any syncPlatformApiV1EducationPlatformPidSyncPost_0(pid, type, syncType)

同步数据

### Example

```ts
import {
  Configuration,
  EducationPlatformApi,
} from '';
import type { SyncPlatformApiV1EducationPlatformPidSyncPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EducationPlatformApi();

  const body = {
    // number
    pid: 56,
    // string (optional)
    type: type_example,
    // string (optional)
    syncType: syncType_example,
  } satisfies SyncPlatformApiV1EducationPlatformPidSyncPost0Request;

  try {
    const data = await api.syncPlatformApiV1EducationPlatformPidSyncPost_0(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;course&#39;`] |
| **syncType** | `string` |  | [Optional] [Defaults to `&#39;pull&#39;`] |

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


## updatePlatformApiV1EducationPlatformPidPut

> any updatePlatformApiV1EducationPlatformPidPut(pid, name, apiUrl, apiKey, apiSecret, status, config)

修改教育平台

### Example

```ts
import {
  Configuration,
  EducationPlatformApi,
} from '';
import type { UpdatePlatformApiV1EducationPlatformPidPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EducationPlatformApi();

  const body = {
    // number
    pid: 56,
    // string (optional)
    name: name_example,
    // string (optional)
    apiUrl: apiUrl_example,
    // string (optional)
    apiKey: apiKey_example,
    // string (optional)
    apiSecret: apiSecret_example,
    // number (optional)
    status: 56,
    // string (optional)
    config: config_example,
  } satisfies UpdatePlatformApiV1EducationPlatformPidPutRequest;

  try {
    const data = await api.updatePlatformApiV1EducationPlatformPidPut(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |
| **name** | `string` |  | [Optional] [Defaults to `undefined`] |
| **apiUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **apiKey** | `string` |  | [Optional] [Defaults to `undefined`] |
| **apiSecret** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **config** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## updatePlatformApiV1EducationPlatformPidPut_0

> any updatePlatformApiV1EducationPlatformPidPut_0(pid, name, apiUrl, apiKey, apiSecret, status, config)

修改教育平台

### Example

```ts
import {
  Configuration,
  EducationPlatformApi,
} from '';
import type { UpdatePlatformApiV1EducationPlatformPidPut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EducationPlatformApi();

  const body = {
    // number
    pid: 56,
    // string (optional)
    name: name_example,
    // string (optional)
    apiUrl: apiUrl_example,
    // string (optional)
    apiKey: apiKey_example,
    // string (optional)
    apiSecret: apiSecret_example,
    // number (optional)
    status: 56,
    // string (optional)
    config: config_example,
  } satisfies UpdatePlatformApiV1EducationPlatformPidPut0Request;

  try {
    const data = await api.updatePlatformApiV1EducationPlatformPidPut_0(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |
| **name** | `string` |  | [Optional] [Defaults to `undefined`] |
| **apiUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **apiKey** | `string` |  | [Optional] [Defaults to `undefined`] |
| **apiSecret** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **config** | `string` |  | [Optional] [Defaults to `undefined`] |

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

