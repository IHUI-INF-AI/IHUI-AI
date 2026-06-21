# \ProductAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateProductApiV1ZhsProductPost**](ProductAPI.md#CreateProductApiV1ZhsProductPost) | **Post** /api/v1/zhs_product | Create product
[**DeleteProductsApiV1ZhsProductItemIdsDelete**](ProductAPI.md#DeleteProductsApiV1ZhsProductItemIdsDelete) | **Delete** /api/v1/zhs_product/{item_ids} | Delete products
[**GetProductApiV1ZhsProductItemIdGet**](ProductAPI.md#GetProductApiV1ZhsProductItemIdGet) | **Get** /api/v1/zhs_product/{item_id} | Get product detail
[**ListProductsApiV1ZhsProductListGet**](ProductAPI.md#ListProductsApiV1ZhsProductListGet) | **Get** /api/v1/zhs_product/list | List products
[**UpdateProductApiV1ZhsProductPut**](ProductAPI.md#UpdateProductApiV1ZhsProductPut) | **Put** /api/v1/zhs_product | Update product



## CreateProductApiV1ZhsProductPost

> interface{} CreateProductApiV1ZhsProductPost(ctx).ProductCreate(productCreate).Execute()

Create product

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
	productCreate := *openapiclient.NewProductCreate("Id_example", "Name_example") // ProductCreate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ProductAPI.CreateProductApiV1ZhsProductPost(context.Background()).ProductCreate(productCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ProductAPI.CreateProductApiV1ZhsProductPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateProductApiV1ZhsProductPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ProductAPI.CreateProductApiV1ZhsProductPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateProductApiV1ZhsProductPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **productCreate** | [**ProductCreate**](ProductCreate.md) |  | 

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


## DeleteProductsApiV1ZhsProductItemIdsDelete

> interface{} DeleteProductsApiV1ZhsProductItemIdsDelete(ctx, itemIds).Execute()

Delete products

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
	itemIds := "itemIds_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ProductAPI.DeleteProductsApiV1ZhsProductItemIdsDelete(context.Background(), itemIds).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ProductAPI.DeleteProductsApiV1ZhsProductItemIdsDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteProductsApiV1ZhsProductItemIdsDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ProductAPI.DeleteProductsApiV1ZhsProductItemIdsDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**itemIds** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteProductsApiV1ZhsProductItemIdsDeleteRequest struct via the builder pattern


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


## GetProductApiV1ZhsProductItemIdGet

> interface{} GetProductApiV1ZhsProductItemIdGet(ctx, itemId).Execute()

Get product detail

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
	itemId := "itemId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ProductAPI.GetProductApiV1ZhsProductItemIdGet(context.Background(), itemId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ProductAPI.GetProductApiV1ZhsProductItemIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetProductApiV1ZhsProductItemIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ProductAPI.GetProductApiV1ZhsProductItemIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**itemId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetProductApiV1ZhsProductItemIdGetRequest struct via the builder pattern


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


## ListProductsApiV1ZhsProductListGet

> interface{} ListProductsApiV1ZhsProductListGet(ctx).Page(page).Limit(limit).Name(name).Type_(type_).Status(status).Execute()

List products

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
	name := "name_example" // string |  (optional)
	type_ := "type__example" // string |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ProductAPI.ListProductsApiV1ZhsProductListGet(context.Background()).Page(page).Limit(limit).Name(name).Type_(type_).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ProductAPI.ListProductsApiV1ZhsProductListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListProductsApiV1ZhsProductListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ProductAPI.ListProductsApiV1ZhsProductListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListProductsApiV1ZhsProductListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **name** | **string** |  | 
 **type_** | **string** |  | 
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


## UpdateProductApiV1ZhsProductPut

> interface{} UpdateProductApiV1ZhsProductPut(ctx).ProductUpdate(productUpdate).Execute()

Update product

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
	productUpdate := *openapiclient.NewProductUpdate("Id_example") // ProductUpdate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ProductAPI.UpdateProductApiV1ZhsProductPut(context.Background()).ProductUpdate(productUpdate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ProductAPI.UpdateProductApiV1ZhsProductPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateProductApiV1ZhsProductPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ProductAPI.UpdateProductApiV1ZhsProductPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateProductApiV1ZhsProductPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **productUpdate** | [**ProductUpdate**](ProductUpdate.md) |  | 

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

