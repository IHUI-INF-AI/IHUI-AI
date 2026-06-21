# zhs_api.MCPApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**invoke_tool_api_v1_mcp_tool_invoke_post**](MCPApi.md#invoke_tool_api_v1_mcp_tool_invoke_post) | **POST** /api/v1/mcp/{tool}/invoke | 调用 MCP 工具
[**list_tools_api_v1_mcp_list_get**](MCPApi.md#list_tools_api_v1_mcp_list_get) | **GET** /api/v1/mcp/list | 列出所有 MCP 工具
[**tool_health_api_v1_mcp_tool_health_get**](MCPApi.md#tool_health_api_v1_mcp_tool_health_get) | **GET** /api/v1/mcp/{tool}/health | 工具健康检查


# **invoke_tool_api_v1_mcp_tool_invoke_post**
> object invoke_tool_api_v1_mcp_tool_invoke_post(tool, path, method=method, body=body)

调用 MCP 工具

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.MCPApi(api_client)
    tool = 'tool_example' # str | 
    path = 'path_example' # str | 工具子路径
    method = 'POST' # str | HTTP 方法 (optional) (default to 'POST')
    body = '{}' # str | JSON body (optional) (default to '{}')

    try:
        # 调用 MCP 工具
        api_response = api_instance.invoke_tool_api_v1_mcp_tool_invoke_post(tool, path, method=method, body=body)
        print("The response of MCPApi->invoke_tool_api_v1_mcp_tool_invoke_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MCPApi->invoke_tool_api_v1_mcp_tool_invoke_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tool** | **str**|  | 
 **path** | **str**| 工具子路径 | 
 **method** | **str**| HTTP 方法 | [optional] [default to &#39;POST&#39;]
 **body** | **str**| JSON body | [optional] [default to &#39;{}&#39;]

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_tools_api_v1_mcp_list_get**
> object list_tools_api_v1_mcp_list_get()

列出所有 MCP 工具

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.MCPApi(api_client)

    try:
        # 列出所有 MCP 工具
        api_response = api_instance.list_tools_api_v1_mcp_list_get()
        print("The response of MCPApi->list_tools_api_v1_mcp_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MCPApi->list_tools_api_v1_mcp_list_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **tool_health_api_v1_mcp_tool_health_get**
> object tool_health_api_v1_mcp_tool_health_get(tool)

工具健康检查

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.MCPApi(api_client)
    tool = 'tool_example' # str | 

    try:
        # 工具健康检查
        api_response = api_instance.tool_health_api_v1_mcp_tool_health_get(tool)
        print("The response of MCPApi->tool_health_api_v1_mcp_tool_health_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MCPApi->tool_health_api_v1_mcp_tool_health_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tool** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

