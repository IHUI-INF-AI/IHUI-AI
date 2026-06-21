# WSAdminApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**broadcastMessageApiV1WsBroadcastPost**](WSAdminApi.md#broadcastmessageapiv1wsbroadcastpost) | **POST** /api/v1/ws/broadcast | 广播消息 |
| [**broadcastMessageApiV1WsBroadcastPost_0**](WSAdminApi.md#broadcastmessageapiv1wsbroadcastpost_0) | **POST** /api/v1/ws/broadcast | 广播消息 |
| [**cleanupConnectionsApiV1WsCleanupPost**](WSAdminApi.md#cleanupconnectionsapiv1wscleanuppost) | **POST** /api/v1/ws/cleanup | 清理断开的连接 |
| [**cleanupConnectionsApiV1WsCleanupPost_0**](WSAdminApi.md#cleanupconnectionsapiv1wscleanuppost_0) | **POST** /api/v1/ws/cleanup | 清理断开的连接 |
| [**forceDisconnectApiV1WsDisconnectConnIdPost**](WSAdminApi.md#forcedisconnectapiv1wsdisconnectconnidpost) | **POST** /api/v1/ws/disconnect/{conn_id} | 强制断开指定客户端 |
| [**forceDisconnectApiV1WsDisconnectConnIdPost_0**](WSAdminApi.md#forcedisconnectapiv1wsdisconnectconnidpost_0) | **POST** /api/v1/ws/disconnect/{conn_id} | 强制断开指定客户端 |
| [**getConnectionsApiV1WsConnectionsGet**](WSAdminApi.md#getconnectionsapiv1wsconnectionsget) | **GET** /api/v1/ws/connections | 当前连接列表 |
| [**getConnectionsApiV1WsConnectionsGet_0**](WSAdminApi.md#getconnectionsapiv1wsconnectionsget_0) | **GET** /api/v1/ws/connections | 当前连接列表 |
| [**getSystemStatusApiV1WsSystemStatusGet**](WSAdminApi.md#getsystemstatusapiv1wssystemstatusget) | **GET** /api/v1/ws/system-status | 系统状态（内存、CPU、连接数） |
| [**getSystemStatusApiV1WsSystemStatusGet_0**](WSAdminApi.md#getsystemstatusapiv1wssystemstatusget_0) | **GET** /api/v1/ws/system-status | 系统状态（内存、CPU、连接数） |
| [**getWsHealthApiV1WsHealthGet**](WSAdminApi.md#getwshealthapiv1wshealthget) | **GET** /api/v1/ws/health | WebSocket健康检查 |
| [**getWsHealthApiV1WsHealthGet_0**](WSAdminApi.md#getwshealthapiv1wshealthget_0) | **GET** /api/v1/ws/health | WebSocket健康检查 |
| [**getWsStatsApiV1WsStatsGet**](WSAdminApi.md#getwsstatsapiv1wsstatsget) | **GET** /api/v1/ws/stats | WebSocket连接统计 |
| [**getWsStatsApiV1WsStatsGet_0**](WSAdminApi.md#getwsstatsapiv1wsstatsget_0) | **GET** /api/v1/ws/stats | WebSocket连接统计 |
| [**sendToClientApiV1WsSendConnIdPost**](WSAdminApi.md#sendtoclientapiv1wssendconnidpost) | **POST** /api/v1/ws/send/{conn_id} | 发送消息给指定客户端 |
| [**sendToClientApiV1WsSendConnIdPost_0**](WSAdminApi.md#sendtoclientapiv1wssendconnidpost_0) | **POST** /api/v1/ws/send/{conn_id} | 发送消息给指定客户端 |



## broadcastMessageApiV1WsBroadcastPost

> any broadcastMessageApiV1WsBroadcastPost(broadcastRequest)

广播消息

广播消息到所有连接或指定房间.  对应原项目 socketio_chat.py POST /broadcast

### Example

```ts
import {
  Configuration,
  WSAdminApi,
} from '';
import type { BroadcastMessageApiV1WsBroadcastPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSAdminApi(config);

  const body = {
    // BroadcastRequest
    broadcastRequest: ...,
  } satisfies BroadcastMessageApiV1WsBroadcastPostRequest;

  try {
    const data = await api.broadcastMessageApiV1WsBroadcastPost(body);
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
| **broadcastRequest** | [BroadcastRequest](BroadcastRequest.md) |  | |

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


## broadcastMessageApiV1WsBroadcastPost_0

> any broadcastMessageApiV1WsBroadcastPost_0(broadcastRequest)

广播消息

广播消息到所有连接或指定房间.  对应原项目 socketio_chat.py POST /broadcast

### Example

```ts
import {
  Configuration,
  WSAdminApi,
} from '';
import type { BroadcastMessageApiV1WsBroadcastPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSAdminApi(config);

  const body = {
    // BroadcastRequest
    broadcastRequest: ...,
  } satisfies BroadcastMessageApiV1WsBroadcastPost0Request;

  try {
    const data = await api.broadcastMessageApiV1WsBroadcastPost_0(body);
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
| **broadcastRequest** | [BroadcastRequest](BroadcastRequest.md) |  | |

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


## cleanupConnectionsApiV1WsCleanupPost

> any cleanupConnectionsApiV1WsCleanupPost()

清理断开的连接

扫描并清理已断开 / 超时的连接.  对应原项目 /cozeZhsApi/ws/websocket/cleanup

### Example

```ts
import {
  Configuration,
  WSAdminApi,
} from '';
import type { CleanupConnectionsApiV1WsCleanupPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSAdminApi(config);

  try {
    const data = await api.cleanupConnectionsApiV1WsCleanupPost();
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


## cleanupConnectionsApiV1WsCleanupPost_0

> any cleanupConnectionsApiV1WsCleanupPost_0()

清理断开的连接

扫描并清理已断开 / 超时的连接.  对应原项目 /cozeZhsApi/ws/websocket/cleanup

### Example

```ts
import {
  Configuration,
  WSAdminApi,
} from '';
import type { CleanupConnectionsApiV1WsCleanupPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSAdminApi(config);

  try {
    const data = await api.cleanupConnectionsApiV1WsCleanupPost_0();
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


## forceDisconnectApiV1WsDisconnectConnIdPost

> any forceDisconnectApiV1WsDisconnectConnIdPost(connId)

强制断开指定客户端

对应原项目 /cozeZhsApi/ws/websocket/disconnect/{client_id}

### Example

```ts
import {
  Configuration,
  WSAdminApi,
} from '';
import type { ForceDisconnectApiV1WsDisconnectConnIdPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSAdminApi(config);

  const body = {
    // string
    connId: connId_example,
  } satisfies ForceDisconnectApiV1WsDisconnectConnIdPostRequest;

  try {
    const data = await api.forceDisconnectApiV1WsDisconnectConnIdPost(body);
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
| **connId** | `string` |  | [Defaults to `undefined`] |

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


## forceDisconnectApiV1WsDisconnectConnIdPost_0

> any forceDisconnectApiV1WsDisconnectConnIdPost_0(connId)

强制断开指定客户端

对应原项目 /cozeZhsApi/ws/websocket/disconnect/{client_id}

### Example

```ts
import {
  Configuration,
  WSAdminApi,
} from '';
import type { ForceDisconnectApiV1WsDisconnectConnIdPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSAdminApi(config);

  const body = {
    // string
    connId: connId_example,
  } satisfies ForceDisconnectApiV1WsDisconnectConnIdPost0Request;

  try {
    const data = await api.forceDisconnectApiV1WsDisconnectConnIdPost_0(body);
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
| **connId** | `string` |  | [Defaults to `undefined`] |

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


## getConnectionsApiV1WsConnectionsGet

> any getConnectionsApiV1WsConnectionsGet()

当前连接列表

返回所有活跃连接的详细信息.  对应原项目 socketio_chat.py GET /connections

### Example

```ts
import {
  Configuration,
  WSAdminApi,
} from '';
import type { GetConnectionsApiV1WsConnectionsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSAdminApi(config);

  try {
    const data = await api.getConnectionsApiV1WsConnectionsGet();
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


## getConnectionsApiV1WsConnectionsGet_0

> any getConnectionsApiV1WsConnectionsGet_0()

当前连接列表

返回所有活跃连接的详细信息.  对应原项目 socketio_chat.py GET /connections

### Example

```ts
import {
  Configuration,
  WSAdminApi,
} from '';
import type { GetConnectionsApiV1WsConnectionsGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSAdminApi(config);

  try {
    const data = await api.getConnectionsApiV1WsConnectionsGet_0();
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


## getSystemStatusApiV1WsSystemStatusGet

> any getSystemStatusApiV1WsSystemStatusGet()

系统状态（内存、CPU、连接数）

返回进程级系统状态, 包含内存 / CPU / 连接数.

### Example

```ts
import {
  Configuration,
  WSAdminApi,
} from '';
import type { GetSystemStatusApiV1WsSystemStatusGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSAdminApi(config);

  try {
    const data = await api.getSystemStatusApiV1WsSystemStatusGet();
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


## getSystemStatusApiV1WsSystemStatusGet_0

> any getSystemStatusApiV1WsSystemStatusGet_0()

系统状态（内存、CPU、连接数）

返回进程级系统状态, 包含内存 / CPU / 连接数.

### Example

```ts
import {
  Configuration,
  WSAdminApi,
} from '';
import type { GetSystemStatusApiV1WsSystemStatusGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSAdminApi(config);

  try {
    const data = await api.getSystemStatusApiV1WsSystemStatusGet_0();
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


## getWsHealthApiV1WsHealthGet

> any getWsHealthApiV1WsHealthGet()

WebSocket健康检查

健康状态评估 -- 对应原项目 /cozeZhsApi/ws/websocket/health

### Example

```ts
import {
  Configuration,
  WSAdminApi,
} from '';
import type { GetWsHealthApiV1WsHealthGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSAdminApi(config);

  try {
    const data = await api.getWsHealthApiV1WsHealthGet();
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


## getWsHealthApiV1WsHealthGet_0

> any getWsHealthApiV1WsHealthGet_0()

WebSocket健康检查

健康状态评估 -- 对应原项目 /cozeZhsApi/ws/websocket/health

### Example

```ts
import {
  Configuration,
  WSAdminApi,
} from '';
import type { GetWsHealthApiV1WsHealthGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSAdminApi(config);

  try {
    const data = await api.getWsHealthApiV1WsHealthGet_0();
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


## getWsStatsApiV1WsStatsGet

> any getWsStatsApiV1WsStatsGet()

WebSocket连接统计

返回总连接数、房间数、用户数、消息数等.  对应原项目 /cozeZhsApi/ws/websocket/stats

### Example

```ts
import {
  Configuration,
  WSAdminApi,
} from '';
import type { GetWsStatsApiV1WsStatsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSAdminApi(config);

  try {
    const data = await api.getWsStatsApiV1WsStatsGet();
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


## getWsStatsApiV1WsStatsGet_0

> any getWsStatsApiV1WsStatsGet_0()

WebSocket连接统计

返回总连接数、房间数、用户数、消息数等.  对应原项目 /cozeZhsApi/ws/websocket/stats

### Example

```ts
import {
  Configuration,
  WSAdminApi,
} from '';
import type { GetWsStatsApiV1WsStatsGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSAdminApi(config);

  try {
    const data = await api.getWsStatsApiV1WsStatsGet_0();
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


## sendToClientApiV1WsSendConnIdPost

> any sendToClientApiV1WsSendConnIdPost(connId, sendToClientRequest)

发送消息给指定客户端

对应原项目 socketio_chat.py POST /send/{client_id}

### Example

```ts
import {
  Configuration,
  WSAdminApi,
} from '';
import type { SendToClientApiV1WsSendConnIdPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSAdminApi(config);

  const body = {
    // string
    connId: connId_example,
    // SendToClientRequest
    sendToClientRequest: ...,
  } satisfies SendToClientApiV1WsSendConnIdPostRequest;

  try {
    const data = await api.sendToClientApiV1WsSendConnIdPost(body);
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
| **connId** | `string` |  | [Defaults to `undefined`] |
| **sendToClientRequest** | [SendToClientRequest](SendToClientRequest.md) |  | |

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


## sendToClientApiV1WsSendConnIdPost_0

> any sendToClientApiV1WsSendConnIdPost_0(connId, sendToClientRequest)

发送消息给指定客户端

对应原项目 socketio_chat.py POST /send/{client_id}

### Example

```ts
import {
  Configuration,
  WSAdminApi,
} from '';
import type { SendToClientApiV1WsSendConnIdPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSAdminApi(config);

  const body = {
    // string
    connId: connId_example,
    // SendToClientRequest
    sendToClientRequest: ...,
  } satisfies SendToClientApiV1WsSendConnIdPost0Request;

  try {
    const data = await api.sendToClientApiV1WsSendConnIdPost_0(body);
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
| **connId** | `string` |  | [Defaults to `undefined`] |
| **sendToClientRequest** | [SendToClientRequest](SendToClientRequest.md) |  | |

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

