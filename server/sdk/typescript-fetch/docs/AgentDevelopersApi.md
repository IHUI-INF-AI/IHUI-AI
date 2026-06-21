# AgentDevelopersApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**bindCozeApiV1AgentsCozeLinkBindPost**](AgentDevelopersApi.md#bindcozeapiv1agentscozelinkbindpost) | **POST** /api/v1/agents/coze-link/bind | 绑定 Coze 账号 |
| [**bindDeveloperApiV1AgentsBindPost**](AgentDevelopersApi.md#binddeveloperapiv1agentsbindpost) | **POST** /api/v1/agents/bind | 绑定 Agent 到当前用户（成为开发者） |
| [**cozeLinkApiV1AgentsCozeLinkGet**](AgentDevelopersApi.md#cozelinkapiv1agentscozelinkget) | **GET** /api/v1/agents/coze-link | 查询 Coze 账号绑定 |
| [**getDeveloperApiV1AgentsRecordIdGet**](AgentDevelopersApi.md#getdeveloperapiv1agentsrecordidget) | **GET** /api/v1/agents/{record_id} | 开发者记录详情 |
| [**myDeveloperAgentsApiV1AgentsMyGet**](AgentDevelopersApi.md#mydeveloperagentsapiv1agentsmyget) | **GET** /api/v1/agents/my | 我作为开发者的所有 Agent |
| [**updatePriceApiV1AgentsUpdatePricePost**](AgentDevelopersApi.md#updatepriceapiv1agentsupdatepricepost) | **POST** /api/v1/agents/update-price | 更新开发者价格 |



## bindCozeApiV1AgentsCozeLinkBindPost

> any bindCozeApiV1AgentsCozeLinkBindPost(cozeAccountId, cozeAccountName)

绑定 Coze 账号

### Example

```ts
import {
  Configuration,
  AgentDevelopersApi,
} from '';
import type { BindCozeApiV1AgentsCozeLinkBindPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentDevelopersApi(config);

  const body = {
    // string
    cozeAccountId: cozeAccountId_example,
    // string
    cozeAccountName: cozeAccountName_example,
  } satisfies BindCozeApiV1AgentsCozeLinkBindPostRequest;

  try {
    const data = await api.bindCozeApiV1AgentsCozeLinkBindPost(body);
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
| **cozeAccountId** | `string` |  | [Defaults to `undefined`] |
| **cozeAccountName** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bindDeveloperApiV1AgentsBindPost

> any bindDeveloperApiV1AgentsBindPost(agentId, price)

绑定 Agent 到当前用户（成为开发者）

### Example

```ts
import {
  Configuration,
  AgentDevelopersApi,
} from '';
import type { BindDeveloperApiV1AgentsBindPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentDevelopersApi(config);

  const body = {
    // string
    agentId: agentId_example,
    // number | 开发者价格 (optional)
    price: 8.14,
  } satisfies BindDeveloperApiV1AgentsBindPostRequest;

  try {
    const data = await api.bindDeveloperApiV1AgentsBindPost(body);
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
| **agentId** | `string` |  | [Defaults to `undefined`] |
| **price** | `number` | 开发者价格 | [Optional] [Defaults to `0.0`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## cozeLinkApiV1AgentsCozeLinkGet

> any cozeLinkApiV1AgentsCozeLinkGet()

查询 Coze 账号绑定

### Example

```ts
import {
  Configuration,
  AgentDevelopersApi,
} from '';
import type { CozeLinkApiV1AgentsCozeLinkGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentDevelopersApi(config);

  try {
    const data = await api.cozeLinkApiV1AgentsCozeLinkGet();
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getDeveloperApiV1AgentsRecordIdGet

> any getDeveloperApiV1AgentsRecordIdGet(recordId)

开发者记录详情

根据记录 ID 返回开发者详情。

### Example

```ts
import {
  Configuration,
  AgentDevelopersApi,
} from '';
import type { GetDeveloperApiV1AgentsRecordIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentDevelopersApi();

  const body = {
    // number
    recordId: 56,
  } satisfies GetDeveloperApiV1AgentsRecordIdGetRequest;

  try {
    const data = await api.getDeveloperApiV1AgentsRecordIdGet(body);
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
| **recordId** | `number` |  | [Defaults to `undefined`] |

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


## myDeveloperAgentsApiV1AgentsMyGet

> any myDeveloperAgentsApiV1AgentsMyGet()

我作为开发者的所有 Agent

### Example

```ts
import {
  Configuration,
  AgentDevelopersApi,
} from '';
import type { MyDeveloperAgentsApiV1AgentsMyGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentDevelopersApi(config);

  try {
    const data = await api.myDeveloperAgentsApiV1AgentsMyGet();
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updatePriceApiV1AgentsUpdatePricePost

> any updatePriceApiV1AgentsUpdatePricePost(agentId, price)

更新开发者价格

### Example

```ts
import {
  Configuration,
  AgentDevelopersApi,
} from '';
import type { UpdatePriceApiV1AgentsUpdatePricePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentDevelopersApi(config);

  const body = {
    // string
    agentId: agentId_example,
    // number
    price: 8.14,
  } satisfies UpdatePriceApiV1AgentsUpdatePricePostRequest;

  try {
    const data = await api.updatePriceApiV1AgentsUpdatePricePost(body);
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
| **agentId** | `string` |  | [Defaults to `undefined`] |
| **price** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

