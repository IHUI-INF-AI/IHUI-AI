# AgentIdentityApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createIdentityOrderApiV1AgentsCreatePost**](#createidentityorderapiv1agentscreatepost) | **POST** /api/v1/agents/create | 创建身份订单|
|[**createProportionApiV1AgentsProportionCreatePost**](#createproportionapiv1agentsproportioncreatepost) | **POST** /api/v1/agents/proportion/create | 创建比例配置|
|[**listIdentityOrdersApiV1AgentsListGet**](#listidentityordersapiv1agentslistget) | **GET** /api/v1/agents/list | 身份订单列表|
|[**listProportionsApiV1AgentsProportionListGet**](#listproportionsapiv1agentsproportionlistget) | **GET** /api/v1/agents/proportion/list | 身份比例列表|
|[**updateProportionApiV1AgentsProportionProportionIdPut**](#updateproportionapiv1agentsproportionproportionidput) | **PUT** /api/v1/agents/proportion/{proportion_id} | 修改比例|

# **createIdentityOrderApiV1AgentsCreatePost**
> any createIdentityOrderApiV1AgentsCreatePost()


### Example

```typescript
import {
    AgentIdentityApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentIdentityApi(configuration);

let identityId: string; //产品身份ID (default to undefined)
let payType: string; //支付方式: wechat / alipay (optional) (default to 'wechat')

const { status, data } = await apiInstance.createIdentityOrderApiV1AgentsCreatePost(
    identityId,
    payType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **identityId** | [**string**] | 产品身份ID | defaults to undefined|
| **payType** | [**string**] | 支付方式: wechat / alipay | (optional) defaults to 'wechat'|


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

# **createProportionApiV1AgentsProportionCreatePost**
> any createProportionApiV1AgentsProportionCreatePost(identityProportionBody)


### Example

```typescript
import {
    AgentIdentityApi,
    Configuration,
    IdentityProportionBody
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentIdentityApi(configuration);

let identityProportionBody: IdentityProportionBody; //

const { status, data } = await apiInstance.createProportionApiV1AgentsProportionCreatePost(
    identityProportionBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **identityProportionBody** | **IdentityProportionBody**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listIdentityOrdersApiV1AgentsListGet**
> any listIdentityOrdersApiV1AgentsListGet()


### Example

```typescript
import {
    AgentIdentityApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentIdentityApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; //订单状态 0=待支付 1=已支付 2=已退款 3=已取消 (optional) (default to undefined)
let orderType: number; //订单类型, 默认2=身份订单 (optional) (default to 2)

const { status, data } = await apiInstance.listIdentityOrdersApiV1AgentsListGet(
    page,
    limit,
    status,
    orderType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **status** | [**number**] | 订单状态 0&#x3D;待支付 1&#x3D;已支付 2&#x3D;已退款 3&#x3D;已取消 | (optional) defaults to undefined|
| **orderType** | [**number**] | 订单类型, 默认2&#x3D;身份订单 | (optional) defaults to 2|


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

# **listProportionsApiV1AgentsProportionListGet**
> any listProportionsApiV1AgentsProportionListGet()


### Example

```typescript
import {
    AgentIdentityApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentIdentityApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; //0=stopped 1=active (optional) (default to undefined)

const { status, data } = await apiInstance.listProportionsApiV1AgentsProportionListGet(
    page,
    limit,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **status** | [**number**] | 0&#x3D;stopped 1&#x3D;active | (optional) defaults to undefined|


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

# **updateProportionApiV1AgentsProportionProportionIdPut**
> any updateProportionApiV1AgentsProportionProportionIdPut(identityProportionBody)


### Example

```typescript
import {
    AgentIdentityApi,
    Configuration,
    IdentityProportionBody
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentIdentityApi(configuration);

let proportionId: string; // (default to undefined)
let identityProportionBody: IdentityProportionBody; //

const { status, data } = await apiInstance.updateProportionApiV1AgentsProportionProportionIdPut(
    proportionId,
    identityProportionBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **identityProportionBody** | **IdentityProportionBody**|  | |
| **proportionId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

