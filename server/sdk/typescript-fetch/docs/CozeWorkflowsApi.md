# CozeWorkflowsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost**](CozeWorkflowsApi.md#createworkflowrunapiv1cozeworkflowsworkflowsrunspost) | **POST** /api/v1/coze/workflows/workflows/runs | Create Workflow Run |
| [**createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0**](CozeWorkflowsApi.md#createworkflowrunapiv1cozeworkflowsworkflowsrunspost_0) | **POST** /api/v1/coze/workflows/workflows/runs | Create Workflow Run |
| [**getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost**](CozeWorkflowsApi.md#getnodehistoryapiv1cozeworkflowsworkflowsrunsexecutenodespost) | **POST** /api/v1/coze/workflows/workflows/runs/execute-nodes | Get Node History |
| [**getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0**](CozeWorkflowsApi.md#getnodehistoryapiv1cozeworkflowsworkflowsrunsexecutenodespost_0) | **POST** /api/v1/coze/workflows/workflows/runs/execute-nodes | Get Node History |
| [**getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost**](CozeWorkflowsApi.md#getrunhistoryapiv1cozeworkflowsworkflowsrunshistorypost) | **POST** /api/v1/coze/workflows/workflows/runs/history | Get Run History |
| [**getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0**](CozeWorkflowsApi.md#getrunhistoryapiv1cozeworkflowsworkflowsrunshistorypost_0) | **POST** /api/v1/coze/workflows/workflows/runs/history | Get Run History |
| [**resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost**](CozeWorkflowsApi.md#resumeworkflowapiv1cozeworkflowsworkflowsrunsresumepost) | **POST** /api/v1/coze/workflows/workflows/runs/resume | Resume Workflow |
| [**resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0**](CozeWorkflowsApi.md#resumeworkflowapiv1cozeworkflowsworkflowsrunsresumepost_0) | **POST** /api/v1/coze/workflows/workflows/runs/resume | Resume Workflow |
| [**searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost**](CozeWorkflowsApi.md#searchmodelworkflowapiv1cozeworkflowsworkflowssearchmodelworkflowrunpost) | **POST** /api/v1/coze/workflows/workflows/search/model/workflow/run | Search Model Workflow |
| [**searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0**](CozeWorkflowsApi.md#searchmodelworkflowapiv1cozeworkflowsworkflowssearchmodelworkflowrunpost_0) | **POST** /api/v1/coze/workflows/workflows/search/model/workflow/run | Search Model Workflow |
| [**streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost**](CozeWorkflowsApi.md#streamworkflowapiv1cozeworkflowsworkflowsrunsstreampost) | **POST** /api/v1/coze/workflows/workflows/runs/stream | Stream Workflow |
| [**streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0**](CozeWorkflowsApi.md#streamworkflowapiv1cozeworkflowsworkflowsrunsstreampost_0) | **POST** /api/v1/coze/workflows/workflows/runs/stream | Stream Workflow |



## createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost

> any createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost(workflowRunReq)

Create Workflow Run

### Example

```ts
import {
  Configuration,
  CozeWorkflowsApi,
} from '';
import type { CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeWorkflowsApi();

  const body = {
    // WorkflowRunReq
    workflowRunReq: ...,
  } satisfies CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPostRequest;

  try {
    const data = await api.createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost(body);
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
| **workflowRunReq** | [WorkflowRunReq](WorkflowRunReq.md) |  | |

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


## createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0

> any createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0(workflowRunReq)

Create Workflow Run

### Example

```ts
import {
  Configuration,
  CozeWorkflowsApi,
} from '';
import type { CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeWorkflowsApi();

  const body = {
    // WorkflowRunReq
    workflowRunReq: ...,
  } satisfies CreateWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost0Request;

  try {
    const data = await api.createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0(body);
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
| **workflowRunReq** | [WorkflowRunReq](WorkflowRunReq.md) |  | |

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


## getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost

> any getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost(workflowNodeExecuteReq)

Get Node History

### Example

```ts
import {
  Configuration,
  CozeWorkflowsApi,
} from '';
import type { GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeWorkflowsApi();

  const body = {
    // WorkflowNodeExecuteReq
    workflowNodeExecuteReq: ...,
  } satisfies GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPostRequest;

  try {
    const data = await api.getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost(body);
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
| **workflowNodeExecuteReq** | [WorkflowNodeExecuteReq](WorkflowNodeExecuteReq.md) |  | |

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


## getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0

> any getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0(workflowNodeExecuteReq)

Get Node History

### Example

```ts
import {
  Configuration,
  CozeWorkflowsApi,
} from '';
import type { GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeWorkflowsApi();

  const body = {
    // WorkflowNodeExecuteReq
    workflowNodeExecuteReq: ...,
  } satisfies GetNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost0Request;

  try {
    const data = await api.getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0(body);
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
| **workflowNodeExecuteReq** | [WorkflowNodeExecuteReq](WorkflowNodeExecuteReq.md) |  | |

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


## getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost

> any getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost(workflowRunHistoryReq)

Get Run History

### Example

```ts
import {
  Configuration,
  CozeWorkflowsApi,
} from '';
import type { GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeWorkflowsApi();

  const body = {
    // WorkflowRunHistoryReq
    workflowRunHistoryReq: ...,
  } satisfies GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPostRequest;

  try {
    const data = await api.getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost(body);
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
| **workflowRunHistoryReq** | [WorkflowRunHistoryReq](WorkflowRunHistoryReq.md) |  | |

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


## getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0

> any getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0(workflowRunHistoryReq)

Get Run History

### Example

```ts
import {
  Configuration,
  CozeWorkflowsApi,
} from '';
import type { GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeWorkflowsApi();

  const body = {
    // WorkflowRunHistoryReq
    workflowRunHistoryReq: ...,
  } satisfies GetRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost0Request;

  try {
    const data = await api.getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0(body);
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
| **workflowRunHistoryReq** | [WorkflowRunHistoryReq](WorkflowRunHistoryReq.md) |  | |

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


## resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost

> any resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost(workflowResumeReq)

Resume Workflow

### Example

```ts
import {
  Configuration,
  CozeWorkflowsApi,
} from '';
import type { ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeWorkflowsApi();

  const body = {
    // WorkflowResumeReq
    workflowResumeReq: ...,
  } satisfies ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePostRequest;

  try {
    const data = await api.resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost(body);
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
| **workflowResumeReq** | [WorkflowResumeReq](WorkflowResumeReq.md) |  | |

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


## resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0

> any resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0(workflowResumeReq)

Resume Workflow

### Example

```ts
import {
  Configuration,
  CozeWorkflowsApi,
} from '';
import type { ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeWorkflowsApi();

  const body = {
    // WorkflowResumeReq
    workflowResumeReq: ...,
  } satisfies ResumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost0Request;

  try {
    const data = await api.resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0(body);
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
| **workflowResumeReq** | [WorkflowResumeReq](WorkflowResumeReq.md) |  | |

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


## searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost

> any searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost(modelSearchReq)

Search Model Workflow

### Example

```ts
import {
  Configuration,
  CozeWorkflowsApi,
} from '';
import type { SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeWorkflowsApi();

  const body = {
    // ModelSearchReq
    modelSearchReq: ...,
  } satisfies SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPostRequest;

  try {
    const data = await api.searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost(body);
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
| **modelSearchReq** | [ModelSearchReq](ModelSearchReq.md) |  | |

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


## searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0

> any searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0(modelSearchReq)

Search Model Workflow

### Example

```ts
import {
  Configuration,
  CozeWorkflowsApi,
} from '';
import type { SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeWorkflowsApi();

  const body = {
    // ModelSearchReq
    modelSearchReq: ...,
  } satisfies SearchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost0Request;

  try {
    const data = await api.searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0(body);
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
| **modelSearchReq** | [ModelSearchReq](ModelSearchReq.md) |  | |

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


## streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost

> any streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost(workflowRunReq)

Stream Workflow

### Example

```ts
import {
  Configuration,
  CozeWorkflowsApi,
} from '';
import type { StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeWorkflowsApi();

  const body = {
    // WorkflowRunReq
    workflowRunReq: ...,
  } satisfies StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPostRequest;

  try {
    const data = await api.streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost(body);
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
| **workflowRunReq** | [WorkflowRunReq](WorkflowRunReq.md) |  | |

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


## streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0

> any streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0(workflowRunReq)

Stream Workflow

### Example

```ts
import {
  Configuration,
  CozeWorkflowsApi,
} from '';
import type { StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeWorkflowsApi();

  const body = {
    // WorkflowRunReq
    workflowRunReq: ...,
  } satisfies StreamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost0Request;

  try {
    const data = await api.streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0(body);
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
| **workflowRunReq** | [WorkflowRunReq](WorkflowRunReq.md) |  | |

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

