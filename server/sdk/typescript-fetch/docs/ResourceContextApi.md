# ResourceContextApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getAgentWithDeductionApiV1ResourceContextAgentAgentIdGet**](ResourceContextApi.md#getagentwithdeductionapiv1resourcecontextagentagentidget) | **GET** /api/v1/resource/context/agent/{agent_id} | 获取Agent调用（含token扣除） |
| [**getContextApiV1ResourceContextGetGet**](ResourceContextApi.md#getcontextapiv1resourcecontextgetget) | **GET** /api/v1/resource/context/get | 获取用户上下文 |
| [**getFieldApiV1ResourceContextFieldGet**](ResourceContextApi.md#getfieldapiv1resourcecontextfieldget) | **GET** /api/v1/resource/context/field | 获取指定字段值 |
| [**getSampleContextApiV1ResourceContextSampleGet**](ResourceContextApi.md#getsamplecontextapiv1resourcecontextsampleget) | **GET** /api/v1/resource/context/sample | Get sample context data |
| [**getUsageHistoryApiV1ResourceContextHistoryPost**](ResourceContextApi.md#getusagehistoryapiv1resourcecontexthistorypost) | **POST** /api/v1/resource/context/history | Query usage history |
| [**queryContextRawApiV1ResourceContextQueryPost**](ResourceContextApi.md#querycontextrawapiv1resourcecontextquerypost) | **POST** /api/v1/resource/context/query | Query user agent context (raw SQL) |
| [**removeFieldApiV1ResourceContextRemoveFieldPost**](ResourceContextApi.md#removefieldapiv1resourcecontextremovefieldpost) | **POST** /api/v1/resource/context/remove/field | 删除指定字段 |
| [**saveContextApiV1ResourceContextSavePost**](ResourceContextApi.md#savecontextapiv1resourcecontextsavepost) | **POST** /api/v1/resource/context/save | 保存用户上下文 |



## getAgentWithDeductionApiV1ResourceContextAgentAgentIdGet

> any getAgentWithDeductionApiV1ResourceContextAgentAgentIdGet(agentId)

获取Agent调用（含token扣除）

### Example

```ts
import {
  Configuration,
  ResourceContextApi,
} from '';
import type { GetAgentWithDeductionApiV1ResourceContextAgentAgentIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceContextApi(config);

  const body = {
    // string
    agentId: agentId_example,
  } satisfies GetAgentWithDeductionApiV1ResourceContextAgentAgentIdGetRequest;

  try {
    const data = await api.getAgentWithDeductionApiV1ResourceContextAgentAgentIdGet(body);
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


## getContextApiV1ResourceContextGetGet

> any getContextApiV1ResourceContextGetGet(agentId, contextKey)

获取用户上下文

### Example

```ts
import {
  Configuration,
  ResourceContextApi,
} from '';
import type { GetContextApiV1ResourceContextGetGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceContextApi(config);

  const body = {
    // string | Agent ID
    agentId: agentId_example,
    // string | Context key (optional filter) (optional)
    contextKey: contextKey_example,
  } satisfies GetContextApiV1ResourceContextGetGetRequest;

  try {
    const data = await api.getContextApiV1ResourceContextGetGet(body);
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
| **agentId** | `string` | Agent ID | [Defaults to `undefined`] |
| **contextKey** | `string` | Context key (optional filter) | [Optional] [Defaults to `undefined`] |

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


## getFieldApiV1ResourceContextFieldGet

> any getFieldApiV1ResourceContextFieldGet(agentId, fieldName)

获取指定字段值

### Example

```ts
import {
  Configuration,
  ResourceContextApi,
} from '';
import type { GetFieldApiV1ResourceContextFieldGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceContextApi(config);

  const body = {
    // string
    agentId: agentId_example,
    // string
    fieldName: fieldName_example,
  } satisfies GetFieldApiV1ResourceContextFieldGetRequest;

  try {
    const data = await api.getFieldApiV1ResourceContextFieldGet(body);
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
| **fieldName** | `string` |  | [Defaults to `undefined`] |

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


## getSampleContextApiV1ResourceContextSampleGet

> any getSampleContextApiV1ResourceContextSampleGet(limit)

Get sample context data

Return a few sample rows for debugging / display.

### Example

```ts
import {
  Configuration,
  ResourceContextApi,
} from '';
import type { GetSampleContextApiV1ResourceContextSampleGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceContextApi(config);

  const body = {
    // number | Number of rows (optional)
    limit: 56,
  } satisfies GetSampleContextApiV1ResourceContextSampleGetRequest;

  try {
    const data = await api.getSampleContextApiV1ResourceContextSampleGet(body);
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
| **limit** | `number` | Number of rows | [Optional] [Defaults to `5`] |

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


## getUsageHistoryApiV1ResourceContextHistoryPost

> any getUsageHistoryApiV1ResourceContextHistoryPost(historyRequest)

Query usage history

Query user\&#39;s agent usage history with model name join and pagination.

### Example

```ts
import {
  Configuration,
  ResourceContextApi,
} from '';
import type { GetUsageHistoryApiV1ResourceContextHistoryPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceContextApi(config);

  const body = {
    // HistoryRequest
    historyRequest: ...,
  } satisfies GetUsageHistoryApiV1ResourceContextHistoryPostRequest;

  try {
    const data = await api.getUsageHistoryApiV1ResourceContextHistoryPost(body);
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
| **historyRequest** | [HistoryRequest](HistoryRequest.md) |  | |

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


## queryContextRawApiV1ResourceContextQueryPost

> any queryContextRawApiV1ResourceContextQueryPost(rawContextRequest)

Query user agent context (raw SQL)

Query zhs_user_agent_context by user_uuid + model_name + chat_id. Returns messages list with user/assistant role alternation.

### Example

```ts
import {
  Configuration,
  ResourceContextApi,
} from '';
import type { QueryContextRawApiV1ResourceContextQueryPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceContextApi(config);

  const body = {
    // RawContextRequest
    rawContextRequest: ...,
  } satisfies QueryContextRawApiV1ResourceContextQueryPostRequest;

  try {
    const data = await api.queryContextRawApiV1ResourceContextQueryPost(body);
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
| **rawContextRequest** | [RawContextRequest](RawContextRequest.md) |  | |

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


## removeFieldApiV1ResourceContextRemoveFieldPost

> any removeFieldApiV1ResourceContextRemoveFieldPost(fieldRemoveRequest)

删除指定字段

### Example

```ts
import {
  Configuration,
  ResourceContextApi,
} from '';
import type { RemoveFieldApiV1ResourceContextRemoveFieldPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceContextApi(config);

  const body = {
    // FieldRemoveRequest
    fieldRemoveRequest: ...,
  } satisfies RemoveFieldApiV1ResourceContextRemoveFieldPostRequest;

  try {
    const data = await api.removeFieldApiV1ResourceContextRemoveFieldPost(body);
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
| **fieldRemoveRequest** | [FieldRemoveRequest](FieldRemoveRequest.md) |  | |

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


## saveContextApiV1ResourceContextSavePost

> any saveContextApiV1ResourceContextSavePost(contextSaveRequest)

保存用户上下文

### Example

```ts
import {
  Configuration,
  ResourceContextApi,
} from '';
import type { SaveContextApiV1ResourceContextSavePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ResourceContextApi(config);

  const body = {
    // ContextSaveRequest
    contextSaveRequest: ...,
  } satisfies SaveContextApiV1ResourceContextSavePostRequest;

  try {
    const data = await api.saveContextApiV1ResourceContextSavePost(body);
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
| **contextSaveRequest** | [ContextSaveRequest](ContextSaveRequest.md) |  | |

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

