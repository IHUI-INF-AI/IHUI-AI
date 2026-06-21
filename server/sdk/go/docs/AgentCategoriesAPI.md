# \AgentCategoriesAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**DeleteCategoryApiV1AgentsCategoryIdDelete**](AgentCategoriesAPI.md#DeleteCategoryApiV1AgentsCategoryIdDelete) | **Delete** /api/v1/agents/{category_id} | Delete agent category
[**GetCategoryDetailApiV1AgentsCategoryIdGet**](AgentCategoriesAPI.md#GetCategoryDetailApiV1AgentsCategoryIdGet) | **Get** /api/v1/agents/{category_id} | Get category detail
[**UpdateCategoryApiV1AgentsCategoryIdPut**](AgentCategoriesAPI.md#UpdateCategoryApiV1AgentsCategoryIdPut) | **Put** /api/v1/agents/{category_id} | Update agent category



## DeleteCategoryApiV1AgentsCategoryIdDelete

> interface{} DeleteCategoryApiV1AgentsCategoryIdDelete(ctx, categoryId).Execute()

Delete agent category

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
	categoryId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentCategoriesAPI.DeleteCategoryApiV1AgentsCategoryIdDelete(context.Background(), categoryId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentCategoriesAPI.DeleteCategoryApiV1AgentsCategoryIdDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteCategoryApiV1AgentsCategoryIdDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentCategoriesAPI.DeleteCategoryApiV1AgentsCategoryIdDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**categoryId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteCategoryApiV1AgentsCategoryIdDeleteRequest struct via the builder pattern


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


## GetCategoryDetailApiV1AgentsCategoryIdGet

> interface{} GetCategoryDetailApiV1AgentsCategoryIdGet(ctx, categoryId).Execute()

Get category detail

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
	categoryId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentCategoriesAPI.GetCategoryDetailApiV1AgentsCategoryIdGet(context.Background(), categoryId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentCategoriesAPI.GetCategoryDetailApiV1AgentsCategoryIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetCategoryDetailApiV1AgentsCategoryIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentCategoriesAPI.GetCategoryDetailApiV1AgentsCategoryIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**categoryId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetCategoryDetailApiV1AgentsCategoryIdGetRequest struct via the builder pattern


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


## UpdateCategoryApiV1AgentsCategoryIdPut

> interface{} UpdateCategoryApiV1AgentsCategoryIdPut(ctx, categoryId).CategoryUpdateBody(categoryUpdateBody).Execute()

Update agent category

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
	categoryId := int32(56) // int32 | 
	categoryUpdateBody := *openapiclient.NewCategoryUpdateBody() // CategoryUpdateBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentCategoriesAPI.UpdateCategoryApiV1AgentsCategoryIdPut(context.Background(), categoryId).CategoryUpdateBody(categoryUpdateBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentCategoriesAPI.UpdateCategoryApiV1AgentsCategoryIdPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateCategoryApiV1AgentsCategoryIdPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentCategoriesAPI.UpdateCategoryApiV1AgentsCategoryIdPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**categoryId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateCategoryApiV1AgentsCategoryIdPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **categoryUpdateBody** | [**CategoryUpdateBody**](CategoryUpdateBody.md) |  | 

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

