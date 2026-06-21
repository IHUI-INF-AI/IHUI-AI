# \ProductIdentityAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateProductIdentityApiV1ProductIdentityPost**](ProductIdentityAPI.md#CreateProductIdentityApiV1ProductIdentityPost) | **Post** /api/v1/product_identity | Create product identity
[**DeleteProductIdentitiesApiV1ProductIdentityItemIdsDelete**](ProductIdentityAPI.md#DeleteProductIdentitiesApiV1ProductIdentityItemIdsDelete) | **Delete** /api/v1/product_identity/{item_ids} | Delete product identities
[**GetProductIdentityApiV1ProductIdentityItemIdGet**](ProductIdentityAPI.md#GetProductIdentityApiV1ProductIdentityItemIdGet) | **Get** /api/v1/product_identity/{item_id} | Get product identity detail
[**ListProductIdentitiesApiV1ProductIdentityListGet**](ProductIdentityAPI.md#ListProductIdentitiesApiV1ProductIdentityListGet) | **Get** /api/v1/product_identity/list | List product identities
[**UpdateProductIdentityApiV1ProductIdentityPut**](ProductIdentityAPI.md#UpdateProductIdentityApiV1ProductIdentityPut) | **Put** /api/v1/product_identity | Update product identity



## CreateProductIdentityApiV1ProductIdentityPost

> interface{} CreateProductIdentityApiV1ProductIdentityPost(ctx).ProductIdentityCreate(productIdentityCreate).Execute()

Create product identity

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
	productIdentityCreate := *openapiclient.NewProductIdentityCreate("Id_example") // ProductIdentityCreate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ProductIdentityAPI.CreateProductIdentityApiV1ProductIdentityPost(context.Background()).ProductIdentityCreate(productIdentityCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ProductIdentityAPI.CreateProductIdentityApiV1ProductIdentityPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateProductIdentityApiV1ProductIdentityPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ProductIdentityAPI.CreateProductIdentityApiV1ProductIdentityPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateProductIdentityApiV1ProductIdentityPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **productIdentityCreate** | [**ProductIdentityCreate**](ProductIdentityCreate.md) |  | 

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


## DeleteProductIdentitiesApiV1ProductIdentityItemIdsDelete

> interface{} DeleteProductIdentitiesApiV1ProductIdentityItemIdsDelete(ctx, itemIds).Execute()

Delete product identities

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
	resp, r, err := apiClient.ProductIdentityAPI.DeleteProductIdentitiesApiV1ProductIdentityItemIdsDelete(context.Background(), itemIds).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ProductIdentityAPI.DeleteProductIdentitiesApiV1ProductIdentityItemIdsDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteProductIdentitiesApiV1ProductIdentityItemIdsDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ProductIdentityAPI.DeleteProductIdentitiesApiV1ProductIdentityItemIdsDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**itemIds** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteProductIdentitiesApiV1ProductIdentityItemIdsDeleteRequest struct via the builder pattern


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


## GetProductIdentityApiV1ProductIdentityItemIdGet

> interface{} GetProductIdentityApiV1ProductIdentityItemIdGet(ctx, itemId).Execute()

Get product identity detail

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
	resp, r, err := apiClient.ProductIdentityAPI.GetProductIdentityApiV1ProductIdentityItemIdGet(context.Background(), itemId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ProductIdentityAPI.GetProductIdentityApiV1ProductIdentityItemIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetProductIdentityApiV1ProductIdentityItemIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ProductIdentityAPI.GetProductIdentityApiV1ProductIdentityItemIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**itemId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetProductIdentityApiV1ProductIdentityItemIdGetRequest struct via the builder pattern


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


## ListProductIdentitiesApiV1ProductIdentityListGet

> interface{} ListProductIdentitiesApiV1ProductIdentityListGet(ctx).Page(page).Limit(limit).Name(name).IdentityType(identityType).Status(status).Execute()

List product identities

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
	identityType := "identityType_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ProductIdentityAPI.ListProductIdentitiesApiV1ProductIdentityListGet(context.Background()).Page(page).Limit(limit).Name(name).IdentityType(identityType).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ProductIdentityAPI.ListProductIdentitiesApiV1ProductIdentityListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListProductIdentitiesApiV1ProductIdentityListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ProductIdentityAPI.ListProductIdentitiesApiV1ProductIdentityListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListProductIdentitiesApiV1ProductIdentityListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **name** | **string** |  | 
 **identityType** | **string** |  | 
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


## UpdateProductIdentityApiV1ProductIdentityPut

> interface{} UpdateProductIdentityApiV1ProductIdentityPut(ctx).ProductIdentityUpdate(productIdentityUpdate).Execute()

Update product identity

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
	productIdentityUpdate := *openapiclient.NewProductIdentityUpdate("Id_example") // ProductIdentityUpdate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ProductIdentityAPI.UpdateProductIdentityApiV1ProductIdentityPut(context.Background()).ProductIdentityUpdate(productIdentityUpdate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ProductIdentityAPI.UpdateProductIdentityApiV1ProductIdentityPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateProductIdentityApiV1ProductIdentityPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ProductIdentityAPI.UpdateProductIdentityApiV1ProductIdentityPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateProductIdentityApiV1ProductIdentityPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **productIdentityUpdate** | [**ProductIdentityUpdate**](ProductIdentityUpdate.md) |  | 

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

