# AgentPurchaseApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**expirePurchaseApiV1AgentsRecordIdExpirePut**](AgentPurchaseApi.md#expirepurchaseapiv1agentsrecordidexpireput) | **PUT** /api/v1/agents/{record_id}/expire | Mark purchase record as expired |
| [**getPurchaseByOrderApiV1AgentsOrderOrderNoGet**](AgentPurchaseApi.md#getpurchasebyorderapiv1agentsorderordernoget) | **GET** /api/v1/agents/order/{order_no} | Query by order number |
| [**getPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet**](AgentPurchaseApi.md#getpurchasebyuseragentapiv1agentsuseruseruuidagentagentidget) | **GET** /api/v1/agents/user/{user_uuid}/agent/{agent_id} | Query by user and agent |
| [**listExpiredPurchasesApiV1AgentsExpiredGet**](AgentPurchaseApi.md#listexpiredpurchasesapiv1agentsexpiredget) | **GET** /api/v1/agents/expired | List expired purchase records |



## expirePurchaseApiV1AgentsRecordIdExpirePut

> any expirePurchaseApiV1AgentsRecordIdExpirePut(recordId)

Mark purchase record as expired

### Example

```ts
import {
  Configuration,
  AgentPurchaseApi,
} from '';
import type { ExpirePurchaseApiV1AgentsRecordIdExpirePutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentPurchaseApi(config);

  const body = {
    // number
    recordId: 56,
  } satisfies ExpirePurchaseApiV1AgentsRecordIdExpirePutRequest;

  try {
    const data = await api.expirePurchaseApiV1AgentsRecordIdExpirePut(body);
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


## getPurchaseByOrderApiV1AgentsOrderOrderNoGet

> any getPurchaseByOrderApiV1AgentsOrderOrderNoGet(orderNo)

Query by order number

### Example

```ts
import {
  Configuration,
  AgentPurchaseApi,
} from '';
import type { GetPurchaseByOrderApiV1AgentsOrderOrderNoGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentPurchaseApi(config);

  const body = {
    // string
    orderNo: orderNo_example,
  } satisfies GetPurchaseByOrderApiV1AgentsOrderOrderNoGetRequest;

  try {
    const data = await api.getPurchaseByOrderApiV1AgentsOrderOrderNoGet(body);
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
| **orderNo** | `string` |  | [Defaults to `undefined`] |

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


## getPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet

> any getPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet(userUuid, agentId, page, limit)

Query by user and agent

### Example

```ts
import {
  Configuration,
  AgentPurchaseApi,
} from '';
import type { GetPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentPurchaseApi(config);

  const body = {
    // string
    userUuid: userUuid_example,
    // string
    agentId: agentId_example,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies GetPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGetRequest;

  try {
    const data = await api.getPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet(body);
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
| **userUuid** | `string` |  | [Defaults to `undefined`] |
| **agentId** | `string` |  | [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

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


## listExpiredPurchasesApiV1AgentsExpiredGet

> any listExpiredPurchasesApiV1AgentsExpiredGet(page, limit)

List expired purchase records

### Example

```ts
import {
  Configuration,
  AgentPurchaseApi,
} from '';
import type { ListExpiredPurchasesApiV1AgentsExpiredGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentPurchaseApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListExpiredPurchasesApiV1AgentsExpiredGetRequest;

  try {
    const data = await api.listExpiredPurchasesApiV1AgentsExpiredGet(body);
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

