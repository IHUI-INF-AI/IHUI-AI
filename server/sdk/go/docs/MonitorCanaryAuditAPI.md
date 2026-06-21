# \MonitorCanaryAuditAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost**](MonitorCanaryAuditAPI.md#CanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost) | **Post** /api/v1/monitor/canary-audit/cleanup | Canary Audit Cleanup
[**CanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0**](MonitorCanaryAuditAPI.md#CanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0) | **Post** /api/v1/monitor/canary-audit/cleanup | Canary Audit Cleanup
[**CanaryAuditStatsApiV1MonitorCanaryAuditStatsGet**](MonitorCanaryAuditAPI.md#CanaryAuditStatsApiV1MonitorCanaryAuditStatsGet) | **Get** /api/v1/monitor/canary-audit/stats | Canary Audit Stats
[**CanaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0**](MonitorCanaryAuditAPI.md#CanaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0) | **Get** /api/v1/monitor/canary-audit/stats | Canary Audit Stats
[**QueryCanaryAuditApiV1MonitorCanaryAuditGet**](MonitorCanaryAuditAPI.md#QueryCanaryAuditApiV1MonitorCanaryAuditGet) | **Get** /api/v1/monitor/canary-audit | Query Canary Audit
[**QueryCanaryAuditApiV1MonitorCanaryAuditGet_0**](MonitorCanaryAuditAPI.md#QueryCanaryAuditApiV1MonitorCanaryAuditGet_0) | **Get** /api/v1/monitor/canary-audit | Query Canary Audit



## CanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost

> ApiResponse CanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost(ctx).Execute()

Canary Audit Cleanup



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
	resp, r, err := apiClient.MonitorCanaryAuditAPI.CanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorCanaryAuditAPI.CanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost`: ApiResponse
	fmt.Fprintf(os.Stdout, "Response from `MonitorCanaryAuditAPI.CanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPostRequest struct via the builder pattern


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


## CanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0

> ApiResponse CanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0(ctx).Execute()

Canary Audit Cleanup



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
	resp, r, err := apiClient.MonitorCanaryAuditAPI.CanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorCanaryAuditAPI.CanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0`: ApiResponse
	fmt.Fprintf(os.Stdout, "Response from `MonitorCanaryAuditAPI.CanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCanaryAuditCleanupApiV1MonitorCanaryAuditCleanupPost_1Request struct via the builder pattern


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


## CanaryAuditStatsApiV1MonitorCanaryAuditStatsGet

> ApiResponse CanaryAuditStatsApiV1MonitorCanaryAuditStatsGet(ctx).Execute()

Canary Audit Stats



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
	resp, r, err := apiClient.MonitorCanaryAuditAPI.CanaryAuditStatsApiV1MonitorCanaryAuditStatsGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorCanaryAuditAPI.CanaryAuditStatsApiV1MonitorCanaryAuditStatsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CanaryAuditStatsApiV1MonitorCanaryAuditStatsGet`: ApiResponse
	fmt.Fprintf(os.Stdout, "Response from `MonitorCanaryAuditAPI.CanaryAuditStatsApiV1MonitorCanaryAuditStatsGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCanaryAuditStatsApiV1MonitorCanaryAuditStatsGetRequest struct via the builder pattern


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


## CanaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0

> ApiResponse CanaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0(ctx).Execute()

Canary Audit Stats



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
	resp, r, err := apiClient.MonitorCanaryAuditAPI.CanaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorCanaryAuditAPI.CanaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CanaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0`: ApiResponse
	fmt.Fprintf(os.Stdout, "Response from `MonitorCanaryAuditAPI.CanaryAuditStatsApiV1MonitorCanaryAuditStatsGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCanaryAuditStatsApiV1MonitorCanaryAuditStatsGet_2Request struct via the builder pattern


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


## QueryCanaryAuditApiV1MonitorCanaryAuditGet

> ApiResponse QueryCanaryAuditApiV1MonitorCanaryAuditGet(ctx).Limit(limit).Source(source).Action(action).SinceTs(sinceTs).UntilTs(untilTs).Execute()

Query Canary Audit



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
	limit := int32(56) // int32 | 返回条数限制 (optional) (default to 100)
	source := "source_example" // string | controller / promoter / override (optional)
	action := "action_example" // string | 事件类型过滤 (optional)
	sinceTs := float32(8.14) // float32 | 起始时间戳 (optional)
	untilTs := float32(8.14) // float32 | 结束时间戳 (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MonitorCanaryAuditAPI.QueryCanaryAuditApiV1MonitorCanaryAuditGet(context.Background()).Limit(limit).Source(source).Action(action).SinceTs(sinceTs).UntilTs(untilTs).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorCanaryAuditAPI.QueryCanaryAuditApiV1MonitorCanaryAuditGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `QueryCanaryAuditApiV1MonitorCanaryAuditGet`: ApiResponse
	fmt.Fprintf(os.Stdout, "Response from `MonitorCanaryAuditAPI.QueryCanaryAuditApiV1MonitorCanaryAuditGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiQueryCanaryAuditApiV1MonitorCanaryAuditGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **int32** | 返回条数限制 | [default to 100]
 **source** | **string** | controller / promoter / override | 
 **action** | **string** | 事件类型过滤 | 
 **sinceTs** | **float32** | 起始时间戳 | 
 **untilTs** | **float32** | 结束时间戳 | 

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


## QueryCanaryAuditApiV1MonitorCanaryAuditGet_0

> ApiResponse QueryCanaryAuditApiV1MonitorCanaryAuditGet_0(ctx).Limit(limit).Source(source).Action(action).SinceTs(sinceTs).UntilTs(untilTs).Execute()

Query Canary Audit



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
	limit := int32(56) // int32 | 返回条数限制 (optional) (default to 100)
	source := "source_example" // string | controller / promoter / override (optional)
	action := "action_example" // string | 事件类型过滤 (optional)
	sinceTs := float32(8.14) // float32 | 起始时间戳 (optional)
	untilTs := float32(8.14) // float32 | 结束时间戳 (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MonitorCanaryAuditAPI.QueryCanaryAuditApiV1MonitorCanaryAuditGet_0(context.Background()).Limit(limit).Source(source).Action(action).SinceTs(sinceTs).UntilTs(untilTs).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorCanaryAuditAPI.QueryCanaryAuditApiV1MonitorCanaryAuditGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `QueryCanaryAuditApiV1MonitorCanaryAuditGet_0`: ApiResponse
	fmt.Fprintf(os.Stdout, "Response from `MonitorCanaryAuditAPI.QueryCanaryAuditApiV1MonitorCanaryAuditGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiQueryCanaryAuditApiV1MonitorCanaryAuditGet_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **int32** | 返回条数限制 | [default to 100]
 **source** | **string** | controller / promoter / override | 
 **action** | **string** | 事件类型过滤 | 
 **sinceTs** | **float32** | 起始时间戳 | 
 **untilTs** | **float32** | 结束时间戳 | 

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

