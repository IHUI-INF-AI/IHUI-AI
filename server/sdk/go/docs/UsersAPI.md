# \UsersAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetProfileApiV1UserInfoGet**](UsersAPI.md#GetProfileApiV1UserInfoGet) | **Get** /api/v1/user/info | Get current user profile
[**UpdateProfileApiV1UserUpdatePut**](UsersAPI.md#UpdateProfileApiV1UserUpdatePut) | **Put** /api/v1/user/update | Update user profile



## GetProfileApiV1UserInfoGet

> interface{} GetProfileApiV1UserInfoGet(ctx).Execute()

Get current user profile

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
	resp, r, err := apiClient.UsersAPI.GetProfileApiV1UserInfoGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UsersAPI.GetProfileApiV1UserInfoGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetProfileApiV1UserInfoGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UsersAPI.GetProfileApiV1UserInfoGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetProfileApiV1UserInfoGetRequest struct via the builder pattern


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


## UpdateProfileApiV1UserUpdatePut

> interface{} UpdateProfileApiV1UserUpdatePut(ctx).Nickname(nickname).Avatar(avatar).Gender(gender).Execute()

Update user profile

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
	nickname := "nickname_example" // string |  (optional)
	avatar := "avatar_example" // string |  (optional)
	gender := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UsersAPI.UpdateProfileApiV1UserUpdatePut(context.Background()).Nickname(nickname).Avatar(avatar).Gender(gender).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UsersAPI.UpdateProfileApiV1UserUpdatePut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateProfileApiV1UserUpdatePut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UsersAPI.UpdateProfileApiV1UserUpdatePut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateProfileApiV1UserUpdatePutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **nickname** | **string** |  | 
 **avatar** | **string** |  | 
 **gender** | **int32** |  | 

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

