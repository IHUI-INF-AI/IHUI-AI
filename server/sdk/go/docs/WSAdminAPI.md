# \WSAdminAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**BroadcastMessageApiV1WsBroadcastPost**](WSAdminAPI.md#BroadcastMessageApiV1WsBroadcastPost) | **Post** /api/v1/ws/broadcast | 广播消息
[**BroadcastMessageApiV1WsBroadcastPost_0**](WSAdminAPI.md#BroadcastMessageApiV1WsBroadcastPost_0) | **Post** /api/v1/ws/broadcast | 广播消息
[**CleanupConnectionsApiV1WsCleanupPost**](WSAdminAPI.md#CleanupConnectionsApiV1WsCleanupPost) | **Post** /api/v1/ws/cleanup | 清理断开的连接
[**CleanupConnectionsApiV1WsCleanupPost_0**](WSAdminAPI.md#CleanupConnectionsApiV1WsCleanupPost_0) | **Post** /api/v1/ws/cleanup | 清理断开的连接
[**ForceDisconnectApiV1WsDisconnectConnIdPost**](WSAdminAPI.md#ForceDisconnectApiV1WsDisconnectConnIdPost) | **Post** /api/v1/ws/disconnect/{conn_id} | 强制断开指定客户端
[**ForceDisconnectApiV1WsDisconnectConnIdPost_0**](WSAdminAPI.md#ForceDisconnectApiV1WsDisconnectConnIdPost_0) | **Post** /api/v1/ws/disconnect/{conn_id} | 强制断开指定客户端
[**GetConnectionsApiV1WsConnectionsGet**](WSAdminAPI.md#GetConnectionsApiV1WsConnectionsGet) | **Get** /api/v1/ws/connections | 当前连接列表
[**GetConnectionsApiV1WsConnectionsGet_0**](WSAdminAPI.md#GetConnectionsApiV1WsConnectionsGet_0) | **Get** /api/v1/ws/connections | 当前连接列表
[**GetSystemStatusApiV1WsSystemStatusGet**](WSAdminAPI.md#GetSystemStatusApiV1WsSystemStatusGet) | **Get** /api/v1/ws/system-status | 系统状态（内存、CPU、连接数）
[**GetSystemStatusApiV1WsSystemStatusGet_0**](WSAdminAPI.md#GetSystemStatusApiV1WsSystemStatusGet_0) | **Get** /api/v1/ws/system-status | 系统状态（内存、CPU、连接数）
[**GetWsHealthApiV1WsHealthGet**](WSAdminAPI.md#GetWsHealthApiV1WsHealthGet) | **Get** /api/v1/ws/health | WebSocket健康检查
[**GetWsHealthApiV1WsHealthGet_0**](WSAdminAPI.md#GetWsHealthApiV1WsHealthGet_0) | **Get** /api/v1/ws/health | WebSocket健康检查
[**GetWsStatsApiV1WsStatsGet**](WSAdminAPI.md#GetWsStatsApiV1WsStatsGet) | **Get** /api/v1/ws/stats | WebSocket连接统计
[**GetWsStatsApiV1WsStatsGet_0**](WSAdminAPI.md#GetWsStatsApiV1WsStatsGet_0) | **Get** /api/v1/ws/stats | WebSocket连接统计
[**SendToClientApiV1WsSendConnIdPost**](WSAdminAPI.md#SendToClientApiV1WsSendConnIdPost) | **Post** /api/v1/ws/send/{conn_id} | 发送消息给指定客户端
[**SendToClientApiV1WsSendConnIdPost_0**](WSAdminAPI.md#SendToClientApiV1WsSendConnIdPost_0) | **Post** /api/v1/ws/send/{conn_id} | 发送消息给指定客户端



## BroadcastMessageApiV1WsBroadcastPost

> interface{} BroadcastMessageApiV1WsBroadcastPost(ctx).BroadcastRequest(broadcastRequest).Execute()

广播消息



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
	broadcastRequest := *openapiclient.NewBroadcastRequest(map[string]interface{}{"key": interface{}(123)}) // BroadcastRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WSAdminAPI.BroadcastMessageApiV1WsBroadcastPost(context.Background()).BroadcastRequest(broadcastRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSAdminAPI.BroadcastMessageApiV1WsBroadcastPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BroadcastMessageApiV1WsBroadcastPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSAdminAPI.BroadcastMessageApiV1WsBroadcastPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiBroadcastMessageApiV1WsBroadcastPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **broadcastRequest** | [**BroadcastRequest**](BroadcastRequest.md) |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## BroadcastMessageApiV1WsBroadcastPost_0

> interface{} BroadcastMessageApiV1WsBroadcastPost_0(ctx).BroadcastRequest(broadcastRequest).Execute()

广播消息



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
	broadcastRequest := *openapiclient.NewBroadcastRequest(map[string]interface{}{"key": interface{}(123)}) // BroadcastRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WSAdminAPI.BroadcastMessageApiV1WsBroadcastPost_0(context.Background()).BroadcastRequest(broadcastRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSAdminAPI.BroadcastMessageApiV1WsBroadcastPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BroadcastMessageApiV1WsBroadcastPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSAdminAPI.BroadcastMessageApiV1WsBroadcastPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiBroadcastMessageApiV1WsBroadcastPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **broadcastRequest** | [**BroadcastRequest**](BroadcastRequest.md) |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CleanupConnectionsApiV1WsCleanupPost

> interface{} CleanupConnectionsApiV1WsCleanupPost(ctx).Execute()

清理断开的连接



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
	resp, r, err := apiClient.WSAdminAPI.CleanupConnectionsApiV1WsCleanupPost(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSAdminAPI.CleanupConnectionsApiV1WsCleanupPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CleanupConnectionsApiV1WsCleanupPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSAdminAPI.CleanupConnectionsApiV1WsCleanupPost`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCleanupConnectionsApiV1WsCleanupPostRequest struct via the builder pattern


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


## CleanupConnectionsApiV1WsCleanupPost_0

> interface{} CleanupConnectionsApiV1WsCleanupPost_0(ctx).Execute()

清理断开的连接



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
	resp, r, err := apiClient.WSAdminAPI.CleanupConnectionsApiV1WsCleanupPost_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSAdminAPI.CleanupConnectionsApiV1WsCleanupPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CleanupConnectionsApiV1WsCleanupPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSAdminAPI.CleanupConnectionsApiV1WsCleanupPost_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCleanupConnectionsApiV1WsCleanupPost_2Request struct via the builder pattern


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


## ForceDisconnectApiV1WsDisconnectConnIdPost

> interface{} ForceDisconnectApiV1WsDisconnectConnIdPost(ctx, connId).Execute()

强制断开指定客户端



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
	connId := "connId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WSAdminAPI.ForceDisconnectApiV1WsDisconnectConnIdPost(context.Background(), connId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSAdminAPI.ForceDisconnectApiV1WsDisconnectConnIdPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ForceDisconnectApiV1WsDisconnectConnIdPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSAdminAPI.ForceDisconnectApiV1WsDisconnectConnIdPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**connId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiForceDisconnectApiV1WsDisconnectConnIdPostRequest struct via the builder pattern


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


## ForceDisconnectApiV1WsDisconnectConnIdPost_0

> interface{} ForceDisconnectApiV1WsDisconnectConnIdPost_0(ctx, connId).Execute()

强制断开指定客户端



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
	connId := "connId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WSAdminAPI.ForceDisconnectApiV1WsDisconnectConnIdPost_0(context.Background(), connId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSAdminAPI.ForceDisconnectApiV1WsDisconnectConnIdPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ForceDisconnectApiV1WsDisconnectConnIdPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSAdminAPI.ForceDisconnectApiV1WsDisconnectConnIdPost_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**connId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiForceDisconnectApiV1WsDisconnectConnIdPost_3Request struct via the builder pattern


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


## GetConnectionsApiV1WsConnectionsGet

> interface{} GetConnectionsApiV1WsConnectionsGet(ctx).Execute()

当前连接列表



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
	resp, r, err := apiClient.WSAdminAPI.GetConnectionsApiV1WsConnectionsGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSAdminAPI.GetConnectionsApiV1WsConnectionsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetConnectionsApiV1WsConnectionsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSAdminAPI.GetConnectionsApiV1WsConnectionsGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetConnectionsApiV1WsConnectionsGetRequest struct via the builder pattern


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


## GetConnectionsApiV1WsConnectionsGet_0

> interface{} GetConnectionsApiV1WsConnectionsGet_0(ctx).Execute()

当前连接列表



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
	resp, r, err := apiClient.WSAdminAPI.GetConnectionsApiV1WsConnectionsGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSAdminAPI.GetConnectionsApiV1WsConnectionsGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetConnectionsApiV1WsConnectionsGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSAdminAPI.GetConnectionsApiV1WsConnectionsGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetConnectionsApiV1WsConnectionsGet_4Request struct via the builder pattern


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


## GetSystemStatusApiV1WsSystemStatusGet

> interface{} GetSystemStatusApiV1WsSystemStatusGet(ctx).Execute()

系统状态（内存、CPU、连接数）



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
	resp, r, err := apiClient.WSAdminAPI.GetSystemStatusApiV1WsSystemStatusGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSAdminAPI.GetSystemStatusApiV1WsSystemStatusGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetSystemStatusApiV1WsSystemStatusGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSAdminAPI.GetSystemStatusApiV1WsSystemStatusGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetSystemStatusApiV1WsSystemStatusGetRequest struct via the builder pattern


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


## GetSystemStatusApiV1WsSystemStatusGet_0

> interface{} GetSystemStatusApiV1WsSystemStatusGet_0(ctx).Execute()

系统状态（内存、CPU、连接数）



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
	resp, r, err := apiClient.WSAdminAPI.GetSystemStatusApiV1WsSystemStatusGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSAdminAPI.GetSystemStatusApiV1WsSystemStatusGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetSystemStatusApiV1WsSystemStatusGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSAdminAPI.GetSystemStatusApiV1WsSystemStatusGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetSystemStatusApiV1WsSystemStatusGet_5Request struct via the builder pattern


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


## GetWsHealthApiV1WsHealthGet

> interface{} GetWsHealthApiV1WsHealthGet(ctx).Execute()

WebSocket健康检查



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
	resp, r, err := apiClient.WSAdminAPI.GetWsHealthApiV1WsHealthGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSAdminAPI.GetWsHealthApiV1WsHealthGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetWsHealthApiV1WsHealthGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSAdminAPI.GetWsHealthApiV1WsHealthGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetWsHealthApiV1WsHealthGetRequest struct via the builder pattern


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


## GetWsHealthApiV1WsHealthGet_0

> interface{} GetWsHealthApiV1WsHealthGet_0(ctx).Execute()

WebSocket健康检查



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
	resp, r, err := apiClient.WSAdminAPI.GetWsHealthApiV1WsHealthGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSAdminAPI.GetWsHealthApiV1WsHealthGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetWsHealthApiV1WsHealthGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSAdminAPI.GetWsHealthApiV1WsHealthGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetWsHealthApiV1WsHealthGet_6Request struct via the builder pattern


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


## GetWsStatsApiV1WsStatsGet

> interface{} GetWsStatsApiV1WsStatsGet(ctx).Execute()

WebSocket连接统计



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
	resp, r, err := apiClient.WSAdminAPI.GetWsStatsApiV1WsStatsGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSAdminAPI.GetWsStatsApiV1WsStatsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetWsStatsApiV1WsStatsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSAdminAPI.GetWsStatsApiV1WsStatsGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetWsStatsApiV1WsStatsGetRequest struct via the builder pattern


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


## GetWsStatsApiV1WsStatsGet_0

> interface{} GetWsStatsApiV1WsStatsGet_0(ctx).Execute()

WebSocket连接统计



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
	resp, r, err := apiClient.WSAdminAPI.GetWsStatsApiV1WsStatsGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSAdminAPI.GetWsStatsApiV1WsStatsGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetWsStatsApiV1WsStatsGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSAdminAPI.GetWsStatsApiV1WsStatsGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetWsStatsApiV1WsStatsGet_7Request struct via the builder pattern


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


## SendToClientApiV1WsSendConnIdPost

> interface{} SendToClientApiV1WsSendConnIdPost(ctx, connId).SendToClientRequest(sendToClientRequest).Execute()

发送消息给指定客户端



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
	connId := "connId_example" // string | 
	sendToClientRequest := *openapiclient.NewSendToClientRequest(map[string]interface{}{"key": interface{}(123)}) // SendToClientRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WSAdminAPI.SendToClientApiV1WsSendConnIdPost(context.Background(), connId).SendToClientRequest(sendToClientRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSAdminAPI.SendToClientApiV1WsSendConnIdPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SendToClientApiV1WsSendConnIdPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSAdminAPI.SendToClientApiV1WsSendConnIdPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**connId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiSendToClientApiV1WsSendConnIdPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **sendToClientRequest** | [**SendToClientRequest**](SendToClientRequest.md) |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## SendToClientApiV1WsSendConnIdPost_0

> interface{} SendToClientApiV1WsSendConnIdPost_0(ctx, connId).SendToClientRequest(sendToClientRequest).Execute()

发送消息给指定客户端



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
	connId := "connId_example" // string | 
	sendToClientRequest := *openapiclient.NewSendToClientRequest(map[string]interface{}{"key": interface{}(123)}) // SendToClientRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WSAdminAPI.SendToClientApiV1WsSendConnIdPost_0(context.Background(), connId).SendToClientRequest(sendToClientRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSAdminAPI.SendToClientApiV1WsSendConnIdPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SendToClientApiV1WsSendConnIdPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSAdminAPI.SendToClientApiV1WsSendConnIdPost_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**connId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiSendToClientApiV1WsSendConnIdPost_8Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **sendToClientRequest** | [**SendToClientRequest**](SendToClientRequest.md) |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

