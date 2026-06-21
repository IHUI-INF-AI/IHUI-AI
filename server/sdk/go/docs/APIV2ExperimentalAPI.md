# \APIV2ExperimentalAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**V2InfoApiV2InfoGet**](APIV2ExperimentalAPI.md#V2InfoApiV2InfoGet) | **Get** /api/v2/info | v2 API 元数据
[**V2LoginApiV2AuthLoginPost**](APIV2ExperimentalAPI.md#V2LoginApiV2AuthLoginPost) | **Post** /api/v2/auth/login | [v2] 用户名+密码登录 - 增强返回 refresh_token + expires_in + scope
[**V2PingApiV2PingGet**](APIV2ExperimentalAPI.md#V2PingApiV2PingGet) | **Get** /api/v2/ping | v2 API ping



## V2InfoApiV2InfoGet

> interface{} V2InfoApiV2InfoGet(ctx).Execute()

v2 API 元数据



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
	resp, r, err := apiClient.APIV2ExperimentalAPI.V2InfoApiV2InfoGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `APIV2ExperimentalAPI.V2InfoApiV2InfoGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `V2InfoApiV2InfoGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `APIV2ExperimentalAPI.V2InfoApiV2InfoGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiV2InfoApiV2InfoGetRequest struct via the builder pattern


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


## V2LoginApiV2AuthLoginPost

> interface{} V2LoginApiV2AuthLoginPost(ctx).Execute()

[v2] 用户名+密码登录 - 增强返回 refresh_token + expires_in + scope



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
	resp, r, err := apiClient.APIV2ExperimentalAPI.V2LoginApiV2AuthLoginPost(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `APIV2ExperimentalAPI.V2LoginApiV2AuthLoginPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `V2LoginApiV2AuthLoginPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `APIV2ExperimentalAPI.V2LoginApiV2AuthLoginPost`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiV2LoginApiV2AuthLoginPostRequest struct via the builder pattern


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


## V2PingApiV2PingGet

> interface{} V2PingApiV2PingGet(ctx).Execute()

v2 API ping

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
	resp, r, err := apiClient.APIV2ExperimentalAPI.V2PingApiV2PingGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `APIV2ExperimentalAPI.V2PingApiV2PingGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `V2PingApiV2PingGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `APIV2ExperimentalAPI.V2PingApiV2PingGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiV2PingApiV2PingGetRequest struct via the builder pattern


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

