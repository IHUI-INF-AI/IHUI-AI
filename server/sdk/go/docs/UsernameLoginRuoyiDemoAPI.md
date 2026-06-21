# \UsernameLoginRuoyiDemoAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**LoginByUsernameApiV1LoginUsernamePost**](UsernameLoginRuoyiDemoAPI.md#LoginByUsernameApiV1LoginUsernamePost) | **Post** /api/v1/login/username | 用户名密码登录 (内置 admin/ry)



## LoginByUsernameApiV1LoginUsernamePost

> interface{} LoginByUsernameApiV1LoginUsernamePost(ctx).Username(username).Password(password).Execute()

用户名密码登录 (内置 admin/ry)



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
	username := "username_example" // string | 用户名 (admin / ry)
	password := "password_example" // string | 明文密码

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UsernameLoginRuoyiDemoAPI.LoginByUsernameApiV1LoginUsernamePost(context.Background()).Username(username).Password(password).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UsernameLoginRuoyiDemoAPI.LoginByUsernameApiV1LoginUsernamePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LoginByUsernameApiV1LoginUsernamePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UsernameLoginRuoyiDemoAPI.LoginByUsernameApiV1LoginUsernamePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiLoginByUsernameApiV1LoginUsernamePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **username** | **string** | 用户名 (admin / ry) | 
 **password** | **string** | 明文密码 | 

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

