# AgentsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**deleteApiV1AgentsAgentIdDelete**](AgentsApi.md#deleteapiv1agentsagentiddelete) | **DELETE** /api/v1/agents/{agent_id} | Delete agent |
| [**getDetailApiV1AgentsAgentIdGet**](AgentsApi.md#getdetailapiv1agentsagentidget) | **GET** /api/v1/agents/{agent_id} | Get agent detail |
| [**updateApiV1AgentsAgentIdPut**](AgentsApi.md#updateapiv1agentsagentidput) | **PUT** /api/v1/agents/{agent_id} | Update agent |



## deleteApiV1AgentsAgentIdDelete

> any deleteApiV1AgentsAgentIdDelete(agentId)

Delete agent

### Example

```ts
import {
  Configuration,
  AgentsApi,
} from '';
import type { DeleteApiV1AgentsAgentIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentsApi(config);

  const body = {
    // string
    agentId: agentId_example,
  } satisfies DeleteApiV1AgentsAgentIdDeleteRequest;

  try {
    const data = await api.deleteApiV1AgentsAgentIdDelete(body);
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


## getDetailApiV1AgentsAgentIdGet

> any getDetailApiV1AgentsAgentIdGet(agentId)

Get agent detail

### Example

```ts
import {
  Configuration,
  AgentsApi,
} from '';
import type { GetDetailApiV1AgentsAgentIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentsApi(config);

  const body = {
    // string
    agentId: agentId_example,
  } satisfies GetDetailApiV1AgentsAgentIdGetRequest;

  try {
    const data = await api.getDetailApiV1AgentsAgentIdGet(body);
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


## updateApiV1AgentsAgentIdPut

> any updateApiV1AgentsAgentIdPut(agentId, agentName, agentPrompt, publishStatus)

Update agent

### Example

```ts
import {
  Configuration,
  AgentsApi,
} from '';
import type { UpdateApiV1AgentsAgentIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentsApi(config);

  const body = {
    // string
    agentId: agentId_example,
    // string (optional)
    agentName: agentName_example,
    // string (optional)
    agentPrompt: agentPrompt_example,
    // number (optional)
    publishStatus: 56,
  } satisfies UpdateApiV1AgentsAgentIdPutRequest;

  try {
    const data = await api.updateApiV1AgentsAgentIdPut(body);
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
| **agentName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **agentPrompt** | `string` |  | [Optional] [Defaults to `undefined`] |
| **publishStatus** | `number` |  | [Optional] [Defaults to `undefined`] |

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

