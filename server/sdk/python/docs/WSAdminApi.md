# zhs_api.WSAdminApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**broadcast_message_api_v1_ws_broadcast_post**](WSAdminApi.md#broadcast_message_api_v1_ws_broadcast_post) | **POST** /api/v1/ws/broadcast | 广播消息
[**broadcast_message_api_v1_ws_broadcast_post_0**](WSAdminApi.md#broadcast_message_api_v1_ws_broadcast_post_0) | **POST** /api/v1/ws/broadcast | 广播消息
[**cleanup_connections_api_v1_ws_cleanup_post**](WSAdminApi.md#cleanup_connections_api_v1_ws_cleanup_post) | **POST** /api/v1/ws/cleanup | 清理断开的连接
[**cleanup_connections_api_v1_ws_cleanup_post_0**](WSAdminApi.md#cleanup_connections_api_v1_ws_cleanup_post_0) | **POST** /api/v1/ws/cleanup | 清理断开的连接
[**force_disconnect_api_v1_ws_disconnect_conn_id_post**](WSAdminApi.md#force_disconnect_api_v1_ws_disconnect_conn_id_post) | **POST** /api/v1/ws/disconnect/{conn_id} | 强制断开指定客户端
[**force_disconnect_api_v1_ws_disconnect_conn_id_post_0**](WSAdminApi.md#force_disconnect_api_v1_ws_disconnect_conn_id_post_0) | **POST** /api/v1/ws/disconnect/{conn_id} | 强制断开指定客户端
[**get_connections_api_v1_ws_connections_get**](WSAdminApi.md#get_connections_api_v1_ws_connections_get) | **GET** /api/v1/ws/connections | 当前连接列表
[**get_connections_api_v1_ws_connections_get_0**](WSAdminApi.md#get_connections_api_v1_ws_connections_get_0) | **GET** /api/v1/ws/connections | 当前连接列表
[**get_system_status_api_v1_ws_system_status_get**](WSAdminApi.md#get_system_status_api_v1_ws_system_status_get) | **GET** /api/v1/ws/system-status | 系统状态（内存、CPU、连接数）
[**get_system_status_api_v1_ws_system_status_get_0**](WSAdminApi.md#get_system_status_api_v1_ws_system_status_get_0) | **GET** /api/v1/ws/system-status | 系统状态（内存、CPU、连接数）
[**get_ws_health_api_v1_ws_health_get**](WSAdminApi.md#get_ws_health_api_v1_ws_health_get) | **GET** /api/v1/ws/health | WebSocket健康检查
[**get_ws_health_api_v1_ws_health_get_0**](WSAdminApi.md#get_ws_health_api_v1_ws_health_get_0) | **GET** /api/v1/ws/health | WebSocket健康检查
[**get_ws_stats_api_v1_ws_stats_get**](WSAdminApi.md#get_ws_stats_api_v1_ws_stats_get) | **GET** /api/v1/ws/stats | WebSocket连接统计
[**get_ws_stats_api_v1_ws_stats_get_0**](WSAdminApi.md#get_ws_stats_api_v1_ws_stats_get_0) | **GET** /api/v1/ws/stats | WebSocket连接统计
[**send_to_client_api_v1_ws_send_conn_id_post**](WSAdminApi.md#send_to_client_api_v1_ws_send_conn_id_post) | **POST** /api/v1/ws/send/{conn_id} | 发送消息给指定客户端
[**send_to_client_api_v1_ws_send_conn_id_post_0**](WSAdminApi.md#send_to_client_api_v1_ws_send_conn_id_post_0) | **POST** /api/v1/ws/send/{conn_id} | 发送消息给指定客户端


# **broadcast_message_api_v1_ws_broadcast_post**
> object broadcast_message_api_v1_ws_broadcast_post(broadcast_request)

广播消息

广播消息到所有连接或指定房间.

对应原项目 socketio_chat.py POST /broadcast

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.broadcast_request import BroadcastRequest
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
    api_instance = zhs_api.WSAdminApi(api_client)
    broadcast_request = zhs_api.BroadcastRequest() # BroadcastRequest | 

    try:
        # 广播消息
        api_response = api_instance.broadcast_message_api_v1_ws_broadcast_post(broadcast_request)
        print("The response of WSAdminApi->broadcast_message_api_v1_ws_broadcast_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSAdminApi->broadcast_message_api_v1_ws_broadcast_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **broadcast_request** | [**BroadcastRequest**](BroadcastRequest.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **broadcast_message_api_v1_ws_broadcast_post_0**
> object broadcast_message_api_v1_ws_broadcast_post_0(broadcast_request)

广播消息

广播消息到所有连接或指定房间.

对应原项目 socketio_chat.py POST /broadcast

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.broadcast_request import BroadcastRequest
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
    api_instance = zhs_api.WSAdminApi(api_client)
    broadcast_request = zhs_api.BroadcastRequest() # BroadcastRequest | 

    try:
        # 广播消息
        api_response = api_instance.broadcast_message_api_v1_ws_broadcast_post_0(broadcast_request)
        print("The response of WSAdminApi->broadcast_message_api_v1_ws_broadcast_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSAdminApi->broadcast_message_api_v1_ws_broadcast_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **broadcast_request** | [**BroadcastRequest**](BroadcastRequest.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cleanup_connections_api_v1_ws_cleanup_post**
> object cleanup_connections_api_v1_ws_cleanup_post()

清理断开的连接

扫描并清理已断开 / 超时的连接.

对应原项目 /cozeZhsApi/ws/websocket/cleanup

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
    api_instance = zhs_api.WSAdminApi(api_client)

    try:
        # 清理断开的连接
        api_response = api_instance.cleanup_connections_api_v1_ws_cleanup_post()
        print("The response of WSAdminApi->cleanup_connections_api_v1_ws_cleanup_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSAdminApi->cleanup_connections_api_v1_ws_cleanup_post: %s\n" % e)
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

# **cleanup_connections_api_v1_ws_cleanup_post_0**
> object cleanup_connections_api_v1_ws_cleanup_post_0()

清理断开的连接

扫描并清理已断开 / 超时的连接.

对应原项目 /cozeZhsApi/ws/websocket/cleanup

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
    api_instance = zhs_api.WSAdminApi(api_client)

    try:
        # 清理断开的连接
        api_response = api_instance.cleanup_connections_api_v1_ws_cleanup_post_0()
        print("The response of WSAdminApi->cleanup_connections_api_v1_ws_cleanup_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSAdminApi->cleanup_connections_api_v1_ws_cleanup_post_0: %s\n" % e)
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

# **force_disconnect_api_v1_ws_disconnect_conn_id_post**
> object force_disconnect_api_v1_ws_disconnect_conn_id_post(conn_id)

强制断开指定客户端

对应原项目 /cozeZhsApi/ws/websocket/disconnect/{client_id}

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
    api_instance = zhs_api.WSAdminApi(api_client)
    conn_id = 'conn_id_example' # str | 

    try:
        # 强制断开指定客户端
        api_response = api_instance.force_disconnect_api_v1_ws_disconnect_conn_id_post(conn_id)
        print("The response of WSAdminApi->force_disconnect_api_v1_ws_disconnect_conn_id_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSAdminApi->force_disconnect_api_v1_ws_disconnect_conn_id_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **conn_id** | **str**|  | 

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

# **force_disconnect_api_v1_ws_disconnect_conn_id_post_0**
> object force_disconnect_api_v1_ws_disconnect_conn_id_post_0(conn_id)

强制断开指定客户端

对应原项目 /cozeZhsApi/ws/websocket/disconnect/{client_id}

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
    api_instance = zhs_api.WSAdminApi(api_client)
    conn_id = 'conn_id_example' # str | 

    try:
        # 强制断开指定客户端
        api_response = api_instance.force_disconnect_api_v1_ws_disconnect_conn_id_post_0(conn_id)
        print("The response of WSAdminApi->force_disconnect_api_v1_ws_disconnect_conn_id_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSAdminApi->force_disconnect_api_v1_ws_disconnect_conn_id_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **conn_id** | **str**|  | 

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

# **get_connections_api_v1_ws_connections_get**
> object get_connections_api_v1_ws_connections_get()

当前连接列表

返回所有活跃连接的详细信息.

对应原项目 socketio_chat.py GET /connections

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
    api_instance = zhs_api.WSAdminApi(api_client)

    try:
        # 当前连接列表
        api_response = api_instance.get_connections_api_v1_ws_connections_get()
        print("The response of WSAdminApi->get_connections_api_v1_ws_connections_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSAdminApi->get_connections_api_v1_ws_connections_get: %s\n" % e)
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

# **get_connections_api_v1_ws_connections_get_0**
> object get_connections_api_v1_ws_connections_get_0()

当前连接列表

返回所有活跃连接的详细信息.

对应原项目 socketio_chat.py GET /connections

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
    api_instance = zhs_api.WSAdminApi(api_client)

    try:
        # 当前连接列表
        api_response = api_instance.get_connections_api_v1_ws_connections_get_0()
        print("The response of WSAdminApi->get_connections_api_v1_ws_connections_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSAdminApi->get_connections_api_v1_ws_connections_get_0: %s\n" % e)
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

# **get_system_status_api_v1_ws_system_status_get**
> object get_system_status_api_v1_ws_system_status_get()

系统状态（内存、CPU、连接数）

返回进程级系统状态, 包含内存 / CPU / 连接数.

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
    api_instance = zhs_api.WSAdminApi(api_client)

    try:
        # 系统状态（内存、CPU、连接数）
        api_response = api_instance.get_system_status_api_v1_ws_system_status_get()
        print("The response of WSAdminApi->get_system_status_api_v1_ws_system_status_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSAdminApi->get_system_status_api_v1_ws_system_status_get: %s\n" % e)
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

# **get_system_status_api_v1_ws_system_status_get_0**
> object get_system_status_api_v1_ws_system_status_get_0()

系统状态（内存、CPU、连接数）

返回进程级系统状态, 包含内存 / CPU / 连接数.

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
    api_instance = zhs_api.WSAdminApi(api_client)

    try:
        # 系统状态（内存、CPU、连接数）
        api_response = api_instance.get_system_status_api_v1_ws_system_status_get_0()
        print("The response of WSAdminApi->get_system_status_api_v1_ws_system_status_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSAdminApi->get_system_status_api_v1_ws_system_status_get_0: %s\n" % e)
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

# **get_ws_health_api_v1_ws_health_get**
> object get_ws_health_api_v1_ws_health_get()

WebSocket健康检查

健康状态评估 -- 对应原项目 /cozeZhsApi/ws/websocket/health

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
    api_instance = zhs_api.WSAdminApi(api_client)

    try:
        # WebSocket健康检查
        api_response = api_instance.get_ws_health_api_v1_ws_health_get()
        print("The response of WSAdminApi->get_ws_health_api_v1_ws_health_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSAdminApi->get_ws_health_api_v1_ws_health_get: %s\n" % e)
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

# **get_ws_health_api_v1_ws_health_get_0**
> object get_ws_health_api_v1_ws_health_get_0()

WebSocket健康检查

健康状态评估 -- 对应原项目 /cozeZhsApi/ws/websocket/health

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
    api_instance = zhs_api.WSAdminApi(api_client)

    try:
        # WebSocket健康检查
        api_response = api_instance.get_ws_health_api_v1_ws_health_get_0()
        print("The response of WSAdminApi->get_ws_health_api_v1_ws_health_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSAdminApi->get_ws_health_api_v1_ws_health_get_0: %s\n" % e)
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

# **get_ws_stats_api_v1_ws_stats_get**
> object get_ws_stats_api_v1_ws_stats_get()

WebSocket连接统计

返回总连接数、房间数、用户数、消息数等.

对应原项目 /cozeZhsApi/ws/websocket/stats

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
    api_instance = zhs_api.WSAdminApi(api_client)

    try:
        # WebSocket连接统计
        api_response = api_instance.get_ws_stats_api_v1_ws_stats_get()
        print("The response of WSAdminApi->get_ws_stats_api_v1_ws_stats_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSAdminApi->get_ws_stats_api_v1_ws_stats_get: %s\n" % e)
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

# **get_ws_stats_api_v1_ws_stats_get_0**
> object get_ws_stats_api_v1_ws_stats_get_0()

WebSocket连接统计

返回总连接数、房间数、用户数、消息数等.

对应原项目 /cozeZhsApi/ws/websocket/stats

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
    api_instance = zhs_api.WSAdminApi(api_client)

    try:
        # WebSocket连接统计
        api_response = api_instance.get_ws_stats_api_v1_ws_stats_get_0()
        print("The response of WSAdminApi->get_ws_stats_api_v1_ws_stats_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSAdminApi->get_ws_stats_api_v1_ws_stats_get_0: %s\n" % e)
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

# **send_to_client_api_v1_ws_send_conn_id_post**
> object send_to_client_api_v1_ws_send_conn_id_post(conn_id, send_to_client_request)

发送消息给指定客户端

对应原项目 socketio_chat.py POST /send/{client_id}

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.send_to_client_request import SendToClientRequest
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
    api_instance = zhs_api.WSAdminApi(api_client)
    conn_id = 'conn_id_example' # str | 
    send_to_client_request = zhs_api.SendToClientRequest() # SendToClientRequest | 

    try:
        # 发送消息给指定客户端
        api_response = api_instance.send_to_client_api_v1_ws_send_conn_id_post(conn_id, send_to_client_request)
        print("The response of WSAdminApi->send_to_client_api_v1_ws_send_conn_id_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSAdminApi->send_to_client_api_v1_ws_send_conn_id_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **conn_id** | **str**|  | 
 **send_to_client_request** | [**SendToClientRequest**](SendToClientRequest.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **send_to_client_api_v1_ws_send_conn_id_post_0**
> object send_to_client_api_v1_ws_send_conn_id_post_0(conn_id, send_to_client_request)

发送消息给指定客户端

对应原项目 socketio_chat.py POST /send/{client_id}

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.models.send_to_client_request import SendToClientRequest
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
    api_instance = zhs_api.WSAdminApi(api_client)
    conn_id = 'conn_id_example' # str | 
    send_to_client_request = zhs_api.SendToClientRequest() # SendToClientRequest | 

    try:
        # 发送消息给指定客户端
        api_response = api_instance.send_to_client_api_v1_ws_send_conn_id_post_0(conn_id, send_to_client_request)
        print("The response of WSAdminApi->send_to_client_api_v1_ws_send_conn_id_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling WSAdminApi->send_to_client_api_v1_ws_send_conn_id_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **conn_id** | **str**|  | 
 **send_to_client_request** | [**SendToClientRequest**](SendToClientRequest.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

