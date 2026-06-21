# ResourceApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**addAgentFreeTimeApiV1ResourceAgentFreeTimePost**](#addagentfreetimeapiv1resourceagentfreetimepost) | **POST** /api/v1/resource/agent/free-time | 添加用户 Agent 免费次数|
|[**createShareApiV1ResourceSharePost**](#createshareapiv1resourcesharepost) | **POST** /api/v1/resource/share | 生成分享链接|
|[**developerPriceApiV1ResourceDeveloperPriceGet**](#developerpriceapiv1resourcedeveloperpriceget) | **GET** /api/v1/resource/developer/price | 查询 Agent 开发者价格|
|[**fileUploadApiV1ResourceFileUploadPost**](#fileuploadapiv1resourcefileuploadpost) | **POST** /api/v1/resource/file/upload | 上传文件到 MinIO|
|[**getAgentFreeTimeApiV1ResourceAgentFreeTimeGet**](#getagentfreetimeapiv1resourceagentfreetimeget) | **GET** /api/v1/resource/agent/free-time | 获取用户 Agent 免费次数|
|[**getCozeAccessTokenApiV1ResourceCozeAccessTokenGet**](#getcozeaccesstokenapiv1resourcecozeaccesstokenget) | **GET** /api/v1/resource/coze-access-token | 获取 Coze AccessToken|
|[**goodsListApiV1ResourceGoodsGet**](#goodslistapiv1resourcegoodsget) | **GET** /api/v1/resource/goods | 商品及汇率列表|
|[**homeResourcesApiV1ResourceHomeGet**](#homeresourcesapiv1resourcehomeget) | **GET** /api/v1/resource/home | 首页资源聚合|
|[**planetsCourseApiV1ResourcePlanetsCourseGet**](#planetscourseapiv1resourceplanetscourseget) | **GET** /api/v1/resource/planets/course | 课程星球列表|
|[**planetsKnowledgeApiV1ResourcePlanetsKnowledgeGet**](#planetsknowledgeapiv1resourceplanetsknowledgeget) | **GET** /api/v1/resource/planets/knowledge | 知识星球列表|
|[**rechargeCheckApiV1ResourceRechargeGet**](#rechargecheckapiv1resourcerechargeget) | **GET** /api/v1/resource/recharge | 判断是否为会员|
|[**tokenCountApiV1ResourceTokenCountGet**](#tokencountapiv1resourcetokencountget) | **GET** /api/v1/resource/token/count | 获取用户 token 余量|

# **addAgentFreeTimeApiV1ResourceAgentFreeTimePost**
> any addAgentFreeTimeApiV1ResourceAgentFreeTimePost()

为指定用户增加 Agent 免费使用次数。

### Example

```typescript
import {
    ResourceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceApi(configuration);

let agentId: string; //Agent ID (default to undefined)
let freeCount: number; //免费次数 (default to undefined)

const { status, data } = await apiInstance.addAgentFreeTimeApiV1ResourceAgentFreeTimePost(
    agentId,
    freeCount
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] | Agent ID | defaults to undefined|
| **freeCount** | [**number**] | 免费次数 | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createShareApiV1ResourceSharePost**
> any createShareApiV1ResourceSharePost()

生成一次性分享 token 短链。

### Example

```typescript
import {
    ResourceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceApi(configuration);

let targetType: string; //agent/course/chat (default to undefined)
let targetId: string; // (default to undefined)

const { status, data } = await apiInstance.createShareApiV1ResourceSharePost(
    targetType,
    targetId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] | agent/course/chat | defaults to undefined|
| **targetId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **developerPriceApiV1ResourceDeveloperPriceGet**
> any developerPriceApiV1ResourceDeveloperPriceGet()

返回该 Agent 的开发者列表及价格档位。

### Example

```typescript
import {
    ResourceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceApi(configuration);

let agentId: string; // (default to undefined)

const { status, data } = await apiInstance.developerPriceApiV1ResourceDeveloperPriceGet(
    agentId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|


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

# **fileUploadApiV1ResourceFileUploadPost**
> any fileUploadApiV1ResourceFileUploadPost()

上传文件，返回可访问的 URL。

### Example

```typescript
import {
    ResourceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceApi(configuration);

let file: File; // (default to undefined)
let bucket: string; //存储桶，不传则用默认 (optional) (default to undefined)

const { status, data } = await apiInstance.fileUploadApiV1ResourceFileUploadPost(
    file,
    bucket
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **file** | [**File**] |  | defaults to undefined|
| **bucket** | [**string**] | 存储桶，不传则用默认 | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getAgentFreeTimeApiV1ResourceAgentFreeTimeGet**
> any getAgentFreeTimeApiV1ResourceAgentFreeTimeGet()

查询指定用户在指定 Agent 上剩余的免费次数。

### Example

```typescript
import {
    ResourceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceApi(configuration);

let agentId: string; //Agent ID (default to undefined)

const { status, data } = await apiInstance.getAgentFreeTimeApiV1ResourceAgentFreeTimeGet(
    agentId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] | Agent ID | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getCozeAccessTokenApiV1ResourceCozeAccessTokenGet**
> any getCozeAccessTokenApiV1ResourceCozeAccessTokenGet()

通过 Coze OAuth2 JWT 方式获取 access_token。

### Example

```typescript
import {
    ResourceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceApi(configuration);

const { status, data } = await apiInstance.getCozeAccessTokenApiV1ResourceCozeAccessTokenGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **goodsListApiV1ResourceGoodsGet**
> any goodsListApiV1ResourceGoodsGet()

查询 zhs_product 表全部商品以及 exchange_rate 汇率表。

### Example

```typescript
import {
    ResourceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceApi(configuration);

const { status, data } = await apiInstance.goodsListApiV1ResourceGoodsGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **homeResourcesApiV1ResourceHomeGet**
> any homeResourcesApiV1ResourceHomeGet()

返回首页所需的全部资源：banner、推荐 Agent、热门课程、公告。

### Example

```typescript
import {
    ResourceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceApi(configuration);

const { status, data } = await apiInstance.homeResourcesApiV1ResourceHomeGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **planetsCourseApiV1ResourcePlanetsCourseGet**
> any planetsCourseApiV1ResourcePlanetsCourseGet()

返回 type=course 的知识星球列表。

### Example

```typescript
import {
    ResourceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceApi(configuration);

const { status, data } = await apiInstance.planetsCourseApiV1ResourcePlanetsCourseGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **planetsKnowledgeApiV1ResourcePlanetsKnowledgeGet**
> any planetsKnowledgeApiV1ResourcePlanetsKnowledgeGet()

返回 type=knowledge 的知识星球列表。

### Example

```typescript
import {
    ResourceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceApi(configuration);

const { status, data } = await apiInstance.planetsKnowledgeApiV1ResourcePlanetsKnowledgeGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **rechargeCheckApiV1ResourceRechargeGet**
> any rechargeCheckApiV1ResourceRechargeGet()

查询 user_vip 表判断当前用户是否为会员。

### Example

```typescript
import {
    ResourceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceApi(configuration);

const { status, data } = await apiInstance.rechargeCheckApiV1ResourceRechargeGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **tokenCountApiV1ResourceTokenCountGet**
> any tokenCountApiV1ResourceTokenCountGet()


### Example

```typescript
import {
    ResourceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceApi(configuration);

const { status, data } = await apiInstance.tokenCountApiV1ResourceTokenCountGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

