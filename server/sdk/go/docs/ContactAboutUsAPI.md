# \ContactAboutUsAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ContactAddApiV1ContentContactPost**](ContactAboutUsAPI.md#ContactAddApiV1ContentContactPost) | **Post** /api/v1/content/contact | Contact Add
[**ContactEditApiV1ContentContactPut**](ContactAboutUsAPI.md#ContactEditApiV1ContentContactPut) | **Put** /api/v1/content/contact | Contact Edit
[**ContactGetInfoApiV1ContentContactItemIdGet**](ContactAboutUsAPI.md#ContactGetInfoApiV1ContentContactItemIdGet) | **Get** /api/v1/content/contact/{item_id} | Contact Get Info
[**ContactListApiV1ContentContactListGet**](ContactAboutUsAPI.md#ContactListApiV1ContentContactListGet) | **Get** /api/v1/content/contact/list | Contact List
[**ContactRemoveApiV1ContentContactItemIdsDelete**](ContactAboutUsAPI.md#ContactRemoveApiV1ContentContactItemIdsDelete) | **Delete** /api/v1/content/contact/{item_ids} | Contact Remove



## ContactAddApiV1ContentContactPost

> interface{} ContactAddApiV1ContentContactPost(ctx).ContactIn(contactIn).Execute()

Contact Add



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
	contactIn := *openapiclient.NewContactIn() // ContactIn | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContactAboutUsAPI.ContactAddApiV1ContentContactPost(context.Background()).ContactIn(contactIn).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContactAboutUsAPI.ContactAddApiV1ContentContactPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ContactAddApiV1ContentContactPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContactAboutUsAPI.ContactAddApiV1ContentContactPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiContactAddApiV1ContentContactPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **contactIn** | [**ContactIn**](ContactIn.md) |  | 

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


## ContactEditApiV1ContentContactPut

> interface{} ContactEditApiV1ContentContactPut(ctx).Id(id).ContactIn(contactIn).Execute()

Contact Edit



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
	id := int32(56) // int32 | 
	contactIn := *openapiclient.NewContactIn() // ContactIn | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContactAboutUsAPI.ContactEditApiV1ContentContactPut(context.Background()).Id(id).ContactIn(contactIn).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContactAboutUsAPI.ContactEditApiV1ContentContactPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ContactEditApiV1ContentContactPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContactAboutUsAPI.ContactEditApiV1ContentContactPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiContactEditApiV1ContentContactPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **int32** |  | 
 **contactIn** | [**ContactIn**](ContactIn.md) |  | 

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


## ContactGetInfoApiV1ContentContactItemIdGet

> interface{} ContactGetInfoApiV1ContentContactItemIdGet(ctx, itemId).Execute()

Contact Get Info



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
	resp, r, err := apiClient.ContactAboutUsAPI.ContactGetInfoApiV1ContentContactItemIdGet(context.Background(), itemId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContactAboutUsAPI.ContactGetInfoApiV1ContentContactItemIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ContactGetInfoApiV1ContentContactItemIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContactAboutUsAPI.ContactGetInfoApiV1ContentContactItemIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**itemId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiContactGetInfoApiV1ContentContactItemIdGetRequest struct via the builder pattern


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


## ContactListApiV1ContentContactListGet

> interface{} ContactListApiV1ContentContactListGet(ctx).PageNum(pageNum).PageSize(pageSize).Execute()

Contact List



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
	pageNum := int32(56) // int32 |  (optional) (default to 1)
	pageSize := int32(56) // int32 |  (optional) (default to 10)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContactAboutUsAPI.ContactListApiV1ContentContactListGet(context.Background()).PageNum(pageNum).PageSize(pageSize).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContactAboutUsAPI.ContactListApiV1ContentContactListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ContactListApiV1ContentContactListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContactAboutUsAPI.ContactListApiV1ContentContactListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiContactListApiV1ContentContactListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pageNum** | **int32** |  | [default to 1]
 **pageSize** | **int32** |  | [default to 10]

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


## ContactRemoveApiV1ContentContactItemIdsDelete

> interface{} ContactRemoveApiV1ContentContactItemIdsDelete(ctx, itemIds).Execute()

Contact Remove



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
	resp, r, err := apiClient.ContactAboutUsAPI.ContactRemoveApiV1ContentContactItemIdsDelete(context.Background(), itemIds).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContactAboutUsAPI.ContactRemoveApiV1ContentContactItemIdsDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ContactRemoveApiV1ContentContactItemIdsDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContactAboutUsAPI.ContactRemoveApiV1ContentContactItemIdsDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**itemIds** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiContactRemoveApiV1ContentContactItemIdsDeleteRequest struct via the builder pattern


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

