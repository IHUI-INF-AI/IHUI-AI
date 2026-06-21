# \FinanceFundAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AgentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost**](FinanceFundAPI.md#AgentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost) | **Post** /api/v1/finance/fund/agent/transfer/notify | Agent Transfer Notify
[**FileToStreamApiV1FinanceFundFileToStreamPost**](FinanceFundAPI.md#FileToStreamApiV1FinanceFundFileToStreamPost) | **Post** /api/v1/finance/fund/file/to/stream | File To Stream
[**FundAppNotifyApiV1FinanceFundAppNotifyPost**](FinanceFundAPI.md#FundAppNotifyApiV1FinanceFundAppNotifyPost) | **Post** /api/v1/finance/fund/app/notify | Fund App Notify
[**FundNotifyApiV1FinanceFundNotifyPost**](FinanceFundAPI.md#FundNotifyApiV1FinanceFundNotifyPost) | **Post** /api/v1/finance/fund/notify | Fund Notify
[**GetInfoApiV1FinanceFundGetInfoGet**](FinanceFundAPI.md#GetInfoApiV1FinanceFundGetInfoGet) | **Get** /api/v1/finance/fund/getInfo | Get Info
[**GetProductApiV1FinanceFundGetProductGet**](FinanceFundAPI.md#GetProductApiV1FinanceFundGetProductGet) | **Get** /api/v1/finance/fund/getProduct | Get Product
[**GetStatisticsApiV1FinanceFundGetStatisticsGet**](FinanceFundAPI.md#GetStatisticsApiV1FinanceFundGetStatisticsGet) | **Get** /api/v1/finance/fund/getStatistics | Get Statistics
[**UseTokenApiV1FinanceFundUseTokenPost**](FinanceFundAPI.md#UseTokenApiV1FinanceFundUseTokenPost) | **Post** /api/v1/finance/fund/useToken | Use Token



## AgentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost

> interface{} AgentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost(ctx).Execute()

Agent Transfer Notify

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
	resp, r, err := apiClient.FinanceFundAPI.AgentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceFundAPI.AgentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AgentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceFundAPI.AgentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiAgentTransferNotifyApiV1FinanceFundAgentTransferNotifyPostRequest struct via the builder pattern


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


## FileToStreamApiV1FinanceFundFileToStreamPost

> interface{} FileToStreamApiV1FinanceFundFileToStreamPost(ctx).Execute()

File To Stream

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
	resp, r, err := apiClient.FinanceFundAPI.FileToStreamApiV1FinanceFundFileToStreamPost(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceFundAPI.FileToStreamApiV1FinanceFundFileToStreamPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `FileToStreamApiV1FinanceFundFileToStreamPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceFundAPI.FileToStreamApiV1FinanceFundFileToStreamPost`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiFileToStreamApiV1FinanceFundFileToStreamPostRequest struct via the builder pattern


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


## FundAppNotifyApiV1FinanceFundAppNotifyPost

> interface{} FundAppNotifyApiV1FinanceFundAppNotifyPost(ctx).Execute()

Fund App Notify

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
	resp, r, err := apiClient.FinanceFundAPI.FundAppNotifyApiV1FinanceFundAppNotifyPost(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceFundAPI.FundAppNotifyApiV1FinanceFundAppNotifyPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `FundAppNotifyApiV1FinanceFundAppNotifyPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceFundAPI.FundAppNotifyApiV1FinanceFundAppNotifyPost`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiFundAppNotifyApiV1FinanceFundAppNotifyPostRequest struct via the builder pattern


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


## FundNotifyApiV1FinanceFundNotifyPost

> interface{} FundNotifyApiV1FinanceFundNotifyPost(ctx).Execute()

Fund Notify

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
	resp, r, err := apiClient.FinanceFundAPI.FundNotifyApiV1FinanceFundNotifyPost(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceFundAPI.FundNotifyApiV1FinanceFundNotifyPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `FundNotifyApiV1FinanceFundNotifyPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceFundAPI.FundNotifyApiV1FinanceFundNotifyPost`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiFundNotifyApiV1FinanceFundNotifyPostRequest struct via the builder pattern


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


## GetInfoApiV1FinanceFundGetInfoGet

> interface{} GetInfoApiV1FinanceFundGetInfoGet(ctx).Token(token).Execute()

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
	token := "token_example" // string | user uuid

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceFundAPI.GetInfoApiV1FinanceFundGetInfoGet(context.Background()).Token(token).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceFundAPI.GetInfoApiV1FinanceFundGetInfoGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetInfoApiV1FinanceFundGetInfoGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceFundAPI.GetInfoApiV1FinanceFundGetInfoGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetInfoApiV1FinanceFundGetInfoGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **token** | **string** | user uuid | 

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


## GetProductApiV1FinanceFundGetProductGet

> interface{} GetProductApiV1FinanceFundGetProductGet(ctx).Execute()

Get Product

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
	resp, r, err := apiClient.FinanceFundAPI.GetProductApiV1FinanceFundGetProductGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceFundAPI.GetProductApiV1FinanceFundGetProductGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetProductApiV1FinanceFundGetProductGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceFundAPI.GetProductApiV1FinanceFundGetProductGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetProductApiV1FinanceFundGetProductGetRequest struct via the builder pattern


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


## GetStatisticsApiV1FinanceFundGetStatisticsGet

> interface{} GetStatisticsApiV1FinanceFundGetStatisticsGet(ctx).Execute()

Get Statistics

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
	resp, r, err := apiClient.FinanceFundAPI.GetStatisticsApiV1FinanceFundGetStatisticsGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceFundAPI.GetStatisticsApiV1FinanceFundGetStatisticsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetStatisticsApiV1FinanceFundGetStatisticsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceFundAPI.GetStatisticsApiV1FinanceFundGetStatisticsGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetStatisticsApiV1FinanceFundGetStatisticsGetRequest struct via the builder pattern


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


## UseTokenApiV1FinanceFundUseTokenPost

> interface{} UseTokenApiV1FinanceFundUseTokenPost(ctx).Platform(platform).Execute()

Use Token

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
	platform := "platform_example" // string |  (optional) (default to "WEB")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FinanceFundAPI.UseTokenApiV1FinanceFundUseTokenPost(context.Background()).Platform(platform).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FinanceFundAPI.UseTokenApiV1FinanceFundUseTokenPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UseTokenApiV1FinanceFundUseTokenPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FinanceFundAPI.UseTokenApiV1FinanceFundUseTokenPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUseTokenApiV1FinanceFundUseTokenPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **platform** | **string** |  | [default to &quot;WEB&quot;]

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

