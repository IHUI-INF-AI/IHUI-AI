# ResourceApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addAgentFreeTimeApiV1ResourceAgentFreeTimePost**](ResourceApi.md#addagentfreetimeapiv1resourceagentfreetimepost) | **POST** /api/v1/resource/agent/free-time | 添加用户 Agent 免费次数 |
| [**createShareApiV1ResourceSharePost**](ResourceApi.md#createshareapiv1resourcesharepost) | **POST** /api/v1/resource/share | 生成分享链接 |
| [**developerPriceApiV1ResourceDeveloperPriceGet**](ResourceApi.md#developerpriceapiv1resourcedeveloperpriceget) | **GET** /api/v1/resource/developer/price | 查询 Agent 开发者价格 |
| [**fileUploadApiV1ResourceFileUploadPost**](ResourceApi.md#fileuploadapiv1resourcefileuploadpost) | **POST** /api/v1/resource/file/upload | 上传文件到 MinIO |
| [**getAgentFreeTimeApiV1ResourceAgentFreeTimeGet**](ResourceApi.md#getagentfreetimeapiv1resourceagentfreetimeget) | **GET** /api/v1/resource/agent/free-time | 获取用户 Agent 免费次数 |
| [**getCozeAccessTokenApiV1ResourceCozeAccessTokenGet**](ResourceApi.md#getcozeaccesstokenapiv1resourcecozeaccesstokenget) | **GET** /api/v1/resource/coze-access-token | 获取 Coze AccessToken |
| [**goodsListApiV1ResourceGoodsGet**](ResourceApi.md#goodslistapiv1resourcegoodsget) | **GET** /api/v1/resource/goods | 商品及汇率列表 |
| [**homeResourcesApiV1ResourceHomeGet**](ResourceApi.md#homeresourcesapiv1resourcehomeget) | **GET** /api/v1/resource/home | 首页资源聚合 |
| [**planetsCourseApiV1ResourcePlanetsCourseGet**](ResourceApi.md#planetscourseapiv1resourceplanetscourseget) | **GET** /api/v1/resource/planets/course | 课程星球列表 |
| [**planetsKnowledgeApiV1ResourcePlanetsKnowledgeGet**](ResourceApi.md#planetsknowledgeapiv1resourceplanetsknowledgeget) | **GET** /api/v1/resource/planets/knowledge | 知识星球列表 |
| [**rechargeCheckApiV1ResourceRechargeGet**](ResourceApi.md#rechargecheckapiv1resourcerechargeget) | **GET** /api/v1/resource/recharge | 判断是否为会员 |
| [**tokenCountApiV1ResourceTokenCountGet**](ResourceApi.md#tokencountapiv1resourcetokencountget) | **GET** /api/v1/resource/token/count | 获取用户 token 余量 |



## addAgentFreeTimeApiV1ResourceAgentFreeTimePost

> any addAgentFreeTimeApiV1ResourceAgentFreeTimePost(agentId, freeCount)

添加用户 Agent 免费次数

为指定用户增加 Agent 免费使用次数。

### Example

```ts
import {
  Configuration,
  ResourceApi,
} from '';
import type { AddAgentFreeTimeApiV1ResourceAgentFreeTimePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceApi(config);

  const body = {
    // string | Agent ID
    agentId: agentId_example,
    // number | 免费次数
    freeCount: 56,
  } satisfies AddAgentFreeTimeApiV1ResourceAgentFreeTimePostRequest;

  try {
    const data = await api.addAgentFreeTimeApiV1ResourceAgentFreeTimePost(body);
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
| **agentId** | `string` | Agent ID | [Defaults to `undefined`] |
| **freeCount** | `number` | 免费次数 | [Defaults to `undefined`] |

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


## createShareApiV1ResourceSharePost

> any createShareApiV1ResourceSharePost(targetType, targetId)

生成分享链接

生成一次性分享 token 短链。

### Example

```ts
import {
  Configuration,
  ResourceApi,
} from '';
import type { CreateShareApiV1ResourceSharePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceApi(config);

  const body = {
    // string | agent/course/chat
    targetType: targetType_example,
    // string
    targetId: targetId_example,
  } satisfies CreateShareApiV1ResourceSharePostRequest;

  try {
    const data = await api.createShareApiV1ResourceSharePost(body);
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
| **targetType** | `string` | agent/course/chat | [Defaults to `undefined`] |
| **targetId** | `string` |  | [Defaults to `undefined`] |

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


## developerPriceApiV1ResourceDeveloperPriceGet

> any developerPriceApiV1ResourceDeveloperPriceGet(agentId)

查询 Agent 开发者价格

返回该 Agent 的开发者列表及价格档位。

### Example

```ts
import {
  Configuration,
  ResourceApi,
} from '';
import type { DeveloperPriceApiV1ResourceDeveloperPriceGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ResourceApi();

  const body = {
    // string
    agentId: agentId_example,
  } satisfies DeveloperPriceApiV1ResourceDeveloperPriceGetRequest;

  try {
    const data = await api.developerPriceApiV1ResourceDeveloperPriceGet(body);
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


## fileUploadApiV1ResourceFileUploadPost

> any fileUploadApiV1ResourceFileUploadPost(file, bucket)

上传文件到 MinIO

上传文件，返回可访问的 URL。

### Example

```ts
import {
  Configuration,
  ResourceApi,
} from '';
import type { FileUploadApiV1ResourceFileUploadPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceApi(config);

  const body = {
    // Blob
    file: BINARY_DATA_HERE,
    // string | 存储桶，不传则用默认 (optional)
    bucket: bucket_example,
  } satisfies FileUploadApiV1ResourceFileUploadPostRequest;

  try {
    const data = await api.fileUploadApiV1ResourceFileUploadPost(body);
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
| **file** | `Blob` |  | [Defaults to `undefined`] |
| **bucket** | `string` | 存储桶，不传则用默认 | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getAgentFreeTimeApiV1ResourceAgentFreeTimeGet

> any getAgentFreeTimeApiV1ResourceAgentFreeTimeGet(agentId)

获取用户 Agent 免费次数

查询指定用户在指定 Agent 上剩余的免费次数。

### Example

```ts
import {
  Configuration,
  ResourceApi,
} from '';
import type { GetAgentFreeTimeApiV1ResourceAgentFreeTimeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceApi(config);

  const body = {
    // string | Agent ID
    agentId: agentId_example,
  } satisfies GetAgentFreeTimeApiV1ResourceAgentFreeTimeGetRequest;

  try {
    const data = await api.getAgentFreeTimeApiV1ResourceAgentFreeTimeGet(body);
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
| **agentId** | `string` | Agent ID | [Defaults to `undefined`] |

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


## getCozeAccessTokenApiV1ResourceCozeAccessTokenGet

> any getCozeAccessTokenApiV1ResourceCozeAccessTokenGet()

获取 Coze AccessToken

通过 Coze OAuth2 JWT 方式获取 access_token。

### Example

```ts
import {
  Configuration,
  ResourceApi,
} from '';
import type { GetCozeAccessTokenApiV1ResourceCozeAccessTokenGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceApi(config);

  try {
    const data = await api.getCozeAccessTokenApiV1ResourceCozeAccessTokenGet();
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


## goodsListApiV1ResourceGoodsGet

> any goodsListApiV1ResourceGoodsGet()

商品及汇率列表

查询 zhs_product 表全部商品以及 exchange_rate 汇率表。

### Example

```ts
import {
  Configuration,
  ResourceApi,
} from '';
import type { GoodsListApiV1ResourceGoodsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceApi(config);

  try {
    const data = await api.goodsListApiV1ResourceGoodsGet();
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


## homeResourcesApiV1ResourceHomeGet

> any homeResourcesApiV1ResourceHomeGet()

首页资源聚合

返回首页所需的全部资源：banner、推荐 Agent、热门课程、公告。

### Example

```ts
import {
  Configuration,
  ResourceApi,
} from '';
import type { HomeResourcesApiV1ResourceHomeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceApi(config);

  try {
    const data = await api.homeResourcesApiV1ResourceHomeGet();
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


## planetsCourseApiV1ResourcePlanetsCourseGet

> any planetsCourseApiV1ResourcePlanetsCourseGet()

课程星球列表

返回 type&#x3D;course 的知识星球列表。

### Example

```ts
import {
  Configuration,
  ResourceApi,
} from '';
import type { PlanetsCourseApiV1ResourcePlanetsCourseGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceApi(config);

  try {
    const data = await api.planetsCourseApiV1ResourcePlanetsCourseGet();
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


## planetsKnowledgeApiV1ResourcePlanetsKnowledgeGet

> any planetsKnowledgeApiV1ResourcePlanetsKnowledgeGet()

知识星球列表

返回 type&#x3D;knowledge 的知识星球列表。

### Example

```ts
import {
  Configuration,
  ResourceApi,
} from '';
import type { PlanetsKnowledgeApiV1ResourcePlanetsKnowledgeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceApi(config);

  try {
    const data = await api.planetsKnowledgeApiV1ResourcePlanetsKnowledgeGet();
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


## rechargeCheckApiV1ResourceRechargeGet

> any rechargeCheckApiV1ResourceRechargeGet()

判断是否为会员

查询 user_vip 表判断当前用户是否为会员。

### Example

```ts
import {
  Configuration,
  ResourceApi,
} from '';
import type { RechargeCheckApiV1ResourceRechargeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceApi(config);

  try {
    const data = await api.rechargeCheckApiV1ResourceRechargeGet();
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


## tokenCountApiV1ResourceTokenCountGet

> any tokenCountApiV1ResourceTokenCountGet()

获取用户 token 余量

### Example

```ts
import {
  Configuration,
  ResourceApi,
} from '';
import type { TokenCountApiV1ResourceTokenCountGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceApi(config);

  try {
    const data = await api.tokenCountApiV1ResourceTokenCountGet();
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

