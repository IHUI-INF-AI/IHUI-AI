# AgentDevelopersApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**bindCozeApiV1AgentsCozeLinkBindPost**](#bindcozeapiv1agentscozelinkbindpost) | **POST** /api/v1/agents/coze-link/bind | 绑定 Coze 账号|
|[**bindDeveloperApiV1AgentsBindPost**](#binddeveloperapiv1agentsbindpost) | **POST** /api/v1/agents/bind | 绑定 Agent 到当前用户（成为开发者）|
|[**cozeLinkApiV1AgentsCozeLinkGet**](#cozelinkapiv1agentscozelinkget) | **GET** /api/v1/agents/coze-link | 查询 Coze 账号绑定|
|[**getDeveloperApiV1AgentsRecordIdGet**](#getdeveloperapiv1agentsrecordidget) | **GET** /api/v1/agents/{record_id} | 开发者记录详情|
|[**myDeveloperAgentsApiV1AgentsMyGet**](#mydeveloperagentsapiv1agentsmyget) | **GET** /api/v1/agents/my | 我作为开发者的所有 Agent|
|[**updatePriceApiV1AgentsUpdatePricePost**](#updatepriceapiv1agentsupdatepricepost) | **POST** /api/v1/agents/update-price | 更新开发者价格|

# **bindCozeApiV1AgentsCozeLinkBindPost**
> any bindCozeApiV1AgentsCozeLinkBindPost()


### Example

```typescript
import {
    AgentDevelopersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentDevelopersApi(configuration);

let cozeAccountId: string; // (default to undefined)
let cozeAccountName: string; // (default to undefined)

const { status, data } = await apiInstance.bindCozeApiV1AgentsCozeLinkBindPost(
    cozeAccountId,
    cozeAccountName
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **cozeAccountId** | [**string**] |  | defaults to undefined|
| **cozeAccountName** | [**string**] |  | defaults to undefined|


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

# **bindDeveloperApiV1AgentsBindPost**
> any bindDeveloperApiV1AgentsBindPost()


### Example

```typescript
import {
    AgentDevelopersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentDevelopersApi(configuration);

let agentId: string; // (default to undefined)
let price: number; //开发者价格 (optional) (default to 0.0)

const { status, data } = await apiInstance.bindDeveloperApiV1AgentsBindPost(
    agentId,
    price
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|
| **price** | [**number**] | 开发者价格 | (optional) defaults to 0.0|


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

# **cozeLinkApiV1AgentsCozeLinkGet**
> any cozeLinkApiV1AgentsCozeLinkGet()


### Example

```typescript
import {
    AgentDevelopersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentDevelopersApi(configuration);

const { status, data } = await apiInstance.cozeLinkApiV1AgentsCozeLinkGet();
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

# **getDeveloperApiV1AgentsRecordIdGet**
> any getDeveloperApiV1AgentsRecordIdGet()

根据记录 ID 返回开发者详情。

### Example

```typescript
import {
    AgentDevelopersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentDevelopersApi(configuration);

let recordId: number; // (default to undefined)

const { status, data } = await apiInstance.getDeveloperApiV1AgentsRecordIdGet(
    recordId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **recordId** | [**number**] |  | defaults to undefined|


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

# **myDeveloperAgentsApiV1AgentsMyGet**
> any myDeveloperAgentsApiV1AgentsMyGet()


### Example

```typescript
import {
    AgentDevelopersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentDevelopersApi(configuration);

const { status, data } = await apiInstance.myDeveloperAgentsApiV1AgentsMyGet();
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

# **updatePriceApiV1AgentsUpdatePricePost**
> any updatePriceApiV1AgentsUpdatePricePost()


### Example

```typescript
import {
    AgentDevelopersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentDevelopersApi(configuration);

let agentId: string; // (default to undefined)
let price: number; // (default to undefined)

const { status, data } = await apiInstance.updatePriceApiV1AgentsUpdatePricePost(
    agentId,
    price
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|
| **price** | [**number**] |  | defaults to undefined|


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

