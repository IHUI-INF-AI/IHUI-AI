# AgentNeedTaskApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**acceptTaskApiV1AgentNeedTaskTidAcceptPost**](#accepttaskapiv1agentneedtasktidacceptpost) | **POST** /api/v1/agent-need-task/{tid}/accept | 开发者认领|
|[**acceptTaskApiV1AgentNeedTaskTidAcceptPost_0**](#accepttaskapiv1agentneedtasktidacceptpost_0) | **POST** /api/v1/agent-need-task/{tid}/accept | 开发者认领|
|[**bidTaskApiV1AgentNeedTaskTidBidPost**](#bidtaskapiv1agentneedtasktidbidpost) | **POST** /api/v1/agent-need-task/{tid}/bid | 开发者报价|
|[**bidTaskApiV1AgentNeedTaskTidBidPost_0**](#bidtaskapiv1agentneedtasktidbidpost_0) | **POST** /api/v1/agent-need-task/{tid}/bid | 开发者报价|
|[**createTaskApiV1AgentNeedTaskPost**](#createtaskapiv1agentneedtaskpost) | **POST** /api/v1/agent-need-task | 发布需求|
|[**createTaskApiV1AgentNeedTaskPost_0**](#createtaskapiv1agentneedtaskpost_0) | **POST** /api/v1/agent-need-task | 发布需求|
|[**deleteTaskApiV1AgentNeedTaskTidDelete**](#deletetaskapiv1agentneedtasktiddelete) | **DELETE** /api/v1/agent-need-task/{tid} | 删除需求|
|[**deleteTaskApiV1AgentNeedTaskTidDelete_0**](#deletetaskapiv1agentneedtasktiddelete_0) | **DELETE** /api/v1/agent-need-task/{tid} | 删除需求|
|[**getTaskApiV1AgentNeedTaskTidGet**](#gettaskapiv1agentneedtasktidget) | **GET** /api/v1/agent-need-task/{tid} | 需求详情|
|[**getTaskApiV1AgentNeedTaskTidGet_0**](#gettaskapiv1agentneedtasktidget_0) | **GET** /api/v1/agent-need-task/{tid} | 需求详情|
|[**listBidsApiV1AgentNeedTaskTidBidsGet**](#listbidsapiv1agentneedtasktidbidsget) | **GET** /api/v1/agent-need-task/{tid}/bids | 任务报价列表|
|[**listBidsApiV1AgentNeedTaskTidBidsGet_0**](#listbidsapiv1agentneedtasktidbidsget_0) | **GET** /api/v1/agent-need-task/{tid}/bids | 任务报价列表|
|[**listTasksApiV1AgentNeedTaskListGet**](#listtasksapiv1agentneedtasklistget) | **GET** /api/v1/agent-need-task/list | 需求列表|
|[**listTasksApiV1AgentNeedTaskListGet_0**](#listtasksapiv1agentneedtasklistget_0) | **GET** /api/v1/agent-need-task/list | 需求列表|
|[**updateTaskApiV1AgentNeedTaskTidPut**](#updatetaskapiv1agentneedtasktidput) | **PUT** /api/v1/agent-need-task/{tid} | 修改需求|
|[**updateTaskApiV1AgentNeedTaskTidPut_0**](#updatetaskapiv1agentneedtasktidput_0) | **PUT** /api/v1/agent-need-task/{tid} | 修改需求|

# **acceptTaskApiV1AgentNeedTaskTidAcceptPost**
> any acceptTaskApiV1AgentNeedTaskTidAcceptPost()


### Example

```typescript
import {
    AgentNeedTaskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentNeedTaskApi(configuration);

let tid: number; // (default to undefined)

const { status, data } = await apiInstance.acceptTaskApiV1AgentNeedTaskTidAcceptPost(
    tid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tid** | [**number**] |  | defaults to undefined|


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

# **acceptTaskApiV1AgentNeedTaskTidAcceptPost_0**
> any acceptTaskApiV1AgentNeedTaskTidAcceptPost_0()


### Example

```typescript
import {
    AgentNeedTaskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentNeedTaskApi(configuration);

let tid: number; // (default to undefined)

const { status, data } = await apiInstance.acceptTaskApiV1AgentNeedTaskTidAcceptPost_0(
    tid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tid** | [**number**] |  | defaults to undefined|


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

# **bidTaskApiV1AgentNeedTaskTidBidPost**
> any bidTaskApiV1AgentNeedTaskTidBidPost()


### Example

```typescript
import {
    AgentNeedTaskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentNeedTaskApi(configuration);

let tid: number; // (default to undefined)
let bid: number; // (default to undefined)
let remark: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.bidTaskApiV1AgentNeedTaskTidBidPost(
    tid,
    bid,
    remark
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tid** | [**number**] |  | defaults to undefined|
| **bid** | [**number**] |  | defaults to undefined|
| **remark** | [**string**] |  | (optional) defaults to undefined|


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

# **bidTaskApiV1AgentNeedTaskTidBidPost_0**
> any bidTaskApiV1AgentNeedTaskTidBidPost_0()


### Example

```typescript
import {
    AgentNeedTaskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentNeedTaskApi(configuration);

let tid: number; // (default to undefined)
let bid: number; // (default to undefined)
let remark: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.bidTaskApiV1AgentNeedTaskTidBidPost_0(
    tid,
    bid,
    remark
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tid** | [**number**] |  | defaults to undefined|
| **bid** | [**number**] |  | defaults to undefined|
| **remark** | [**string**] |  | (optional) defaults to undefined|


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

# **createTaskApiV1AgentNeedTaskPost**
> any createTaskApiV1AgentNeedTaskPost()


### Example

```typescript
import {
    AgentNeedTaskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentNeedTaskApi(configuration);

let title: string; // (default to undefined)
let description: string; // (default to undefined)
let type: string; // (optional) (default to 'develop')
let agentId: string; // (optional) (default to undefined)
let agentName: string; // (optional) (default to undefined)
let priority: number; // (optional) (default to 1)
let budget: number; // (optional) (default to 0)
let deadline: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createTaskApiV1AgentNeedTaskPost(
    title,
    description,
    type,
    agentId,
    agentName,
    priority,
    budget,
    deadline
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | defaults to undefined|
| **description** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'develop'|
| **agentId** | [**string**] |  | (optional) defaults to undefined|
| **agentName** | [**string**] |  | (optional) defaults to undefined|
| **priority** | [**number**] |  | (optional) defaults to 1|
| **budget** | [**number**] |  | (optional) defaults to 0|
| **deadline** | [**string**] |  | (optional) defaults to undefined|


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

# **createTaskApiV1AgentNeedTaskPost_0**
> any createTaskApiV1AgentNeedTaskPost_0()


### Example

```typescript
import {
    AgentNeedTaskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentNeedTaskApi(configuration);

let title: string; // (default to undefined)
let description: string; // (default to undefined)
let type: string; // (optional) (default to 'develop')
let agentId: string; // (optional) (default to undefined)
let agentName: string; // (optional) (default to undefined)
let priority: number; // (optional) (default to 1)
let budget: number; // (optional) (default to 0)
let deadline: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createTaskApiV1AgentNeedTaskPost_0(
    title,
    description,
    type,
    agentId,
    agentName,
    priority,
    budget,
    deadline
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | defaults to undefined|
| **description** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'develop'|
| **agentId** | [**string**] |  | (optional) defaults to undefined|
| **agentName** | [**string**] |  | (optional) defaults to undefined|
| **priority** | [**number**] |  | (optional) defaults to 1|
| **budget** | [**number**] |  | (optional) defaults to 0|
| **deadline** | [**string**] |  | (optional) defaults to undefined|


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

# **deleteTaskApiV1AgentNeedTaskTidDelete**
> any deleteTaskApiV1AgentNeedTaskTidDelete()


### Example

```typescript
import {
    AgentNeedTaskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentNeedTaskApi(configuration);

let tid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteTaskApiV1AgentNeedTaskTidDelete(
    tid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tid** | [**number**] |  | defaults to undefined|


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

# **deleteTaskApiV1AgentNeedTaskTidDelete_0**
> any deleteTaskApiV1AgentNeedTaskTidDelete_0()


### Example

```typescript
import {
    AgentNeedTaskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentNeedTaskApi(configuration);

let tid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteTaskApiV1AgentNeedTaskTidDelete_0(
    tid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tid** | [**number**] |  | defaults to undefined|


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

# **getTaskApiV1AgentNeedTaskTidGet**
> any getTaskApiV1AgentNeedTaskTidGet()


### Example

```typescript
import {
    AgentNeedTaskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentNeedTaskApi(configuration);

let tid: number; // (default to undefined)

const { status, data } = await apiInstance.getTaskApiV1AgentNeedTaskTidGet(
    tid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tid** | [**number**] |  | defaults to undefined|


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

# **getTaskApiV1AgentNeedTaskTidGet_0**
> any getTaskApiV1AgentNeedTaskTidGet_0()


### Example

```typescript
import {
    AgentNeedTaskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentNeedTaskApi(configuration);

let tid: number; // (default to undefined)

const { status, data } = await apiInstance.getTaskApiV1AgentNeedTaskTidGet_0(
    tid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tid** | [**number**] |  | defaults to undefined|


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

# **listBidsApiV1AgentNeedTaskTidBidsGet**
> any listBidsApiV1AgentNeedTaskTidBidsGet()


### Example

```typescript
import {
    AgentNeedTaskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentNeedTaskApi(configuration);

let tid: number; // (default to undefined)

const { status, data } = await apiInstance.listBidsApiV1AgentNeedTaskTidBidsGet(
    tid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tid** | [**number**] |  | defaults to undefined|


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

# **listBidsApiV1AgentNeedTaskTidBidsGet_0**
> any listBidsApiV1AgentNeedTaskTidBidsGet_0()


### Example

```typescript
import {
    AgentNeedTaskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentNeedTaskApi(configuration);

let tid: number; // (default to undefined)

const { status, data } = await apiInstance.listBidsApiV1AgentNeedTaskTidBidsGet_0(
    tid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tid** | [**number**] |  | defaults to undefined|


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

# **listTasksApiV1AgentNeedTaskListGet**
> any listTasksApiV1AgentNeedTaskListGet()


### Example

```typescript
import {
    AgentNeedTaskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentNeedTaskApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; // (optional) (default to undefined)
let type: string; // (optional) (default to undefined)
let userId: string; // (optional) (default to undefined)
let developerId: string; // (optional) (default to undefined)
let keyword: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listTasksApiV1AgentNeedTaskListGet(
    page,
    limit,
    status,
    type,
    userId,
    developerId,
    keyword
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to undefined|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **developerId** | [**string**] |  | (optional) defaults to undefined|
| **keyword** | [**string**] |  | (optional) defaults to undefined|


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

# **listTasksApiV1AgentNeedTaskListGet_0**
> any listTasksApiV1AgentNeedTaskListGet_0()


### Example

```typescript
import {
    AgentNeedTaskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentNeedTaskApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; // (optional) (default to undefined)
let type: string; // (optional) (default to undefined)
let userId: string; // (optional) (default to undefined)
let developerId: string; // (optional) (default to undefined)
let keyword: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listTasksApiV1AgentNeedTaskListGet_0(
    page,
    limit,
    status,
    type,
    userId,
    developerId,
    keyword
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to undefined|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **developerId** | [**string**] |  | (optional) defaults to undefined|
| **keyword** | [**string**] |  | (optional) defaults to undefined|


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

# **updateTaskApiV1AgentNeedTaskTidPut**
> any updateTaskApiV1AgentNeedTaskTidPut()


### Example

```typescript
import {
    AgentNeedTaskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentNeedTaskApi(configuration);

let tid: number; // (default to undefined)
let title: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)
let priority: number; // (optional) (default to undefined)
let budget: number; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let deliverable: string; // (optional) (default to undefined)
let remark: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateTaskApiV1AgentNeedTaskTidPut(
    tid,
    title,
    description,
    priority,
    budget,
    status,
    deliverable,
    remark
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tid** | [**number**] |  | defaults to undefined|
| **title** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **priority** | [**number**] |  | (optional) defaults to undefined|
| **budget** | [**number**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **deliverable** | [**string**] |  | (optional) defaults to undefined|
| **remark** | [**string**] |  | (optional) defaults to undefined|


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

# **updateTaskApiV1AgentNeedTaskTidPut_0**
> any updateTaskApiV1AgentNeedTaskTidPut_0()


### Example

```typescript
import {
    AgentNeedTaskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentNeedTaskApi(configuration);

let tid: number; // (default to undefined)
let title: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)
let priority: number; // (optional) (default to undefined)
let budget: number; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let deliverable: string; // (optional) (default to undefined)
let remark: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateTaskApiV1AgentNeedTaskTidPut_0(
    tid,
    title,
    description,
    priority,
    budget,
    status,
    deliverable,
    remark
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tid** | [**number**] |  | defaults to undefined|
| **title** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **priority** | [**number**] |  | (optional) defaults to undefined|
| **budget** | [**number**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **deliverable** | [**string**] |  | (optional) defaults to undefined|
| **remark** | [**string**] |  | (optional) defaults to undefined|


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

