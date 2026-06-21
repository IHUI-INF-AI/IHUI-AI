# \MCPAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**InvokeToolApiV1McpToolInvokePost**](MCPAPI.md#InvokeToolApiV1McpToolInvokePost) | **Post** /api/v1/mcp/{tool}/invoke | 调用 MCP 工具
[**ListToolsApiV1McpListGet**](MCPAPI.md#ListToolsApiV1McpListGet) | **Get** /api/v1/mcp/list | 列出所有 MCP 工具
[**ToolHealthApiV1McpToolHealthGet**](MCPAPI.md#ToolHealthApiV1McpToolHealthGet) | **Get** /api/v1/mcp/{tool}/health | 工具健康检查



## InvokeToolApiV1McpToolInvokePost

> interface{} InvokeToolApiV1McpToolInvokePost(ctx, tool).Path(path).Method(method).Body(body).Execute()

调用 MCP 工具

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	tool := "tool_example" // string | 
	path := "path_example" // string | 工具子路径
	method := "method_example" // string | HTTP 方法 (optional) (default to "POST")
	body := "body_example" // string | JSON body (optional) (default to "{}")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MCPAPI.InvokeToolApiV1McpToolInvokePost(context.Background(), tool).Path(path).Method(method).Body(body).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MCPAPI.InvokeToolApiV1McpToolInvokePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `InvokeToolApiV1McpToolInvokePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MCPAPI.InvokeToolApiV1McpToolInvokePost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**tool** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiInvokeToolApiV1McpToolInvokePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **path** | **string** | 工具子路径 | 
 **method** | **string** | HTTP 方法 | [default to &quot;POST&quot;]
 **body** | **string** | JSON body | [default to &quot;{}&quot;]

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListToolsApiV1McpListGet

> interface{} ListToolsApiV1McpListGet(ctx).Execute()

列出所有 MCP 工具

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MCPAPI.ListToolsApiV1McpListGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MCPAPI.ListToolsApiV1McpListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListToolsApiV1McpListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MCPAPI.ListToolsApiV1McpListGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListToolsApiV1McpListGetRequest struct via the builder pattern


### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ToolHealthApiV1McpToolHealthGet

> interface{} ToolHealthApiV1McpToolHealthGet(ctx, tool).Execute()

工具健康检查

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	tool := "tool_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MCPAPI.ToolHealthApiV1McpToolHealthGet(context.Background(), tool).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MCPAPI.ToolHealthApiV1McpToolHealthGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ToolHealthApiV1McpToolHealthGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MCPAPI.ToolHealthApiV1McpToolHealthGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**tool** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiToolHealthApiV1McpToolHealthGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

