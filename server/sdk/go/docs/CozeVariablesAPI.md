# \CozeVariablesAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateVariableApiV1CozeVariablesVariablesCreatePost**](CozeVariablesAPI.md#CreateVariableApiV1CozeVariablesVariablesCreatePost) | **Post** /api/v1/coze/variables/variables/create | Create Variable
[**CreateVariableApiV1CozeVariablesVariablesCreatePost_0**](CozeVariablesAPI.md#CreateVariableApiV1CozeVariablesVariablesCreatePost_0) | **Post** /api/v1/coze/variables/variables/create | Create Variable
[**DeleteVariableApiV1CozeVariablesVariablesDeletePost**](CozeVariablesAPI.md#DeleteVariableApiV1CozeVariablesVariablesDeletePost) | **Post** /api/v1/coze/variables/variables/delete | Delete Variable
[**DeleteVariableApiV1CozeVariablesVariablesDeletePost_0**](CozeVariablesAPI.md#DeleteVariableApiV1CozeVariablesVariablesDeletePost_0) | **Post** /api/v1/coze/variables/variables/delete | Delete Variable
[**ListVariablesApiV1CozeVariablesVariablesListGet**](CozeVariablesAPI.md#ListVariablesApiV1CozeVariablesVariablesListGet) | **Get** /api/v1/coze/variables/variables/list | List Variables
[**ListVariablesApiV1CozeVariablesVariablesListGet_0**](CozeVariablesAPI.md#ListVariablesApiV1CozeVariablesVariablesListGet_0) | **Get** /api/v1/coze/variables/variables/list | List Variables
[**RetrieveVariableApiV1CozeVariablesVariablesRetrieveGet**](CozeVariablesAPI.md#RetrieveVariableApiV1CozeVariablesVariablesRetrieveGet) | **Get** /api/v1/coze/variables/variables/retrieve | Retrieve Variable
[**RetrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0**](CozeVariablesAPI.md#RetrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0) | **Get** /api/v1/coze/variables/variables/retrieve | Retrieve Variable
[**UpdateVariableApiV1CozeVariablesVariablesUpdatePost**](CozeVariablesAPI.md#UpdateVariableApiV1CozeVariablesVariablesUpdatePost) | **Post** /api/v1/coze/variables/variables/update | Update Variable
[**UpdateVariableApiV1CozeVariablesVariablesUpdatePost_0**](CozeVariablesAPI.md#UpdateVariableApiV1CozeVariablesVariablesUpdatePost_0) | **Post** /api/v1/coze/variables/variables/update | Update Variable



## CreateVariableApiV1CozeVariablesVariablesCreatePost

> interface{} CreateVariableApiV1CozeVariablesVariablesCreatePost(ctx).CreateVarReq(createVarReq).Execute()

Create Variable

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
	createVarReq := *openapiclient.NewCreateVarReq("ConnectorId_example", "Keyword_example", "Value_example") // CreateVarReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeVariablesAPI.CreateVariableApiV1CozeVariablesVariablesCreatePost(context.Background()).CreateVarReq(createVarReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeVariablesAPI.CreateVariableApiV1CozeVariablesVariablesCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateVariableApiV1CozeVariablesVariablesCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeVariablesAPI.CreateVariableApiV1CozeVariablesVariablesCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateVariableApiV1CozeVariablesVariablesCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **createVarReq** | [**CreateVarReq**](CreateVarReq.md) |  | 

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


## CreateVariableApiV1CozeVariablesVariablesCreatePost_0

> interface{} CreateVariableApiV1CozeVariablesVariablesCreatePost_0(ctx).CreateVarReq(createVarReq).Execute()

Create Variable

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
	createVarReq := *openapiclient.NewCreateVarReq("ConnectorId_example", "Keyword_example", "Value_example") // CreateVarReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeVariablesAPI.CreateVariableApiV1CozeVariablesVariablesCreatePost_0(context.Background()).CreateVarReq(createVarReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeVariablesAPI.CreateVariableApiV1CozeVariablesVariablesCreatePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateVariableApiV1CozeVariablesVariablesCreatePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeVariablesAPI.CreateVariableApiV1CozeVariablesVariablesCreatePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateVariableApiV1CozeVariablesVariablesCreatePost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **createVarReq** | [**CreateVarReq**](CreateVarReq.md) |  | 

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


## DeleteVariableApiV1CozeVariablesVariablesDeletePost

> interface{} DeleteVariableApiV1CozeVariablesVariablesDeletePost(ctx).DeleteVarReq(deleteVarReq).Execute()

Delete Variable

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
	deleteVarReq := *openapiclient.NewDeleteVarReq("ConnectorId_example", "VariableId_example") // DeleteVarReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeVariablesAPI.DeleteVariableApiV1CozeVariablesVariablesDeletePost(context.Background()).DeleteVarReq(deleteVarReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeVariablesAPI.DeleteVariableApiV1CozeVariablesVariablesDeletePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteVariableApiV1CozeVariablesVariablesDeletePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeVariablesAPI.DeleteVariableApiV1CozeVariablesVariablesDeletePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteVariableApiV1CozeVariablesVariablesDeletePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **deleteVarReq** | [**DeleteVarReq**](DeleteVarReq.md) |  | 

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


## DeleteVariableApiV1CozeVariablesVariablesDeletePost_0

> interface{} DeleteVariableApiV1CozeVariablesVariablesDeletePost_0(ctx).DeleteVarReq(deleteVarReq).Execute()

Delete Variable

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
	deleteVarReq := *openapiclient.NewDeleteVarReq("ConnectorId_example", "VariableId_example") // DeleteVarReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeVariablesAPI.DeleteVariableApiV1CozeVariablesVariablesDeletePost_0(context.Background()).DeleteVarReq(deleteVarReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeVariablesAPI.DeleteVariableApiV1CozeVariablesVariablesDeletePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteVariableApiV1CozeVariablesVariablesDeletePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeVariablesAPI.DeleteVariableApiV1CozeVariablesVariablesDeletePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteVariableApiV1CozeVariablesVariablesDeletePost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **deleteVarReq** | [**DeleteVarReq**](DeleteVarReq.md) |  | 

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


## ListVariablesApiV1CozeVariablesVariablesListGet

> interface{} ListVariablesApiV1CozeVariablesVariablesListGet(ctx).ConnectorId(connectorId).Page(page).Size(size).Execute()

List Variables

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
	connectorId := "connectorId_example" // string | 
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeVariablesAPI.ListVariablesApiV1CozeVariablesVariablesListGet(context.Background()).ConnectorId(connectorId).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeVariablesAPI.ListVariablesApiV1CozeVariablesVariablesListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListVariablesApiV1CozeVariablesVariablesListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeVariablesAPI.ListVariablesApiV1CozeVariablesVariablesListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListVariablesApiV1CozeVariablesVariablesListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **connectorId** | **string** |  | 
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


## ListVariablesApiV1CozeVariablesVariablesListGet_0

> interface{} ListVariablesApiV1CozeVariablesVariablesListGet_0(ctx).ConnectorId(connectorId).Page(page).Size(size).Execute()

List Variables

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
	connectorId := "connectorId_example" // string | 
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeVariablesAPI.ListVariablesApiV1CozeVariablesVariablesListGet_0(context.Background()).ConnectorId(connectorId).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeVariablesAPI.ListVariablesApiV1CozeVariablesVariablesListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListVariablesApiV1CozeVariablesVariablesListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeVariablesAPI.ListVariablesApiV1CozeVariablesVariablesListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListVariablesApiV1CozeVariablesVariablesListGet_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **connectorId** | **string** |  | 
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


## RetrieveVariableApiV1CozeVariablesVariablesRetrieveGet

> interface{} RetrieveVariableApiV1CozeVariablesVariablesRetrieveGet(ctx).ConnectorId(connectorId).VariableId(variableId).Execute()

Retrieve Variable

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
	connectorId := "connectorId_example" // string | 
	variableId := "variableId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeVariablesAPI.RetrieveVariableApiV1CozeVariablesVariablesRetrieveGet(context.Background()).ConnectorId(connectorId).VariableId(variableId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeVariablesAPI.RetrieveVariableApiV1CozeVariablesVariablesRetrieveGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RetrieveVariableApiV1CozeVariablesVariablesRetrieveGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeVariablesAPI.RetrieveVariableApiV1CozeVariablesVariablesRetrieveGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRetrieveVariableApiV1CozeVariablesVariablesRetrieveGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **connectorId** | **string** |  | 
 **variableId** | **string** |  | 

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


## RetrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0

> interface{} RetrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0(ctx).ConnectorId(connectorId).VariableId(variableId).Execute()

Retrieve Variable

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
	connectorId := "connectorId_example" // string | 
	variableId := "variableId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeVariablesAPI.RetrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0(context.Background()).ConnectorId(connectorId).VariableId(variableId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeVariablesAPI.RetrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RetrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeVariablesAPI.RetrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRetrieveVariableApiV1CozeVariablesVariablesRetrieveGet_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **connectorId** | **string** |  | 
 **variableId** | **string** |  | 

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


## UpdateVariableApiV1CozeVariablesVariablesUpdatePost

> interface{} UpdateVariableApiV1CozeVariablesVariablesUpdatePost(ctx).UpdateVarReq(updateVarReq).Execute()

Update Variable

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
	updateVarReq := *openapiclient.NewUpdateVarReq("ConnectorId_example", "VariableId_example", "Value_example") // UpdateVarReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeVariablesAPI.UpdateVariableApiV1CozeVariablesVariablesUpdatePost(context.Background()).UpdateVarReq(updateVarReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeVariablesAPI.UpdateVariableApiV1CozeVariablesVariablesUpdatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateVariableApiV1CozeVariablesVariablesUpdatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeVariablesAPI.UpdateVariableApiV1CozeVariablesVariablesUpdatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateVariableApiV1CozeVariablesVariablesUpdatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **updateVarReq** | [**UpdateVarReq**](UpdateVarReq.md) |  | 

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


## UpdateVariableApiV1CozeVariablesVariablesUpdatePost_0

> interface{} UpdateVariableApiV1CozeVariablesVariablesUpdatePost_0(ctx).UpdateVarReq(updateVarReq).Execute()

Update Variable

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
	updateVarReq := *openapiclient.NewUpdateVarReq("ConnectorId_example", "VariableId_example", "Value_example") // UpdateVarReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeVariablesAPI.UpdateVariableApiV1CozeVariablesVariablesUpdatePost_0(context.Background()).UpdateVarReq(updateVarReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeVariablesAPI.UpdateVariableApiV1CozeVariablesVariablesUpdatePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateVariableApiV1CozeVariablesVariablesUpdatePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeVariablesAPI.UpdateVariableApiV1CozeVariablesVariablesUpdatePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateVariableApiV1CozeVariablesVariablesUpdatePost_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **updateVarReq** | [**UpdateVarReq**](UpdateVarReq.md) |  | 

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

