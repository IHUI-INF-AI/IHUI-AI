# \ToolsAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ListCategoriesApiV1ToolsCategoriesGet**](ToolsAPI.md#ListCategoriesApiV1ToolsCategoriesGet) | **Get** /api/v1/tools/categories | 获取工具分类列表
[**ListToolsApiV1ToolsListGet**](ToolsAPI.md#ListToolsApiV1ToolsListGet) | **Get** /api/v1/tools/list | 获取工具列表
[**UploadFileApiV1ToolsUploadPost**](ToolsAPI.md#UploadFileApiV1ToolsUploadPost) | **Post** /api/v1/tools/upload | Upload file to MinIO



## ListCategoriesApiV1ToolsCategoriesGet

> interface{} ListCategoriesApiV1ToolsCategoriesGet(ctx).Execute()

获取工具分类列表



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
	resp, r, err := apiClient.ToolsAPI.ListCategoriesApiV1ToolsCategoriesGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolsAPI.ListCategoriesApiV1ToolsCategoriesGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListCategoriesApiV1ToolsCategoriesGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ToolsAPI.ListCategoriesApiV1ToolsCategoriesGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListCategoriesApiV1ToolsCategoriesGetRequest struct via the builder pattern


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


## ListToolsApiV1ToolsListGet

> interface{} ListToolsApiV1ToolsListGet(ctx).Category(category).Keyword(keyword).Sort(sort).Execute()

获取工具列表



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
	category := "category_example" // string | 分类过滤 (optional)
	keyword := "keyword_example" // string | 搜索关键词 (optional)
	sort := "sort_example" // string | 排序: default/name/hot (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolsAPI.ListToolsApiV1ToolsListGet(context.Background()).Category(category).Keyword(keyword).Sort(sort).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolsAPI.ListToolsApiV1ToolsListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListToolsApiV1ToolsListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ToolsAPI.ListToolsApiV1ToolsListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListToolsApiV1ToolsListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **category** | **string** | 分类过滤 | 
 **keyword** | **string** | 搜索关键词 | 
 **sort** | **string** | 排序: default/name/hot | 

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


## UploadFileApiV1ToolsUploadPost

> interface{} UploadFileApiV1ToolsUploadPost(ctx).File(file).Execute()

Upload file to MinIO

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
	file := os.NewFile(1234, "some_file") // *os.File | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolsAPI.UploadFileApiV1ToolsUploadPost(context.Background()).File(file).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolsAPI.UploadFileApiV1ToolsUploadPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UploadFileApiV1ToolsUploadPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ToolsAPI.UploadFileApiV1ToolsUploadPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUploadFileApiV1ToolsUploadPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file** | ***os.File** |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

