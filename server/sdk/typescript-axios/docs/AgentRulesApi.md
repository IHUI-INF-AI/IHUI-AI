# AgentRulesApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**acceptNeedTaskApiV1AgentsNeedTaskAcceptPost**](#acceptneedtaskapiv1agentsneedtaskacceptpost) | **POST** /api/v1/agents/need-task/accept | 接单需求任务|
|[**completeNeedTaskApiV1AgentsNeedTaskCompletePost**](#completeneedtaskapiv1agentsneedtaskcompletepost) | **POST** /api/v1/agents/need-task/complete | 完成需求任务|
|[**createNeedTaskApiV1AgentsNeedTaskCreatePost**](#createneedtaskapiv1agentsneedtaskcreatepost) | **POST** /api/v1/agents/need-task/create | 创建需求任务|
|[**listNeedTasksApiV1AgentsNeedTaskListGet**](#listneedtasksapiv1agentsneedtasklistget) | **GET** /api/v1/agents/need-task/list | 需求任务列表|
|[**toggleRuleApiV1AgentsTogglePost**](#toggleruleapiv1agentstogglepost) | **POST** /api/v1/agents/toggle | 启用/禁用规则|

# **acceptNeedTaskApiV1AgentsNeedTaskAcceptPost**
> any acceptNeedTaskApiV1AgentsNeedTaskAcceptPost()


### Example

```typescript
import {
    AgentRulesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentRulesApi(configuration);

let taskId: number; // (default to undefined)

const { status, data } = await apiInstance.acceptNeedTaskApiV1AgentsNeedTaskAcceptPost(
    taskId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **taskId** | [**number**] |  | defaults to undefined|


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

# **completeNeedTaskApiV1AgentsNeedTaskCompletePost**
> any completeNeedTaskApiV1AgentsNeedTaskCompletePost()


### Example

```typescript
import {
    AgentRulesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentRulesApi(configuration);

let taskId: number; // (default to undefined)

const { status, data } = await apiInstance.completeNeedTaskApiV1AgentsNeedTaskCompletePost(
    taskId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **taskId** | [**number**] |  | defaults to undefined|


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

# **createNeedTaskApiV1AgentsNeedTaskCreatePost**
> any createNeedTaskApiV1AgentsNeedTaskCreatePost()


### Example

```typescript
import {
    AgentRulesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentRulesApi(configuration);

let taskName: string; // (default to undefined)
let taskDesc: string; // (optional) (default to '')
let agentId: string; // (optional) (default to '')
let rewardTokens: number; // (optional) (default to 0)
let deadline: string; //ISO 时间字符串 (optional) (default to undefined)

const { status, data } = await apiInstance.createNeedTaskApiV1AgentsNeedTaskCreatePost(
    taskName,
    taskDesc,
    agentId,
    rewardTokens,
    deadline
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **taskName** | [**string**] |  | defaults to undefined|
| **taskDesc** | [**string**] |  | (optional) defaults to ''|
| **agentId** | [**string**] |  | (optional) defaults to ''|
| **rewardTokens** | [**number**] |  | (optional) defaults to 0|
| **deadline** | [**string**] | ISO 时间字符串 | (optional) defaults to undefined|


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

# **listNeedTasksApiV1AgentsNeedTaskListGet**
> any listNeedTasksApiV1AgentsNeedTaskListGet()


### Example

```typescript
import {
    AgentRulesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentRulesApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listNeedTasksApiV1AgentsNeedTaskListGet(
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
| **status** | [**number**] |  | (optional) defaults to undefined|


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

# **toggleRuleApiV1AgentsTogglePost**
> any toggleRuleApiV1AgentsTogglePost()


### Example

```typescript
import {
    AgentRulesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentRulesApi(configuration);

let ruleId: number; // (default to undefined)
let status: number; //0 禁用 1 启用 (default to undefined)

const { status, data } = await apiInstance.toggleRuleApiV1AgentsTogglePost(
    ruleId,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **ruleId** | [**number**] |  | defaults to undefined|
| **status** | [**number**] | 0 禁用 1 启用 | defaults to undefined|


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

