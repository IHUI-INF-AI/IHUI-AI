# \FeishuAuthAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**FeishuPcTestApiV1AuthLoginFeishuPcTestGet**](FeishuAuthAPI.md#FeishuPcTestApiV1AuthLoginFeishuPcTestGet) | **Get** /api/v1/auth/login/feishu/pc/test | Feishu Pc Test
[**FeishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet**](FeishuAuthAPI.md#FeishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet) | **Get** /api/v1/auth/login/feishu/pc/wxCode | Feishu Pc Wx Code



## FeishuPcTestApiV1AuthLoginFeishuPcTestGet

> interface{} FeishuPcTestApiV1AuthLoginFeishuPcTestGet(ctx).Code(code).Execute()

Feishu Pc Test

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
	code := "code_example" // string | test code

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FeishuAuthAPI.FeishuPcTestApiV1AuthLoginFeishuPcTestGet(context.Background()).Code(code).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FeishuAuthAPI.FeishuPcTestApiV1AuthLoginFeishuPcTestGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `FeishuPcTestApiV1AuthLoginFeishuPcTestGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FeishuAuthAPI.FeishuPcTestApiV1AuthLoginFeishuPcTestGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiFeishuPcTestApiV1AuthLoginFeishuPcTestGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** | test code | 

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


## FeishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet

> interface{} FeishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet(ctx).Code(code).Execute()

Feishu Pc Wx Code

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
	code := "code_example" // string | Feishu auth code

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FeishuAuthAPI.FeishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet(context.Background()).Code(code).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FeishuAuthAPI.FeishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `FeishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FeishuAuthAPI.FeishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiFeishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** | Feishu auth code | 

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

