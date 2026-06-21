# \ServiceCatalogAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CallLogListApiV1ServiceCatalogLogListGet**](ServiceCatalogAPI.md#CallLogListApiV1ServiceCatalogLogListGet) | **Get** /api/v1/service-catalog/log/list | 服务调用日志
[**CallLogListApiV1ServiceCatalogLogListGet_0**](ServiceCatalogAPI.md#CallLogListApiV1ServiceCatalogLogListGet_0) | **Get** /api/v1/service-catalog/log/list | 服务调用日志
[**DeleteServiceApiV1ServiceCatalogSidDelete**](ServiceCatalogAPI.md#DeleteServiceApiV1ServiceCatalogSidDelete) | **Delete** /api/v1/service-catalog/{sid} | 下线服务
[**DeleteServiceApiV1ServiceCatalogSidDelete_0**](ServiceCatalogAPI.md#DeleteServiceApiV1ServiceCatalogSidDelete_0) | **Delete** /api/v1/service-catalog/{sid} | 下线服务
[**GetServiceApiV1ServiceCatalogSidGet**](ServiceCatalogAPI.md#GetServiceApiV1ServiceCatalogSidGet) | **Get** /api/v1/service-catalog/{sid} | 服务详情
[**GetServiceApiV1ServiceCatalogSidGet_0**](ServiceCatalogAPI.md#GetServiceApiV1ServiceCatalogSidGet_0) | **Get** /api/v1/service-catalog/{sid} | 服务详情
[**HeartbeatApiV1ServiceCatalogSidHeartbeatPost**](ServiceCatalogAPI.md#HeartbeatApiV1ServiceCatalogSidHeartbeatPost) | **Post** /api/v1/service-catalog/{sid}/heartbeat | 心跳上报
[**HeartbeatApiV1ServiceCatalogSidHeartbeatPost_0**](ServiceCatalogAPI.md#HeartbeatApiV1ServiceCatalogSidHeartbeatPost_0) | **Post** /api/v1/service-catalog/{sid}/heartbeat | 心跳上报
[**RegisterApiV1ServiceCatalogPost**](ServiceCatalogAPI.md#RegisterApiV1ServiceCatalogPost) | **Post** /api/v1/service-catalog | 注册服务
[**RegisterApiV1ServiceCatalogPost_0**](ServiceCatalogAPI.md#RegisterApiV1ServiceCatalogPost_0) | **Post** /api/v1/service-catalog | 注册服务
[**ServiceListApiV1ServiceCatalogListGet**](ServiceCatalogAPI.md#ServiceListApiV1ServiceCatalogListGet) | **Get** /api/v1/service-catalog/list | 服务列表
[**ServiceListApiV1ServiceCatalogListGet_0**](ServiceCatalogAPI.md#ServiceListApiV1ServiceCatalogListGet_0) | **Get** /api/v1/service-catalog/list | 服务列表
[**UpdateServiceApiV1ServiceCatalogSidPut**](ServiceCatalogAPI.md#UpdateServiceApiV1ServiceCatalogSidPut) | **Put** /api/v1/service-catalog/{sid} | 更新服务
[**UpdateServiceApiV1ServiceCatalogSidPut_0**](ServiceCatalogAPI.md#UpdateServiceApiV1ServiceCatalogSidPut_0) | **Put** /api/v1/service-catalog/{sid} | 更新服务



## CallLogListApiV1ServiceCatalogLogListGet

> interface{} CallLogListApiV1ServiceCatalogLogListGet(ctx).Page(page).Limit(limit).ServiceCode(serviceCode).Status(status).Execute()

服务调用日志

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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)
	serviceCode := "serviceCode_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ServiceCatalogAPI.CallLogListApiV1ServiceCatalogLogListGet(context.Background()).Page(page).Limit(limit).ServiceCode(serviceCode).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ServiceCatalogAPI.CallLogListApiV1ServiceCatalogLogListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CallLogListApiV1ServiceCatalogLogListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ServiceCatalogAPI.CallLogListApiV1ServiceCatalogLogListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCallLogListApiV1ServiceCatalogLogListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **serviceCode** | **string** |  | 
 **status** | **int32** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CallLogListApiV1ServiceCatalogLogListGet_0

> interface{} CallLogListApiV1ServiceCatalogLogListGet_0(ctx).Page(page).Limit(limit).ServiceCode(serviceCode).Status(status).Execute()

服务调用日志

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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)
	serviceCode := "serviceCode_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ServiceCatalogAPI.CallLogListApiV1ServiceCatalogLogListGet_0(context.Background()).Page(page).Limit(limit).ServiceCode(serviceCode).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ServiceCatalogAPI.CallLogListApiV1ServiceCatalogLogListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CallLogListApiV1ServiceCatalogLogListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ServiceCatalogAPI.CallLogListApiV1ServiceCatalogLogListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCallLogListApiV1ServiceCatalogLogListGet_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **serviceCode** | **string** |  | 
 **status** | **int32** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DeleteServiceApiV1ServiceCatalogSidDelete

> interface{} DeleteServiceApiV1ServiceCatalogSidDelete(ctx, sid).Execute()

下线服务

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
	sid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ServiceCatalogAPI.DeleteServiceApiV1ServiceCatalogSidDelete(context.Background(), sid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ServiceCatalogAPI.DeleteServiceApiV1ServiceCatalogSidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteServiceApiV1ServiceCatalogSidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ServiceCatalogAPI.DeleteServiceApiV1ServiceCatalogSidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteServiceApiV1ServiceCatalogSidDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DeleteServiceApiV1ServiceCatalogSidDelete_0

> interface{} DeleteServiceApiV1ServiceCatalogSidDelete_0(ctx, sid).Execute()

下线服务

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
	sid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ServiceCatalogAPI.DeleteServiceApiV1ServiceCatalogSidDelete_0(context.Background(), sid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ServiceCatalogAPI.DeleteServiceApiV1ServiceCatalogSidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteServiceApiV1ServiceCatalogSidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ServiceCatalogAPI.DeleteServiceApiV1ServiceCatalogSidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteServiceApiV1ServiceCatalogSidDelete_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetServiceApiV1ServiceCatalogSidGet

> interface{} GetServiceApiV1ServiceCatalogSidGet(ctx, sid).Execute()

服务详情

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
	sid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ServiceCatalogAPI.GetServiceApiV1ServiceCatalogSidGet(context.Background(), sid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ServiceCatalogAPI.GetServiceApiV1ServiceCatalogSidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetServiceApiV1ServiceCatalogSidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ServiceCatalogAPI.GetServiceApiV1ServiceCatalogSidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetServiceApiV1ServiceCatalogSidGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetServiceApiV1ServiceCatalogSidGet_0

> interface{} GetServiceApiV1ServiceCatalogSidGet_0(ctx, sid).Execute()

服务详情

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
	sid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ServiceCatalogAPI.GetServiceApiV1ServiceCatalogSidGet_0(context.Background(), sid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ServiceCatalogAPI.GetServiceApiV1ServiceCatalogSidGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetServiceApiV1ServiceCatalogSidGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ServiceCatalogAPI.GetServiceApiV1ServiceCatalogSidGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetServiceApiV1ServiceCatalogSidGet_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## HeartbeatApiV1ServiceCatalogSidHeartbeatPost

> interface{} HeartbeatApiV1ServiceCatalogSidHeartbeatPost(ctx, sid).IsHealthy(isHealthy).ErrorMsg(errorMsg).Execute()

心跳上报

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
	sid := int32(56) // int32 | 
	isHealthy := true // bool |  (optional) (default to true)
	errorMsg := "errorMsg_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ServiceCatalogAPI.HeartbeatApiV1ServiceCatalogSidHeartbeatPost(context.Background(), sid).IsHealthy(isHealthy).ErrorMsg(errorMsg).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ServiceCatalogAPI.HeartbeatApiV1ServiceCatalogSidHeartbeatPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `HeartbeatApiV1ServiceCatalogSidHeartbeatPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ServiceCatalogAPI.HeartbeatApiV1ServiceCatalogSidHeartbeatPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiHeartbeatApiV1ServiceCatalogSidHeartbeatPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **isHealthy** | **bool** |  | [default to true]
 **errorMsg** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## HeartbeatApiV1ServiceCatalogSidHeartbeatPost_0

> interface{} HeartbeatApiV1ServiceCatalogSidHeartbeatPost_0(ctx, sid).IsHealthy(isHealthy).ErrorMsg(errorMsg).Execute()

心跳上报

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
	sid := int32(56) // int32 | 
	isHealthy := true // bool |  (optional) (default to true)
	errorMsg := "errorMsg_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ServiceCatalogAPI.HeartbeatApiV1ServiceCatalogSidHeartbeatPost_0(context.Background(), sid).IsHealthy(isHealthy).ErrorMsg(errorMsg).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ServiceCatalogAPI.HeartbeatApiV1ServiceCatalogSidHeartbeatPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `HeartbeatApiV1ServiceCatalogSidHeartbeatPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ServiceCatalogAPI.HeartbeatApiV1ServiceCatalogSidHeartbeatPost_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiHeartbeatApiV1ServiceCatalogSidHeartbeatPost_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **isHealthy** | **bool** |  | [default to true]
 **errorMsg** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## RegisterApiV1ServiceCatalogPost

> interface{} RegisterApiV1ServiceCatalogPost(ctx).Code(code).Name(name).Type_(type_).Host(host).Port(port).Path(path).Version(version).Description(description).Group(group).Tags(tags).HealthUrl(healthUrl).Weight(weight).Config(config).Execute()

注册服务

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
	code := "code_example" // string | 
	name := "name_example" // string | 
	type_ := "type__example" // string |  (optional) (default to "api")
	host := "host_example" // string |  (optional)
	port := int32(56) // int32 |  (optional) (default to 0)
	path := "path_example" // string |  (optional) (default to "/")
	version := "version_example" // string |  (optional) (default to "1.0.0")
	description := "description_example" // string |  (optional)
	group := "group_example" // string |  (optional) (default to "default")
	tags := "tags_example" // string |  (optional)
	healthUrl := "healthUrl_example" // string |  (optional)
	weight := int32(56) // int32 |  (optional) (default to 1)
	config := "config_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ServiceCatalogAPI.RegisterApiV1ServiceCatalogPost(context.Background()).Code(code).Name(name).Type_(type_).Host(host).Port(port).Path(path).Version(version).Description(description).Group(group).Tags(tags).HealthUrl(healthUrl).Weight(weight).Config(config).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ServiceCatalogAPI.RegisterApiV1ServiceCatalogPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RegisterApiV1ServiceCatalogPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ServiceCatalogAPI.RegisterApiV1ServiceCatalogPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRegisterApiV1ServiceCatalogPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** |  | 
 **name** | **string** |  | 
 **type_** | **string** |  | [default to &quot;api&quot;]
 **host** | **string** |  | 
 **port** | **int32** |  | [default to 0]
 **path** | **string** |  | [default to &quot;/&quot;]
 **version** | **string** |  | [default to &quot;1.0.0&quot;]
 **description** | **string** |  | 
 **group** | **string** |  | [default to &quot;default&quot;]
 **tags** | **string** |  | 
 **healthUrl** | **string** |  | 
 **weight** | **int32** |  | [default to 1]
 **config** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## RegisterApiV1ServiceCatalogPost_0

> interface{} RegisterApiV1ServiceCatalogPost_0(ctx).Code(code).Name(name).Type_(type_).Host(host).Port(port).Path(path).Version(version).Description(description).Group(group).Tags(tags).HealthUrl(healthUrl).Weight(weight).Config(config).Execute()

注册服务

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
	code := "code_example" // string | 
	name := "name_example" // string | 
	type_ := "type__example" // string |  (optional) (default to "api")
	host := "host_example" // string |  (optional)
	port := int32(56) // int32 |  (optional) (default to 0)
	path := "path_example" // string |  (optional) (default to "/")
	version := "version_example" // string |  (optional) (default to "1.0.0")
	description := "description_example" // string |  (optional)
	group := "group_example" // string |  (optional) (default to "default")
	tags := "tags_example" // string |  (optional)
	healthUrl := "healthUrl_example" // string |  (optional)
	weight := int32(56) // int32 |  (optional) (default to 1)
	config := "config_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ServiceCatalogAPI.RegisterApiV1ServiceCatalogPost_0(context.Background()).Code(code).Name(name).Type_(type_).Host(host).Port(port).Path(path).Version(version).Description(description).Group(group).Tags(tags).HealthUrl(healthUrl).Weight(weight).Config(config).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ServiceCatalogAPI.RegisterApiV1ServiceCatalogPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RegisterApiV1ServiceCatalogPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ServiceCatalogAPI.RegisterApiV1ServiceCatalogPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRegisterApiV1ServiceCatalogPost_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** |  | 
 **name** | **string** |  | 
 **type_** | **string** |  | [default to &quot;api&quot;]
 **host** | **string** |  | 
 **port** | **int32** |  | [default to 0]
 **path** | **string** |  | [default to &quot;/&quot;]
 **version** | **string** |  | [default to &quot;1.0.0&quot;]
 **description** | **string** |  | 
 **group** | **string** |  | [default to &quot;default&quot;]
 **tags** | **string** |  | 
 **healthUrl** | **string** |  | 
 **weight** | **int32** |  | [default to 1]
 **config** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ServiceListApiV1ServiceCatalogListGet

> interface{} ServiceListApiV1ServiceCatalogListGet(ctx).Group(group).Type_(type_).Status(status).Keyword(keyword).Execute()

服务列表

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
	group := "group_example" // string |  (optional)
	type_ := "type__example" // string |  (optional)
	status := int32(56) // int32 |  (optional)
	keyword := "keyword_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ServiceCatalogAPI.ServiceListApiV1ServiceCatalogListGet(context.Background()).Group(group).Type_(type_).Status(status).Keyword(keyword).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ServiceCatalogAPI.ServiceListApiV1ServiceCatalogListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ServiceListApiV1ServiceCatalogListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ServiceCatalogAPI.ServiceListApiV1ServiceCatalogListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiServiceListApiV1ServiceCatalogListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **group** | **string** |  | 
 **type_** | **string** |  | 
 **status** | **int32** |  | 
 **keyword** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ServiceListApiV1ServiceCatalogListGet_0

> interface{} ServiceListApiV1ServiceCatalogListGet_0(ctx).Group(group).Type_(type_).Status(status).Keyword(keyword).Execute()

服务列表

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
	group := "group_example" // string |  (optional)
	type_ := "type__example" // string |  (optional)
	status := int32(56) // int32 |  (optional)
	keyword := "keyword_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ServiceCatalogAPI.ServiceListApiV1ServiceCatalogListGet_0(context.Background()).Group(group).Type_(type_).Status(status).Keyword(keyword).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ServiceCatalogAPI.ServiceListApiV1ServiceCatalogListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ServiceListApiV1ServiceCatalogListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ServiceCatalogAPI.ServiceListApiV1ServiceCatalogListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiServiceListApiV1ServiceCatalogListGet_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **group** | **string** |  | 
 **type_** | **string** |  | 
 **status** | **int32** |  | 
 **keyword** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## UpdateServiceApiV1ServiceCatalogSidPut

> interface{} UpdateServiceApiV1ServiceCatalogSidPut(ctx, sid).Name(name).Host(host).Port(port).Status(status).Weight(weight).Config(config).Execute()

更新服务

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
	sid := int32(56) // int32 | 
	name := "name_example" // string |  (optional)
	host := "host_example" // string |  (optional)
	port := int32(56) // int32 |  (optional)
	status := int32(56) // int32 |  (optional)
	weight := int32(56) // int32 |  (optional)
	config := "config_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ServiceCatalogAPI.UpdateServiceApiV1ServiceCatalogSidPut(context.Background(), sid).Name(name).Host(host).Port(port).Status(status).Weight(weight).Config(config).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ServiceCatalogAPI.UpdateServiceApiV1ServiceCatalogSidPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateServiceApiV1ServiceCatalogSidPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ServiceCatalogAPI.UpdateServiceApiV1ServiceCatalogSidPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateServiceApiV1ServiceCatalogSidPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **name** | **string** |  | 
 **host** | **string** |  | 
 **port** | **int32** |  | 
 **status** | **int32** |  | 
 **weight** | **int32** |  | 
 **config** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## UpdateServiceApiV1ServiceCatalogSidPut_0

> interface{} UpdateServiceApiV1ServiceCatalogSidPut_0(ctx, sid).Name(name).Host(host).Port(port).Status(status).Weight(weight).Config(config).Execute()

更新服务

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
	sid := int32(56) // int32 | 
	name := "name_example" // string |  (optional)
	host := "host_example" // string |  (optional)
	port := int32(56) // int32 |  (optional)
	status := int32(56) // int32 |  (optional)
	weight := int32(56) // int32 |  (optional)
	config := "config_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ServiceCatalogAPI.UpdateServiceApiV1ServiceCatalogSidPut_0(context.Background(), sid).Name(name).Host(host).Port(port).Status(status).Weight(weight).Config(config).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ServiceCatalogAPI.UpdateServiceApiV1ServiceCatalogSidPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateServiceApiV1ServiceCatalogSidPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ServiceCatalogAPI.UpdateServiceApiV1ServiceCatalogSidPut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateServiceApiV1ServiceCatalogSidPut_7Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **name** | **string** |  | 
 **host** | **string** |  | 
 **port** | **int32** |  | 
 **status** | **int32** |  | 
 **weight** | **int32** |  | 
 **config** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

