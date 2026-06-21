# \MonitorInhibitionPlaygroundAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**InhibitionDryRunApiV1MonitorInhibitionDryRunPost**](MonitorInhibitionPlaygroundAPI.md#InhibitionDryRunApiV1MonitorInhibitionDryRunPost) | **Post** /api/v1/monitor/inhibition/dry-run | Inhibition Dry Run
[**InhibitionDryRunApiV1MonitorInhibitionDryRunPost_0**](MonitorInhibitionPlaygroundAPI.md#InhibitionDryRunApiV1MonitorInhibitionDryRunPost_0) | **Post** /api/v1/monitor/inhibition/dry-run | Inhibition Dry Run
[**ListPresetsApiV1MonitorInhibitionPresetsGet**](MonitorInhibitionPlaygroundAPI.md#ListPresetsApiV1MonitorInhibitionPresetsGet) | **Get** /api/v1/monitor/inhibition/presets | List Presets
[**ListPresetsApiV1MonitorInhibitionPresetsGet_0**](MonitorInhibitionPlaygroundAPI.md#ListPresetsApiV1MonitorInhibitionPresetsGet_0) | **Get** /api/v1/monitor/inhibition/presets | List Presets



## InhibitionDryRunApiV1MonitorInhibitionDryRunPost

> ApiResponse InhibitionDryRunApiV1MonitorInhibitionDryRunPost(ctx).PlaygroundRequest(playgroundRequest).Execute()

Inhibition Dry Run



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
	playgroundRequest := *openapiclient.NewPlaygroundRequest([]openapiclient.AlertIn{*openapiclient.NewAlertIn()}) // PlaygroundRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MonitorInhibitionPlaygroundAPI.InhibitionDryRunApiV1MonitorInhibitionDryRunPost(context.Background()).PlaygroundRequest(playgroundRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorInhibitionPlaygroundAPI.InhibitionDryRunApiV1MonitorInhibitionDryRunPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `InhibitionDryRunApiV1MonitorInhibitionDryRunPost`: ApiResponse
	fmt.Fprintf(os.Stdout, "Response from `MonitorInhibitionPlaygroundAPI.InhibitionDryRunApiV1MonitorInhibitionDryRunPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiInhibitionDryRunApiV1MonitorInhibitionDryRunPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **playgroundRequest** | [**PlaygroundRequest**](PlaygroundRequest.md) |  | 

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


## InhibitionDryRunApiV1MonitorInhibitionDryRunPost_0

> ApiResponse InhibitionDryRunApiV1MonitorInhibitionDryRunPost_0(ctx).PlaygroundRequest(playgroundRequest).Execute()

Inhibition Dry Run



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
	playgroundRequest := *openapiclient.NewPlaygroundRequest([]openapiclient.AlertIn{*openapiclient.NewAlertIn()}) // PlaygroundRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MonitorInhibitionPlaygroundAPI.InhibitionDryRunApiV1MonitorInhibitionDryRunPost_0(context.Background()).PlaygroundRequest(playgroundRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorInhibitionPlaygroundAPI.InhibitionDryRunApiV1MonitorInhibitionDryRunPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `InhibitionDryRunApiV1MonitorInhibitionDryRunPost_0`: ApiResponse
	fmt.Fprintf(os.Stdout, "Response from `MonitorInhibitionPlaygroundAPI.InhibitionDryRunApiV1MonitorInhibitionDryRunPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiInhibitionDryRunApiV1MonitorInhibitionDryRunPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **playgroundRequest** | [**PlaygroundRequest**](PlaygroundRequest.md) |  | 

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


## ListPresetsApiV1MonitorInhibitionPresetsGet

> ApiResponse ListPresetsApiV1MonitorInhibitionPresetsGet(ctx).Execute()

List Presets



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
	resp, r, err := apiClient.MonitorInhibitionPlaygroundAPI.ListPresetsApiV1MonitorInhibitionPresetsGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorInhibitionPlaygroundAPI.ListPresetsApiV1MonitorInhibitionPresetsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListPresetsApiV1MonitorInhibitionPresetsGet`: ApiResponse
	fmt.Fprintf(os.Stdout, "Response from `MonitorInhibitionPlaygroundAPI.ListPresetsApiV1MonitorInhibitionPresetsGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListPresetsApiV1MonitorInhibitionPresetsGetRequest struct via the builder pattern


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


## ListPresetsApiV1MonitorInhibitionPresetsGet_0

> ApiResponse ListPresetsApiV1MonitorInhibitionPresetsGet_0(ctx).Execute()

List Presets



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
	resp, r, err := apiClient.MonitorInhibitionPlaygroundAPI.ListPresetsApiV1MonitorInhibitionPresetsGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorInhibitionPlaygroundAPI.ListPresetsApiV1MonitorInhibitionPresetsGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListPresetsApiV1MonitorInhibitionPresetsGet_0`: ApiResponse
	fmt.Fprintf(os.Stdout, "Response from `MonitorInhibitionPlaygroundAPI.ListPresetsApiV1MonitorInhibitionPresetsGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListPresetsApiV1MonitorInhibitionPresetsGet_2Request struct via the builder pattern


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

