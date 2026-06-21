# AgentRulesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**acceptNeedTaskApiV1AgentsNeedTaskAcceptPost**](AgentRulesApi.md#acceptneedtaskapiv1agentsneedtaskacceptpost) | **POST** /api/v1/agents/need-task/accept | 接单需求任务 |
| [**completeNeedTaskApiV1AgentsNeedTaskCompletePost**](AgentRulesApi.md#completeneedtaskapiv1agentsneedtaskcompletepost) | **POST** /api/v1/agents/need-task/complete | 完成需求任务 |
| [**createNeedTaskApiV1AgentsNeedTaskCreatePost**](AgentRulesApi.md#createneedtaskapiv1agentsneedtaskcreatepost) | **POST** /api/v1/agents/need-task/create | 创建需求任务 |
| [**listNeedTasksApiV1AgentsNeedTaskListGet**](AgentRulesApi.md#listneedtasksapiv1agentsneedtasklistget) | **GET** /api/v1/agents/need-task/list | 需求任务列表 |
| [**toggleRuleApiV1AgentsTogglePost**](AgentRulesApi.md#toggleruleapiv1agentstogglepost) | **POST** /api/v1/agents/toggle | 启用/禁用规则 |



## acceptNeedTaskApiV1AgentsNeedTaskAcceptPost

> any acceptNeedTaskApiV1AgentsNeedTaskAcceptPost(taskId)

接单需求任务

### Example

```ts
import {
  Configuration,
  AgentRulesApi,
} from '';
import type { AcceptNeedTaskApiV1AgentsNeedTaskAcceptPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentRulesApi(config);

  const body = {
    // number
    taskId: 56,
  } satisfies AcceptNeedTaskApiV1AgentsNeedTaskAcceptPostRequest;

  try {
    const data = await api.acceptNeedTaskApiV1AgentsNeedTaskAcceptPost(body);
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
| **taskId** | `number` |  | [Defaults to `undefined`] |

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


## completeNeedTaskApiV1AgentsNeedTaskCompletePost

> any completeNeedTaskApiV1AgentsNeedTaskCompletePost(taskId)

完成需求任务

### Example

```ts
import {
  Configuration,
  AgentRulesApi,
} from '';
import type { CompleteNeedTaskApiV1AgentsNeedTaskCompletePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentRulesApi(config);

  const body = {
    // number
    taskId: 56,
  } satisfies CompleteNeedTaskApiV1AgentsNeedTaskCompletePostRequest;

  try {
    const data = await api.completeNeedTaskApiV1AgentsNeedTaskCompletePost(body);
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
| **taskId** | `number` |  | [Defaults to `undefined`] |

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


## createNeedTaskApiV1AgentsNeedTaskCreatePost

> any createNeedTaskApiV1AgentsNeedTaskCreatePost(taskName, taskDesc, agentId, rewardTokens, deadline)

创建需求任务

### Example

```ts
import {
  Configuration,
  AgentRulesApi,
} from '';
import type { CreateNeedTaskApiV1AgentsNeedTaskCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentRulesApi(config);

  const body = {
    // string
    taskName: taskName_example,
    // string (optional)
    taskDesc: taskDesc_example,
    // string (optional)
    agentId: agentId_example,
    // number (optional)
    rewardTokens: 56,
    // string | ISO 时间字符串 (optional)
    deadline: deadline_example,
  } satisfies CreateNeedTaskApiV1AgentsNeedTaskCreatePostRequest;

  try {
    const data = await api.createNeedTaskApiV1AgentsNeedTaskCreatePost(body);
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
| **taskName** | `string` |  | [Defaults to `undefined`] |
| **taskDesc** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **agentId** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **rewardTokens** | `number` |  | [Optional] [Defaults to `0`] |
| **deadline** | `string` | ISO 时间字符串 | [Optional] [Defaults to `undefined`] |

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


## listNeedTasksApiV1AgentsNeedTaskListGet

> any listNeedTasksApiV1AgentsNeedTaskListGet(page, limit, status)

需求任务列表

### Example

```ts
import {
  Configuration,
  AgentRulesApi,
} from '';
import type { ListNeedTasksApiV1AgentsNeedTaskListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentRulesApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    status: 56,
  } satisfies ListNeedTasksApiV1AgentsNeedTaskListGetRequest;

  try {
    const data = await api.listNeedTasksApiV1AgentsNeedTaskListGet(body);
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
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## toggleRuleApiV1AgentsTogglePost

> any toggleRuleApiV1AgentsTogglePost(ruleId, status)

启用/禁用规则

### Example

```ts
import {
  Configuration,
  AgentRulesApi,
} from '';
import type { ToggleRuleApiV1AgentsTogglePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentRulesApi();

  const body = {
    // number
    ruleId: 56,
    // number | 0 禁用 1 启用
    status: 56,
  } satisfies ToggleRuleApiV1AgentsTogglePostRequest;

  try {
    const data = await api.toggleRuleApiV1AgentsTogglePost(body);
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
| **ruleId** | `number` |  | [Defaults to `undefined`] |
| **status** | `number` | 0 禁用 1 启用 | [Defaults to `undefined`] |

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

