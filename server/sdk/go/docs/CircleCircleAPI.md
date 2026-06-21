# \CircleCircleAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CircleCategoryList**](CircleCircleAPI.md#CircleCategoryList) | **Get** /api/v1/circle/category/list | 圈子分类列表
[**CreateCircleApiV1CirclePost**](CircleCircleAPI.md#CreateCircleApiV1CirclePost) | **Post** /api/v1/circle | 创建圈子
[**DeleteCircleApiV1CircleCidDelete**](CircleCircleAPI.md#DeleteCircleApiV1CircleCidDelete) | **Delete** /api/v1/circle/{cid} | 删除圈子
[**GetCircleApiV1CircleCidGet**](CircleCircleAPI.md#GetCircleApiV1CircleCidGet) | **Get** /api/v1/circle/{cid} | 圈子详情
[**JoinCircleApiV1CircleCidJoinPost**](CircleCircleAPI.md#JoinCircleApiV1CircleCidJoinPost) | **Post** /api/v1/circle/{cid}/join | 加入圈子
[**ListCirclesApiV1CircleListGet**](CircleCircleAPI.md#ListCirclesApiV1CircleListGet) | **Get** /api/v1/circle/list | 圈子列表
[**ListMembersApiV1CircleCidMembersGet**](CircleCircleAPI.md#ListMembersApiV1CircleCidMembersGet) | **Get** /api/v1/circle/{cid}/members | 成员列表
[**QuitCircleApiV1CircleCidQuitPost**](CircleCircleAPI.md#QuitCircleApiV1CircleCidQuitPost) | **Post** /api/v1/circle/{cid}/quit | 退出圈子
[**UpdateCircleApiV1CircleCidPut**](CircleCircleAPI.md#UpdateCircleApiV1CircleCidPut) | **Put** /api/v1/circle/{cid} | 修改圈子



## CircleCategoryList

> interface{} CircleCategoryList(ctx).Execute()

圈子分类列表

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
	resp, r, err := apiClient.CircleCircleAPI.CircleCategoryList(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleCircleAPI.CircleCategoryList``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CircleCategoryList`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleCircleAPI.CircleCategoryList`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCircleCategoryListRequest struct via the builder pattern


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


## CreateCircleApiV1CirclePost

> interface{} CreateCircleApiV1CirclePost(ctx).Name(name).Description(description).CategoryId(categoryId).Avatar(avatar).Cover(cover).Execute()

创建圈子

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
	description := "description_example" // string |  (optional)
	categoryId := int32(56) // int32 |  (optional)
	avatar := "avatar_example" // string |  (optional)
	cover := "cover_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CircleCircleAPI.CreateCircleApiV1CirclePost(context.Background()).Name(name).Description(description).CategoryId(categoryId).Avatar(avatar).Cover(cover).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleCircleAPI.CreateCircleApiV1CirclePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateCircleApiV1CirclePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleCircleAPI.CreateCircleApiV1CirclePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateCircleApiV1CirclePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **description** | **string** |  | 
 **categoryId** | **int32** |  | 
 **avatar** | **string** |  | 
 **cover** | **string** |  | 

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


## DeleteCircleApiV1CircleCidDelete

> interface{} DeleteCircleApiV1CircleCidDelete(ctx, cid).Execute()

删除圈子

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
	cid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CircleCircleAPI.DeleteCircleApiV1CircleCidDelete(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleCircleAPI.DeleteCircleApiV1CircleCidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteCircleApiV1CircleCidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleCircleAPI.DeleteCircleApiV1CircleCidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteCircleApiV1CircleCidDeleteRequest struct via the builder pattern


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


## GetCircleApiV1CircleCidGet

> interface{} GetCircleApiV1CircleCidGet(ctx, cid).Execute()

圈子详情

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
	cid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CircleCircleAPI.GetCircleApiV1CircleCidGet(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleCircleAPI.GetCircleApiV1CircleCidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetCircleApiV1CircleCidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleCircleAPI.GetCircleApiV1CircleCidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetCircleApiV1CircleCidGetRequest struct via the builder pattern


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


## JoinCircleApiV1CircleCidJoinPost

> interface{} JoinCircleApiV1CircleCidJoinPost(ctx, cid).Execute()

加入圈子

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
	cid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CircleCircleAPI.JoinCircleApiV1CircleCidJoinPost(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleCircleAPI.JoinCircleApiV1CircleCidJoinPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `JoinCircleApiV1CircleCidJoinPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleCircleAPI.JoinCircleApiV1CircleCidJoinPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiJoinCircleApiV1CircleCidJoinPostRequest struct via the builder pattern


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


## ListCirclesApiV1CircleListGet

> interface{} ListCirclesApiV1CircleListGet(ctx).Page(page).Limit(limit).CategoryId(categoryId).Keyword(keyword).IsOfficial(isOfficial).Execute()

圈子列表

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
	categoryId := int32(56) // int32 |  (optional)
	keyword := "keyword_example" // string |  (optional)
	isOfficial := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CircleCircleAPI.ListCirclesApiV1CircleListGet(context.Background()).Page(page).Limit(limit).CategoryId(categoryId).Keyword(keyword).IsOfficial(isOfficial).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleCircleAPI.ListCirclesApiV1CircleListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListCirclesApiV1CircleListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleCircleAPI.ListCirclesApiV1CircleListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListCirclesApiV1CircleListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **categoryId** | **int32** |  | 
 **keyword** | **string** |  | 
 **isOfficial** | **bool** |  | 

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


## ListMembersApiV1CircleCidMembersGet

> interface{} ListMembersApiV1CircleCidMembersGet(ctx, cid).Page(page).Limit(limit).Execute()

成员列表

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
	cid := int32(56) // int32 | 
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CircleCircleAPI.ListMembersApiV1CircleCidMembersGet(context.Background(), cid).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleCircleAPI.ListMembersApiV1CircleCidMembersGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListMembersApiV1CircleCidMembersGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleCircleAPI.ListMembersApiV1CircleCidMembersGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiListMembersApiV1CircleCidMembersGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

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


## QuitCircleApiV1CircleCidQuitPost

> interface{} QuitCircleApiV1CircleCidQuitPost(ctx, cid).Execute()

退出圈子

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
	cid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CircleCircleAPI.QuitCircleApiV1CircleCidQuitPost(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleCircleAPI.QuitCircleApiV1CircleCidQuitPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `QuitCircleApiV1CircleCidQuitPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleCircleAPI.QuitCircleApiV1CircleCidQuitPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiQuitCircleApiV1CircleCidQuitPostRequest struct via the builder pattern


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


## UpdateCircleApiV1CircleCidPut

> interface{} UpdateCircleApiV1CircleCidPut(ctx, cid).Name(name).Description(description).Avatar(avatar).Cover(cover).Execute()

修改圈子

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
	cid := int32(56) // int32 | 
	name := "name_example" // string |  (optional)
	description := "description_example" // string |  (optional)
	avatar := "avatar_example" // string |  (optional)
	cover := "cover_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CircleCircleAPI.UpdateCircleApiV1CircleCidPut(context.Background(), cid).Name(name).Description(description).Avatar(avatar).Cover(cover).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CircleCircleAPI.UpdateCircleApiV1CircleCidPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateCircleApiV1CircleCidPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CircleCircleAPI.UpdateCircleApiV1CircleCidPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateCircleApiV1CircleCidPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **name** | **string** |  | 
 **description** | **string** |  | 
 **avatar** | **string** |  | 
 **cover** | **string** |  | 

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

