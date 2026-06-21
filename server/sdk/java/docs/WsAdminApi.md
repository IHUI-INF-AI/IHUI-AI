# WsAdminApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**broadcastMessageApiV1WsBroadcastPost**](WsAdminApi.md#broadcastMessageApiV1WsBroadcastPost) | **POST** /api/v1/ws/broadcast | 广播消息 |
| [**broadcastMessageApiV1WsBroadcastPost_0**](WsAdminApi.md#broadcastMessageApiV1WsBroadcastPost_0) | **POST** /api/v1/ws/broadcast | 广播消息 |
| [**cleanupConnectionsApiV1WsCleanupPost**](WsAdminApi.md#cleanupConnectionsApiV1WsCleanupPost) | **POST** /api/v1/ws/cleanup | 清理断开的连接 |
| [**cleanupConnectionsApiV1WsCleanupPost_0**](WsAdminApi.md#cleanupConnectionsApiV1WsCleanupPost_0) | **POST** /api/v1/ws/cleanup | 清理断开的连接 |
| [**forceDisconnectApiV1WsDisconnectConnIdPost**](WsAdminApi.md#forceDisconnectApiV1WsDisconnectConnIdPost) | **POST** /api/v1/ws/disconnect/{conn_id} | 强制断开指定客户端 |
| [**forceDisconnectApiV1WsDisconnectConnIdPost_0**](WsAdminApi.md#forceDisconnectApiV1WsDisconnectConnIdPost_0) | **POST** /api/v1/ws/disconnect/{conn_id} | 强制断开指定客户端 |
| [**getConnectionsApiV1WsConnectionsGet**](WsAdminApi.md#getConnectionsApiV1WsConnectionsGet) | **GET** /api/v1/ws/connections | 当前连接列表 |
| [**getConnectionsApiV1WsConnectionsGet_0**](WsAdminApi.md#getConnectionsApiV1WsConnectionsGet_0) | **GET** /api/v1/ws/connections | 当前连接列表 |
| [**getSystemStatusApiV1WsSystemStatusGet**](WsAdminApi.md#getSystemStatusApiV1WsSystemStatusGet) | **GET** /api/v1/ws/system-status | 系统状态（内存、CPU、连接数） |
| [**getSystemStatusApiV1WsSystemStatusGet_0**](WsAdminApi.md#getSystemStatusApiV1WsSystemStatusGet_0) | **GET** /api/v1/ws/system-status | 系统状态（内存、CPU、连接数） |
| [**getWsHealthApiV1WsHealthGet**](WsAdminApi.md#getWsHealthApiV1WsHealthGet) | **GET** /api/v1/ws/health | WebSocket健康检查 |
| [**getWsHealthApiV1WsHealthGet_0**](WsAdminApi.md#getWsHealthApiV1WsHealthGet_0) | **GET** /api/v1/ws/health | WebSocket健康检查 |
| [**getWsStatsApiV1WsStatsGet**](WsAdminApi.md#getWsStatsApiV1WsStatsGet) | **GET** /api/v1/ws/stats | WebSocket连接统计 |
| [**getWsStatsApiV1WsStatsGet_0**](WsAdminApi.md#getWsStatsApiV1WsStatsGet_0) | **GET** /api/v1/ws/stats | WebSocket连接统计 |
| [**sendToClientApiV1WsSendConnIdPost**](WsAdminApi.md#sendToClientApiV1WsSendConnIdPost) | **POST** /api/v1/ws/send/{conn_id} | 发送消息给指定客户端 |
| [**sendToClientApiV1WsSendConnIdPost_0**](WsAdminApi.md#sendToClientApiV1WsSendConnIdPost_0) | **POST** /api/v1/ws/send/{conn_id} | 发送消息给指定客户端 |


<a id="broadcastMessageApiV1WsBroadcastPost"></a>
# **broadcastMessageApiV1WsBroadcastPost**
> Object broadcastMessageApiV1WsBroadcastPost(broadcastRequest)

广播消息

广播消息到所有连接或指定房间.  对应原项目 socketio_chat.py POST /broadcast

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsAdminApi apiInstance = new WsAdminApi(defaultClient);
    BroadcastRequest broadcastRequest = new BroadcastRequest(); // BroadcastRequest | 
    try {
      Object result = apiInstance.broadcastMessageApiV1WsBroadcastPost(broadcastRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsAdminApi#broadcastMessageApiV1WsBroadcastPost");
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
| **broadcastRequest** | [**BroadcastRequest**](BroadcastRequest.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="broadcastMessageApiV1WsBroadcastPost_0"></a>
# **broadcastMessageApiV1WsBroadcastPost_0**
> Object broadcastMessageApiV1WsBroadcastPost_0(broadcastRequest)

广播消息

广播消息到所有连接或指定房间.  对应原项目 socketio_chat.py POST /broadcast

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsAdminApi apiInstance = new WsAdminApi(defaultClient);
    BroadcastRequest broadcastRequest = new BroadcastRequest(); // BroadcastRequest | 
    try {
      Object result = apiInstance.broadcastMessageApiV1WsBroadcastPost_0(broadcastRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsAdminApi#broadcastMessageApiV1WsBroadcastPost_0");
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
| **broadcastRequest** | [**BroadcastRequest**](BroadcastRequest.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="cleanupConnectionsApiV1WsCleanupPost"></a>
# **cleanupConnectionsApiV1WsCleanupPost**
> Object cleanupConnectionsApiV1WsCleanupPost()

清理断开的连接

扫描并清理已断开 / 超时的连接.  对应原项目 /cozeZhsApi/ws/websocket/cleanup

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsAdminApi apiInstance = new WsAdminApi(defaultClient);
    try {
      Object result = apiInstance.cleanupConnectionsApiV1WsCleanupPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsAdminApi#cleanupConnectionsApiV1WsCleanupPost");
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

<a id="cleanupConnectionsApiV1WsCleanupPost_0"></a>
# **cleanupConnectionsApiV1WsCleanupPost_0**
> Object cleanupConnectionsApiV1WsCleanupPost_0()

清理断开的连接

扫描并清理已断开 / 超时的连接.  对应原项目 /cozeZhsApi/ws/websocket/cleanup

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsAdminApi apiInstance = new WsAdminApi(defaultClient);
    try {
      Object result = apiInstance.cleanupConnectionsApiV1WsCleanupPost_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsAdminApi#cleanupConnectionsApiV1WsCleanupPost_0");
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

<a id="forceDisconnectApiV1WsDisconnectConnIdPost"></a>
# **forceDisconnectApiV1WsDisconnectConnIdPost**
> Object forceDisconnectApiV1WsDisconnectConnIdPost(connId)

强制断开指定客户端

对应原项目 /cozeZhsApi/ws/websocket/disconnect/{client_id}

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsAdminApi apiInstance = new WsAdminApi(defaultClient);
    String connId = "connId_example"; // String | 
    try {
      Object result = apiInstance.forceDisconnectApiV1WsDisconnectConnIdPost(connId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsAdminApi#forceDisconnectApiV1WsDisconnectConnIdPost");
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
| **connId** | **String**|  | |

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

<a id="forceDisconnectApiV1WsDisconnectConnIdPost_0"></a>
# **forceDisconnectApiV1WsDisconnectConnIdPost_0**
> Object forceDisconnectApiV1WsDisconnectConnIdPost_0(connId)

强制断开指定客户端

对应原项目 /cozeZhsApi/ws/websocket/disconnect/{client_id}

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsAdminApi apiInstance = new WsAdminApi(defaultClient);
    String connId = "connId_example"; // String | 
    try {
      Object result = apiInstance.forceDisconnectApiV1WsDisconnectConnIdPost_0(connId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsAdminApi#forceDisconnectApiV1WsDisconnectConnIdPost_0");
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
| **connId** | **String**|  | |

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

<a id="getConnectionsApiV1WsConnectionsGet"></a>
# **getConnectionsApiV1WsConnectionsGet**
> Object getConnectionsApiV1WsConnectionsGet()

当前连接列表

返回所有活跃连接的详细信息.  对应原项目 socketio_chat.py GET /connections

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsAdminApi apiInstance = new WsAdminApi(defaultClient);
    try {
      Object result = apiInstance.getConnectionsApiV1WsConnectionsGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsAdminApi#getConnectionsApiV1WsConnectionsGet");
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

<a id="getConnectionsApiV1WsConnectionsGet_0"></a>
# **getConnectionsApiV1WsConnectionsGet_0**
> Object getConnectionsApiV1WsConnectionsGet_0()

当前连接列表

返回所有活跃连接的详细信息.  对应原项目 socketio_chat.py GET /connections

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsAdminApi apiInstance = new WsAdminApi(defaultClient);
    try {
      Object result = apiInstance.getConnectionsApiV1WsConnectionsGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsAdminApi#getConnectionsApiV1WsConnectionsGet_0");
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

<a id="getSystemStatusApiV1WsSystemStatusGet"></a>
# **getSystemStatusApiV1WsSystemStatusGet**
> Object getSystemStatusApiV1WsSystemStatusGet()

系统状态（内存、CPU、连接数）

返回进程级系统状态, 包含内存 / CPU / 连接数.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsAdminApi apiInstance = new WsAdminApi(defaultClient);
    try {
      Object result = apiInstance.getSystemStatusApiV1WsSystemStatusGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsAdminApi#getSystemStatusApiV1WsSystemStatusGet");
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

<a id="getSystemStatusApiV1WsSystemStatusGet_0"></a>
# **getSystemStatusApiV1WsSystemStatusGet_0**
> Object getSystemStatusApiV1WsSystemStatusGet_0()

系统状态（内存、CPU、连接数）

返回进程级系统状态, 包含内存 / CPU / 连接数.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsAdminApi apiInstance = new WsAdminApi(defaultClient);
    try {
      Object result = apiInstance.getSystemStatusApiV1WsSystemStatusGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsAdminApi#getSystemStatusApiV1WsSystemStatusGet_0");
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

<a id="getWsHealthApiV1WsHealthGet"></a>
# **getWsHealthApiV1WsHealthGet**
> Object getWsHealthApiV1WsHealthGet()

WebSocket健康检查

健康状态评估 -- 对应原项目 /cozeZhsApi/ws/websocket/health

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsAdminApi apiInstance = new WsAdminApi(defaultClient);
    try {
      Object result = apiInstance.getWsHealthApiV1WsHealthGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsAdminApi#getWsHealthApiV1WsHealthGet");
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

<a id="getWsHealthApiV1WsHealthGet_0"></a>
# **getWsHealthApiV1WsHealthGet_0**
> Object getWsHealthApiV1WsHealthGet_0()

WebSocket健康检查

健康状态评估 -- 对应原项目 /cozeZhsApi/ws/websocket/health

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsAdminApi apiInstance = new WsAdminApi(defaultClient);
    try {
      Object result = apiInstance.getWsHealthApiV1WsHealthGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsAdminApi#getWsHealthApiV1WsHealthGet_0");
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

<a id="getWsStatsApiV1WsStatsGet"></a>
# **getWsStatsApiV1WsStatsGet**
> Object getWsStatsApiV1WsStatsGet()

WebSocket连接统计

返回总连接数、房间数、用户数、消息数等.  对应原项目 /cozeZhsApi/ws/websocket/stats

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsAdminApi apiInstance = new WsAdminApi(defaultClient);
    try {
      Object result = apiInstance.getWsStatsApiV1WsStatsGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsAdminApi#getWsStatsApiV1WsStatsGet");
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

<a id="getWsStatsApiV1WsStatsGet_0"></a>
# **getWsStatsApiV1WsStatsGet_0**
> Object getWsStatsApiV1WsStatsGet_0()

WebSocket连接统计

返回总连接数、房间数、用户数、消息数等.  对应原项目 /cozeZhsApi/ws/websocket/stats

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsAdminApi apiInstance = new WsAdminApi(defaultClient);
    try {
      Object result = apiInstance.getWsStatsApiV1WsStatsGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsAdminApi#getWsStatsApiV1WsStatsGet_0");
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

<a id="sendToClientApiV1WsSendConnIdPost"></a>
# **sendToClientApiV1WsSendConnIdPost**
> Object sendToClientApiV1WsSendConnIdPost(connId, sendToClientRequest)

发送消息给指定客户端

对应原项目 socketio_chat.py POST /send/{client_id}

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsAdminApi apiInstance = new WsAdminApi(defaultClient);
    String connId = "connId_example"; // String | 
    SendToClientRequest sendToClientRequest = new SendToClientRequest(); // SendToClientRequest | 
    try {
      Object result = apiInstance.sendToClientApiV1WsSendConnIdPost(connId, sendToClientRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsAdminApi#sendToClientApiV1WsSendConnIdPost");
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
| **connId** | **String**|  | |
| **sendToClientRequest** | [**SendToClientRequest**](SendToClientRequest.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="sendToClientApiV1WsSendConnIdPost_0"></a>
# **sendToClientApiV1WsSendConnIdPost_0**
> Object sendToClientApiV1WsSendConnIdPost_0(connId, sendToClientRequest)

发送消息给指定客户端

对应原项目 socketio_chat.py POST /send/{client_id}

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsAdminApi apiInstance = new WsAdminApi(defaultClient);
    String connId = "connId_example"; // String | 
    SendToClientRequest sendToClientRequest = new SendToClientRequest(); // SendToClientRequest | 
    try {
      Object result = apiInstance.sendToClientApiV1WsSendConnIdPost_0(connId, sendToClientRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsAdminApi#sendToClientApiV1WsSendConnIdPost_0");
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
| **connId** | **String**|  | |
| **sendToClientRequest** | [**SendToClientRequest**](SendToClientRequest.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

