# \HealthAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**HealthHealthGet**](HealthAPI.md#HealthHealthGet) | **Get** /health | 综合健康检查
[**HealthLiveHealthLiveGet**](HealthAPI.md#HealthLiveHealthLiveGet) | **Get** /health/live | Liveness probe (K8s)
[**HealthReadyHealthReadyGet**](HealthAPI.md#HealthReadyHealthReadyGet) | **Get** /health/ready | Readiness probe (K8s)
[**MetricsRateLimitMetricsRateLimitGet**](HealthAPI.md#MetricsRateLimitMetricsRateLimitGet) | **Get** /metrics/rate-limit | 限流 Prometheus 指标



## HealthHealthGet

> interface{} HealthHealthGet(ctx).Execute()

综合健康检查



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
	resp, r, err := apiClient.HealthAPI.HealthHealthGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `HealthAPI.HealthHealthGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `HealthHealthGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `HealthAPI.HealthHealthGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiHealthHealthGetRequest struct via the builder pattern


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


## HealthLiveHealthLiveGet

> interface{} HealthLiveHealthLiveGet(ctx).Execute()

Liveness probe (K8s)



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
	resp, r, err := apiClient.HealthAPI.HealthLiveHealthLiveGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `HealthAPI.HealthLiveHealthLiveGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `HealthLiveHealthLiveGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `HealthAPI.HealthLiveHealthLiveGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiHealthLiveHealthLiveGetRequest struct via the builder pattern


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


## HealthReadyHealthReadyGet

> interface{} HealthReadyHealthReadyGet(ctx).Execute()

Readiness probe (K8s)



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
	resp, r, err := apiClient.HealthAPI.HealthReadyHealthReadyGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `HealthAPI.HealthReadyHealthReadyGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `HealthReadyHealthReadyGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `HealthAPI.HealthReadyHealthReadyGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiHealthReadyHealthReadyGetRequest struct via the builder pattern


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


## MetricsRateLimitMetricsRateLimitGet

> interface{} MetricsRateLimitMetricsRateLimitGet(ctx).Execute()

限流 Prometheus 指标



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
	resp, r, err := apiClient.HealthAPI.MetricsRateLimitMetricsRateLimitGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `HealthAPI.MetricsRateLimitMetricsRateLimitGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MetricsRateLimitMetricsRateLimitGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `HealthAPI.MetricsRateLimitMetricsRateLimitGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiMetricsRateLimitMetricsRateLimitGetRequest struct via the builder pattern


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

