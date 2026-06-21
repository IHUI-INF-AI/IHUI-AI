# \UserSKAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateSkApiV1AuthUserSkCreatePost**](UserSKAPI.md#CreateSkApiV1AuthUserSkCreatePost) | **Post** /api/v1/auth/user-sk/create | Create a secret key
[**CreateSkApiV1AuthUserSkCreatePost_0**](UserSKAPI.md#CreateSkApiV1AuthUserSkCreatePost_0) | **Post** /api/v1/auth/user-sk/create | Create a secret key
[**DeleteSkApiV1AuthUserSkSkIdDelete**](UserSKAPI.md#DeleteSkApiV1AuthUserSkSkIdDelete) | **Delete** /api/v1/auth/user-sk/{sk_id} | Delete a secret key
[**DeleteSkApiV1AuthUserSkSkIdDelete_0**](UserSKAPI.md#DeleteSkApiV1AuthUserSkSkIdDelete_0) | **Delete** /api/v1/auth/user-sk/{sk_id} | Delete a secret key
[**ListSksApiV1AuthUserSkListGet**](UserSKAPI.md#ListSksApiV1AuthUserSkListGet) | **Get** /api/v1/auth/user-sk/list | List user secret keys
[**ListSksApiV1AuthUserSkListGet_0**](UserSKAPI.md#ListSksApiV1AuthUserSkListGet_0) | **Get** /api/v1/auth/user-sk/list | List user secret keys
[**UpdateSkApiV1AuthUserSkSkIdPut**](UserSKAPI.md#UpdateSkApiV1AuthUserSkSkIdPut) | **Put** /api/v1/auth/user-sk/{sk_id} | Update a secret key
[**UpdateSkApiV1AuthUserSkSkIdPut_0**](UserSKAPI.md#UpdateSkApiV1AuthUserSkSkIdPut_0) | **Put** /api/v1/auth/user-sk/{sk_id} | Update a secret key



## CreateSkApiV1AuthUserSkCreatePost

> interface{} CreateSkApiV1AuthUserSkCreatePost(ctx).Body(body).Execute()

Create a secret key



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
	body := map[string]interface{}{ ... } // map[string]interface{} | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserSKAPI.CreateSkApiV1AuthUserSkCreatePost(context.Background()).Body(body).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserSKAPI.CreateSkApiV1AuthUserSkCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateSkApiV1AuthUserSkCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserSKAPI.CreateSkApiV1AuthUserSkCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateSkApiV1AuthUserSkCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body** | **map[string]interface{}** |  | 

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


## CreateSkApiV1AuthUserSkCreatePost_0

> interface{} CreateSkApiV1AuthUserSkCreatePost_0(ctx).Body(body).Execute()

Create a secret key



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
	body := map[string]interface{}{ ... } // map[string]interface{} | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserSKAPI.CreateSkApiV1AuthUserSkCreatePost_0(context.Background()).Body(body).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserSKAPI.CreateSkApiV1AuthUserSkCreatePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateSkApiV1AuthUserSkCreatePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserSKAPI.CreateSkApiV1AuthUserSkCreatePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateSkApiV1AuthUserSkCreatePost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body** | **map[string]interface{}** |  | 

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


## DeleteSkApiV1AuthUserSkSkIdDelete

> interface{} DeleteSkApiV1AuthUserSkSkIdDelete(ctx, skId).Execute()

Delete a secret key



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
	skId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserSKAPI.DeleteSkApiV1AuthUserSkSkIdDelete(context.Background(), skId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserSKAPI.DeleteSkApiV1AuthUserSkSkIdDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteSkApiV1AuthUserSkSkIdDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserSKAPI.DeleteSkApiV1AuthUserSkSkIdDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**skId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteSkApiV1AuthUserSkSkIdDeleteRequest struct via the builder pattern


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


## DeleteSkApiV1AuthUserSkSkIdDelete_0

> interface{} DeleteSkApiV1AuthUserSkSkIdDelete_0(ctx, skId).Execute()

Delete a secret key



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
	skId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserSKAPI.DeleteSkApiV1AuthUserSkSkIdDelete_0(context.Background(), skId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserSKAPI.DeleteSkApiV1AuthUserSkSkIdDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteSkApiV1AuthUserSkSkIdDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserSKAPI.DeleteSkApiV1AuthUserSkSkIdDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**skId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteSkApiV1AuthUserSkSkIdDelete_2Request struct via the builder pattern


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


## ListSksApiV1AuthUserSkListGet

> interface{} ListSksApiV1AuthUserSkListGet(ctx).Page(page).Limit(limit).Execute()

List user secret keys



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
	resp, r, err := apiClient.UserSKAPI.ListSksApiV1AuthUserSkListGet(context.Background()).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserSKAPI.ListSksApiV1AuthUserSkListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListSksApiV1AuthUserSkListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserSKAPI.ListSksApiV1AuthUserSkListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListSksApiV1AuthUserSkListGetRequest struct via the builder pattern


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


## ListSksApiV1AuthUserSkListGet_0

> interface{} ListSksApiV1AuthUserSkListGet_0(ctx).Page(page).Limit(limit).Execute()

List user secret keys



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
	resp, r, err := apiClient.UserSKAPI.ListSksApiV1AuthUserSkListGet_0(context.Background()).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserSKAPI.ListSksApiV1AuthUserSkListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListSksApiV1AuthUserSkListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserSKAPI.ListSksApiV1AuthUserSkListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListSksApiV1AuthUserSkListGet_3Request struct via the builder pattern


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


## UpdateSkApiV1AuthUserSkSkIdPut

> interface{} UpdateSkApiV1AuthUserSkSkIdPut(ctx, skId).SKUpdateBody(sKUpdateBody).Execute()

Update a secret key



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
	skId := int32(56) // int32 | 
	sKUpdateBody := *openapiclient.NewSKUpdateBody() // SKUpdateBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserSKAPI.UpdateSkApiV1AuthUserSkSkIdPut(context.Background(), skId).SKUpdateBody(sKUpdateBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserSKAPI.UpdateSkApiV1AuthUserSkSkIdPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateSkApiV1AuthUserSkSkIdPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserSKAPI.UpdateSkApiV1AuthUserSkSkIdPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**skId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateSkApiV1AuthUserSkSkIdPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **sKUpdateBody** | [**SKUpdateBody**](SKUpdateBody.md) |  | 

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


## UpdateSkApiV1AuthUserSkSkIdPut_0

> interface{} UpdateSkApiV1AuthUserSkSkIdPut_0(ctx, skId).SKUpdateBody(sKUpdateBody).Execute()

Update a secret key



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
	skId := int32(56) // int32 | 
	sKUpdateBody := *openapiclient.NewSKUpdateBody() // SKUpdateBody | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserSKAPI.UpdateSkApiV1AuthUserSkSkIdPut_0(context.Background(), skId).SKUpdateBody(sKUpdateBody).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserSKAPI.UpdateSkApiV1AuthUserSkSkIdPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateSkApiV1AuthUserSkSkIdPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserSKAPI.UpdateSkApiV1AuthUserSkSkIdPut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**skId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateSkApiV1AuthUserSkSkIdPut_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **sKUpdateBody** | [**SKUpdateBody**](SKUpdateBody.md) |  | 

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

