# \MonitorCanaryPromoterOverrideAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetOverrideApiV1MonitorCanaryPromoterOverrideGet**](MonitorCanaryPromoterOverrideAPI.md#GetOverrideApiV1MonitorCanaryPromoterOverrideGet) | **Get** /api/v1/monitor/canary-promoter/override | Get Override
[**GetPromoterStatusApiV1MonitorCanaryPromoterStatusGet**](MonitorCanaryPromoterOverrideAPI.md#GetPromoterStatusApiV1MonitorCanaryPromoterStatusGet) | **Get** /api/v1/monitor/canary-promoter/status | Get Promoter Status
[**PostForcePromoteApiV1MonitorCanaryPromoterForcePromotePost**](MonitorCanaryPromoterOverrideAPI.md#PostForcePromoteApiV1MonitorCanaryPromoterForcePromotePost) | **Post** /api/v1/monitor/canary-promoter/force-promote | Post Force Promote
[**PostForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost**](MonitorCanaryPromoterOverrideAPI.md#PostForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost) | **Post** /api/v1/monitor/canary-promoter/force-rollback | Post Force Rollback
[**PostPauseOverrideApiV1MonitorCanaryPromoterPausePost**](MonitorCanaryPromoterOverrideAPI.md#PostPauseOverrideApiV1MonitorCanaryPromoterPausePost) | **Post** /api/v1/monitor/canary-promoter/pause | Post Pause Override
[**PostResumeOverrideApiV1MonitorCanaryPromoterResumePost**](MonitorCanaryPromoterOverrideAPI.md#PostResumeOverrideApiV1MonitorCanaryPromoterResumePost) | **Post** /api/v1/monitor/canary-promoter/resume | Post Resume Override



## GetOverrideApiV1MonitorCanaryPromoterOverrideGet

> ApiResponse GetOverrideApiV1MonitorCanaryPromoterOverrideGet(ctx).Execute()

Get Override



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
	resp, r, err := apiClient.MonitorCanaryPromoterOverrideAPI.GetOverrideApiV1MonitorCanaryPromoterOverrideGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorCanaryPromoterOverrideAPI.GetOverrideApiV1MonitorCanaryPromoterOverrideGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetOverrideApiV1MonitorCanaryPromoterOverrideGet`: ApiResponse
	fmt.Fprintf(os.Stdout, "Response from `MonitorCanaryPromoterOverrideAPI.GetOverrideApiV1MonitorCanaryPromoterOverrideGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetOverrideApiV1MonitorCanaryPromoterOverrideGetRequest struct via the builder pattern


### Return type

[**ApiResponse**](ApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetPromoterStatusApiV1MonitorCanaryPromoterStatusGet

> ApiResponse GetPromoterStatusApiV1MonitorCanaryPromoterStatusGet(ctx).Execute()

Get Promoter Status



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
	resp, r, err := apiClient.MonitorCanaryPromoterOverrideAPI.GetPromoterStatusApiV1MonitorCanaryPromoterStatusGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorCanaryPromoterOverrideAPI.GetPromoterStatusApiV1MonitorCanaryPromoterStatusGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetPromoterStatusApiV1MonitorCanaryPromoterStatusGet`: ApiResponse
	fmt.Fprintf(os.Stdout, "Response from `MonitorCanaryPromoterOverrideAPI.GetPromoterStatusApiV1MonitorCanaryPromoterStatusGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetPromoterStatusApiV1MonitorCanaryPromoterStatusGetRequest struct via the builder pattern


### Return type

[**ApiResponse**](ApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## PostForcePromoteApiV1MonitorCanaryPromoterForcePromotePost

> ApiResponse PostForcePromoteApiV1MonitorCanaryPromoterForcePromotePost(ctx).ForcePromoteRequest(forcePromoteRequest).Execute()

Post Force Promote



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
	forcePromoteRequest := *openapiclient.NewForcePromoteRequest("Reason_example") // ForcePromoteRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MonitorCanaryPromoterOverrideAPI.PostForcePromoteApiV1MonitorCanaryPromoterForcePromotePost(context.Background()).ForcePromoteRequest(forcePromoteRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorCanaryPromoterOverrideAPI.PostForcePromoteApiV1MonitorCanaryPromoterForcePromotePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PostForcePromoteApiV1MonitorCanaryPromoterForcePromotePost`: ApiResponse
	fmt.Fprintf(os.Stdout, "Response from `MonitorCanaryPromoterOverrideAPI.PostForcePromoteApiV1MonitorCanaryPromoterForcePromotePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPostForcePromoteApiV1MonitorCanaryPromoterForcePromotePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **forcePromoteRequest** | [**ForcePromoteRequest**](ForcePromoteRequest.md) |  | 

### Return type

[**ApiResponse**](ApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## PostForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost

> ApiResponse PostForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost(ctx).ForceRollbackRequest(forceRollbackRequest).Execute()

Post Force Rollback



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
	forceRollbackRequest := *openapiclient.NewForceRollbackRequest("Reason_example") // ForceRollbackRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MonitorCanaryPromoterOverrideAPI.PostForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost(context.Background()).ForceRollbackRequest(forceRollbackRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorCanaryPromoterOverrideAPI.PostForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PostForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost`: ApiResponse
	fmt.Fprintf(os.Stdout, "Response from `MonitorCanaryPromoterOverrideAPI.PostForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPostForceRollbackApiV1MonitorCanaryPromoterForceRollbackPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **forceRollbackRequest** | [**ForceRollbackRequest**](ForceRollbackRequest.md) |  | 

### Return type

[**ApiResponse**](ApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## PostPauseOverrideApiV1MonitorCanaryPromoterPausePost

> ApiResponse PostPauseOverrideApiV1MonitorCanaryPromoterPausePost(ctx).OverridePauseRequest(overridePauseRequest).Execute()

Post Pause Override



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
	overridePauseRequest := *openapiclient.NewOverridePauseRequest("Reason_example") // OverridePauseRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MonitorCanaryPromoterOverrideAPI.PostPauseOverrideApiV1MonitorCanaryPromoterPausePost(context.Background()).OverridePauseRequest(overridePauseRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorCanaryPromoterOverrideAPI.PostPauseOverrideApiV1MonitorCanaryPromoterPausePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PostPauseOverrideApiV1MonitorCanaryPromoterPausePost`: ApiResponse
	fmt.Fprintf(os.Stdout, "Response from `MonitorCanaryPromoterOverrideAPI.PostPauseOverrideApiV1MonitorCanaryPromoterPausePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPostPauseOverrideApiV1MonitorCanaryPromoterPausePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **overridePauseRequest** | [**OverridePauseRequest**](OverridePauseRequest.md) |  | 

### Return type

[**ApiResponse**](ApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## PostResumeOverrideApiV1MonitorCanaryPromoterResumePost

> ApiResponse PostResumeOverrideApiV1MonitorCanaryPromoterResumePost(ctx).OverrideResumeRequest(overrideResumeRequest).Execute()

Post Resume Override



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
	overrideResumeRequest := *openapiclient.NewOverrideResumeRequest() // OverrideResumeRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MonitorCanaryPromoterOverrideAPI.PostResumeOverrideApiV1MonitorCanaryPromoterResumePost(context.Background()).OverrideResumeRequest(overrideResumeRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorCanaryPromoterOverrideAPI.PostResumeOverrideApiV1MonitorCanaryPromoterResumePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PostResumeOverrideApiV1MonitorCanaryPromoterResumePost`: ApiResponse
	fmt.Fprintf(os.Stdout, "Response from `MonitorCanaryPromoterOverrideAPI.PostResumeOverrideApiV1MonitorCanaryPromoterResumePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPostResumeOverrideApiV1MonitorCanaryPromoterResumePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **overrideResumeRequest** | [**OverrideResumeRequest**](OverrideResumeRequest.md) |  | 

### Return type

[**ApiResponse**](ApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

