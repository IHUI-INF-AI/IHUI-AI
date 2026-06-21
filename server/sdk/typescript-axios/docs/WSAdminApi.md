# WSAdminApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**broadcastMessageApiV1WsBroadcastPost**](#broadcastmessageapiv1wsbroadcastpost) | **POST** /api/v1/ws/broadcast | 广播消息|
|[**broadcastMessageApiV1WsBroadcastPost_0**](#broadcastmessageapiv1wsbroadcastpost_0) | **POST** /api/v1/ws/broadcast | 广播消息|
|[**cleanupConnectionsApiV1WsCleanupPost**](#cleanupconnectionsapiv1wscleanuppost) | **POST** /api/v1/ws/cleanup | 清理断开的连接|
|[**cleanupConnectionsApiV1WsCleanupPost_0**](#cleanupconnectionsapiv1wscleanuppost_0) | **POST** /api/v1/ws/cleanup | 清理断开的连接|
|[**forceDisconnectApiV1WsDisconnectConnIdPost**](#forcedisconnectapiv1wsdisconnectconnidpost) | **POST** /api/v1/ws/disconnect/{conn_id} | 强制断开指定客户端|
|[**forceDisconnectApiV1WsDisconnectConnIdPost_0**](#forcedisconnectapiv1wsdisconnectconnidpost_0) | **POST** /api/v1/ws/disconnect/{conn_id} | 强制断开指定客户端|
|[**getConnectionsApiV1WsConnectionsGet**](#getconnectionsapiv1wsconnectionsget) | **GET** /api/v1/ws/connections | 当前连接列表|
|[**getConnectionsApiV1WsConnectionsGet_0**](#getconnectionsapiv1wsconnectionsget_0) | **GET** /api/v1/ws/connections | 当前连接列表|
|[**getSystemStatusApiV1WsSystemStatusGet**](#getsystemstatusapiv1wssystemstatusget) | **GET** /api/v1/ws/system-status | 系统状态（内存、CPU、连接数）|
|[**getSystemStatusApiV1WsSystemStatusGet_0**](#getsystemstatusapiv1wssystemstatusget_0) | **GET** /api/v1/ws/system-status | 系统状态（内存、CPU、连接数）|
|[**getWsHealthApiV1WsHealthGet**](#getwshealthapiv1wshealthget) | **GET** /api/v1/ws/health | WebSocket健康检查|
|[**getWsHealthApiV1WsHealthGet_0**](#getwshealthapiv1wshealthget_0) | **GET** /api/v1/ws/health | WebSocket健康检查|
|[**getWsStatsApiV1WsStatsGet**](#getwsstatsapiv1wsstatsget) | **GET** /api/v1/ws/stats | WebSocket连接统计|
|[**getWsStatsApiV1WsStatsGet_0**](#getwsstatsapiv1wsstatsget_0) | **GET** /api/v1/ws/stats | WebSocket连接统计|
|[**sendToClientApiV1WsSendConnIdPost**](#sendtoclientapiv1wssendconnidpost) | **POST** /api/v1/ws/send/{conn_id} | 发送消息给指定客户端|
|[**sendToClientApiV1WsSendConnIdPost_0**](#sendtoclientapiv1wssendconnidpost_0) | **POST** /api/v1/ws/send/{conn_id} | 发送消息给指定客户端|

# **broadcastMessageApiV1WsBroadcastPost**
> any broadcastMessageApiV1WsBroadcastPost(broadcastRequest)

广播消息到所有连接或指定房间.  对应原项目 socketio_chat.py POST /broadcast

### Example

```typescript
import {
    WSAdminApi,
    Configuration,
    BroadcastRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new WSAdminApi(configuration);

let broadcastRequest: BroadcastRequest; //

const { status, data } = await apiInstance.broadcastMessageApiV1WsBroadcastPost(
    broadcastRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **broadcastRequest** | **BroadcastRequest**|  | |


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

# **broadcastMessageApiV1WsBroadcastPost_0**
> any broadcastMessageApiV1WsBroadcastPost_0(broadcastRequest)

广播消息到所有连接或指定房间.  对应原项目 socketio_chat.py POST /broadcast

### Example

```typescript
import {
    WSAdminApi,
    Configuration,
    BroadcastRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new WSAdminApi(configuration);

let broadcastRequest: BroadcastRequest; //

const { status, data } = await apiInstance.broadcastMessageApiV1WsBroadcastPost_0(
    broadcastRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **broadcastRequest** | **BroadcastRequest**|  | |


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

# **cleanupConnectionsApiV1WsCleanupPost**
> any cleanupConnectionsApiV1WsCleanupPost()

扫描并清理已断开 / 超时的连接.  对应原项目 /cozeZhsApi/ws/websocket/cleanup

### Example

```typescript
import {
    WSAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSAdminApi(configuration);

const { status, data } = await apiInstance.cleanupConnectionsApiV1WsCleanupPost();
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

# **cleanupConnectionsApiV1WsCleanupPost_0**
> any cleanupConnectionsApiV1WsCleanupPost_0()

扫描并清理已断开 / 超时的连接.  对应原项目 /cozeZhsApi/ws/websocket/cleanup

### Example

```typescript
import {
    WSAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSAdminApi(configuration);

const { status, data } = await apiInstance.cleanupConnectionsApiV1WsCleanupPost_0();
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

# **forceDisconnectApiV1WsDisconnectConnIdPost**
> any forceDisconnectApiV1WsDisconnectConnIdPost()

对应原项目 /cozeZhsApi/ws/websocket/disconnect/{client_id}

### Example

```typescript
import {
    WSAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSAdminApi(configuration);

let connId: string; // (default to undefined)

const { status, data } = await apiInstance.forceDisconnectApiV1WsDisconnectConnIdPost(
    connId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **connId** | [**string**] |  | defaults to undefined|


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

# **forceDisconnectApiV1WsDisconnectConnIdPost_0**
> any forceDisconnectApiV1WsDisconnectConnIdPost_0()

对应原项目 /cozeZhsApi/ws/websocket/disconnect/{client_id}

### Example

```typescript
import {
    WSAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSAdminApi(configuration);

let connId: string; // (default to undefined)

const { status, data } = await apiInstance.forceDisconnectApiV1WsDisconnectConnIdPost_0(
    connId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **connId** | [**string**] |  | defaults to undefined|


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

# **getConnectionsApiV1WsConnectionsGet**
> any getConnectionsApiV1WsConnectionsGet()

返回所有活跃连接的详细信息.  对应原项目 socketio_chat.py GET /connections

### Example

```typescript
import {
    WSAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSAdminApi(configuration);

const { status, data } = await apiInstance.getConnectionsApiV1WsConnectionsGet();
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

# **getConnectionsApiV1WsConnectionsGet_0**
> any getConnectionsApiV1WsConnectionsGet_0()

返回所有活跃连接的详细信息.  对应原项目 socketio_chat.py GET /connections

### Example

```typescript
import {
    WSAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSAdminApi(configuration);

const { status, data } = await apiInstance.getConnectionsApiV1WsConnectionsGet_0();
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

# **getSystemStatusApiV1WsSystemStatusGet**
> any getSystemStatusApiV1WsSystemStatusGet()

返回进程级系统状态, 包含内存 / CPU / 连接数.

### Example

```typescript
import {
    WSAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSAdminApi(configuration);

const { status, data } = await apiInstance.getSystemStatusApiV1WsSystemStatusGet();
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

# **getSystemStatusApiV1WsSystemStatusGet_0**
> any getSystemStatusApiV1WsSystemStatusGet_0()

返回进程级系统状态, 包含内存 / CPU / 连接数.

### Example

```typescript
import {
    WSAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSAdminApi(configuration);

const { status, data } = await apiInstance.getSystemStatusApiV1WsSystemStatusGet_0();
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

# **getWsHealthApiV1WsHealthGet**
> any getWsHealthApiV1WsHealthGet()

健康状态评估 -- 对应原项目 /cozeZhsApi/ws/websocket/health

### Example

```typescript
import {
    WSAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSAdminApi(configuration);

const { status, data } = await apiInstance.getWsHealthApiV1WsHealthGet();
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

# **getWsHealthApiV1WsHealthGet_0**
> any getWsHealthApiV1WsHealthGet_0()

健康状态评估 -- 对应原项目 /cozeZhsApi/ws/websocket/health

### Example

```typescript
import {
    WSAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSAdminApi(configuration);

const { status, data } = await apiInstance.getWsHealthApiV1WsHealthGet_0();
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

# **getWsStatsApiV1WsStatsGet**
> any getWsStatsApiV1WsStatsGet()

返回总连接数、房间数、用户数、消息数等.  对应原项目 /cozeZhsApi/ws/websocket/stats

### Example

```typescript
import {
    WSAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSAdminApi(configuration);

const { status, data } = await apiInstance.getWsStatsApiV1WsStatsGet();
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

# **getWsStatsApiV1WsStatsGet_0**
> any getWsStatsApiV1WsStatsGet_0()

返回总连接数、房间数、用户数、消息数等.  对应原项目 /cozeZhsApi/ws/websocket/stats

### Example

```typescript
import {
    WSAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSAdminApi(configuration);

const { status, data } = await apiInstance.getWsStatsApiV1WsStatsGet_0();
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

# **sendToClientApiV1WsSendConnIdPost**
> any sendToClientApiV1WsSendConnIdPost(sendToClientRequest)

对应原项目 socketio_chat.py POST /send/{client_id}

### Example

```typescript
import {
    WSAdminApi,
    Configuration,
    SendToClientRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new WSAdminApi(configuration);

let connId: string; // (default to undefined)
let sendToClientRequest: SendToClientRequest; //

const { status, data } = await apiInstance.sendToClientApiV1WsSendConnIdPost(
    connId,
    sendToClientRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sendToClientRequest** | **SendToClientRequest**|  | |
| **connId** | [**string**] |  | defaults to undefined|


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

# **sendToClientApiV1WsSendConnIdPost_0**
> any sendToClientApiV1WsSendConnIdPost_0(sendToClientRequest)

对应原项目 socketio_chat.py POST /send/{client_id}

### Example

```typescript
import {
    WSAdminApi,
    Configuration,
    SendToClientRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new WSAdminApi(configuration);

let connId: string; // (default to undefined)
let sendToClientRequest: SendToClientRequest; //

const { status, data } = await apiInstance.sendToClientApiV1WsSendConnIdPost_0(
    connId,
    sendToClientRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sendToClientRequest** | **SendToClientRequest**|  | |
| **connId** | [**string**] |  | defaults to undefined|


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

