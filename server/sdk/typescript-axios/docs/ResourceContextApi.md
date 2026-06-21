# ResourceContextApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getAgentWithDeductionApiV1ResourceContextAgentAgentIdGet**](#getagentwithdeductionapiv1resourcecontextagentagentidget) | **GET** /api/v1/resource/context/agent/{agent_id} | 获取Agent调用（含token扣除）|
|[**getContextApiV1ResourceContextGetGet**](#getcontextapiv1resourcecontextgetget) | **GET** /api/v1/resource/context/get | 获取用户上下文|
|[**getFieldApiV1ResourceContextFieldGet**](#getfieldapiv1resourcecontextfieldget) | **GET** /api/v1/resource/context/field | 获取指定字段值|
|[**getSampleContextApiV1ResourceContextSampleGet**](#getsamplecontextapiv1resourcecontextsampleget) | **GET** /api/v1/resource/context/sample | Get sample context data|
|[**getUsageHistoryApiV1ResourceContextHistoryPost**](#getusagehistoryapiv1resourcecontexthistorypost) | **POST** /api/v1/resource/context/history | Query usage history|
|[**queryContextRawApiV1ResourceContextQueryPost**](#querycontextrawapiv1resourcecontextquerypost) | **POST** /api/v1/resource/context/query | Query user agent context (raw SQL)|
|[**removeFieldApiV1ResourceContextRemoveFieldPost**](#removefieldapiv1resourcecontextremovefieldpost) | **POST** /api/v1/resource/context/remove/field | 删除指定字段|
|[**saveContextApiV1ResourceContextSavePost**](#savecontextapiv1resourcecontextsavepost) | **POST** /api/v1/resource/context/save | 保存用户上下文|

# **getAgentWithDeductionApiV1ResourceContextAgentAgentIdGet**
> any getAgentWithDeductionApiV1ResourceContextAgentAgentIdGet()


### Example

```typescript
import {
    ResourceContextApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceContextApi(configuration);

let agentId: string; // (default to undefined)

const { status, data } = await apiInstance.getAgentWithDeductionApiV1ResourceContextAgentAgentIdGet(
    agentId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|


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

# **getContextApiV1ResourceContextGetGet**
> any getContextApiV1ResourceContextGetGet()


### Example

```typescript
import {
    ResourceContextApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceContextApi(configuration);

let agentId: string; //Agent ID (default to undefined)
let contextKey: string; //Context key (optional filter) (optional) (default to undefined)

const { status, data } = await apiInstance.getContextApiV1ResourceContextGetGet(
    agentId,
    contextKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] | Agent ID | defaults to undefined|
| **contextKey** | [**string**] | Context key (optional filter) | (optional) defaults to undefined|


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

# **getFieldApiV1ResourceContextFieldGet**
> any getFieldApiV1ResourceContextFieldGet()


### Example

```typescript
import {
    ResourceContextApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceContextApi(configuration);

let agentId: string; // (default to undefined)
let fieldName: string; // (default to undefined)

const { status, data } = await apiInstance.getFieldApiV1ResourceContextFieldGet(
    agentId,
    fieldName
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|
| **fieldName** | [**string**] |  | defaults to undefined|


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

# **getSampleContextApiV1ResourceContextSampleGet**
> any getSampleContextApiV1ResourceContextSampleGet()

Return a few sample rows for debugging / display.

### Example

```typescript
import {
    ResourceContextApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceContextApi(configuration);

let limit: number; //Number of rows (optional) (default to 5)

const { status, data } = await apiInstance.getSampleContextApiV1ResourceContextSampleGet(
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **limit** | [**number**] | Number of rows | (optional) defaults to 5|


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

# **getUsageHistoryApiV1ResourceContextHistoryPost**
> any getUsageHistoryApiV1ResourceContextHistoryPost(historyRequest)

Query user\'s agent usage history with model name join and pagination.

### Example

```typescript
import {
    ResourceContextApi,
    Configuration,
    HistoryRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceContextApi(configuration);

let historyRequest: HistoryRequest; //

const { status, data } = await apiInstance.getUsageHistoryApiV1ResourceContextHistoryPost(
    historyRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **historyRequest** | **HistoryRequest**|  | |


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

# **queryContextRawApiV1ResourceContextQueryPost**
> any queryContextRawApiV1ResourceContextQueryPost(rawContextRequest)

Query zhs_user_agent_context by user_uuid + model_name + chat_id. Returns messages list with user/assistant role alternation.

### Example

```typescript
import {
    ResourceContextApi,
    Configuration,
    RawContextRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceContextApi(configuration);

let rawContextRequest: RawContextRequest; //

const { status, data } = await apiInstance.queryContextRawApiV1ResourceContextQueryPost(
    rawContextRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **rawContextRequest** | **RawContextRequest**|  | |


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

# **removeFieldApiV1ResourceContextRemoveFieldPost**
> any removeFieldApiV1ResourceContextRemoveFieldPost(fieldRemoveRequest)


### Example

```typescript
import {
    ResourceContextApi,
    Configuration,
    FieldRemoveRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceContextApi(configuration);

let fieldRemoveRequest: FieldRemoveRequest; //

const { status, data } = await apiInstance.removeFieldApiV1ResourceContextRemoveFieldPost(
    fieldRemoveRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fieldRemoveRequest** | **FieldRemoveRequest**|  | |


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

# **saveContextApiV1ResourceContextSavePost**
> any saveContextApiV1ResourceContextSavePost(contextSaveRequest)


### Example

```typescript
import {
    ResourceContextApi,
    Configuration,
    ContextSaveRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new ResourceContextApi(configuration);

let contextSaveRequest: ContextSaveRequest; //

const { status, data } = await apiInstance.saveContextApiV1ResourceContextSavePost(
    contextSaveRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **contextSaveRequest** | **ContextSaveRequest**|  | |


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

