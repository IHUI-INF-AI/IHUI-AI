# \AIGCAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateAigcApiV1ContentAigcPost**](AIGCAPI.md#CreateAigcApiV1ContentAigcPost) | **Post** /api/v1/content/aigc | Create AIGC record
[**DeleteAigcApiV1ContentAigcItemIdsDelete**](AIGCAPI.md#DeleteAigcApiV1ContentAigcItemIdsDelete) | **Delete** /api/v1/content/aigc/{item_ids} | Delete AIGC records
[**GetAigcApiV1ContentAigcItemIdGet**](AIGCAPI.md#GetAigcApiV1ContentAigcItemIdGet) | **Get** /api/v1/content/aigc/{item_id} | Get AIGC detail
[**ListAigcApiV1ContentAigcListGet**](AIGCAPI.md#ListAigcApiV1ContentAigcListGet) | **Get** /api/v1/content/aigc/list | List AIGC records
[**UpdateAigcApiV1ContentAigcPut**](AIGCAPI.md#UpdateAigcApiV1ContentAigcPut) | **Put** /api/v1/content/aigc | Update AIGC record



## CreateAigcApiV1ContentAigcPost

> interface{} CreateAigcApiV1ContentAigcPost(ctx).AiGcCreate(aiGcCreate).Execute()

Create AIGC record

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
	aiGcCreate := *openapiclient.NewAiGcCreate("UserUuid_example") // AiGcCreate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIGCAPI.CreateAigcApiV1ContentAigcPost(context.Background()).AiGcCreate(aiGcCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIGCAPI.CreateAigcApiV1ContentAigcPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateAigcApiV1ContentAigcPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIGCAPI.CreateAigcApiV1ContentAigcPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateAigcApiV1ContentAigcPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aiGcCreate** | [**AiGcCreate**](AiGcCreate.md) |  | 

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


## DeleteAigcApiV1ContentAigcItemIdsDelete

> interface{} DeleteAigcApiV1ContentAigcItemIdsDelete(ctx, itemIds).Execute()

Delete AIGC records

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
	resp, r, err := apiClient.AIGCAPI.DeleteAigcApiV1ContentAigcItemIdsDelete(context.Background(), itemIds).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIGCAPI.DeleteAigcApiV1ContentAigcItemIdsDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteAigcApiV1ContentAigcItemIdsDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIGCAPI.DeleteAigcApiV1ContentAigcItemIdsDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**itemIds** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteAigcApiV1ContentAigcItemIdsDeleteRequest struct via the builder pattern


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


## GetAigcApiV1ContentAigcItemIdGet

> interface{} GetAigcApiV1ContentAigcItemIdGet(ctx, itemId).Execute()

Get AIGC detail

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
	resp, r, err := apiClient.AIGCAPI.GetAigcApiV1ContentAigcItemIdGet(context.Background(), itemId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIGCAPI.GetAigcApiV1ContentAigcItemIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetAigcApiV1ContentAigcItemIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIGCAPI.GetAigcApiV1ContentAigcItemIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**itemId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetAigcApiV1ContentAigcItemIdGetRequest struct via the builder pattern


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


## ListAigcApiV1ContentAigcListGet

> interface{} ListAigcApiV1ContentAigcListGet(ctx).Page(page).Limit(limit).UserUuid(userUuid).GcType(gcType).Status(status).Execute()

List AIGC records

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
	userUuid := "userUuid_example" // string |  (optional)
	gcType := "gcType_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIGCAPI.ListAigcApiV1ContentAigcListGet(context.Background()).Page(page).Limit(limit).UserUuid(userUuid).GcType(gcType).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIGCAPI.ListAigcApiV1ContentAigcListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListAigcApiV1ContentAigcListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIGCAPI.ListAigcApiV1ContentAigcListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListAigcApiV1ContentAigcListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **userUuid** | **string** |  | 
 **gcType** | **string** |  | 
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


## UpdateAigcApiV1ContentAigcPut

> interface{} UpdateAigcApiV1ContentAigcPut(ctx).AiGcUpdate(aiGcUpdate).Execute()

Update AIGC record

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
	aiGcUpdate := *openapiclient.NewAiGcUpdate(int32(123)) // AiGcUpdate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIGCAPI.UpdateAigcApiV1ContentAigcPut(context.Background()).AiGcUpdate(aiGcUpdate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIGCAPI.UpdateAigcApiV1ContentAigcPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateAigcApiV1ContentAigcPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIGCAPI.UpdateAigcApiV1ContentAigcPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateAigcApiV1ContentAigcPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **aiGcUpdate** | [**AiGcUpdate**](AiGcUpdate.md) |  | 

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

