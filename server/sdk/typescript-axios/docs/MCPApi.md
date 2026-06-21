# MCPApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**invokeToolApiV1McpToolInvokePost**](#invoketoolapiv1mcptoolinvokepost) | **POST** /api/v1/mcp/{tool}/invoke | 调用 MCP 工具|
|[**listToolsApiV1McpListGet**](#listtoolsapiv1mcplistget) | **GET** /api/v1/mcp/list | 列出所有 MCP 工具|
|[**toolHealthApiV1McpToolHealthGet**](#toolhealthapiv1mcptoolhealthget) | **GET** /api/v1/mcp/{tool}/health | 工具健康检查|

# **invokeToolApiV1McpToolInvokePost**
> any invokeToolApiV1McpToolInvokePost()


### Example

```typescript
import {
    MCPApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MCPApi(configuration);

let tool: string; // (default to undefined)
let path: string; //工具子路径 (default to undefined)
let method: string; //HTTP 方法 (optional) (default to 'POST')
let body: string; //JSON body (optional) (default to '{}')

const { status, data } = await apiInstance.invokeToolApiV1McpToolInvokePost(
    tool,
    path,
    method,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tool** | [**string**] |  | defaults to undefined|
| **path** | [**string**] | 工具子路径 | defaults to undefined|
| **method** | [**string**] | HTTP 方法 | (optional) defaults to 'POST'|
| **body** | [**string**] | JSON body | (optional) defaults to '{}'|


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

# **listToolsApiV1McpListGet**
> any listToolsApiV1McpListGet()


### Example

```typescript
import {
    MCPApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MCPApi(configuration);

const { status, data } = await apiInstance.listToolsApiV1McpListGet();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **toolHealthApiV1McpToolHealthGet**
> any toolHealthApiV1McpToolHealthGet()


### Example

```typescript
import {
    MCPApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MCPApi(configuration);

let tool: string; // (default to undefined)

const { status, data } = await apiInstance.toolHealthApiV1McpToolHealthGet(
    tool
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tool** | [**string**] |  | defaults to undefined|


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

