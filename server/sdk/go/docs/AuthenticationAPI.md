# \AuthenticationAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CancelAccountApiV1AuthAuthCancelDelete**](AuthenticationAPI.md#CancelAccountApiV1AuthAuthCancelDelete) | **Delete** /api/v1/auth/auth/cancel | User account cancellation (soft delete)
[**CancelAccountApiV1AuthAuthCancelDelete_0**](AuthenticationAPI.md#CancelAccountApiV1AuthAuthCancelDelete_0) | **Delete** /api/v1/auth/auth/cancel | User account cancellation (soft delete)
[**ChangePasswordApiV1AuthAuthProfilePasswordPut**](AuthenticationAPI.md#ChangePasswordApiV1AuthAuthProfilePasswordPut) | **Put** /api/v1/auth/auth/profile/password | Change password
[**ChangePasswordApiV1AuthAuthProfilePasswordPut_0**](AuthenticationAPI.md#ChangePasswordApiV1AuthAuthProfilePasswordPut_0) | **Put** /api/v1/auth/auth/profile/password | Change password
[**CheckPhoneExistsApiV1AuthAuthExistPhoneGet**](AuthenticationAPI.md#CheckPhoneExistsApiV1AuthAuthExistPhoneGet) | **Get** /api/v1/auth/auth/exist/{phone} | Check if phone is registered
[**CheckPhoneExistsApiV1AuthAuthExistPhoneGet_0**](AuthenticationAPI.md#CheckPhoneExistsApiV1AuthAuthExistPhoneGet_0) | **Get** /api/v1/auth/auth/exist/{phone} | Check if phone is registered
[**GetProfileApiV1AuthAuthProfileGet**](AuthenticationAPI.md#GetProfileApiV1AuthAuthProfileGet) | **Get** /api/v1/auth/auth/profile | Get personal profile with roles and posts
[**GetProfileApiV1AuthAuthProfileGet_0**](AuthenticationAPI.md#GetProfileApiV1AuthAuthProfileGet_0) | **Get** /api/v1/auth/auth/profile | Get personal profile with roles and posts
[**GetUserInfoApiV1AuthAuthInfoGet**](AuthenticationAPI.md#GetUserInfoApiV1AuthAuthInfoGet) | **Get** /api/v1/auth/auth/info | Get current user info
[**GetUserInfoApiV1AuthAuthInfoGet_0**](AuthenticationAPI.md#GetUserInfoApiV1AuthAuthInfoGet_0) | **Get** /api/v1/auth/auth/info | Get current user info
[**LoginApiV1AuthAuthLoginPost**](AuthenticationAPI.md#LoginApiV1AuthAuthLoginPost) | **Post** /api/v1/auth/auth/login | Password login
[**LoginApiV1AuthAuthLoginPost_0**](AuthenticationAPI.md#LoginApiV1AuthAuthLoginPost_0) | **Post** /api/v1/auth/auth/login | Password login
[**LoginSmsApiV1AuthAuthLoginSmsPost**](AuthenticationAPI.md#LoginSmsApiV1AuthAuthLoginSmsPost) | **Post** /api/v1/auth/auth/login/sms | SMS code login
[**LoginSmsApiV1AuthAuthLoginSmsPost_0**](AuthenticationAPI.md#LoginSmsApiV1AuthAuthLoginSmsPost_0) | **Post** /api/v1/auth/auth/login/sms | SMS code login
[**LogoutApiV1AuthAuthLogoutPost**](AuthenticationAPI.md#LogoutApiV1AuthAuthLogoutPost) | **Post** /api/v1/auth/auth/logout | Logout
[**LogoutApiV1AuthAuthLogoutPost_0**](AuthenticationAPI.md#LogoutApiV1AuthAuthLogoutPost_0) | **Post** /api/v1/auth/auth/logout | Logout
[**RefreshTokenApiV1AuthAuthRefreshPost**](AuthenticationAPI.md#RefreshTokenApiV1AuthAuthRefreshPost) | **Post** /api/v1/auth/auth/refresh | Refresh access token (rotate)
[**RefreshTokenApiV1AuthAuthRefreshPost_0**](AuthenticationAPI.md#RefreshTokenApiV1AuthAuthRefreshPost_0) | **Post** /api/v1/auth/auth/refresh | Refresh access token (rotate)
[**RegisterApiV1AuthAuthRegisterPost**](AuthenticationAPI.md#RegisterApiV1AuthAuthRegisterPost) | **Post** /api/v1/auth/auth/register | Register new user
[**RegisterApiV1AuthAuthRegisterPost_0**](AuthenticationAPI.md#RegisterApiV1AuthAuthRegisterPost_0) | **Post** /api/v1/auth/auth/register | Register new user
[**SendCodeApiV1AuthAuthSmsCodePost**](AuthenticationAPI.md#SendCodeApiV1AuthAuthSmsCodePost) | **Post** /api/v1/auth/auth/sms/code | Send SMS verification code
[**SendCodeApiV1AuthAuthSmsCodePost_0**](AuthenticationAPI.md#SendCodeApiV1AuthAuthSmsCodePost_0) | **Post** /api/v1/auth/auth/sms/code | Send SMS verification code
[**UpdateProfileApiV1AuthAuthProfilePut**](AuthenticationAPI.md#UpdateProfileApiV1AuthAuthProfilePut) | **Put** /api/v1/auth/auth/profile | Update personal profile
[**UpdateProfileApiV1AuthAuthProfilePut_0**](AuthenticationAPI.md#UpdateProfileApiV1AuthAuthProfilePut_0) | **Put** /api/v1/auth/auth/profile | Update personal profile
[**UploadAvatarApiV1AuthAuthProfileAvatarPost**](AuthenticationAPI.md#UploadAvatarApiV1AuthAuthProfileAvatarPost) | **Post** /api/v1/auth/auth/profile/avatar | Upload avatar
[**UploadAvatarApiV1AuthAuthProfileAvatarPost_0**](AuthenticationAPI.md#UploadAvatarApiV1AuthAuthProfileAvatarPost_0) | **Post** /api/v1/auth/auth/profile/avatar | Upload avatar



## CancelAccountApiV1AuthAuthCancelDelete

> interface{} CancelAccountApiV1AuthAuthCancelDelete(ctx).Execute()

User account cancellation (soft delete)



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
	resp, r, err := apiClient.AuthenticationAPI.CancelAccountApiV1AuthAuthCancelDelete(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.CancelAccountApiV1AuthAuthCancelDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CancelAccountApiV1AuthAuthCancelDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.CancelAccountApiV1AuthAuthCancelDelete`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCancelAccountApiV1AuthAuthCancelDeleteRequest struct via the builder pattern


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


## CancelAccountApiV1AuthAuthCancelDelete_0

> interface{} CancelAccountApiV1AuthAuthCancelDelete_0(ctx).Execute()

User account cancellation (soft delete)



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
	resp, r, err := apiClient.AuthenticationAPI.CancelAccountApiV1AuthAuthCancelDelete_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.CancelAccountApiV1AuthAuthCancelDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CancelAccountApiV1AuthAuthCancelDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.CancelAccountApiV1AuthAuthCancelDelete_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCancelAccountApiV1AuthAuthCancelDelete_1Request struct via the builder pattern


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


## ChangePasswordApiV1AuthAuthProfilePasswordPut

> interface{} ChangePasswordApiV1AuthAuthProfilePasswordPut(ctx).BodyChangePasswordApiV1AuthAuthProfilePasswordPut(bodyChangePasswordApiV1AuthAuthProfilePasswordPut).Execute()

Change password



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
	bodyChangePasswordApiV1AuthAuthProfilePasswordPut := *openapiclient.NewBodyChangePasswordApiV1AuthAuthProfilePasswordPut("OldPassword_example", "NewPassword_example") // BodyChangePasswordApiV1AuthAuthProfilePasswordPut | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthenticationAPI.ChangePasswordApiV1AuthAuthProfilePasswordPut(context.Background()).BodyChangePasswordApiV1AuthAuthProfilePasswordPut(bodyChangePasswordApiV1AuthAuthProfilePasswordPut).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.ChangePasswordApiV1AuthAuthProfilePasswordPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ChangePasswordApiV1AuthAuthProfilePasswordPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.ChangePasswordApiV1AuthAuthProfilePasswordPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiChangePasswordApiV1AuthAuthProfilePasswordPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyChangePasswordApiV1AuthAuthProfilePasswordPut** | [**BodyChangePasswordApiV1AuthAuthProfilePasswordPut**](BodyChangePasswordApiV1AuthAuthProfilePasswordPut.md) |  | 

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


## ChangePasswordApiV1AuthAuthProfilePasswordPut_0

> interface{} ChangePasswordApiV1AuthAuthProfilePasswordPut_0(ctx).BodyChangePasswordApiV1AuthAuthProfilePasswordPut(bodyChangePasswordApiV1AuthAuthProfilePasswordPut).Execute()

Change password



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
	bodyChangePasswordApiV1AuthAuthProfilePasswordPut := *openapiclient.NewBodyChangePasswordApiV1AuthAuthProfilePasswordPut("OldPassword_example", "NewPassword_example") // BodyChangePasswordApiV1AuthAuthProfilePasswordPut | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthenticationAPI.ChangePasswordApiV1AuthAuthProfilePasswordPut_0(context.Background()).BodyChangePasswordApiV1AuthAuthProfilePasswordPut(bodyChangePasswordApiV1AuthAuthProfilePasswordPut).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.ChangePasswordApiV1AuthAuthProfilePasswordPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ChangePasswordApiV1AuthAuthProfilePasswordPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.ChangePasswordApiV1AuthAuthProfilePasswordPut_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiChangePasswordApiV1AuthAuthProfilePasswordPut_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyChangePasswordApiV1AuthAuthProfilePasswordPut** | [**BodyChangePasswordApiV1AuthAuthProfilePasswordPut**](BodyChangePasswordApiV1AuthAuthProfilePasswordPut.md) |  | 

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


## CheckPhoneExistsApiV1AuthAuthExistPhoneGet

> interface{} CheckPhoneExistsApiV1AuthAuthExistPhoneGet(ctx, phone).Execute()

Check if phone is registered

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
	phone := "phone_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthenticationAPI.CheckPhoneExistsApiV1AuthAuthExistPhoneGet(context.Background(), phone).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.CheckPhoneExistsApiV1AuthAuthExistPhoneGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CheckPhoneExistsApiV1AuthAuthExistPhoneGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.CheckPhoneExistsApiV1AuthAuthExistPhoneGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**phone** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiCheckPhoneExistsApiV1AuthAuthExistPhoneGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## CheckPhoneExistsApiV1AuthAuthExistPhoneGet_0

> interface{} CheckPhoneExistsApiV1AuthAuthExistPhoneGet_0(ctx, phone).Execute()

Check if phone is registered

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
	phone := "phone_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthenticationAPI.CheckPhoneExistsApiV1AuthAuthExistPhoneGet_0(context.Background(), phone).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.CheckPhoneExistsApiV1AuthAuthExistPhoneGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CheckPhoneExistsApiV1AuthAuthExistPhoneGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.CheckPhoneExistsApiV1AuthAuthExistPhoneGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**phone** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiCheckPhoneExistsApiV1AuthAuthExistPhoneGet_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## GetProfileApiV1AuthAuthProfileGet

> interface{} GetProfileApiV1AuthAuthProfileGet(ctx).Execute()

Get personal profile with roles and posts



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
	resp, r, err := apiClient.AuthenticationAPI.GetProfileApiV1AuthAuthProfileGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.GetProfileApiV1AuthAuthProfileGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetProfileApiV1AuthAuthProfileGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.GetProfileApiV1AuthAuthProfileGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetProfileApiV1AuthAuthProfileGetRequest struct via the builder pattern


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


## GetProfileApiV1AuthAuthProfileGet_0

> interface{} GetProfileApiV1AuthAuthProfileGet_0(ctx).Execute()

Get personal profile with roles and posts



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
	resp, r, err := apiClient.AuthenticationAPI.GetProfileApiV1AuthAuthProfileGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.GetProfileApiV1AuthAuthProfileGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetProfileApiV1AuthAuthProfileGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.GetProfileApiV1AuthAuthProfileGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetProfileApiV1AuthAuthProfileGet_4Request struct via the builder pattern


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


## GetUserInfoApiV1AuthAuthInfoGet

> interface{} GetUserInfoApiV1AuthAuthInfoGet(ctx).Execute()

Get current user info

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
	resp, r, err := apiClient.AuthenticationAPI.GetUserInfoApiV1AuthAuthInfoGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.GetUserInfoApiV1AuthAuthInfoGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetUserInfoApiV1AuthAuthInfoGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.GetUserInfoApiV1AuthAuthInfoGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetUserInfoApiV1AuthAuthInfoGetRequest struct via the builder pattern


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


## GetUserInfoApiV1AuthAuthInfoGet_0

> interface{} GetUserInfoApiV1AuthAuthInfoGet_0(ctx).Execute()

Get current user info

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
	resp, r, err := apiClient.AuthenticationAPI.GetUserInfoApiV1AuthAuthInfoGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.GetUserInfoApiV1AuthAuthInfoGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetUserInfoApiV1AuthAuthInfoGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.GetUserInfoApiV1AuthAuthInfoGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetUserInfoApiV1AuthAuthInfoGet_5Request struct via the builder pattern


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


## LoginApiV1AuthAuthLoginPost

> interface{} LoginApiV1AuthAuthLoginPost(ctx).Phone(phone).Password(password).Execute()

Password login

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
	phone := "phone_example" // string | 
	password := "password_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthenticationAPI.LoginApiV1AuthAuthLoginPost(context.Background()).Phone(phone).Password(password).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.LoginApiV1AuthAuthLoginPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LoginApiV1AuthAuthLoginPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.LoginApiV1AuthAuthLoginPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiLoginApiV1AuthAuthLoginPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **string** |  | 
 **password** | **string** |  | 

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


## LoginApiV1AuthAuthLoginPost_0

> interface{} LoginApiV1AuthAuthLoginPost_0(ctx).Phone(phone).Password(password).Execute()

Password login

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
	phone := "phone_example" // string | 
	password := "password_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthenticationAPI.LoginApiV1AuthAuthLoginPost_0(context.Background()).Phone(phone).Password(password).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.LoginApiV1AuthAuthLoginPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LoginApiV1AuthAuthLoginPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.LoginApiV1AuthAuthLoginPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiLoginApiV1AuthAuthLoginPost_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **string** |  | 
 **password** | **string** |  | 

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


## LoginSmsApiV1AuthAuthLoginSmsPost

> interface{} LoginSmsApiV1AuthAuthLoginSmsPost(ctx).Phone(phone).Code(code).Execute()

SMS code login

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
	phone := "phone_example" // string | 
	code := "code_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthenticationAPI.LoginSmsApiV1AuthAuthLoginSmsPost(context.Background()).Phone(phone).Code(code).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.LoginSmsApiV1AuthAuthLoginSmsPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LoginSmsApiV1AuthAuthLoginSmsPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.LoginSmsApiV1AuthAuthLoginSmsPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiLoginSmsApiV1AuthAuthLoginSmsPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **string** |  | 
 **code** | **string** |  | 

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


## LoginSmsApiV1AuthAuthLoginSmsPost_0

> interface{} LoginSmsApiV1AuthAuthLoginSmsPost_0(ctx).Phone(phone).Code(code).Execute()

SMS code login

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
	phone := "phone_example" // string | 
	code := "code_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthenticationAPI.LoginSmsApiV1AuthAuthLoginSmsPost_0(context.Background()).Phone(phone).Code(code).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.LoginSmsApiV1AuthAuthLoginSmsPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LoginSmsApiV1AuthAuthLoginSmsPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.LoginSmsApiV1AuthAuthLoginSmsPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiLoginSmsApiV1AuthAuthLoginSmsPost_7Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **string** |  | 
 **code** | **string** |  | 

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


## LogoutApiV1AuthAuthLogoutPost

> interface{} LogoutApiV1AuthAuthLogoutPost(ctx).Execute()

Logout



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
	resp, r, err := apiClient.AuthenticationAPI.LogoutApiV1AuthAuthLogoutPost(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.LogoutApiV1AuthAuthLogoutPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LogoutApiV1AuthAuthLogoutPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.LogoutApiV1AuthAuthLogoutPost`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiLogoutApiV1AuthAuthLogoutPostRequest struct via the builder pattern


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


## LogoutApiV1AuthAuthLogoutPost_0

> interface{} LogoutApiV1AuthAuthLogoutPost_0(ctx).Execute()

Logout



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
	resp, r, err := apiClient.AuthenticationAPI.LogoutApiV1AuthAuthLogoutPost_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.LogoutApiV1AuthAuthLogoutPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LogoutApiV1AuthAuthLogoutPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.LogoutApiV1AuthAuthLogoutPost_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiLogoutApiV1AuthAuthLogoutPost_8Request struct via the builder pattern


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


## RefreshTokenApiV1AuthAuthRefreshPost

> interface{} RefreshTokenApiV1AuthAuthRefreshPost(ctx).RefreshToken(refreshToken).Execute()

Refresh access token (rotate)



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
	refreshToken := "refreshToken_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthenticationAPI.RefreshTokenApiV1AuthAuthRefreshPost(context.Background()).RefreshToken(refreshToken).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.RefreshTokenApiV1AuthAuthRefreshPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RefreshTokenApiV1AuthAuthRefreshPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.RefreshTokenApiV1AuthAuthRefreshPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRefreshTokenApiV1AuthAuthRefreshPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **refreshToken** | **string** |  | 

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


## RefreshTokenApiV1AuthAuthRefreshPost_0

> interface{} RefreshTokenApiV1AuthAuthRefreshPost_0(ctx).RefreshToken(refreshToken).Execute()

Refresh access token (rotate)



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
	refreshToken := "refreshToken_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthenticationAPI.RefreshTokenApiV1AuthAuthRefreshPost_0(context.Background()).RefreshToken(refreshToken).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.RefreshTokenApiV1AuthAuthRefreshPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RefreshTokenApiV1AuthAuthRefreshPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.RefreshTokenApiV1AuthAuthRefreshPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRefreshTokenApiV1AuthAuthRefreshPost_9Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **refreshToken** | **string** |  | 

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


## RegisterApiV1AuthAuthRegisterPost

> interface{} RegisterApiV1AuthAuthRegisterPost(ctx).Phone(phone).Password(password).Nickname(nickname).Execute()

Register new user

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
	phone := "phone_example" // string | 
	password := "password_example" // string | 
	nickname := "nickname_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthenticationAPI.RegisterApiV1AuthAuthRegisterPost(context.Background()).Phone(phone).Password(password).Nickname(nickname).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.RegisterApiV1AuthAuthRegisterPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RegisterApiV1AuthAuthRegisterPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.RegisterApiV1AuthAuthRegisterPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRegisterApiV1AuthAuthRegisterPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **string** |  | 
 **password** | **string** |  | 
 **nickname** | **string** |  | 

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


## RegisterApiV1AuthAuthRegisterPost_0

> interface{} RegisterApiV1AuthAuthRegisterPost_0(ctx).Phone(phone).Password(password).Nickname(nickname).Execute()

Register new user

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
	phone := "phone_example" // string | 
	password := "password_example" // string | 
	nickname := "nickname_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthenticationAPI.RegisterApiV1AuthAuthRegisterPost_0(context.Background()).Phone(phone).Password(password).Nickname(nickname).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.RegisterApiV1AuthAuthRegisterPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RegisterApiV1AuthAuthRegisterPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.RegisterApiV1AuthAuthRegisterPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRegisterApiV1AuthAuthRegisterPost_10Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **string** |  | 
 **password** | **string** |  | 
 **nickname** | **string** |  | 

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


## SendCodeApiV1AuthAuthSmsCodePost

> interface{} SendCodeApiV1AuthAuthSmsCodePost(ctx).Phone(phone).Execute()

Send SMS verification code

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
	phone := "phone_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthenticationAPI.SendCodeApiV1AuthAuthSmsCodePost(context.Background()).Phone(phone).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.SendCodeApiV1AuthAuthSmsCodePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SendCodeApiV1AuthAuthSmsCodePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.SendCodeApiV1AuthAuthSmsCodePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSendCodeApiV1AuthAuthSmsCodePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **string** |  | 

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


## SendCodeApiV1AuthAuthSmsCodePost_0

> interface{} SendCodeApiV1AuthAuthSmsCodePost_0(ctx).Phone(phone).Execute()

Send SMS verification code

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
	phone := "phone_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthenticationAPI.SendCodeApiV1AuthAuthSmsCodePost_0(context.Background()).Phone(phone).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.SendCodeApiV1AuthAuthSmsCodePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SendCodeApiV1AuthAuthSmsCodePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.SendCodeApiV1AuthAuthSmsCodePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSendCodeApiV1AuthAuthSmsCodePost_11Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **phone** | **string** |  | 

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


## UpdateProfileApiV1AuthAuthProfilePut

> interface{} UpdateProfileApiV1AuthAuthProfilePut(ctx).BodyUpdateProfileApiV1AuthAuthProfilePut(bodyUpdateProfileApiV1AuthAuthProfilePut).Execute()

Update personal profile



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
	bodyUpdateProfileApiV1AuthAuthProfilePut := *openapiclient.NewBodyUpdateProfileApiV1AuthAuthProfilePut() // BodyUpdateProfileApiV1AuthAuthProfilePut |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthenticationAPI.UpdateProfileApiV1AuthAuthProfilePut(context.Background()).BodyUpdateProfileApiV1AuthAuthProfilePut(bodyUpdateProfileApiV1AuthAuthProfilePut).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.UpdateProfileApiV1AuthAuthProfilePut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateProfileApiV1AuthAuthProfilePut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.UpdateProfileApiV1AuthAuthProfilePut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateProfileApiV1AuthAuthProfilePutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyUpdateProfileApiV1AuthAuthProfilePut** | [**BodyUpdateProfileApiV1AuthAuthProfilePut**](BodyUpdateProfileApiV1AuthAuthProfilePut.md) |  | 

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


## UpdateProfileApiV1AuthAuthProfilePut_0

> interface{} UpdateProfileApiV1AuthAuthProfilePut_0(ctx).BodyUpdateProfileApiV1AuthAuthProfilePut(bodyUpdateProfileApiV1AuthAuthProfilePut).Execute()

Update personal profile



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
	bodyUpdateProfileApiV1AuthAuthProfilePut := *openapiclient.NewBodyUpdateProfileApiV1AuthAuthProfilePut() // BodyUpdateProfileApiV1AuthAuthProfilePut |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthenticationAPI.UpdateProfileApiV1AuthAuthProfilePut_0(context.Background()).BodyUpdateProfileApiV1AuthAuthProfilePut(bodyUpdateProfileApiV1AuthAuthProfilePut).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.UpdateProfileApiV1AuthAuthProfilePut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateProfileApiV1AuthAuthProfilePut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.UpdateProfileApiV1AuthAuthProfilePut_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateProfileApiV1AuthAuthProfilePut_12Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyUpdateProfileApiV1AuthAuthProfilePut** | [**BodyUpdateProfileApiV1AuthAuthProfilePut**](BodyUpdateProfileApiV1AuthAuthProfilePut.md) |  | 

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


## UploadAvatarApiV1AuthAuthProfileAvatarPost

> interface{} UploadAvatarApiV1AuthAuthProfileAvatarPost(ctx).File(file).Execute()

Upload avatar



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
	file := os.NewFile(1234, "some_file") // *os.File | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthenticationAPI.UploadAvatarApiV1AuthAuthProfileAvatarPost(context.Background()).File(file).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.UploadAvatarApiV1AuthAuthProfileAvatarPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UploadAvatarApiV1AuthAuthProfileAvatarPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.UploadAvatarApiV1AuthAuthProfileAvatarPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUploadAvatarApiV1AuthAuthProfileAvatarPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file** | ***os.File** |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## UploadAvatarApiV1AuthAuthProfileAvatarPost_0

> interface{} UploadAvatarApiV1AuthAuthProfileAvatarPost_0(ctx).File(file).Execute()

Upload avatar



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
	file := os.NewFile(1234, "some_file") // *os.File | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthenticationAPI.UploadAvatarApiV1AuthAuthProfileAvatarPost_0(context.Background()).File(file).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthenticationAPI.UploadAvatarApiV1AuthAuthProfileAvatarPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UploadAvatarApiV1AuthAuthProfileAvatarPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthenticationAPI.UploadAvatarApiV1AuthAuthProfileAvatarPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUploadAvatarApiV1AuthAuthProfileAvatarPost_13Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file** | ***os.File** |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

