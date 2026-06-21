# AgentRuleParamsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createRuleParamApiV1Post**](AgentRuleParamsApi.md#createruleparamapiv1post) | **POST** /api/v1/ | Create rule param |
| [**deleteRuleParamsApiV1ItemIdsDelete**](AgentRuleParamsApi.md#deleteruleparamsapiv1itemidsdelete) | **DELETE** /api/v1/{item_ids} | Delete rule params |
| [**getRuleParamApiV1ItemIdGet**](AgentRuleParamsApi.md#getruleparamapiv1itemidget) | **GET** /api/v1/{item_id} | Get rule param detail |
| [**listRuleParamsApiV1ListGet**](AgentRuleParamsApi.md#listruleparamsapiv1listget) | **GET** /api/v1/list | List rule params |
| [**updateRuleParamApiV1Put**](AgentRuleParamsApi.md#updateruleparamapiv1put) | **PUT** /api/v1/ | Update rule param |



## createRuleParamApiV1Post

> any createRuleParamApiV1Post(ruleParamCreate)

Create rule param

### Example

```ts
import {
  Configuration,
  AgentRuleParamsApi,
} from '';
import type { CreateRuleParamApiV1PostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentRuleParamsApi();

  const body = {
    // RuleParamCreate
    ruleParamCreate: ...,
  } satisfies CreateRuleParamApiV1PostRequest;

  try {
    const data = await api.createRuleParamApiV1Post(body);
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
| **ruleParamCreate** | [RuleParamCreate](RuleParamCreate.md) |  | |

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


## deleteRuleParamsApiV1ItemIdsDelete

> any deleteRuleParamsApiV1ItemIdsDelete(itemIds)

Delete rule params

### Example

```ts
import {
  Configuration,
  AgentRuleParamsApi,
} from '';
import type { DeleteRuleParamsApiV1ItemIdsDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentRuleParamsApi();

  const body = {
    // string
    itemIds: itemIds_example,
  } satisfies DeleteRuleParamsApiV1ItemIdsDeleteRequest;

  try {
    const data = await api.deleteRuleParamsApiV1ItemIdsDelete(body);
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
| **itemIds** | `string` |  | [Defaults to `undefined`] |

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


## getRuleParamApiV1ItemIdGet

> any getRuleParamApiV1ItemIdGet(itemId)

Get rule param detail

### Example

```ts
import {
  Configuration,
  AgentRuleParamsApi,
} from '';
import type { GetRuleParamApiV1ItemIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentRuleParamsApi();

  const body = {
    // number
    itemId: 56,
  } satisfies GetRuleParamApiV1ItemIdGetRequest;

  try {
    const data = await api.getRuleParamApiV1ItemIdGet(body);
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
| **itemId** | `number` |  | [Defaults to `undefined`] |

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


## listRuleParamsApiV1ListGet

> any listRuleParamsApiV1ListGet(page, limit, ruleId)

List rule params

### Example

```ts
import {
  Configuration,
  AgentRuleParamsApi,
} from '';
import type { ListRuleParamsApiV1ListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentRuleParamsApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    ruleId: 56,
  } satisfies ListRuleParamsApiV1ListGetRequest;

  try {
    const data = await api.listRuleParamsApiV1ListGet(body);
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
| **ruleId** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## updateRuleParamApiV1Put

> any updateRuleParamApiV1Put(ruleParamUpdate)

Update rule param

### Example

```ts
import {
  Configuration,
  AgentRuleParamsApi,
} from '';
import type { UpdateRuleParamApiV1PutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentRuleParamsApi();

  const body = {
    // RuleParamUpdate
    ruleParamUpdate: ...,
  } satisfies UpdateRuleParamApiV1PutRequest;

  try {
    const data = await api.updateRuleParamApiV1Put(body);
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
| **ruleParamUpdate** | [RuleParamUpdate](RuleParamUpdate.md) |  | |

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

