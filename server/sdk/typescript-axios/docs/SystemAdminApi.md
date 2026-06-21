# SystemAdminApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createConfigApiV1SystemAdminConfigCreatePost**](#createconfigapiv1systemadminconfigcreatepost) | **POST** /api/v1/system/admin/config/create | 新增配置|
|[**createDeptApiV1SystemAdminDeptCreatePost**](#createdeptapiv1systemadmindeptcreatepost) | **POST** /api/v1/system/admin/dept/create | 创建部门|
|[**createDictDataApiV1SystemAdminDictDataCreatePost**](#createdictdataapiv1systemadmindictdatacreatepost) | **POST** /api/v1/system/admin/dict/data/create | 新增字典数据|
|[**createDictTypeApiV1SystemAdminDictTypeCreatePost**](#createdicttypeapiv1systemadmindicttypecreatepost) | **POST** /api/v1/system/admin/dict/type/create | 新增字典类型|
|[**createMenuApiV1SystemAdminMenuCreatePost**](#createmenuapiv1systemadminmenucreatepost) | **POST** /api/v1/system/admin/menu/create | 创建菜单|
|[**createPostApiV1SystemAdminPostCreatePost**](#createpostapiv1systemadminpostcreatepost) | **POST** /api/v1/system/admin/post/create | 创建岗位|
|[**createRoleApiV1SystemAdminRoleCreatePost**](#createroleapiv1systemadminrolecreatepost) | **POST** /api/v1/system/admin/role/create | 创建角色|
|[**deleteDeptApiV1SystemAdminDeptDeletePost**](#deletedeptapiv1systemadmindeptdeletepost) | **POST** /api/v1/system/admin/dept/delete | 删除部门|
|[**deleteMenuApiV1SystemAdminMenuDeletePost**](#deletemenuapiv1systemadminmenudeletepost) | **POST** /api/v1/system/admin/menu/delete | 删除菜单|
|[**deleteRoleApiV1SystemAdminRoleDeletePost**](#deleteroleapiv1systemadminroledeletepost) | **POST** /api/v1/system/admin/role/delete | 删除角色|
|[**exportConfigsApiV1SystemAdminConfigExportGet**](#exportconfigsapiv1systemadminconfigexportget) | **GET** /api/v1/system/admin/config/export | 导出参数配置到Excel|
|[**exportDeptsApiV1SystemAdminDeptExportGet**](#exportdeptsapiv1systemadmindeptexportget) | **GET** /api/v1/system/admin/dept/export | 导出部门列表到Excel|
|[**exportDictTypesApiV1SystemAdminDictTypeExportGet**](#exportdicttypesapiv1systemadmindicttypeexportget) | **GET** /api/v1/system/admin/dict/type/export | 导出字典类型到Excel|
|[**exportMenusApiV1SystemAdminMenuExportGet**](#exportmenusapiv1systemadminmenuexportget) | **GET** /api/v1/system/admin/menu/export | 导出菜单列表到Excel|
|[**exportPostsApiV1SystemAdminPostExportGet**](#exportpostsapiv1systemadminpostexportget) | **GET** /api/v1/system/admin/post/export | 导出岗位列表到Excel|
|[**exportRolesApiV1SystemAdminRoleExportGet**](#exportrolesapiv1systemadminroleexportget) | **GET** /api/v1/system/admin/role/export | 导出角色列表到Excel|
|[**getConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet**](#getconfigbykeyapiv1systemadminconfigkeyconfigkeyget) | **GET** /api/v1/system/admin/config/key/{config_key} | 按 key 查配置|
|[**getDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet**](#getdictdatabytypeapiv1systemadmindictdatatypedicttypeget) | **GET** /api/v1/system/admin/dict/data/type/{dict_type} | 按字典类型获取数据 (RuoYi 兼容)|
|[**getRoutersApiV1SystemAdminMenuGetRoutersGet**](#getroutersapiv1systemadminmenugetroutersget) | **GET** /api/v1/system/admin/menu/getRouters | 获取路由菜单树 (RuoYi 兼容)|
|[**listConfigsApiV1SystemAdminConfigListGet**](#listconfigsapiv1systemadminconfiglistget) | **GET** /api/v1/system/admin/config/list | 参数配置列表|
|[**listDeptsApiV1SystemAdminDeptListGet**](#listdeptsapiv1systemadmindeptlistget) | **GET** /api/v1/system/admin/dept/list | 部门列表|
|[**listDictDataApiV1SystemAdminDictDataListGet**](#listdictdataapiv1systemadmindictdatalistget) | **GET** /api/v1/system/admin/dict/data/list | 字典数据列表|
|[**listDictTypesApiV1SystemAdminDictTypeListGet**](#listdicttypesapiv1systemadmindicttypelistget) | **GET** /api/v1/system/admin/dict/type/list | 字典类型列表|
|[**listMenusApiV1SystemAdminMenuListGet**](#listmenusapiv1systemadminmenulistget) | **GET** /api/v1/system/admin/menu/list | 菜单列表|
|[**listPostsApiV1SystemAdminPostListGet**](#listpostsapiv1systemadminpostlistget) | **GET** /api/v1/system/admin/post/list | 岗位列表|
|[**listRolesApiV1SystemAdminRoleListGet**](#listrolesapiv1systemadminrolelistget) | **GET** /api/v1/system/admin/role/list | 角色列表|
|[**menuTreeselectApiV1SystemAdminMenuTreeselectGet**](#menutreeselectapiv1systemadminmenutreeselectget) | **GET** /api/v1/system/admin/menu/treeselect | 菜单树选择 (RuoYi 兼容)|
|[**roleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet**](#rolemenutreeselectapiv1systemadminmenurolemenutreeselectroleidget) | **GET** /api/v1/system/admin/menu/roleMenuTreeselect/{role_id} | 角色菜单树|
|[**updateConfigApiV1SystemAdminConfigUpdatePost**](#updateconfigapiv1systemadminconfigupdatepost) | **POST** /api/v1/system/admin/config/update | 更新配置值|
|[**updateRoleApiV1SystemAdminRoleUpdatePost**](#updateroleapiv1systemadminroleupdatepost) | **POST** /api/v1/system/admin/role/update | 更新角色|

# **createConfigApiV1SystemAdminConfigCreatePost**
> any createConfigApiV1SystemAdminConfigCreatePost()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let configName: string; // (default to undefined)
let configKey: string; // (default to undefined)
let configValue: string; // (optional) (default to '')
let configType: string; // (optional) (default to 'N')

const { status, data } = await apiInstance.createConfigApiV1SystemAdminConfigCreatePost(
    configName,
    configKey,
    configValue,
    configType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **configName** | [**string**] |  | defaults to undefined|
| **configKey** | [**string**] |  | defaults to undefined|
| **configValue** | [**string**] |  | (optional) defaults to ''|
| **configType** | [**string**] |  | (optional) defaults to 'N'|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createDeptApiV1SystemAdminDeptCreatePost**
> any createDeptApiV1SystemAdminDeptCreatePost()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let deptName: string; // (default to undefined)
let parentId: number; // (optional) (default to 0)
let leader: string; // (optional) (default to '')
let orderNum: number; // (optional) (default to 0)

const { status, data } = await apiInstance.createDeptApiV1SystemAdminDeptCreatePost(
    deptName,
    parentId,
    leader,
    orderNum
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **deptName** | [**string**] |  | defaults to undefined|
| **parentId** | [**number**] |  | (optional) defaults to 0|
| **leader** | [**string**] |  | (optional) defaults to ''|
| **orderNum** | [**number**] |  | (optional) defaults to 0|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createDictDataApiV1SystemAdminDictDataCreatePost**
> any createDictDataApiV1SystemAdminDictDataCreatePost()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let dictType: string; // (default to undefined)
let dictLabel: string; // (default to undefined)
let dictValue: string; // (default to undefined)
let dictSort: number; // (optional) (default to 0)

const { status, data } = await apiInstance.createDictDataApiV1SystemAdminDictDataCreatePost(
    dictType,
    dictLabel,
    dictValue,
    dictSort
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **dictType** | [**string**] |  | defaults to undefined|
| **dictLabel** | [**string**] |  | defaults to undefined|
| **dictValue** | [**string**] |  | defaults to undefined|
| **dictSort** | [**number**] |  | (optional) defaults to 0|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createDictTypeApiV1SystemAdminDictTypeCreatePost**
> any createDictTypeApiV1SystemAdminDictTypeCreatePost()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let dictName: string; // (default to undefined)
let dictType: string; //字典编码，如 sys_user_sex (default to undefined)

const { status, data } = await apiInstance.createDictTypeApiV1SystemAdminDictTypeCreatePost(
    dictName,
    dictType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **dictName** | [**string**] |  | defaults to undefined|
| **dictType** | [**string**] | 字典编码，如 sys_user_sex | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createMenuApiV1SystemAdminMenuCreatePost**
> any createMenuApiV1SystemAdminMenuCreatePost()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let menuName: string; // (default to undefined)
let parentId: number; // (optional) (default to 0)
let path: string; // (optional) (default to '')
let icon: string; // (optional) (default to '#')
let menuType: string; // (optional) (default to 'M')

const { status, data } = await apiInstance.createMenuApiV1SystemAdminMenuCreatePost(
    menuName,
    parentId,
    path,
    icon,
    menuType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **menuName** | [**string**] |  | defaults to undefined|
| **parentId** | [**number**] |  | (optional) defaults to 0|
| **path** | [**string**] |  | (optional) defaults to ''|
| **icon** | [**string**] |  | (optional) defaults to '#'|
| **menuType** | [**string**] |  | (optional) defaults to 'M'|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createPostApiV1SystemAdminPostCreatePost**
> any createPostApiV1SystemAdminPostCreatePost()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let postCode: string; // (default to undefined)
let postName: string; // (default to undefined)
let postSort: number; // (optional) (default to 0)

const { status, data } = await apiInstance.createPostApiV1SystemAdminPostCreatePost(
    postCode,
    postName,
    postSort
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **postCode** | [**string**] |  | defaults to undefined|
| **postName** | [**string**] |  | defaults to undefined|
| **postSort** | [**number**] |  | (optional) defaults to 0|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createRoleApiV1SystemAdminRoleCreatePost**
> any createRoleApiV1SystemAdminRoleCreatePost()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let roleName: string; // (default to undefined)
let roleKey: string; // (default to undefined)
let roleSort: number; // (optional) (default to 0)

const { status, data } = await apiInstance.createRoleApiV1SystemAdminRoleCreatePost(
    roleName,
    roleKey,
    roleSort
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **roleName** | [**string**] |  | defaults to undefined|
| **roleKey** | [**string**] |  | defaults to undefined|
| **roleSort** | [**number**] |  | (optional) defaults to 0|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteDeptApiV1SystemAdminDeptDeletePost**
> any deleteDeptApiV1SystemAdminDeptDeletePost()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let deptId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteDeptApiV1SystemAdminDeptDeletePost(
    deptId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **deptId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteMenuApiV1SystemAdminMenuDeletePost**
> any deleteMenuApiV1SystemAdminMenuDeletePost()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let menuId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteMenuApiV1SystemAdminMenuDeletePost(
    menuId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **menuId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteRoleApiV1SystemAdminRoleDeletePost**
> any deleteRoleApiV1SystemAdminRoleDeletePost()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let roleId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteRoleApiV1SystemAdminRoleDeletePost(
    roleId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **roleId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **exportConfigsApiV1SystemAdminConfigExportGet**
> any exportConfigsApiV1SystemAdminConfigExportGet()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

const { status, data } = await apiInstance.exportConfigsApiV1SystemAdminConfigExportGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **exportDeptsApiV1SystemAdminDeptExportGet**
> any exportDeptsApiV1SystemAdminDeptExportGet()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

const { status, data } = await apiInstance.exportDeptsApiV1SystemAdminDeptExportGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **exportDictTypesApiV1SystemAdminDictTypeExportGet**
> any exportDictTypesApiV1SystemAdminDictTypeExportGet()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

const { status, data } = await apiInstance.exportDictTypesApiV1SystemAdminDictTypeExportGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **exportMenusApiV1SystemAdminMenuExportGet**
> any exportMenusApiV1SystemAdminMenuExportGet()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

const { status, data } = await apiInstance.exportMenusApiV1SystemAdminMenuExportGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **exportPostsApiV1SystemAdminPostExportGet**
> any exportPostsApiV1SystemAdminPostExportGet()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

const { status, data } = await apiInstance.exportPostsApiV1SystemAdminPostExportGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **exportRolesApiV1SystemAdminRoleExportGet**
> any exportRolesApiV1SystemAdminRoleExportGet()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

const { status, data } = await apiInstance.exportRolesApiV1SystemAdminRoleExportGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet**
> any getConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let configKey: string; // (default to undefined)

const { status, data } = await apiInstance.getConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet(
    configKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **configKey** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet**
> any getDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet()

前端 /system/dict/data/type/{dict_type} 调用此端点.

### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let dictType: string; // (default to undefined)

const { status, data } = await apiInstance.getDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet(
    dictType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **dictType** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getRoutersApiV1SystemAdminMenuGetRoutersGet**
> any getRoutersApiV1SystemAdminMenuGetRoutersGet()

返回前端路由所需的菜单树结构。RuoYi 前端调用 /system/menu/getRouters。

### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

const { status, data } = await apiInstance.getRoutersApiV1SystemAdminMenuGetRoutersGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listConfigsApiV1SystemAdminConfigListGet**
> any listConfigsApiV1SystemAdminConfigListGet()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 50)
let configKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listConfigsApiV1SystemAdminConfigListGet(
    page,
    limit,
    configKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 50|
| **configKey** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listDeptsApiV1SystemAdminDeptListGet**
> any listDeptsApiV1SystemAdminDeptListGet()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 50)
let deptName: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listDeptsApiV1SystemAdminDeptListGet(
    page,
    limit,
    deptName
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 50|
| **deptName** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listDictDataApiV1SystemAdminDictDataListGet**
> any listDictDataApiV1SystemAdminDictDataListGet()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let dictType: string; //字典编码 (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 100)

const { status, data } = await apiInstance.listDictDataApiV1SystemAdminDictDataListGet(
    dictType,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **dictType** | [**string**] | 字典编码 | defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 100|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listDictTypesApiV1SystemAdminDictTypeListGet**
> any listDictTypesApiV1SystemAdminDictTypeListGet()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 50)

const { status, data } = await apiInstance.listDictTypesApiV1SystemAdminDictTypeListGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 50|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listMenusApiV1SystemAdminMenuListGet**
> any listMenusApiV1SystemAdminMenuListGet()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 50)
let menuName: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listMenusApiV1SystemAdminMenuListGet(
    page,
    limit,
    menuName
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 50|
| **menuName** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listPostsApiV1SystemAdminPostListGet**
> any listPostsApiV1SystemAdminPostListGet()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 50)

const { status, data } = await apiInstance.listPostsApiV1SystemAdminPostListGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 50|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listRolesApiV1SystemAdminRoleListGet**
> any listRolesApiV1SystemAdminRoleListGet()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let roleName: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listRolesApiV1SystemAdminRoleListGet(
    page,
    limit,
    roleName
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **roleName** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **menuTreeselectApiV1SystemAdminMenuTreeselectGet**
> any menuTreeselectApiV1SystemAdminMenuTreeselectGet()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

const { status, data } = await apiInstance.menuTreeselectApiV1SystemAdminMenuTreeselectGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **roleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet**
> any roleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let roleId: number; // (default to undefined)

const { status, data } = await apiInstance.roleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet(
    roleId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **roleId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateConfigApiV1SystemAdminConfigUpdatePost**
> any updateConfigApiV1SystemAdminConfigUpdatePost()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let configId: number; // (default to undefined)
let configValue: string; // (default to undefined)

const { status, data } = await apiInstance.updateConfigApiV1SystemAdminConfigUpdatePost(
    configId,
    configValue
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **configId** | [**number**] |  | defaults to undefined|
| **configValue** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateRoleApiV1SystemAdminRoleUpdatePost**
> any updateRoleApiV1SystemAdminRoleUpdatePost()


### Example

```typescript
import {
    SystemAdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAdminApi(configuration);

let roleId: number; // (default to undefined)
let roleName: string; // (optional) (default to undefined)
let roleSort: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateRoleApiV1SystemAdminRoleUpdatePost(
    roleId,
    roleName,
    roleSort
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **roleId** | [**number**] |  | defaults to undefined|
| **roleName** | [**string**] |  | (optional) defaults to undefined|
| **roleSort** | [**number**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

