# SystemApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**adminLoginApiV1SystemLoginPost**](SystemApi.md#adminloginapiv1systemloginpost) | **POST** /api/v1/system/login | Admin login |
| [**changeUserStatusApiV1SystemChangeStatusPut**](SystemApi.md#changeuserstatusapiv1systemchangestatusput) | **PUT** /api/v1/system/changeStatus | 启用 / 禁用用户 |
| [**exportUsersApiV1SystemUserExportGet**](SystemApi.md#exportusersapiv1systemuserexportget) | **GET** /api/v1/system/user/export | 导出用户列表到Excel |
| [**getDictApiV1SystemDictDictTypeGet**](SystemApi.md#getdictapiv1systemdictdicttypeget) | **GET** /api/v1/system/dict/{dict_type} | Get dictionary data |
| [**getDictDataByTypeApiV1SystemDictDataTypeDictTypeGet**](SystemApi.md#getdictdatabytypeapiv1systemdictdatatypedicttypeget) | **GET** /api/v1/system/dict/data/type/{dict_type} | 按字典类型获取数据 |
| [**getLoginUserInfoAliasApiV1SystemUserGetInfoGet**](SystemApi.md#getloginuserinfoaliasapiv1systemusergetinfoget) | **GET** /api/v1/system/user/getInfo | 获取当前登录用户信息 (别名) |
| [**getLoginUserInfoApiV1SystemGetInfoGet**](SystemApi.md#getloginuserinfoapiv1systemgetinfoget) | **GET** /api/v1/system/getInfo | 获取当前登录用户信息(含角色与权限) |
| [**getRoutersApiV1SystemMenuGetRoutersGet**](SystemApi.md#getroutersapiv1systemmenugetroutersget) | **GET** /api/v1/system/menu/getRouters | 获取路由菜单树 (RuoYi 兼容) |
| [**getUserProfileApiV1SystemUserProfileGet**](SystemApi.md#getuserprofileapiv1systemuserprofileget) | **GET** /api/v1/system/user/profile | 获取个人详细资料 |
| [**listConfigsApiV1SystemConfigListGet**](SystemApi.md#listconfigsapiv1systemconfiglistget) | **GET** /api/v1/system/config/list | List system configs |
| [**listDeptsApiV1SystemDeptListGet**](SystemApi.md#listdeptsapiv1systemdeptlistget) | **GET** /api/v1/system/dept/list | 部门列表 |
| [**listDictDataApiV1SystemDictDataListGet**](SystemApi.md#listdictdataapiv1systemdictdatalistget) | **GET** /api/v1/system/dict/data/list | 字典数据列表 |
| [**listDictTypesApiV1SystemDictTypeListGet**](SystemApi.md#listdicttypesapiv1systemdicttypelistget) | **GET** /api/v1/system/dict/type/list | 字典类型列表 |
| [**listMenusApiV1SystemMenuListGet**](SystemApi.md#listmenusapiv1systemmenulistget) | **GET** /api/v1/system/menu/list | List menus |
| [**listPostsApiV1SystemPostListGet**](SystemApi.md#listpostsapiv1systempostlistget) | **GET** /api/v1/system/post/list | 岗位列表 |
| [**listRolesApiV1SystemRoleListGet**](SystemApi.md#listrolesapiv1systemrolelistget) | **GET** /api/v1/system/role/list | List roles |
| [**listSysUsersApiV1SystemUserListGet**](SystemApi.md#listsysusersapiv1systemuserlistget) | **GET** /api/v1/system/user/list | List system users |
| [**menuTreeselectApiV1SystemMenuTreeselectGet**](SystemApi.md#menutreeselectapiv1systemmenutreeselectget) | **GET** /api/v1/system/menu/treeselect | 菜单树选择 |
| [**resetUserPwdApiV1SystemResetPwdPut**](SystemApi.md#resetuserpwdapiv1systemresetpwdput) | **PUT** /api/v1/system/resetPwd | 管理员重置用户密码 |
| [**updateOwnPasswordApiV1SystemUserProfileUpdatePwdPut**](SystemApi.md#updateownpasswordapiv1systemuserprofileupdatepwdput) | **PUT** /api/v1/system/user/profile/updatePwd | 修改个人密码 |
| [**updateUserProfileApiV1SystemUserProfilePut**](SystemApi.md#updateuserprofileapiv1systemuserprofileput) | **PUT** /api/v1/system/user/profile | 修改个人信息 |
| [**uploadAvatarApiV1SystemUserProfileAvatarPost**](SystemApi.md#uploadavatarapiv1systemuserprofileavatarpost) | **POST** /api/v1/system/user/profile/avatar | 上传头像 |



## adminLoginApiV1SystemLoginPost

> any adminLoginApiV1SystemLoginPost(username, password)

Admin login

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { AdminLoginApiV1SystemLoginPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SystemApi();

  const body = {
    // string
    username: username_example,
    // string
    password: password_example,
  } satisfies AdminLoginApiV1SystemLoginPostRequest;

  try {
    const data = await api.adminLoginApiV1SystemLoginPost(body);
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
| **username** | `string` |  | [Defaults to `undefined`] |
| **password** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## changeUserStatusApiV1SystemChangeStatusPut

> any changeUserStatusApiV1SystemChangeStatusPut(userId, status)

启用 / 禁用用户

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { ChangeUserStatusApiV1SystemChangeStatusPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  const body = {
    // number | 目标用户 ID
    userId: 56,
    // string | 0=正常 1=停用
    status: status_example,
  } satisfies ChangeUserStatusApiV1SystemChangeStatusPutRequest;

  try {
    const data = await api.changeUserStatusApiV1SystemChangeStatusPut(body);
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
| **userId** | `number` | 目标用户 ID | [Defaults to `undefined`] |
| **status** | `string` | 0&#x3D;正常 1&#x3D;停用 | [Defaults to `undefined`] |

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


## exportUsersApiV1SystemUserExportGet

> any exportUsersApiV1SystemUserExportGet()

导出用户列表到Excel

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { ExportUsersApiV1SystemUserExportGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  try {
    const data = await api.exportUsersApiV1SystemUserExportGet();
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


## getDictApiV1SystemDictDictTypeGet

> any getDictApiV1SystemDictDictTypeGet(dictType)

Get dictionary data

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { GetDictApiV1SystemDictDictTypeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SystemApi();

  const body = {
    // string
    dictType: dictType_example,
  } satisfies GetDictApiV1SystemDictDictTypeGetRequest;

  try {
    const data = await api.getDictApiV1SystemDictDictTypeGet(body);
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

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getDictDataByTypeApiV1SystemDictDataTypeDictTypeGet

> any getDictDataByTypeApiV1SystemDictDataTypeDictTypeGet(dictType)

按字典类型获取数据

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { GetDictDataByTypeApiV1SystemDictDataTypeDictTypeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  const body = {
    // string
    dictType: dictType_example,
  } satisfies GetDictDataByTypeApiV1SystemDictDataTypeDictTypeGetRequest;

  try {
    const data = await api.getDictDataByTypeApiV1SystemDictDataTypeDictTypeGet(body);
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


## getLoginUserInfoAliasApiV1SystemUserGetInfoGet

> any getLoginUserInfoAliasApiV1SystemUserGetInfoGet()

获取当前登录用户信息 (别名)

前端调用 /system/user/getInfo 的别名，复用 /getInfo 逻辑。

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { GetLoginUserInfoAliasApiV1SystemUserGetInfoGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  try {
    const data = await api.getLoginUserInfoAliasApiV1SystemUserGetInfoGet();
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


## getLoginUserInfoApiV1SystemGetInfoGet

> any getLoginUserInfoApiV1SystemGetInfoGet()

获取当前登录用户信息(含角色与权限)

替代前端 mock，从数据库实时查询当前用户的角色和权限。

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { GetLoginUserInfoApiV1SystemGetInfoGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  try {
    const data = await api.getLoginUserInfoApiV1SystemGetInfoGet();
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


## getRoutersApiV1SystemMenuGetRoutersGet

> any getRoutersApiV1SystemMenuGetRoutersGet()

获取路由菜单树 (RuoYi 兼容)

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { GetRoutersApiV1SystemMenuGetRoutersGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  try {
    const data = await api.getRoutersApiV1SystemMenuGetRoutersGet();
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


## getUserProfileApiV1SystemUserProfileGet

> any getUserProfileApiV1SystemUserProfileGet()

获取个人详细资料

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { GetUserProfileApiV1SystemUserProfileGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  try {
    const data = await api.getUserProfileApiV1SystemUserProfileGet();
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


## listConfigsApiV1SystemConfigListGet

> any listConfigsApiV1SystemConfigListGet()

List system configs

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { ListConfigsApiV1SystemConfigListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  try {
    const data = await api.listConfigsApiV1SystemConfigListGet();
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


## listDeptsApiV1SystemDeptListGet

> any listDeptsApiV1SystemDeptListGet()

部门列表

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { ListDeptsApiV1SystemDeptListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  try {
    const data = await api.listDeptsApiV1SystemDeptListGet();
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


## listDictDataApiV1SystemDictDataListGet

> any listDictDataApiV1SystemDictDataListGet(dictType)

字典数据列表

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { ListDictDataApiV1SystemDictDataListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  const body = {
    // string
    dictType: dictType_example,
  } satisfies ListDictDataApiV1SystemDictDataListGetRequest;

  try {
    const data = await api.listDictDataApiV1SystemDictDataListGet(body);
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


## listDictTypesApiV1SystemDictTypeListGet

> any listDictTypesApiV1SystemDictTypeListGet()

字典类型列表

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { ListDictTypesApiV1SystemDictTypeListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  try {
    const data = await api.listDictTypesApiV1SystemDictTypeListGet();
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


## listMenusApiV1SystemMenuListGet

> any listMenusApiV1SystemMenuListGet()

List menus

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { ListMenusApiV1SystemMenuListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  try {
    const data = await api.listMenusApiV1SystemMenuListGet();
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


## listPostsApiV1SystemPostListGet

> any listPostsApiV1SystemPostListGet()

岗位列表

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { ListPostsApiV1SystemPostListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  try {
    const data = await api.listPostsApiV1SystemPostListGet();
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


## listRolesApiV1SystemRoleListGet

> any listRolesApiV1SystemRoleListGet()

List roles

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { ListRolesApiV1SystemRoleListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  try {
    const data = await api.listRolesApiV1SystemRoleListGet();
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


## listSysUsersApiV1SystemUserListGet

> any listSysUsersApiV1SystemUserListGet(page, limit)

List system users

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { ListSysUsersApiV1SystemUserListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListSysUsersApiV1SystemUserListGetRequest;

  try {
    const data = await api.listSysUsersApiV1SystemUserListGet(body);
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


## menuTreeselectApiV1SystemMenuTreeselectGet

> any menuTreeselectApiV1SystemMenuTreeselectGet()

菜单树选择

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { MenuTreeselectApiV1SystemMenuTreeselectGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  try {
    const data = await api.menuTreeselectApiV1SystemMenuTreeselectGet();
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


## resetUserPwdApiV1SystemResetPwdPut

> any resetUserPwdApiV1SystemResetPwdPut(userId, newPassword)

管理员重置用户密码

管理员无需旧密码即可重置指定用户的登录密码。

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { ResetUserPwdApiV1SystemResetPwdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  const body = {
    // number | 目标用户 ID
    userId: 56,
    // string | 新密码
    newPassword: newPassword_example,
  } satisfies ResetUserPwdApiV1SystemResetPwdPutRequest;

  try {
    const data = await api.resetUserPwdApiV1SystemResetPwdPut(body);
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
| **userId** | `number` | 目标用户 ID | [Defaults to `undefined`] |
| **newPassword** | `string` | 新密码 | [Defaults to `undefined`] |

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


## updateOwnPasswordApiV1SystemUserProfileUpdatePwdPut

> any updateOwnPasswordApiV1SystemUserProfileUpdatePwdPut(bodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut)

修改个人密码

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { UpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  const body = {
    // BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut
    bodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut: ...,
  } satisfies UpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPutRequest;

  try {
    const data = await api.updateOwnPasswordApiV1SystemUserProfileUpdatePwdPut(body);
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
| **bodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut** | [BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut](BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateUserProfileApiV1SystemUserProfilePut

> any updateUserProfileApiV1SystemUserProfilePut(bodyUpdateUserProfileApiV1SystemUserProfilePut)

修改个人信息

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { UpdateUserProfileApiV1SystemUserProfilePutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  const body = {
    // BodyUpdateUserProfileApiV1SystemUserProfilePut (optional)
    bodyUpdateUserProfileApiV1SystemUserProfilePut: ...,
  } satisfies UpdateUserProfileApiV1SystemUserProfilePutRequest;

  try {
    const data = await api.updateUserProfileApiV1SystemUserProfilePut(body);
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
| **bodyUpdateUserProfileApiV1SystemUserProfilePut** | [BodyUpdateUserProfileApiV1SystemUserProfilePut](BodyUpdateUserProfileApiV1SystemUserProfilePut.md) |  | [Optional] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## uploadAvatarApiV1SystemUserProfileAvatarPost

> any uploadAvatarApiV1SystemUserProfileAvatarPost(file)

上传头像

### Example

```ts
import {
  Configuration,
  SystemApi,
} from '';
import type { UploadAvatarApiV1SystemUserProfileAvatarPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemApi(config);

  const body = {
    // Blob
    file: BINARY_DATA_HERE,
  } satisfies UploadAvatarApiV1SystemUserProfileAvatarPostRequest;

  try {
    const data = await api.uploadAvatarApiV1SystemUserProfileAvatarPost(body);
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
| **file** | `Blob` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

