# McpApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**invokeToolApiV1McpToolInvokePost**](McpApi.md#invokeToolApiV1McpToolInvokePost) | **POST** /api/v1/mcp/{tool}/invoke | 调用 MCP 工具 |
| [**listToolsApiV1McpListGet**](McpApi.md#listToolsApiV1McpListGet) | **GET** /api/v1/mcp/list | 列出所有 MCP 工具 |
| [**toolHealthApiV1McpToolHealthGet**](McpApi.md#toolHealthApiV1McpToolHealthGet) | **GET** /api/v1/mcp/{tool}/health | 工具健康检查 |


<a id="invokeToolApiV1McpToolInvokePost"></a>
# **invokeToolApiV1McpToolInvokePost**
> Object invokeToolApiV1McpToolInvokePost(tool, path, method, body)

调用 MCP 工具

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.McpApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    McpApi apiInstance = new McpApi(defaultClient);
    String tool = "tool_example"; // String | 
    String path = "path_example"; // String | 工具子路径
    String method = "POST"; // String | HTTP 方法
    String body = "{}"; // String | JSON body
    try {
      Object result = apiInstance.invokeToolApiV1McpToolInvokePost(tool, path, method, body);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling McpApi#invokeToolApiV1McpToolInvokePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **tool** | **String**|  | |
| **path** | **String**| 工具子路径 | |
| **method** | **String**| HTTP 方法 | [optional] [default to POST] |
| **body** | **String**| JSON body | [optional] [default to {}] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listToolsApiV1McpListGet"></a>
# **listToolsApiV1McpListGet**
> Object listToolsApiV1McpListGet()

列出所有 MCP 工具

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.McpApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    McpApi apiInstance = new McpApi(defaultClient);
    try {
      Object result = apiInstance.listToolsApiV1McpListGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling McpApi#listToolsApiV1McpListGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="toolHealthApiV1McpToolHealthGet"></a>
# **toolHealthApiV1McpToolHealthGet**
> Object toolHealthApiV1McpToolHealthGet(tool)

工具健康检查

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.McpApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    McpApi apiInstance = new McpApi(defaultClient);
    String tool = "tool_example"; // String | 
    try {
      Object result = apiInstance.toolHealthApiV1McpToolHealthGet(tool);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling McpApi#toolHealthApiV1McpToolHealthGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **tool** | **String**|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

