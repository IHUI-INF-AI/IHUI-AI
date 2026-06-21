# \OrganizationAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddMemberApiV1OrganizationOidMemberPost**](OrganizationAPI.md#AddMemberApiV1OrganizationOidMemberPost) | **Post** /api/v1/organization/{oid}/member | 添加成员
[**AddMemberApiV1OrganizationOidMemberPost_0**](OrganizationAPI.md#AddMemberApiV1OrganizationOidMemberPost_0) | **Post** /api/v1/organization/{oid}/member | 添加成员
[**CreateOrganizationApiV1OrganizationPost**](OrganizationAPI.md#CreateOrganizationApiV1OrganizationPost) | **Post** /api/v1/organization | 创建组织
[**CreateOrganizationApiV1OrganizationPost_0**](OrganizationAPI.md#CreateOrganizationApiV1OrganizationPost_0) | **Post** /api/v1/organization | 创建组织
[**DeleteOrganizationApiV1OrganizationOidDelete**](OrganizationAPI.md#DeleteOrganizationApiV1OrganizationOidDelete) | **Delete** /api/v1/organization/{oid} | 删除组织
[**DeleteOrganizationApiV1OrganizationOidDelete_0**](OrganizationAPI.md#DeleteOrganizationApiV1OrganizationOidDelete_0) | **Delete** /api/v1/organization/{oid} | 删除组织
[**GetOrganizationApiV1OrganizationOidGet**](OrganizationAPI.md#GetOrganizationApiV1OrganizationOidGet) | **Get** /api/v1/organization/{oid} | 组织详情
[**GetOrganizationApiV1OrganizationOidGet_0**](OrganizationAPI.md#GetOrganizationApiV1OrganizationOidGet_0) | **Get** /api/v1/organization/{oid} | 组织详情
[**ListMembersApiV1OrganizationOidMembersGet**](OrganizationAPI.md#ListMembersApiV1OrganizationOidMembersGet) | **Get** /api/v1/organization/{oid}/members | 组织成员
[**ListMembersApiV1OrganizationOidMembersGet_0**](OrganizationAPI.md#ListMembersApiV1OrganizationOidMembersGet_0) | **Get** /api/v1/organization/{oid}/members | 组织成员
[**ListOrganizationsApiV1OrganizationListGet**](OrganizationAPI.md#ListOrganizationsApiV1OrganizationListGet) | **Get** /api/v1/organization/list | 组织列表
[**ListOrganizationsApiV1OrganizationListGet_0**](OrganizationAPI.md#ListOrganizationsApiV1OrganizationListGet_0) | **Get** /api/v1/organization/list | 组织列表
[**OrgTreeApiV1OrganizationTreeGet**](OrganizationAPI.md#OrgTreeApiV1OrganizationTreeGet) | **Get** /api/v1/organization/tree | 组织树
[**OrgTreeApiV1OrganizationTreeGet_0**](OrganizationAPI.md#OrgTreeApiV1OrganizationTreeGet_0) | **Get** /api/v1/organization/tree | 组织树
[**RemoveMemberApiV1OrganizationOidMemberUserIdDelete**](OrganizationAPI.md#RemoveMemberApiV1OrganizationOidMemberUserIdDelete) | **Delete** /api/v1/organization/{oid}/member/{user_id} | 移除成员
[**RemoveMemberApiV1OrganizationOidMemberUserIdDelete_0**](OrganizationAPI.md#RemoveMemberApiV1OrganizationOidMemberUserIdDelete_0) | **Delete** /api/v1/organization/{oid}/member/{user_id} | 移除成员
[**UpdateOrganizationApiV1OrganizationOidPut**](OrganizationAPI.md#UpdateOrganizationApiV1OrganizationOidPut) | **Put** /api/v1/organization/{oid} | 修改组织
[**UpdateOrganizationApiV1OrganizationOidPut_0**](OrganizationAPI.md#UpdateOrganizationApiV1OrganizationOidPut_0) | **Put** /api/v1/organization/{oid} | 修改组织



## AddMemberApiV1OrganizationOidMemberPost

> interface{} AddMemberApiV1OrganizationOidMemberPost(ctx, oid).UserId(userId).Role(role).Position(position).Execute()

添加成员

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
	oid := int32(56) // int32 | 
	userId := "userId_example" // string | 
	role := "role_example" // string |  (optional) (default to "member")
	position := "position_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OrganizationAPI.AddMemberApiV1OrganizationOidMemberPost(context.Background(), oid).UserId(userId).Role(role).Position(position).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OrganizationAPI.AddMemberApiV1OrganizationOidMemberPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddMemberApiV1OrganizationOidMemberPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OrganizationAPI.AddMemberApiV1OrganizationOidMemberPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**oid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiAddMemberApiV1OrganizationOidMemberPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **userId** | **string** |  | 
 **role** | **string** |  | [default to &quot;member&quot;]
 **position** | **string** |  | 

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


## AddMemberApiV1OrganizationOidMemberPost_0

> interface{} AddMemberApiV1OrganizationOidMemberPost_0(ctx, oid).UserId(userId).Role(role).Position(position).Execute()

添加成员

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
	oid := int32(56) // int32 | 
	userId := "userId_example" // string | 
	role := "role_example" // string |  (optional) (default to "member")
	position := "position_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OrganizationAPI.AddMemberApiV1OrganizationOidMemberPost_0(context.Background(), oid).UserId(userId).Role(role).Position(position).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OrganizationAPI.AddMemberApiV1OrganizationOidMemberPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddMemberApiV1OrganizationOidMemberPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OrganizationAPI.AddMemberApiV1OrganizationOidMemberPost_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**oid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiAddMemberApiV1OrganizationOidMemberPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **userId** | **string** |  | 
 **role** | **string** |  | [default to &quot;member&quot;]
 **position** | **string** |  | 

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


## CreateOrganizationApiV1OrganizationPost

> interface{} CreateOrganizationApiV1OrganizationPost(ctx).Name(name).Pid(pid).Type_(type_).ShortName(shortName).Code(code).Description(description).Leader(leader).LeaderPhone(leaderPhone).Logo(logo).Address(address).SortOrder(sortOrder).Execute()

创建组织

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
	name := "name_example" // string | 
	pid := int32(56) // int32 |  (optional) (default to 0)
	type_ := "type__example" // string |  (optional) (default to "company")
	shortName := "shortName_example" // string |  (optional)
	code := "code_example" // string |  (optional)
	description := "description_example" // string |  (optional)
	leader := "leader_example" // string |  (optional)
	leaderPhone := "leaderPhone_example" // string |  (optional)
	logo := "logo_example" // string |  (optional)
	address := "address_example" // string |  (optional)
	sortOrder := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OrganizationAPI.CreateOrganizationApiV1OrganizationPost(context.Background()).Name(name).Pid(pid).Type_(type_).ShortName(shortName).Code(code).Description(description).Leader(leader).LeaderPhone(leaderPhone).Logo(logo).Address(address).SortOrder(sortOrder).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OrganizationAPI.CreateOrganizationApiV1OrganizationPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateOrganizationApiV1OrganizationPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OrganizationAPI.CreateOrganizationApiV1OrganizationPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateOrganizationApiV1OrganizationPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **pid** | **int32** |  | [default to 0]
 **type_** | **string** |  | [default to &quot;company&quot;]
 **shortName** | **string** |  | 
 **code** | **string** |  | 
 **description** | **string** |  | 
 **leader** | **string** |  | 
 **leaderPhone** | **string** |  | 
 **logo** | **string** |  | 
 **address** | **string** |  | 
 **sortOrder** | **int32** |  | [default to 0]

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


## CreateOrganizationApiV1OrganizationPost_0

> interface{} CreateOrganizationApiV1OrganizationPost_0(ctx).Name(name).Pid(pid).Type_(type_).ShortName(shortName).Code(code).Description(description).Leader(leader).LeaderPhone(leaderPhone).Logo(logo).Address(address).SortOrder(sortOrder).Execute()

创建组织

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
	name := "name_example" // string | 
	pid := int32(56) // int32 |  (optional) (default to 0)
	type_ := "type__example" // string |  (optional) (default to "company")
	shortName := "shortName_example" // string |  (optional)
	code := "code_example" // string |  (optional)
	description := "description_example" // string |  (optional)
	leader := "leader_example" // string |  (optional)
	leaderPhone := "leaderPhone_example" // string |  (optional)
	logo := "logo_example" // string |  (optional)
	address := "address_example" // string |  (optional)
	sortOrder := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OrganizationAPI.CreateOrganizationApiV1OrganizationPost_0(context.Background()).Name(name).Pid(pid).Type_(type_).ShortName(shortName).Code(code).Description(description).Leader(leader).LeaderPhone(leaderPhone).Logo(logo).Address(address).SortOrder(sortOrder).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OrganizationAPI.CreateOrganizationApiV1OrganizationPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateOrganizationApiV1OrganizationPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OrganizationAPI.CreateOrganizationApiV1OrganizationPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateOrganizationApiV1OrganizationPost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **pid** | **int32** |  | [default to 0]
 **type_** | **string** |  | [default to &quot;company&quot;]
 **shortName** | **string** |  | 
 **code** | **string** |  | 
 **description** | **string** |  | 
 **leader** | **string** |  | 
 **leaderPhone** | **string** |  | 
 **logo** | **string** |  | 
 **address** | **string** |  | 
 **sortOrder** | **int32** |  | [default to 0]

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


## DeleteOrganizationApiV1OrganizationOidDelete

> interface{} DeleteOrganizationApiV1OrganizationOidDelete(ctx, oid).Execute()

删除组织

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
	oid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OrganizationAPI.DeleteOrganizationApiV1OrganizationOidDelete(context.Background(), oid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OrganizationAPI.DeleteOrganizationApiV1OrganizationOidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteOrganizationApiV1OrganizationOidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OrganizationAPI.DeleteOrganizationApiV1OrganizationOidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**oid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteOrganizationApiV1OrganizationOidDeleteRequest struct via the builder pattern


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


## DeleteOrganizationApiV1OrganizationOidDelete_0

> interface{} DeleteOrganizationApiV1OrganizationOidDelete_0(ctx, oid).Execute()

删除组织

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
	oid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OrganizationAPI.DeleteOrganizationApiV1OrganizationOidDelete_0(context.Background(), oid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OrganizationAPI.DeleteOrganizationApiV1OrganizationOidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteOrganizationApiV1OrganizationOidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OrganizationAPI.DeleteOrganizationApiV1OrganizationOidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**oid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteOrganizationApiV1OrganizationOidDelete_3Request struct via the builder pattern


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


## GetOrganizationApiV1OrganizationOidGet

> interface{} GetOrganizationApiV1OrganizationOidGet(ctx, oid).Execute()

组织详情

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
	oid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OrganizationAPI.GetOrganizationApiV1OrganizationOidGet(context.Background(), oid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OrganizationAPI.GetOrganizationApiV1OrganizationOidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetOrganizationApiV1OrganizationOidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OrganizationAPI.GetOrganizationApiV1OrganizationOidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**oid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetOrganizationApiV1OrganizationOidGetRequest struct via the builder pattern


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


## GetOrganizationApiV1OrganizationOidGet_0

> interface{} GetOrganizationApiV1OrganizationOidGet_0(ctx, oid).Execute()

组织详情

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
	oid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OrganizationAPI.GetOrganizationApiV1OrganizationOidGet_0(context.Background(), oid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OrganizationAPI.GetOrganizationApiV1OrganizationOidGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetOrganizationApiV1OrganizationOidGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OrganizationAPI.GetOrganizationApiV1OrganizationOidGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**oid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetOrganizationApiV1OrganizationOidGet_4Request struct via the builder pattern


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


## ListMembersApiV1OrganizationOidMembersGet

> interface{} ListMembersApiV1OrganizationOidMembersGet(ctx, oid).Page(page).Limit(limit).Execute()

组织成员

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
	oid := int32(56) // int32 | 
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OrganizationAPI.ListMembersApiV1OrganizationOidMembersGet(context.Background(), oid).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OrganizationAPI.ListMembersApiV1OrganizationOidMembersGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListMembersApiV1OrganizationOidMembersGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OrganizationAPI.ListMembersApiV1OrganizationOidMembersGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**oid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiListMembersApiV1OrganizationOidMembersGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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


## ListMembersApiV1OrganizationOidMembersGet_0

> interface{} ListMembersApiV1OrganizationOidMembersGet_0(ctx, oid).Page(page).Limit(limit).Execute()

组织成员

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
	oid := int32(56) // int32 | 
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OrganizationAPI.ListMembersApiV1OrganizationOidMembersGet_0(context.Background(), oid).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OrganizationAPI.ListMembersApiV1OrganizationOidMembersGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListMembersApiV1OrganizationOidMembersGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OrganizationAPI.ListMembersApiV1OrganizationOidMembersGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**oid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiListMembersApiV1OrganizationOidMembersGet_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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


## ListOrganizationsApiV1OrganizationListGet

> interface{} ListOrganizationsApiV1OrganizationListGet(ctx).Pid(pid).Status(status).Keyword(keyword).Execute()

组织列表

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
	pid := int32(56) // int32 |  (optional)
	status := int32(56) // int32 |  (optional)
	keyword := "keyword_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OrganizationAPI.ListOrganizationsApiV1OrganizationListGet(context.Background()).Pid(pid).Status(status).Keyword(keyword).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OrganizationAPI.ListOrganizationsApiV1OrganizationListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListOrganizationsApiV1OrganizationListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OrganizationAPI.ListOrganizationsApiV1OrganizationListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListOrganizationsApiV1OrganizationListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pid** | **int32** |  | 
 **status** | **int32** |  | 
 **keyword** | **string** |  | 

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


## ListOrganizationsApiV1OrganizationListGet_0

> interface{} ListOrganizationsApiV1OrganizationListGet_0(ctx).Pid(pid).Status(status).Keyword(keyword).Execute()

组织列表

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
	pid := int32(56) // int32 |  (optional)
	status := int32(56) // int32 |  (optional)
	keyword := "keyword_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OrganizationAPI.ListOrganizationsApiV1OrganizationListGet_0(context.Background()).Pid(pid).Status(status).Keyword(keyword).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OrganizationAPI.ListOrganizationsApiV1OrganizationListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListOrganizationsApiV1OrganizationListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OrganizationAPI.ListOrganizationsApiV1OrganizationListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListOrganizationsApiV1OrganizationListGet_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pid** | **int32** |  | 
 **status** | **int32** |  | 
 **keyword** | **string** |  | 

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


## OrgTreeApiV1OrganizationTreeGet

> interface{} OrgTreeApiV1OrganizationTreeGet(ctx).Execute()

组织树

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
	resp, r, err := apiClient.OrganizationAPI.OrgTreeApiV1OrganizationTreeGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OrganizationAPI.OrgTreeApiV1OrganizationTreeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `OrgTreeApiV1OrganizationTreeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OrganizationAPI.OrgTreeApiV1OrganizationTreeGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiOrgTreeApiV1OrganizationTreeGetRequest struct via the builder pattern


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


## OrgTreeApiV1OrganizationTreeGet_0

> interface{} OrgTreeApiV1OrganizationTreeGet_0(ctx).Execute()

组织树

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
	resp, r, err := apiClient.OrganizationAPI.OrgTreeApiV1OrganizationTreeGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OrganizationAPI.OrgTreeApiV1OrganizationTreeGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `OrgTreeApiV1OrganizationTreeGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OrganizationAPI.OrgTreeApiV1OrganizationTreeGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiOrgTreeApiV1OrganizationTreeGet_7Request struct via the builder pattern


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


## RemoveMemberApiV1OrganizationOidMemberUserIdDelete

> interface{} RemoveMemberApiV1OrganizationOidMemberUserIdDelete(ctx, oid, userId).Execute()

移除成员

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
	oid := int32(56) // int32 | 
	userId := "userId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OrganizationAPI.RemoveMemberApiV1OrganizationOidMemberUserIdDelete(context.Background(), oid, userId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OrganizationAPI.RemoveMemberApiV1OrganizationOidMemberUserIdDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RemoveMemberApiV1OrganizationOidMemberUserIdDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OrganizationAPI.RemoveMemberApiV1OrganizationOidMemberUserIdDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**oid** | **int32** |  | 
**userId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiRemoveMemberApiV1OrganizationOidMemberUserIdDeleteRequest struct via the builder pattern


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


## RemoveMemberApiV1OrganizationOidMemberUserIdDelete_0

> interface{} RemoveMemberApiV1OrganizationOidMemberUserIdDelete_0(ctx, oid, userId).Execute()

移除成员

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
	oid := int32(56) // int32 | 
	userId := "userId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OrganizationAPI.RemoveMemberApiV1OrganizationOidMemberUserIdDelete_0(context.Background(), oid, userId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OrganizationAPI.RemoveMemberApiV1OrganizationOidMemberUserIdDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RemoveMemberApiV1OrganizationOidMemberUserIdDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OrganizationAPI.RemoveMemberApiV1OrganizationOidMemberUserIdDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**oid** | **int32** |  | 
**userId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiRemoveMemberApiV1OrganizationOidMemberUserIdDelete_8Request struct via the builder pattern


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


## UpdateOrganizationApiV1OrganizationOidPut

> interface{} UpdateOrganizationApiV1OrganizationOidPut(ctx, oid).Name(name).ShortName(shortName).Description(description).Leader(leader).LeaderPhone(leaderPhone).Status(status).SortOrder(sortOrder).Execute()

修改组织

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
	oid := int32(56) // int32 | 
	name := "name_example" // string |  (optional)
	shortName := "shortName_example" // string |  (optional)
	description := "description_example" // string |  (optional)
	leader := "leader_example" // string |  (optional)
	leaderPhone := "leaderPhone_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)
	sortOrder := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OrganizationAPI.UpdateOrganizationApiV1OrganizationOidPut(context.Background(), oid).Name(name).ShortName(shortName).Description(description).Leader(leader).LeaderPhone(leaderPhone).Status(status).SortOrder(sortOrder).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OrganizationAPI.UpdateOrganizationApiV1OrganizationOidPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateOrganizationApiV1OrganizationOidPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OrganizationAPI.UpdateOrganizationApiV1OrganizationOidPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**oid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateOrganizationApiV1OrganizationOidPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **name** | **string** |  | 
 **shortName** | **string** |  | 
 **description** | **string** |  | 
 **leader** | **string** |  | 
 **leaderPhone** | **string** |  | 
 **status** | **int32** |  | 
 **sortOrder** | **int32** |  | 

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


## UpdateOrganizationApiV1OrganizationOidPut_0

> interface{} UpdateOrganizationApiV1OrganizationOidPut_0(ctx, oid).Name(name).ShortName(shortName).Description(description).Leader(leader).LeaderPhone(leaderPhone).Status(status).SortOrder(sortOrder).Execute()

修改组织

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
	oid := int32(56) // int32 | 
	name := "name_example" // string |  (optional)
	shortName := "shortName_example" // string |  (optional)
	description := "description_example" // string |  (optional)
	leader := "leader_example" // string |  (optional)
	leaderPhone := "leaderPhone_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)
	sortOrder := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OrganizationAPI.UpdateOrganizationApiV1OrganizationOidPut_0(context.Background(), oid).Name(name).ShortName(shortName).Description(description).Leader(leader).LeaderPhone(leaderPhone).Status(status).SortOrder(sortOrder).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OrganizationAPI.UpdateOrganizationApiV1OrganizationOidPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateOrganizationApiV1OrganizationOidPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OrganizationAPI.UpdateOrganizationApiV1OrganizationOidPut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**oid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateOrganizationApiV1OrganizationOidPut_9Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **name** | **string** |  | 
 **shortName** | **string** |  | 
 **description** | **string** |  | 
 **leader** | **string** |  | 
 **leaderPhone** | **string** |  | 
 **status** | **int32** |  | 
 **sortOrder** | **int32** |  | 

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

