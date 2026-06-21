# \CozeMockAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**MockCozeAgents**](CozeMockAPI.md#MockCozeAgents) | **Get** /cozeZhsApi/agents | Mock: Coze 智能体列表
[**MockCozeCategories**](CozeMockAPI.md#MockCozeCategories) | **Get** /cozeZhsApi/cache/agent-category-dict/categories | Mock: Coze 智能体分类字典
[**MockCozeCategoryDetail**](CozeMockAPI.md#MockCozeCategoryDetail) | **Get** /cozeZhsApi/cache/agent-category-dict/categories/{category_id} | Mock: Coze 分类详情



## MockCozeAgents

> interface{} MockCozeAgents(ctx).Execute()

Mock: Coze 智能体列表

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
	resp, r, err := apiClient.CozeMockAPI.MockCozeAgents(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeMockAPI.MockCozeAgents``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MockCozeAgents`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeMockAPI.MockCozeAgents`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiMockCozeAgentsRequest struct via the builder pattern


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


## MockCozeCategories

> interface{} MockCozeCategories(ctx).Execute()

Mock: Coze 智能体分类字典

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
	resp, r, err := apiClient.CozeMockAPI.MockCozeCategories(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeMockAPI.MockCozeCategories``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MockCozeCategories`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeMockAPI.MockCozeCategories`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiMockCozeCategoriesRequest struct via the builder pattern


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


## MockCozeCategoryDetail

> interface{} MockCozeCategoryDetail(ctx, categoryId).Execute()

Mock: Coze 分类详情

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
	categoryId := "categoryId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeMockAPI.MockCozeCategoryDetail(context.Background(), categoryId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeMockAPI.MockCozeCategoryDetail``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MockCozeCategoryDetail`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeMockAPI.MockCozeCategoryDetail`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**categoryId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiMockCozeCategoryDetailRequest struct via the builder pattern


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

