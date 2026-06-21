# CozeAppsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**listApiAppsApiV1CozeAppsAppsListApiAppsGet**](CozeAppsApi.md#listapiappsapiv1cozeappsappslistapiappsget) | **GET** /api/v1/coze/apps/apps/list_api_apps | List Api Apps |
| [**listApiAppsApiV1CozeAppsAppsListApiAppsGet_0**](CozeAppsApi.md#listapiappsapiv1cozeappsappslistapiappsget_0) | **GET** /api/v1/coze/apps/apps/list_api_apps | List Api Apps |
| [**listAppEventsApiV1CozeAppsAppsEventsGet**](CozeAppsApi.md#listappeventsapiv1cozeappsappseventsget) | **GET** /api/v1/coze/apps/apps/events | List App Events |
| [**listAppEventsApiV1CozeAppsAppsEventsGet_0**](CozeAppsApi.md#listappeventsapiv1cozeappsappseventsget_0) | **GET** /api/v1/coze/apps/apps/events | List App Events |
| [**listAppsApiV1CozeAppsAppsListGet**](CozeAppsApi.md#listappsapiv1cozeappsappslistget) | **GET** /api/v1/coze/apps/apps/list | List Apps |
| [**listAppsApiV1CozeAppsAppsListGet_0**](CozeAppsApi.md#listappsapiv1cozeappsappslistget_0) | **GET** /api/v1/coze/apps/apps/list | List Apps |



## listApiAppsApiV1CozeAppsAppsListApiAppsGet

> any listApiAppsApiV1CozeAppsAppsListApiAppsGet(page, size)

List Api Apps

### Example

```ts
import {
  Configuration,
  CozeAppsApi,
} from '';
import type { ListApiAppsApiV1CozeAppsAppsListApiAppsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAppsApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies ListApiAppsApiV1CozeAppsAppsListApiAppsGetRequest;

  try {
    const data = await api.listApiAppsApiV1CozeAppsAppsListApiAppsGet(body);
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
| **size** | `number` |  | [Optional] [Defaults to `20`] |

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


## listApiAppsApiV1CozeAppsAppsListApiAppsGet_0

> any listApiAppsApiV1CozeAppsAppsListApiAppsGet_0(page, size)

List Api Apps

### Example

```ts
import {
  Configuration,
  CozeAppsApi,
} from '';
import type { ListApiAppsApiV1CozeAppsAppsListApiAppsGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAppsApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies ListApiAppsApiV1CozeAppsAppsListApiAppsGet0Request;

  try {
    const data = await api.listApiAppsApiV1CozeAppsAppsListApiAppsGet_0(body);
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
| **size** | `number` |  | [Optional] [Defaults to `20`] |

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


## listAppEventsApiV1CozeAppsAppsEventsGet

> any listAppEventsApiV1CozeAppsAppsEventsGet(appId, page, size)

List App Events

### Example

```ts
import {
  Configuration,
  CozeAppsApi,
} from '';
import type { ListAppEventsApiV1CozeAppsAppsEventsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAppsApi();

  const body = {
    // string
    appId: appId_example,
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies ListAppEventsApiV1CozeAppsAppsEventsGetRequest;

  try {
    const data = await api.listAppEventsApiV1CozeAppsAppsEventsGet(body);
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
| **appId** | `string` |  | [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **size** | `number` |  | [Optional] [Defaults to `20`] |

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


## listAppEventsApiV1CozeAppsAppsEventsGet_0

> any listAppEventsApiV1CozeAppsAppsEventsGet_0(appId, page, size)

List App Events

### Example

```ts
import {
  Configuration,
  CozeAppsApi,
} from '';
import type { ListAppEventsApiV1CozeAppsAppsEventsGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAppsApi();

  const body = {
    // string
    appId: appId_example,
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies ListAppEventsApiV1CozeAppsAppsEventsGet0Request;

  try {
    const data = await api.listAppEventsApiV1CozeAppsAppsEventsGet_0(body);
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
| **appId** | `string` |  | [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **size** | `number` |  | [Optional] [Defaults to `20`] |

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


## listAppsApiV1CozeAppsAppsListGet

> any listAppsApiV1CozeAppsAppsListGet(page, size)

List Apps

### Example

```ts
import {
  Configuration,
  CozeAppsApi,
} from '';
import type { ListAppsApiV1CozeAppsAppsListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAppsApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies ListAppsApiV1CozeAppsAppsListGetRequest;

  try {
    const data = await api.listAppsApiV1CozeAppsAppsListGet(body);
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
| **size** | `number` |  | [Optional] [Defaults to `20`] |

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


## listAppsApiV1CozeAppsAppsListGet_0

> any listAppsApiV1CozeAppsAppsListGet_0(page, size)

List Apps

### Example

```ts
import {
  Configuration,
  CozeAppsApi,
} from '';
import type { ListAppsApiV1CozeAppsAppsListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAppsApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies ListAppsApiV1CozeAppsAppsListGet0Request;

  try {
    const data = await api.listAppsApiV1CozeAppsAppsListGet_0(body);
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
| **size** | `number` |  | [Optional] [Defaults to `20`] |

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

