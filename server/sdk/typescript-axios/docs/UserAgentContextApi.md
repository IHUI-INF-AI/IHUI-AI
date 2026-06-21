# UserAgentContextApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**addContextApiV1UserAgentContextPost**](#addcontextapiv1useragentcontextpost) | **POST** /api/v1/user-agent-context | 添加上下文消息|
|[**addContextApiV1UserAgentContextPost_0**](#addcontextapiv1useragentcontextpost_0) | **POST** /api/v1/user-agent-context | 添加上下文消息|
|[**clearContextApiV1UserAgentContextDelete**](#clearcontextapiv1useragentcontextdelete) | **DELETE** /api/v1/user-agent-context | 清空上下文|
|[**clearContextApiV1UserAgentContextDelete_0**](#clearcontextapiv1useragentcontextdelete_0) | **DELETE** /api/v1/user-agent-context | 清空上下文|
|[**listContextApiV1UserAgentContextListGet**](#listcontextapiv1useragentcontextlistget) | **GET** /api/v1/user-agent-context/list | 获取上下文|
|[**listContextApiV1UserAgentContextListGet_0**](#listcontextapiv1useragentcontextlistget_0) | **GET** /api/v1/user-agent-context/list | 获取上下文|
|[**listSummariesApiV1UserAgentContextSummaryListGet**](#listsummariesapiv1useragentcontextsummarylistget) | **GET** /api/v1/user-agent-context/summary/list | 总结列表|
|[**listSummariesApiV1UserAgentContextSummaryListGet_0**](#listsummariesapiv1useragentcontextsummarylistget_0) | **GET** /api/v1/user-agent-context/summary/list | 总结列表|
|[**summarizeContextApiV1UserAgentContextSummaryPost**](#summarizecontextapiv1useragentcontextsummarypost) | **POST** /api/v1/user-agent-context/summary | 总结上下文|
|[**summarizeContextApiV1UserAgentContextSummaryPost_0**](#summarizecontextapiv1useragentcontextsummarypost_0) | **POST** /api/v1/user-agent-context/summary | 总结上下文|

# **addContextApiV1UserAgentContextPost**
> any addContextApiV1UserAgentContextPost()


### Example

```typescript
import {
    UserAgentContextApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserAgentContextApi(configuration);

let agentId: string; // (default to undefined)
let sessionId: string; // (default to undefined)
let role: string; // (default to undefined)
let content: string; // (default to undefined)
let contentType: string; // (optional) (default to 'text')
let tokens: number; // (optional) (default to 0)
let model: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.addContextApiV1UserAgentContextPost(
    agentId,
    sessionId,
    role,
    content,
    contentType,
    tokens,
    model
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|
| **sessionId** | [**string**] |  | defaults to undefined|
| **role** | [**string**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **contentType** | [**string**] |  | (optional) defaults to 'text'|
| **tokens** | [**number**] |  | (optional) defaults to 0|
| **model** | [**string**] |  | (optional) defaults to undefined|


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

# **addContextApiV1UserAgentContextPost_0**
> any addContextApiV1UserAgentContextPost_0()


### Example

```typescript
import {
    UserAgentContextApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserAgentContextApi(configuration);

let agentId: string; // (default to undefined)
let sessionId: string; // (default to undefined)
let role: string; // (default to undefined)
let content: string; // (default to undefined)
let contentType: string; // (optional) (default to 'text')
let tokens: number; // (optional) (default to 0)
let model: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.addContextApiV1UserAgentContextPost_0(
    agentId,
    sessionId,
    role,
    content,
    contentType,
    tokens,
    model
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|
| **sessionId** | [**string**] |  | defaults to undefined|
| **role** | [**string**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **contentType** | [**string**] |  | (optional) defaults to 'text'|
| **tokens** | [**number**] |  | (optional) defaults to 0|
| **model** | [**string**] |  | (optional) defaults to undefined|


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

# **clearContextApiV1UserAgentContextDelete**
> any clearContextApiV1UserAgentContextDelete()


### Example

```typescript
import {
    UserAgentContextApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserAgentContextApi(configuration);

let agentId: string; // (default to undefined)
let sessionId: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.clearContextApiV1UserAgentContextDelete(
    agentId,
    sessionId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|
| **sessionId** | [**string**] |  | (optional) defaults to undefined|


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

# **clearContextApiV1UserAgentContextDelete_0**
> any clearContextApiV1UserAgentContextDelete_0()


### Example

```typescript
import {
    UserAgentContextApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserAgentContextApi(configuration);

let agentId: string; // (default to undefined)
let sessionId: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.clearContextApiV1UserAgentContextDelete_0(
    agentId,
    sessionId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|
| **sessionId** | [**string**] |  | (optional) defaults to undefined|


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

# **listContextApiV1UserAgentContextListGet**
> any listContextApiV1UserAgentContextListGet()


### Example

```typescript
import {
    UserAgentContextApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserAgentContextApi(configuration);

let agentId: string; // (default to undefined)
let sessionId: string; // (optional) (default to undefined)
let limit: number; // (optional) (default to 50)

const { status, data } = await apiInstance.listContextApiV1UserAgentContextListGet(
    agentId,
    sessionId,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|
| **sessionId** | [**string**] |  | (optional) defaults to undefined|
| **limit** | [**number**] |  | (optional) defaults to 50|


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

# **listContextApiV1UserAgentContextListGet_0**
> any listContextApiV1UserAgentContextListGet_0()


### Example

```typescript
import {
    UserAgentContextApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserAgentContextApi(configuration);

let agentId: string; // (default to undefined)
let sessionId: string; // (optional) (default to undefined)
let limit: number; // (optional) (default to 50)

const { status, data } = await apiInstance.listContextApiV1UserAgentContextListGet_0(
    agentId,
    sessionId,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|
| **sessionId** | [**string**] |  | (optional) defaults to undefined|
| **limit** | [**number**] |  | (optional) defaults to 50|


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

# **listSummariesApiV1UserAgentContextSummaryListGet**
> any listSummariesApiV1UserAgentContextSummaryListGet()


### Example

```typescript
import {
    UserAgentContextApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserAgentContextApi(configuration);

let agentId: string; // (default to undefined)
let limit: number; // (optional) (default to 10)

const { status, data } = await apiInstance.listSummariesApiV1UserAgentContextSummaryListGet(
    agentId,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|
| **limit** | [**number**] |  | (optional) defaults to 10|


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

# **listSummariesApiV1UserAgentContextSummaryListGet_0**
> any listSummariesApiV1UserAgentContextSummaryListGet_0()


### Example

```typescript
import {
    UserAgentContextApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserAgentContextApi(configuration);

let agentId: string; // (default to undefined)
let limit: number; // (optional) (default to 10)

const { status, data } = await apiInstance.listSummariesApiV1UserAgentContextSummaryListGet_0(
    agentId,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|
| **limit** | [**number**] |  | (optional) defaults to 10|


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

# **summarizeContextApiV1UserAgentContextSummaryPost**
> any summarizeContextApiV1UserAgentContextSummaryPost()


### Example

```typescript
import {
    UserAgentContextApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserAgentContextApi(configuration);

let agentId: string; // (default to undefined)
let summary: string; // (default to undefined)
let sessionId: string; // (optional) (default to undefined)
let startId: number; // (optional) (default to 0)
let endId: number; // (optional) (default to 0)
let tokens: number; // (optional) (default to 0)

const { status, data } = await apiInstance.summarizeContextApiV1UserAgentContextSummaryPost(
    agentId,
    summary,
    sessionId,
    startId,
    endId,
    tokens
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|
| **summary** | [**string**] |  | defaults to undefined|
| **sessionId** | [**string**] |  | (optional) defaults to undefined|
| **startId** | [**number**] |  | (optional) defaults to 0|
| **endId** | [**number**] |  | (optional) defaults to 0|
| **tokens** | [**number**] |  | (optional) defaults to 0|


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

# **summarizeContextApiV1UserAgentContextSummaryPost_0**
> any summarizeContextApiV1UserAgentContextSummaryPost_0()


### Example

```typescript
import {
    UserAgentContextApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserAgentContextApi(configuration);

let agentId: string; // (default to undefined)
let summary: string; // (default to undefined)
let sessionId: string; // (optional) (default to undefined)
let startId: number; // (optional) (default to 0)
let endId: number; // (optional) (default to 0)
let tokens: number; // (optional) (default to 0)

const { status, data } = await apiInstance.summarizeContextApiV1UserAgentContextSummaryPost_0(
    agentId,
    summary,
    sessionId,
    startId,
    endId,
    tokens
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|
| **summary** | [**string**] |  | defaults to undefined|
| **sessionId** | [**string**] |  | (optional) defaults to undefined|
| **startId** | [**number**] |  | (optional) defaults to 0|
| **endId** | [**number**] |  | (optional) defaults to 0|
| **tokens** | [**number**] |  | (optional) defaults to 0|


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

