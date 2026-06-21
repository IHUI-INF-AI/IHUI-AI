# \DeveloperLinkAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AssignAccountApiV1DeveloperLinkAssignAccountPut**](DeveloperLinkAPI.md#AssignAccountApiV1DeveloperLinkAssignAccountPut) | **Put** /api/v1/developerLink/assignAccount | Assign Coze account to developer
[**CreateDeveloperLinkApiV1DeveloperLinkPost**](DeveloperLinkAPI.md#CreateDeveloperLinkApiV1DeveloperLinkPost) | **Post** /api/v1/developerLink | Create developer link
[**DeleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete**](DeveloperLinkAPI.md#DeleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete) | **Delete** /api/v1/developerLink/{item_ids} | Delete developer links
[**GetDeveloperLinkApiV1DeveloperLinkItemIdGet**](DeveloperLinkAPI.md#GetDeveloperLinkApiV1DeveloperLinkItemIdGet) | **Get** /api/v1/developerLink/{item_id} | Get developer link detail
[**ListDeveloperLinksApiV1DeveloperLinkListGet**](DeveloperLinkAPI.md#ListDeveloperLinksApiV1DeveloperLinkListGet) | **Get** /api/v1/developerLink/list | List developer links
[**UpdateDeveloperLinkApiV1DeveloperLinkPut**](DeveloperLinkAPI.md#UpdateDeveloperLinkApiV1DeveloperLinkPut) | **Put** /api/v1/developerLink | Update developer link



## AssignAccountApiV1DeveloperLinkAssignAccountPut

> interface{} AssignAccountApiV1DeveloperLinkAssignAccountPut(ctx).AssignAccountRequest(assignAccountRequest).Execute()

Assign Coze account to developer



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
	assignAccountRequest := *openapiclient.NewAssignAccountRequest("Id_example", "CozeId_example") // AssignAccountRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.DeveloperLinkAPI.AssignAccountApiV1DeveloperLinkAssignAccountPut(context.Background()).AssignAccountRequest(assignAccountRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `DeveloperLinkAPI.AssignAccountApiV1DeveloperLinkAssignAccountPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AssignAccountApiV1DeveloperLinkAssignAccountPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `DeveloperLinkAPI.AssignAccountApiV1DeveloperLinkAssignAccountPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAssignAccountApiV1DeveloperLinkAssignAccountPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **assignAccountRequest** | [**AssignAccountRequest**](AssignAccountRequest.md) |  | 

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


## CreateDeveloperLinkApiV1DeveloperLinkPost

> interface{} CreateDeveloperLinkApiV1DeveloperLinkPost(ctx).DeveloperLinkCreate(developerLinkCreate).Execute()

Create developer link

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
	developerLinkCreate := *openapiclient.NewDeveloperLinkCreate("UserId_example") // DeveloperLinkCreate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.DeveloperLinkAPI.CreateDeveloperLinkApiV1DeveloperLinkPost(context.Background()).DeveloperLinkCreate(developerLinkCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `DeveloperLinkAPI.CreateDeveloperLinkApiV1DeveloperLinkPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateDeveloperLinkApiV1DeveloperLinkPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `DeveloperLinkAPI.CreateDeveloperLinkApiV1DeveloperLinkPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateDeveloperLinkApiV1DeveloperLinkPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **developerLinkCreate** | [**DeveloperLinkCreate**](DeveloperLinkCreate.md) |  | 

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


## DeleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete

> interface{} DeleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete(ctx, itemIds).Execute()

Delete developer links

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
	resp, r, err := apiClient.DeveloperLinkAPI.DeleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete(context.Background(), itemIds).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `DeveloperLinkAPI.DeleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `DeveloperLinkAPI.DeleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**itemIds** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteDeveloperLinksApiV1DeveloperLinkItemIdsDeleteRequest struct via the builder pattern


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


## GetDeveloperLinkApiV1DeveloperLinkItemIdGet

> interface{} GetDeveloperLinkApiV1DeveloperLinkItemIdGet(ctx, itemId).Execute()

Get developer link detail

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
	itemId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.DeveloperLinkAPI.GetDeveloperLinkApiV1DeveloperLinkItemIdGet(context.Background(), itemId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `DeveloperLinkAPI.GetDeveloperLinkApiV1DeveloperLinkItemIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetDeveloperLinkApiV1DeveloperLinkItemIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `DeveloperLinkAPI.GetDeveloperLinkApiV1DeveloperLinkItemIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**itemId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetDeveloperLinkApiV1DeveloperLinkItemIdGetRequest struct via the builder pattern


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


## ListDeveloperLinksApiV1DeveloperLinkListGet

> interface{} ListDeveloperLinksApiV1DeveloperLinkListGet(ctx).Page(page).Limit(limit).UserId(userId).Status(status).Execute()

List developer links

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
	userId := "userId_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.DeveloperLinkAPI.ListDeveloperLinksApiV1DeveloperLinkListGet(context.Background()).Page(page).Limit(limit).UserId(userId).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `DeveloperLinkAPI.ListDeveloperLinksApiV1DeveloperLinkListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDeveloperLinksApiV1DeveloperLinkListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `DeveloperLinkAPI.ListDeveloperLinksApiV1DeveloperLinkListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDeveloperLinksApiV1DeveloperLinkListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **userId** | **string** |  | 
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


## UpdateDeveloperLinkApiV1DeveloperLinkPut

> interface{} UpdateDeveloperLinkApiV1DeveloperLinkPut(ctx).DeveloperLinkUpdate(developerLinkUpdate).Execute()

Update developer link

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
	developerLinkUpdate := *openapiclient.NewDeveloperLinkUpdate(int32(123)) // DeveloperLinkUpdate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.DeveloperLinkAPI.UpdateDeveloperLinkApiV1DeveloperLinkPut(context.Background()).DeveloperLinkUpdate(developerLinkUpdate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `DeveloperLinkAPI.UpdateDeveloperLinkApiV1DeveloperLinkPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateDeveloperLinkApiV1DeveloperLinkPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `DeveloperLinkAPI.UpdateDeveloperLinkApiV1DeveloperLinkPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateDeveloperLinkApiV1DeveloperLinkPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **developerLinkUpdate** | [**DeveloperLinkUpdate**](DeveloperLinkUpdate.md) |  | 

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

