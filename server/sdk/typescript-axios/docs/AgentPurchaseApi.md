# AgentPurchaseApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**expirePurchaseApiV1AgentsRecordIdExpirePut**](#expirepurchaseapiv1agentsrecordidexpireput) | **PUT** /api/v1/agents/{record_id}/expire | Mark purchase record as expired|
|[**getPurchaseByOrderApiV1AgentsOrderOrderNoGet**](#getpurchasebyorderapiv1agentsorderordernoget) | **GET** /api/v1/agents/order/{order_no} | Query by order number|
|[**getPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet**](#getpurchasebyuseragentapiv1agentsuseruseruuidagentagentidget) | **GET** /api/v1/agents/user/{user_uuid}/agent/{agent_id} | Query by user and agent|
|[**listExpiredPurchasesApiV1AgentsExpiredGet**](#listexpiredpurchasesapiv1agentsexpiredget) | **GET** /api/v1/agents/expired | List expired purchase records|

# **expirePurchaseApiV1AgentsRecordIdExpirePut**
> any expirePurchaseApiV1AgentsRecordIdExpirePut()


### Example

```typescript
import {
    AgentPurchaseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentPurchaseApi(configuration);

let recordId: number; // (default to undefined)

const { status, data } = await apiInstance.expirePurchaseApiV1AgentsRecordIdExpirePut(
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

# **getPurchaseByOrderApiV1AgentsOrderOrderNoGet**
> any getPurchaseByOrderApiV1AgentsOrderOrderNoGet()


### Example

```typescript
import {
    AgentPurchaseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentPurchaseApi(configuration);

let orderNo: string; // (default to undefined)

const { status, data } = await apiInstance.getPurchaseByOrderApiV1AgentsOrderOrderNoGet(
    orderNo
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **orderNo** | [**string**] |  | defaults to undefined|


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

# **getPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet**
> any getPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet()


### Example

```typescript
import {
    AgentPurchaseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentPurchaseApi(configuration);

let userUuid: string; // (default to undefined)
let agentId: string; // (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.getPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet(
    userUuid,
    agentId,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userUuid** | [**string**] |  | defaults to undefined|
| **agentId** | [**string**] |  | defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

# **listExpiredPurchasesApiV1AgentsExpiredGet**
> any listExpiredPurchasesApiV1AgentsExpiredGet()


### Example

```typescript
import {
    AgentPurchaseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentPurchaseApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listExpiredPurchasesApiV1AgentsExpiredGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

