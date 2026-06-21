# \MonitorBackfillProgressAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**BackfillHistoryApiV1MonitorBackfillHistoryGet**](MonitorBackfillProgressAPI.md#BackfillHistoryApiV1MonitorBackfillHistoryGet) | **Get** /api/v1/monitor/backfill/history | Backfill 最近历史事件
[**BackfillProgressApiV1MonitorBackfillProgressGet**](MonitorBackfillProgressAPI.md#BackfillProgressApiV1MonitorBackfillProgressGet) | **Get** /api/v1/monitor/backfill/progress | Backfill 实时进度 (SSE)
[**BackfillResetApiV1MonitorBackfillResetPost**](MonitorBackfillProgressAPI.md#BackfillResetApiV1MonitorBackfillResetPost) | **Post** /api/v1/monitor/backfill/reset | 重置 backfill 状态
[**BackfillStatusApiV1MonitorBackfillStatusGet**](MonitorBackfillProgressAPI.md#BackfillStatusApiV1MonitorBackfillStatusGet) | **Get** /api/v1/monitor/backfill/status | Backfill 状态快照



## BackfillHistoryApiV1MonitorBackfillHistoryGet

> interface{} BackfillHistoryApiV1MonitorBackfillHistoryGet(ctx).Limit(limit).Execute()

Backfill 最近历史事件

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
	limit := int32(56) // int32 |  (optional) (default to 50)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MonitorBackfillProgressAPI.BackfillHistoryApiV1MonitorBackfillHistoryGet(context.Background()).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorBackfillProgressAPI.BackfillHistoryApiV1MonitorBackfillHistoryGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BackfillHistoryApiV1MonitorBackfillHistoryGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MonitorBackfillProgressAPI.BackfillHistoryApiV1MonitorBackfillHistoryGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiBackfillHistoryApiV1MonitorBackfillHistoryGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **int32** |  | [default to 50]

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


## BackfillProgressApiV1MonitorBackfillProgressGet

> interface{} BackfillProgressApiV1MonitorBackfillProgressGet(ctx).Execute()

Backfill 实时进度 (SSE)



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
	resp, r, err := apiClient.MonitorBackfillProgressAPI.BackfillProgressApiV1MonitorBackfillProgressGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorBackfillProgressAPI.BackfillProgressApiV1MonitorBackfillProgressGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BackfillProgressApiV1MonitorBackfillProgressGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MonitorBackfillProgressAPI.BackfillProgressApiV1MonitorBackfillProgressGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiBackfillProgressApiV1MonitorBackfillProgressGetRequest struct via the builder pattern


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


## BackfillResetApiV1MonitorBackfillResetPost

> interface{} BackfillResetApiV1MonitorBackfillResetPost(ctx).Execute()

重置 backfill 状态

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
	resp, r, err := apiClient.MonitorBackfillProgressAPI.BackfillResetApiV1MonitorBackfillResetPost(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorBackfillProgressAPI.BackfillResetApiV1MonitorBackfillResetPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BackfillResetApiV1MonitorBackfillResetPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MonitorBackfillProgressAPI.BackfillResetApiV1MonitorBackfillResetPost`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiBackfillResetApiV1MonitorBackfillResetPostRequest struct via the builder pattern


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


## BackfillStatusApiV1MonitorBackfillStatusGet

> interface{} BackfillStatusApiV1MonitorBackfillStatusGet(ctx).Execute()

Backfill 状态快照

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
	resp, r, err := apiClient.MonitorBackfillProgressAPI.BackfillStatusApiV1MonitorBackfillStatusGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorBackfillProgressAPI.BackfillStatusApiV1MonitorBackfillStatusGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BackfillStatusApiV1MonitorBackfillStatusGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MonitorBackfillProgressAPI.BackfillStatusApiV1MonitorBackfillStatusGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiBackfillStatusApiV1MonitorBackfillStatusGetRequest struct via the builder pattern


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

