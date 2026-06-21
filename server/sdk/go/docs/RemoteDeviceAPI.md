# \RemoteDeviceAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AgentByCollectApiV1RemoteAgentByCollectUuidGet**](RemoteDeviceAPI.md#AgentByCollectApiV1RemoteAgentByCollectUuidGet) | **Get** /api/v1/remote/agent/by/collect/{uuid} | Agent By Collect
[**AgentByCollectApiV1RemoteAgentByCollectUuidGet_0**](RemoteDeviceAPI.md#AgentByCollectApiV1RemoteAgentByCollectUuidGet_0) | **Get** /api/v1/remote/agent/by/collect/{uuid} | Agent By Collect
[**AgentByPayApiV1RemoteAgentByPayGet**](RemoteDeviceAPI.md#AgentByPayApiV1RemoteAgentByPayGet) | **Get** /api/v1/remote/agent/by/pay | Agent By Pay
[**AgentByPayApiV1RemoteAgentByPayGet_0**](RemoteDeviceAPI.md#AgentByPayApiV1RemoteAgentByPayGet_0) | **Get** /api/v1/remote/agent/by/pay | Agent By Pay
[**AgentByTypeApiV1RemoteAgentByTypeGet**](RemoteDeviceAPI.md#AgentByTypeApiV1RemoteAgentByTypeGet) | **Get** /api/v1/remote/agent/by/type | Agent By Type
[**AgentByTypeApiV1RemoteAgentByTypeGet_0**](RemoteDeviceAPI.md#AgentByTypeApiV1RemoteAgentByTypeGet_0) | **Get** /api/v1/remote/agent/by/type | Agent By Type
[**AgentCategory2ApiV1RemoteAgentCategory2Get**](RemoteDeviceAPI.md#AgentCategory2ApiV1RemoteAgentCategory2Get) | **Get** /api/v1/remote/agent/category2 | Agent Category2
[**AgentCategory2ApiV1RemoteAgentCategory2Get_0**](RemoteDeviceAPI.md#AgentCategory2ApiV1RemoteAgentCategory2Get_0) | **Get** /api/v1/remote/agent/category2 | Agent Category2
[**AgentCategoryApiV1RemoteAgentCategoryGet**](RemoteDeviceAPI.md#AgentCategoryApiV1RemoteAgentCategoryGet) | **Get** /api/v1/remote/agent/category | Agent Category
[**AgentCategoryApiV1RemoteAgentCategoryGet_0**](RemoteDeviceAPI.md#AgentCategoryApiV1RemoteAgentCategoryGet_0) | **Get** /api/v1/remote/agent/category | Agent Category
[**GetInfoApiV1RemoteInfoUuidGet**](RemoteDeviceAPI.md#GetInfoApiV1RemoteInfoUuidGet) | **Get** /api/v1/remote/info/{uuid} | Get Info
[**GetInfoApiV1RemoteInfoUuidGet_0**](RemoteDeviceAPI.md#GetInfoApiV1RemoteInfoUuidGet_0) | **Get** /api/v1/remote/info/{uuid} | Get Info
[**GetRoleApiV1RemoteRoleGet**](RemoteDeviceAPI.md#GetRoleApiV1RemoteRoleGet) | **Get** /api/v1/remote/role | Get Role
[**GetRoleApiV1RemoteRoleGet_0**](RemoteDeviceAPI.md#GetRoleApiV1RemoteRoleGet_0) | **Get** /api/v1/remote/role | Get Role
[**GetWithdrawalOpenApiV1RemoteGetTrueGet**](RemoteDeviceAPI.md#GetWithdrawalOpenApiV1RemoteGetTrueGet) | **Get** /api/v1/remote/get/true | Get Withdrawal Open
[**GetWithdrawalOpenApiV1RemoteGetTrueGet_0**](RemoteDeviceAPI.md#GetWithdrawalOpenApiV1RemoteGetTrueGet_0) | **Get** /api/v1/remote/get/true | Get Withdrawal Open
[**MyTeamApiV1RemoteMyTeamUuidPost**](RemoteDeviceAPI.md#MyTeamApiV1RemoteMyTeamUuidPost) | **Post** /api/v1/remote/myTeam/{uuid} | My Team
[**MyTeamApiV1RemoteMyTeamUuidPost_0**](RemoteDeviceAPI.md#MyTeamApiV1RemoteMyTeamUuidPost_0) | **Post** /api/v1/remote/myTeam/{uuid} | My Team
[**TencentAsrApiV1RemoteGetTencentSentencePost**](RemoteDeviceAPI.md#TencentAsrApiV1RemoteGetTencentSentencePost) | **Post** /api/v1/remote/get/tencent/sentence | Tencent Asr
[**TencentAsrApiV1RemoteGetTencentSentencePost_0**](RemoteDeviceAPI.md#TencentAsrApiV1RemoteGetTencentSentencePost_0) | **Post** /api/v1/remote/get/tencent/sentence | Tencent Asr
[**UploadBusinessCardApiV1RemoteUploadBusinessCardPost**](RemoteDeviceAPI.md#UploadBusinessCardApiV1RemoteUploadBusinessCardPost) | **Post** /api/v1/remote/uploadBusinessCard | Upload Business Card
[**UploadBusinessCardApiV1RemoteUploadBusinessCardPost_0**](RemoteDeviceAPI.md#UploadBusinessCardApiV1RemoteUploadBusinessCardPost_0) | **Post** /api/v1/remote/uploadBusinessCard | Upload Business Card



## AgentByCollectApiV1RemoteAgentByCollectUuidGet

> interface{} AgentByCollectApiV1RemoteAgentByCollectUuidGet(ctx, uuid).Search(search).Page(page).Size(size).Execute()

Agent By Collect



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
	uuid := "uuid_example" // string | 
	search := "search_example" // string |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RemoteDeviceAPI.AgentByCollectApiV1RemoteAgentByCollectUuidGet(context.Background(), uuid).Search(search).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.AgentByCollectApiV1RemoteAgentByCollectUuidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AgentByCollectApiV1RemoteAgentByCollectUuidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.AgentByCollectApiV1RemoteAgentByCollectUuidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**uuid** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiAgentByCollectApiV1RemoteAgentByCollectUuidGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **search** | **string** |  | 
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


## AgentByCollectApiV1RemoteAgentByCollectUuidGet_0

> interface{} AgentByCollectApiV1RemoteAgentByCollectUuidGet_0(ctx, uuid).Search(search).Page(page).Size(size).Execute()

Agent By Collect



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
	uuid := "uuid_example" // string | 
	search := "search_example" // string |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RemoteDeviceAPI.AgentByCollectApiV1RemoteAgentByCollectUuidGet_0(context.Background(), uuid).Search(search).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.AgentByCollectApiV1RemoteAgentByCollectUuidGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AgentByCollectApiV1RemoteAgentByCollectUuidGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.AgentByCollectApiV1RemoteAgentByCollectUuidGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**uuid** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiAgentByCollectApiV1RemoteAgentByCollectUuidGet_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **search** | **string** |  | 
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


## AgentByPayApiV1RemoteAgentByPayGet

> interface{} AgentByPayApiV1RemoteAgentByPayGet(ctx).Uuid(uuid).Search(search).Type_(type_).Date(date).Page(page).Size(size).Execute()

Agent By Pay



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
	uuid := "uuid_example" // string | 
	search := "search_example" // string |  (optional)
	type_ := int32(56) // int32 |  (optional)
	date := "date_example" // string |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RemoteDeviceAPI.AgentByPayApiV1RemoteAgentByPayGet(context.Background()).Uuid(uuid).Search(search).Type_(type_).Date(date).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.AgentByPayApiV1RemoteAgentByPayGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AgentByPayApiV1RemoteAgentByPayGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.AgentByPayApiV1RemoteAgentByPayGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAgentByPayApiV1RemoteAgentByPayGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **uuid** | **string** |  | 
 **search** | **string** |  | 
 **type_** | **int32** |  | 
 **date** | **string** |  | 
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


## AgentByPayApiV1RemoteAgentByPayGet_0

> interface{} AgentByPayApiV1RemoteAgentByPayGet_0(ctx).Uuid(uuid).Search(search).Type_(type_).Date(date).Page(page).Size(size).Execute()

Agent By Pay



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
	uuid := "uuid_example" // string | 
	search := "search_example" // string |  (optional)
	type_ := int32(56) // int32 |  (optional)
	date := "date_example" // string |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RemoteDeviceAPI.AgentByPayApiV1RemoteAgentByPayGet_0(context.Background()).Uuid(uuid).Search(search).Type_(type_).Date(date).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.AgentByPayApiV1RemoteAgentByPayGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AgentByPayApiV1RemoteAgentByPayGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.AgentByPayApiV1RemoteAgentByPayGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAgentByPayApiV1RemoteAgentByPayGet_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **uuid** | **string** |  | 
 **search** | **string** |  | 
 **type_** | **int32** |  | 
 **date** | **string** |  | 
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


## AgentByTypeApiV1RemoteAgentByTypeGet

> interface{} AgentByTypeApiV1RemoteAgentByTypeGet(ctx).Search(search).Code(code).Page(page).Size(size).Execute()

Agent By Type



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
	search := "search_example" // string |  (optional)
	code := "code_example" // string |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RemoteDeviceAPI.AgentByTypeApiV1RemoteAgentByTypeGet(context.Background()).Search(search).Code(code).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.AgentByTypeApiV1RemoteAgentByTypeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AgentByTypeApiV1RemoteAgentByTypeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.AgentByTypeApiV1RemoteAgentByTypeGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAgentByTypeApiV1RemoteAgentByTypeGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **search** | **string** |  | 
 **code** | **string** |  | 
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


## AgentByTypeApiV1RemoteAgentByTypeGet_0

> interface{} AgentByTypeApiV1RemoteAgentByTypeGet_0(ctx).Search(search).Code(code).Page(page).Size(size).Execute()

Agent By Type



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
	search := "search_example" // string |  (optional)
	code := "code_example" // string |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RemoteDeviceAPI.AgentByTypeApiV1RemoteAgentByTypeGet_0(context.Background()).Search(search).Code(code).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.AgentByTypeApiV1RemoteAgentByTypeGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AgentByTypeApiV1RemoteAgentByTypeGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.AgentByTypeApiV1RemoteAgentByTypeGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAgentByTypeApiV1RemoteAgentByTypeGet_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **search** | **string** |  | 
 **code** | **string** |  | 
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


## AgentCategory2ApiV1RemoteAgentCategory2Get

> interface{} AgentCategory2ApiV1RemoteAgentCategory2Get(ctx).Type_(type_).Execute()

Agent Category2



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
	type_ := "type__example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RemoteDeviceAPI.AgentCategory2ApiV1RemoteAgentCategory2Get(context.Background()).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.AgentCategory2ApiV1RemoteAgentCategory2Get``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AgentCategory2ApiV1RemoteAgentCategory2Get`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.AgentCategory2ApiV1RemoteAgentCategory2Get`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAgentCategory2ApiV1RemoteAgentCategory2GetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type_** | **string** |  | 

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


## AgentCategory2ApiV1RemoteAgentCategory2Get_0

> interface{} AgentCategory2ApiV1RemoteAgentCategory2Get_0(ctx).Type_(type_).Execute()

Agent Category2



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
	type_ := "type__example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RemoteDeviceAPI.AgentCategory2ApiV1RemoteAgentCategory2Get_0(context.Background()).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.AgentCategory2ApiV1RemoteAgentCategory2Get_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AgentCategory2ApiV1RemoteAgentCategory2Get_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.AgentCategory2ApiV1RemoteAgentCategory2Get_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAgentCategory2ApiV1RemoteAgentCategory2Get_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type_** | **string** |  | 

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


## AgentCategoryApiV1RemoteAgentCategoryGet

> interface{} AgentCategoryApiV1RemoteAgentCategoryGet(ctx).Type_(type_).Execute()

Agent Category



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
	type_ := "type__example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RemoteDeviceAPI.AgentCategoryApiV1RemoteAgentCategoryGet(context.Background()).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.AgentCategoryApiV1RemoteAgentCategoryGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AgentCategoryApiV1RemoteAgentCategoryGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.AgentCategoryApiV1RemoteAgentCategoryGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAgentCategoryApiV1RemoteAgentCategoryGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type_** | **string** |  | 

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


## AgentCategoryApiV1RemoteAgentCategoryGet_0

> interface{} AgentCategoryApiV1RemoteAgentCategoryGet_0(ctx).Type_(type_).Execute()

Agent Category



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
	type_ := "type__example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RemoteDeviceAPI.AgentCategoryApiV1RemoteAgentCategoryGet_0(context.Background()).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.AgentCategoryApiV1RemoteAgentCategoryGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AgentCategoryApiV1RemoteAgentCategoryGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.AgentCategoryApiV1RemoteAgentCategoryGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAgentCategoryApiV1RemoteAgentCategoryGet_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type_** | **string** |  | 

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


## GetInfoApiV1RemoteInfoUuidGet

> interface{} GetInfoApiV1RemoteInfoUuidGet(ctx, uuid).XDeviceType(xDeviceType).Execute()

Get Info



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
	uuid := "uuid_example" // string | 
	xDeviceType := "xDeviceType_example" // string |  (optional) (default to "unknown")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RemoteDeviceAPI.GetInfoApiV1RemoteInfoUuidGet(context.Background(), uuid).XDeviceType(xDeviceType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.GetInfoApiV1RemoteInfoUuidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetInfoApiV1RemoteInfoUuidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.GetInfoApiV1RemoteInfoUuidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**uuid** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetInfoApiV1RemoteInfoUuidGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xDeviceType** | **string** |  | [default to &quot;unknown&quot;]

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


## GetInfoApiV1RemoteInfoUuidGet_0

> interface{} GetInfoApiV1RemoteInfoUuidGet_0(ctx, uuid).XDeviceType(xDeviceType).Execute()

Get Info



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
	uuid := "uuid_example" // string | 
	xDeviceType := "xDeviceType_example" // string |  (optional) (default to "unknown")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RemoteDeviceAPI.GetInfoApiV1RemoteInfoUuidGet_0(context.Background(), uuid).XDeviceType(xDeviceType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.GetInfoApiV1RemoteInfoUuidGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetInfoApiV1RemoteInfoUuidGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.GetInfoApiV1RemoteInfoUuidGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**uuid** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetInfoApiV1RemoteInfoUuidGet_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xDeviceType** | **string** |  | [default to &quot;unknown&quot;]

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


## GetRoleApiV1RemoteRoleGet

> interface{} GetRoleApiV1RemoteRoleGet(ctx).Execute()

Get Role



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
	resp, r, err := apiClient.RemoteDeviceAPI.GetRoleApiV1RemoteRoleGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.GetRoleApiV1RemoteRoleGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetRoleApiV1RemoteRoleGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.GetRoleApiV1RemoteRoleGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetRoleApiV1RemoteRoleGetRequest struct via the builder pattern


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


## GetRoleApiV1RemoteRoleGet_0

> interface{} GetRoleApiV1RemoteRoleGet_0(ctx).Execute()

Get Role



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
	resp, r, err := apiClient.RemoteDeviceAPI.GetRoleApiV1RemoteRoleGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.GetRoleApiV1RemoteRoleGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetRoleApiV1RemoteRoleGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.GetRoleApiV1RemoteRoleGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetRoleApiV1RemoteRoleGet_7Request struct via the builder pattern


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


## GetWithdrawalOpenApiV1RemoteGetTrueGet

> interface{} GetWithdrawalOpenApiV1RemoteGetTrueGet(ctx).Execute()

Get Withdrawal Open



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
	resp, r, err := apiClient.RemoteDeviceAPI.GetWithdrawalOpenApiV1RemoteGetTrueGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.GetWithdrawalOpenApiV1RemoteGetTrueGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetWithdrawalOpenApiV1RemoteGetTrueGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.GetWithdrawalOpenApiV1RemoteGetTrueGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetWithdrawalOpenApiV1RemoteGetTrueGetRequest struct via the builder pattern


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


## GetWithdrawalOpenApiV1RemoteGetTrueGet_0

> interface{} GetWithdrawalOpenApiV1RemoteGetTrueGet_0(ctx).Execute()

Get Withdrawal Open



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
	resp, r, err := apiClient.RemoteDeviceAPI.GetWithdrawalOpenApiV1RemoteGetTrueGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.GetWithdrawalOpenApiV1RemoteGetTrueGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetWithdrawalOpenApiV1RemoteGetTrueGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.GetWithdrawalOpenApiV1RemoteGetTrueGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetWithdrawalOpenApiV1RemoteGetTrueGet_8Request struct via the builder pattern


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


## MyTeamApiV1RemoteMyTeamUuidPost

> interface{} MyTeamApiV1RemoteMyTeamUuidPost(ctx, uuid).XDeviceType(xDeviceType).MyTeamQuery(myTeamQuery).Execute()

My Team



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
	uuid := "uuid_example" // string | 
	xDeviceType := "xDeviceType_example" // string |  (optional) (default to "unknown")
	myTeamQuery := *openapiclient.NewMyTeamQuery() // MyTeamQuery |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RemoteDeviceAPI.MyTeamApiV1RemoteMyTeamUuidPost(context.Background(), uuid).XDeviceType(xDeviceType).MyTeamQuery(myTeamQuery).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.MyTeamApiV1RemoteMyTeamUuidPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MyTeamApiV1RemoteMyTeamUuidPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.MyTeamApiV1RemoteMyTeamUuidPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**uuid** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiMyTeamApiV1RemoteMyTeamUuidPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xDeviceType** | **string** |  | [default to &quot;unknown&quot;]
 **myTeamQuery** | [**MyTeamQuery**](MyTeamQuery.md) |  | 

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


## MyTeamApiV1RemoteMyTeamUuidPost_0

> interface{} MyTeamApiV1RemoteMyTeamUuidPost_0(ctx, uuid).XDeviceType(xDeviceType).MyTeamQuery(myTeamQuery).Execute()

My Team



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
	uuid := "uuid_example" // string | 
	xDeviceType := "xDeviceType_example" // string |  (optional) (default to "unknown")
	myTeamQuery := *openapiclient.NewMyTeamQuery() // MyTeamQuery |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RemoteDeviceAPI.MyTeamApiV1RemoteMyTeamUuidPost_0(context.Background(), uuid).XDeviceType(xDeviceType).MyTeamQuery(myTeamQuery).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.MyTeamApiV1RemoteMyTeamUuidPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MyTeamApiV1RemoteMyTeamUuidPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.MyTeamApiV1RemoteMyTeamUuidPost_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**uuid** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiMyTeamApiV1RemoteMyTeamUuidPost_9Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xDeviceType** | **string** |  | [default to &quot;unknown&quot;]
 **myTeamQuery** | [**MyTeamQuery**](MyTeamQuery.md) |  | 

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


## TencentAsrApiV1RemoteGetTencentSentencePost

> interface{} TencentAsrApiV1RemoteGetTencentSentencePost(ctx).TencentAsrReq(tencentAsrReq).Execute()

Tencent Asr



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
	tencentAsrReq := *openapiclient.NewTencentAsrReq("File_example") // TencentAsrReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RemoteDeviceAPI.TencentAsrApiV1RemoteGetTencentSentencePost(context.Background()).TencentAsrReq(tencentAsrReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.TencentAsrApiV1RemoteGetTencentSentencePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TencentAsrApiV1RemoteGetTencentSentencePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.TencentAsrApiV1RemoteGetTencentSentencePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTencentAsrApiV1RemoteGetTencentSentencePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tencentAsrReq** | [**TencentAsrReq**](TencentAsrReq.md) |  | 

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


## TencentAsrApiV1RemoteGetTencentSentencePost_0

> interface{} TencentAsrApiV1RemoteGetTencentSentencePost_0(ctx).TencentAsrReq(tencentAsrReq).Execute()

Tencent Asr



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
	tencentAsrReq := *openapiclient.NewTencentAsrReq("File_example") // TencentAsrReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RemoteDeviceAPI.TencentAsrApiV1RemoteGetTencentSentencePost_0(context.Background()).TencentAsrReq(tencentAsrReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.TencentAsrApiV1RemoteGetTencentSentencePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TencentAsrApiV1RemoteGetTencentSentencePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.TencentAsrApiV1RemoteGetTencentSentencePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTencentAsrApiV1RemoteGetTencentSentencePost_10Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tencentAsrReq** | [**TencentAsrReq**](TencentAsrReq.md) |  | 

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


## UploadBusinessCardApiV1RemoteUploadBusinessCardPost

> interface{} UploadBusinessCardApiV1RemoteUploadBusinessCardPost(ctx).BusinessCardReq(businessCardReq).XDeviceType(xDeviceType).Execute()

Upload Business Card



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
	businessCardReq := *openapiclient.NewBusinessCardReq("Id_example", "Card_example") // BusinessCardReq | 
	xDeviceType := "xDeviceType_example" // string |  (optional) (default to "unknown")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RemoteDeviceAPI.UploadBusinessCardApiV1RemoteUploadBusinessCardPost(context.Background()).BusinessCardReq(businessCardReq).XDeviceType(xDeviceType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.UploadBusinessCardApiV1RemoteUploadBusinessCardPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UploadBusinessCardApiV1RemoteUploadBusinessCardPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.UploadBusinessCardApiV1RemoteUploadBusinessCardPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUploadBusinessCardApiV1RemoteUploadBusinessCardPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **businessCardReq** | [**BusinessCardReq**](BusinessCardReq.md) |  | 
 **xDeviceType** | **string** |  | [default to &quot;unknown&quot;]

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


## UploadBusinessCardApiV1RemoteUploadBusinessCardPost_0

> interface{} UploadBusinessCardApiV1RemoteUploadBusinessCardPost_0(ctx).BusinessCardReq(businessCardReq).XDeviceType(xDeviceType).Execute()

Upload Business Card



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
	businessCardReq := *openapiclient.NewBusinessCardReq("Id_example", "Card_example") // BusinessCardReq | 
	xDeviceType := "xDeviceType_example" // string |  (optional) (default to "unknown")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RemoteDeviceAPI.UploadBusinessCardApiV1RemoteUploadBusinessCardPost_0(context.Background()).BusinessCardReq(businessCardReq).XDeviceType(xDeviceType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteDeviceAPI.UploadBusinessCardApiV1RemoteUploadBusinessCardPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UploadBusinessCardApiV1RemoteUploadBusinessCardPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteDeviceAPI.UploadBusinessCardApiV1RemoteUploadBusinessCardPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUploadBusinessCardApiV1RemoteUploadBusinessCardPost_11Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **businessCardReq** | [**BusinessCardReq**](BusinessCardReq.md) |  | 
 **xDeviceType** | **string** |  | [default to &quot;unknown&quot;]

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

