# \ContentInformationAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateInformationApiV1ContentInformationCreatePost**](ContentInformationAPI.md#CreateInformationApiV1ContentInformationCreatePost) | **Post** /api/v1/content/information/create | 创建资讯
[**ListDictionaryApiV1ContentInformationDictionaryGet**](ContentInformationAPI.md#ListDictionaryApiV1ContentInformationDictionaryGet) | **Get** /api/v1/content/information/dictionary | 资讯分类字典
[**ListInformationApiV1ContentInformationListGet**](ContentInformationAPI.md#ListInformationApiV1ContentInformationListGet) | **Get** /api/v1/content/information/list | 资讯列表



## CreateInformationApiV1ContentInformationCreatePost

> interface{} CreateInformationApiV1ContentInformationCreatePost(ctx).Title(title).Content(content).Type_(type_).Sort(sort).Execute()

创建资讯



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
	title := "title_example" // string | 
	content := "content_example" // string |  (optional) (default to "")
	type_ := int32(56) // int32 | 资讯分类 type (optional)
	sort := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentInformationAPI.CreateInformationApiV1ContentInformationCreatePost(context.Background()).Title(title).Content(content).Type_(type_).Sort(sort).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentInformationAPI.CreateInformationApiV1ContentInformationCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateInformationApiV1ContentInformationCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentInformationAPI.CreateInformationApiV1ContentInformationCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateInformationApiV1ContentInformationCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **content** | **string** |  | [default to &quot;&quot;]
 **type_** | **int32** | 资讯分类 type | 
 **sort** | **int32** |  | [default to 0]

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


## ListDictionaryApiV1ContentInformationDictionaryGet

> interface{} ListDictionaryApiV1ContentInformationDictionaryGet(ctx).Type_(type_).Execute()

资讯分类字典



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
	type_ := "type__example" // string | 字典类型筛选 (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentInformationAPI.ListDictionaryApiV1ContentInformationDictionaryGet(context.Background()).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentInformationAPI.ListDictionaryApiV1ContentInformationDictionaryGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDictionaryApiV1ContentInformationDictionaryGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentInformationAPI.ListDictionaryApiV1ContentInformationDictionaryGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDictionaryApiV1ContentInformationDictionaryGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type_** | **string** | 字典类型筛选 | 

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


## ListInformationApiV1ContentInformationListGet

> interface{} ListInformationApiV1ContentInformationListGet(ctx).Page(page).Limit(limit).Type_(type_).Status(status).Execute()

资讯列表



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
	type_ := int32(56) // int32 | 按分类筛选 (optional)
	status := int32(56) // int32 | 筛选状态: 0=禁用 1=启用 (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentInformationAPI.ListInformationApiV1ContentInformationListGet(context.Background()).Page(page).Limit(limit).Type_(type_).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentInformationAPI.ListInformationApiV1ContentInformationListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListInformationApiV1ContentInformationListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentInformationAPI.ListInformationApiV1ContentInformationListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListInformationApiV1ContentInformationListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **type_** | **int32** | 按分类筛选 | 
 **status** | **int32** | 筛选状态: 0&#x3D;禁用 1&#x3D;启用 | 

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

