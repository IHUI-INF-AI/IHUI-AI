# \AppVersionAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CheckUpdateApiV1AppVersionCheckGet**](AppVersionAPI.md#CheckUpdateApiV1AppVersionCheckGet) | **Get** /api/v1/app-version/check | 检查更新
[**CheckUpdateApiV1AppVersionCheckGet_0**](AppVersionAPI.md#CheckUpdateApiV1AppVersionCheckGet_0) | **Get** /api/v1/app-version/check | 检查更新
[**CreateVersionApiV1AppVersionPost**](AppVersionAPI.md#CreateVersionApiV1AppVersionPost) | **Post** /api/v1/app-version | 新增版本
[**CreateVersionApiV1AppVersionPost_0**](AppVersionAPI.md#CreateVersionApiV1AppVersionPost_0) | **Post** /api/v1/app-version | 新增版本
[**DeleteVersionApiV1AppVersionVidDelete**](AppVersionAPI.md#DeleteVersionApiV1AppVersionVidDelete) | **Delete** /api/v1/app-version/{vid} | 删除版本
[**DeleteVersionApiV1AppVersionVidDelete_0**](AppVersionAPI.md#DeleteVersionApiV1AppVersionVidDelete_0) | **Delete** /api/v1/app-version/{vid} | 删除版本
[**ListVersionsApiV1AppVersionListGet**](AppVersionAPI.md#ListVersionsApiV1AppVersionListGet) | **Get** /api/v1/app-version/list | 版本列表
[**ListVersionsApiV1AppVersionListGet_0**](AppVersionAPI.md#ListVersionsApiV1AppVersionListGet_0) | **Get** /api/v1/app-version/list | 版本列表
[**UpdateVersionApiV1AppVersionVidPut**](AppVersionAPI.md#UpdateVersionApiV1AppVersionVidPut) | **Put** /api/v1/app-version/{vid} | 修改版本
[**UpdateVersionApiV1AppVersionVidPut_0**](AppVersionAPI.md#UpdateVersionApiV1AppVersionVidPut_0) | **Put** /api/v1/app-version/{vid} | 修改版本



## CheckUpdateApiV1AppVersionCheckGet

> interface{} CheckUpdateApiV1AppVersionCheckGet(ctx).Platform(platform).CurrentVersion(currentVersion).Build(build).Execute()

检查更新

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
	platform := "platform_example" // string | 
	currentVersion := "currentVersion_example" // string | 
	build := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AppVersionAPI.CheckUpdateApiV1AppVersionCheckGet(context.Background()).Platform(platform).CurrentVersion(currentVersion).Build(build).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AppVersionAPI.CheckUpdateApiV1AppVersionCheckGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CheckUpdateApiV1AppVersionCheckGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AppVersionAPI.CheckUpdateApiV1AppVersionCheckGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCheckUpdateApiV1AppVersionCheckGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform** | **string** |  | 
 **currentVersion** | **string** |  | 
 **build** | **int32** |  | [default to 0]

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


## CheckUpdateApiV1AppVersionCheckGet_0

> interface{} CheckUpdateApiV1AppVersionCheckGet_0(ctx).Platform(platform).CurrentVersion(currentVersion).Build(build).Execute()

检查更新

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
	platform := "platform_example" // string | 
	currentVersion := "currentVersion_example" // string | 
	build := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AppVersionAPI.CheckUpdateApiV1AppVersionCheckGet_0(context.Background()).Platform(platform).CurrentVersion(currentVersion).Build(build).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AppVersionAPI.CheckUpdateApiV1AppVersionCheckGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CheckUpdateApiV1AppVersionCheckGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AppVersionAPI.CheckUpdateApiV1AppVersionCheckGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCheckUpdateApiV1AppVersionCheckGet_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform** | **string** |  | 
 **currentVersion** | **string** |  | 
 **build** | **int32** |  | [default to 0]

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


## CreateVersionApiV1AppVersionPost

> interface{} CreateVersionApiV1AppVersionPost(ctx).Platform(platform).Version(version).Title(title).Content(content).Build(build).DownloadUrl(downloadUrl).IsForce(isForce).IsSilent(isSilent).MinVersion(minVersion).GrayRatio(grayRatio).FileSize(fileSize).Md5(md5).Execute()

新增版本

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
	platform := "platform_example" // string | 
	version := "version_example" // string | 
	title := "title_example" // string | 
	content := "content_example" // string | 
	build := int32(56) // int32 |  (optional) (default to 1)
	downloadUrl := "downloadUrl_example" // string |  (optional)
	isForce := true // bool |  (optional) (default to false)
	isSilent := true // bool |  (optional) (default to false)
	minVersion := "minVersion_example" // string |  (optional)
	grayRatio := int32(56) // int32 |  (optional) (default to 0)
	fileSize := int32(56) // int32 |  (optional) (default to 0)
	md5 := "md5_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AppVersionAPI.CreateVersionApiV1AppVersionPost(context.Background()).Platform(platform).Version(version).Title(title).Content(content).Build(build).DownloadUrl(downloadUrl).IsForce(isForce).IsSilent(isSilent).MinVersion(minVersion).GrayRatio(grayRatio).FileSize(fileSize).Md5(md5).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AppVersionAPI.CreateVersionApiV1AppVersionPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateVersionApiV1AppVersionPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AppVersionAPI.CreateVersionApiV1AppVersionPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateVersionApiV1AppVersionPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform** | **string** |  | 
 **version** | **string** |  | 
 **title** | **string** |  | 
 **content** | **string** |  | 
 **build** | **int32** |  | [default to 1]
 **downloadUrl** | **string** |  | 
 **isForce** | **bool** |  | [default to false]
 **isSilent** | **bool** |  | [default to false]
 **minVersion** | **string** |  | 
 **grayRatio** | **int32** |  | [default to 0]
 **fileSize** | **int32** |  | [default to 0]
 **md5** | **string** |  | 

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


## CreateVersionApiV1AppVersionPost_0

> interface{} CreateVersionApiV1AppVersionPost_0(ctx).Platform(platform).Version(version).Title(title).Content(content).Build(build).DownloadUrl(downloadUrl).IsForce(isForce).IsSilent(isSilent).MinVersion(minVersion).GrayRatio(grayRatio).FileSize(fileSize).Md5(md5).Execute()

新增版本

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
	platform := "platform_example" // string | 
	version := "version_example" // string | 
	title := "title_example" // string | 
	content := "content_example" // string | 
	build := int32(56) // int32 |  (optional) (default to 1)
	downloadUrl := "downloadUrl_example" // string |  (optional)
	isForce := true // bool |  (optional) (default to false)
	isSilent := true // bool |  (optional) (default to false)
	minVersion := "minVersion_example" // string |  (optional)
	grayRatio := int32(56) // int32 |  (optional) (default to 0)
	fileSize := int32(56) // int32 |  (optional) (default to 0)
	md5 := "md5_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AppVersionAPI.CreateVersionApiV1AppVersionPost_0(context.Background()).Platform(platform).Version(version).Title(title).Content(content).Build(build).DownloadUrl(downloadUrl).IsForce(isForce).IsSilent(isSilent).MinVersion(minVersion).GrayRatio(grayRatio).FileSize(fileSize).Md5(md5).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AppVersionAPI.CreateVersionApiV1AppVersionPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateVersionApiV1AppVersionPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AppVersionAPI.CreateVersionApiV1AppVersionPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateVersionApiV1AppVersionPost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform** | **string** |  | 
 **version** | **string** |  | 
 **title** | **string** |  | 
 **content** | **string** |  | 
 **build** | **int32** |  | [default to 1]
 **downloadUrl** | **string** |  | 
 **isForce** | **bool** |  | [default to false]
 **isSilent** | **bool** |  | [default to false]
 **minVersion** | **string** |  | 
 **grayRatio** | **int32** |  | [default to 0]
 **fileSize** | **int32** |  | [default to 0]
 **md5** | **string** |  | 

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


## DeleteVersionApiV1AppVersionVidDelete

> interface{} DeleteVersionApiV1AppVersionVidDelete(ctx, vid).Execute()

删除版本

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
	vid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AppVersionAPI.DeleteVersionApiV1AppVersionVidDelete(context.Background(), vid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AppVersionAPI.DeleteVersionApiV1AppVersionVidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteVersionApiV1AppVersionVidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AppVersionAPI.DeleteVersionApiV1AppVersionVidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**vid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteVersionApiV1AppVersionVidDeleteRequest struct via the builder pattern


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


## DeleteVersionApiV1AppVersionVidDelete_0

> interface{} DeleteVersionApiV1AppVersionVidDelete_0(ctx, vid).Execute()

删除版本

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
	vid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AppVersionAPI.DeleteVersionApiV1AppVersionVidDelete_0(context.Background(), vid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AppVersionAPI.DeleteVersionApiV1AppVersionVidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteVersionApiV1AppVersionVidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AppVersionAPI.DeleteVersionApiV1AppVersionVidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**vid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteVersionApiV1AppVersionVidDelete_3Request struct via the builder pattern


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


## ListVersionsApiV1AppVersionListGet

> interface{} ListVersionsApiV1AppVersionListGet(ctx).Platform(platform).Page(page).Limit(limit).Execute()

版本列表

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
	platform := "platform_example" // string |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AppVersionAPI.ListVersionsApiV1AppVersionListGet(context.Background()).Platform(platform).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AppVersionAPI.ListVersionsApiV1AppVersionListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListVersionsApiV1AppVersionListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AppVersionAPI.ListVersionsApiV1AppVersionListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListVersionsApiV1AppVersionListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform** | **string** |  | 
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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


## ListVersionsApiV1AppVersionListGet_0

> interface{} ListVersionsApiV1AppVersionListGet_0(ctx).Platform(platform).Page(page).Limit(limit).Execute()

版本列表

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
	platform := "platform_example" // string |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AppVersionAPI.ListVersionsApiV1AppVersionListGet_0(context.Background()).Platform(platform).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AppVersionAPI.ListVersionsApiV1AppVersionListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListVersionsApiV1AppVersionListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AppVersionAPI.ListVersionsApiV1AppVersionListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListVersionsApiV1AppVersionListGet_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform** | **string** |  | 
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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


## UpdateVersionApiV1AppVersionVidPut

> interface{} UpdateVersionApiV1AppVersionVidPut(ctx, vid).Title(title).Content(content).Status(status).IsForce(isForce).DownloadUrl(downloadUrl).GrayRatio(grayRatio).Execute()

修改版本

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
	vid := int32(56) // int32 | 
	title := "title_example" // string |  (optional)
	content := "content_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)
	isForce := true // bool |  (optional)
	downloadUrl := "downloadUrl_example" // string |  (optional)
	grayRatio := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AppVersionAPI.UpdateVersionApiV1AppVersionVidPut(context.Background(), vid).Title(title).Content(content).Status(status).IsForce(isForce).DownloadUrl(downloadUrl).GrayRatio(grayRatio).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AppVersionAPI.UpdateVersionApiV1AppVersionVidPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateVersionApiV1AppVersionVidPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AppVersionAPI.UpdateVersionApiV1AppVersionVidPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**vid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateVersionApiV1AppVersionVidPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **title** | **string** |  | 
 **content** | **string** |  | 
 **status** | **int32** |  | 
 **isForce** | **bool** |  | 
 **downloadUrl** | **string** |  | 
 **grayRatio** | **int32** |  | 

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


## UpdateVersionApiV1AppVersionVidPut_0

> interface{} UpdateVersionApiV1AppVersionVidPut_0(ctx, vid).Title(title).Content(content).Status(status).IsForce(isForce).DownloadUrl(downloadUrl).GrayRatio(grayRatio).Execute()

修改版本

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
	vid := int32(56) // int32 | 
	title := "title_example" // string |  (optional)
	content := "content_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)
	isForce := true // bool |  (optional)
	downloadUrl := "downloadUrl_example" // string |  (optional)
	grayRatio := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AppVersionAPI.UpdateVersionApiV1AppVersionVidPut_0(context.Background(), vid).Title(title).Content(content).Status(status).IsForce(isForce).DownloadUrl(downloadUrl).GrayRatio(grayRatio).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AppVersionAPI.UpdateVersionApiV1AppVersionVidPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateVersionApiV1AppVersionVidPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AppVersionAPI.UpdateVersionApiV1AppVersionVidPut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**vid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateVersionApiV1AppVersionVidPut_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **title** | **string** |  | 
 **content** | **string** |  | 
 **status** | **int32** |  | 
 **isForce** | **bool** |  | 
 **downloadUrl** | **string** |  | 
 **grayRatio** | **int32** |  | 

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

