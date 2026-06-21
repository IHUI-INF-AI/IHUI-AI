# \SystemAdminAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateConfigApiV1SystemAdminConfigCreatePost**](SystemAdminAPI.md#CreateConfigApiV1SystemAdminConfigCreatePost) | **Post** /api/v1/system/admin/config/create | 新增配置
[**CreateDeptApiV1SystemAdminDeptCreatePost**](SystemAdminAPI.md#CreateDeptApiV1SystemAdminDeptCreatePost) | **Post** /api/v1/system/admin/dept/create | 创建部门
[**CreateDictDataApiV1SystemAdminDictDataCreatePost**](SystemAdminAPI.md#CreateDictDataApiV1SystemAdminDictDataCreatePost) | **Post** /api/v1/system/admin/dict/data/create | 新增字典数据
[**CreateDictTypeApiV1SystemAdminDictTypeCreatePost**](SystemAdminAPI.md#CreateDictTypeApiV1SystemAdminDictTypeCreatePost) | **Post** /api/v1/system/admin/dict/type/create | 新增字典类型
[**CreateMenuApiV1SystemAdminMenuCreatePost**](SystemAdminAPI.md#CreateMenuApiV1SystemAdminMenuCreatePost) | **Post** /api/v1/system/admin/menu/create | 创建菜单
[**CreatePostApiV1SystemAdminPostCreatePost**](SystemAdminAPI.md#CreatePostApiV1SystemAdminPostCreatePost) | **Post** /api/v1/system/admin/post/create | 创建岗位
[**CreateRoleApiV1SystemAdminRoleCreatePost**](SystemAdminAPI.md#CreateRoleApiV1SystemAdminRoleCreatePost) | **Post** /api/v1/system/admin/role/create | 创建角色
[**DeleteDeptApiV1SystemAdminDeptDeletePost**](SystemAdminAPI.md#DeleteDeptApiV1SystemAdminDeptDeletePost) | **Post** /api/v1/system/admin/dept/delete | 删除部门
[**DeleteMenuApiV1SystemAdminMenuDeletePost**](SystemAdminAPI.md#DeleteMenuApiV1SystemAdminMenuDeletePost) | **Post** /api/v1/system/admin/menu/delete | 删除菜单
[**DeleteRoleApiV1SystemAdminRoleDeletePost**](SystemAdminAPI.md#DeleteRoleApiV1SystemAdminRoleDeletePost) | **Post** /api/v1/system/admin/role/delete | 删除角色
[**ExportConfigsApiV1SystemAdminConfigExportGet**](SystemAdminAPI.md#ExportConfigsApiV1SystemAdminConfigExportGet) | **Get** /api/v1/system/admin/config/export | 导出参数配置到Excel
[**ExportDeptsApiV1SystemAdminDeptExportGet**](SystemAdminAPI.md#ExportDeptsApiV1SystemAdminDeptExportGet) | **Get** /api/v1/system/admin/dept/export | 导出部门列表到Excel
[**ExportDictTypesApiV1SystemAdminDictTypeExportGet**](SystemAdminAPI.md#ExportDictTypesApiV1SystemAdminDictTypeExportGet) | **Get** /api/v1/system/admin/dict/type/export | 导出字典类型到Excel
[**ExportMenusApiV1SystemAdminMenuExportGet**](SystemAdminAPI.md#ExportMenusApiV1SystemAdminMenuExportGet) | **Get** /api/v1/system/admin/menu/export | 导出菜单列表到Excel
[**ExportPostsApiV1SystemAdminPostExportGet**](SystemAdminAPI.md#ExportPostsApiV1SystemAdminPostExportGet) | **Get** /api/v1/system/admin/post/export | 导出岗位列表到Excel
[**ExportRolesApiV1SystemAdminRoleExportGet**](SystemAdminAPI.md#ExportRolesApiV1SystemAdminRoleExportGet) | **Get** /api/v1/system/admin/role/export | 导出角色列表到Excel
[**GetConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet**](SystemAdminAPI.md#GetConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet) | **Get** /api/v1/system/admin/config/key/{config_key} | 按 key 查配置
[**GetDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet**](SystemAdminAPI.md#GetDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet) | **Get** /api/v1/system/admin/dict/data/type/{dict_type} | 按字典类型获取数据 (RuoYi 兼容)
[**GetRoutersApiV1SystemAdminMenuGetRoutersGet**](SystemAdminAPI.md#GetRoutersApiV1SystemAdminMenuGetRoutersGet) | **Get** /api/v1/system/admin/menu/getRouters | 获取路由菜单树 (RuoYi 兼容)
[**ListConfigsApiV1SystemAdminConfigListGet**](SystemAdminAPI.md#ListConfigsApiV1SystemAdminConfigListGet) | **Get** /api/v1/system/admin/config/list | 参数配置列表
[**ListDeptsApiV1SystemAdminDeptListGet**](SystemAdminAPI.md#ListDeptsApiV1SystemAdminDeptListGet) | **Get** /api/v1/system/admin/dept/list | 部门列表
[**ListDictDataApiV1SystemAdminDictDataListGet**](SystemAdminAPI.md#ListDictDataApiV1SystemAdminDictDataListGet) | **Get** /api/v1/system/admin/dict/data/list | 字典数据列表
[**ListDictTypesApiV1SystemAdminDictTypeListGet**](SystemAdminAPI.md#ListDictTypesApiV1SystemAdminDictTypeListGet) | **Get** /api/v1/system/admin/dict/type/list | 字典类型列表
[**ListMenusApiV1SystemAdminMenuListGet**](SystemAdminAPI.md#ListMenusApiV1SystemAdminMenuListGet) | **Get** /api/v1/system/admin/menu/list | 菜单列表
[**ListPostsApiV1SystemAdminPostListGet**](SystemAdminAPI.md#ListPostsApiV1SystemAdminPostListGet) | **Get** /api/v1/system/admin/post/list | 岗位列表
[**ListRolesApiV1SystemAdminRoleListGet**](SystemAdminAPI.md#ListRolesApiV1SystemAdminRoleListGet) | **Get** /api/v1/system/admin/role/list | 角色列表
[**MenuTreeselectApiV1SystemAdminMenuTreeselectGet**](SystemAdminAPI.md#MenuTreeselectApiV1SystemAdminMenuTreeselectGet) | **Get** /api/v1/system/admin/menu/treeselect | 菜单树选择 (RuoYi 兼容)
[**RoleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet**](SystemAdminAPI.md#RoleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet) | **Get** /api/v1/system/admin/menu/roleMenuTreeselect/{role_id} | 角色菜单树
[**UpdateConfigApiV1SystemAdminConfigUpdatePost**](SystemAdminAPI.md#UpdateConfigApiV1SystemAdminConfigUpdatePost) | **Post** /api/v1/system/admin/config/update | 更新配置值
[**UpdateRoleApiV1SystemAdminRoleUpdatePost**](SystemAdminAPI.md#UpdateRoleApiV1SystemAdminRoleUpdatePost) | **Post** /api/v1/system/admin/role/update | 更新角色



## CreateConfigApiV1SystemAdminConfigCreatePost

> interface{} CreateConfigApiV1SystemAdminConfigCreatePost(ctx).ConfigName(configName).ConfigKey(configKey).ConfigValue(configValue).ConfigType(configType).Execute()

新增配置

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
	configName := "configName_example" // string | 
	configKey := "configKey_example" // string | 
	configValue := "configValue_example" // string |  (optional) (default to "")
	configType := "configType_example" // string |  (optional) (default to "N")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.CreateConfigApiV1SystemAdminConfigCreatePost(context.Background()).ConfigName(configName).ConfigKey(configKey).ConfigValue(configValue).ConfigType(configType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.CreateConfigApiV1SystemAdminConfigCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateConfigApiV1SystemAdminConfigCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.CreateConfigApiV1SystemAdminConfigCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateConfigApiV1SystemAdminConfigCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **configName** | **string** |  | 
 **configKey** | **string** |  | 
 **configValue** | **string** |  | [default to &quot;&quot;]
 **configType** | **string** |  | [default to &quot;N&quot;]

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


## CreateDeptApiV1SystemAdminDeptCreatePost

> interface{} CreateDeptApiV1SystemAdminDeptCreatePost(ctx).DeptName(deptName).ParentId(parentId).Leader(leader).OrderNum(orderNum).Execute()

创建部门

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
	deptName := "deptName_example" // string | 
	parentId := int32(56) // int32 |  (optional) (default to 0)
	leader := "leader_example" // string |  (optional) (default to "")
	orderNum := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.CreateDeptApiV1SystemAdminDeptCreatePost(context.Background()).DeptName(deptName).ParentId(parentId).Leader(leader).OrderNum(orderNum).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.CreateDeptApiV1SystemAdminDeptCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateDeptApiV1SystemAdminDeptCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.CreateDeptApiV1SystemAdminDeptCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateDeptApiV1SystemAdminDeptCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **deptName** | **string** |  | 
 **parentId** | **int32** |  | [default to 0]
 **leader** | **string** |  | [default to &quot;&quot;]
 **orderNum** | **int32** |  | [default to 0]

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


## CreateDictDataApiV1SystemAdminDictDataCreatePost

> interface{} CreateDictDataApiV1SystemAdminDictDataCreatePost(ctx).DictType(dictType).DictLabel(dictLabel).DictValue(dictValue).DictSort(dictSort).Execute()

新增字典数据

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
	dictLabel := "dictLabel_example" // string | 
	dictValue := "dictValue_example" // string | 
	dictSort := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.CreateDictDataApiV1SystemAdminDictDataCreatePost(context.Background()).DictType(dictType).DictLabel(dictLabel).DictValue(dictValue).DictSort(dictSort).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.CreateDictDataApiV1SystemAdminDictDataCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateDictDataApiV1SystemAdminDictDataCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.CreateDictDataApiV1SystemAdminDictDataCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateDictDataApiV1SystemAdminDictDataCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dictType** | **string** |  | 
 **dictLabel** | **string** |  | 
 **dictValue** | **string** |  | 
 **dictSort** | **int32** |  | [default to 0]

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


## CreateDictTypeApiV1SystemAdminDictTypeCreatePost

> interface{} CreateDictTypeApiV1SystemAdminDictTypeCreatePost(ctx).DictName(dictName).DictType(dictType).Execute()

新增字典类型

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
	dictName := "dictName_example" // string | 
	dictType := "dictType_example" // string | 字典编码，如 sys_user_sex

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.CreateDictTypeApiV1SystemAdminDictTypeCreatePost(context.Background()).DictName(dictName).DictType(dictType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.CreateDictTypeApiV1SystemAdminDictTypeCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateDictTypeApiV1SystemAdminDictTypeCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.CreateDictTypeApiV1SystemAdminDictTypeCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateDictTypeApiV1SystemAdminDictTypeCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dictName** | **string** |  | 
 **dictType** | **string** | 字典编码，如 sys_user_sex | 

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


## CreateMenuApiV1SystemAdminMenuCreatePost

> interface{} CreateMenuApiV1SystemAdminMenuCreatePost(ctx).MenuName(menuName).ParentId(parentId).Path(path).Icon(icon).MenuType(menuType).Execute()

创建菜单

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
	menuName := "menuName_example" // string | 
	parentId := int32(56) // int32 |  (optional) (default to 0)
	path := "path_example" // string |  (optional) (default to "")
	icon := "icon_example" // string |  (optional) (default to "#")
	menuType := "menuType_example" // string |  (optional) (default to "M")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.CreateMenuApiV1SystemAdminMenuCreatePost(context.Background()).MenuName(menuName).ParentId(parentId).Path(path).Icon(icon).MenuType(menuType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.CreateMenuApiV1SystemAdminMenuCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateMenuApiV1SystemAdminMenuCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.CreateMenuApiV1SystemAdminMenuCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateMenuApiV1SystemAdminMenuCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **menuName** | **string** |  | 
 **parentId** | **int32** |  | [default to 0]
 **path** | **string** |  | [default to &quot;&quot;]
 **icon** | **string** |  | [default to &quot;#&quot;]
 **menuType** | **string** |  | [default to &quot;M&quot;]

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


## CreatePostApiV1SystemAdminPostCreatePost

> interface{} CreatePostApiV1SystemAdminPostCreatePost(ctx).PostCode(postCode).PostName(postName).PostSort(postSort).Execute()

创建岗位

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
	postCode := "postCode_example" // string | 
	postName := "postName_example" // string | 
	postSort := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.CreatePostApiV1SystemAdminPostCreatePost(context.Background()).PostCode(postCode).PostName(postName).PostSort(postSort).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.CreatePostApiV1SystemAdminPostCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreatePostApiV1SystemAdminPostCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.CreatePostApiV1SystemAdminPostCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreatePostApiV1SystemAdminPostCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **postCode** | **string** |  | 
 **postName** | **string** |  | 
 **postSort** | **int32** |  | [default to 0]

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


## CreateRoleApiV1SystemAdminRoleCreatePost

> interface{} CreateRoleApiV1SystemAdminRoleCreatePost(ctx).RoleName(roleName).RoleKey(roleKey).RoleSort(roleSort).Execute()

创建角色

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
	roleName := "roleName_example" // string | 
	roleKey := "roleKey_example" // string | 
	roleSort := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.CreateRoleApiV1SystemAdminRoleCreatePost(context.Background()).RoleName(roleName).RoleKey(roleKey).RoleSort(roleSort).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.CreateRoleApiV1SystemAdminRoleCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateRoleApiV1SystemAdminRoleCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.CreateRoleApiV1SystemAdminRoleCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateRoleApiV1SystemAdminRoleCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **roleName** | **string** |  | 
 **roleKey** | **string** |  | 
 **roleSort** | **int32** |  | [default to 0]

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


## DeleteDeptApiV1SystemAdminDeptDeletePost

> interface{} DeleteDeptApiV1SystemAdminDeptDeletePost(ctx).DeptId(deptId).Execute()

删除部门

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
	deptId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.DeleteDeptApiV1SystemAdminDeptDeletePost(context.Background()).DeptId(deptId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.DeleteDeptApiV1SystemAdminDeptDeletePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteDeptApiV1SystemAdminDeptDeletePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.DeleteDeptApiV1SystemAdminDeptDeletePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteDeptApiV1SystemAdminDeptDeletePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **deptId** | **int32** |  | 

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


## DeleteMenuApiV1SystemAdminMenuDeletePost

> interface{} DeleteMenuApiV1SystemAdminMenuDeletePost(ctx).MenuId(menuId).Execute()

删除菜单

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
	menuId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.DeleteMenuApiV1SystemAdminMenuDeletePost(context.Background()).MenuId(menuId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.DeleteMenuApiV1SystemAdminMenuDeletePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteMenuApiV1SystemAdminMenuDeletePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.DeleteMenuApiV1SystemAdminMenuDeletePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteMenuApiV1SystemAdminMenuDeletePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **menuId** | **int32** |  | 

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


## DeleteRoleApiV1SystemAdminRoleDeletePost

> interface{} DeleteRoleApiV1SystemAdminRoleDeletePost(ctx).RoleId(roleId).Execute()

删除角色

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
	roleId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.DeleteRoleApiV1SystemAdminRoleDeletePost(context.Background()).RoleId(roleId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.DeleteRoleApiV1SystemAdminRoleDeletePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteRoleApiV1SystemAdminRoleDeletePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.DeleteRoleApiV1SystemAdminRoleDeletePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteRoleApiV1SystemAdminRoleDeletePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **roleId** | **int32** |  | 

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


## ExportConfigsApiV1SystemAdminConfigExportGet

> interface{} ExportConfigsApiV1SystemAdminConfigExportGet(ctx).Execute()

导出参数配置到Excel

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
	resp, r, err := apiClient.SystemAdminAPI.ExportConfigsApiV1SystemAdminConfigExportGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.ExportConfigsApiV1SystemAdminConfigExportGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExportConfigsApiV1SystemAdminConfigExportGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.ExportConfigsApiV1SystemAdminConfigExportGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiExportConfigsApiV1SystemAdminConfigExportGetRequest struct via the builder pattern


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


## ExportDeptsApiV1SystemAdminDeptExportGet

> interface{} ExportDeptsApiV1SystemAdminDeptExportGet(ctx).Execute()

导出部门列表到Excel

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
	resp, r, err := apiClient.SystemAdminAPI.ExportDeptsApiV1SystemAdminDeptExportGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.ExportDeptsApiV1SystemAdminDeptExportGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExportDeptsApiV1SystemAdminDeptExportGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.ExportDeptsApiV1SystemAdminDeptExportGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiExportDeptsApiV1SystemAdminDeptExportGetRequest struct via the builder pattern


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


## ExportDictTypesApiV1SystemAdminDictTypeExportGet

> interface{} ExportDictTypesApiV1SystemAdminDictTypeExportGet(ctx).Execute()

导出字典类型到Excel

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
	resp, r, err := apiClient.SystemAdminAPI.ExportDictTypesApiV1SystemAdminDictTypeExportGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.ExportDictTypesApiV1SystemAdminDictTypeExportGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExportDictTypesApiV1SystemAdminDictTypeExportGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.ExportDictTypesApiV1SystemAdminDictTypeExportGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiExportDictTypesApiV1SystemAdminDictTypeExportGetRequest struct via the builder pattern


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


## ExportMenusApiV1SystemAdminMenuExportGet

> interface{} ExportMenusApiV1SystemAdminMenuExportGet(ctx).Execute()

导出菜单列表到Excel

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
	resp, r, err := apiClient.SystemAdminAPI.ExportMenusApiV1SystemAdminMenuExportGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.ExportMenusApiV1SystemAdminMenuExportGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExportMenusApiV1SystemAdminMenuExportGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.ExportMenusApiV1SystemAdminMenuExportGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiExportMenusApiV1SystemAdminMenuExportGetRequest struct via the builder pattern


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


## ExportPostsApiV1SystemAdminPostExportGet

> interface{} ExportPostsApiV1SystemAdminPostExportGet(ctx).Execute()

导出岗位列表到Excel

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
	resp, r, err := apiClient.SystemAdminAPI.ExportPostsApiV1SystemAdminPostExportGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.ExportPostsApiV1SystemAdminPostExportGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExportPostsApiV1SystemAdminPostExportGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.ExportPostsApiV1SystemAdminPostExportGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiExportPostsApiV1SystemAdminPostExportGetRequest struct via the builder pattern


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


## ExportRolesApiV1SystemAdminRoleExportGet

> interface{} ExportRolesApiV1SystemAdminRoleExportGet(ctx).Execute()

导出角色列表到Excel

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
	resp, r, err := apiClient.SystemAdminAPI.ExportRolesApiV1SystemAdminRoleExportGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.ExportRolesApiV1SystemAdminRoleExportGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExportRolesApiV1SystemAdminRoleExportGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.ExportRolesApiV1SystemAdminRoleExportGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiExportRolesApiV1SystemAdminRoleExportGetRequest struct via the builder pattern


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


## GetConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet

> interface{} GetConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet(ctx, configKey).Execute()

按 key 查配置

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
	configKey := "configKey_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.GetConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet(context.Background(), configKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.GetConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.GetConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**configKey** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGetRequest struct via the builder pattern


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


## GetDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet

> interface{} GetDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet(ctx, dictType).Execute()

按字典类型获取数据 (RuoYi 兼容)



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
	resp, r, err := apiClient.SystemAdminAPI.GetDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet(context.Background(), dictType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.GetDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.GetDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**dictType** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGetRequest struct via the builder pattern


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


## GetRoutersApiV1SystemAdminMenuGetRoutersGet

> interface{} GetRoutersApiV1SystemAdminMenuGetRoutersGet(ctx).Execute()

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
	resp, r, err := apiClient.SystemAdminAPI.GetRoutersApiV1SystemAdminMenuGetRoutersGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.GetRoutersApiV1SystemAdminMenuGetRoutersGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetRoutersApiV1SystemAdminMenuGetRoutersGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.GetRoutersApiV1SystemAdminMenuGetRoutersGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetRoutersApiV1SystemAdminMenuGetRoutersGetRequest struct via the builder pattern


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


## ListConfigsApiV1SystemAdminConfigListGet

> interface{} ListConfigsApiV1SystemAdminConfigListGet(ctx).Page(page).Limit(limit).ConfigKey(configKey).Execute()

参数配置列表

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
	limit := int32(56) // int32 |  (optional) (default to 50)
	configKey := "configKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.ListConfigsApiV1SystemAdminConfigListGet(context.Background()).Page(page).Limit(limit).ConfigKey(configKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.ListConfigsApiV1SystemAdminConfigListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListConfigsApiV1SystemAdminConfigListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.ListConfigsApiV1SystemAdminConfigListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListConfigsApiV1SystemAdminConfigListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 50]
 **configKey** | **string** |  | 

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


## ListDeptsApiV1SystemAdminDeptListGet

> interface{} ListDeptsApiV1SystemAdminDeptListGet(ctx).Page(page).Limit(limit).DeptName(deptName).Execute()

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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 50)
	deptName := "deptName_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.ListDeptsApiV1SystemAdminDeptListGet(context.Background()).Page(page).Limit(limit).DeptName(deptName).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.ListDeptsApiV1SystemAdminDeptListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDeptsApiV1SystemAdminDeptListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.ListDeptsApiV1SystemAdminDeptListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDeptsApiV1SystemAdminDeptListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 50]
 **deptName** | **string** |  | 

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


## ListDictDataApiV1SystemAdminDictDataListGet

> interface{} ListDictDataApiV1SystemAdminDictDataListGet(ctx).DictType(dictType).Page(page).Limit(limit).Execute()

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
	dictType := "dictType_example" // string | 字典编码
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 100)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.ListDictDataApiV1SystemAdminDictDataListGet(context.Background()).DictType(dictType).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.ListDictDataApiV1SystemAdminDictDataListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDictDataApiV1SystemAdminDictDataListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.ListDictDataApiV1SystemAdminDictDataListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDictDataApiV1SystemAdminDictDataListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dictType** | **string** | 字典编码 | 
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 100]

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


## ListDictTypesApiV1SystemAdminDictTypeListGet

> interface{} ListDictTypesApiV1SystemAdminDictTypeListGet(ctx).Page(page).Limit(limit).Execute()

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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 50)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.ListDictTypesApiV1SystemAdminDictTypeListGet(context.Background()).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.ListDictTypesApiV1SystemAdminDictTypeListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDictTypesApiV1SystemAdminDictTypeListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.ListDictTypesApiV1SystemAdminDictTypeListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDictTypesApiV1SystemAdminDictTypeListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 50]

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


## ListMenusApiV1SystemAdminMenuListGet

> interface{} ListMenusApiV1SystemAdminMenuListGet(ctx).Page(page).Limit(limit).MenuName(menuName).Execute()

菜单列表

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
	limit := int32(56) // int32 |  (optional) (default to 50)
	menuName := "menuName_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.ListMenusApiV1SystemAdminMenuListGet(context.Background()).Page(page).Limit(limit).MenuName(menuName).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.ListMenusApiV1SystemAdminMenuListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListMenusApiV1SystemAdminMenuListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.ListMenusApiV1SystemAdminMenuListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListMenusApiV1SystemAdminMenuListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 50]
 **menuName** | **string** |  | 

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


## ListPostsApiV1SystemAdminPostListGet

> interface{} ListPostsApiV1SystemAdminPostListGet(ctx).Page(page).Limit(limit).Execute()

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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 50)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.ListPostsApiV1SystemAdminPostListGet(context.Background()).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.ListPostsApiV1SystemAdminPostListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListPostsApiV1SystemAdminPostListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.ListPostsApiV1SystemAdminPostListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListPostsApiV1SystemAdminPostListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 50]

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


## ListRolesApiV1SystemAdminRoleListGet

> interface{} ListRolesApiV1SystemAdminRoleListGet(ctx).Page(page).Limit(limit).RoleName(roleName).Execute()

角色列表

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
	roleName := "roleName_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.ListRolesApiV1SystemAdminRoleListGet(context.Background()).Page(page).Limit(limit).RoleName(roleName).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.ListRolesApiV1SystemAdminRoleListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListRolesApiV1SystemAdminRoleListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.ListRolesApiV1SystemAdminRoleListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListRolesApiV1SystemAdminRoleListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **roleName** | **string** |  | 

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


## MenuTreeselectApiV1SystemAdminMenuTreeselectGet

> interface{} MenuTreeselectApiV1SystemAdminMenuTreeselectGet(ctx).Execute()

菜单树选择 (RuoYi 兼容)

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
	resp, r, err := apiClient.SystemAdminAPI.MenuTreeselectApiV1SystemAdminMenuTreeselectGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.MenuTreeselectApiV1SystemAdminMenuTreeselectGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MenuTreeselectApiV1SystemAdminMenuTreeselectGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.MenuTreeselectApiV1SystemAdminMenuTreeselectGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiMenuTreeselectApiV1SystemAdminMenuTreeselectGetRequest struct via the builder pattern


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


## RoleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet

> interface{} RoleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet(ctx, roleId).Execute()

角色菜单树

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
	roleId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.RoleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet(context.Background(), roleId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.RoleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RoleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.RoleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**roleId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiRoleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGetRequest struct via the builder pattern


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


## UpdateConfigApiV1SystemAdminConfigUpdatePost

> interface{} UpdateConfigApiV1SystemAdminConfigUpdatePost(ctx).ConfigId(configId).ConfigValue(configValue).Execute()

更新配置值

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
	configId := int32(56) // int32 | 
	configValue := "configValue_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.UpdateConfigApiV1SystemAdminConfigUpdatePost(context.Background()).ConfigId(configId).ConfigValue(configValue).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.UpdateConfigApiV1SystemAdminConfigUpdatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateConfigApiV1SystemAdminConfigUpdatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.UpdateConfigApiV1SystemAdminConfigUpdatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateConfigApiV1SystemAdminConfigUpdatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **configId** | **int32** |  | 
 **configValue** | **string** |  | 

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


## UpdateRoleApiV1SystemAdminRoleUpdatePost

> interface{} UpdateRoleApiV1SystemAdminRoleUpdatePost(ctx).RoleId(roleId).RoleName(roleName).RoleSort(roleSort).Execute()

更新角色

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
	roleId := int32(56) // int32 | 
	roleName := "roleName_example" // string |  (optional)
	roleSort := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAdminAPI.UpdateRoleApiV1SystemAdminRoleUpdatePost(context.Background()).RoleId(roleId).RoleName(roleName).RoleSort(roleSort).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAdminAPI.UpdateRoleApiV1SystemAdminRoleUpdatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateRoleApiV1SystemAdminRoleUpdatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAdminAPI.UpdateRoleApiV1SystemAdminRoleUpdatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateRoleApiV1SystemAdminRoleUpdatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **roleId** | **int32** |  | 
 **roleName** | **string** |  | 
 **roleSort** | **int32** |  | 

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

