# UserAgentContextApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addContextApiV1UserAgentContextPost**](UserAgentContextApi.md#addcontextapiv1useragentcontextpost) | **POST** /api/v1/user-agent-context | 添加上下文消息 |
| [**addContextApiV1UserAgentContextPost_0**](UserAgentContextApi.md#addcontextapiv1useragentcontextpost_0) | **POST** /api/v1/user-agent-context | 添加上下文消息 |
| [**clearContextApiV1UserAgentContextDelete**](UserAgentContextApi.md#clearcontextapiv1useragentcontextdelete) | **DELETE** /api/v1/user-agent-context | 清空上下文 |
| [**clearContextApiV1UserAgentContextDelete_0**](UserAgentContextApi.md#clearcontextapiv1useragentcontextdelete_0) | **DELETE** /api/v1/user-agent-context | 清空上下文 |
| [**listContextApiV1UserAgentContextListGet**](UserAgentContextApi.md#listcontextapiv1useragentcontextlistget) | **GET** /api/v1/user-agent-context/list | 获取上下文 |
| [**listContextApiV1UserAgentContextListGet_0**](UserAgentContextApi.md#listcontextapiv1useragentcontextlistget_0) | **GET** /api/v1/user-agent-context/list | 获取上下文 |
| [**listSummariesApiV1UserAgentContextSummaryListGet**](UserAgentContextApi.md#listsummariesapiv1useragentcontextsummarylistget) | **GET** /api/v1/user-agent-context/summary/list | 总结列表 |
| [**listSummariesApiV1UserAgentContextSummaryListGet_0**](UserAgentContextApi.md#listsummariesapiv1useragentcontextsummarylistget_0) | **GET** /api/v1/user-agent-context/summary/list | 总结列表 |
| [**summarizeContextApiV1UserAgentContextSummaryPost**](UserAgentContextApi.md#summarizecontextapiv1useragentcontextsummarypost) | **POST** /api/v1/user-agent-context/summary | 总结上下文 |
| [**summarizeContextApiV1UserAgentContextSummaryPost_0**](UserAgentContextApi.md#summarizecontextapiv1useragentcontextsummarypost_0) | **POST** /api/v1/user-agent-context/summary | 总结上下文 |



## addContextApiV1UserAgentContextPost

> any addContextApiV1UserAgentContextPost(agentId, sessionId, role, content, contentType, tokens, model)

添加上下文消息

### Example

```ts
import {
  Configuration,
  UserAgentContextApi,
} from '';
import type { AddContextApiV1UserAgentContextPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserAgentContextApi();

  const body = {
    // string
    agentId: agentId_example,
    // string
    sessionId: sessionId_example,
    // string
    role: role_example,
    // string
    content: content_example,
    // string (optional)
    contentType: contentType_example,
    // number (optional)
    tokens: 56,
    // string (optional)
    model: model_example,
  } satisfies AddContextApiV1UserAgentContextPostRequest;

  try {
    const data = await api.addContextApiV1UserAgentContextPost(body);
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
| **sessionId** | `string` |  | [Defaults to `undefined`] |
| **role** | `string` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Defaults to `undefined`] |
| **contentType** | `string` |  | [Optional] [Defaults to `&#39;text&#39;`] |
| **tokens** | `number` |  | [Optional] [Defaults to `0`] |
| **model** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## addContextApiV1UserAgentContextPost_0

> any addContextApiV1UserAgentContextPost_0(agentId, sessionId, role, content, contentType, tokens, model)

添加上下文消息

### Example

```ts
import {
  Configuration,
  UserAgentContextApi,
} from '';
import type { AddContextApiV1UserAgentContextPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserAgentContextApi();

  const body = {
    // string
    agentId: agentId_example,
    // string
    sessionId: sessionId_example,
    // string
    role: role_example,
    // string
    content: content_example,
    // string (optional)
    contentType: contentType_example,
    // number (optional)
    tokens: 56,
    // string (optional)
    model: model_example,
  } satisfies AddContextApiV1UserAgentContextPost0Request;

  try {
    const data = await api.addContextApiV1UserAgentContextPost_0(body);
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
| **sessionId** | `string` |  | [Defaults to `undefined`] |
| **role** | `string` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Defaults to `undefined`] |
| **contentType** | `string` |  | [Optional] [Defaults to `&#39;text&#39;`] |
| **tokens** | `number` |  | [Optional] [Defaults to `0`] |
| **model** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## clearContextApiV1UserAgentContextDelete

> any clearContextApiV1UserAgentContextDelete(agentId, sessionId)

清空上下文

### Example

```ts
import {
  Configuration,
  UserAgentContextApi,
} from '';
import type { ClearContextApiV1UserAgentContextDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserAgentContextApi();

  const body = {
    // string
    agentId: agentId_example,
    // string (optional)
    sessionId: sessionId_example,
  } satisfies ClearContextApiV1UserAgentContextDeleteRequest;

  try {
    const data = await api.clearContextApiV1UserAgentContextDelete(body);
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
| **sessionId** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## clearContextApiV1UserAgentContextDelete_0

> any clearContextApiV1UserAgentContextDelete_0(agentId, sessionId)

清空上下文

### Example

```ts
import {
  Configuration,
  UserAgentContextApi,
} from '';
import type { ClearContextApiV1UserAgentContextDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserAgentContextApi();

  const body = {
    // string
    agentId: agentId_example,
    // string (optional)
    sessionId: sessionId_example,
  } satisfies ClearContextApiV1UserAgentContextDelete0Request;

  try {
    const data = await api.clearContextApiV1UserAgentContextDelete_0(body);
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
| **sessionId** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## listContextApiV1UserAgentContextListGet

> any listContextApiV1UserAgentContextListGet(agentId, sessionId, limit)

获取上下文

### Example

```ts
import {
  Configuration,
  UserAgentContextApi,
} from '';
import type { ListContextApiV1UserAgentContextListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserAgentContextApi();

  const body = {
    // string
    agentId: agentId_example,
    // string (optional)
    sessionId: sessionId_example,
    // number (optional)
    limit: 56,
  } satisfies ListContextApiV1UserAgentContextListGetRequest;

  try {
    const data = await api.listContextApiV1UserAgentContextListGet(body);
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
| **sessionId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **limit** | `number` |  | [Optional] [Defaults to `50`] |

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


## listContextApiV1UserAgentContextListGet_0

> any listContextApiV1UserAgentContextListGet_0(agentId, sessionId, limit)

获取上下文

### Example

```ts
import {
  Configuration,
  UserAgentContextApi,
} from '';
import type { ListContextApiV1UserAgentContextListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserAgentContextApi();

  const body = {
    // string
    agentId: agentId_example,
    // string (optional)
    sessionId: sessionId_example,
    // number (optional)
    limit: 56,
  } satisfies ListContextApiV1UserAgentContextListGet0Request;

  try {
    const data = await api.listContextApiV1UserAgentContextListGet_0(body);
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
| **sessionId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **limit** | `number` |  | [Optional] [Defaults to `50`] |

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


## listSummariesApiV1UserAgentContextSummaryListGet

> any listSummariesApiV1UserAgentContextSummaryListGet(agentId, limit)

总结列表

### Example

```ts
import {
  Configuration,
  UserAgentContextApi,
} from '';
import type { ListSummariesApiV1UserAgentContextSummaryListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserAgentContextApi();

  const body = {
    // string
    agentId: agentId_example,
    // number (optional)
    limit: 56,
  } satisfies ListSummariesApiV1UserAgentContextSummaryListGetRequest;

  try {
    const data = await api.listSummariesApiV1UserAgentContextSummaryListGet(body);
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
| **limit** | `number` |  | [Optional] [Defaults to `10`] |

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


## listSummariesApiV1UserAgentContextSummaryListGet_0

> any listSummariesApiV1UserAgentContextSummaryListGet_0(agentId, limit)

总结列表

### Example

```ts
import {
  Configuration,
  UserAgentContextApi,
} from '';
import type { ListSummariesApiV1UserAgentContextSummaryListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserAgentContextApi();

  const body = {
    // string
    agentId: agentId_example,
    // number (optional)
    limit: 56,
  } satisfies ListSummariesApiV1UserAgentContextSummaryListGet0Request;

  try {
    const data = await api.listSummariesApiV1UserAgentContextSummaryListGet_0(body);
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
| **limit** | `number` |  | [Optional] [Defaults to `10`] |

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


## summarizeContextApiV1UserAgentContextSummaryPost

> any summarizeContextApiV1UserAgentContextSummaryPost(agentId, summary, sessionId, startId, endId, tokens)

总结上下文

### Example

```ts
import {
  Configuration,
  UserAgentContextApi,
} from '';
import type { SummarizeContextApiV1UserAgentContextSummaryPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserAgentContextApi();

  const body = {
    // string
    agentId: agentId_example,
    // string
    summary: summary_example,
    // string (optional)
    sessionId: sessionId_example,
    // number (optional)
    startId: 56,
    // number (optional)
    endId: 56,
    // number (optional)
    tokens: 56,
  } satisfies SummarizeContextApiV1UserAgentContextSummaryPostRequest;

  try {
    const data = await api.summarizeContextApiV1UserAgentContextSummaryPost(body);
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
| **summary** | `string` |  | [Defaults to `undefined`] |
| **sessionId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **startId** | `number` |  | [Optional] [Defaults to `0`] |
| **endId** | `number` |  | [Optional] [Defaults to `0`] |
| **tokens** | `number` |  | [Optional] [Defaults to `0`] |

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


## summarizeContextApiV1UserAgentContextSummaryPost_0

> any summarizeContextApiV1UserAgentContextSummaryPost_0(agentId, summary, sessionId, startId, endId, tokens)

总结上下文

### Example

```ts
import {
  Configuration,
  UserAgentContextApi,
} from '';
import type { SummarizeContextApiV1UserAgentContextSummaryPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserAgentContextApi();

  const body = {
    // string
    agentId: agentId_example,
    // string
    summary: summary_example,
    // string (optional)
    sessionId: sessionId_example,
    // number (optional)
    startId: 56,
    // number (optional)
    endId: 56,
    // number (optional)
    tokens: 56,
  } satisfies SummarizeContextApiV1UserAgentContextSummaryPost0Request;

  try {
    const data = await api.summarizeContextApiV1UserAgentContextSummaryPost_0(body);
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
| **summary** | `string` |  | [Defaults to `undefined`] |
| **sessionId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **startId** | `number` |  | [Optional] [Defaults to `0`] |
| **endId** | `number` |  | [Optional] [Defaults to `0`] |
| **tokens** | `number` |  | [Optional] [Defaults to `0`] |

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

