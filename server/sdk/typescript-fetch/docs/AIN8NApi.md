# AIN8NApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addAgentApiV1AiN8nAddAgentPost**](AIN8NApi.md#addagentapiv1ain8naddagentpost) | **POST** /api/v1/ai/n8n/addAgent | 通过N8N接口新增智能体 |
| [**getN8nWorkflowsApiV1AiN8nWorkflowsPost**](AIN8NApi.md#getn8nworkflowsapiv1ain8nworkflowspost) | **POST** /api/v1/ai/n8n/workflows | 查询N8N工作流列表 |
| [**runWorkflowApiV1AiN8nWorkflowRunPost**](AIN8NApi.md#runworkflowapiv1ain8nworkflowrunpost) | **POST** /api/v1/ai/n8n/workflow/run | 运行N8N工作流 |



## addAgentApiV1AiN8nAddAgentPost

> any addAgentApiV1AiN8nAddAgentPost(addAgentRequest)

通过N8N接口新增智能体

Add a new agent to the agents table and create an examination record. Matches the original n8n_proxy.py /addAgent endpoint.

### Example

```ts
import {
  Configuration,
  AIN8NApi,
} from '';
import type { AddAgentApiV1AiN8nAddAgentPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIN8NApi(config);

  const body = {
    // AddAgentRequest
    addAgentRequest: ...,
  } satisfies AddAgentApiV1AiN8nAddAgentPostRequest;

  try {
    const data = await api.addAgentApiV1AiN8nAddAgentPost(body);
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
| **addAgentRequest** | [AddAgentRequest](AddAgentRequest.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getN8nWorkflowsApiV1AiN8nWorkflowsPost

> any getN8nWorkflowsApiV1AiN8nWorkflowsPost(n8NWorkflowsRequest)

查询N8N工作流列表

Queries n8n workflows and returns a formatted list. Matches the original n8n_proxy.py /workflows endpoint.  /cozeZhsApi/n8n/workflows -&gt; POST here

### Example

```ts
import {
  Configuration,
  AIN8NApi,
} from '';
import type { GetN8nWorkflowsApiV1AiN8nWorkflowsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AIN8NApi();

  const body = {
    // N8NWorkflowsRequest
    n8NWorkflowsRequest: ...,
  } satisfies GetN8nWorkflowsApiV1AiN8nWorkflowsPostRequest;

  try {
    const data = await api.getN8nWorkflowsApiV1AiN8nWorkflowsPost(body);
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
| **n8NWorkflowsRequest** | [N8NWorkflowsRequest](N8NWorkflowsRequest.md) |  | |

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


## runWorkflowApiV1AiN8nWorkflowRunPost

> any runWorkflowApiV1AiN8nWorkflowRunPost(workflowRunRequest)

运行N8N工作流

Trigger an N8N workflow execution via webhook or API.

### Example

```ts
import {
  Configuration,
  AIN8NApi,
} from '';
import type { RunWorkflowApiV1AiN8nWorkflowRunPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIN8NApi(config);

  const body = {
    // WorkflowRunRequest
    workflowRunRequest: ...,
  } satisfies RunWorkflowApiV1AiN8nWorkflowRunPostRequest;

  try {
    const data = await api.runWorkflowApiV1AiN8nWorkflowRunPost(body);
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
| **workflowRunRequest** | [WorkflowRunRequest](WorkflowRunRequest.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

