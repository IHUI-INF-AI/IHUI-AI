# AIN8NApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**addAgentApiV1AiN8nAddAgentPost**](#addagentapiv1ain8naddagentpost) | **POST** /api/v1/ai/n8n/addAgent | 通过N8N接口新增智能体|
|[**getN8nWorkflowsApiV1AiN8nWorkflowsPost**](#getn8nworkflowsapiv1ain8nworkflowspost) | **POST** /api/v1/ai/n8n/workflows | 查询N8N工作流列表|
|[**runWorkflowApiV1AiN8nWorkflowRunPost**](#runworkflowapiv1ain8nworkflowrunpost) | **POST** /api/v1/ai/n8n/workflow/run | 运行N8N工作流|

# **addAgentApiV1AiN8nAddAgentPost**
> any addAgentApiV1AiN8nAddAgentPost(addAgentRequest)

Add a new agent to the agents table and create an examination record. Matches the original n8n_proxy.py /addAgent endpoint.

### Example

```typescript
import {
    AIN8NApi,
    Configuration,
    AddAgentRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIN8NApi(configuration);

let addAgentRequest: AddAgentRequest; //

const { status, data } = await apiInstance.addAgentApiV1AiN8nAddAgentPost(
    addAgentRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **addAgentRequest** | **AddAgentRequest**|  | |


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

# **getN8nWorkflowsApiV1AiN8nWorkflowsPost**
> any getN8nWorkflowsApiV1AiN8nWorkflowsPost(n8NWorkflowsRequest)

Queries n8n workflows and returns a formatted list. Matches the original n8n_proxy.py /workflows endpoint.  /cozeZhsApi/n8n/workflows -> POST here

### Example

```typescript
import {
    AIN8NApi,
    Configuration,
    N8NWorkflowsRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIN8NApi(configuration);

let n8NWorkflowsRequest: N8NWorkflowsRequest; //

const { status, data } = await apiInstance.getN8nWorkflowsApiV1AiN8nWorkflowsPost(
    n8NWorkflowsRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **n8NWorkflowsRequest** | **N8NWorkflowsRequest**|  | |


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

# **runWorkflowApiV1AiN8nWorkflowRunPost**
> any runWorkflowApiV1AiN8nWorkflowRunPost(workflowRunRequest)

Trigger an N8N workflow execution via webhook or API.

### Example

```typescript
import {
    AIN8NApi,
    Configuration,
    WorkflowRunRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIN8NApi(configuration);

let workflowRunRequest: WorkflowRunRequest; //

const { status, data } = await apiInstance.runWorkflowApiV1AiN8nWorkflowRunPost(
    workflowRunRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowRunRequest** | **WorkflowRunRequest**|  | |


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

