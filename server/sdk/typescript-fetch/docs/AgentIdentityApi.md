# AgentIdentityApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createIdentityOrderApiV1AgentsCreatePost**](AgentIdentityApi.md#createidentityorderapiv1agentscreatepost) | **POST** /api/v1/agents/create | 创建身份订单 |
| [**createProportionApiV1AgentsProportionCreatePost**](AgentIdentityApi.md#createproportionapiv1agentsproportioncreatepost) | **POST** /api/v1/agents/proportion/create | 创建比例配置 |
| [**listIdentityOrdersApiV1AgentsListGet**](AgentIdentityApi.md#listidentityordersapiv1agentslistget) | **GET** /api/v1/agents/list | 身份订单列表 |
| [**listProportionsApiV1AgentsProportionListGet**](AgentIdentityApi.md#listproportionsapiv1agentsproportionlistget) | **GET** /api/v1/agents/proportion/list | 身份比例列表 |
| [**updateProportionApiV1AgentsProportionProportionIdPut**](AgentIdentityApi.md#updateproportionapiv1agentsproportionproportionidput) | **PUT** /api/v1/agents/proportion/{proportion_id} | 修改比例 |



## createIdentityOrderApiV1AgentsCreatePost

> any createIdentityOrderApiV1AgentsCreatePost(identityId, payType)

创建身份订单

### Example

```ts
import {
  Configuration,
  AgentIdentityApi,
} from '';
import type { CreateIdentityOrderApiV1AgentsCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentIdentityApi(config);

  const body = {
    // string | 产品身份ID
    identityId: identityId_example,
    // string | 支付方式: wechat / alipay (optional)
    payType: payType_example,
  } satisfies CreateIdentityOrderApiV1AgentsCreatePostRequest;

  try {
    const data = await api.createIdentityOrderApiV1AgentsCreatePost(body);
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
| **identityId** | `string` | 产品身份ID | [Defaults to `undefined`] |
| **payType** | `string` | 支付方式: wechat / alipay | [Optional] [Defaults to `&#39;wechat&#39;`] |

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


## createProportionApiV1AgentsProportionCreatePost

> any createProportionApiV1AgentsProportionCreatePost(identityProportionBody)

创建比例配置

### Example

```ts
import {
  Configuration,
  AgentIdentityApi,
} from '';
import type { CreateProportionApiV1AgentsProportionCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentIdentityApi(config);

  const body = {
    // IdentityProportionBody
    identityProportionBody: ...,
  } satisfies CreateProportionApiV1AgentsProportionCreatePostRequest;

  try {
    const data = await api.createProportionApiV1AgentsProportionCreatePost(body);
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
| **identityProportionBody** | [IdentityProportionBody](IdentityProportionBody.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listIdentityOrdersApiV1AgentsListGet

> any listIdentityOrdersApiV1AgentsListGet(page, limit, status, orderType)

身份订单列表

### Example

```ts
import {
  Configuration,
  AgentIdentityApi,
} from '';
import type { ListIdentityOrdersApiV1AgentsListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentIdentityApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number | 订单状态 0=待支付 1=已支付 2=已退款 3=已取消 (optional)
    status: 56,
    // number | 订单类型, 默认2=身份订单 (optional)
    orderType: 56,
  } satisfies ListIdentityOrdersApiV1AgentsListGetRequest;

  try {
    const data = await api.listIdentityOrdersApiV1AgentsListGet(body);
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
| **status** | `number` | 订单状态 0&#x3D;待支付 1&#x3D;已支付 2&#x3D;已退款 3&#x3D;已取消 | [Optional] [Defaults to `undefined`] |
| **orderType** | `number` | 订单类型, 默认2&#x3D;身份订单 | [Optional] [Defaults to `2`] |

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


## listProportionsApiV1AgentsProportionListGet

> any listProportionsApiV1AgentsProportionListGet(page, limit, status)

身份比例列表

### Example

```ts
import {
  Configuration,
  AgentIdentityApi,
} from '';
import type { ListProportionsApiV1AgentsProportionListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentIdentityApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number | 0=stopped 1=active (optional)
    status: 56,
  } satisfies ListProportionsApiV1AgentsProportionListGetRequest;

  try {
    const data = await api.listProportionsApiV1AgentsProportionListGet(body);
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
| **status** | `number` | 0&#x3D;stopped 1&#x3D;active | [Optional] [Defaults to `undefined`] |

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


## updateProportionApiV1AgentsProportionProportionIdPut

> any updateProportionApiV1AgentsProportionProportionIdPut(proportionId, identityProportionBody)

修改比例

### Example

```ts
import {
  Configuration,
  AgentIdentityApi,
} from '';
import type { UpdateProportionApiV1AgentsProportionProportionIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentIdentityApi(config);

  const body = {
    // string
    proportionId: proportionId_example,
    // IdentityProportionBody
    identityProportionBody: ...,
  } satisfies UpdateProportionApiV1AgentsProportionProportionIdPutRequest;

  try {
    const data = await api.updateProportionApiV1AgentsProportionProportionIdPut(body);
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
| **proportionId** | `string` |  | [Defaults to `undefined`] |
| **identityProportionBody** | [IdentityProportionBody](IdentityProportionBody.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

