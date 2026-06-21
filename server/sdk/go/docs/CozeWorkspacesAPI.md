# \CozeWorkspacesAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost**](CozeWorkspacesAPI.md#CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost) | **Post** /api/v1/coze/workspaces/workspaces/members/create | Create Members
[**CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0**](CozeWorkspacesAPI.md#CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0) | **Post** /api/v1/coze/workspaces/workspaces/members/create | Create Members
[**DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost**](CozeWorkspacesAPI.md#DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost) | **Post** /api/v1/coze/workspaces/workspaces/members/delete | Delete Members
[**DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0**](CozeWorkspacesAPI.md#DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0) | **Post** /api/v1/coze/workspaces/workspaces/members/delete | Delete Members
[**ListWorkspacesApiV1CozeWorkspacesWorkspacesListGet**](CozeWorkspacesAPI.md#ListWorkspacesApiV1CozeWorkspacesWorkspacesListGet) | **Get** /api/v1/coze/workspaces/workspaces/list | List Workspaces
[**ListWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0**](CozeWorkspacesAPI.md#ListWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0) | **Get** /api/v1/coze/workspaces/workspaces/list | List Workspaces



## CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost

> interface{} CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost(ctx).MembersReq(membersReq).Execute()

Create Members

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
	membersReq := *openapiclient.NewMembersReq("WorkspaceId_example", []map[string]interface{}{map[string]interface{}{"key": interface{}(123)}}) // MembersReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeWorkspacesAPI.CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost(context.Background()).MembersReq(membersReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeWorkspacesAPI.CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeWorkspacesAPI.CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **membersReq** | [**MembersReq**](MembersReq.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0

> interface{} CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0(ctx).MembersReq(membersReq).Execute()

Create Members

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
	membersReq := *openapiclient.NewMembersReq("WorkspaceId_example", []map[string]interface{}{map[string]interface{}{"key": interface{}(123)}}) // MembersReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeWorkspacesAPI.CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0(context.Background()).MembersReq(membersReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeWorkspacesAPI.CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeWorkspacesAPI.CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **membersReq** | [**MembersReq**](MembersReq.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost

> interface{} DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost(ctx).DeleteMembersReq(deleteMembersReq).Execute()

Delete Members

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
	deleteMembersReq := *openapiclient.NewDeleteMembersReq("WorkspaceId_example", []string{"MemberIds_example"}) // DeleteMembersReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeWorkspacesAPI.DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost(context.Background()).DeleteMembersReq(deleteMembersReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeWorkspacesAPI.DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeWorkspacesAPI.DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **deleteMembersReq** | [**DeleteMembersReq**](DeleteMembersReq.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0

> interface{} DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0(ctx).DeleteMembersReq(deleteMembersReq).Execute()

Delete Members

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
	deleteMembersReq := *openapiclient.NewDeleteMembersReq("WorkspaceId_example", []string{"MemberIds_example"}) // DeleteMembersReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeWorkspacesAPI.DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0(context.Background()).DeleteMembersReq(deleteMembersReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeWorkspacesAPI.DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeWorkspacesAPI.DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **deleteMembersReq** | [**DeleteMembersReq**](DeleteMembersReq.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListWorkspacesApiV1CozeWorkspacesWorkspacesListGet

> interface{} ListWorkspacesApiV1CozeWorkspacesWorkspacesListGet(ctx).Page(page).Size(size).Execute()

List Workspaces

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
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeWorkspacesAPI.ListWorkspacesApiV1CozeWorkspacesWorkspacesListGet(context.Background()).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeWorkspacesAPI.ListWorkspacesApiV1CozeWorkspacesWorkspacesListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListWorkspacesApiV1CozeWorkspacesWorkspacesListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeWorkspacesAPI.ListWorkspacesApiV1CozeWorkspacesWorkspacesListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListWorkspacesApiV1CozeWorkspacesWorkspacesListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **size** | **int32** |  | [default to 20]

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


## ListWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0

> interface{} ListWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0(ctx).Page(page).Size(size).Execute()

List Workspaces

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
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeWorkspacesAPI.ListWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0(context.Background()).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeWorkspacesAPI.ListWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeWorkspacesAPI.ListWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListWorkspacesApiV1CozeWorkspacesWorkspacesListGet_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **size** | **int32** |  | [default to 20]

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

