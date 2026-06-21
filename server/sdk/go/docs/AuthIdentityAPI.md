# \AuthIdentityAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AuditApiV1AuthIdentityAidAuditPut**](AuthIdentityAPI.md#AuditApiV1AuthIdentityAidAuditPut) | **Put** /api/v1/auth-identity/{aid}/audit | 审核认证
[**AuditApiV1AuthIdentityAidAuditPut_0**](AuthIdentityAPI.md#AuditApiV1AuthIdentityAidAuditPut_0) | **Put** /api/v1/auth-identity/{aid}/audit | 审核认证
[**AuthIdentitySubmit**](AuthIdentityAPI.md#AuthIdentitySubmit) | **Post** /api/v1/auth-identity/submit | 提交实名认证
[**AuthIdentitySubmit_0**](AuthIdentityAPI.md#AuthIdentitySubmit_0) | **Post** /api/v1/auth-identity/submit | 提交实名认证
[**ListIdentitiesApiV1AuthIdentityListGet**](AuthIdentityAPI.md#ListIdentitiesApiV1AuthIdentityListGet) | **Get** /api/v1/auth-identity/list | 认证列表(管理员)
[**ListIdentitiesApiV1AuthIdentityListGet_0**](AuthIdentityAPI.md#ListIdentitiesApiV1AuthIdentityListGet_0) | **Get** /api/v1/auth-identity/list | 认证列表(管理员)
[**MyIdentityApiV1AuthIdentityMyGet**](AuthIdentityAPI.md#MyIdentityApiV1AuthIdentityMyGet) | **Get** /api/v1/auth-identity/my | 我的认证
[**MyIdentityApiV1AuthIdentityMyGet_0**](AuthIdentityAPI.md#MyIdentityApiV1AuthIdentityMyGet_0) | **Get** /api/v1/auth-identity/my | 我的认证



## AuditApiV1AuthIdentityAidAuditPut

> interface{} AuditApiV1AuthIdentityAidAuditPut(ctx, aid).Status(status).Remark(remark).ExpireDays(expireDays).Execute()

审核认证

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
	aid := int32(56) // int32 | 
	status := int32(56) // int32 | 
	remark := "remark_example" // string |  (optional)
	expireDays := int32(56) // int32 |  (optional) (default to 365)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthIdentityAPI.AuditApiV1AuthIdentityAidAuditPut(context.Background(), aid).Status(status).Remark(remark).ExpireDays(expireDays).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthIdentityAPI.AuditApiV1AuthIdentityAidAuditPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AuditApiV1AuthIdentityAidAuditPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthIdentityAPI.AuditApiV1AuthIdentityAidAuditPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiAuditApiV1AuthIdentityAidAuditPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **status** | **int32** |  | 
 **remark** | **string** |  | 
 **expireDays** | **int32** |  | [default to 365]

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


## AuditApiV1AuthIdentityAidAuditPut_0

> interface{} AuditApiV1AuthIdentityAidAuditPut_0(ctx, aid).Status(status).Remark(remark).ExpireDays(expireDays).Execute()

审核认证

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
	aid := int32(56) // int32 | 
	status := int32(56) // int32 | 
	remark := "remark_example" // string |  (optional)
	expireDays := int32(56) // int32 |  (optional) (default to 365)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthIdentityAPI.AuditApiV1AuthIdentityAidAuditPut_0(context.Background(), aid).Status(status).Remark(remark).ExpireDays(expireDays).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthIdentityAPI.AuditApiV1AuthIdentityAidAuditPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AuditApiV1AuthIdentityAidAuditPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthIdentityAPI.AuditApiV1AuthIdentityAidAuditPut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiAuditApiV1AuthIdentityAidAuditPut_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **status** | **int32** |  | 
 **remark** | **string** |  | 
 **expireDays** | **int32** |  | [default to 365]

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


## AuthIdentitySubmit

> interface{} AuthIdentitySubmit(ctx).RealName(realName).IdCard(idCard).Phone(phone).IdCardFront(idCardFront).IdCardBack(idCardBack).Type_(type_).Execute()

提交实名认证

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
	realName := "realName_example" // string | 
	idCard := "idCard_example" // string | 
	phone := "phone_example" // string |  (optional)
	idCardFront := "idCardFront_example" // string |  (optional)
	idCardBack := "idCardBack_example" // string |  (optional)
	type_ := int32(56) // int32 |  (optional) (default to 1)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthIdentityAPI.AuthIdentitySubmit(context.Background()).RealName(realName).IdCard(idCard).Phone(phone).IdCardFront(idCardFront).IdCardBack(idCardBack).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthIdentityAPI.AuthIdentitySubmit``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AuthIdentitySubmit`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthIdentityAPI.AuthIdentitySubmit`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAuthIdentitySubmitRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **realName** | **string** |  | 
 **idCard** | **string** |  | 
 **phone** | **string** |  | 
 **idCardFront** | **string** |  | 
 **idCardBack** | **string** |  | 
 **type_** | **int32** |  | [default to 1]

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


## AuthIdentitySubmit_0

> interface{} AuthIdentitySubmit_0(ctx).RealName(realName).IdCard(idCard).Phone(phone).IdCardFront(idCardFront).IdCardBack(idCardBack).Type_(type_).Execute()

提交实名认证

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
	realName := "realName_example" // string | 
	idCard := "idCard_example" // string | 
	phone := "phone_example" // string |  (optional)
	idCardFront := "idCardFront_example" // string |  (optional)
	idCardBack := "idCardBack_example" // string |  (optional)
	type_ := int32(56) // int32 |  (optional) (default to 1)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthIdentityAPI.AuthIdentitySubmit_0(context.Background()).RealName(realName).IdCard(idCard).Phone(phone).IdCardFront(idCardFront).IdCardBack(idCardBack).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthIdentityAPI.AuthIdentitySubmit_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AuthIdentitySubmit_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthIdentityAPI.AuthIdentitySubmit_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAuthIdentitySubmit_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **realName** | **string** |  | 
 **idCard** | **string** |  | 
 **phone** | **string** |  | 
 **idCardFront** | **string** |  | 
 **idCardBack** | **string** |  | 
 **type_** | **int32** |  | [default to 1]

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


## ListIdentitiesApiV1AuthIdentityListGet

> interface{} ListIdentitiesApiV1AuthIdentityListGet(ctx).Page(page).Limit(limit).Status(status).Execute()

认证列表(管理员)

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
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthIdentityAPI.ListIdentitiesApiV1AuthIdentityListGet(context.Background()).Page(page).Limit(limit).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthIdentityAPI.ListIdentitiesApiV1AuthIdentityListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListIdentitiesApiV1AuthIdentityListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthIdentityAPI.ListIdentitiesApiV1AuthIdentityListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListIdentitiesApiV1AuthIdentityListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **status** | **int32** |  | 

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


## ListIdentitiesApiV1AuthIdentityListGet_0

> interface{} ListIdentitiesApiV1AuthIdentityListGet_0(ctx).Page(page).Limit(limit).Status(status).Execute()

认证列表(管理员)

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
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AuthIdentityAPI.ListIdentitiesApiV1AuthIdentityListGet_0(context.Background()).Page(page).Limit(limit).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthIdentityAPI.ListIdentitiesApiV1AuthIdentityListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListIdentitiesApiV1AuthIdentityListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthIdentityAPI.ListIdentitiesApiV1AuthIdentityListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListIdentitiesApiV1AuthIdentityListGet_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **status** | **int32** |  | 

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


## MyIdentityApiV1AuthIdentityMyGet

> interface{} MyIdentityApiV1AuthIdentityMyGet(ctx).Execute()

我的认证

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
	resp, r, err := apiClient.AuthIdentityAPI.MyIdentityApiV1AuthIdentityMyGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthIdentityAPI.MyIdentityApiV1AuthIdentityMyGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MyIdentityApiV1AuthIdentityMyGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthIdentityAPI.MyIdentityApiV1AuthIdentityMyGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiMyIdentityApiV1AuthIdentityMyGetRequest struct via the builder pattern


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


## MyIdentityApiV1AuthIdentityMyGet_0

> interface{} MyIdentityApiV1AuthIdentityMyGet_0(ctx).Execute()

我的认证

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
	resp, r, err := apiClient.AuthIdentityAPI.MyIdentityApiV1AuthIdentityMyGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AuthIdentityAPI.MyIdentityApiV1AuthIdentityMyGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MyIdentityApiV1AuthIdentityMyGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AuthIdentityAPI.MyIdentityApiV1AuthIdentityMyGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiMyIdentityApiV1AuthIdentityMyGet_4Request struct via the builder pattern


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

