# CozeWorkflowsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost**](#createworkflowrunapiv1cozeworkflowsworkflowsrunspost) | **POST** /api/v1/coze/workflows/workflows/runs | Create Workflow Run|
|[**createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0**](#createworkflowrunapiv1cozeworkflowsworkflowsrunspost_0) | **POST** /api/v1/coze/workflows/workflows/runs | Create Workflow Run|
|[**getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost**](#getnodehistoryapiv1cozeworkflowsworkflowsrunsexecutenodespost) | **POST** /api/v1/coze/workflows/workflows/runs/execute-nodes | Get Node History|
|[**getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0**](#getnodehistoryapiv1cozeworkflowsworkflowsrunsexecutenodespost_0) | **POST** /api/v1/coze/workflows/workflows/runs/execute-nodes | Get Node History|
|[**getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost**](#getrunhistoryapiv1cozeworkflowsworkflowsrunshistorypost) | **POST** /api/v1/coze/workflows/workflows/runs/history | Get Run History|
|[**getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0**](#getrunhistoryapiv1cozeworkflowsworkflowsrunshistorypost_0) | **POST** /api/v1/coze/workflows/workflows/runs/history | Get Run History|
|[**resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost**](#resumeworkflowapiv1cozeworkflowsworkflowsrunsresumepost) | **POST** /api/v1/coze/workflows/workflows/runs/resume | Resume Workflow|
|[**resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0**](#resumeworkflowapiv1cozeworkflowsworkflowsrunsresumepost_0) | **POST** /api/v1/coze/workflows/workflows/runs/resume | Resume Workflow|
|[**searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost**](#searchmodelworkflowapiv1cozeworkflowsworkflowssearchmodelworkflowrunpost) | **POST** /api/v1/coze/workflows/workflows/search/model/workflow/run | Search Model Workflow|
|[**searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0**](#searchmodelworkflowapiv1cozeworkflowsworkflowssearchmodelworkflowrunpost_0) | **POST** /api/v1/coze/workflows/workflows/search/model/workflow/run | Search Model Workflow|
|[**streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost**](#streamworkflowapiv1cozeworkflowsworkflowsrunsstreampost) | **POST** /api/v1/coze/workflows/workflows/runs/stream | Stream Workflow|
|[**streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0**](#streamworkflowapiv1cozeworkflowsworkflowsrunsstreampost_0) | **POST** /api/v1/coze/workflows/workflows/runs/stream | Stream Workflow|

# **createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost**
> any createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost(workflowRunReq)


### Example

```typescript
import {
    CozeWorkflowsApi,
    Configuration,
    WorkflowRunReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkflowsApi(configuration);

let workflowRunReq: WorkflowRunReq; //

const { status, data } = await apiInstance.createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost(
    workflowRunReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowRunReq** | **WorkflowRunReq**|  | |


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

# **createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0**
> any createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0(workflowRunReq)


### Example

```typescript
import {
    CozeWorkflowsApi,
    Configuration,
    WorkflowRunReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkflowsApi(configuration);

let workflowRunReq: WorkflowRunReq; //

const { status, data } = await apiInstance.createWorkflowRunApiV1CozeWorkflowsWorkflowsRunsPost_0(
    workflowRunReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowRunReq** | **WorkflowRunReq**|  | |


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

# **getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost**
> any getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost(workflowNodeExecuteReq)


### Example

```typescript
import {
    CozeWorkflowsApi,
    Configuration,
    WorkflowNodeExecuteReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkflowsApi(configuration);

let workflowNodeExecuteReq: WorkflowNodeExecuteReq; //

const { status, data } = await apiInstance.getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost(
    workflowNodeExecuteReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowNodeExecuteReq** | **WorkflowNodeExecuteReq**|  | |


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

# **getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0**
> any getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0(workflowNodeExecuteReq)


### Example

```typescript
import {
    CozeWorkflowsApi,
    Configuration,
    WorkflowNodeExecuteReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkflowsApi(configuration);

let workflowNodeExecuteReq: WorkflowNodeExecuteReq; //

const { status, data } = await apiInstance.getNodeHistoryApiV1CozeWorkflowsWorkflowsRunsExecuteNodesPost_0(
    workflowNodeExecuteReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowNodeExecuteReq** | **WorkflowNodeExecuteReq**|  | |


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

# **getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost**
> any getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost(workflowRunHistoryReq)


### Example

```typescript
import {
    CozeWorkflowsApi,
    Configuration,
    WorkflowRunHistoryReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkflowsApi(configuration);

let workflowRunHistoryReq: WorkflowRunHistoryReq; //

const { status, data } = await apiInstance.getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost(
    workflowRunHistoryReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowRunHistoryReq** | **WorkflowRunHistoryReq**|  | |


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

# **getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0**
> any getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0(workflowRunHistoryReq)


### Example

```typescript
import {
    CozeWorkflowsApi,
    Configuration,
    WorkflowRunHistoryReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkflowsApi(configuration);

let workflowRunHistoryReq: WorkflowRunHistoryReq; //

const { status, data } = await apiInstance.getRunHistoryApiV1CozeWorkflowsWorkflowsRunsHistoryPost_0(
    workflowRunHistoryReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowRunHistoryReq** | **WorkflowRunHistoryReq**|  | |


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

# **resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost**
> any resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost(workflowResumeReq)


### Example

```typescript
import {
    CozeWorkflowsApi,
    Configuration,
    WorkflowResumeReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkflowsApi(configuration);

let workflowResumeReq: WorkflowResumeReq; //

const { status, data } = await apiInstance.resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost(
    workflowResumeReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowResumeReq** | **WorkflowResumeReq**|  | |


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

# **resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0**
> any resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0(workflowResumeReq)


### Example

```typescript
import {
    CozeWorkflowsApi,
    Configuration,
    WorkflowResumeReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkflowsApi(configuration);

let workflowResumeReq: WorkflowResumeReq; //

const { status, data } = await apiInstance.resumeWorkflowApiV1CozeWorkflowsWorkflowsRunsResumePost_0(
    workflowResumeReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowResumeReq** | **WorkflowResumeReq**|  | |


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

# **searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost**
> any searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost(modelSearchReq)


### Example

```typescript
import {
    CozeWorkflowsApi,
    Configuration,
    ModelSearchReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkflowsApi(configuration);

let modelSearchReq: ModelSearchReq; //

const { status, data } = await apiInstance.searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost(
    modelSearchReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **modelSearchReq** | **ModelSearchReq**|  | |


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

# **searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0**
> any searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0(modelSearchReq)


### Example

```typescript
import {
    CozeWorkflowsApi,
    Configuration,
    ModelSearchReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkflowsApi(configuration);

let modelSearchReq: ModelSearchReq; //

const { status, data } = await apiInstance.searchModelWorkflowApiV1CozeWorkflowsWorkflowsSearchModelWorkflowRunPost_0(
    modelSearchReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **modelSearchReq** | **ModelSearchReq**|  | |


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

# **streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost**
> any streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost(workflowRunReq)


### Example

```typescript
import {
    CozeWorkflowsApi,
    Configuration,
    WorkflowRunReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkflowsApi(configuration);

let workflowRunReq: WorkflowRunReq; //

const { status, data } = await apiInstance.streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost(
    workflowRunReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowRunReq** | **WorkflowRunReq**|  | |


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

# **streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0**
> any streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0(workflowRunReq)


### Example

```typescript
import {
    CozeWorkflowsApi,
    Configuration,
    WorkflowRunReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkflowsApi(configuration);

let workflowRunReq: WorkflowRunReq; //

const { status, data } = await apiInstance.streamWorkflowApiV1CozeWorkflowsWorkflowsRunsStreamPost_0(
    workflowRunReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowRunReq** | **WorkflowRunReq**|  | |


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

