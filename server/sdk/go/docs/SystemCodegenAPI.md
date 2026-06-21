# \SystemCodegenAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GenColumnListApiV1SystemGenColumnTableIdGet**](SystemCodegenAPI.md#GenColumnListApiV1SystemGenColumnTableIdGet) | **Get** /api/v1/system/gen/column/{table_id} | List columns for an imported table
[**GenDbListApiV1SystemGenDbListGet**](SystemCodegenAPI.md#GenDbListApiV1SystemGenDbListGet) | **Get** /api/v1/system/gen/db/list | List database tables from information_schema
[**GenDeleteApiV1SystemGenTableIdsDelete**](SystemCodegenAPI.md#GenDeleteApiV1SystemGenTableIdsDelete) | **Delete** /api/v1/system/gen/{table_ids} | Delete imported codegen tables
[**GenDownloadApiV1SystemGenDownloadTableNameGet**](SystemCodegenAPI.md#GenDownloadApiV1SystemGenDownloadTableNameGet) | **Get** /api/v1/system/gen/download/{table_name} | Download generated code as zip
[**GenImportTableApiV1SystemGenImportTablePost**](SystemCodegenAPI.md#GenImportTableApiV1SystemGenImportTablePost) | **Post** /api/v1/system/gen/import_table | Import database tables into codegen
[**GenListApiV1SystemGenListGet**](SystemCodegenAPI.md#GenListApiV1SystemGenListGet) | **Get** /api/v1/system/gen/list | List imported codegen tables
[**GenPreviewApiV1SystemGenPreviewTableIdGet**](SystemCodegenAPI.md#GenPreviewApiV1SystemGenPreviewTableIdGet) | **Get** /api/v1/system/gen/preview/{table_id} | Preview generated code for a table
[**GenUpdateApiV1SystemGenPut**](SystemCodegenAPI.md#GenUpdateApiV1SystemGenPut) | **Put** /api/v1/system/gen | Update codegen table metadata



## GenColumnListApiV1SystemGenColumnTableIdGet

> interface{} GenColumnListApiV1SystemGenColumnTableIdGet(ctx, tableId).Execute()

List columns for an imported table



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
	tableId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemCodegenAPI.GenColumnListApiV1SystemGenColumnTableIdGet(context.Background(), tableId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemCodegenAPI.GenColumnListApiV1SystemGenColumnTableIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GenColumnListApiV1SystemGenColumnTableIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemCodegenAPI.GenColumnListApiV1SystemGenColumnTableIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**tableId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGenColumnListApiV1SystemGenColumnTableIdGetRequest struct via the builder pattern


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


## GenDbListApiV1SystemGenDbListGet

> interface{} GenDbListApiV1SystemGenDbListGet(ctx).Page(page).Limit(limit).TableName(tableName).TableComment(tableComment).Execute()

List database tables from information_schema



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
	tableName := "tableName_example" // string |  (optional)
	tableComment := "tableComment_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemCodegenAPI.GenDbListApiV1SystemGenDbListGet(context.Background()).Page(page).Limit(limit).TableName(tableName).TableComment(tableComment).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemCodegenAPI.GenDbListApiV1SystemGenDbListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GenDbListApiV1SystemGenDbListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemCodegenAPI.GenDbListApiV1SystemGenDbListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGenDbListApiV1SystemGenDbListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **tableName** | **string** |  | 
 **tableComment** | **string** |  | 

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


## GenDeleteApiV1SystemGenTableIdsDelete

> interface{} GenDeleteApiV1SystemGenTableIdsDelete(ctx, tableIds).Execute()

Delete imported codegen tables



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
	tableIds := "tableIds_example" // string | Comma-separated table IDs

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemCodegenAPI.GenDeleteApiV1SystemGenTableIdsDelete(context.Background(), tableIds).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemCodegenAPI.GenDeleteApiV1SystemGenTableIdsDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GenDeleteApiV1SystemGenTableIdsDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemCodegenAPI.GenDeleteApiV1SystemGenTableIdsDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**tableIds** | **string** | Comma-separated table IDs | 

### Other Parameters

Other parameters are passed through a pointer to a apiGenDeleteApiV1SystemGenTableIdsDeleteRequest struct via the builder pattern


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


## GenDownloadApiV1SystemGenDownloadTableNameGet

> interface{} GenDownloadApiV1SystemGenDownloadTableNameGet(ctx, tableName).Execute()

Download generated code as zip



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
	tableName := "tableName_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemCodegenAPI.GenDownloadApiV1SystemGenDownloadTableNameGet(context.Background(), tableName).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemCodegenAPI.GenDownloadApiV1SystemGenDownloadTableNameGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GenDownloadApiV1SystemGenDownloadTableNameGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemCodegenAPI.GenDownloadApiV1SystemGenDownloadTableNameGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**tableName** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGenDownloadApiV1SystemGenDownloadTableNameGetRequest struct via the builder pattern


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


## GenImportTableApiV1SystemGenImportTablePost

> interface{} GenImportTableApiV1SystemGenImportTablePost(ctx).BodyGenImportTableApiV1SystemGenImportTablePost(bodyGenImportTableApiV1SystemGenImportTablePost).Execute()

Import database tables into codegen



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
	bodyGenImportTableApiV1SystemGenImportTablePost := *openapiclient.NewBodyGenImportTableApiV1SystemGenImportTablePost("Tables_example") // BodyGenImportTableApiV1SystemGenImportTablePost | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemCodegenAPI.GenImportTableApiV1SystemGenImportTablePost(context.Background()).BodyGenImportTableApiV1SystemGenImportTablePost(bodyGenImportTableApiV1SystemGenImportTablePost).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemCodegenAPI.GenImportTableApiV1SystemGenImportTablePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GenImportTableApiV1SystemGenImportTablePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemCodegenAPI.GenImportTableApiV1SystemGenImportTablePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGenImportTableApiV1SystemGenImportTablePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyGenImportTableApiV1SystemGenImportTablePost** | [**BodyGenImportTableApiV1SystemGenImportTablePost**](BodyGenImportTableApiV1SystemGenImportTablePost.md) |  | 

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


## GenListApiV1SystemGenListGet

> interface{} GenListApiV1SystemGenListGet(ctx).Page(page).Limit(limit).TableName(tableName).TableComment(tableComment).Execute()

List imported codegen tables



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
	tableName := "tableName_example" // string |  (optional)
	tableComment := "tableComment_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemCodegenAPI.GenListApiV1SystemGenListGet(context.Background()).Page(page).Limit(limit).TableName(tableName).TableComment(tableComment).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemCodegenAPI.GenListApiV1SystemGenListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GenListApiV1SystemGenListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemCodegenAPI.GenListApiV1SystemGenListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGenListApiV1SystemGenListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **tableName** | **string** |  | 
 **tableComment** | **string** |  | 

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


## GenPreviewApiV1SystemGenPreviewTableIdGet

> interface{} GenPreviewApiV1SystemGenPreviewTableIdGet(ctx, tableId).Execute()

Preview generated code for a table



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
	tableId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemCodegenAPI.GenPreviewApiV1SystemGenPreviewTableIdGet(context.Background(), tableId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemCodegenAPI.GenPreviewApiV1SystemGenPreviewTableIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GenPreviewApiV1SystemGenPreviewTableIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemCodegenAPI.GenPreviewApiV1SystemGenPreviewTableIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**tableId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGenPreviewApiV1SystemGenPreviewTableIdGetRequest struct via the builder pattern


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


## GenUpdateApiV1SystemGenPut

> interface{} GenUpdateApiV1SystemGenPut(ctx).RequestBody(requestBody).Execute()

Update codegen table metadata



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
	requestBody := map[string]interface{}{"key": interface{}(123)} // map[string]interface{} | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemCodegenAPI.GenUpdateApiV1SystemGenPut(context.Background()).RequestBody(requestBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemCodegenAPI.GenUpdateApiV1SystemGenPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GenUpdateApiV1SystemGenPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemCodegenAPI.GenUpdateApiV1SystemGenPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGenUpdateApiV1SystemGenPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **requestBody** | **map[string]interface{}** |  | 

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

