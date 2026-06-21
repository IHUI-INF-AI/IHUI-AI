# SystemApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminLoginApiV1SystemLoginPost**](#adminloginapiv1systemloginpost) | **POST** /api/v1/system/login | Admin login|
|[**changeUserStatusApiV1SystemChangeStatusPut**](#changeuserstatusapiv1systemchangestatusput) | **PUT** /api/v1/system/changeStatus | 启用 / 禁用用户|
|[**exportUsersApiV1SystemUserExportGet**](#exportusersapiv1systemuserexportget) | **GET** /api/v1/system/user/export | 导出用户列表到Excel|
|[**getDictApiV1SystemDictDictTypeGet**](#getdictapiv1systemdictdicttypeget) | **GET** /api/v1/system/dict/{dict_type} | Get dictionary data|
|[**getDictDataByTypeApiV1SystemDictDataTypeDictTypeGet**](#getdictdatabytypeapiv1systemdictdatatypedicttypeget) | **GET** /api/v1/system/dict/data/type/{dict_type} | 按字典类型获取数据|
|[**getLoginUserInfoAliasApiV1SystemUserGetInfoGet**](#getloginuserinfoaliasapiv1systemusergetinfoget) | **GET** /api/v1/system/user/getInfo | 获取当前登录用户信息 (别名)|
|[**getLoginUserInfoApiV1SystemGetInfoGet**](#getloginuserinfoapiv1systemgetinfoget) | **GET** /api/v1/system/getInfo | 获取当前登录用户信息(含角色与权限)|
|[**getRoutersApiV1SystemMenuGetRoutersGet**](#getroutersapiv1systemmenugetroutersget) | **GET** /api/v1/system/menu/getRouters | 获取路由菜单树 (RuoYi 兼容)|
|[**getUserProfileApiV1SystemUserProfileGet**](#getuserprofileapiv1systemuserprofileget) | **GET** /api/v1/system/user/profile | 获取个人详细资料|
|[**listConfigsApiV1SystemConfigListGet**](#listconfigsapiv1systemconfiglistget) | **GET** /api/v1/system/config/list | List system configs|
|[**listDeptsApiV1SystemDeptListGet**](#listdeptsapiv1systemdeptlistget) | **GET** /api/v1/system/dept/list | 部门列表|
|[**listDictDataApiV1SystemDictDataListGet**](#listdictdataapiv1systemdictdatalistget) | **GET** /api/v1/system/dict/data/list | 字典数据列表|
|[**listDictTypesApiV1SystemDictTypeListGet**](#listdicttypesapiv1systemdicttypelistget) | **GET** /api/v1/system/dict/type/list | 字典类型列表|
|[**listMenusApiV1SystemMenuListGet**](#listmenusapiv1systemmenulistget) | **GET** /api/v1/system/menu/list | List menus|
|[**listPostsApiV1SystemPostListGet**](#listpostsapiv1systempostlistget) | **GET** /api/v1/system/post/list | 岗位列表|
|[**listRolesApiV1SystemRoleListGet**](#listrolesapiv1systemrolelistget) | **GET** /api/v1/system/role/list | List roles|
|[**listSysUsersApiV1SystemUserListGet**](#listsysusersapiv1systemuserlistget) | **GET** /api/v1/system/user/list | List system users|
|[**menuTreeselectApiV1SystemMenuTreeselectGet**](#menutreeselectapiv1systemmenutreeselectget) | **GET** /api/v1/system/menu/treeselect | 菜单树选择|
|[**resetUserPwdApiV1SystemResetPwdPut**](#resetuserpwdapiv1systemresetpwdput) | **PUT** /api/v1/system/resetPwd | 管理员重置用户密码|
|[**updateOwnPasswordApiV1SystemUserProfileUpdatePwdPut**](#updateownpasswordapiv1systemuserprofileupdatepwdput) | **PUT** /api/v1/system/user/profile/updatePwd | 修改个人密码|
|[**updateUserProfileApiV1SystemUserProfilePut**](#updateuserprofileapiv1systemuserprofileput) | **PUT** /api/v1/system/user/profile | 修改个人信息|
|[**uploadAvatarApiV1SystemUserProfileAvatarPost**](#uploadavatarapiv1systemuserprofileavatarpost) | **POST** /api/v1/system/user/profile/avatar | 上传头像|

# **adminLoginApiV1SystemLoginPost**
> any adminLoginApiV1SystemLoginPost()


### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

let username: string; // (default to undefined)
let password: string; // (default to undefined)

const { status, data } = await apiInstance.adminLoginApiV1SystemLoginPost(
    username,
    password
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **username** | [**string**] |  | defaults to undefined|
| **password** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **changeUserStatusApiV1SystemChangeStatusPut**
> any changeUserStatusApiV1SystemChangeStatusPut()


### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

let userId: number; //目标用户 ID (default to undefined)
let status: string; //0=正常 1=停用 (default to undefined)

const { status, data } = await apiInstance.changeUserStatusApiV1SystemChangeStatusPut(
    userId,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**number**] | 目标用户 ID | defaults to undefined|
| **status** | [**string**] | 0&#x3D;正常 1&#x3D;停用 | defaults to undefined|


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

# **exportUsersApiV1SystemUserExportGet**
> any exportUsersApiV1SystemUserExportGet()


### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

const { status, data } = await apiInstance.exportUsersApiV1SystemUserExportGet();
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

# **getDictApiV1SystemDictDictTypeGet**
> any getDictApiV1SystemDictDictTypeGet()


### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

let dictType: string; // (default to undefined)

const { status, data } = await apiInstance.getDictApiV1SystemDictDictTypeGet(
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

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getDictDataByTypeApiV1SystemDictDataTypeDictTypeGet**
> any getDictDataByTypeApiV1SystemDictDataTypeDictTypeGet()


### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

let dictType: string; // (default to undefined)

const { status, data } = await apiInstance.getDictDataByTypeApiV1SystemDictDataTypeDictTypeGet(
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

# **getLoginUserInfoAliasApiV1SystemUserGetInfoGet**
> any getLoginUserInfoAliasApiV1SystemUserGetInfoGet()

前端调用 /system/user/getInfo 的别名，复用 /getInfo 逻辑。

### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

const { status, data } = await apiInstance.getLoginUserInfoAliasApiV1SystemUserGetInfoGet();
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

# **getLoginUserInfoApiV1SystemGetInfoGet**
> any getLoginUserInfoApiV1SystemGetInfoGet()

替代前端 mock，从数据库实时查询当前用户的角色和权限。

### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

const { status, data } = await apiInstance.getLoginUserInfoApiV1SystemGetInfoGet();
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

# **getRoutersApiV1SystemMenuGetRoutersGet**
> any getRoutersApiV1SystemMenuGetRoutersGet()


### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

const { status, data } = await apiInstance.getRoutersApiV1SystemMenuGetRoutersGet();
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

# **getUserProfileApiV1SystemUserProfileGet**
> any getUserProfileApiV1SystemUserProfileGet()


### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

const { status, data } = await apiInstance.getUserProfileApiV1SystemUserProfileGet();
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

# **listConfigsApiV1SystemConfigListGet**
> any listConfigsApiV1SystemConfigListGet()


### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

const { status, data } = await apiInstance.listConfigsApiV1SystemConfigListGet();
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

# **listDeptsApiV1SystemDeptListGet**
> any listDeptsApiV1SystemDeptListGet()


### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

const { status, data } = await apiInstance.listDeptsApiV1SystemDeptListGet();
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

# **listDictDataApiV1SystemDictDataListGet**
> any listDictDataApiV1SystemDictDataListGet()


### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

let dictType: string; // (default to undefined)

const { status, data } = await apiInstance.listDictDataApiV1SystemDictDataListGet(
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

# **listDictTypesApiV1SystemDictTypeListGet**
> any listDictTypesApiV1SystemDictTypeListGet()


### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

const { status, data } = await apiInstance.listDictTypesApiV1SystemDictTypeListGet();
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

# **listMenusApiV1SystemMenuListGet**
> any listMenusApiV1SystemMenuListGet()


### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

const { status, data } = await apiInstance.listMenusApiV1SystemMenuListGet();
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

# **listPostsApiV1SystemPostListGet**
> any listPostsApiV1SystemPostListGet()


### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

const { status, data } = await apiInstance.listPostsApiV1SystemPostListGet();
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

# **listRolesApiV1SystemRoleListGet**
> any listRolesApiV1SystemRoleListGet()


### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

const { status, data } = await apiInstance.listRolesApiV1SystemRoleListGet();
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

# **listSysUsersApiV1SystemUserListGet**
> any listSysUsersApiV1SystemUserListGet()


### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listSysUsersApiV1SystemUserListGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

# **menuTreeselectApiV1SystemMenuTreeselectGet**
> any menuTreeselectApiV1SystemMenuTreeselectGet()


### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

const { status, data } = await apiInstance.menuTreeselectApiV1SystemMenuTreeselectGet();
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

# **resetUserPwdApiV1SystemResetPwdPut**
> any resetUserPwdApiV1SystemResetPwdPut()

管理员无需旧密码即可重置指定用户的登录密码。

### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

let userId: number; //目标用户 ID (default to undefined)
let newPassword: string; //新密码 (default to undefined)

const { status, data } = await apiInstance.resetUserPwdApiV1SystemResetPwdPut(
    userId,
    newPassword
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**number**] | 目标用户 ID | defaults to undefined|
| **newPassword** | [**string**] | 新密码 | defaults to undefined|


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

# **updateOwnPasswordApiV1SystemUserProfileUpdatePwdPut**
> any updateOwnPasswordApiV1SystemUserProfileUpdatePwdPut(bodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut)


### Example

```typescript
import {
    SystemApi,
    Configuration,
    BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

let bodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut: BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut; //

const { status, data } = await apiInstance.updateOwnPasswordApiV1SystemUserProfileUpdatePwdPut(
    bodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut** | **BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateUserProfileApiV1SystemUserProfilePut**
> any updateUserProfileApiV1SystemUserProfilePut()


### Example

```typescript
import {
    SystemApi,
    Configuration,
    BodyUpdateUserProfileApiV1SystemUserProfilePut
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

let bodyUpdateUserProfileApiV1SystemUserProfilePut: BodyUpdateUserProfileApiV1SystemUserProfilePut; // (optional)

const { status, data } = await apiInstance.updateUserProfileApiV1SystemUserProfilePut(
    bodyUpdateUserProfileApiV1SystemUserProfilePut
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyUpdateUserProfileApiV1SystemUserProfilePut** | **BodyUpdateUserProfileApiV1SystemUserProfilePut**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **uploadAvatarApiV1SystemUserProfileAvatarPost**
> any uploadAvatarApiV1SystemUserProfileAvatarPost()


### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

let file: File; // (default to undefined)

const { status, data } = await apiInstance.uploadAvatarApiV1SystemUserProfileAvatarPost(
    file
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **file** | [**File**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

