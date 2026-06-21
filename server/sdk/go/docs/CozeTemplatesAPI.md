# \CozeTemplatesAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost**](CozeTemplatesAPI.md#DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost) | **Post** /api/v1/coze/templates/templates/duplicate | Duplicate Template
[**DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0**](CozeTemplatesAPI.md#DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0) | **Post** /api/v1/coze/templates/templates/duplicate | Duplicate Template
[**ListTemplatesApiV1CozeTemplatesTemplatesListGet**](CozeTemplatesAPI.md#ListTemplatesApiV1CozeTemplatesTemplatesListGet) | **Get** /api/v1/coze/templates/templates/list | List Templates
[**ListTemplatesApiV1CozeTemplatesTemplatesListGet_0**](CozeTemplatesAPI.md#ListTemplatesApiV1CozeTemplatesTemplatesListGet_0) | **Get** /api/v1/coze/templates/templates/list | List Templates



## DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost

> interface{} DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost(ctx).DuplicateTemplateReq(duplicateTemplateReq).Execute()

Duplicate Template

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
	duplicateTemplateReq := *openapiclient.NewDuplicateTemplateReq("TemplateId_example", "WorkspaceId_example", "Name_example") // DuplicateTemplateReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeTemplatesAPI.DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost(context.Background()).DuplicateTemplateReq(duplicateTemplateReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeTemplatesAPI.DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeTemplatesAPI.DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **duplicateTemplateReq** | [**DuplicateTemplateReq**](DuplicateTemplateReq.md) |  | 

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


## DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0

> interface{} DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0(ctx).DuplicateTemplateReq(duplicateTemplateReq).Execute()

Duplicate Template

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
	duplicateTemplateReq := *openapiclient.NewDuplicateTemplateReq("TemplateId_example", "WorkspaceId_example", "Name_example") // DuplicateTemplateReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeTemplatesAPI.DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0(context.Background()).DuplicateTemplateReq(duplicateTemplateReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeTemplatesAPI.DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeTemplatesAPI.DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **duplicateTemplateReq** | [**DuplicateTemplateReq**](DuplicateTemplateReq.md) |  | 

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


## ListTemplatesApiV1CozeTemplatesTemplatesListGet

> interface{} ListTemplatesApiV1CozeTemplatesTemplatesListGet(ctx).Page(page).Size(size).Execute()

List Templates

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
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeTemplatesAPI.ListTemplatesApiV1CozeTemplatesTemplatesListGet(context.Background()).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeTemplatesAPI.ListTemplatesApiV1CozeTemplatesTemplatesListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListTemplatesApiV1CozeTemplatesTemplatesListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeTemplatesAPI.ListTemplatesApiV1CozeTemplatesTemplatesListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListTemplatesApiV1CozeTemplatesTemplatesListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **size** | **int32** |  | [default to 20]

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


## ListTemplatesApiV1CozeTemplatesTemplatesListGet_0

> interface{} ListTemplatesApiV1CozeTemplatesTemplatesListGet_0(ctx).Page(page).Size(size).Execute()

List Templates

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
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeTemplatesAPI.ListTemplatesApiV1CozeTemplatesTemplatesListGet_0(context.Background()).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeTemplatesAPI.ListTemplatesApiV1CozeTemplatesTemplatesListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListTemplatesApiV1CozeTemplatesTemplatesListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeTemplatesAPI.ListTemplatesApiV1CozeTemplatesTemplatesListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListTemplatesApiV1CozeTemplatesTemplatesListGet_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **size** | **int32** |  | [default to 20]

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

