# RemoteDeviceApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**agentByCollectApiV1RemoteAgentByCollectUuidGet**](RemoteDeviceApi.md#agentbycollectapiv1remoteagentbycollectuuidget) | **GET** /api/v1/remote/agent/by/collect/{uuid} | Agent By Collect |
| [**agentByCollectApiV1RemoteAgentByCollectUuidGet_0**](RemoteDeviceApi.md#agentbycollectapiv1remoteagentbycollectuuidget_0) | **GET** /api/v1/remote/agent/by/collect/{uuid} | Agent By Collect |
| [**agentByPayApiV1RemoteAgentByPayGet**](RemoteDeviceApi.md#agentbypayapiv1remoteagentbypayget) | **GET** /api/v1/remote/agent/by/pay | Agent By Pay |
| [**agentByPayApiV1RemoteAgentByPayGet_0**](RemoteDeviceApi.md#agentbypayapiv1remoteagentbypayget_0) | **GET** /api/v1/remote/agent/by/pay | Agent By Pay |
| [**agentByTypeApiV1RemoteAgentByTypeGet**](RemoteDeviceApi.md#agentbytypeapiv1remoteagentbytypeget) | **GET** /api/v1/remote/agent/by/type | Agent By Type |
| [**agentByTypeApiV1RemoteAgentByTypeGet_0**](RemoteDeviceApi.md#agentbytypeapiv1remoteagentbytypeget_0) | **GET** /api/v1/remote/agent/by/type | Agent By Type |
| [**agentCategory2ApiV1RemoteAgentCategory2Get**](RemoteDeviceApi.md#agentcategory2apiv1remoteagentcategory2get) | **GET** /api/v1/remote/agent/category2 | Agent Category2 |
| [**agentCategory2ApiV1RemoteAgentCategory2Get_0**](RemoteDeviceApi.md#agentcategory2apiv1remoteagentcategory2get_0) | **GET** /api/v1/remote/agent/category2 | Agent Category2 |
| [**agentCategoryApiV1RemoteAgentCategoryGet**](RemoteDeviceApi.md#agentcategoryapiv1remoteagentcategoryget) | **GET** /api/v1/remote/agent/category | Agent Category |
| [**agentCategoryApiV1RemoteAgentCategoryGet_0**](RemoteDeviceApi.md#agentcategoryapiv1remoteagentcategoryget_0) | **GET** /api/v1/remote/agent/category | Agent Category |
| [**getInfoApiV1RemoteInfoUuidGet**](RemoteDeviceApi.md#getinfoapiv1remoteinfouuidget) | **GET** /api/v1/remote/info/{uuid} | Get Info |
| [**getInfoApiV1RemoteInfoUuidGet_0**](RemoteDeviceApi.md#getinfoapiv1remoteinfouuidget_0) | **GET** /api/v1/remote/info/{uuid} | Get Info |
| [**getRoleApiV1RemoteRoleGet**](RemoteDeviceApi.md#getroleapiv1remoteroleget) | **GET** /api/v1/remote/role | Get Role |
| [**getRoleApiV1RemoteRoleGet_0**](RemoteDeviceApi.md#getroleapiv1remoteroleget_0) | **GET** /api/v1/remote/role | Get Role |
| [**getWithdrawalOpenApiV1RemoteGetTrueGet**](RemoteDeviceApi.md#getwithdrawalopenapiv1remotegettrueget) | **GET** /api/v1/remote/get/true | Get Withdrawal Open |
| [**getWithdrawalOpenApiV1RemoteGetTrueGet_0**](RemoteDeviceApi.md#getwithdrawalopenapiv1remotegettrueget_0) | **GET** /api/v1/remote/get/true | Get Withdrawal Open |
| [**myTeamApiV1RemoteMyTeamUuidPost**](RemoteDeviceApi.md#myteamapiv1remotemyteamuuidpost) | **POST** /api/v1/remote/myTeam/{uuid} | My Team |
| [**myTeamApiV1RemoteMyTeamUuidPost_0**](RemoteDeviceApi.md#myteamapiv1remotemyteamuuidpost_0) | **POST** /api/v1/remote/myTeam/{uuid} | My Team |
| [**tencentAsrApiV1RemoteGetTencentSentencePost**](RemoteDeviceApi.md#tencentasrapiv1remotegettencentsentencepost) | **POST** /api/v1/remote/get/tencent/sentence | Tencent Asr |
| [**tencentAsrApiV1RemoteGetTencentSentencePost_0**](RemoteDeviceApi.md#tencentasrapiv1remotegettencentsentencepost_0) | **POST** /api/v1/remote/get/tencent/sentence | Tencent Asr |
| [**uploadBusinessCardApiV1RemoteUploadBusinessCardPost**](RemoteDeviceApi.md#uploadbusinesscardapiv1remoteuploadbusinesscardpost) | **POST** /api/v1/remote/uploadBusinessCard | Upload Business Card |
| [**uploadBusinessCardApiV1RemoteUploadBusinessCardPost_0**](RemoteDeviceApi.md#uploadbusinesscardapiv1remoteuploadbusinesscardpost_0) | **POST** /api/v1/remote/uploadBusinessCard | Upload Business Card |



## agentByCollectApiV1RemoteAgentByCollectUuidGet

> any agentByCollectApiV1RemoteAgentByCollectUuidGet(uuid, search, page, size)

Agent By Collect

对应 Java: GET /remote/agent/by/collect/{uuid}?search&#x3D; (查收藏表, 此处简化).

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { AgentByCollectApiV1RemoteAgentByCollectUuidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  const body = {
    // string
    uuid: uuid_example,
    // string (optional)
    search: search_example,
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies AgentByCollectApiV1RemoteAgentByCollectUuidGetRequest;

  try {
    const data = await api.agentByCollectApiV1RemoteAgentByCollectUuidGet(body);
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
| **uuid** | `string` |  | [Defaults to `undefined`] |
| **search** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## agentByCollectApiV1RemoteAgentByCollectUuidGet_0

> any agentByCollectApiV1RemoteAgentByCollectUuidGet_0(uuid, search, page, size)

Agent By Collect

对应 Java: GET /remote/agent/by/collect/{uuid}?search&#x3D; (查收藏表, 此处简化).

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { AgentByCollectApiV1RemoteAgentByCollectUuidGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  const body = {
    // string
    uuid: uuid_example,
    // string (optional)
    search: search_example,
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies AgentByCollectApiV1RemoteAgentByCollectUuidGet0Request;

  try {
    const data = await api.agentByCollectApiV1RemoteAgentByCollectUuidGet_0(body);
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
| **uuid** | `string` |  | [Defaults to `undefined`] |
| **search** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## agentByPayApiV1RemoteAgentByPayGet

> any agentByPayApiV1RemoteAgentByPayGet(uuid, search, type, date, page, size)

Agent By Pay

对应 Java: GET /remote/agent/by/pay?uuid&#x3D;&amp;search&#x3D;&amp;type&#x3D;&amp;date&#x3D;

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { AgentByPayApiV1RemoteAgentByPayGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  const body = {
    // string
    uuid: uuid_example,
    // string (optional)
    search: search_example,
    // number (optional)
    type: 56,
    // string (optional)
    date: date_example,
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies AgentByPayApiV1RemoteAgentByPayGetRequest;

  try {
    const data = await api.agentByPayApiV1RemoteAgentByPayGet(body);
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
| **uuid** | `string` |  | [Defaults to `undefined`] |
| **search** | `string` |  | [Optional] [Defaults to `undefined`] |
| **type** | `number` |  | [Optional] [Defaults to `undefined`] |
| **date** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## agentByPayApiV1RemoteAgentByPayGet_0

> any agentByPayApiV1RemoteAgentByPayGet_0(uuid, search, type, date, page, size)

Agent By Pay

对应 Java: GET /remote/agent/by/pay?uuid&#x3D;&amp;search&#x3D;&amp;type&#x3D;&amp;date&#x3D;

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { AgentByPayApiV1RemoteAgentByPayGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  const body = {
    // string
    uuid: uuid_example,
    // string (optional)
    search: search_example,
    // number (optional)
    type: 56,
    // string (optional)
    date: date_example,
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies AgentByPayApiV1RemoteAgentByPayGet0Request;

  try {
    const data = await api.agentByPayApiV1RemoteAgentByPayGet_0(body);
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
| **uuid** | `string` |  | [Defaults to `undefined`] |
| **search** | `string` |  | [Optional] [Defaults to `undefined`] |
| **type** | `number` |  | [Optional] [Defaults to `undefined`] |
| **date** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## agentByTypeApiV1RemoteAgentByTypeGet

> any agentByTypeApiV1RemoteAgentByTypeGet(search, code, page, size)

Agent By Type

对应 Java: GET /remote/agent/by/type?search&#x3D;&amp;code&#x3D;

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { AgentByTypeApiV1RemoteAgentByTypeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  const body = {
    // string (optional)
    search: search_example,
    // string (optional)
    code: code_example,
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies AgentByTypeApiV1RemoteAgentByTypeGetRequest;

  try {
    const data = await api.agentByTypeApiV1RemoteAgentByTypeGet(body);
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
| **search** | `string` |  | [Optional] [Defaults to `undefined`] |
| **code** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## agentByTypeApiV1RemoteAgentByTypeGet_0

> any agentByTypeApiV1RemoteAgentByTypeGet_0(search, code, page, size)

Agent By Type

对应 Java: GET /remote/agent/by/type?search&#x3D;&amp;code&#x3D;

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { AgentByTypeApiV1RemoteAgentByTypeGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  const body = {
    // string (optional)
    search: search_example,
    // string (optional)
    code: code_example,
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies AgentByTypeApiV1RemoteAgentByTypeGet0Request;

  try {
    const data = await api.agentByTypeApiV1RemoteAgentByTypeGet_0(body);
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
| **search** | `string` |  | [Optional] [Defaults to `undefined`] |
| **code** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## agentCategory2ApiV1RemoteAgentCategory2Get

> any agentCategory2ApiV1RemoteAgentCategory2Get(type)

Agent Category2

对应 Java: GET /remote/agent/category2 — AjaxResult 包装 (与上同结构).

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { AgentCategory2ApiV1RemoteAgentCategory2GetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  const body = {
    // string (optional)
    type: type_example,
  } satisfies AgentCategory2ApiV1RemoteAgentCategory2GetRequest;

  try {
    const data = await api.agentCategory2ApiV1RemoteAgentCategory2Get(body);
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
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## agentCategory2ApiV1RemoteAgentCategory2Get_0

> any agentCategory2ApiV1RemoteAgentCategory2Get_0(type)

Agent Category2

对应 Java: GET /remote/agent/category2 — AjaxResult 包装 (与上同结构).

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { AgentCategory2ApiV1RemoteAgentCategory2Get0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  const body = {
    // string (optional)
    type: type_example,
  } satisfies AgentCategory2ApiV1RemoteAgentCategory2Get0Request;

  try {
    const data = await api.agentCategory2ApiV1RemoteAgentCategory2Get_0(body);
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
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## agentCategoryApiV1RemoteAgentCategoryGet

> any agentCategoryApiV1RemoteAgentCategoryGet(type)

Agent Category

对应 Java: GET /remote/agent/category?type&#x3D;xxx — ResponseResultInfo 包装.

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { AgentCategoryApiV1RemoteAgentCategoryGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  const body = {
    // string (optional)
    type: type_example,
  } satisfies AgentCategoryApiV1RemoteAgentCategoryGetRequest;

  try {
    const data = await api.agentCategoryApiV1RemoteAgentCategoryGet(body);
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
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## agentCategoryApiV1RemoteAgentCategoryGet_0

> any agentCategoryApiV1RemoteAgentCategoryGet_0(type)

Agent Category

对应 Java: GET /remote/agent/category?type&#x3D;xxx — ResponseResultInfo 包装.

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { AgentCategoryApiV1RemoteAgentCategoryGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  const body = {
    // string (optional)
    type: type_example,
  } satisfies AgentCategoryApiV1RemoteAgentCategoryGet0Request;

  try {
    const data = await api.agentCategoryApiV1RemoteAgentCategoryGet_0(body);
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
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## getInfoApiV1RemoteInfoUuidGet

> any getInfoApiV1RemoteInfoUuidGet(uuid, xDeviceType)

Get Info

对应 Java: GET /remote/info/{uuid} — 用户基本信息 + 第三方账号绑定.

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { GetInfoApiV1RemoteInfoUuidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  const body = {
    // string
    uuid: uuid_example,
    // string (optional)
    xDeviceType: xDeviceType_example,
  } satisfies GetInfoApiV1RemoteInfoUuidGetRequest;

  try {
    const data = await api.getInfoApiV1RemoteInfoUuidGet(body);
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
| **uuid** | `string` |  | [Defaults to `undefined`] |
| **xDeviceType** | `string` |  | [Optional] [Defaults to `&#39;unknown&#39;`] |

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


## getInfoApiV1RemoteInfoUuidGet_0

> any getInfoApiV1RemoteInfoUuidGet_0(uuid, xDeviceType)

Get Info

对应 Java: GET /remote/info/{uuid} — 用户基本信息 + 第三方账号绑定.

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { GetInfoApiV1RemoteInfoUuidGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  const body = {
    // string
    uuid: uuid_example,
    // string (optional)
    xDeviceType: xDeviceType_example,
  } satisfies GetInfoApiV1RemoteInfoUuidGet0Request;

  try {
    const data = await api.getInfoApiV1RemoteInfoUuidGet_0(body);
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
| **uuid** | `string` |  | [Defaults to `undefined`] |
| **xDeviceType** | `string` |  | [Optional] [Defaults to `&#39;unknown&#39;`] |

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


## getRoleApiV1RemoteRoleGet

> any getRoleApiV1RemoteRoleGet()

Get Role

对应 Java: GET /remote/role — 列出所有可购买的 ZhsProductIdentity.

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { GetRoleApiV1RemoteRoleGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  try {
    const data = await api.getRoleApiV1RemoteRoleGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getRoleApiV1RemoteRoleGet_0

> any getRoleApiV1RemoteRoleGet_0()

Get Role

对应 Java: GET /remote/role — 列出所有可购买的 ZhsProductIdentity.

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { GetRoleApiV1RemoteRoleGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  try {
    const data = await api.getRoleApiV1RemoteRoleGet_0();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getWithdrawalOpenApiV1RemoteGetTrueGet

> any getWithdrawalOpenApiV1RemoteGetTrueGet()

Get Withdrawal Open

对应 Java: GET /remote/get/true — 查 ZhsWithdrawalFlow id&#x3D;1.status&#x3D;&#x3D;1 → true.

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { GetWithdrawalOpenApiV1RemoteGetTrueGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  try {
    const data = await api.getWithdrawalOpenApiV1RemoteGetTrueGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getWithdrawalOpenApiV1RemoteGetTrueGet_0

> any getWithdrawalOpenApiV1RemoteGetTrueGet_0()

Get Withdrawal Open

对应 Java: GET /remote/get/true — 查 ZhsWithdrawalFlow id&#x3D;1.status&#x3D;&#x3D;1 → true.

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { GetWithdrawalOpenApiV1RemoteGetTrueGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  try {
    const data = await api.getWithdrawalOpenApiV1RemoteGetTrueGet_0();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## myTeamApiV1RemoteMyTeamUuidPost

> any myTeamApiV1RemoteMyTeamUuidPost(uuid, xDeviceType, myTeamQuery)

My Team

对应 Java: POST /remote/myTeam/{uuid} — 查询我的团队 (邀请树子节点).

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { MyTeamApiV1RemoteMyTeamUuidPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  const body = {
    // string
    uuid: uuid_example,
    // string (optional)
    xDeviceType: xDeviceType_example,
    // MyTeamQuery (optional)
    myTeamQuery: ...,
  } satisfies MyTeamApiV1RemoteMyTeamUuidPostRequest;

  try {
    const data = await api.myTeamApiV1RemoteMyTeamUuidPost(body);
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
| **uuid** | `string` |  | [Defaults to `undefined`] |
| **xDeviceType** | `string` |  | [Optional] [Defaults to `&#39;unknown&#39;`] |
| **myTeamQuery** | [MyTeamQuery](MyTeamQuery.md) |  | [Optional] |

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


## myTeamApiV1RemoteMyTeamUuidPost_0

> any myTeamApiV1RemoteMyTeamUuidPost_0(uuid, xDeviceType, myTeamQuery)

My Team

对应 Java: POST /remote/myTeam/{uuid} — 查询我的团队 (邀请树子节点).

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { MyTeamApiV1RemoteMyTeamUuidPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  const body = {
    // string
    uuid: uuid_example,
    // string (optional)
    xDeviceType: xDeviceType_example,
    // MyTeamQuery (optional)
    myTeamQuery: ...,
  } satisfies MyTeamApiV1RemoteMyTeamUuidPost0Request;

  try {
    const data = await api.myTeamApiV1RemoteMyTeamUuidPost_0(body);
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
| **uuid** | `string` |  | [Defaults to `undefined`] |
| **xDeviceType** | `string` |  | [Optional] [Defaults to `&#39;unknown&#39;`] |
| **myTeamQuery** | [MyTeamQuery](MyTeamQuery.md) |  | [Optional] |

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


## tencentAsrApiV1RemoteGetTencentSentencePost

> any tencentAsrApiV1RemoteGetTencentSentencePost(tencentAsrReq)

Tencent Asr

对应 Java: POST /remote/get/tencent/sentence — 调用腾讯云一句话识别.  Java 端直接用腾讯云 SDK. Python 这边如果想保真实现需安装 tencentcloud-sdk-python, 此处用占位实现 (返回模拟结果, 生产部署时配置 TENCENT_SECRET_ID/SECRET_KEY 后切换为真实 SDK).

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { TencentAsrApiV1RemoteGetTencentSentencePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  const body = {
    // TencentAsrReq
    tencentAsrReq: ...,
  } satisfies TencentAsrApiV1RemoteGetTencentSentencePostRequest;

  try {
    const data = await api.tencentAsrApiV1RemoteGetTencentSentencePost(body);
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
| **tencentAsrReq** | [TencentAsrReq](TencentAsrReq.md) |  | |

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


## tencentAsrApiV1RemoteGetTencentSentencePost_0

> any tencentAsrApiV1RemoteGetTencentSentencePost_0(tencentAsrReq)

Tencent Asr

对应 Java: POST /remote/get/tencent/sentence — 调用腾讯云一句话识别.  Java 端直接用腾讯云 SDK. Python 这边如果想保真实现需安装 tencentcloud-sdk-python, 此处用占位实现 (返回模拟结果, 生产部署时配置 TENCENT_SECRET_ID/SECRET_KEY 后切换为真实 SDK).

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { TencentAsrApiV1RemoteGetTencentSentencePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  const body = {
    // TencentAsrReq
    tencentAsrReq: ...,
  } satisfies TencentAsrApiV1RemoteGetTencentSentencePost0Request;

  try {
    const data = await api.tencentAsrApiV1RemoteGetTencentSentencePost_0(body);
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
| **tencentAsrReq** | [TencentAsrReq](TencentAsrReq.md) |  | |

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


## uploadBusinessCardApiV1RemoteUploadBusinessCardPost

> any uploadBusinessCardApiV1RemoteUploadBusinessCardPost(businessCardReq, xDeviceType)

Upload Business Card

对应 Java: POST /remote/uploadBusinessCard — 上传 base64 名片到 MinIO.

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { UploadBusinessCardApiV1RemoteUploadBusinessCardPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  const body = {
    // BusinessCardReq
    businessCardReq: ...,
    // string (optional)
    xDeviceType: xDeviceType_example,
  } satisfies UploadBusinessCardApiV1RemoteUploadBusinessCardPostRequest;

  try {
    const data = await api.uploadBusinessCardApiV1RemoteUploadBusinessCardPost(body);
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
| **businessCardReq** | [BusinessCardReq](BusinessCardReq.md) |  | |
| **xDeviceType** | `string` |  | [Optional] [Defaults to `&#39;unknown&#39;`] |

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


## uploadBusinessCardApiV1RemoteUploadBusinessCardPost_0

> any uploadBusinessCardApiV1RemoteUploadBusinessCardPost_0(businessCardReq, xDeviceType)

Upload Business Card

对应 Java: POST /remote/uploadBusinessCard — 上传 base64 名片到 MinIO.

### Example

```ts
import {
  Configuration,
  RemoteDeviceApi,
} from '';
import type { UploadBusinessCardApiV1RemoteUploadBusinessCardPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RemoteDeviceApi();

  const body = {
    // BusinessCardReq
    businessCardReq: ...,
    // string (optional)
    xDeviceType: xDeviceType_example,
  } satisfies UploadBusinessCardApiV1RemoteUploadBusinessCardPost0Request;

  try {
    const data = await api.uploadBusinessCardApiV1RemoteUploadBusinessCardPost_0(body);
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
| **businessCardReq** | [BusinessCardReq](BusinessCardReq.md) |  | |
| **xDeviceType** | `string` |  | [Optional] [Defaults to `&#39;unknown&#39;`] |

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

