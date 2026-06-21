# \AdvertiseAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateAdvertiseApiV1AdvertisePost**](AdvertiseAPI.md#CreateAdvertiseApiV1AdvertisePost) | **Post** /api/v1/advertise | 新增广告
[**CreateAdvertiseApiV1AdvertisePost_0**](AdvertiseAPI.md#CreateAdvertiseApiV1AdvertisePost_0) | **Post** /api/v1/advertise | 新增广告
[**CreatePositionApiV1AdvertisePositionPost**](AdvertiseAPI.md#CreatePositionApiV1AdvertisePositionPost) | **Post** /api/v1/advertise/position | 新增广告位
[**CreatePositionApiV1AdvertisePositionPost_0**](AdvertiseAPI.md#CreatePositionApiV1AdvertisePositionPost_0) | **Post** /api/v1/advertise/position | 新增广告位
[**DeleteAdvertiseApiV1AdvertiseAidDelete**](AdvertiseAPI.md#DeleteAdvertiseApiV1AdvertiseAidDelete) | **Delete** /api/v1/advertise/{aid} | 删除广告
[**DeleteAdvertiseApiV1AdvertiseAidDelete_0**](AdvertiseAPI.md#DeleteAdvertiseApiV1AdvertiseAidDelete_0) | **Delete** /api/v1/advertise/{aid} | 删除广告
[**GetAdvertiseApiV1AdvertiseAidGet**](AdvertiseAPI.md#GetAdvertiseApiV1AdvertiseAidGet) | **Get** /api/v1/advertise/{aid} | 广告详情
[**GetAdvertiseApiV1AdvertiseAidGet_0**](AdvertiseAPI.md#GetAdvertiseApiV1AdvertiseAidGet_0) | **Get** /api/v1/advertise/{aid} | 广告详情
[**ListAdvertisesApiV1AdvertiseListGet**](AdvertiseAPI.md#ListAdvertisesApiV1AdvertiseListGet) | **Get** /api/v1/advertise/list | 广告列表
[**ListAdvertisesApiV1AdvertiseListGet_0**](AdvertiseAPI.md#ListAdvertisesApiV1AdvertiseListGet_0) | **Get** /api/v1/advertise/list | 广告列表
[**PositionListApiV1AdvertisePositionListGet**](AdvertiseAPI.md#PositionListApiV1AdvertisePositionListGet) | **Get** /api/v1/advertise/position/list | 广告位列表
[**PositionListApiV1AdvertisePositionListGet_0**](AdvertiseAPI.md#PositionListApiV1AdvertisePositionListGet_0) | **Get** /api/v1/advertise/position/list | 广告位列表
[**RecordClickApiV1AdvertiseAidClickPost**](AdvertiseAPI.md#RecordClickApiV1AdvertiseAidClickPost) | **Post** /api/v1/advertise/{aid}/click | 记录广告点击
[**RecordClickApiV1AdvertiseAidClickPost_0**](AdvertiseAPI.md#RecordClickApiV1AdvertiseAidClickPost_0) | **Post** /api/v1/advertise/{aid}/click | 记录广告点击
[**UpdateAdvertiseApiV1AdvertiseAidPut**](AdvertiseAPI.md#UpdateAdvertiseApiV1AdvertiseAidPut) | **Put** /api/v1/advertise/{aid} | 修改广告
[**UpdateAdvertiseApiV1AdvertiseAidPut_0**](AdvertiseAPI.md#UpdateAdvertiseApiV1AdvertiseAidPut_0) | **Put** /api/v1/advertise/{aid} | 修改广告



## CreateAdvertiseApiV1AdvertisePost

> interface{} CreateAdvertiseApiV1AdvertisePost(ctx).Title(title).PositionId(positionId).Image(image).Url(url).Type_(type_).Content(content).StartTime(startTime).EndTime(endTime).SortOrder(sortOrder).TargetUser(targetUser).Execute()

新增广告

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
    "time"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	title := "title_example" // string | 
	positionId := int32(56) // int32 | 
	image := "image_example" // string |  (optional)
	url := "url_example" // string |  (optional)
	type_ := "type__example" // string |  (optional) (default to "image")
	content := "content_example" // string |  (optional)
	startTime := time.Now() // time.Time |  (optional)
	endTime := time.Now() // time.Time |  (optional)
	sortOrder := int32(56) // int32 |  (optional) (default to 0)
	targetUser := "targetUser_example" // string |  (optional) (default to "all")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AdvertiseAPI.CreateAdvertiseApiV1AdvertisePost(context.Background()).Title(title).PositionId(positionId).Image(image).Url(url).Type_(type_).Content(content).StartTime(startTime).EndTime(endTime).SortOrder(sortOrder).TargetUser(targetUser).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AdvertiseAPI.CreateAdvertiseApiV1AdvertisePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateAdvertiseApiV1AdvertisePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AdvertiseAPI.CreateAdvertiseApiV1AdvertisePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateAdvertiseApiV1AdvertisePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **positionId** | **int32** |  | 
 **image** | **string** |  | 
 **url** | **string** |  | 
 **type_** | **string** |  | [default to &quot;image&quot;]
 **content** | **string** |  | 
 **startTime** | **time.Time** |  | 
 **endTime** | **time.Time** |  | 
 **sortOrder** | **int32** |  | [default to 0]
 **targetUser** | **string** |  | [default to &quot;all&quot;]

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


## CreateAdvertiseApiV1AdvertisePost_0

> interface{} CreateAdvertiseApiV1AdvertisePost_0(ctx).Title(title).PositionId(positionId).Image(image).Url(url).Type_(type_).Content(content).StartTime(startTime).EndTime(endTime).SortOrder(sortOrder).TargetUser(targetUser).Execute()

新增广告

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
    "time"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	title := "title_example" // string | 
	positionId := int32(56) // int32 | 
	image := "image_example" // string |  (optional)
	url := "url_example" // string |  (optional)
	type_ := "type__example" // string |  (optional) (default to "image")
	content := "content_example" // string |  (optional)
	startTime := time.Now() // time.Time |  (optional)
	endTime := time.Now() // time.Time |  (optional)
	sortOrder := int32(56) // int32 |  (optional) (default to 0)
	targetUser := "targetUser_example" // string |  (optional) (default to "all")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AdvertiseAPI.CreateAdvertiseApiV1AdvertisePost_0(context.Background()).Title(title).PositionId(positionId).Image(image).Url(url).Type_(type_).Content(content).StartTime(startTime).EndTime(endTime).SortOrder(sortOrder).TargetUser(targetUser).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AdvertiseAPI.CreateAdvertiseApiV1AdvertisePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateAdvertiseApiV1AdvertisePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AdvertiseAPI.CreateAdvertiseApiV1AdvertisePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateAdvertiseApiV1AdvertisePost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **positionId** | **int32** |  | 
 **image** | **string** |  | 
 **url** | **string** |  | 
 **type_** | **string** |  | [default to &quot;image&quot;]
 **content** | **string** |  | 
 **startTime** | **time.Time** |  | 
 **endTime** | **time.Time** |  | 
 **sortOrder** | **int32** |  | [default to 0]
 **targetUser** | **string** |  | [default to &quot;all&quot;]

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


## CreatePositionApiV1AdvertisePositionPost

> interface{} CreatePositionApiV1AdvertisePositionPost(ctx).Name(name).Code(code).Description(description).Width(width).Height(height).Execute()

新增广告位

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
	description := "description_example" // string |  (optional)
	width := int32(56) // int32 |  (optional) (default to 0)
	height := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AdvertiseAPI.CreatePositionApiV1AdvertisePositionPost(context.Background()).Name(name).Code(code).Description(description).Width(width).Height(height).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AdvertiseAPI.CreatePositionApiV1AdvertisePositionPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreatePositionApiV1AdvertisePositionPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AdvertiseAPI.CreatePositionApiV1AdvertisePositionPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreatePositionApiV1AdvertisePositionPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **code** | **string** |  | 
 **description** | **string** |  | 
 **width** | **int32** |  | [default to 0]
 **height** | **int32** |  | [default to 0]

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


## CreatePositionApiV1AdvertisePositionPost_0

> interface{} CreatePositionApiV1AdvertisePositionPost_0(ctx).Name(name).Code(code).Description(description).Width(width).Height(height).Execute()

新增广告位

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
	description := "description_example" // string |  (optional)
	width := int32(56) // int32 |  (optional) (default to 0)
	height := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AdvertiseAPI.CreatePositionApiV1AdvertisePositionPost_0(context.Background()).Name(name).Code(code).Description(description).Width(width).Height(height).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AdvertiseAPI.CreatePositionApiV1AdvertisePositionPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreatePositionApiV1AdvertisePositionPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AdvertiseAPI.CreatePositionApiV1AdvertisePositionPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreatePositionApiV1AdvertisePositionPost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **code** | **string** |  | 
 **description** | **string** |  | 
 **width** | **int32** |  | [default to 0]
 **height** | **int32** |  | [default to 0]

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


## DeleteAdvertiseApiV1AdvertiseAidDelete

> interface{} DeleteAdvertiseApiV1AdvertiseAidDelete(ctx, aid).Execute()

删除广告

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
	aid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AdvertiseAPI.DeleteAdvertiseApiV1AdvertiseAidDelete(context.Background(), aid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AdvertiseAPI.DeleteAdvertiseApiV1AdvertiseAidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteAdvertiseApiV1AdvertiseAidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AdvertiseAPI.DeleteAdvertiseApiV1AdvertiseAidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteAdvertiseApiV1AdvertiseAidDeleteRequest struct via the builder pattern


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


## DeleteAdvertiseApiV1AdvertiseAidDelete_0

> interface{} DeleteAdvertiseApiV1AdvertiseAidDelete_0(ctx, aid).Execute()

删除广告

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
	aid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AdvertiseAPI.DeleteAdvertiseApiV1AdvertiseAidDelete_0(context.Background(), aid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AdvertiseAPI.DeleteAdvertiseApiV1AdvertiseAidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteAdvertiseApiV1AdvertiseAidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AdvertiseAPI.DeleteAdvertiseApiV1AdvertiseAidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteAdvertiseApiV1AdvertiseAidDelete_3Request struct via the builder pattern


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


## GetAdvertiseApiV1AdvertiseAidGet

> interface{} GetAdvertiseApiV1AdvertiseAidGet(ctx, aid).Execute()

广告详情

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
	aid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AdvertiseAPI.GetAdvertiseApiV1AdvertiseAidGet(context.Background(), aid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AdvertiseAPI.GetAdvertiseApiV1AdvertiseAidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetAdvertiseApiV1AdvertiseAidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AdvertiseAPI.GetAdvertiseApiV1AdvertiseAidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetAdvertiseApiV1AdvertiseAidGetRequest struct via the builder pattern


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


## GetAdvertiseApiV1AdvertiseAidGet_0

> interface{} GetAdvertiseApiV1AdvertiseAidGet_0(ctx, aid).Execute()

广告详情

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
	aid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AdvertiseAPI.GetAdvertiseApiV1AdvertiseAidGet_0(context.Background(), aid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AdvertiseAPI.GetAdvertiseApiV1AdvertiseAidGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetAdvertiseApiV1AdvertiseAidGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AdvertiseAPI.GetAdvertiseApiV1AdvertiseAidGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetAdvertiseApiV1AdvertiseAidGet_4Request struct via the builder pattern


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


## ListAdvertisesApiV1AdvertiseListGet

> interface{} ListAdvertisesApiV1AdvertiseListGet(ctx).PositionId(positionId).Status(status).Page(page).Limit(limit).Execute()

广告列表

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
	positionId := int32(56) // int32 |  (optional)
	status := int32(56) // int32 |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AdvertiseAPI.ListAdvertisesApiV1AdvertiseListGet(context.Background()).PositionId(positionId).Status(status).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AdvertiseAPI.ListAdvertisesApiV1AdvertiseListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListAdvertisesApiV1AdvertiseListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AdvertiseAPI.ListAdvertisesApiV1AdvertiseListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListAdvertisesApiV1AdvertiseListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **positionId** | **int32** |  | 
 **status** | **int32** |  | 
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


## ListAdvertisesApiV1AdvertiseListGet_0

> interface{} ListAdvertisesApiV1AdvertiseListGet_0(ctx).PositionId(positionId).Status(status).Page(page).Limit(limit).Execute()

广告列表

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
	positionId := int32(56) // int32 |  (optional)
	status := int32(56) // int32 |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AdvertiseAPI.ListAdvertisesApiV1AdvertiseListGet_0(context.Background()).PositionId(positionId).Status(status).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AdvertiseAPI.ListAdvertisesApiV1AdvertiseListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListAdvertisesApiV1AdvertiseListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AdvertiseAPI.ListAdvertisesApiV1AdvertiseListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListAdvertisesApiV1AdvertiseListGet_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **positionId** | **int32** |  | 
 **status** | **int32** |  | 
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


## PositionListApiV1AdvertisePositionListGet

> interface{} PositionListApiV1AdvertisePositionListGet(ctx).Execute()

广告位列表

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
	resp, r, err := apiClient.AdvertiseAPI.PositionListApiV1AdvertisePositionListGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AdvertiseAPI.PositionListApiV1AdvertisePositionListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PositionListApiV1AdvertisePositionListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AdvertiseAPI.PositionListApiV1AdvertisePositionListGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiPositionListApiV1AdvertisePositionListGetRequest struct via the builder pattern


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


## PositionListApiV1AdvertisePositionListGet_0

> interface{} PositionListApiV1AdvertisePositionListGet_0(ctx).Execute()

广告位列表

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
	resp, r, err := apiClient.AdvertiseAPI.PositionListApiV1AdvertisePositionListGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AdvertiseAPI.PositionListApiV1AdvertisePositionListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PositionListApiV1AdvertisePositionListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AdvertiseAPI.PositionListApiV1AdvertisePositionListGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiPositionListApiV1AdvertisePositionListGet_6Request struct via the builder pattern


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


## RecordClickApiV1AdvertiseAidClickPost

> interface{} RecordClickApiV1AdvertiseAidClickPost(ctx, aid).Execute()

记录广告点击

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
	aid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AdvertiseAPI.RecordClickApiV1AdvertiseAidClickPost(context.Background(), aid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AdvertiseAPI.RecordClickApiV1AdvertiseAidClickPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RecordClickApiV1AdvertiseAidClickPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AdvertiseAPI.RecordClickApiV1AdvertiseAidClickPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiRecordClickApiV1AdvertiseAidClickPostRequest struct via the builder pattern


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


## RecordClickApiV1AdvertiseAidClickPost_0

> interface{} RecordClickApiV1AdvertiseAidClickPost_0(ctx, aid).Execute()

记录广告点击

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
	aid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AdvertiseAPI.RecordClickApiV1AdvertiseAidClickPost_0(context.Background(), aid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AdvertiseAPI.RecordClickApiV1AdvertiseAidClickPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RecordClickApiV1AdvertiseAidClickPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AdvertiseAPI.RecordClickApiV1AdvertiseAidClickPost_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiRecordClickApiV1AdvertiseAidClickPost_7Request struct via the builder pattern


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


## UpdateAdvertiseApiV1AdvertiseAidPut

> interface{} UpdateAdvertiseApiV1AdvertiseAidPut(ctx, aid).Title(title).Image(image).Url(url).Status(status).SortOrder(sortOrder).Execute()

修改广告

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
	aid := int32(56) // int32 | 
	title := "title_example" // string |  (optional)
	image := "image_example" // string |  (optional)
	url := "url_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)
	sortOrder := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AdvertiseAPI.UpdateAdvertiseApiV1AdvertiseAidPut(context.Background(), aid).Title(title).Image(image).Url(url).Status(status).SortOrder(sortOrder).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AdvertiseAPI.UpdateAdvertiseApiV1AdvertiseAidPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateAdvertiseApiV1AdvertiseAidPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AdvertiseAPI.UpdateAdvertiseApiV1AdvertiseAidPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateAdvertiseApiV1AdvertiseAidPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **title** | **string** |  | 
 **image** | **string** |  | 
 **url** | **string** |  | 
 **status** | **int32** |  | 
 **sortOrder** | **int32** |  | 

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


## UpdateAdvertiseApiV1AdvertiseAidPut_0

> interface{} UpdateAdvertiseApiV1AdvertiseAidPut_0(ctx, aid).Title(title).Image(image).Url(url).Status(status).SortOrder(sortOrder).Execute()

修改广告

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
	aid := int32(56) // int32 | 
	title := "title_example" // string |  (optional)
	image := "image_example" // string |  (optional)
	url := "url_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)
	sortOrder := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AdvertiseAPI.UpdateAdvertiseApiV1AdvertiseAidPut_0(context.Background(), aid).Title(title).Image(image).Url(url).Status(status).SortOrder(sortOrder).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AdvertiseAPI.UpdateAdvertiseApiV1AdvertiseAidPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateAdvertiseApiV1AdvertiseAidPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AdvertiseAPI.UpdateAdvertiseApiV1AdvertiseAidPut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateAdvertiseApiV1AdvertiseAidPut_8Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **title** | **string** |  | 
 **image** | **string** |  | 
 **url** | **string** |  | 
 **status** | **int32** |  | 
 **sortOrder** | **int32** |  | 

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

