# \AccountBindingsAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ListBindingsApiV1AuthAuthBindingsGet**](AccountBindingsAPI.md#ListBindingsApiV1AuthAuthBindingsGet) | **Get** /api/v1/auth/auth/bindings/ | List all third-party bindings
[**ListBindingsApiV1AuthAuthBindingsGet_0**](AccountBindingsAPI.md#ListBindingsApiV1AuthAuthBindingsGet_0) | **Get** /api/v1/auth/auth/bindings/ | List all third-party bindings
[**RemoveByPlatformApiV1AuthAuthBindingsRemovePost**](AccountBindingsAPI.md#RemoveByPlatformApiV1AuthAuthBindingsRemovePost) | **Post** /api/v1/auth/auth/bindings/remove | Unbind third-party account by platform
[**RemoveByPlatformApiV1AuthAuthBindingsRemovePost_0**](AccountBindingsAPI.md#RemoveByPlatformApiV1AuthAuthBindingsRemovePost_0) | **Post** /api/v1/auth/auth/bindings/remove | Unbind third-party account by platform
[**UnbindApiV1AuthAuthBindingsBindingIdDelete**](AccountBindingsAPI.md#UnbindApiV1AuthAuthBindingsBindingIdDelete) | **Delete** /api/v1/auth/auth/bindings/{binding_id} | Unbind third-party account by ID
[**UnbindApiV1AuthAuthBindingsBindingIdDelete_0**](AccountBindingsAPI.md#UnbindApiV1AuthAuthBindingsBindingIdDelete_0) | **Delete** /api/v1/auth/auth/bindings/{binding_id} | Unbind third-party account by ID



## ListBindingsApiV1AuthAuthBindingsGet

> interface{} ListBindingsApiV1AuthAuthBindingsGet(ctx).Execute()

List all third-party bindings



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
	resp, r, err := apiClient.AccountBindingsAPI.ListBindingsApiV1AuthAuthBindingsGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AccountBindingsAPI.ListBindingsApiV1AuthAuthBindingsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListBindingsApiV1AuthAuthBindingsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AccountBindingsAPI.ListBindingsApiV1AuthAuthBindingsGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListBindingsApiV1AuthAuthBindingsGetRequest struct via the builder pattern


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


## ListBindingsApiV1AuthAuthBindingsGet_0

> interface{} ListBindingsApiV1AuthAuthBindingsGet_0(ctx).Execute()

List all third-party bindings



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
	resp, r, err := apiClient.AccountBindingsAPI.ListBindingsApiV1AuthAuthBindingsGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AccountBindingsAPI.ListBindingsApiV1AuthAuthBindingsGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListBindingsApiV1AuthAuthBindingsGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AccountBindingsAPI.ListBindingsApiV1AuthAuthBindingsGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListBindingsApiV1AuthAuthBindingsGet_1Request struct via the builder pattern


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


## RemoveByPlatformApiV1AuthAuthBindingsRemovePost

> interface{} RemoveByPlatformApiV1AuthAuthBindingsRemovePost(ctx).BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost(bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost).Execute()

Unbind third-party account by platform



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
	bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost := *openapiclient.NewBodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost("Uuid_example", "Platform_example") // BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AccountBindingsAPI.RemoveByPlatformApiV1AuthAuthBindingsRemovePost(context.Background()).BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost(bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AccountBindingsAPI.RemoveByPlatformApiV1AuthAuthBindingsRemovePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RemoveByPlatformApiV1AuthAuthBindingsRemovePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AccountBindingsAPI.RemoveByPlatformApiV1AuthAuthBindingsRemovePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRemoveByPlatformApiV1AuthAuthBindingsRemovePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost** | [**BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost**](BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost.md) |  | 

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


## RemoveByPlatformApiV1AuthAuthBindingsRemovePost_0

> interface{} RemoveByPlatformApiV1AuthAuthBindingsRemovePost_0(ctx).BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost(bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost).Execute()

Unbind third-party account by platform



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
	bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost := *openapiclient.NewBodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost("Uuid_example", "Platform_example") // BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AccountBindingsAPI.RemoveByPlatformApiV1AuthAuthBindingsRemovePost_0(context.Background()).BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost(bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AccountBindingsAPI.RemoveByPlatformApiV1AuthAuthBindingsRemovePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RemoveByPlatformApiV1AuthAuthBindingsRemovePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AccountBindingsAPI.RemoveByPlatformApiV1AuthAuthBindingsRemovePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRemoveByPlatformApiV1AuthAuthBindingsRemovePost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost** | [**BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost**](BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost.md) |  | 

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


## UnbindApiV1AuthAuthBindingsBindingIdDelete

> interface{} UnbindApiV1AuthAuthBindingsBindingIdDelete(ctx, bindingId).Execute()

Unbind third-party account by ID



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
	bindingId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AccountBindingsAPI.UnbindApiV1AuthAuthBindingsBindingIdDelete(context.Background(), bindingId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AccountBindingsAPI.UnbindApiV1AuthAuthBindingsBindingIdDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UnbindApiV1AuthAuthBindingsBindingIdDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AccountBindingsAPI.UnbindApiV1AuthAuthBindingsBindingIdDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**bindingId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUnbindApiV1AuthAuthBindingsBindingIdDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## UnbindApiV1AuthAuthBindingsBindingIdDelete_0

> interface{} UnbindApiV1AuthAuthBindingsBindingIdDelete_0(ctx, bindingId).Execute()

Unbind third-party account by ID



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
	bindingId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AccountBindingsAPI.UnbindApiV1AuthAuthBindingsBindingIdDelete_0(context.Background(), bindingId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AccountBindingsAPI.UnbindApiV1AuthAuthBindingsBindingIdDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UnbindApiV1AuthAuthBindingsBindingIdDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AccountBindingsAPI.UnbindApiV1AuthAuthBindingsBindingIdDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**bindingId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUnbindApiV1AuthAuthBindingsBindingIdDelete_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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

