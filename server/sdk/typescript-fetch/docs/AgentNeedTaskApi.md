# AgentNeedTaskApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**acceptTaskApiV1AgentNeedTaskTidAcceptPost**](AgentNeedTaskApi.md#accepttaskapiv1agentneedtasktidacceptpost) | **POST** /api/v1/agent-need-task/{tid}/accept | 开发者认领 |
| [**acceptTaskApiV1AgentNeedTaskTidAcceptPost_0**](AgentNeedTaskApi.md#accepttaskapiv1agentneedtasktidacceptpost_0) | **POST** /api/v1/agent-need-task/{tid}/accept | 开发者认领 |
| [**bidTaskApiV1AgentNeedTaskTidBidPost**](AgentNeedTaskApi.md#bidtaskapiv1agentneedtasktidbidpost) | **POST** /api/v1/agent-need-task/{tid}/bid | 开发者报价 |
| [**bidTaskApiV1AgentNeedTaskTidBidPost_0**](AgentNeedTaskApi.md#bidtaskapiv1agentneedtasktidbidpost_0) | **POST** /api/v1/agent-need-task/{tid}/bid | 开发者报价 |
| [**createTaskApiV1AgentNeedTaskPost**](AgentNeedTaskApi.md#createtaskapiv1agentneedtaskpost) | **POST** /api/v1/agent-need-task | 发布需求 |
| [**createTaskApiV1AgentNeedTaskPost_0**](AgentNeedTaskApi.md#createtaskapiv1agentneedtaskpost_0) | **POST** /api/v1/agent-need-task | 发布需求 |
| [**deleteTaskApiV1AgentNeedTaskTidDelete**](AgentNeedTaskApi.md#deletetaskapiv1agentneedtasktiddelete) | **DELETE** /api/v1/agent-need-task/{tid} | 删除需求 |
| [**deleteTaskApiV1AgentNeedTaskTidDelete_0**](AgentNeedTaskApi.md#deletetaskapiv1agentneedtasktiddelete_0) | **DELETE** /api/v1/agent-need-task/{tid} | 删除需求 |
| [**getTaskApiV1AgentNeedTaskTidGet**](AgentNeedTaskApi.md#gettaskapiv1agentneedtasktidget) | **GET** /api/v1/agent-need-task/{tid} | 需求详情 |
| [**getTaskApiV1AgentNeedTaskTidGet_0**](AgentNeedTaskApi.md#gettaskapiv1agentneedtasktidget_0) | **GET** /api/v1/agent-need-task/{tid} | 需求详情 |
| [**listBidsApiV1AgentNeedTaskTidBidsGet**](AgentNeedTaskApi.md#listbidsapiv1agentneedtasktidbidsget) | **GET** /api/v1/agent-need-task/{tid}/bids | 任务报价列表 |
| [**listBidsApiV1AgentNeedTaskTidBidsGet_0**](AgentNeedTaskApi.md#listbidsapiv1agentneedtasktidbidsget_0) | **GET** /api/v1/agent-need-task/{tid}/bids | 任务报价列表 |
| [**listTasksApiV1AgentNeedTaskListGet**](AgentNeedTaskApi.md#listtasksapiv1agentneedtasklistget) | **GET** /api/v1/agent-need-task/list | 需求列表 |
| [**listTasksApiV1AgentNeedTaskListGet_0**](AgentNeedTaskApi.md#listtasksapiv1agentneedtasklistget_0) | **GET** /api/v1/agent-need-task/list | 需求列表 |
| [**updateTaskApiV1AgentNeedTaskTidPut**](AgentNeedTaskApi.md#updatetaskapiv1agentneedtasktidput) | **PUT** /api/v1/agent-need-task/{tid} | 修改需求 |
| [**updateTaskApiV1AgentNeedTaskTidPut_0**](AgentNeedTaskApi.md#updatetaskapiv1agentneedtasktidput_0) | **PUT** /api/v1/agent-need-task/{tid} | 修改需求 |



## acceptTaskApiV1AgentNeedTaskTidAcceptPost

> any acceptTaskApiV1AgentNeedTaskTidAcceptPost(tid)

开发者认领

### Example

```ts
import {
  Configuration,
  AgentNeedTaskApi,
} from '';
import type { AcceptTaskApiV1AgentNeedTaskTidAcceptPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentNeedTaskApi();

  const body = {
    // number
    tid: 56,
  } satisfies AcceptTaskApiV1AgentNeedTaskTidAcceptPostRequest;

  try {
    const data = await api.acceptTaskApiV1AgentNeedTaskTidAcceptPost(body);
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
| **tid** | `number` |  | [Defaults to `undefined`] |

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


## acceptTaskApiV1AgentNeedTaskTidAcceptPost_0

> any acceptTaskApiV1AgentNeedTaskTidAcceptPost_0(tid)

开发者认领

### Example

```ts
import {
  Configuration,
  AgentNeedTaskApi,
} from '';
import type { AcceptTaskApiV1AgentNeedTaskTidAcceptPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentNeedTaskApi();

  const body = {
    // number
    tid: 56,
  } satisfies AcceptTaskApiV1AgentNeedTaskTidAcceptPost0Request;

  try {
    const data = await api.acceptTaskApiV1AgentNeedTaskTidAcceptPost_0(body);
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
| **tid** | `number` |  | [Defaults to `undefined`] |

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


## bidTaskApiV1AgentNeedTaskTidBidPost

> any bidTaskApiV1AgentNeedTaskTidBidPost(tid, bid, remark)

开发者报价

### Example

```ts
import {
  Configuration,
  AgentNeedTaskApi,
} from '';
import type { BidTaskApiV1AgentNeedTaskTidBidPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentNeedTaskApi();

  const body = {
    // number
    tid: 56,
    // number
    bid: 56,
    // string (optional)
    remark: remark_example,
  } satisfies BidTaskApiV1AgentNeedTaskTidBidPostRequest;

  try {
    const data = await api.bidTaskApiV1AgentNeedTaskTidBidPost(body);
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
| **tid** | `number` |  | [Defaults to `undefined`] |
| **bid** | `number` |  | [Defaults to `undefined`] |
| **remark** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## bidTaskApiV1AgentNeedTaskTidBidPost_0

> any bidTaskApiV1AgentNeedTaskTidBidPost_0(tid, bid, remark)

开发者报价

### Example

```ts
import {
  Configuration,
  AgentNeedTaskApi,
} from '';
import type { BidTaskApiV1AgentNeedTaskTidBidPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentNeedTaskApi();

  const body = {
    // number
    tid: 56,
    // number
    bid: 56,
    // string (optional)
    remark: remark_example,
  } satisfies BidTaskApiV1AgentNeedTaskTidBidPost0Request;

  try {
    const data = await api.bidTaskApiV1AgentNeedTaskTidBidPost_0(body);
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
| **tid** | `number` |  | [Defaults to `undefined`] |
| **bid** | `number` |  | [Defaults to `undefined`] |
| **remark** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## createTaskApiV1AgentNeedTaskPost

> any createTaskApiV1AgentNeedTaskPost(title, description, type, agentId, agentName, priority, budget, deadline)

发布需求

### Example

```ts
import {
  Configuration,
  AgentNeedTaskApi,
} from '';
import type { CreateTaskApiV1AgentNeedTaskPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentNeedTaskApi();

  const body = {
    // string
    title: title_example,
    // string
    description: description_example,
    // string (optional)
    type: type_example,
    // string (optional)
    agentId: agentId_example,
    // string (optional)
    agentName: agentName_example,
    // number (optional)
    priority: 56,
    // number (optional)
    budget: 56,
    // Date (optional)
    deadline: 2013-10-20T19:20:30+01:00,
  } satisfies CreateTaskApiV1AgentNeedTaskPostRequest;

  try {
    const data = await api.createTaskApiV1AgentNeedTaskPost(body);
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
| **title** | `string` |  | [Defaults to `undefined`] |
| **description** | `string` |  | [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;develop&#39;`] |
| **agentId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **agentName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **priority** | `number` |  | [Optional] [Defaults to `1`] |
| **budget** | `number` |  | [Optional] [Defaults to `0`] |
| **deadline** | `Date` |  | [Optional] [Defaults to `undefined`] |

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


## createTaskApiV1AgentNeedTaskPost_0

> any createTaskApiV1AgentNeedTaskPost_0(title, description, type, agentId, agentName, priority, budget, deadline)

发布需求

### Example

```ts
import {
  Configuration,
  AgentNeedTaskApi,
} from '';
import type { CreateTaskApiV1AgentNeedTaskPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentNeedTaskApi();

  const body = {
    // string
    title: title_example,
    // string
    description: description_example,
    // string (optional)
    type: type_example,
    // string (optional)
    agentId: agentId_example,
    // string (optional)
    agentName: agentName_example,
    // number (optional)
    priority: 56,
    // number (optional)
    budget: 56,
    // Date (optional)
    deadline: 2013-10-20T19:20:30+01:00,
  } satisfies CreateTaskApiV1AgentNeedTaskPost0Request;

  try {
    const data = await api.createTaskApiV1AgentNeedTaskPost_0(body);
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
| **title** | `string` |  | [Defaults to `undefined`] |
| **description** | `string` |  | [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;develop&#39;`] |
| **agentId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **agentName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **priority** | `number` |  | [Optional] [Defaults to `1`] |
| **budget** | `number` |  | [Optional] [Defaults to `0`] |
| **deadline** | `Date` |  | [Optional] [Defaults to `undefined`] |

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


## deleteTaskApiV1AgentNeedTaskTidDelete

> any deleteTaskApiV1AgentNeedTaskTidDelete(tid)

删除需求

### Example

```ts
import {
  Configuration,
  AgentNeedTaskApi,
} from '';
import type { DeleteTaskApiV1AgentNeedTaskTidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentNeedTaskApi();

  const body = {
    // number
    tid: 56,
  } satisfies DeleteTaskApiV1AgentNeedTaskTidDeleteRequest;

  try {
    const data = await api.deleteTaskApiV1AgentNeedTaskTidDelete(body);
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
| **tid** | `number` |  | [Defaults to `undefined`] |

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


## deleteTaskApiV1AgentNeedTaskTidDelete_0

> any deleteTaskApiV1AgentNeedTaskTidDelete_0(tid)

删除需求

### Example

```ts
import {
  Configuration,
  AgentNeedTaskApi,
} from '';
import type { DeleteTaskApiV1AgentNeedTaskTidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentNeedTaskApi();

  const body = {
    // number
    tid: 56,
  } satisfies DeleteTaskApiV1AgentNeedTaskTidDelete0Request;

  try {
    const data = await api.deleteTaskApiV1AgentNeedTaskTidDelete_0(body);
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
| **tid** | `number` |  | [Defaults to `undefined`] |

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


## getTaskApiV1AgentNeedTaskTidGet

> any getTaskApiV1AgentNeedTaskTidGet(tid)

需求详情

### Example

```ts
import {
  Configuration,
  AgentNeedTaskApi,
} from '';
import type { GetTaskApiV1AgentNeedTaskTidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentNeedTaskApi();

  const body = {
    // number
    tid: 56,
  } satisfies GetTaskApiV1AgentNeedTaskTidGetRequest;

  try {
    const data = await api.getTaskApiV1AgentNeedTaskTidGet(body);
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
| **tid** | `number` |  | [Defaults to `undefined`] |

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


## getTaskApiV1AgentNeedTaskTidGet_0

> any getTaskApiV1AgentNeedTaskTidGet_0(tid)

需求详情

### Example

```ts
import {
  Configuration,
  AgentNeedTaskApi,
} from '';
import type { GetTaskApiV1AgentNeedTaskTidGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentNeedTaskApi();

  const body = {
    // number
    tid: 56,
  } satisfies GetTaskApiV1AgentNeedTaskTidGet0Request;

  try {
    const data = await api.getTaskApiV1AgentNeedTaskTidGet_0(body);
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
| **tid** | `number` |  | [Defaults to `undefined`] |

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


## listBidsApiV1AgentNeedTaskTidBidsGet

> any listBidsApiV1AgentNeedTaskTidBidsGet(tid)

任务报价列表

### Example

```ts
import {
  Configuration,
  AgentNeedTaskApi,
} from '';
import type { ListBidsApiV1AgentNeedTaskTidBidsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentNeedTaskApi();

  const body = {
    // number
    tid: 56,
  } satisfies ListBidsApiV1AgentNeedTaskTidBidsGetRequest;

  try {
    const data = await api.listBidsApiV1AgentNeedTaskTidBidsGet(body);
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
| **tid** | `number` |  | [Defaults to `undefined`] |

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


## listBidsApiV1AgentNeedTaskTidBidsGet_0

> any listBidsApiV1AgentNeedTaskTidBidsGet_0(tid)

任务报价列表

### Example

```ts
import {
  Configuration,
  AgentNeedTaskApi,
} from '';
import type { ListBidsApiV1AgentNeedTaskTidBidsGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentNeedTaskApi();

  const body = {
    // number
    tid: 56,
  } satisfies ListBidsApiV1AgentNeedTaskTidBidsGet0Request;

  try {
    const data = await api.listBidsApiV1AgentNeedTaskTidBidsGet_0(body);
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
| **tid** | `number` |  | [Defaults to `undefined`] |

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


## listTasksApiV1AgentNeedTaskListGet

> any listTasksApiV1AgentNeedTaskListGet(page, limit, status, type, userId, developerId, keyword)

需求列表

### Example

```ts
import {
  Configuration,
  AgentNeedTaskApi,
} from '';
import type { ListTasksApiV1AgentNeedTaskListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentNeedTaskApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    status: 56,
    // string (optional)
    type: type_example,
    // string (optional)
    userId: userId_example,
    // string (optional)
    developerId: developerId_example,
    // string (optional)
    keyword: keyword_example,
  } satisfies ListTasksApiV1AgentNeedTaskListGetRequest;

  try {
    const data = await api.listTasksApiV1AgentNeedTaskListGet(body);
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
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **developerId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **keyword** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## listTasksApiV1AgentNeedTaskListGet_0

> any listTasksApiV1AgentNeedTaskListGet_0(page, limit, status, type, userId, developerId, keyword)

需求列表

### Example

```ts
import {
  Configuration,
  AgentNeedTaskApi,
} from '';
import type { ListTasksApiV1AgentNeedTaskListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentNeedTaskApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    status: 56,
    // string (optional)
    type: type_example,
    // string (optional)
    userId: userId_example,
    // string (optional)
    developerId: developerId_example,
    // string (optional)
    keyword: keyword_example,
  } satisfies ListTasksApiV1AgentNeedTaskListGet0Request;

  try {
    const data = await api.listTasksApiV1AgentNeedTaskListGet_0(body);
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
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **developerId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **keyword** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## updateTaskApiV1AgentNeedTaskTidPut

> any updateTaskApiV1AgentNeedTaskTidPut(tid, title, description, priority, budget, status, deliverable, remark)

修改需求

### Example

```ts
import {
  Configuration,
  AgentNeedTaskApi,
} from '';
import type { UpdateTaskApiV1AgentNeedTaskTidPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentNeedTaskApi();

  const body = {
    // number
    tid: 56,
    // string (optional)
    title: title_example,
    // string (optional)
    description: description_example,
    // number (optional)
    priority: 56,
    // number (optional)
    budget: 56,
    // number (optional)
    status: 56,
    // string (optional)
    deliverable: deliverable_example,
    // string (optional)
    remark: remark_example,
  } satisfies UpdateTaskApiV1AgentNeedTaskTidPutRequest;

  try {
    const data = await api.updateTaskApiV1AgentNeedTaskTidPut(body);
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
| **tid** | `number` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **priority** | `number` |  | [Optional] [Defaults to `undefined`] |
| **budget** | `number` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **deliverable** | `string` |  | [Optional] [Defaults to `undefined`] |
| **remark** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## updateTaskApiV1AgentNeedTaskTidPut_0

> any updateTaskApiV1AgentNeedTaskTidPut_0(tid, title, description, priority, budget, status, deliverable, remark)

修改需求

### Example

```ts
import {
  Configuration,
  AgentNeedTaskApi,
} from '';
import type { UpdateTaskApiV1AgentNeedTaskTidPut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentNeedTaskApi();

  const body = {
    // number
    tid: 56,
    // string (optional)
    title: title_example,
    // string (optional)
    description: description_example,
    // number (optional)
    priority: 56,
    // number (optional)
    budget: 56,
    // number (optional)
    status: 56,
    // string (optional)
    deliverable: deliverable_example,
    // string (optional)
    remark: remark_example,
  } satisfies UpdateTaskApiV1AgentNeedTaskTidPut0Request;

  try {
    const data = await api.updateTaskApiV1AgentNeedTaskTidPut_0(body);
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
| **tid** | `number` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **priority** | `number` |  | [Optional] [Defaults to `undefined`] |
| **budget** | `number` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **deliverable** | `string` |  | [Optional] [Defaults to `undefined`] |
| **remark** | `string` |  | [Optional] [Defaults to `undefined`] |

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

