# ServiceCatalogApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**callLogListApiV1ServiceCatalogLogListGet**](ServiceCatalogApi.md#callloglistapiv1servicecatalogloglistget) | **GET** /api/v1/service-catalog/log/list | 服务调用日志 |
| [**callLogListApiV1ServiceCatalogLogListGet_0**](ServiceCatalogApi.md#callloglistapiv1servicecatalogloglistget_0) | **GET** /api/v1/service-catalog/log/list | 服务调用日志 |
| [**deleteServiceApiV1ServiceCatalogSidDelete**](ServiceCatalogApi.md#deleteserviceapiv1servicecatalogsiddelete) | **DELETE** /api/v1/service-catalog/{sid} | 下线服务 |
| [**deleteServiceApiV1ServiceCatalogSidDelete_0**](ServiceCatalogApi.md#deleteserviceapiv1servicecatalogsiddelete_0) | **DELETE** /api/v1/service-catalog/{sid} | 下线服务 |
| [**getServiceApiV1ServiceCatalogSidGet**](ServiceCatalogApi.md#getserviceapiv1servicecatalogsidget) | **GET** /api/v1/service-catalog/{sid} | 服务详情 |
| [**getServiceApiV1ServiceCatalogSidGet_0**](ServiceCatalogApi.md#getserviceapiv1servicecatalogsidget_0) | **GET** /api/v1/service-catalog/{sid} | 服务详情 |
| [**heartbeatApiV1ServiceCatalogSidHeartbeatPost**](ServiceCatalogApi.md#heartbeatapiv1servicecatalogsidheartbeatpost) | **POST** /api/v1/service-catalog/{sid}/heartbeat | 心跳上报 |
| [**heartbeatApiV1ServiceCatalogSidHeartbeatPost_0**](ServiceCatalogApi.md#heartbeatapiv1servicecatalogsidheartbeatpost_0) | **POST** /api/v1/service-catalog/{sid}/heartbeat | 心跳上报 |
| [**registerApiV1ServiceCatalogPost**](ServiceCatalogApi.md#registerapiv1servicecatalogpost) | **POST** /api/v1/service-catalog | 注册服务 |
| [**registerApiV1ServiceCatalogPost_0**](ServiceCatalogApi.md#registerapiv1servicecatalogpost_0) | **POST** /api/v1/service-catalog | 注册服务 |
| [**serviceListApiV1ServiceCatalogListGet**](ServiceCatalogApi.md#servicelistapiv1servicecataloglistget) | **GET** /api/v1/service-catalog/list | 服务列表 |
| [**serviceListApiV1ServiceCatalogListGet_0**](ServiceCatalogApi.md#servicelistapiv1servicecataloglistget_0) | **GET** /api/v1/service-catalog/list | 服务列表 |
| [**updateServiceApiV1ServiceCatalogSidPut**](ServiceCatalogApi.md#updateserviceapiv1servicecatalogsidput) | **PUT** /api/v1/service-catalog/{sid} | 更新服务 |
| [**updateServiceApiV1ServiceCatalogSidPut_0**](ServiceCatalogApi.md#updateserviceapiv1servicecatalogsidput_0) | **PUT** /api/v1/service-catalog/{sid} | 更新服务 |



## callLogListApiV1ServiceCatalogLogListGet

> any callLogListApiV1ServiceCatalogLogListGet(page, limit, serviceCode, status)

服务调用日志

### Example

```ts
import {
  Configuration,
  ServiceCatalogApi,
} from '';
import type { CallLogListApiV1ServiceCatalogLogListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ServiceCatalogApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    serviceCode: serviceCode_example,
    // number (optional)
    status: 56,
  } satisfies CallLogListApiV1ServiceCatalogLogListGetRequest;

  try {
    const data = await api.callLogListApiV1ServiceCatalogLogListGet(body);
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
| **serviceCode** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## callLogListApiV1ServiceCatalogLogListGet_0

> any callLogListApiV1ServiceCatalogLogListGet_0(page, limit, serviceCode, status)

服务调用日志

### Example

```ts
import {
  Configuration,
  ServiceCatalogApi,
} from '';
import type { CallLogListApiV1ServiceCatalogLogListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ServiceCatalogApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    serviceCode: serviceCode_example,
    // number (optional)
    status: 56,
  } satisfies CallLogListApiV1ServiceCatalogLogListGet0Request;

  try {
    const data = await api.callLogListApiV1ServiceCatalogLogListGet_0(body);
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
| **serviceCode** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## deleteServiceApiV1ServiceCatalogSidDelete

> any deleteServiceApiV1ServiceCatalogSidDelete(sid)

下线服务

### Example

```ts
import {
  Configuration,
  ServiceCatalogApi,
} from '';
import type { DeleteServiceApiV1ServiceCatalogSidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ServiceCatalogApi();

  const body = {
    // number
    sid: 56,
  } satisfies DeleteServiceApiV1ServiceCatalogSidDeleteRequest;

  try {
    const data = await api.deleteServiceApiV1ServiceCatalogSidDelete(body);
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
| **sid** | `number` |  | [Defaults to `undefined`] |

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


## deleteServiceApiV1ServiceCatalogSidDelete_0

> any deleteServiceApiV1ServiceCatalogSidDelete_0(sid)

下线服务

### Example

```ts
import {
  Configuration,
  ServiceCatalogApi,
} from '';
import type { DeleteServiceApiV1ServiceCatalogSidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ServiceCatalogApi();

  const body = {
    // number
    sid: 56,
  } satisfies DeleteServiceApiV1ServiceCatalogSidDelete0Request;

  try {
    const data = await api.deleteServiceApiV1ServiceCatalogSidDelete_0(body);
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
| **sid** | `number` |  | [Defaults to `undefined`] |

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


## getServiceApiV1ServiceCatalogSidGet

> any getServiceApiV1ServiceCatalogSidGet(sid)

服务详情

### Example

```ts
import {
  Configuration,
  ServiceCatalogApi,
} from '';
import type { GetServiceApiV1ServiceCatalogSidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ServiceCatalogApi();

  const body = {
    // number
    sid: 56,
  } satisfies GetServiceApiV1ServiceCatalogSidGetRequest;

  try {
    const data = await api.getServiceApiV1ServiceCatalogSidGet(body);
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
| **sid** | `number` |  | [Defaults to `undefined`] |

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


## getServiceApiV1ServiceCatalogSidGet_0

> any getServiceApiV1ServiceCatalogSidGet_0(sid)

服务详情

### Example

```ts
import {
  Configuration,
  ServiceCatalogApi,
} from '';
import type { GetServiceApiV1ServiceCatalogSidGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ServiceCatalogApi();

  const body = {
    // number
    sid: 56,
  } satisfies GetServiceApiV1ServiceCatalogSidGet0Request;

  try {
    const data = await api.getServiceApiV1ServiceCatalogSidGet_0(body);
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
| **sid** | `number` |  | [Defaults to `undefined`] |

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


## heartbeatApiV1ServiceCatalogSidHeartbeatPost

> any heartbeatApiV1ServiceCatalogSidHeartbeatPost(sid, isHealthy, errorMsg)

心跳上报

### Example

```ts
import {
  Configuration,
  ServiceCatalogApi,
} from '';
import type { HeartbeatApiV1ServiceCatalogSidHeartbeatPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ServiceCatalogApi();

  const body = {
    // number
    sid: 56,
    // boolean (optional)
    isHealthy: true,
    // string (optional)
    errorMsg: errorMsg_example,
  } satisfies HeartbeatApiV1ServiceCatalogSidHeartbeatPostRequest;

  try {
    const data = await api.heartbeatApiV1ServiceCatalogSidHeartbeatPost(body);
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
| **sid** | `number` |  | [Defaults to `undefined`] |
| **isHealthy** | `boolean` |  | [Optional] [Defaults to `true`] |
| **errorMsg** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## heartbeatApiV1ServiceCatalogSidHeartbeatPost_0

> any heartbeatApiV1ServiceCatalogSidHeartbeatPost_0(sid, isHealthy, errorMsg)

心跳上报

### Example

```ts
import {
  Configuration,
  ServiceCatalogApi,
} from '';
import type { HeartbeatApiV1ServiceCatalogSidHeartbeatPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ServiceCatalogApi();

  const body = {
    // number
    sid: 56,
    // boolean (optional)
    isHealthy: true,
    // string (optional)
    errorMsg: errorMsg_example,
  } satisfies HeartbeatApiV1ServiceCatalogSidHeartbeatPost0Request;

  try {
    const data = await api.heartbeatApiV1ServiceCatalogSidHeartbeatPost_0(body);
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
| **sid** | `number` |  | [Defaults to `undefined`] |
| **isHealthy** | `boolean` |  | [Optional] [Defaults to `true`] |
| **errorMsg** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## registerApiV1ServiceCatalogPost

> any registerApiV1ServiceCatalogPost(code, name, type, host, port, path, version, description, group, tags, healthUrl, weight, config)

注册服务

### Example

```ts
import {
  Configuration,
  ServiceCatalogApi,
} from '';
import type { RegisterApiV1ServiceCatalogPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ServiceCatalogApi();

  const body = {
    // string
    code: code_example,
    // string
    name: name_example,
    // string (optional)
    type: type_example,
    // string (optional)
    host: host_example,
    // number (optional)
    port: 56,
    // string (optional)
    path: path_example,
    // string (optional)
    version: version_example,
    // string (optional)
    description: description_example,
    // string (optional)
    group: group_example,
    // string (optional)
    tags: tags_example,
    // string (optional)
    healthUrl: healthUrl_example,
    // number (optional)
    weight: 56,
    // string (optional)
    config: config_example,
  } satisfies RegisterApiV1ServiceCatalogPostRequest;

  try {
    const data = await api.registerApiV1ServiceCatalogPost(body);
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
| **code** | `string` |  | [Defaults to `undefined`] |
| **name** | `string` |  | [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;api&#39;`] |
| **host** | `string` |  | [Optional] [Defaults to `undefined`] |
| **port** | `number` |  | [Optional] [Defaults to `0`] |
| **path** | `string` |  | [Optional] [Defaults to `&#39;/&#39;`] |
| **version** | `string` |  | [Optional] [Defaults to `&#39;1.0.0&#39;`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **group** | `string` |  | [Optional] [Defaults to `&#39;default&#39;`] |
| **tags** | `string` |  | [Optional] [Defaults to `undefined`] |
| **healthUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **weight** | `number` |  | [Optional] [Defaults to `1`] |
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


## registerApiV1ServiceCatalogPost_0

> any registerApiV1ServiceCatalogPost_0(code, name, type, host, port, path, version, description, group, tags, healthUrl, weight, config)

注册服务

### Example

```ts
import {
  Configuration,
  ServiceCatalogApi,
} from '';
import type { RegisterApiV1ServiceCatalogPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ServiceCatalogApi();

  const body = {
    // string
    code: code_example,
    // string
    name: name_example,
    // string (optional)
    type: type_example,
    // string (optional)
    host: host_example,
    // number (optional)
    port: 56,
    // string (optional)
    path: path_example,
    // string (optional)
    version: version_example,
    // string (optional)
    description: description_example,
    // string (optional)
    group: group_example,
    // string (optional)
    tags: tags_example,
    // string (optional)
    healthUrl: healthUrl_example,
    // number (optional)
    weight: 56,
    // string (optional)
    config: config_example,
  } satisfies RegisterApiV1ServiceCatalogPost0Request;

  try {
    const data = await api.registerApiV1ServiceCatalogPost_0(body);
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
| **code** | `string` |  | [Defaults to `undefined`] |
| **name** | `string` |  | [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;api&#39;`] |
| **host** | `string` |  | [Optional] [Defaults to `undefined`] |
| **port** | `number` |  | [Optional] [Defaults to `0`] |
| **path** | `string` |  | [Optional] [Defaults to `&#39;/&#39;`] |
| **version** | `string` |  | [Optional] [Defaults to `&#39;1.0.0&#39;`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **group** | `string` |  | [Optional] [Defaults to `&#39;default&#39;`] |
| **tags** | `string` |  | [Optional] [Defaults to `undefined`] |
| **healthUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **weight** | `number` |  | [Optional] [Defaults to `1`] |
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


## serviceListApiV1ServiceCatalogListGet

> any serviceListApiV1ServiceCatalogListGet(group, type, status, keyword)

服务列表

### Example

```ts
import {
  Configuration,
  ServiceCatalogApi,
} from '';
import type { ServiceListApiV1ServiceCatalogListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ServiceCatalogApi();

  const body = {
    // string (optional)
    group: group_example,
    // string (optional)
    type: type_example,
    // number (optional)
    status: 56,
    // string (optional)
    keyword: keyword_example,
  } satisfies ServiceListApiV1ServiceCatalogListGetRequest;

  try {
    const data = await api.serviceListApiV1ServiceCatalogListGet(body);
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
| **group** | `string` |  | [Optional] [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **keyword** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## serviceListApiV1ServiceCatalogListGet_0

> any serviceListApiV1ServiceCatalogListGet_0(group, type, status, keyword)

服务列表

### Example

```ts
import {
  Configuration,
  ServiceCatalogApi,
} from '';
import type { ServiceListApiV1ServiceCatalogListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ServiceCatalogApi();

  const body = {
    // string (optional)
    group: group_example,
    // string (optional)
    type: type_example,
    // number (optional)
    status: 56,
    // string (optional)
    keyword: keyword_example,
  } satisfies ServiceListApiV1ServiceCatalogListGet0Request;

  try {
    const data = await api.serviceListApiV1ServiceCatalogListGet_0(body);
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
| **group** | `string` |  | [Optional] [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **keyword** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## updateServiceApiV1ServiceCatalogSidPut

> any updateServiceApiV1ServiceCatalogSidPut(sid, name, host, port, status, weight, config)

更新服务

### Example

```ts
import {
  Configuration,
  ServiceCatalogApi,
} from '';
import type { UpdateServiceApiV1ServiceCatalogSidPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ServiceCatalogApi();

  const body = {
    // number
    sid: 56,
    // string (optional)
    name: name_example,
    // string (optional)
    host: host_example,
    // number (optional)
    port: 56,
    // number (optional)
    status: 56,
    // number (optional)
    weight: 56,
    // string (optional)
    config: config_example,
  } satisfies UpdateServiceApiV1ServiceCatalogSidPutRequest;

  try {
    const data = await api.updateServiceApiV1ServiceCatalogSidPut(body);
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
| **sid** | `number` |  | [Defaults to `undefined`] |
| **name** | `string` |  | [Optional] [Defaults to `undefined`] |
| **host** | `string` |  | [Optional] [Defaults to `undefined`] |
| **port** | `number` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **weight** | `number` |  | [Optional] [Defaults to `undefined`] |
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


## updateServiceApiV1ServiceCatalogSidPut_0

> any updateServiceApiV1ServiceCatalogSidPut_0(sid, name, host, port, status, weight, config)

更新服务

### Example

```ts
import {
  Configuration,
  ServiceCatalogApi,
} from '';
import type { UpdateServiceApiV1ServiceCatalogSidPut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ServiceCatalogApi();

  const body = {
    // number
    sid: 56,
    // string (optional)
    name: name_example,
    // string (optional)
    host: host_example,
    // number (optional)
    port: 56,
    // number (optional)
    status: 56,
    // number (optional)
    weight: 56,
    // string (optional)
    config: config_example,
  } satisfies UpdateServiceApiV1ServiceCatalogSidPut0Request;

  try {
    const data = await api.updateServiceApiV1ServiceCatalogSidPut_0(body);
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
| **sid** | `number` |  | [Defaults to `undefined`] |
| **name** | `string` |  | [Optional] [Defaults to `undefined`] |
| **host** | `string` |  | [Optional] [Defaults to `undefined`] |
| **port** | `number` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **weight** | `number` |  | [Optional] [Defaults to `undefined`] |
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

