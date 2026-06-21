# \OAuthAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AuthorizeApiV1AuthOauthAuthorizeGet**](OAuthAPI.md#AuthorizeApiV1AuthOauthAuthorizeGet) | **Get** /api/v1/auth/oauth/authorize | OAuth authorize
[**AuthorizeApiV1AuthOauthAuthorizeGet_0**](OAuthAPI.md#AuthorizeApiV1AuthOauthAuthorizeGet_0) | **Get** /api/v1/auth/oauth/authorize | OAuth authorize
[**CreateOauthAppApiV1AuthOauthAppsCreatePost**](OAuthAPI.md#CreateOauthAppApiV1AuthOauthAppsCreatePost) | **Post** /api/v1/auth/oauth/apps/create | Create an OAuth application
[**CreateOauthAppApiV1AuthOauthAppsCreatePost_0**](OAuthAPI.md#CreateOauthAppApiV1AuthOauthAppsCreatePost_0) | **Post** /api/v1/auth/oauth/apps/create | Create an OAuth application
[**DeleteOauthAppApiV1AuthOauthAppsClientIdDelete**](OAuthAPI.md#DeleteOauthAppApiV1AuthOauthAppsClientIdDelete) | **Delete** /api/v1/auth/oauth/apps/{client_id} | Delete OAuth application
[**DeleteOauthAppApiV1AuthOauthAppsClientIdDelete_0**](OAuthAPI.md#DeleteOauthAppApiV1AuthOauthAppsClientIdDelete_0) | **Delete** /api/v1/auth/oauth/apps/{client_id} | Delete OAuth application
[**GetOauthAppApiV1AuthOauthAppsClientIdGet**](OAuthAPI.md#GetOauthAppApiV1AuthOauthAppsClientIdGet) | **Get** /api/v1/auth/oauth/apps/{client_id} | Get OAuth application by client_id
[**GetOauthAppApiV1AuthOauthAppsClientIdGet_0**](OAuthAPI.md#GetOauthAppApiV1AuthOauthAppsClientIdGet_0) | **Get** /api/v1/auth/oauth/apps/{client_id} | Get OAuth application by client_id
[**GetOauthUserApiV1AuthOauthUsersUserIdGet**](OAuthAPI.md#GetOauthUserApiV1AuthOauthUsersUserIdGet) | **Get** /api/v1/auth/oauth/users/{user_id} | OAuth 用户详情
[**GetOauthUserApiV1AuthOauthUsersUserIdGet_0**](OAuthAPI.md#GetOauthUserApiV1AuthOauthUsersUserIdGet_0) | **Get** /api/v1/auth/oauth/users/{user_id} | OAuth 用户详情
[**ListOauthAppsApiV1AuthOauthAppsListGet**](OAuthAPI.md#ListOauthAppsApiV1AuthOauthAppsListGet) | **Get** /api/v1/auth/oauth/apps/list | List OAuth applications
[**ListOauthAppsApiV1AuthOauthAppsListGet_0**](OAuthAPI.md#ListOauthAppsApiV1AuthOauthAppsListGet_0) | **Get** /api/v1/auth/oauth/apps/list | List OAuth applications
[**ListOauthUsersApiV1AuthOauthUsersListGet**](OAuthAPI.md#ListOauthUsersApiV1AuthOauthUsersListGet) | **Get** /api/v1/auth/oauth/users/list | OAuth 用户列表
[**ListOauthUsersApiV1AuthOauthUsersListGet_0**](OAuthAPI.md#ListOauthUsersApiV1AuthOauthUsersListGet_0) | **Get** /api/v1/auth/oauth/users/list | OAuth 用户列表
[**OauthTokenApiV1AuthOauthTokenPost**](OAuthAPI.md#OauthTokenApiV1AuthOauthTokenPost) | **Post** /api/v1/auth/oauth/token | Exchange code for token
[**OauthTokenApiV1AuthOauthTokenPost_0**](OAuthAPI.md#OauthTokenApiV1AuthOauthTokenPost_0) | **Post** /api/v1/auth/oauth/token | Exchange code for token



## AuthorizeApiV1AuthOauthAuthorizeGet

> interface{} AuthorizeApiV1AuthOauthAuthorizeGet(ctx).ClientId(clientId).RedirectUri(redirectUri).ResponseType(responseType).State(state).Execute()

OAuth authorize



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
	clientId := "clientId_example" // string | 
	redirectUri := "redirectUri_example" // string | 
	responseType := "responseType_example" // string |  (optional) (default to "code")
	state := "state_example" // string | CSRF state parameter (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OAuthAPI.AuthorizeApiV1AuthOauthAuthorizeGet(context.Background()).ClientId(clientId).RedirectUri(redirectUri).ResponseType(responseType).State(state).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OAuthAPI.AuthorizeApiV1AuthOauthAuthorizeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AuthorizeApiV1AuthOauthAuthorizeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OAuthAPI.AuthorizeApiV1AuthOauthAuthorizeGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAuthorizeApiV1AuthOauthAuthorizeGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **clientId** | **string** |  | 
 **redirectUri** | **string** |  | 
 **responseType** | **string** |  | [default to &quot;code&quot;]
 **state** | **string** | CSRF state parameter | 

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


## AuthorizeApiV1AuthOauthAuthorizeGet_0

> interface{} AuthorizeApiV1AuthOauthAuthorizeGet_0(ctx).ClientId(clientId).RedirectUri(redirectUri).ResponseType(responseType).State(state).Execute()

OAuth authorize



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
	clientId := "clientId_example" // string | 
	redirectUri := "redirectUri_example" // string | 
	responseType := "responseType_example" // string |  (optional) (default to "code")
	state := "state_example" // string | CSRF state parameter (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OAuthAPI.AuthorizeApiV1AuthOauthAuthorizeGet_0(context.Background()).ClientId(clientId).RedirectUri(redirectUri).ResponseType(responseType).State(state).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OAuthAPI.AuthorizeApiV1AuthOauthAuthorizeGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AuthorizeApiV1AuthOauthAuthorizeGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OAuthAPI.AuthorizeApiV1AuthOauthAuthorizeGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAuthorizeApiV1AuthOauthAuthorizeGet_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **clientId** | **string** |  | 
 **redirectUri** | **string** |  | 
 **responseType** | **string** |  | [default to &quot;code&quot;]
 **state** | **string** | CSRF state parameter | 

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


## CreateOauthAppApiV1AuthOauthAppsCreatePost

> interface{} CreateOauthAppApiV1AuthOauthAppsCreatePost(ctx).OAuthAppCreateBody(oAuthAppCreateBody).Execute()

Create an OAuth application



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
	oAuthAppCreateBody := *openapiclient.NewOAuthAppCreateBody("Name_example") // OAuthAppCreateBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OAuthAPI.CreateOauthAppApiV1AuthOauthAppsCreatePost(context.Background()).OAuthAppCreateBody(oAuthAppCreateBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OAuthAPI.CreateOauthAppApiV1AuthOauthAppsCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateOauthAppApiV1AuthOauthAppsCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OAuthAPI.CreateOauthAppApiV1AuthOauthAppsCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateOauthAppApiV1AuthOauthAppsCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **oAuthAppCreateBody** | [**OAuthAppCreateBody**](OAuthAppCreateBody.md) |  | 

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


## CreateOauthAppApiV1AuthOauthAppsCreatePost_0

> interface{} CreateOauthAppApiV1AuthOauthAppsCreatePost_0(ctx).OAuthAppCreateBody(oAuthAppCreateBody).Execute()

Create an OAuth application



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
	oAuthAppCreateBody := *openapiclient.NewOAuthAppCreateBody("Name_example") // OAuthAppCreateBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OAuthAPI.CreateOauthAppApiV1AuthOauthAppsCreatePost_0(context.Background()).OAuthAppCreateBody(oAuthAppCreateBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OAuthAPI.CreateOauthAppApiV1AuthOauthAppsCreatePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateOauthAppApiV1AuthOauthAppsCreatePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OAuthAPI.CreateOauthAppApiV1AuthOauthAppsCreatePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateOauthAppApiV1AuthOauthAppsCreatePost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **oAuthAppCreateBody** | [**OAuthAppCreateBody**](OAuthAppCreateBody.md) |  | 

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


## DeleteOauthAppApiV1AuthOauthAppsClientIdDelete

> interface{} DeleteOauthAppApiV1AuthOauthAppsClientIdDelete(ctx, clientId).Execute()

Delete OAuth application



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
	clientId := "clientId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OAuthAPI.DeleteOauthAppApiV1AuthOauthAppsClientIdDelete(context.Background(), clientId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OAuthAPI.DeleteOauthAppApiV1AuthOauthAppsClientIdDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteOauthAppApiV1AuthOauthAppsClientIdDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OAuthAPI.DeleteOauthAppApiV1AuthOauthAppsClientIdDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**clientId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteOauthAppApiV1AuthOauthAppsClientIdDeleteRequest struct via the builder pattern


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


## DeleteOauthAppApiV1AuthOauthAppsClientIdDelete_0

> interface{} DeleteOauthAppApiV1AuthOauthAppsClientIdDelete_0(ctx, clientId).Execute()

Delete OAuth application



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
	clientId := "clientId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OAuthAPI.DeleteOauthAppApiV1AuthOauthAppsClientIdDelete_0(context.Background(), clientId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OAuthAPI.DeleteOauthAppApiV1AuthOauthAppsClientIdDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteOauthAppApiV1AuthOauthAppsClientIdDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OAuthAPI.DeleteOauthAppApiV1AuthOauthAppsClientIdDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**clientId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteOauthAppApiV1AuthOauthAppsClientIdDelete_3Request struct via the builder pattern


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


## GetOauthAppApiV1AuthOauthAppsClientIdGet

> interface{} GetOauthAppApiV1AuthOauthAppsClientIdGet(ctx, clientId).Execute()

Get OAuth application by client_id



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
	clientId := "clientId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OAuthAPI.GetOauthAppApiV1AuthOauthAppsClientIdGet(context.Background(), clientId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OAuthAPI.GetOauthAppApiV1AuthOauthAppsClientIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetOauthAppApiV1AuthOauthAppsClientIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OAuthAPI.GetOauthAppApiV1AuthOauthAppsClientIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**clientId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetOauthAppApiV1AuthOauthAppsClientIdGetRequest struct via the builder pattern


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


## GetOauthAppApiV1AuthOauthAppsClientIdGet_0

> interface{} GetOauthAppApiV1AuthOauthAppsClientIdGet_0(ctx, clientId).Execute()

Get OAuth application by client_id



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
	clientId := "clientId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OAuthAPI.GetOauthAppApiV1AuthOauthAppsClientIdGet_0(context.Background(), clientId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OAuthAPI.GetOauthAppApiV1AuthOauthAppsClientIdGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetOauthAppApiV1AuthOauthAppsClientIdGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OAuthAPI.GetOauthAppApiV1AuthOauthAppsClientIdGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**clientId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetOauthAppApiV1AuthOauthAppsClientIdGet_4Request struct via the builder pattern


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


## GetOauthUserApiV1AuthOauthUsersUserIdGet

> interface{} GetOauthUserApiV1AuthOauthUsersUserIdGet(ctx, userId).Execute()

OAuth 用户详情

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
	userId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OAuthAPI.GetOauthUserApiV1AuthOauthUsersUserIdGet(context.Background(), userId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OAuthAPI.GetOauthUserApiV1AuthOauthUsersUserIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetOauthUserApiV1AuthOauthUsersUserIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OAuthAPI.GetOauthUserApiV1AuthOauthUsersUserIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**userId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetOauthUserApiV1AuthOauthUsersUserIdGetRequest struct via the builder pattern


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


## GetOauthUserApiV1AuthOauthUsersUserIdGet_0

> interface{} GetOauthUserApiV1AuthOauthUsersUserIdGet_0(ctx, userId).Execute()

OAuth 用户详情

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
	userId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OAuthAPI.GetOauthUserApiV1AuthOauthUsersUserIdGet_0(context.Background(), userId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OAuthAPI.GetOauthUserApiV1AuthOauthUsersUserIdGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetOauthUserApiV1AuthOauthUsersUserIdGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OAuthAPI.GetOauthUserApiV1AuthOauthUsersUserIdGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**userId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetOauthUserApiV1AuthOauthUsersUserIdGet_5Request struct via the builder pattern


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


## ListOauthAppsApiV1AuthOauthAppsListGet

> interface{} ListOauthAppsApiV1AuthOauthAppsListGet(ctx).Page(page).Limit(limit).Execute()

List OAuth applications



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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OAuthAPI.ListOauthAppsApiV1AuthOauthAppsListGet(context.Background()).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OAuthAPI.ListOauthAppsApiV1AuthOauthAppsListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListOauthAppsApiV1AuthOauthAppsListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OAuthAPI.ListOauthAppsApiV1AuthOauthAppsListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListOauthAppsApiV1AuthOauthAppsListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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


## ListOauthAppsApiV1AuthOauthAppsListGet_0

> interface{} ListOauthAppsApiV1AuthOauthAppsListGet_0(ctx).Page(page).Limit(limit).Execute()

List OAuth applications



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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OAuthAPI.ListOauthAppsApiV1AuthOauthAppsListGet_0(context.Background()).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OAuthAPI.ListOauthAppsApiV1AuthOauthAppsListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListOauthAppsApiV1AuthOauthAppsListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OAuthAPI.ListOauthAppsApiV1AuthOauthAppsListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListOauthAppsApiV1AuthOauthAppsListGet_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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


## ListOauthUsersApiV1AuthOauthUsersListGet

> interface{} ListOauthUsersApiV1AuthOauthUsersListGet(ctx).Page(page).Limit(limit).Provider(provider).Execute()

OAuth 用户列表

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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)
	provider := "provider_example" // string | 按 provider 过滤 (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OAuthAPI.ListOauthUsersApiV1AuthOauthUsersListGet(context.Background()).Page(page).Limit(limit).Provider(provider).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OAuthAPI.ListOauthUsersApiV1AuthOauthUsersListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListOauthUsersApiV1AuthOauthUsersListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OAuthAPI.ListOauthUsersApiV1AuthOauthUsersListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListOauthUsersApiV1AuthOauthUsersListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **provider** | **string** | 按 provider 过滤 | 

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


## ListOauthUsersApiV1AuthOauthUsersListGet_0

> interface{} ListOauthUsersApiV1AuthOauthUsersListGet_0(ctx).Page(page).Limit(limit).Provider(provider).Execute()

OAuth 用户列表

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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)
	provider := "provider_example" // string | 按 provider 过滤 (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OAuthAPI.ListOauthUsersApiV1AuthOauthUsersListGet_0(context.Background()).Page(page).Limit(limit).Provider(provider).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OAuthAPI.ListOauthUsersApiV1AuthOauthUsersListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListOauthUsersApiV1AuthOauthUsersListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OAuthAPI.ListOauthUsersApiV1AuthOauthUsersListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListOauthUsersApiV1AuthOauthUsersListGet_7Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **provider** | **string** | 按 provider 过滤 | 

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


## OauthTokenApiV1AuthOauthTokenPost

> interface{} OauthTokenApiV1AuthOauthTokenPost(ctx).Code(code).ClientId(clientId).ClientSecret(clientSecret).State(state).Execute()

Exchange code for token

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
	code := "code_example" // string | 
	clientId := "clientId_example" // string | 
	clientSecret := "clientSecret_example" // string | 
	state := "state_example" // string | CSRF state to verify against session (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OAuthAPI.OauthTokenApiV1AuthOauthTokenPost(context.Background()).Code(code).ClientId(clientId).ClientSecret(clientSecret).State(state).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OAuthAPI.OauthTokenApiV1AuthOauthTokenPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `OauthTokenApiV1AuthOauthTokenPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OAuthAPI.OauthTokenApiV1AuthOauthTokenPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiOauthTokenApiV1AuthOauthTokenPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** |  | 
 **clientId** | **string** |  | 
 **clientSecret** | **string** |  | 
 **state** | **string** | CSRF state to verify against session | 

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


## OauthTokenApiV1AuthOauthTokenPost_0

> interface{} OauthTokenApiV1AuthOauthTokenPost_0(ctx).Code(code).ClientId(clientId).ClientSecret(clientSecret).State(state).Execute()

Exchange code for token

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
	code := "code_example" // string | 
	clientId := "clientId_example" // string | 
	clientSecret := "clientSecret_example" // string | 
	state := "state_example" // string | CSRF state to verify against session (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OAuthAPI.OauthTokenApiV1AuthOauthTokenPost_0(context.Background()).Code(code).ClientId(clientId).ClientSecret(clientSecret).State(state).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OAuthAPI.OauthTokenApiV1AuthOauthTokenPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `OauthTokenApiV1AuthOauthTokenPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OAuthAPI.OauthTokenApiV1AuthOauthTokenPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiOauthTokenApiV1AuthOauthTokenPost_8Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** |  | 
 **clientId** | **string** |  | 
 **clientSecret** | **string** |  | 
 **state** | **string** | CSRF state to verify against session | 

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

