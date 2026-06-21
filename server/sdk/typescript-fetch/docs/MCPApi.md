# MCPApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**invokeToolApiV1McpToolInvokePost**](MCPApi.md#invoketoolapiv1mcptoolinvokepost) | **POST** /api/v1/mcp/{tool}/invoke | 调用 MCP 工具 |
| [**listToolsApiV1McpListGet**](MCPApi.md#listtoolsapiv1mcplistget) | **GET** /api/v1/mcp/list | 列出所有 MCP 工具 |
| [**toolHealthApiV1McpToolHealthGet**](MCPApi.md#toolhealthapiv1mcptoolhealthget) | **GET** /api/v1/mcp/{tool}/health | 工具健康检查 |



## invokeToolApiV1McpToolInvokePost

> any invokeToolApiV1McpToolInvokePost(tool, path, method, body)

调用 MCP 工具

### Example

```ts
import {
  Configuration,
  MCPApi,
} from '';
import type { InvokeToolApiV1McpToolInvokePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MCPApi(config);

  const body = {
    // string
    tool: tool_example,
    // string | 工具子路径
    path: path_example,
    // string | HTTP 方法 (optional)
    method: method_example,
    // string | JSON body (optional)
    body: body_example,
  } satisfies InvokeToolApiV1McpToolInvokePostRequest;

  try {
    const data = await api.invokeToolApiV1McpToolInvokePost(body);
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
| **tool** | `string` |  | [Defaults to `undefined`] |
| **path** | `string` | 工具子路径 | [Defaults to `undefined`] |
| **method** | `string` | HTTP 方法 | [Optional] [Defaults to `&#39;POST&#39;`] |
| **body** | `string` | JSON body | [Optional] [Defaults to `&#39;{}&#39;`] |

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


## listToolsApiV1McpListGet

> any listToolsApiV1McpListGet()

列出所有 MCP 工具

### Example

```ts
import {
  Configuration,
  MCPApi,
} from '';
import type { ListToolsApiV1McpListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MCPApi(config);

  try {
    const data = await api.listToolsApiV1McpListGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## toolHealthApiV1McpToolHealthGet

> any toolHealthApiV1McpToolHealthGet(tool)

工具健康检查

### Example

```ts
import {
  Configuration,
  MCPApi,
} from '';
import type { ToolHealthApiV1McpToolHealthGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MCPApi(config);

  const body = {
    // string
    tool: tool_example,
  } satisfies ToolHealthApiV1McpToolHealthGetRequest;

  try {
    const data = await api.toolHealthApiV1McpToolHealthGet(body);
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
| **tool** | `string` |  | [Defaults to `undefined`] |

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

