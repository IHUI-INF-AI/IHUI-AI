# SystemAdminApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createConfigApiV1SystemAdminConfigCreatePost**](SystemAdminApi.md#createConfigApiV1SystemAdminConfigCreatePost) | **POST** /api/v1/system/admin/config/create | 新增配置 |
| [**createDeptApiV1SystemAdminDeptCreatePost**](SystemAdminApi.md#createDeptApiV1SystemAdminDeptCreatePost) | **POST** /api/v1/system/admin/dept/create | 创建部门 |
| [**createDictDataApiV1SystemAdminDictDataCreatePost**](SystemAdminApi.md#createDictDataApiV1SystemAdminDictDataCreatePost) | **POST** /api/v1/system/admin/dict/data/create | 新增字典数据 |
| [**createDictTypeApiV1SystemAdminDictTypeCreatePost**](SystemAdminApi.md#createDictTypeApiV1SystemAdminDictTypeCreatePost) | **POST** /api/v1/system/admin/dict/type/create | 新增字典类型 |
| [**createMenuApiV1SystemAdminMenuCreatePost**](SystemAdminApi.md#createMenuApiV1SystemAdminMenuCreatePost) | **POST** /api/v1/system/admin/menu/create | 创建菜单 |
| [**createPostApiV1SystemAdminPostCreatePost**](SystemAdminApi.md#createPostApiV1SystemAdminPostCreatePost) | **POST** /api/v1/system/admin/post/create | 创建岗位 |
| [**createRoleApiV1SystemAdminRoleCreatePost**](SystemAdminApi.md#createRoleApiV1SystemAdminRoleCreatePost) | **POST** /api/v1/system/admin/role/create | 创建角色 |
| [**deleteDeptApiV1SystemAdminDeptDeletePost**](SystemAdminApi.md#deleteDeptApiV1SystemAdminDeptDeletePost) | **POST** /api/v1/system/admin/dept/delete | 删除部门 |
| [**deleteMenuApiV1SystemAdminMenuDeletePost**](SystemAdminApi.md#deleteMenuApiV1SystemAdminMenuDeletePost) | **POST** /api/v1/system/admin/menu/delete | 删除菜单 |
| [**deleteRoleApiV1SystemAdminRoleDeletePost**](SystemAdminApi.md#deleteRoleApiV1SystemAdminRoleDeletePost) | **POST** /api/v1/system/admin/role/delete | 删除角色 |
| [**exportConfigsApiV1SystemAdminConfigExportGet**](SystemAdminApi.md#exportConfigsApiV1SystemAdminConfigExportGet) | **GET** /api/v1/system/admin/config/export | 导出参数配置到Excel |
| [**exportDeptsApiV1SystemAdminDeptExportGet**](SystemAdminApi.md#exportDeptsApiV1SystemAdminDeptExportGet) | **GET** /api/v1/system/admin/dept/export | 导出部门列表到Excel |
| [**exportDictTypesApiV1SystemAdminDictTypeExportGet**](SystemAdminApi.md#exportDictTypesApiV1SystemAdminDictTypeExportGet) | **GET** /api/v1/system/admin/dict/type/export | 导出字典类型到Excel |
| [**exportMenusApiV1SystemAdminMenuExportGet**](SystemAdminApi.md#exportMenusApiV1SystemAdminMenuExportGet) | **GET** /api/v1/system/admin/menu/export | 导出菜单列表到Excel |
| [**exportPostsApiV1SystemAdminPostExportGet**](SystemAdminApi.md#exportPostsApiV1SystemAdminPostExportGet) | **GET** /api/v1/system/admin/post/export | 导出岗位列表到Excel |
| [**exportRolesApiV1SystemAdminRoleExportGet**](SystemAdminApi.md#exportRolesApiV1SystemAdminRoleExportGet) | **GET** /api/v1/system/admin/role/export | 导出角色列表到Excel |
| [**getConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet**](SystemAdminApi.md#getConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet) | **GET** /api/v1/system/admin/config/key/{config_key} | 按 key 查配置 |
| [**getDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet**](SystemAdminApi.md#getDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet) | **GET** /api/v1/system/admin/dict/data/type/{dict_type} | 按字典类型获取数据 (RuoYi 兼容) |
| [**getRoutersApiV1SystemAdminMenuGetRoutersGet**](SystemAdminApi.md#getRoutersApiV1SystemAdminMenuGetRoutersGet) | **GET** /api/v1/system/admin/menu/getRouters | 获取路由菜单树 (RuoYi 兼容) |
| [**listConfigsApiV1SystemAdminConfigListGet**](SystemAdminApi.md#listConfigsApiV1SystemAdminConfigListGet) | **GET** /api/v1/system/admin/config/list | 参数配置列表 |
| [**listDeptsApiV1SystemAdminDeptListGet**](SystemAdminApi.md#listDeptsApiV1SystemAdminDeptListGet) | **GET** /api/v1/system/admin/dept/list | 部门列表 |
| [**listDictDataApiV1SystemAdminDictDataListGet**](SystemAdminApi.md#listDictDataApiV1SystemAdminDictDataListGet) | **GET** /api/v1/system/admin/dict/data/list | 字典数据列表 |
| [**listDictTypesApiV1SystemAdminDictTypeListGet**](SystemAdminApi.md#listDictTypesApiV1SystemAdminDictTypeListGet) | **GET** /api/v1/system/admin/dict/type/list | 字典类型列表 |
| [**listMenusApiV1SystemAdminMenuListGet**](SystemAdminApi.md#listMenusApiV1SystemAdminMenuListGet) | **GET** /api/v1/system/admin/menu/list | 菜单列表 |
| [**listPostsApiV1SystemAdminPostListGet**](SystemAdminApi.md#listPostsApiV1SystemAdminPostListGet) | **GET** /api/v1/system/admin/post/list | 岗位列表 |
| [**listRolesApiV1SystemAdminRoleListGet**](SystemAdminApi.md#listRolesApiV1SystemAdminRoleListGet) | **GET** /api/v1/system/admin/role/list | 角色列表 |
| [**menuTreeselectApiV1SystemAdminMenuTreeselectGet**](SystemAdminApi.md#menuTreeselectApiV1SystemAdminMenuTreeselectGet) | **GET** /api/v1/system/admin/menu/treeselect | 菜单树选择 (RuoYi 兼容) |
| [**roleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet**](SystemAdminApi.md#roleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet) | **GET** /api/v1/system/admin/menu/roleMenuTreeselect/{role_id} | 角色菜单树 |
| [**updateConfigApiV1SystemAdminConfigUpdatePost**](SystemAdminApi.md#updateConfigApiV1SystemAdminConfigUpdatePost) | **POST** /api/v1/system/admin/config/update | 更新配置值 |
| [**updateRoleApiV1SystemAdminRoleUpdatePost**](SystemAdminApi.md#updateRoleApiV1SystemAdminRoleUpdatePost) | **POST** /api/v1/system/admin/role/update | 更新角色 |


<a id="createConfigApiV1SystemAdminConfigCreatePost"></a>
# **createConfigApiV1SystemAdminConfigCreatePost**
> Object createConfigApiV1SystemAdminConfigCreatePost(configName, configKey, configValue, configType)

新增配置

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    String configName = "configName_example"; // String | 
    String configKey = "configKey_example"; // String | 
    String configValue = ""; // String | 
    String configType = "N"; // String | 
    try {
      Object result = apiInstance.createConfigApiV1SystemAdminConfigCreatePost(configName, configKey, configValue, configType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#createConfigApiV1SystemAdminConfigCreatePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **configName** | **String**|  | |
| **configKey** | **String**|  | |
| **configValue** | **String**|  | [optional] [default to ] |
| **configType** | **String**|  | [optional] [default to N] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createDeptApiV1SystemAdminDeptCreatePost"></a>
# **createDeptApiV1SystemAdminDeptCreatePost**
> Object createDeptApiV1SystemAdminDeptCreatePost(deptName, parentId, leader, orderNum)

创建部门

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    String deptName = "deptName_example"; // String | 
    Integer parentId = 0; // Integer | 
    String leader = ""; // String | 
    Integer orderNum = 0; // Integer | 
    try {
      Object result = apiInstance.createDeptApiV1SystemAdminDeptCreatePost(deptName, parentId, leader, orderNum);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#createDeptApiV1SystemAdminDeptCreatePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **deptName** | **String**|  | |
| **parentId** | **Integer**|  | [optional] [default to 0] |
| **leader** | **String**|  | [optional] [default to ] |
| **orderNum** | **Integer**|  | [optional] [default to 0] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createDictDataApiV1SystemAdminDictDataCreatePost"></a>
# **createDictDataApiV1SystemAdminDictDataCreatePost**
> Object createDictDataApiV1SystemAdminDictDataCreatePost(dictType, dictLabel, dictValue, dictSort)

新增字典数据

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    String dictType = "dictType_example"; // String | 
    String dictLabel = "dictLabel_example"; // String | 
    String dictValue = "dictValue_example"; // String | 
    Integer dictSort = 0; // Integer | 
    try {
      Object result = apiInstance.createDictDataApiV1SystemAdminDictDataCreatePost(dictType, dictLabel, dictValue, dictSort);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#createDictDataApiV1SystemAdminDictDataCreatePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **dictType** | **String**|  | |
| **dictLabel** | **String**|  | |
| **dictValue** | **String**|  | |
| **dictSort** | **Integer**|  | [optional] [default to 0] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createDictTypeApiV1SystemAdminDictTypeCreatePost"></a>
# **createDictTypeApiV1SystemAdminDictTypeCreatePost**
> Object createDictTypeApiV1SystemAdminDictTypeCreatePost(dictName, dictType)

新增字典类型

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    String dictName = "dictName_example"; // String | 
    String dictType = "dictType_example"; // String | 字典编码，如 sys_user_sex
    try {
      Object result = apiInstance.createDictTypeApiV1SystemAdminDictTypeCreatePost(dictName, dictType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#createDictTypeApiV1SystemAdminDictTypeCreatePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **dictName** | **String**|  | |
| **dictType** | **String**| 字典编码，如 sys_user_sex | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createMenuApiV1SystemAdminMenuCreatePost"></a>
# **createMenuApiV1SystemAdminMenuCreatePost**
> Object createMenuApiV1SystemAdminMenuCreatePost(menuName, parentId, path, icon, menuType)

创建菜单

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    String menuName = "menuName_example"; // String | 
    Integer parentId = 0; // Integer | 
    String path = ""; // String | 
    String icon = "#"; // String | 
    String menuType = "M"; // String | 
    try {
      Object result = apiInstance.createMenuApiV1SystemAdminMenuCreatePost(menuName, parentId, path, icon, menuType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#createMenuApiV1SystemAdminMenuCreatePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **menuName** | **String**|  | |
| **parentId** | **Integer**|  | [optional] [default to 0] |
| **path** | **String**|  | [optional] [default to ] |
| **icon** | **String**|  | [optional] [default to #] |
| **menuType** | **String**|  | [optional] [default to M] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createPostApiV1SystemAdminPostCreatePost"></a>
# **createPostApiV1SystemAdminPostCreatePost**
> Object createPostApiV1SystemAdminPostCreatePost(postCode, postName, postSort)

创建岗位

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    String postCode = "postCode_example"; // String | 
    String postName = "postName_example"; // String | 
    Integer postSort = 0; // Integer | 
    try {
      Object result = apiInstance.createPostApiV1SystemAdminPostCreatePost(postCode, postName, postSort);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#createPostApiV1SystemAdminPostCreatePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **postCode** | **String**|  | |
| **postName** | **String**|  | |
| **postSort** | **Integer**|  | [optional] [default to 0] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createRoleApiV1SystemAdminRoleCreatePost"></a>
# **createRoleApiV1SystemAdminRoleCreatePost**
> Object createRoleApiV1SystemAdminRoleCreatePost(roleName, roleKey, roleSort)

创建角色

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    String roleName = "roleName_example"; // String | 
    String roleKey = "roleKey_example"; // String | 
    Integer roleSort = 0; // Integer | 
    try {
      Object result = apiInstance.createRoleApiV1SystemAdminRoleCreatePost(roleName, roleKey, roleSort);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#createRoleApiV1SystemAdminRoleCreatePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **roleName** | **String**|  | |
| **roleKey** | **String**|  | |
| **roleSort** | **Integer**|  | [optional] [default to 0] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="deleteDeptApiV1SystemAdminDeptDeletePost"></a>
# **deleteDeptApiV1SystemAdminDeptDeletePost**
> Object deleteDeptApiV1SystemAdminDeptDeletePost(deptId)

删除部门

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    Integer deptId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteDeptApiV1SystemAdminDeptDeletePost(deptId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#deleteDeptApiV1SystemAdminDeptDeletePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **deptId** | **Integer**|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="deleteMenuApiV1SystemAdminMenuDeletePost"></a>
# **deleteMenuApiV1SystemAdminMenuDeletePost**
> Object deleteMenuApiV1SystemAdminMenuDeletePost(menuId)

删除菜单

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    Integer menuId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteMenuApiV1SystemAdminMenuDeletePost(menuId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#deleteMenuApiV1SystemAdminMenuDeletePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **menuId** | **Integer**|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="deleteRoleApiV1SystemAdminRoleDeletePost"></a>
# **deleteRoleApiV1SystemAdminRoleDeletePost**
> Object deleteRoleApiV1SystemAdminRoleDeletePost(roleId)

删除角色

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    Integer roleId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteRoleApiV1SystemAdminRoleDeletePost(roleId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#deleteRoleApiV1SystemAdminRoleDeletePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **roleId** | **Integer**|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="exportConfigsApiV1SystemAdminConfigExportGet"></a>
# **exportConfigsApiV1SystemAdminConfigExportGet**
> Object exportConfigsApiV1SystemAdminConfigExportGet()

导出参数配置到Excel

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    try {
      Object result = apiInstance.exportConfigsApiV1SystemAdminConfigExportGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#exportConfigsApiV1SystemAdminConfigExportGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="exportDeptsApiV1SystemAdminDeptExportGet"></a>
# **exportDeptsApiV1SystemAdminDeptExportGet**
> Object exportDeptsApiV1SystemAdminDeptExportGet()

导出部门列表到Excel

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    try {
      Object result = apiInstance.exportDeptsApiV1SystemAdminDeptExportGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#exportDeptsApiV1SystemAdminDeptExportGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="exportDictTypesApiV1SystemAdminDictTypeExportGet"></a>
# **exportDictTypesApiV1SystemAdminDictTypeExportGet**
> Object exportDictTypesApiV1SystemAdminDictTypeExportGet()

导出字典类型到Excel

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    try {
      Object result = apiInstance.exportDictTypesApiV1SystemAdminDictTypeExportGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#exportDictTypesApiV1SystemAdminDictTypeExportGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="exportMenusApiV1SystemAdminMenuExportGet"></a>
# **exportMenusApiV1SystemAdminMenuExportGet**
> Object exportMenusApiV1SystemAdminMenuExportGet()

导出菜单列表到Excel

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    try {
      Object result = apiInstance.exportMenusApiV1SystemAdminMenuExportGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#exportMenusApiV1SystemAdminMenuExportGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="exportPostsApiV1SystemAdminPostExportGet"></a>
# **exportPostsApiV1SystemAdminPostExportGet**
> Object exportPostsApiV1SystemAdminPostExportGet()

导出岗位列表到Excel

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    try {
      Object result = apiInstance.exportPostsApiV1SystemAdminPostExportGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#exportPostsApiV1SystemAdminPostExportGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="exportRolesApiV1SystemAdminRoleExportGet"></a>
# **exportRolesApiV1SystemAdminRoleExportGet**
> Object exportRolesApiV1SystemAdminRoleExportGet()

导出角色列表到Excel

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    try {
      Object result = apiInstance.exportRolesApiV1SystemAdminRoleExportGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#exportRolesApiV1SystemAdminRoleExportGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="getConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet"></a>
# **getConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet**
> Object getConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet(configKey)

按 key 查配置

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    String configKey = "configKey_example"; // String | 
    try {
      Object result = apiInstance.getConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet(configKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#getConfigByKeyApiV1SystemAdminConfigKeyConfigKeyGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **configKey** | **String**|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="getDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet"></a>
# **getDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet**
> Object getDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet(dictType)

按字典类型获取数据 (RuoYi 兼容)

前端 /system/dict/data/type/{dict_type} 调用此端点.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    String dictType = "dictType_example"; // String | 
    try {
      Object result = apiInstance.getDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet(dictType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#getDictDataByTypeApiV1SystemAdminDictDataTypeDictTypeGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **dictType** | **String**|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="getRoutersApiV1SystemAdminMenuGetRoutersGet"></a>
# **getRoutersApiV1SystemAdminMenuGetRoutersGet**
> Object getRoutersApiV1SystemAdminMenuGetRoutersGet()

获取路由菜单树 (RuoYi 兼容)

返回前端路由所需的菜单树结构。RuoYi 前端调用 /system/menu/getRouters。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    try {
      Object result = apiInstance.getRoutersApiV1SystemAdminMenuGetRoutersGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#getRoutersApiV1SystemAdminMenuGetRoutersGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="listConfigsApiV1SystemAdminConfigListGet"></a>
# **listConfigsApiV1SystemAdminConfigListGet**
> Object listConfigsApiV1SystemAdminConfigListGet(page, limit, configKey)

参数配置列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 50; // Integer | 
    String configKey = "configKey_example"; // String | 
    try {
      Object result = apiInstance.listConfigsApiV1SystemAdminConfigListGet(page, limit, configKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#listConfigsApiV1SystemAdminConfigListGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 50] |
| **configKey** | **String**|  | [optional] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listDeptsApiV1SystemAdminDeptListGet"></a>
# **listDeptsApiV1SystemAdminDeptListGet**
> Object listDeptsApiV1SystemAdminDeptListGet(page, limit, deptName)

部门列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 50; // Integer | 
    String deptName = "deptName_example"; // String | 
    try {
      Object result = apiInstance.listDeptsApiV1SystemAdminDeptListGet(page, limit, deptName);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#listDeptsApiV1SystemAdminDeptListGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 50] |
| **deptName** | **String**|  | [optional] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listDictDataApiV1SystemAdminDictDataListGet"></a>
# **listDictDataApiV1SystemAdminDictDataListGet**
> Object listDictDataApiV1SystemAdminDictDataListGet(dictType, page, limit)

字典数据列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    String dictType = "dictType_example"; // String | 字典编码
    Integer page = 1; // Integer | 
    Integer limit = 100; // Integer | 
    try {
      Object result = apiInstance.listDictDataApiV1SystemAdminDictDataListGet(dictType, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#listDictDataApiV1SystemAdminDictDataListGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **dictType** | **String**| 字典编码 | |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 100] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listDictTypesApiV1SystemAdminDictTypeListGet"></a>
# **listDictTypesApiV1SystemAdminDictTypeListGet**
> Object listDictTypesApiV1SystemAdminDictTypeListGet(page, limit)

字典类型列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 50; // Integer | 
    try {
      Object result = apiInstance.listDictTypesApiV1SystemAdminDictTypeListGet(page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#listDictTypesApiV1SystemAdminDictTypeListGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 50] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listMenusApiV1SystemAdminMenuListGet"></a>
# **listMenusApiV1SystemAdminMenuListGet**
> Object listMenusApiV1SystemAdminMenuListGet(page, limit, menuName)

菜单列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 50; // Integer | 
    String menuName = "menuName_example"; // String | 
    try {
      Object result = apiInstance.listMenusApiV1SystemAdminMenuListGet(page, limit, menuName);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#listMenusApiV1SystemAdminMenuListGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 50] |
| **menuName** | **String**|  | [optional] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listPostsApiV1SystemAdminPostListGet"></a>
# **listPostsApiV1SystemAdminPostListGet**
> Object listPostsApiV1SystemAdminPostListGet(page, limit)

岗位列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 50; // Integer | 
    try {
      Object result = apiInstance.listPostsApiV1SystemAdminPostListGet(page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#listPostsApiV1SystemAdminPostListGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 50] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listRolesApiV1SystemAdminRoleListGet"></a>
# **listRolesApiV1SystemAdminRoleListGet**
> Object listRolesApiV1SystemAdminRoleListGet(page, limit, roleName)

角色列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String roleName = "roleName_example"; // String | 
    try {
      Object result = apiInstance.listRolesApiV1SystemAdminRoleListGet(page, limit, roleName);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#listRolesApiV1SystemAdminRoleListGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **roleName** | **String**|  | [optional] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="menuTreeselectApiV1SystemAdminMenuTreeselectGet"></a>
# **menuTreeselectApiV1SystemAdminMenuTreeselectGet**
> Object menuTreeselectApiV1SystemAdminMenuTreeselectGet()

菜单树选择 (RuoYi 兼容)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    try {
      Object result = apiInstance.menuTreeselectApiV1SystemAdminMenuTreeselectGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#menuTreeselectApiV1SystemAdminMenuTreeselectGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="roleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet"></a>
# **roleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet**
> Object roleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet(roleId)

角色菜单树

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    Integer roleId = 56; // Integer | 
    try {
      Object result = apiInstance.roleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet(roleId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#roleMenuTreeselectApiV1SystemAdminMenuRoleMenuTreeselectRoleIdGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **roleId** | **Integer**|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="updateConfigApiV1SystemAdminConfigUpdatePost"></a>
# **updateConfigApiV1SystemAdminConfigUpdatePost**
> Object updateConfigApiV1SystemAdminConfigUpdatePost(configId, configValue)

更新配置值

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    Integer configId = 56; // Integer | 
    String configValue = "configValue_example"; // String | 
    try {
      Object result = apiInstance.updateConfigApiV1SystemAdminConfigUpdatePost(configId, configValue);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#updateConfigApiV1SystemAdminConfigUpdatePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **configId** | **Integer**|  | |
| **configValue** | **String**|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="updateRoleApiV1SystemAdminRoleUpdatePost"></a>
# **updateRoleApiV1SystemAdminRoleUpdatePost**
> Object updateRoleApiV1SystemAdminRoleUpdatePost(roleId, roleName, roleSort)

更新角色

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAdminApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAdminApi apiInstance = new SystemAdminApi(defaultClient);
    Integer roleId = 56; // Integer | 
    String roleName = "roleName_example"; // String | 
    Integer roleSort = 56; // Integer | 
    try {
      Object result = apiInstance.updateRoleApiV1SystemAdminRoleUpdatePost(roleId, roleName, roleSort);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAdminApi#updateRoleApiV1SystemAdminRoleUpdatePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **roleId** | **Integer**|  | |
| **roleName** | **String**|  | [optional] |
| **roleSort** | **Integer**|  | [optional] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

