# \AskCategoryAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddCategoryApiV1AskCategoryPost**](AskCategoryAPI.md#AddCategoryApiV1AskCategoryPost) | **Post** /api/v1/ask/category | 添加分类
[**AskCategoryAdminList**](AskCategoryAPI.md#AskCategoryAdminList) | **Get** /api/v1/ask/category/admin/list | 分类列表(管理员)
[**ChangeShowApiV1AskCategoryIsShowPut**](AskCategoryAPI.md#ChangeShowApiV1AskCategoryIsShowPut) | **Put** /api/v1/ask/category/is-show | 修改显示状态
[**ChangeShowIndexApiV1AskCategoryIsShowIndexPut**](AskCategoryAPI.md#ChangeShowIndexApiV1AskCategoryIsShowIndexPut) | **Put** /api/v1/ask/category/is-show-index | 修改首页显示状态
[**DeleteCategoryApiV1AskCategoryCatIdDelete**](AskCategoryAPI.md#DeleteCategoryApiV1AskCategoryCatIdDelete) | **Delete** /api/v1/ask/category/{cat_id} | 删除分类
[**GetCategoryApiV1AskCategoryCatIdGet**](AskCategoryAPI.md#GetCategoryApiV1AskCategoryCatIdGet) | **Get** /api/v1/ask/category/{cat_id} | 分类详情
[**PublicListApiV1AskCategoryPublicApiListGet**](AskCategoryAPI.md#PublicListApiV1AskCategoryPublicApiListGet) | **Get** /api/v1/ask/category/public-api/list | 分类列表(公开)
[**UpdateCategoryApiV1AskCategoryPut**](AskCategoryAPI.md#UpdateCategoryApiV1AskCategoryPut) | **Put** /api/v1/ask/category | 修改分类



## AddCategoryApiV1AskCategoryPost

> interface{} AddCategoryApiV1AskCategoryPost(ctx).CategoryCreate(categoryCreate).Execute()

添加分类

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
	categoryCreate := *openapiclient.NewCategoryCreate("Name_example") // CategoryCreate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskCategoryAPI.AddCategoryApiV1AskCategoryPost(context.Background()).CategoryCreate(categoryCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskCategoryAPI.AddCategoryApiV1AskCategoryPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddCategoryApiV1AskCategoryPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskCategoryAPI.AddCategoryApiV1AskCategoryPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAddCategoryApiV1AskCategoryPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **categoryCreate** | [**CategoryCreate**](CategoryCreate.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## AskCategoryAdminList

> interface{} AskCategoryAdminList(ctx).IsShow(isShow).IsShowIndex(isShowIndex).Execute()

分类列表(管理员)

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
	isShow := true // bool |  (optional)
	isShowIndex := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskCategoryAPI.AskCategoryAdminList(context.Background()).IsShow(isShow).IsShowIndex(isShowIndex).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskCategoryAPI.AskCategoryAdminList``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AskCategoryAdminList`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskCategoryAPI.AskCategoryAdminList`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAskCategoryAdminListRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **isShow** | **bool** |  | 
 **isShowIndex** | **bool** |  | 

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


## ChangeShowApiV1AskCategoryIsShowPut

> interface{} ChangeShowApiV1AskCategoryIsShowPut(ctx).Id(id).IsShow(isShow).Execute()

修改显示状态

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
	id := int32(56) // int32 | 
	isShow := true // bool | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskCategoryAPI.ChangeShowApiV1AskCategoryIsShowPut(context.Background()).Id(id).IsShow(isShow).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskCategoryAPI.ChangeShowApiV1AskCategoryIsShowPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ChangeShowApiV1AskCategoryIsShowPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskCategoryAPI.ChangeShowApiV1AskCategoryIsShowPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiChangeShowApiV1AskCategoryIsShowPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **int32** |  | 
 **isShow** | **bool** |  | 

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


## ChangeShowIndexApiV1AskCategoryIsShowIndexPut

> interface{} ChangeShowIndexApiV1AskCategoryIsShowIndexPut(ctx).Id(id).IsShowIndex(isShowIndex).Execute()

修改首页显示状态

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
	id := int32(56) // int32 | 
	isShowIndex := true // bool | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskCategoryAPI.ChangeShowIndexApiV1AskCategoryIsShowIndexPut(context.Background()).Id(id).IsShowIndex(isShowIndex).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskCategoryAPI.ChangeShowIndexApiV1AskCategoryIsShowIndexPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ChangeShowIndexApiV1AskCategoryIsShowIndexPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskCategoryAPI.ChangeShowIndexApiV1AskCategoryIsShowIndexPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiChangeShowIndexApiV1AskCategoryIsShowIndexPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **int32** |  | 
 **isShowIndex** | **bool** |  | 

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


## DeleteCategoryApiV1AskCategoryCatIdDelete

> interface{} DeleteCategoryApiV1AskCategoryCatIdDelete(ctx, catId).Execute()

删除分类

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
	catId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskCategoryAPI.DeleteCategoryApiV1AskCategoryCatIdDelete(context.Background(), catId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskCategoryAPI.DeleteCategoryApiV1AskCategoryCatIdDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteCategoryApiV1AskCategoryCatIdDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskCategoryAPI.DeleteCategoryApiV1AskCategoryCatIdDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**catId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteCategoryApiV1AskCategoryCatIdDeleteRequest struct via the builder pattern


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


## GetCategoryApiV1AskCategoryCatIdGet

> interface{} GetCategoryApiV1AskCategoryCatIdGet(ctx, catId).Execute()

分类详情

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
	catId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskCategoryAPI.GetCategoryApiV1AskCategoryCatIdGet(context.Background(), catId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskCategoryAPI.GetCategoryApiV1AskCategoryCatIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetCategoryApiV1AskCategoryCatIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskCategoryAPI.GetCategoryApiV1AskCategoryCatIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**catId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetCategoryApiV1AskCategoryCatIdGetRequest struct via the builder pattern


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


## PublicListApiV1AskCategoryPublicApiListGet

> interface{} PublicListApiV1AskCategoryPublicApiListGet(ctx).IsShow(isShow).IsShowIndex(isShowIndex).Execute()

分类列表(公开)

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
	isShow := true // bool |  (optional)
	isShowIndex := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskCategoryAPI.PublicListApiV1AskCategoryPublicApiListGet(context.Background()).IsShow(isShow).IsShowIndex(isShowIndex).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskCategoryAPI.PublicListApiV1AskCategoryPublicApiListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PublicListApiV1AskCategoryPublicApiListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskCategoryAPI.PublicListApiV1AskCategoryPublicApiListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPublicListApiV1AskCategoryPublicApiListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **isShow** | **bool** |  | 
 **isShowIndex** | **bool** |  | 

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


## UpdateCategoryApiV1AskCategoryPut

> interface{} UpdateCategoryApiV1AskCategoryPut(ctx).CategoryUpdate(categoryUpdate).Execute()

修改分类

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
	categoryUpdate := *openapiclient.NewCategoryUpdate(int32(123)) // CategoryUpdate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AskCategoryAPI.UpdateCategoryApiV1AskCategoryPut(context.Background()).CategoryUpdate(categoryUpdate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AskCategoryAPI.UpdateCategoryApiV1AskCategoryPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateCategoryApiV1AskCategoryPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AskCategoryAPI.UpdateCategoryApiV1AskCategoryPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateCategoryApiV1AskCategoryPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **categoryUpdate** | [**CategoryUpdate**](CategoryUpdate.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

