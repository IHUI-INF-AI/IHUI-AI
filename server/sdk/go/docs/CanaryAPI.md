# \CanaryAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetCanaryStageApiV1CanaryCanaryStageGet**](CanaryAPI.md#GetCanaryStageApiV1CanaryCanaryStageGet) | **Get** /api/v1/canary/canary/stage | Get Canary Stage
[**GetCanaryStageApiV1CanaryCanaryStageGet_0**](CanaryAPI.md#GetCanaryStageApiV1CanaryCanaryStageGet_0) | **Get** /api/v1/canary/canary/stage | Get Canary Stage
[**PostCanaryFailureApiV1CanaryCanaryFailurePost**](CanaryAPI.md#PostCanaryFailureApiV1CanaryCanaryFailurePost) | **Post** /api/v1/canary/canary/failure | Post Canary Failure
[**PostCanaryFailureApiV1CanaryCanaryFailurePost_0**](CanaryAPI.md#PostCanaryFailureApiV1CanaryCanaryFailurePost_0) | **Post** /api/v1/canary/canary/failure | Post Canary Failure
[**PostCanaryPromoteApiV1CanaryCanaryPromotePost**](CanaryAPI.md#PostCanaryPromoteApiV1CanaryCanaryPromotePost) | **Post** /api/v1/canary/canary/promote | Post Canary Promote
[**PostCanaryPromoteApiV1CanaryCanaryPromotePost_0**](CanaryAPI.md#PostCanaryPromoteApiV1CanaryCanaryPromotePost_0) | **Post** /api/v1/canary/canary/promote | Post Canary Promote
[**PostCanaryResetApiV1CanaryCanaryResetPost**](CanaryAPI.md#PostCanaryResetApiV1CanaryCanaryResetPost) | **Post** /api/v1/canary/canary/reset | Post Canary Reset
[**PostCanaryResetApiV1CanaryCanaryResetPost_0**](CanaryAPI.md#PostCanaryResetApiV1CanaryCanaryResetPost_0) | **Post** /api/v1/canary/canary/reset | Post Canary Reset
[**PostCanaryRollbackApiV1CanaryCanaryRollbackPost**](CanaryAPI.md#PostCanaryRollbackApiV1CanaryCanaryRollbackPost) | **Post** /api/v1/canary/canary/rollback | Post Canary Rollback
[**PostCanaryRollbackApiV1CanaryCanaryRollbackPost_0**](CanaryAPI.md#PostCanaryRollbackApiV1CanaryCanaryRollbackPost_0) | **Post** /api/v1/canary/canary/rollback | Post Canary Rollback
[**PostCanaryTrafficApiV1CanaryCanaryTrafficPost**](CanaryAPI.md#PostCanaryTrafficApiV1CanaryCanaryTrafficPost) | **Post** /api/v1/canary/canary/traffic | Post Canary Traffic
[**PostCanaryTrafficApiV1CanaryCanaryTrafficPost_0**](CanaryAPI.md#PostCanaryTrafficApiV1CanaryCanaryTrafficPost_0) | **Post** /api/v1/canary/canary/traffic | Post Canary Traffic



## GetCanaryStageApiV1CanaryCanaryStageGet

> CanaryResponse GetCanaryStageApiV1CanaryCanaryStageGet(ctx).Execute()

Get Canary Stage



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
	resp, r, err := apiClient.CanaryAPI.GetCanaryStageApiV1CanaryCanaryStageGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CanaryAPI.GetCanaryStageApiV1CanaryCanaryStageGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetCanaryStageApiV1CanaryCanaryStageGet`: CanaryResponse
	fmt.Fprintf(os.Stdout, "Response from `CanaryAPI.GetCanaryStageApiV1CanaryCanaryStageGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetCanaryStageApiV1CanaryCanaryStageGetRequest struct via the builder pattern


### Return type

[**CanaryResponse**](CanaryResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetCanaryStageApiV1CanaryCanaryStageGet_0

> CanaryResponse GetCanaryStageApiV1CanaryCanaryStageGet_0(ctx).Execute()

Get Canary Stage



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
	resp, r, err := apiClient.CanaryAPI.GetCanaryStageApiV1CanaryCanaryStageGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CanaryAPI.GetCanaryStageApiV1CanaryCanaryStageGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetCanaryStageApiV1CanaryCanaryStageGet_0`: CanaryResponse
	fmt.Fprintf(os.Stdout, "Response from `CanaryAPI.GetCanaryStageApiV1CanaryCanaryStageGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetCanaryStageApiV1CanaryCanaryStageGet_1Request struct via the builder pattern


### Return type

[**CanaryResponse**](CanaryResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## PostCanaryFailureApiV1CanaryCanaryFailurePost

> CanaryResponse PostCanaryFailureApiV1CanaryCanaryFailurePost(ctx).FailureRequest(failureRequest).Execute()

Post Canary Failure



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
	failureRequest := *openapiclient.NewFailureRequest() // FailureRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CanaryAPI.PostCanaryFailureApiV1CanaryCanaryFailurePost(context.Background()).FailureRequest(failureRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CanaryAPI.PostCanaryFailureApiV1CanaryCanaryFailurePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PostCanaryFailureApiV1CanaryCanaryFailurePost`: CanaryResponse
	fmt.Fprintf(os.Stdout, "Response from `CanaryAPI.PostCanaryFailureApiV1CanaryCanaryFailurePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPostCanaryFailureApiV1CanaryCanaryFailurePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **failureRequest** | [**FailureRequest**](FailureRequest.md) |  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## PostCanaryFailureApiV1CanaryCanaryFailurePost_0

> CanaryResponse PostCanaryFailureApiV1CanaryCanaryFailurePost_0(ctx).FailureRequest(failureRequest).Execute()

Post Canary Failure



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
	failureRequest := *openapiclient.NewFailureRequest() // FailureRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CanaryAPI.PostCanaryFailureApiV1CanaryCanaryFailurePost_0(context.Background()).FailureRequest(failureRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CanaryAPI.PostCanaryFailureApiV1CanaryCanaryFailurePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PostCanaryFailureApiV1CanaryCanaryFailurePost_0`: CanaryResponse
	fmt.Fprintf(os.Stdout, "Response from `CanaryAPI.PostCanaryFailureApiV1CanaryCanaryFailurePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPostCanaryFailureApiV1CanaryCanaryFailurePost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **failureRequest** | [**FailureRequest**](FailureRequest.md) |  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## PostCanaryPromoteApiV1CanaryCanaryPromotePost

> CanaryResponse PostCanaryPromoteApiV1CanaryCanaryPromotePost(ctx).PromoteRequest(promoteRequest).Execute()

Post Canary Promote



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
	promoteRequest := *openapiclient.NewPromoteRequest() // PromoteRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CanaryAPI.PostCanaryPromoteApiV1CanaryCanaryPromotePost(context.Background()).PromoteRequest(promoteRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CanaryAPI.PostCanaryPromoteApiV1CanaryCanaryPromotePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PostCanaryPromoteApiV1CanaryCanaryPromotePost`: CanaryResponse
	fmt.Fprintf(os.Stdout, "Response from `CanaryAPI.PostCanaryPromoteApiV1CanaryCanaryPromotePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPostCanaryPromoteApiV1CanaryCanaryPromotePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **promoteRequest** | [**PromoteRequest**](PromoteRequest.md) |  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## PostCanaryPromoteApiV1CanaryCanaryPromotePost_0

> CanaryResponse PostCanaryPromoteApiV1CanaryCanaryPromotePost_0(ctx).PromoteRequest(promoteRequest).Execute()

Post Canary Promote



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
	promoteRequest := *openapiclient.NewPromoteRequest() // PromoteRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CanaryAPI.PostCanaryPromoteApiV1CanaryCanaryPromotePost_0(context.Background()).PromoteRequest(promoteRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CanaryAPI.PostCanaryPromoteApiV1CanaryCanaryPromotePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PostCanaryPromoteApiV1CanaryCanaryPromotePost_0`: CanaryResponse
	fmt.Fprintf(os.Stdout, "Response from `CanaryAPI.PostCanaryPromoteApiV1CanaryCanaryPromotePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPostCanaryPromoteApiV1CanaryCanaryPromotePost_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **promoteRequest** | [**PromoteRequest**](PromoteRequest.md) |  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## PostCanaryResetApiV1CanaryCanaryResetPost

> CanaryResponse PostCanaryResetApiV1CanaryCanaryResetPost(ctx).ResetRequest(resetRequest).Execute()

Post Canary Reset



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
	resetRequest := *openapiclient.NewResetRequest() // ResetRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CanaryAPI.PostCanaryResetApiV1CanaryCanaryResetPost(context.Background()).ResetRequest(resetRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CanaryAPI.PostCanaryResetApiV1CanaryCanaryResetPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PostCanaryResetApiV1CanaryCanaryResetPost`: CanaryResponse
	fmt.Fprintf(os.Stdout, "Response from `CanaryAPI.PostCanaryResetApiV1CanaryCanaryResetPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPostCanaryResetApiV1CanaryCanaryResetPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **resetRequest** | [**ResetRequest**](ResetRequest.md) |  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## PostCanaryResetApiV1CanaryCanaryResetPost_0

> CanaryResponse PostCanaryResetApiV1CanaryCanaryResetPost_0(ctx).ResetRequest(resetRequest).Execute()

Post Canary Reset



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
	resetRequest := *openapiclient.NewResetRequest() // ResetRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CanaryAPI.PostCanaryResetApiV1CanaryCanaryResetPost_0(context.Background()).ResetRequest(resetRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CanaryAPI.PostCanaryResetApiV1CanaryCanaryResetPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PostCanaryResetApiV1CanaryCanaryResetPost_0`: CanaryResponse
	fmt.Fprintf(os.Stdout, "Response from `CanaryAPI.PostCanaryResetApiV1CanaryCanaryResetPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPostCanaryResetApiV1CanaryCanaryResetPost_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **resetRequest** | [**ResetRequest**](ResetRequest.md) |  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## PostCanaryRollbackApiV1CanaryCanaryRollbackPost

> CanaryResponse PostCanaryRollbackApiV1CanaryCanaryRollbackPost(ctx).RollbackRequest(rollbackRequest).Execute()

Post Canary Rollback



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
	rollbackRequest := *openapiclient.NewRollbackRequest() // RollbackRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CanaryAPI.PostCanaryRollbackApiV1CanaryCanaryRollbackPost(context.Background()).RollbackRequest(rollbackRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CanaryAPI.PostCanaryRollbackApiV1CanaryCanaryRollbackPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PostCanaryRollbackApiV1CanaryCanaryRollbackPost`: CanaryResponse
	fmt.Fprintf(os.Stdout, "Response from `CanaryAPI.PostCanaryRollbackApiV1CanaryCanaryRollbackPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPostCanaryRollbackApiV1CanaryCanaryRollbackPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **rollbackRequest** | [**RollbackRequest**](RollbackRequest.md) |  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## PostCanaryRollbackApiV1CanaryCanaryRollbackPost_0

> CanaryResponse PostCanaryRollbackApiV1CanaryCanaryRollbackPost_0(ctx).RollbackRequest(rollbackRequest).Execute()

Post Canary Rollback



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
	rollbackRequest := *openapiclient.NewRollbackRequest() // RollbackRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CanaryAPI.PostCanaryRollbackApiV1CanaryCanaryRollbackPost_0(context.Background()).RollbackRequest(rollbackRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CanaryAPI.PostCanaryRollbackApiV1CanaryCanaryRollbackPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PostCanaryRollbackApiV1CanaryCanaryRollbackPost_0`: CanaryResponse
	fmt.Fprintf(os.Stdout, "Response from `CanaryAPI.PostCanaryRollbackApiV1CanaryCanaryRollbackPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPostCanaryRollbackApiV1CanaryCanaryRollbackPost_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **rollbackRequest** | [**RollbackRequest**](RollbackRequest.md) |  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## PostCanaryTrafficApiV1CanaryCanaryTrafficPost

> CanaryResponse PostCanaryTrafficApiV1CanaryCanaryTrafficPost(ctx).TrafficRequest(trafficRequest).Execute()

Post Canary Traffic



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
	trafficRequest := *openapiclient.NewTrafficRequest() // TrafficRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CanaryAPI.PostCanaryTrafficApiV1CanaryCanaryTrafficPost(context.Background()).TrafficRequest(trafficRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CanaryAPI.PostCanaryTrafficApiV1CanaryCanaryTrafficPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PostCanaryTrafficApiV1CanaryCanaryTrafficPost`: CanaryResponse
	fmt.Fprintf(os.Stdout, "Response from `CanaryAPI.PostCanaryTrafficApiV1CanaryCanaryTrafficPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPostCanaryTrafficApiV1CanaryCanaryTrafficPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **trafficRequest** | [**TrafficRequest**](TrafficRequest.md) |  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## PostCanaryTrafficApiV1CanaryCanaryTrafficPost_0

> CanaryResponse PostCanaryTrafficApiV1CanaryCanaryTrafficPost_0(ctx).TrafficRequest(trafficRequest).Execute()

Post Canary Traffic



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
	trafficRequest := *openapiclient.NewTrafficRequest() // TrafficRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CanaryAPI.PostCanaryTrafficApiV1CanaryCanaryTrafficPost_0(context.Background()).TrafficRequest(trafficRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CanaryAPI.PostCanaryTrafficApiV1CanaryCanaryTrafficPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PostCanaryTrafficApiV1CanaryCanaryTrafficPost_0`: CanaryResponse
	fmt.Fprintf(os.Stdout, "Response from `CanaryAPI.PostCanaryTrafficApiV1CanaryCanaryTrafficPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPostCanaryTrafficApiV1CanaryCanaryTrafficPost_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **trafficRequest** | [**TrafficRequest**](TrafficRequest.md) |  | 

### Return type

[**CanaryResponse**](CanaryResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

