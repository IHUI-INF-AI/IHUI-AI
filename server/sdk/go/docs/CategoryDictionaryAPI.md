# \CategoryDictionaryAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateDictApiV1CategoryDictionaryPost**](CategoryDictionaryAPI.md#CreateDictApiV1CategoryDictionaryPost) | **Post** /api/v1/category-dictionary | 新增字典
[**CreateDictApiV1CategoryDictionaryPost_0**](CategoryDictionaryAPI.md#CreateDictApiV1CategoryDictionaryPost_0) | **Post** /api/v1/category-dictionary | 新增字典
[**DeleteDictApiV1CategoryDictionaryDidDelete**](CategoryDictionaryAPI.md#DeleteDictApiV1CategoryDictionaryDidDelete) | **Delete** /api/v1/category-dictionary/{did} | 删除字典
[**DeleteDictApiV1CategoryDictionaryDidDelete_0**](CategoryDictionaryAPI.md#DeleteDictApiV1CategoryDictionaryDidDelete_0) | **Delete** /api/v1/category-dictionary/{did} | 删除字典
[**DictTypesApiV1CategoryDictionaryTypeGet**](CategoryDictionaryAPI.md#DictTypesApiV1CategoryDictionaryTypeGet) | **Get** /api/v1/category-dictionary/type | 字典类型列表
[**DictTypesApiV1CategoryDictionaryTypeGet_0**](CategoryDictionaryAPI.md#DictTypesApiV1CategoryDictionaryTypeGet_0) | **Get** /api/v1/category-dictionary/type | 字典类型列表
[**GetDictApiV1CategoryDictionaryDidGet**](CategoryDictionaryAPI.md#GetDictApiV1CategoryDictionaryDidGet) | **Get** /api/v1/category-dictionary/{did} | 字典详情
[**GetDictApiV1CategoryDictionaryDidGet_0**](CategoryDictionaryAPI.md#GetDictApiV1CategoryDictionaryDidGet_0) | **Get** /api/v1/category-dictionary/{did} | 字典详情
[**ListDictApiV1CategoryDictionaryListGet**](CategoryDictionaryAPI.md#ListDictApiV1CategoryDictionaryListGet) | **Get** /api/v1/category-dictionary/list | 字典列表
[**ListDictApiV1CategoryDictionaryListGet_0**](CategoryDictionaryAPI.md#ListDictApiV1CategoryDictionaryListGet_0) | **Get** /api/v1/category-dictionary/list | 字典列表
[**UpdateDictApiV1CategoryDictionaryDidPut**](CategoryDictionaryAPI.md#UpdateDictApiV1CategoryDictionaryDidPut) | **Put** /api/v1/category-dictionary/{did} | 修改字典
[**UpdateDictApiV1CategoryDictionaryDidPut_0**](CategoryDictionaryAPI.md#UpdateDictApiV1CategoryDictionaryDidPut_0) | **Put** /api/v1/category-dictionary/{did} | 修改字典



## CreateDictApiV1CategoryDictionaryPost

> interface{} CreateDictApiV1CategoryDictionaryPost(ctx).DictType(dictType).Code(code).Label(label).Value(value).SortOrder(sortOrder).IsShow(isShow).Description(description).ParentId(parentId).Extra(extra).Execute()

新增字典

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
	dictType := "dictType_example" // string | 
	code := "code_example" // string | 
	label := "label_example" // string | 
	value := "value_example" // string |  (optional)
	sortOrder := int32(56) // int32 |  (optional) (default to 0)
	isShow := true // bool |  (optional) (default to true)
	description := "description_example" // string |  (optional)
	parentId := int32(56) // int32 |  (optional) (default to 0)
	extra := "extra_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CategoryDictionaryAPI.CreateDictApiV1CategoryDictionaryPost(context.Background()).DictType(dictType).Code(code).Label(label).Value(value).SortOrder(sortOrder).IsShow(isShow).Description(description).ParentId(parentId).Extra(extra).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CategoryDictionaryAPI.CreateDictApiV1CategoryDictionaryPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateDictApiV1CategoryDictionaryPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CategoryDictionaryAPI.CreateDictApiV1CategoryDictionaryPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateDictApiV1CategoryDictionaryPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dictType** | **string** |  | 
 **code** | **string** |  | 
 **label** | **string** |  | 
 **value** | **string** |  | 
 **sortOrder** | **int32** |  | [default to 0]
 **isShow** | **bool** |  | [default to true]
 **description** | **string** |  | 
 **parentId** | **int32** |  | [default to 0]
 **extra** | **string** |  | 

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


## CreateDictApiV1CategoryDictionaryPost_0

> interface{} CreateDictApiV1CategoryDictionaryPost_0(ctx).DictType(dictType).Code(code).Label(label).Value(value).SortOrder(sortOrder).IsShow(isShow).Description(description).ParentId(parentId).Extra(extra).Execute()

新增字典

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
	dictType := "dictType_example" // string | 
	code := "code_example" // string | 
	label := "label_example" // string | 
	value := "value_example" // string |  (optional)
	sortOrder := int32(56) // int32 |  (optional) (default to 0)
	isShow := true // bool |  (optional) (default to true)
	description := "description_example" // string |  (optional)
	parentId := int32(56) // int32 |  (optional) (default to 0)
	extra := "extra_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CategoryDictionaryAPI.CreateDictApiV1CategoryDictionaryPost_0(context.Background()).DictType(dictType).Code(code).Label(label).Value(value).SortOrder(sortOrder).IsShow(isShow).Description(description).ParentId(parentId).Extra(extra).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CategoryDictionaryAPI.CreateDictApiV1CategoryDictionaryPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateDictApiV1CategoryDictionaryPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CategoryDictionaryAPI.CreateDictApiV1CategoryDictionaryPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateDictApiV1CategoryDictionaryPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dictType** | **string** |  | 
 **code** | **string** |  | 
 **label** | **string** |  | 
 **value** | **string** |  | 
 **sortOrder** | **int32** |  | [default to 0]
 **isShow** | **bool** |  | [default to true]
 **description** | **string** |  | 
 **parentId** | **int32** |  | [default to 0]
 **extra** | **string** |  | 

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


## DeleteDictApiV1CategoryDictionaryDidDelete

> interface{} DeleteDictApiV1CategoryDictionaryDidDelete(ctx, did).Execute()

删除字典

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
	did := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CategoryDictionaryAPI.DeleteDictApiV1CategoryDictionaryDidDelete(context.Background(), did).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CategoryDictionaryAPI.DeleteDictApiV1CategoryDictionaryDidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteDictApiV1CategoryDictionaryDidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CategoryDictionaryAPI.DeleteDictApiV1CategoryDictionaryDidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**did** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteDictApiV1CategoryDictionaryDidDeleteRequest struct via the builder pattern


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


## DeleteDictApiV1CategoryDictionaryDidDelete_0

> interface{} DeleteDictApiV1CategoryDictionaryDidDelete_0(ctx, did).Execute()

删除字典

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
	did := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CategoryDictionaryAPI.DeleteDictApiV1CategoryDictionaryDidDelete_0(context.Background(), did).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CategoryDictionaryAPI.DeleteDictApiV1CategoryDictionaryDidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteDictApiV1CategoryDictionaryDidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CategoryDictionaryAPI.DeleteDictApiV1CategoryDictionaryDidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**did** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteDictApiV1CategoryDictionaryDidDelete_2Request struct via the builder pattern


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


## DictTypesApiV1CategoryDictionaryTypeGet

> interface{} DictTypesApiV1CategoryDictionaryTypeGet(ctx).Execute()

字典类型列表

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
	resp, r, err := apiClient.CategoryDictionaryAPI.DictTypesApiV1CategoryDictionaryTypeGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CategoryDictionaryAPI.DictTypesApiV1CategoryDictionaryTypeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DictTypesApiV1CategoryDictionaryTypeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CategoryDictionaryAPI.DictTypesApiV1CategoryDictionaryTypeGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiDictTypesApiV1CategoryDictionaryTypeGetRequest struct via the builder pattern


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


## DictTypesApiV1CategoryDictionaryTypeGet_0

> interface{} DictTypesApiV1CategoryDictionaryTypeGet_0(ctx).Execute()

字典类型列表

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
	resp, r, err := apiClient.CategoryDictionaryAPI.DictTypesApiV1CategoryDictionaryTypeGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CategoryDictionaryAPI.DictTypesApiV1CategoryDictionaryTypeGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DictTypesApiV1CategoryDictionaryTypeGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CategoryDictionaryAPI.DictTypesApiV1CategoryDictionaryTypeGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiDictTypesApiV1CategoryDictionaryTypeGet_3Request struct via the builder pattern


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


## GetDictApiV1CategoryDictionaryDidGet

> interface{} GetDictApiV1CategoryDictionaryDidGet(ctx, did).Execute()

字典详情

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
	did := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CategoryDictionaryAPI.GetDictApiV1CategoryDictionaryDidGet(context.Background(), did).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CategoryDictionaryAPI.GetDictApiV1CategoryDictionaryDidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetDictApiV1CategoryDictionaryDidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CategoryDictionaryAPI.GetDictApiV1CategoryDictionaryDidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**did** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetDictApiV1CategoryDictionaryDidGetRequest struct via the builder pattern


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


## GetDictApiV1CategoryDictionaryDidGet_0

> interface{} GetDictApiV1CategoryDictionaryDidGet_0(ctx, did).Execute()

字典详情

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
	did := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CategoryDictionaryAPI.GetDictApiV1CategoryDictionaryDidGet_0(context.Background(), did).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CategoryDictionaryAPI.GetDictApiV1CategoryDictionaryDidGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetDictApiV1CategoryDictionaryDidGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CategoryDictionaryAPI.GetDictApiV1CategoryDictionaryDidGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**did** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetDictApiV1CategoryDictionaryDidGet_4Request struct via the builder pattern


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


## ListDictApiV1CategoryDictionaryListGet

> interface{} ListDictApiV1CategoryDictionaryListGet(ctx).DictType(dictType).Page(page).Limit(limit).Execute()

字典列表

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
	dictType := "dictType_example" // string |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 100)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CategoryDictionaryAPI.ListDictApiV1CategoryDictionaryListGet(context.Background()).DictType(dictType).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CategoryDictionaryAPI.ListDictApiV1CategoryDictionaryListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDictApiV1CategoryDictionaryListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CategoryDictionaryAPI.ListDictApiV1CategoryDictionaryListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDictApiV1CategoryDictionaryListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dictType** | **string** |  | 
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 100]

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


## ListDictApiV1CategoryDictionaryListGet_0

> interface{} ListDictApiV1CategoryDictionaryListGet_0(ctx).DictType(dictType).Page(page).Limit(limit).Execute()

字典列表

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
	dictType := "dictType_example" // string |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 100)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CategoryDictionaryAPI.ListDictApiV1CategoryDictionaryListGet_0(context.Background()).DictType(dictType).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CategoryDictionaryAPI.ListDictApiV1CategoryDictionaryListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDictApiV1CategoryDictionaryListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CategoryDictionaryAPI.ListDictApiV1CategoryDictionaryListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDictApiV1CategoryDictionaryListGet_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dictType** | **string** |  | 
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 100]

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


## UpdateDictApiV1CategoryDictionaryDidPut

> interface{} UpdateDictApiV1CategoryDictionaryDidPut(ctx, did).Label(label).Value(value).SortOrder(sortOrder).IsShow(isShow).Description(description).Execute()

修改字典

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
	did := int32(56) // int32 | 
	label := "label_example" // string |  (optional)
	value := "value_example" // string |  (optional)
	sortOrder := int32(56) // int32 |  (optional)
	isShow := true // bool |  (optional)
	description := "description_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CategoryDictionaryAPI.UpdateDictApiV1CategoryDictionaryDidPut(context.Background(), did).Label(label).Value(value).SortOrder(sortOrder).IsShow(isShow).Description(description).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CategoryDictionaryAPI.UpdateDictApiV1CategoryDictionaryDidPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateDictApiV1CategoryDictionaryDidPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CategoryDictionaryAPI.UpdateDictApiV1CategoryDictionaryDidPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**did** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateDictApiV1CategoryDictionaryDidPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **label** | **string** |  | 
 **value** | **string** |  | 
 **sortOrder** | **int32** |  | 
 **isShow** | **bool** |  | 
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


## UpdateDictApiV1CategoryDictionaryDidPut_0

> interface{} UpdateDictApiV1CategoryDictionaryDidPut_0(ctx, did).Label(label).Value(value).SortOrder(sortOrder).IsShow(isShow).Description(description).Execute()

修改字典

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
	did := int32(56) // int32 | 
	label := "label_example" // string |  (optional)
	value := "value_example" // string |  (optional)
	sortOrder := int32(56) // int32 |  (optional)
	isShow := true // bool |  (optional)
	description := "description_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CategoryDictionaryAPI.UpdateDictApiV1CategoryDictionaryDidPut_0(context.Background(), did).Label(label).Value(value).SortOrder(sortOrder).IsShow(isShow).Description(description).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CategoryDictionaryAPI.UpdateDictApiV1CategoryDictionaryDidPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateDictApiV1CategoryDictionaryDidPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CategoryDictionaryAPI.UpdateDictApiV1CategoryDictionaryDidPut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**did** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateDictApiV1CategoryDictionaryDidPut_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **label** | **string** |  | 
 **value** | **string** |  | 
 **sortOrder** | **int32** |  | 
 **isShow** | **bool** |  | 
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

