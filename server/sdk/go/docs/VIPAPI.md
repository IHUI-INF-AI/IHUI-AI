# \VIPAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CheckVipApiV1UserCheckGet**](VIPAPI.md#CheckVipApiV1UserCheckGet) | **Get** /api/v1/user/check | Check current user VIP status
[**GetMyVipApiV1UserMyGet**](VIPAPI.md#GetMyVipApiV1UserMyGet) | **Get** /api/v1/user/my | Get current user VIP info
[**GetVipLevelDetailApiV1UserLevelVipIdGet**](VIPAPI.md#GetVipLevelDetailApiV1UserLevelVipIdGet) | **Get** /api/v1/user/level/{vip_id} | Get VIP level detail
[**GetVipLevelsApiV1UserLevelsGet**](VIPAPI.md#GetVipLevelsApiV1UserLevelsGet) | **Get** /api/v1/user/levels | Get all VIP levels
[**SubscribeVipApiV1UserSubscribePost**](VIPAPI.md#SubscribeVipApiV1UserSubscribePost) | **Post** /api/v1/user/subscribe | Subscribe VIP (create order)



## CheckVipApiV1UserCheckGet

> interface{} CheckVipApiV1UserCheckGet(ctx).Execute()

Check current user VIP status



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
	resp, r, err := apiClient.VIPAPI.CheckVipApiV1UserCheckGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VIPAPI.CheckVipApiV1UserCheckGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CheckVipApiV1UserCheckGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VIPAPI.CheckVipApiV1UserCheckGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCheckVipApiV1UserCheckGetRequest struct via the builder pattern


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


## GetMyVipApiV1UserMyGet

> interface{} GetMyVipApiV1UserMyGet(ctx).Execute()

Get current user VIP info



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
	resp, r, err := apiClient.VIPAPI.GetMyVipApiV1UserMyGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VIPAPI.GetMyVipApiV1UserMyGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetMyVipApiV1UserMyGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VIPAPI.GetMyVipApiV1UserMyGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetMyVipApiV1UserMyGetRequest struct via the builder pattern


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


## GetVipLevelDetailApiV1UserLevelVipIdGet

> interface{} GetVipLevelDetailApiV1UserLevelVipIdGet(ctx, vipId).Execute()

Get VIP level detail



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
	vipId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VIPAPI.GetVipLevelDetailApiV1UserLevelVipIdGet(context.Background(), vipId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VIPAPI.GetVipLevelDetailApiV1UserLevelVipIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetVipLevelDetailApiV1UserLevelVipIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VIPAPI.GetVipLevelDetailApiV1UserLevelVipIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**vipId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetVipLevelDetailApiV1UserLevelVipIdGetRequest struct via the builder pattern


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


## GetVipLevelsApiV1UserLevelsGet

> interface{} GetVipLevelsApiV1UserLevelsGet(ctx).Execute()

Get all VIP levels



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
	resp, r, err := apiClient.VIPAPI.GetVipLevelsApiV1UserLevelsGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VIPAPI.GetVipLevelsApiV1UserLevelsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetVipLevelsApiV1UserLevelsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VIPAPI.GetVipLevelsApiV1UserLevelsGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetVipLevelsApiV1UserLevelsGetRequest struct via the builder pattern


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


## SubscribeVipApiV1UserSubscribePost

> interface{} SubscribeVipApiV1UserSubscribePost(ctx).SubscribeRequest(subscribeRequest).Execute()

Subscribe VIP (create order)



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
	subscribeRequest := *openapiclient.NewSubscribeRequest(int32(123)) // SubscribeRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.VIPAPI.SubscribeVipApiV1UserSubscribePost(context.Background()).SubscribeRequest(subscribeRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `VIPAPI.SubscribeVipApiV1UserSubscribePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SubscribeVipApiV1UserSubscribePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `VIPAPI.SubscribeVipApiV1UserSubscribePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSubscribeVipApiV1UserSubscribePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **subscribeRequest** | [**SubscribeRequest**](SubscribeRequest.md) |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

