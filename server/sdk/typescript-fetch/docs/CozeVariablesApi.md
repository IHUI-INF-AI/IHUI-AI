# CozeVariablesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createVariableApiV1CozeVariablesVariablesCreatePost**](CozeVariablesApi.md#createvariableapiv1cozevariablesvariablescreatepost) | **POST** /api/v1/coze/variables/variables/create | Create Variable |
| [**createVariableApiV1CozeVariablesVariablesCreatePost_0**](CozeVariablesApi.md#createvariableapiv1cozevariablesvariablescreatepost_0) | **POST** /api/v1/coze/variables/variables/create | Create Variable |
| [**deleteVariableApiV1CozeVariablesVariablesDeletePost**](CozeVariablesApi.md#deletevariableapiv1cozevariablesvariablesdeletepost) | **POST** /api/v1/coze/variables/variables/delete | Delete Variable |
| [**deleteVariableApiV1CozeVariablesVariablesDeletePost_0**](CozeVariablesApi.md#deletevariableapiv1cozevariablesvariablesdeletepost_0) | **POST** /api/v1/coze/variables/variables/delete | Delete Variable |
| [**listVariablesApiV1CozeVariablesVariablesListGet**](CozeVariablesApi.md#listvariablesapiv1cozevariablesvariableslistget) | **GET** /api/v1/coze/variables/variables/list | List Variables |
| [**listVariablesApiV1CozeVariablesVariablesListGet_0**](CozeVariablesApi.md#listvariablesapiv1cozevariablesvariableslistget_0) | **GET** /api/v1/coze/variables/variables/list | List Variables |
| [**retrieveVariableApiV1CozeVariablesVariablesRetrieveGet**](CozeVariablesApi.md#retrievevariableapiv1cozevariablesvariablesretrieveget) | **GET** /api/v1/coze/variables/variables/retrieve | Retrieve Variable |
| [**retrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0**](CozeVariablesApi.md#retrievevariableapiv1cozevariablesvariablesretrieveget_0) | **GET** /api/v1/coze/variables/variables/retrieve | Retrieve Variable |
| [**updateVariableApiV1CozeVariablesVariablesUpdatePost**](CozeVariablesApi.md#updatevariableapiv1cozevariablesvariablesupdatepost) | **POST** /api/v1/coze/variables/variables/update | Update Variable |
| [**updateVariableApiV1CozeVariablesVariablesUpdatePost_0**](CozeVariablesApi.md#updatevariableapiv1cozevariablesvariablesupdatepost_0) | **POST** /api/v1/coze/variables/variables/update | Update Variable |



## createVariableApiV1CozeVariablesVariablesCreatePost

> any createVariableApiV1CozeVariablesVariablesCreatePost(createVarReq)

Create Variable

### Example

```ts
import {
  Configuration,
  CozeVariablesApi,
} from '';
import type { CreateVariableApiV1CozeVariablesVariablesCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeVariablesApi();

  const body = {
    // CreateVarReq
    createVarReq: ...,
  } satisfies CreateVariableApiV1CozeVariablesVariablesCreatePostRequest;

  try {
    const data = await api.createVariableApiV1CozeVariablesVariablesCreatePost(body);
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
| **createVarReq** | [CreateVarReq](CreateVarReq.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createVariableApiV1CozeVariablesVariablesCreatePost_0

> any createVariableApiV1CozeVariablesVariablesCreatePost_0(createVarReq)

Create Variable

### Example

```ts
import {
  Configuration,
  CozeVariablesApi,
} from '';
import type { CreateVariableApiV1CozeVariablesVariablesCreatePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeVariablesApi();

  const body = {
    // CreateVarReq
    createVarReq: ...,
  } satisfies CreateVariableApiV1CozeVariablesVariablesCreatePost0Request;

  try {
    const data = await api.createVariableApiV1CozeVariablesVariablesCreatePost_0(body);
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
| **createVarReq** | [CreateVarReq](CreateVarReq.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteVariableApiV1CozeVariablesVariablesDeletePost

> any deleteVariableApiV1CozeVariablesVariablesDeletePost(deleteVarReq)

Delete Variable

### Example

```ts
import {
  Configuration,
  CozeVariablesApi,
} from '';
import type { DeleteVariableApiV1CozeVariablesVariablesDeletePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeVariablesApi();

  const body = {
    // DeleteVarReq
    deleteVarReq: ...,
  } satisfies DeleteVariableApiV1CozeVariablesVariablesDeletePostRequest;

  try {
    const data = await api.deleteVariableApiV1CozeVariablesVariablesDeletePost(body);
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
| **deleteVarReq** | [DeleteVarReq](DeleteVarReq.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteVariableApiV1CozeVariablesVariablesDeletePost_0

> any deleteVariableApiV1CozeVariablesVariablesDeletePost_0(deleteVarReq)

Delete Variable

### Example

```ts
import {
  Configuration,
  CozeVariablesApi,
} from '';
import type { DeleteVariableApiV1CozeVariablesVariablesDeletePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeVariablesApi();

  const body = {
    // DeleteVarReq
    deleteVarReq: ...,
  } satisfies DeleteVariableApiV1CozeVariablesVariablesDeletePost0Request;

  try {
    const data = await api.deleteVariableApiV1CozeVariablesVariablesDeletePost_0(body);
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
| **deleteVarReq** | [DeleteVarReq](DeleteVarReq.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listVariablesApiV1CozeVariablesVariablesListGet

> any listVariablesApiV1CozeVariablesVariablesListGet(connectorId, page, size)

List Variables

### Example

```ts
import {
  Configuration,
  CozeVariablesApi,
} from '';
import type { ListVariablesApiV1CozeVariablesVariablesListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeVariablesApi();

  const body = {
    // string
    connectorId: connectorId_example,
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies ListVariablesApiV1CozeVariablesVariablesListGetRequest;

  try {
    const data = await api.listVariablesApiV1CozeVariablesVariablesListGet(body);
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
| **connectorId** | `string` |  | [Defaults to `undefined`] |
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


## listVariablesApiV1CozeVariablesVariablesListGet_0

> any listVariablesApiV1CozeVariablesVariablesListGet_0(connectorId, page, size)

List Variables

### Example

```ts
import {
  Configuration,
  CozeVariablesApi,
} from '';
import type { ListVariablesApiV1CozeVariablesVariablesListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeVariablesApi();

  const body = {
    // string
    connectorId: connectorId_example,
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies ListVariablesApiV1CozeVariablesVariablesListGet0Request;

  try {
    const data = await api.listVariablesApiV1CozeVariablesVariablesListGet_0(body);
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
| **connectorId** | `string` |  | [Defaults to `undefined`] |
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


## retrieveVariableApiV1CozeVariablesVariablesRetrieveGet

> any retrieveVariableApiV1CozeVariablesVariablesRetrieveGet(connectorId, variableId)

Retrieve Variable

### Example

```ts
import {
  Configuration,
  CozeVariablesApi,
} from '';
import type { RetrieveVariableApiV1CozeVariablesVariablesRetrieveGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeVariablesApi();

  const body = {
    // string
    connectorId: connectorId_example,
    // string
    variableId: variableId_example,
  } satisfies RetrieveVariableApiV1CozeVariablesVariablesRetrieveGetRequest;

  try {
    const data = await api.retrieveVariableApiV1CozeVariablesVariablesRetrieveGet(body);
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
| **connectorId** | `string` |  | [Defaults to `undefined`] |
| **variableId** | `string` |  | [Defaults to `undefined`] |

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


## retrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0

> any retrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0(connectorId, variableId)

Retrieve Variable

### Example

```ts
import {
  Configuration,
  CozeVariablesApi,
} from '';
import type { RetrieveVariableApiV1CozeVariablesVariablesRetrieveGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeVariablesApi();

  const body = {
    // string
    connectorId: connectorId_example,
    // string
    variableId: variableId_example,
  } satisfies RetrieveVariableApiV1CozeVariablesVariablesRetrieveGet0Request;

  try {
    const data = await api.retrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0(body);
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
| **connectorId** | `string` |  | [Defaults to `undefined`] |
| **variableId** | `string` |  | [Defaults to `undefined`] |

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


## updateVariableApiV1CozeVariablesVariablesUpdatePost

> any updateVariableApiV1CozeVariablesVariablesUpdatePost(updateVarReq)

Update Variable

### Example

```ts
import {
  Configuration,
  CozeVariablesApi,
} from '';
import type { UpdateVariableApiV1CozeVariablesVariablesUpdatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeVariablesApi();

  const body = {
    // UpdateVarReq
    updateVarReq: ...,
  } satisfies UpdateVariableApiV1CozeVariablesVariablesUpdatePostRequest;

  try {
    const data = await api.updateVariableApiV1CozeVariablesVariablesUpdatePost(body);
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
| **updateVarReq** | [UpdateVarReq](UpdateVarReq.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateVariableApiV1CozeVariablesVariablesUpdatePost_0

> any updateVariableApiV1CozeVariablesVariablesUpdatePost_0(updateVarReq)

Update Variable

### Example

```ts
import {
  Configuration,
  CozeVariablesApi,
} from '';
import type { UpdateVariableApiV1CozeVariablesVariablesUpdatePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeVariablesApi();

  const body = {
    // UpdateVarReq
    updateVarReq: ...,
  } satisfies UpdateVariableApiV1CozeVariablesVariablesUpdatePost0Request;

  try {
    const data = await api.updateVariableApiV1CozeVariablesVariablesUpdatePost_0(body);
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
| **updateVarReq** | [UpdateVarReq](UpdateVarReq.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

