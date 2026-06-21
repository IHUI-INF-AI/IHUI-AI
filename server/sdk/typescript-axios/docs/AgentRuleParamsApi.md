# AgentRuleParamsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createRuleParamApiV1Post**](#createruleparamapiv1post) | **POST** /api/v1/ | Create rule param|
|[**deleteRuleParamsApiV1ItemIdsDelete**](#deleteruleparamsapiv1itemidsdelete) | **DELETE** /api/v1/{item_ids} | Delete rule params|
|[**getRuleParamApiV1ItemIdGet**](#getruleparamapiv1itemidget) | **GET** /api/v1/{item_id} | Get rule param detail|
|[**listRuleParamsApiV1ListGet**](#listruleparamsapiv1listget) | **GET** /api/v1/list | List rule params|
|[**updateRuleParamApiV1Put**](#updateruleparamapiv1put) | **PUT** /api/v1/ | Update rule param|

# **createRuleParamApiV1Post**
> any createRuleParamApiV1Post(ruleParamCreate)


### Example

```typescript
import {
    AgentRuleParamsApi,
    Configuration,
    RuleParamCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentRuleParamsApi(configuration);

let ruleParamCreate: RuleParamCreate; //

const { status, data } = await apiInstance.createRuleParamApiV1Post(
    ruleParamCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **ruleParamCreate** | **RuleParamCreate**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteRuleParamsApiV1ItemIdsDelete**
> any deleteRuleParamsApiV1ItemIdsDelete()


### Example

```typescript
import {
    AgentRuleParamsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentRuleParamsApi(configuration);

let itemIds: string; // (default to undefined)

const { status, data } = await apiInstance.deleteRuleParamsApiV1ItemIdsDelete(
    itemIds
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **itemIds** | [**string**] |  | defaults to undefined|


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

# **getRuleParamApiV1ItemIdGet**
> any getRuleParamApiV1ItemIdGet()


### Example

```typescript
import {
    AgentRuleParamsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentRuleParamsApi(configuration);

let itemId: number; // (default to undefined)

const { status, data } = await apiInstance.getRuleParamApiV1ItemIdGet(
    itemId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **itemId** | [**number**] |  | defaults to undefined|


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

# **listRuleParamsApiV1ListGet**
> any listRuleParamsApiV1ListGet()


### Example

```typescript
import {
    AgentRuleParamsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentRuleParamsApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let ruleId: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listRuleParamsApiV1ListGet(
    page,
    limit,
    ruleId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **ruleId** | [**number**] |  | (optional) defaults to undefined|


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

# **updateRuleParamApiV1Put**
> any updateRuleParamApiV1Put(ruleParamUpdate)


### Example

```typescript
import {
    AgentRuleParamsApi,
    Configuration,
    RuleParamUpdate
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentRuleParamsApi(configuration);

let ruleParamUpdate: RuleParamUpdate; //

const { status, data } = await apiInstance.updateRuleParamApiV1Put(
    ruleParamUpdate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **ruleParamUpdate** | **RuleParamUpdate**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

