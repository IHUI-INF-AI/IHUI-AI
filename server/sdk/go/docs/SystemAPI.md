# \SystemAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AdminLoginApiV1SystemLoginPost**](SystemAPI.md#AdminLoginApiV1SystemLoginPost) | **Post** /api/v1/system/login | Admin login
[**ChangeUserStatusApiV1SystemChangeStatusPut**](SystemAPI.md#ChangeUserStatusApiV1SystemChangeStatusPut) | **Put** /api/v1/system/changeStatus | 启用 / 禁用用户
[**ExportUsersApiV1SystemUserExportGet**](SystemAPI.md#ExportUsersApiV1SystemUserExportGet) | **Get** /api/v1/system/user/export | 导出用户列表到Excel
[**GetDictApiV1SystemDictDictTypeGet**](SystemAPI.md#GetDictApiV1SystemDictDictTypeGet) | **Get** /api/v1/system/dict/{dict_type} | Get dictionary data
[**GetDictDataByTypeApiV1SystemDictDataTypeDictTypeGet**](SystemAPI.md#GetDictDataByTypeApiV1SystemDictDataTypeDictTypeGet) | **Get** /api/v1/system/dict/data/type/{dict_type} | 按字典类型获取数据
[**GetLoginUserInfoAliasApiV1SystemUserGetInfoGet**](SystemAPI.md#GetLoginUserInfoAliasApiV1SystemUserGetInfoGet) | **Get** /api/v1/system/user/getInfo | 获取当前登录用户信息 (别名)
[**GetLoginUserInfoApiV1SystemGetInfoGet**](SystemAPI.md#GetLoginUserInfoApiV1SystemGetInfoGet) | **Get** /api/v1/system/getInfo | 获取当前登录用户信息(含角色与权限)
[**GetRoutersApiV1SystemMenuGetRoutersGet**](SystemAPI.md#GetRoutersApiV1SystemMenuGetRoutersGet) | **Get** /api/v1/system/menu/getRouters | 获取路由菜单树 (RuoYi 兼容)
[**GetUserProfileApiV1SystemUserProfileGet**](SystemAPI.md#GetUserProfileApiV1SystemUserProfileGet) | **Get** /api/v1/system/user/profile | 获取个人详细资料
[**ListConfigsApiV1SystemConfigListGet**](SystemAPI.md#ListConfigsApiV1SystemConfigListGet) | **Get** /api/v1/system/config/list | List system configs
[**ListDeptsApiV1SystemDeptListGet**](SystemAPI.md#ListDeptsApiV1SystemDeptListGet) | **Get** /api/v1/system/dept/list | 部门列表
[**ListDictDataApiV1SystemDictDataListGet**](SystemAPI.md#ListDictDataApiV1SystemDictDataListGet) | **Get** /api/v1/system/dict/data/list | 字典数据列表
[**ListDictTypesApiV1SystemDictTypeListGet**](SystemAPI.md#ListDictTypesApiV1SystemDictTypeListGet) | **Get** /api/v1/system/dict/type/list | 字典类型列表
[**ListMenusApiV1SystemMenuListGet**](SystemAPI.md#ListMenusApiV1SystemMenuListGet) | **Get** /api/v1/system/menu/list | List menus
[**ListPostsApiV1SystemPostListGet**](SystemAPI.md#ListPostsApiV1SystemPostListGet) | **Get** /api/v1/system/post/list | 岗位列表
[**ListRolesApiV1SystemRoleListGet**](SystemAPI.md#ListRolesApiV1SystemRoleListGet) | **Get** /api/v1/system/role/list | List roles
[**ListSysUsersApiV1SystemUserListGet**](SystemAPI.md#ListSysUsersApiV1SystemUserListGet) | **Get** /api/v1/system/user/list | List system users
[**MenuTreeselectApiV1SystemMenuTreeselectGet**](SystemAPI.md#MenuTreeselectApiV1SystemMenuTreeselectGet) | **Get** /api/v1/system/menu/treeselect | 菜单树选择
[**ResetUserPwdApiV1SystemResetPwdPut**](SystemAPI.md#ResetUserPwdApiV1SystemResetPwdPut) | **Put** /api/v1/system/resetPwd | 管理员重置用户密码
[**UpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut**](SystemAPI.md#UpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut) | **Put** /api/v1/system/user/profile/updatePwd | 修改个人密码
[**UpdateUserProfileApiV1SystemUserProfilePut**](SystemAPI.md#UpdateUserProfileApiV1SystemUserProfilePut) | **Put** /api/v1/system/user/profile | 修改个人信息
[**UploadAvatarApiV1SystemUserProfileAvatarPost**](SystemAPI.md#UploadAvatarApiV1SystemUserProfileAvatarPost) | **Post** /api/v1/system/user/profile/avatar | 上传头像



## AdminLoginApiV1SystemLoginPost

> interface{} AdminLoginApiV1SystemLoginPost(ctx).Username(username).Password(password).Execute()

Admin login

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
	username := "username_example" // string | 
	password := "password_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAPI.AdminLoginApiV1SystemLoginPost(context.Background()).Username(username).Password(password).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.AdminLoginApiV1SystemLoginPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AdminLoginApiV1SystemLoginPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.AdminLoginApiV1SystemLoginPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAdminLoginApiV1SystemLoginPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **username** | **string** |  | 
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


## ChangeUserStatusApiV1SystemChangeStatusPut

> interface{} ChangeUserStatusApiV1SystemChangeStatusPut(ctx).UserId(userId).Status(status).Execute()

启用 / 禁用用户

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
	userId := int32(56) // int32 | 目标用户 ID
	status := "status_example" // string | 0=正常 1=停用

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAPI.ChangeUserStatusApiV1SystemChangeStatusPut(context.Background()).UserId(userId).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.ChangeUserStatusApiV1SystemChangeStatusPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ChangeUserStatusApiV1SystemChangeStatusPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.ChangeUserStatusApiV1SystemChangeStatusPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiChangeUserStatusApiV1SystemChangeStatusPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **userId** | **int32** | 目标用户 ID | 
 **status** | **string** | 0&#x3D;正常 1&#x3D;停用 | 

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


## ExportUsersApiV1SystemUserExportGet

> interface{} ExportUsersApiV1SystemUserExportGet(ctx).Execute()

导出用户列表到Excel

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
	resp, r, err := apiClient.SystemAPI.ExportUsersApiV1SystemUserExportGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.ExportUsersApiV1SystemUserExportGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExportUsersApiV1SystemUserExportGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.ExportUsersApiV1SystemUserExportGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiExportUsersApiV1SystemUserExportGetRequest struct via the builder pattern


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


## GetDictApiV1SystemDictDictTypeGet

> interface{} GetDictApiV1SystemDictDictTypeGet(ctx, dictType).Execute()

Get dictionary data

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
	dictType := "dictType_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAPI.GetDictApiV1SystemDictDictTypeGet(context.Background(), dictType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.GetDictApiV1SystemDictDictTypeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetDictApiV1SystemDictDictTypeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.GetDictApiV1SystemDictDictTypeGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**dictType** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetDictApiV1SystemDictDictTypeGetRequest struct via the builder pattern


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


## GetDictDataByTypeApiV1SystemDictDataTypeDictTypeGet

> interface{} GetDictDataByTypeApiV1SystemDictDataTypeDictTypeGet(ctx, dictType).Execute()

按字典类型获取数据

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
	dictType := "dictType_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAPI.GetDictDataByTypeApiV1SystemDictDataTypeDictTypeGet(context.Background(), dictType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.GetDictDataByTypeApiV1SystemDictDataTypeDictTypeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetDictDataByTypeApiV1SystemDictDataTypeDictTypeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.GetDictDataByTypeApiV1SystemDictDataTypeDictTypeGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**dictType** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetDictDataByTypeApiV1SystemDictDataTypeDictTypeGetRequest struct via the builder pattern


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


## GetLoginUserInfoAliasApiV1SystemUserGetInfoGet

> interface{} GetLoginUserInfoAliasApiV1SystemUserGetInfoGet(ctx).Execute()

获取当前登录用户信息 (别名)



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
	resp, r, err := apiClient.SystemAPI.GetLoginUserInfoAliasApiV1SystemUserGetInfoGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.GetLoginUserInfoAliasApiV1SystemUserGetInfoGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetLoginUserInfoAliasApiV1SystemUserGetInfoGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.GetLoginUserInfoAliasApiV1SystemUserGetInfoGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetLoginUserInfoAliasApiV1SystemUserGetInfoGetRequest struct via the builder pattern


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


## GetLoginUserInfoApiV1SystemGetInfoGet

> interface{} GetLoginUserInfoApiV1SystemGetInfoGet(ctx).Execute()

获取当前登录用户信息(含角色与权限)



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
	resp, r, err := apiClient.SystemAPI.GetLoginUserInfoApiV1SystemGetInfoGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.GetLoginUserInfoApiV1SystemGetInfoGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetLoginUserInfoApiV1SystemGetInfoGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.GetLoginUserInfoApiV1SystemGetInfoGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetLoginUserInfoApiV1SystemGetInfoGetRequest struct via the builder pattern


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


## GetRoutersApiV1SystemMenuGetRoutersGet

> interface{} GetRoutersApiV1SystemMenuGetRoutersGet(ctx).Execute()

获取路由菜单树 (RuoYi 兼容)

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
	resp, r, err := apiClient.SystemAPI.GetRoutersApiV1SystemMenuGetRoutersGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.GetRoutersApiV1SystemMenuGetRoutersGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetRoutersApiV1SystemMenuGetRoutersGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.GetRoutersApiV1SystemMenuGetRoutersGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetRoutersApiV1SystemMenuGetRoutersGetRequest struct via the builder pattern


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


## GetUserProfileApiV1SystemUserProfileGet

> interface{} GetUserProfileApiV1SystemUserProfileGet(ctx).Execute()

获取个人详细资料

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
	resp, r, err := apiClient.SystemAPI.GetUserProfileApiV1SystemUserProfileGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.GetUserProfileApiV1SystemUserProfileGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetUserProfileApiV1SystemUserProfileGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.GetUserProfileApiV1SystemUserProfileGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetUserProfileApiV1SystemUserProfileGetRequest struct via the builder pattern


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


## ListConfigsApiV1SystemConfigListGet

> interface{} ListConfigsApiV1SystemConfigListGet(ctx).Execute()

List system configs

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
	resp, r, err := apiClient.SystemAPI.ListConfigsApiV1SystemConfigListGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.ListConfigsApiV1SystemConfigListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListConfigsApiV1SystemConfigListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.ListConfigsApiV1SystemConfigListGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListConfigsApiV1SystemConfigListGetRequest struct via the builder pattern


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


## ListDeptsApiV1SystemDeptListGet

> interface{} ListDeptsApiV1SystemDeptListGet(ctx).Execute()

部门列表

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
	resp, r, err := apiClient.SystemAPI.ListDeptsApiV1SystemDeptListGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.ListDeptsApiV1SystemDeptListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDeptsApiV1SystemDeptListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.ListDeptsApiV1SystemDeptListGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListDeptsApiV1SystemDeptListGetRequest struct via the builder pattern


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


## ListDictDataApiV1SystemDictDataListGet

> interface{} ListDictDataApiV1SystemDictDataListGet(ctx).DictType(dictType).Execute()

字典数据列表

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
	dictType := "dictType_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAPI.ListDictDataApiV1SystemDictDataListGet(context.Background()).DictType(dictType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.ListDictDataApiV1SystemDictDataListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDictDataApiV1SystemDictDataListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.ListDictDataApiV1SystemDictDataListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDictDataApiV1SystemDictDataListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dictType** | **string** |  | 

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


## ListDictTypesApiV1SystemDictTypeListGet

> interface{} ListDictTypesApiV1SystemDictTypeListGet(ctx).Execute()

字典类型列表

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
	resp, r, err := apiClient.SystemAPI.ListDictTypesApiV1SystemDictTypeListGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.ListDictTypesApiV1SystemDictTypeListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDictTypesApiV1SystemDictTypeListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.ListDictTypesApiV1SystemDictTypeListGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListDictTypesApiV1SystemDictTypeListGetRequest struct via the builder pattern


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


## ListMenusApiV1SystemMenuListGet

> interface{} ListMenusApiV1SystemMenuListGet(ctx).Execute()

List menus

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
	resp, r, err := apiClient.SystemAPI.ListMenusApiV1SystemMenuListGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.ListMenusApiV1SystemMenuListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListMenusApiV1SystemMenuListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.ListMenusApiV1SystemMenuListGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListMenusApiV1SystemMenuListGetRequest struct via the builder pattern


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


## ListPostsApiV1SystemPostListGet

> interface{} ListPostsApiV1SystemPostListGet(ctx).Execute()

岗位列表

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
	resp, r, err := apiClient.SystemAPI.ListPostsApiV1SystemPostListGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.ListPostsApiV1SystemPostListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListPostsApiV1SystemPostListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.ListPostsApiV1SystemPostListGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListPostsApiV1SystemPostListGetRequest struct via the builder pattern


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


## ListRolesApiV1SystemRoleListGet

> interface{} ListRolesApiV1SystemRoleListGet(ctx).Execute()

List roles

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
	resp, r, err := apiClient.SystemAPI.ListRolesApiV1SystemRoleListGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.ListRolesApiV1SystemRoleListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListRolesApiV1SystemRoleListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.ListRolesApiV1SystemRoleListGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListRolesApiV1SystemRoleListGetRequest struct via the builder pattern


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


## ListSysUsersApiV1SystemUserListGet

> interface{} ListSysUsersApiV1SystemUserListGet(ctx).Page(page).Limit(limit).Execute()

List system users

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
	resp, r, err := apiClient.SystemAPI.ListSysUsersApiV1SystemUserListGet(context.Background()).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.ListSysUsersApiV1SystemUserListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListSysUsersApiV1SystemUserListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.ListSysUsersApiV1SystemUserListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListSysUsersApiV1SystemUserListGetRequest struct via the builder pattern


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


## MenuTreeselectApiV1SystemMenuTreeselectGet

> interface{} MenuTreeselectApiV1SystemMenuTreeselectGet(ctx).Execute()

菜单树选择

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
	resp, r, err := apiClient.SystemAPI.MenuTreeselectApiV1SystemMenuTreeselectGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.MenuTreeselectApiV1SystemMenuTreeselectGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MenuTreeselectApiV1SystemMenuTreeselectGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.MenuTreeselectApiV1SystemMenuTreeselectGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiMenuTreeselectApiV1SystemMenuTreeselectGetRequest struct via the builder pattern


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


## ResetUserPwdApiV1SystemResetPwdPut

> interface{} ResetUserPwdApiV1SystemResetPwdPut(ctx).UserId(userId).NewPassword(newPassword).Execute()

管理员重置用户密码



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
	userId := int32(56) // int32 | 目标用户 ID
	newPassword := "newPassword_example" // string | 新密码

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAPI.ResetUserPwdApiV1SystemResetPwdPut(context.Background()).UserId(userId).NewPassword(newPassword).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.ResetUserPwdApiV1SystemResetPwdPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ResetUserPwdApiV1SystemResetPwdPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.ResetUserPwdApiV1SystemResetPwdPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiResetUserPwdApiV1SystemResetPwdPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **userId** | **int32** | 目标用户 ID | 
 **newPassword** | **string** | 新密码 | 

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


## UpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut

> interface{} UpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut(ctx).BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut(bodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut).Execute()

修改个人密码

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
	bodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut := *openapiclient.NewBodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut("OldPassword_example", "NewPassword_example") // BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAPI.UpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut(context.Background()).BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut(bodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.UpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.UpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut** | [**BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut**](BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut.md) |  | 

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


## UpdateUserProfileApiV1SystemUserProfilePut

> interface{} UpdateUserProfileApiV1SystemUserProfilePut(ctx).BodyUpdateUserProfileApiV1SystemUserProfilePut(bodyUpdateUserProfileApiV1SystemUserProfilePut).Execute()

修改个人信息

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
	bodyUpdateUserProfileApiV1SystemUserProfilePut := *openapiclient.NewBodyUpdateUserProfileApiV1SystemUserProfilePut() // BodyUpdateUserProfileApiV1SystemUserProfilePut |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAPI.UpdateUserProfileApiV1SystemUserProfilePut(context.Background()).BodyUpdateUserProfileApiV1SystemUserProfilePut(bodyUpdateUserProfileApiV1SystemUserProfilePut).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.UpdateUserProfileApiV1SystemUserProfilePut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateUserProfileApiV1SystemUserProfilePut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.UpdateUserProfileApiV1SystemUserProfilePut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateUserProfileApiV1SystemUserProfilePutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyUpdateUserProfileApiV1SystemUserProfilePut** | [**BodyUpdateUserProfileApiV1SystemUserProfilePut**](BodyUpdateUserProfileApiV1SystemUserProfilePut.md) |  | 

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


## UploadAvatarApiV1SystemUserProfileAvatarPost

> interface{} UploadAvatarApiV1SystemUserProfileAvatarPost(ctx).File(file).Execute()

上传头像

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
	resp, r, err := apiClient.SystemAPI.UploadAvatarApiV1SystemUserProfileAvatarPost(context.Background()).File(file).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAPI.UploadAvatarApiV1SystemUserProfileAvatarPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UploadAvatarApiV1SystemUserProfileAvatarPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAPI.UploadAvatarApiV1SystemUserProfileAvatarPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUploadAvatarApiV1SystemUserProfileAvatarPostRequest struct via the builder pattern


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

