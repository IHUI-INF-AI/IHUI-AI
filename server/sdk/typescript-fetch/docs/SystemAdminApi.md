# SystemAdminApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createConfigApiV1SystemAdminConfigCreatePost**](SystemAdminApi.md#createconfigapiv1systemadminconfigcreatepost) | **POST** /api/v1/system/admin/config/create | 新增配置 |
| [**createDeptApiV1SystemAdminDeptCreatePost**](SystemAdminApi.md#createdeptapiv1systemadmindeptcreatepost) | **POST** /api/v1/system/admin/dept/create | 创建部门 |
| [**createDictDataApiV1SystemAdminDictDataCreatePost**](SystemAdminApi.md#createdictdataapiv1systemadmindictdatacreatepost) | **POST** /api/v1/system/admin/dict/data/create | 新增字典数据 |
| [**createDictTypeApiV1SystemAdminDictTypeCreatePost**](SystemAdminApi.md#createdicttypeapiv1systemadmindicttypecreatepost) | **POST** /api/v1/system/admin/dict/type/create | 新增字典类型 |
| [**createMenuApiV1SystemAdminMenuCreatePost**](SystemAdminApi.md#createmenuapiv1systemadminmenucreatepost) | **POST** /api/v1/system/admin/menu/create | 创建菜单 |
| [**createPostApiV1SystemAdminPostCreatePost**](SystemAdminApi.md#createpostapiv1systemadminpostcreatepost) | **POST** /api/v1/system/admin/post/create | 创建岗位 |
| [**createRoleApiV1SystemAdminRoleCreatePost**](SystemAdminApi.md#createroleapiv1systemadminrolecreatepost) | **POST** /api/v1/system/admin/role/create | 创建角色 |
| [**deleteDeptApiV1SystemAdminDeptDeletePost**](SystemAdminApi.md#deletedeptapiv1systemadmindeptdeletepost) | **POST** /api/v1/system/admin/dept/delete | 删除部门 |
| [**deleteMenuApiV1SystemAdminMenuDeletePost**](SystemAdminApi.md#deletemenuapiv1systemadminmenudeletepost) | **POST** /api/v1/system/admin/menu/delete | 删除菜单 |
| [**deleteRoleApiV1SystemAdminRoleDeletePost**](SystemAdminApi.md#deleteroleapiv1systemadminroledeletepost) | **POST** /api/v1/system/admin/role/delete | 删除角色 |
| [**exportConfigsApiV1SystemAdminConfigExportGet**](SystemAdminApi.md#exportconfigsapiv1systemadminconfigexportget) | **GET** /api/v1/system/admin/config/export | 导出参数配置到Excel |
| [**exportDeptsApiV1SystemAdminDeptExportGet**](SystemAdminApi.md#exportdeptsapiv1systemadmindeptexportget) | **GET** /api/v1/system/admin/dept/export | 导出部门列表到Excel |
| [**exportDictTypesApiV1SystemAdminDictTypeExportGet**](SystemAdminApi.md#exportdicttypesapiv1systemadmindicttypeexportget) | **GET** /api/v1/system/admin/dict/type/export | 导出字典类型到Excel |
| [**exportMenusApiV1SystemAdminMenuExportGet**](SystemAdminApi.md#exportmenusapiv1systemadminmenuexportget) | **GET** /api/v1/system/admin/menu/export | 导出菜单列表到Excel |
| [**exportPostsApiV1SystemAdminPostExportGet**](SystemAdminApi.md#exportpostsapiv1systemadminpostexportget) | **GET** /api/v1/system/admin/post/export | 导出岗位列表到Excel |
| [**exportRolesApiV1SystemAdminRoleExportGet**](SystemAdminApi.md#exportrolesapiv1systemadminroleexportget) | **GET** /api/v1/system/admin/role/export | 导出角色列表到Excel |
| [**getConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet**](SystemAdminApi.md#getconfigbykeyapiv1systemadminconfigkeyconfigkeyget) | **GET** /api/v1/system/admin/config/key/{config_key} | 按 key 查配置 |
| [**getDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet**](SystemAdminApi.md#getdictdatabytypeapiv1systemadmindictdatatypedicttypeget) | **GET** /api/v1/system/admin/dict/data/type/{dict_type} | 按字典类型获取数据 (RuoYi 兼容) |
| [**getRoutersApiV1SystemAdminMenuGetRoutersGet**](SystemAdminApi.md#getroutersapiv1systemadminmenugetroutersget) | **GET** /api/v1/system/admin/menu/getRouters | 获取路由菜单树 (RuoYi 兼容) |
| [**listConfigsApiV1SystemAdminConfigListGet**](SystemAdminApi.md#listconfigsapiv1systemadminconfiglistget) | **GET** /api/v1/system/admin/config/list | 参数配置列表 |
| [**listDeptsApiV1SystemAdminDeptListGet**](SystemAdminApi.md#listdeptsapiv1systemadmindeptlistget) | **GET** /api/v1/system/admin/dept/list | 部门列表 |
| [**listDictDataApiV1SystemAdminDictDataListGet**](SystemAdminApi.md#listdictdataapiv1systemadmindictdatalistget) | **GET** /api/v1/system/admin/dict/data/list | 字典数据列表 |
| [**listDictTypesApiV1SystemAdminDictTypeListGet**](SystemAdminApi.md#listdicttypesapiv1systemadmindicttypelistget) | **GET** /api/v1/system/admin/dict/type/list | 字典类型列表 |
| [**listMenusApiV1SystemAdminMenuListGet**](SystemAdminApi.md#listmenusapiv1systemadminmenulistget) | **GET** /api/v1/system/admin/menu/list | 菜单列表 |
| [**listPostsApiV1SystemAdminPostListGet**](SystemAdminApi.md#listpostsapiv1systemadminpostlistget) | **GET** /api/v1/system/admin/post/list | 岗位列表 |
| [**listRolesApiV1SystemAdminRoleListGet**](SystemAdminApi.md#listrolesapiv1systemadminrolelistget) | **GET** /api/v1/system/admin/role/list | 角色列表 |
| [**menuTreeselectApiV1SystemAdminMenuTreeselectGet**](SystemAdminApi.md#menutreeselectapiv1systemadminmenutreeselectget) | **GET** /api/v1/system/admin/menu/treeselect | 菜单树选择 (RuoYi 兼容) |
| [**roleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet**](SystemAdminApi.md#rolemenutreeselectapiv1systemadminmenurolemenutreeselectroleidget) | **GET** /api/v1/system/admin/menu/roleMenuTreeselect/{role_id} | 角色菜单树 |
| [**updateConfigApiV1SystemAdminConfigUpdatePost**](SystemAdminApi.md#updateconfigapiv1systemadminconfigupdatepost) | **POST** /api/v1/system/admin/config/update | 更新配置值 |
| [**updateRoleApiV1SystemAdminRoleUpdatePost**](SystemAdminApi.md#updateroleapiv1systemadminroleupdatepost) | **POST** /api/v1/system/admin/role/update | 更新角色 |



## createConfigApiV1SystemAdminConfigCreatePost

> any createConfigApiV1SystemAdminConfigCreatePost(configName, configKey, configValue, configType)

新增配置

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { CreateConfigApiV1SystemAdminConfigCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // string
    configName: configName_example,
    // string
    configKey: configKey_example,
    // string (optional)
    configValue: configValue_example,
    // string (optional)
    configType: configType_example,
  } satisfies CreateConfigApiV1SystemAdminConfigCreatePostRequest;

  try {
    const data = await api.createConfigApiV1SystemAdminConfigCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **configName** | `string` |  | [Defaults to `undefined`] |
| **configKey** | `string` |  | [Defaults to `undefined`] |
| **configValue** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **configType** | `string` |  | [Optional] [Defaults to `&#39;N&#39;`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createDeptApiV1SystemAdminDeptCreatePost

> any createDeptApiV1SystemAdminDeptCreatePost(deptName, parentId, leader, orderNum)

创建部门

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { CreateDeptApiV1SystemAdminDeptCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // string
    deptName: deptName_example,
    // number (optional)
    parentId: 56,
    // string (optional)
    leader: leader_example,
    // number (optional)
    orderNum: 56,
  } satisfies CreateDeptApiV1SystemAdminDeptCreatePostRequest;

  try {
    const data = await api.createDeptApiV1SystemAdminDeptCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **deptName** | `string` |  | [Defaults to `undefined`] |
| **parentId** | `number` |  | [Optional] [Defaults to `0`] |
| **leader** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **orderNum** | `number` |  | [Optional] [Defaults to `0`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createDictDataApiV1SystemAdminDictDataCreatePost

> any createDictDataApiV1SystemAdminDictDataCreatePost(dictType, dictLabel, dictValue, dictSort)

新增字典数据

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { CreateDictDataApiV1SystemAdminDictDataCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // string
    dictType: dictType_example,
    // string
    dictLabel: dictLabel_example,
    // string
    dictValue: dictValue_example,
    // number (optional)
    dictSort: 56,
  } satisfies CreateDictDataApiV1SystemAdminDictDataCreatePostRequest;

  try {
    const data = await api.createDictDataApiV1SystemAdminDictDataCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **dictType** | `string` |  | [Defaults to `undefined`] |
| **dictLabel** | `string` |  | [Defaults to `undefined`] |
| **dictValue** | `string` |  | [Defaults to `undefined`] |
| **dictSort** | `number` |  | [Optional] [Defaults to `0`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createDictTypeApiV1SystemAdminDictTypeCreatePost

> any createDictTypeApiV1SystemAdminDictTypeCreatePost(dictName, dictType)

新增字典类型

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { CreateDictTypeApiV1SystemAdminDictTypeCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // string
    dictName: dictName_example,
    // string | 字典编码，如 sys_user_sex
    dictType: dictType_example,
  } satisfies CreateDictTypeApiV1SystemAdminDictTypeCreatePostRequest;

  try {
    const data = await api.createDictTypeApiV1SystemAdminDictTypeCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **dictName** | `string` |  | [Defaults to `undefined`] |
| **dictType** | `string` | 字典编码，如 sys_user_sex | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createMenuApiV1SystemAdminMenuCreatePost

> any createMenuApiV1SystemAdminMenuCreatePost(menuName, parentId, path, icon, menuType)

创建菜单

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { CreateMenuApiV1SystemAdminMenuCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // string
    menuName: menuName_example,
    // number (optional)
    parentId: 56,
    // string (optional)
    path: path_example,
    // string (optional)
    icon: icon_example,
    // string (optional)
    menuType: menuType_example,
  } satisfies CreateMenuApiV1SystemAdminMenuCreatePostRequest;

  try {
    const data = await api.createMenuApiV1SystemAdminMenuCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **menuName** | `string` |  | [Defaults to `undefined`] |
| **parentId** | `number` |  | [Optional] [Defaults to `0`] |
| **path** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **icon** | `string` |  | [Optional] [Defaults to `&#39;#&#39;`] |
| **menuType** | `string` |  | [Optional] [Defaults to `&#39;M&#39;`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createPostApiV1SystemAdminPostCreatePost

> any createPostApiV1SystemAdminPostCreatePost(postCode, postName, postSort)

创建岗位

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { CreatePostApiV1SystemAdminPostCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // string
    postCode: postCode_example,
    // string
    postName: postName_example,
    // number (optional)
    postSort: 56,
  } satisfies CreatePostApiV1SystemAdminPostCreatePostRequest;

  try {
    const data = await api.createPostApiV1SystemAdminPostCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **postCode** | `string` |  | [Defaults to `undefined`] |
| **postName** | `string` |  | [Defaults to `undefined`] |
| **postSort** | `number` |  | [Optional] [Defaults to `0`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createRoleApiV1SystemAdminRoleCreatePost

> any createRoleApiV1SystemAdminRoleCreatePost(roleName, roleKey, roleSort)

创建角色

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { CreateRoleApiV1SystemAdminRoleCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // string
    roleName: roleName_example,
    // string
    roleKey: roleKey_example,
    // number (optional)
    roleSort: 56,
  } satisfies CreateRoleApiV1SystemAdminRoleCreatePostRequest;

  try {
    const data = await api.createRoleApiV1SystemAdminRoleCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **roleName** | `string` |  | [Defaults to `undefined`] |
| **roleKey** | `string` |  | [Defaults to `undefined`] |
| **roleSort** | `number` |  | [Optional] [Defaults to `0`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteDeptApiV1SystemAdminDeptDeletePost

> any deleteDeptApiV1SystemAdminDeptDeletePost(deptId)

删除部门

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { DeleteDeptApiV1SystemAdminDeptDeletePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // number
    deptId: 56,
  } satisfies DeleteDeptApiV1SystemAdminDeptDeletePostRequest;

  try {
    const data = await api.deleteDeptApiV1SystemAdminDeptDeletePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **deptId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteMenuApiV1SystemAdminMenuDeletePost

> any deleteMenuApiV1SystemAdminMenuDeletePost(menuId)

删除菜单

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { DeleteMenuApiV1SystemAdminMenuDeletePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // number
    menuId: 56,
  } satisfies DeleteMenuApiV1SystemAdminMenuDeletePostRequest;

  try {
    const data = await api.deleteMenuApiV1SystemAdminMenuDeletePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **menuId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteRoleApiV1SystemAdminRoleDeletePost

> any deleteRoleApiV1SystemAdminRoleDeletePost(roleId)

删除角色

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { DeleteRoleApiV1SystemAdminRoleDeletePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // number
    roleId: 56,
  } satisfies DeleteRoleApiV1SystemAdminRoleDeletePostRequest;

  try {
    const data = await api.deleteRoleApiV1SystemAdminRoleDeletePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **roleId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## exportConfigsApiV1SystemAdminConfigExportGet

> any exportConfigsApiV1SystemAdminConfigExportGet()

导出参数配置到Excel

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { ExportConfigsApiV1SystemAdminConfigExportGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  try {
    const data = await api.exportConfigsApiV1SystemAdminConfigExportGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## exportDeptsApiV1SystemAdminDeptExportGet

> any exportDeptsApiV1SystemAdminDeptExportGet()

导出部门列表到Excel

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { ExportDeptsApiV1SystemAdminDeptExportGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  try {
    const data = await api.exportDeptsApiV1SystemAdminDeptExportGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## exportDictTypesApiV1SystemAdminDictTypeExportGet

> any exportDictTypesApiV1SystemAdminDictTypeExportGet()

导出字典类型到Excel

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { ExportDictTypesApiV1SystemAdminDictTypeExportGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  try {
    const data = await api.exportDictTypesApiV1SystemAdminDictTypeExportGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## exportMenusApiV1SystemAdminMenuExportGet

> any exportMenusApiV1SystemAdminMenuExportGet()

导出菜单列表到Excel

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { ExportMenusApiV1SystemAdminMenuExportGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  try {
    const data = await api.exportMenusApiV1SystemAdminMenuExportGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## exportPostsApiV1SystemAdminPostExportGet

> any exportPostsApiV1SystemAdminPostExportGet()

导出岗位列表到Excel

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { ExportPostsApiV1SystemAdminPostExportGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  try {
    const data = await api.exportPostsApiV1SystemAdminPostExportGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## exportRolesApiV1SystemAdminRoleExportGet

> any exportRolesApiV1SystemAdminRoleExportGet()

导出角色列表到Excel

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { ExportRolesApiV1SystemAdminRoleExportGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  try {
    const data = await api.exportRolesApiV1SystemAdminRoleExportGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet

> any getConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet(configKey)

按 key 查配置

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { GetConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // string
    configKey: configKey_example,
  } satisfies GetConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGetRequest;

  try {
    const data = await api.getConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **configKey** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet

> any getDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet(dictType)

按字典类型获取数据 (RuoYi 兼容)

前端 /system/dict/data/type/{dict_type} 调用此端点.

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { GetDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // string
    dictType: dictType_example,
  } satisfies GetDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGetRequest;

  try {
    const data = await api.getDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **dictType** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getRoutersApiV1SystemAdminMenuGetRoutersGet

> any getRoutersApiV1SystemAdminMenuGetRoutersGet()

获取路由菜单树 (RuoYi 兼容)

返回前端路由所需的菜单树结构。RuoYi 前端调用 /system/menu/getRouters。

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { GetRoutersApiV1SystemAdminMenuGetRoutersGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  try {
    const data = await api.getRoutersApiV1SystemAdminMenuGetRoutersGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listConfigsApiV1SystemAdminConfigListGet

> any listConfigsApiV1SystemAdminConfigListGet(page, limit, configKey)

参数配置列表

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { ListConfigsApiV1SystemAdminConfigListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    configKey: configKey_example,
  } satisfies ListConfigsApiV1SystemAdminConfigListGetRequest;

  try {
    const data = await api.listConfigsApiV1SystemAdminConfigListGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `50`] |
| **configKey** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listDeptsApiV1SystemAdminDeptListGet

> any listDeptsApiV1SystemAdminDeptListGet(page, limit, deptName)

部门列表

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { ListDeptsApiV1SystemAdminDeptListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    deptName: deptName_example,
  } satisfies ListDeptsApiV1SystemAdminDeptListGetRequest;

  try {
    const data = await api.listDeptsApiV1SystemAdminDeptListGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `50`] |
| **deptName** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listDictDataApiV1SystemAdminDictDataListGet

> any listDictDataApiV1SystemAdminDictDataListGet(dictType, page, limit)

字典数据列表

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { ListDictDataApiV1SystemAdminDictDataListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // string | 字典编码
    dictType: dictType_example,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListDictDataApiV1SystemAdminDictDataListGetRequest;

  try {
    const data = await api.listDictDataApiV1SystemAdminDictDataListGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **dictType** | `string` | 字典编码 | [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `100`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listDictTypesApiV1SystemAdminDictTypeListGet

> any listDictTypesApiV1SystemAdminDictTypeListGet(page, limit)

字典类型列表

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { ListDictTypesApiV1SystemAdminDictTypeListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListDictTypesApiV1SystemAdminDictTypeListGetRequest;

  try {
    const data = await api.listDictTypesApiV1SystemAdminDictTypeListGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `50`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listMenusApiV1SystemAdminMenuListGet

> any listMenusApiV1SystemAdminMenuListGet(page, limit, menuName)

菜单列表

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { ListMenusApiV1SystemAdminMenuListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    menuName: menuName_example,
  } satisfies ListMenusApiV1SystemAdminMenuListGetRequest;

  try {
    const data = await api.listMenusApiV1SystemAdminMenuListGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `50`] |
| **menuName** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listPostsApiV1SystemAdminPostListGet

> any listPostsApiV1SystemAdminPostListGet(page, limit)

岗位列表

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { ListPostsApiV1SystemAdminPostListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListPostsApiV1SystemAdminPostListGetRequest;

  try {
    const data = await api.listPostsApiV1SystemAdminPostListGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `50`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listRolesApiV1SystemAdminRoleListGet

> any listRolesApiV1SystemAdminRoleListGet(page, limit, roleName)

角色列表

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { ListRolesApiV1SystemAdminRoleListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    roleName: roleName_example,
  } satisfies ListRolesApiV1SystemAdminRoleListGetRequest;

  try {
    const data = await api.listRolesApiV1SystemAdminRoleListGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **roleName** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## menuTreeselectApiV1SystemAdminMenuTreeselectGet

> any menuTreeselectApiV1SystemAdminMenuTreeselectGet()

菜单树选择 (RuoYi 兼容)

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { MenuTreeselectApiV1SystemAdminMenuTreeselectGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  try {
    const data = await api.menuTreeselectApiV1SystemAdminMenuTreeselectGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## roleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet

> any roleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet(roleId)

角色菜单树

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { RoleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // number
    roleId: 56,
  } satisfies RoleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGetRequest;

  try {
    const data = await api.roleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **roleId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateConfigApiV1SystemAdminConfigUpdatePost

> any updateConfigApiV1SystemAdminConfigUpdatePost(configId, configValue)

更新配置值

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { UpdateConfigApiV1SystemAdminConfigUpdatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // number
    configId: 56,
    // string
    configValue: configValue_example,
  } satisfies UpdateConfigApiV1SystemAdminConfigUpdatePostRequest;

  try {
    const data = await api.updateConfigApiV1SystemAdminConfigUpdatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **configId** | `number` |  | [Defaults to `undefined`] |
| **configValue** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateRoleApiV1SystemAdminRoleUpdatePost

> any updateRoleApiV1SystemAdminRoleUpdatePost(roleId, roleName, roleSort)

更新角色

### Example

```ts
import {
  Configuration,
  SystemAdminApi,
} from '';
import type { UpdateRoleApiV1SystemAdminRoleUpdatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAdminApi(config);

  const body = {
    // number
    roleId: 56,
    // string (optional)
    roleName: roleName_example,
    // number (optional)
    roleSort: 56,
  } satisfies UpdateRoleApiV1SystemAdminRoleUpdatePostRequest;

  try {
    const data = await api.updateRoleApiV1SystemAdminRoleUpdatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **roleId** | `number` |  | [Defaults to `undefined`] |
| **roleName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **roleSort** | `number` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

