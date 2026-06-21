# AgentsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**deleteApiV1AgentsAgentIdDelete**](#deleteapiv1agentsagentiddelete) | **DELETE** /api/v1/agents/{agent_id} | Delete agent|
|[**getDetailApiV1AgentsAgentIdGet**](#getdetailapiv1agentsagentidget) | **GET** /api/v1/agents/{agent_id} | Get agent detail|
|[**updateApiV1AgentsAgentIdPut**](#updateapiv1agentsagentidput) | **PUT** /api/v1/agents/{agent_id} | Update agent|

# **deleteApiV1AgentsAgentIdDelete**
> any deleteApiV1AgentsAgentIdDelete()


### Example

```typescript
import {
    AgentsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentsApi(configuration);

let agentId: string; // (default to undefined)

const { status, data } = await apiInstance.deleteApiV1AgentsAgentIdDelete(
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

# **getDetailApiV1AgentsAgentIdGet**
> any getDetailApiV1AgentsAgentIdGet()


### Example

```typescript
import {
    AgentsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentsApi(configuration);

let agentId: string; // (default to undefined)

const { status, data } = await apiInstance.getDetailApiV1AgentsAgentIdGet(
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

# **updateApiV1AgentsAgentIdPut**
> any updateApiV1AgentsAgentIdPut()


### Example

```typescript
import {
    AgentsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentsApi(configuration);

let agentId: string; // (default to undefined)
let agentName: string; // (optional) (default to undefined)
let agentPrompt: string; // (optional) (default to undefined)
let publishStatus: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateApiV1AgentsAgentIdPut(
    agentId,
    agentName,
    agentPrompt,
    publishStatus
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|
| **agentName** | [**string**] |  | (optional) defaults to undefined|
| **agentPrompt** | [**string**] |  | (optional) defaults to undefined|
| **publishStatus** | [**number**] |  | (optional) defaults to undefined|


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

