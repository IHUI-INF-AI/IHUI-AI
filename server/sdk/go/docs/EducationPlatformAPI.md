# \EducationPlatformAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreatePlatformApiV1EducationPlatformPost**](EducationPlatformAPI.md#CreatePlatformApiV1EducationPlatformPost) | **Post** /api/v1/education-platform | 新增教育平台
[**CreatePlatformApiV1EducationPlatformPost_0**](EducationPlatformAPI.md#CreatePlatformApiV1EducationPlatformPost_0) | **Post** /api/v1/education-platform | 新增教育平台
[**DeletePlatformApiV1EducationPlatformPidDelete**](EducationPlatformAPI.md#DeletePlatformApiV1EducationPlatformPidDelete) | **Delete** /api/v1/education-platform/{pid} | 删除教育平台
[**DeletePlatformApiV1EducationPlatformPidDelete_0**](EducationPlatformAPI.md#DeletePlatformApiV1EducationPlatformPidDelete_0) | **Delete** /api/v1/education-platform/{pid} | 删除教育平台
[**ListPlatformsApiV1EducationPlatformListGet**](EducationPlatformAPI.md#ListPlatformsApiV1EducationPlatformListGet) | **Get** /api/v1/education-platform/list | 教育平台列表
[**ListPlatformsApiV1EducationPlatformListGet_0**](EducationPlatformAPI.md#ListPlatformsApiV1EducationPlatformListGet_0) | **Get** /api/v1/education-platform/list | 教育平台列表
[**SyncLogApiV1EducationPlatformSyncLogGet**](EducationPlatformAPI.md#SyncLogApiV1EducationPlatformSyncLogGet) | **Get** /api/v1/education-platform/sync/log | 同步日志
[**SyncLogApiV1EducationPlatformSyncLogGet_0**](EducationPlatformAPI.md#SyncLogApiV1EducationPlatformSyncLogGet_0) | **Get** /api/v1/education-platform/sync/log | 同步日志
[**SyncPlatformApiV1EducationPlatformPidSyncPost**](EducationPlatformAPI.md#SyncPlatformApiV1EducationPlatformPidSyncPost) | **Post** /api/v1/education-platform/{pid}/sync | 同步数据
[**SyncPlatformApiV1EducationPlatformPidSyncPost_0**](EducationPlatformAPI.md#SyncPlatformApiV1EducationPlatformPidSyncPost_0) | **Post** /api/v1/education-platform/{pid}/sync | 同步数据
[**UpdatePlatformApiV1EducationPlatformPidPut**](EducationPlatformAPI.md#UpdatePlatformApiV1EducationPlatformPidPut) | **Put** /api/v1/education-platform/{pid} | 修改教育平台
[**UpdatePlatformApiV1EducationPlatformPidPut_0**](EducationPlatformAPI.md#UpdatePlatformApiV1EducationPlatformPidPut_0) | **Put** /api/v1/education-platform/{pid} | 修改教育平台



## CreatePlatformApiV1EducationPlatformPost

> interface{} CreatePlatformApiV1EducationPlatformPost(ctx).Name(name).Code(code).Type_(type_).ApiUrl(apiUrl).ApiKey(apiKey).ApiSecret(apiSecret).Config(config).SyncUrl(syncUrl).Description(description).Execute()

新增教育平台

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
	name := "name_example" // string | 
	code := "code_example" // string | 
	type_ := "type__example" // string |  (optional) (default to "mooc")
	apiUrl := "apiUrl_example" // string |  (optional)
	apiKey := "apiKey_example" // string |  (optional)
	apiSecret := "apiSecret_example" // string |  (optional)
	config := "config_example" // string |  (optional)
	syncUrl := "syncUrl_example" // string |  (optional)
	description := "description_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.EducationPlatformAPI.CreatePlatformApiV1EducationPlatformPost(context.Background()).Name(name).Code(code).Type_(type_).ApiUrl(apiUrl).ApiKey(apiKey).ApiSecret(apiSecret).Config(config).SyncUrl(syncUrl).Description(description).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `EducationPlatformAPI.CreatePlatformApiV1EducationPlatformPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreatePlatformApiV1EducationPlatformPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `EducationPlatformAPI.CreatePlatformApiV1EducationPlatformPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreatePlatformApiV1EducationPlatformPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **code** | **string** |  | 
 **type_** | **string** |  | [default to &quot;mooc&quot;]
 **apiUrl** | **string** |  | 
 **apiKey** | **string** |  | 
 **apiSecret** | **string** |  | 
 **config** | **string** |  | 
 **syncUrl** | **string** |  | 
 **description** | **string** |  | 

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


## CreatePlatformApiV1EducationPlatformPost_0

> interface{} CreatePlatformApiV1EducationPlatformPost_0(ctx).Name(name).Code(code).Type_(type_).ApiUrl(apiUrl).ApiKey(apiKey).ApiSecret(apiSecret).Config(config).SyncUrl(syncUrl).Description(description).Execute()

新增教育平台

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
	name := "name_example" // string | 
	code := "code_example" // string | 
	type_ := "type__example" // string |  (optional) (default to "mooc")
	apiUrl := "apiUrl_example" // string |  (optional)
	apiKey := "apiKey_example" // string |  (optional)
	apiSecret := "apiSecret_example" // string |  (optional)
	config := "config_example" // string |  (optional)
	syncUrl := "syncUrl_example" // string |  (optional)
	description := "description_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.EducationPlatformAPI.CreatePlatformApiV1EducationPlatformPost_0(context.Background()).Name(name).Code(code).Type_(type_).ApiUrl(apiUrl).ApiKey(apiKey).ApiSecret(apiSecret).Config(config).SyncUrl(syncUrl).Description(description).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `EducationPlatformAPI.CreatePlatformApiV1EducationPlatformPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreatePlatformApiV1EducationPlatformPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `EducationPlatformAPI.CreatePlatformApiV1EducationPlatformPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreatePlatformApiV1EducationPlatformPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **code** | **string** |  | 
 **type_** | **string** |  | [default to &quot;mooc&quot;]
 **apiUrl** | **string** |  | 
 **apiKey** | **string** |  | 
 **apiSecret** | **string** |  | 
 **config** | **string** |  | 
 **syncUrl** | **string** |  | 
 **description** | **string** |  | 

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


## DeletePlatformApiV1EducationPlatformPidDelete

> interface{} DeletePlatformApiV1EducationPlatformPidDelete(ctx, pid).Execute()

删除教育平台

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
	pid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.EducationPlatformAPI.DeletePlatformApiV1EducationPlatformPidDelete(context.Background(), pid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `EducationPlatformAPI.DeletePlatformApiV1EducationPlatformPidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeletePlatformApiV1EducationPlatformPidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `EducationPlatformAPI.DeletePlatformApiV1EducationPlatformPidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeletePlatformApiV1EducationPlatformPidDeleteRequest struct via the builder pattern


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


## DeletePlatformApiV1EducationPlatformPidDelete_0

> interface{} DeletePlatformApiV1EducationPlatformPidDelete_0(ctx, pid).Execute()

删除教育平台

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
	pid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.EducationPlatformAPI.DeletePlatformApiV1EducationPlatformPidDelete_0(context.Background(), pid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `EducationPlatformAPI.DeletePlatformApiV1EducationPlatformPidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeletePlatformApiV1EducationPlatformPidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `EducationPlatformAPI.DeletePlatformApiV1EducationPlatformPidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeletePlatformApiV1EducationPlatformPidDelete_2Request struct via the builder pattern


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


## ListPlatformsApiV1EducationPlatformListGet

> interface{} ListPlatformsApiV1EducationPlatformListGet(ctx).Status(status).Execute()

教育平台列表

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
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.EducationPlatformAPI.ListPlatformsApiV1EducationPlatformListGet(context.Background()).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `EducationPlatformAPI.ListPlatformsApiV1EducationPlatformListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListPlatformsApiV1EducationPlatformListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `EducationPlatformAPI.ListPlatformsApiV1EducationPlatformListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListPlatformsApiV1EducationPlatformListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
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


## ListPlatformsApiV1EducationPlatformListGet_0

> interface{} ListPlatformsApiV1EducationPlatformListGet_0(ctx).Status(status).Execute()

教育平台列表

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
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.EducationPlatformAPI.ListPlatformsApiV1EducationPlatformListGet_0(context.Background()).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `EducationPlatformAPI.ListPlatformsApiV1EducationPlatformListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListPlatformsApiV1EducationPlatformListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `EducationPlatformAPI.ListPlatformsApiV1EducationPlatformListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListPlatformsApiV1EducationPlatformListGet_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
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


## SyncLogApiV1EducationPlatformSyncLogGet

> interface{} SyncLogApiV1EducationPlatformSyncLogGet(ctx).Page(page).Limit(limit).PlatformCode(platformCode).Execute()

同步日志

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
	platformCode := "platformCode_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.EducationPlatformAPI.SyncLogApiV1EducationPlatformSyncLogGet(context.Background()).Page(page).Limit(limit).PlatformCode(platformCode).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `EducationPlatformAPI.SyncLogApiV1EducationPlatformSyncLogGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SyncLogApiV1EducationPlatformSyncLogGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `EducationPlatformAPI.SyncLogApiV1EducationPlatformSyncLogGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSyncLogApiV1EducationPlatformSyncLogGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **platformCode** | **string** |  | 

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


## SyncLogApiV1EducationPlatformSyncLogGet_0

> interface{} SyncLogApiV1EducationPlatformSyncLogGet_0(ctx).Page(page).Limit(limit).PlatformCode(platformCode).Execute()

同步日志

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
	platformCode := "platformCode_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.EducationPlatformAPI.SyncLogApiV1EducationPlatformSyncLogGet_0(context.Background()).Page(page).Limit(limit).PlatformCode(platformCode).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `EducationPlatformAPI.SyncLogApiV1EducationPlatformSyncLogGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SyncLogApiV1EducationPlatformSyncLogGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `EducationPlatformAPI.SyncLogApiV1EducationPlatformSyncLogGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSyncLogApiV1EducationPlatformSyncLogGet_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **platformCode** | **string** |  | 

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


## SyncPlatformApiV1EducationPlatformPidSyncPost

> interface{} SyncPlatformApiV1EducationPlatformPidSyncPost(ctx, pid).Type_(type_).SyncType(syncType).Execute()

同步数据

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
	pid := int32(56) // int32 | 
	type_ := "type__example" // string |  (optional) (default to "course")
	syncType := "syncType_example" // string |  (optional) (default to "pull")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.EducationPlatformAPI.SyncPlatformApiV1EducationPlatformPidSyncPost(context.Background(), pid).Type_(type_).SyncType(syncType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `EducationPlatformAPI.SyncPlatformApiV1EducationPlatformPidSyncPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SyncPlatformApiV1EducationPlatformPidSyncPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `EducationPlatformAPI.SyncPlatformApiV1EducationPlatformPidSyncPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiSyncPlatformApiV1EducationPlatformPidSyncPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **type_** | **string** |  | [default to &quot;course&quot;]
 **syncType** | **string** |  | [default to &quot;pull&quot;]

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


## SyncPlatformApiV1EducationPlatformPidSyncPost_0

> interface{} SyncPlatformApiV1EducationPlatformPidSyncPost_0(ctx, pid).Type_(type_).SyncType(syncType).Execute()

同步数据

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
	pid := int32(56) // int32 | 
	type_ := "type__example" // string |  (optional) (default to "course")
	syncType := "syncType_example" // string |  (optional) (default to "pull")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.EducationPlatformAPI.SyncPlatformApiV1EducationPlatformPidSyncPost_0(context.Background(), pid).Type_(type_).SyncType(syncType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `EducationPlatformAPI.SyncPlatformApiV1EducationPlatformPidSyncPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SyncPlatformApiV1EducationPlatformPidSyncPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `EducationPlatformAPI.SyncPlatformApiV1EducationPlatformPidSyncPost_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiSyncPlatformApiV1EducationPlatformPidSyncPost_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **type_** | **string** |  | [default to &quot;course&quot;]
 **syncType** | **string** |  | [default to &quot;pull&quot;]

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


## UpdatePlatformApiV1EducationPlatformPidPut

> interface{} UpdatePlatformApiV1EducationPlatformPidPut(ctx, pid).Name(name).ApiUrl(apiUrl).ApiKey(apiKey).ApiSecret(apiSecret).Status(status).Config(config).Execute()

修改教育平台

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
	pid := int32(56) // int32 | 
	name := "name_example" // string |  (optional)
	apiUrl := "apiUrl_example" // string |  (optional)
	apiKey := "apiKey_example" // string |  (optional)
	apiSecret := "apiSecret_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)
	config := "config_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.EducationPlatformAPI.UpdatePlatformApiV1EducationPlatformPidPut(context.Background(), pid).Name(name).ApiUrl(apiUrl).ApiKey(apiKey).ApiSecret(apiSecret).Status(status).Config(config).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `EducationPlatformAPI.UpdatePlatformApiV1EducationPlatformPidPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdatePlatformApiV1EducationPlatformPidPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `EducationPlatformAPI.UpdatePlatformApiV1EducationPlatformPidPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdatePlatformApiV1EducationPlatformPidPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **name** | **string** |  | 
 **apiUrl** | **string** |  | 
 **apiKey** | **string** |  | 
 **apiSecret** | **string** |  | 
 **status** | **int32** |  | 
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


## UpdatePlatformApiV1EducationPlatformPidPut_0

> interface{} UpdatePlatformApiV1EducationPlatformPidPut_0(ctx, pid).Name(name).ApiUrl(apiUrl).ApiKey(apiKey).ApiSecret(apiSecret).Status(status).Config(config).Execute()

修改教育平台

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
	pid := int32(56) // int32 | 
	name := "name_example" // string |  (optional)
	apiUrl := "apiUrl_example" // string |  (optional)
	apiKey := "apiKey_example" // string |  (optional)
	apiSecret := "apiSecret_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)
	config := "config_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.EducationPlatformAPI.UpdatePlatformApiV1EducationPlatformPidPut_0(context.Background(), pid).Name(name).ApiUrl(apiUrl).ApiKey(apiKey).ApiSecret(apiSecret).Status(status).Config(config).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `EducationPlatformAPI.UpdatePlatformApiV1EducationPlatformPidPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdatePlatformApiV1EducationPlatformPidPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `EducationPlatformAPI.UpdatePlatformApiV1EducationPlatformPidPut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**pid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdatePlatformApiV1EducationPlatformPidPut_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **name** | **string** |  | 
 **apiUrl** | **string** |  | 
 **apiKey** | **string** |  | 
 **apiSecret** | **string** |  | 
 **status** | **int32** |  | 
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

