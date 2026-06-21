# SystemApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**adminLoginApiV1SystemLoginPost**](SystemApi.md#adminLoginApiV1SystemLoginPost) | **POST** /api/v1/system/login | Admin login |
| [**changeUserStatusApiV1SystemChangeStatusPut**](SystemApi.md#changeUserStatusApiV1SystemChangeStatusPut) | **PUT** /api/v1/system/changeStatus | 启用 / 禁用用户 |
| [**exportUsersApiV1SystemUserExportGet**](SystemApi.md#exportUsersApiV1SystemUserExportGet) | **GET** /api/v1/system/user/export | 导出用户列表到Excel |
| [**getDictApiV1SystemDictDictTypeGet**](SystemApi.md#getDictApiV1SystemDictDictTypeGet) | **GET** /api/v1/system/dict/{dict_type} | Get dictionary data |
| [**getDictDataByTypeApiV1SystemDictDataTypeDictTypeGet**](SystemApi.md#getDictDataByTypeApiV1SystemDictDataTypeDictTypeGet) | **GET** /api/v1/system/dict/data/type/{dict_type} | 按字典类型获取数据 |
| [**getLoginUserInfoAliasApiV1SystemUserGetInfoGet**](SystemApi.md#getLoginUserInfoAliasApiV1SystemUserGetInfoGet) | **GET** /api/v1/system/user/getInfo | 获取当前登录用户信息 (别名) |
| [**getLoginUserInfoApiV1SystemGetInfoGet**](SystemApi.md#getLoginUserInfoApiV1SystemGetInfoGet) | **GET** /api/v1/system/getInfo | 获取当前登录用户信息(含角色与权限) |
| [**getRoutersApiV1SystemMenuGetRoutersGet**](SystemApi.md#getRoutersApiV1SystemMenuGetRoutersGet) | **GET** /api/v1/system/menu/getRouters | 获取路由菜单树 (RuoYi 兼容) |
| [**getUserProfileApiV1SystemUserProfileGet**](SystemApi.md#getUserProfileApiV1SystemUserProfileGet) | **GET** /api/v1/system/user/profile | 获取个人详细资料 |
| [**listConfigsApiV1SystemConfigListGet**](SystemApi.md#listConfigsApiV1SystemConfigListGet) | **GET** /api/v1/system/config/list | List system configs |
| [**listDeptsApiV1SystemDeptListGet**](SystemApi.md#listDeptsApiV1SystemDeptListGet) | **GET** /api/v1/system/dept/list | 部门列表 |
| [**listDictDataApiV1SystemDictDataListGet**](SystemApi.md#listDictDataApiV1SystemDictDataListGet) | **GET** /api/v1/system/dict/data/list | 字典数据列表 |
| [**listDictTypesApiV1SystemDictTypeListGet**](SystemApi.md#listDictTypesApiV1SystemDictTypeListGet) | **GET** /api/v1/system/dict/type/list | 字典类型列表 |
| [**listMenusApiV1SystemMenuListGet**](SystemApi.md#listMenusApiV1SystemMenuListGet) | **GET** /api/v1/system/menu/list | List menus |
| [**listPostsApiV1SystemPostListGet**](SystemApi.md#listPostsApiV1SystemPostListGet) | **GET** /api/v1/system/post/list | 岗位列表 |
| [**listRolesApiV1SystemRoleListGet**](SystemApi.md#listRolesApiV1SystemRoleListGet) | **GET** /api/v1/system/role/list | List roles |
| [**listSysUsersApiV1SystemUserListGet**](SystemApi.md#listSysUsersApiV1SystemUserListGet) | **GET** /api/v1/system/user/list | List system users |
| [**menuTreeselectApiV1SystemMenuTreeselectGet**](SystemApi.md#menuTreeselectApiV1SystemMenuTreeselectGet) | **GET** /api/v1/system/menu/treeselect | 菜单树选择 |
| [**resetUserPwdApiV1SystemResetPwdPut**](SystemApi.md#resetUserPwdApiV1SystemResetPwdPut) | **PUT** /api/v1/system/resetPwd | 管理员重置用户密码 |
| [**updateOwnPasswordApiV1SystemUserProfileUpdatePwdPut**](SystemApi.md#updateOwnPasswordApiV1SystemUserProfileUpdatePwdPut) | **PUT** /api/v1/system/user/profile/updatePwd | 修改个人密码 |
| [**updateUserProfileApiV1SystemUserProfilePut**](SystemApi.md#updateUserProfileApiV1SystemUserProfilePut) | **PUT** /api/v1/system/user/profile | 修改个人信息 |
| [**uploadAvatarApiV1SystemUserProfileAvatarPost**](SystemApi.md#uploadAvatarApiV1SystemUserProfileAvatarPost) | **POST** /api/v1/system/user/profile/avatar | 上传头像 |


<a id="adminLoginApiV1SystemLoginPost"></a>
# **adminLoginApiV1SystemLoginPost**
> Object adminLoginApiV1SystemLoginPost(username, password)

Admin login

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SystemApi apiInstance = new SystemApi(defaultClient);
    String username = "username_example"; // String | 
    String password = "password_example"; // String | 
    try {
      Object result = apiInstance.adminLoginApiV1SystemLoginPost(username, password);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#adminLoginApiV1SystemLoginPost");
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
| **username** | **String**|  | |
| **password** | **String**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="changeUserStatusApiV1SystemChangeStatusPut"></a>
# **changeUserStatusApiV1SystemChangeStatusPut**
> Object changeUserStatusApiV1SystemChangeStatusPut(userId, status)

启用 / 禁用用户

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    Integer userId = 56; // Integer | 目标用户 ID
    String status = "status_example"; // String | 0=正常 1=停用
    try {
      Object result = apiInstance.changeUserStatusApiV1SystemChangeStatusPut(userId, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#changeUserStatusApiV1SystemChangeStatusPut");
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
| **userId** | **Integer**| 目标用户 ID | |
| **status** | **String**| 0&#x3D;正常 1&#x3D;停用 | |

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

<a id="exportUsersApiV1SystemUserExportGet"></a>
# **exportUsersApiV1SystemUserExportGet**
> Object exportUsersApiV1SystemUserExportGet()

导出用户列表到Excel

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    try {
      Object result = apiInstance.exportUsersApiV1SystemUserExportGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#exportUsersApiV1SystemUserExportGet");
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

<a id="getDictApiV1SystemDictDictTypeGet"></a>
# **getDictApiV1SystemDictDictTypeGet**
> Object getDictApiV1SystemDictDictTypeGet(dictType)

Get dictionary data

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SystemApi apiInstance = new SystemApi(defaultClient);
    String dictType = "dictType_example"; // String | 
    try {
      Object result = apiInstance.getDictApiV1SystemDictDictTypeGet(dictType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#getDictApiV1SystemDictDictTypeGet");
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

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="getDictDataByTypeApiV1SystemDictDataTypeDictTypeGet"></a>
# **getDictDataByTypeApiV1SystemDictDataTypeDictTypeGet**
> Object getDictDataByTypeApiV1SystemDictDataTypeDictTypeGet(dictType)

按字典类型获取数据

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    String dictType = "dictType_example"; // String | 
    try {
      Object result = apiInstance.getDictDataByTypeApiV1SystemDictDataTypeDictTypeGet(dictType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#getDictDataByTypeApiV1SystemDictDataTypeDictTypeGet");
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

<a id="getLoginUserInfoAliasApiV1SystemUserGetInfoGet"></a>
# **getLoginUserInfoAliasApiV1SystemUserGetInfoGet**
> Object getLoginUserInfoAliasApiV1SystemUserGetInfoGet()

获取当前登录用户信息 (别名)

前端调用 /system/user/getInfo 的别名，复用 /getInfo 逻辑。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    try {
      Object result = apiInstance.getLoginUserInfoAliasApiV1SystemUserGetInfoGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#getLoginUserInfoAliasApiV1SystemUserGetInfoGet");
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

<a id="getLoginUserInfoApiV1SystemGetInfoGet"></a>
# **getLoginUserInfoApiV1SystemGetInfoGet**
> Object getLoginUserInfoApiV1SystemGetInfoGet()

获取当前登录用户信息(含角色与权限)

替代前端 mock，从数据库实时查询当前用户的角色和权限。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    try {
      Object result = apiInstance.getLoginUserInfoApiV1SystemGetInfoGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#getLoginUserInfoApiV1SystemGetInfoGet");
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

<a id="getRoutersApiV1SystemMenuGetRoutersGet"></a>
# **getRoutersApiV1SystemMenuGetRoutersGet**
> Object getRoutersApiV1SystemMenuGetRoutersGet()

获取路由菜单树 (RuoYi 兼容)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    try {
      Object result = apiInstance.getRoutersApiV1SystemMenuGetRoutersGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#getRoutersApiV1SystemMenuGetRoutersGet");
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

<a id="getUserProfileApiV1SystemUserProfileGet"></a>
# **getUserProfileApiV1SystemUserProfileGet**
> Object getUserProfileApiV1SystemUserProfileGet()

获取个人详细资料

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    try {
      Object result = apiInstance.getUserProfileApiV1SystemUserProfileGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#getUserProfileApiV1SystemUserProfileGet");
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

<a id="listConfigsApiV1SystemConfigListGet"></a>
# **listConfigsApiV1SystemConfigListGet**
> Object listConfigsApiV1SystemConfigListGet()

List system configs

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    try {
      Object result = apiInstance.listConfigsApiV1SystemConfigListGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#listConfigsApiV1SystemConfigListGet");
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

<a id="listDeptsApiV1SystemDeptListGet"></a>
# **listDeptsApiV1SystemDeptListGet**
> Object listDeptsApiV1SystemDeptListGet()

部门列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    try {
      Object result = apiInstance.listDeptsApiV1SystemDeptListGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#listDeptsApiV1SystemDeptListGet");
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

<a id="listDictDataApiV1SystemDictDataListGet"></a>
# **listDictDataApiV1SystemDictDataListGet**
> Object listDictDataApiV1SystemDictDataListGet(dictType)

字典数据列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    String dictType = "dictType_example"; // String | 
    try {
      Object result = apiInstance.listDictDataApiV1SystemDictDataListGet(dictType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#listDictDataApiV1SystemDictDataListGet");
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

<a id="listDictTypesApiV1SystemDictTypeListGet"></a>
# **listDictTypesApiV1SystemDictTypeListGet**
> Object listDictTypesApiV1SystemDictTypeListGet()

字典类型列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    try {
      Object result = apiInstance.listDictTypesApiV1SystemDictTypeListGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#listDictTypesApiV1SystemDictTypeListGet");
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

<a id="listMenusApiV1SystemMenuListGet"></a>
# **listMenusApiV1SystemMenuListGet**
> Object listMenusApiV1SystemMenuListGet()

List menus

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    try {
      Object result = apiInstance.listMenusApiV1SystemMenuListGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#listMenusApiV1SystemMenuListGet");
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

<a id="listPostsApiV1SystemPostListGet"></a>
# **listPostsApiV1SystemPostListGet**
> Object listPostsApiV1SystemPostListGet()

岗位列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    try {
      Object result = apiInstance.listPostsApiV1SystemPostListGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#listPostsApiV1SystemPostListGet");
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

<a id="listRolesApiV1SystemRoleListGet"></a>
# **listRolesApiV1SystemRoleListGet**
> Object listRolesApiV1SystemRoleListGet()

List roles

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    try {
      Object result = apiInstance.listRolesApiV1SystemRoleListGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#listRolesApiV1SystemRoleListGet");
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

<a id="listSysUsersApiV1SystemUserListGet"></a>
# **listSysUsersApiV1SystemUserListGet**
> Object listSysUsersApiV1SystemUserListGet(page, limit)

List system users

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listSysUsersApiV1SystemUserListGet(page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#listSysUsersApiV1SystemUserListGet");
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

<a id="menuTreeselectApiV1SystemMenuTreeselectGet"></a>
# **menuTreeselectApiV1SystemMenuTreeselectGet**
> Object menuTreeselectApiV1SystemMenuTreeselectGet()

菜单树选择

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    try {
      Object result = apiInstance.menuTreeselectApiV1SystemMenuTreeselectGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#menuTreeselectApiV1SystemMenuTreeselectGet");
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

<a id="resetUserPwdApiV1SystemResetPwdPut"></a>
# **resetUserPwdApiV1SystemResetPwdPut**
> Object resetUserPwdApiV1SystemResetPwdPut(userId, newPassword)

管理员重置用户密码

管理员无需旧密码即可重置指定用户的登录密码。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    Integer userId = 56; // Integer | 目标用户 ID
    String newPassword = "newPassword_example"; // String | 新密码
    try {
      Object result = apiInstance.resetUserPwdApiV1SystemResetPwdPut(userId, newPassword);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#resetUserPwdApiV1SystemResetPwdPut");
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
| **userId** | **Integer**| 目标用户 ID | |
| **newPassword** | **String**| 新密码 | |

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

<a id="updateOwnPasswordApiV1SystemUserProfileUpdatePwdPut"></a>
# **updateOwnPasswordApiV1SystemUserProfileUpdatePwdPut**
> Object updateOwnPasswordApiV1SystemUserProfileUpdatePwdPut(bodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut)

修改个人密码

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut bodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut = new BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut(); // BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut | 
    try {
      Object result = apiInstance.updateOwnPasswordApiV1SystemUserProfileUpdatePwdPut(bodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#updateOwnPasswordApiV1SystemUserProfileUpdatePwdPut");
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
| **bodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut** | [**BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut**](BodyUpdateOwnPasswordApiV1SystemUserProfileUpdatePwdPut.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="updateUserProfileApiV1SystemUserProfilePut"></a>
# **updateUserProfileApiV1SystemUserProfilePut**
> Object updateUserProfileApiV1SystemUserProfilePut(bodyUpdateUserProfileApiV1SystemUserProfilePut)

修改个人信息

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    BodyUpdateUserProfileApiV1SystemUserProfilePut bodyUpdateUserProfileApiV1SystemUserProfilePut = new BodyUpdateUserProfileApiV1SystemUserProfilePut(); // BodyUpdateUserProfileApiV1SystemUserProfilePut | 
    try {
      Object result = apiInstance.updateUserProfileApiV1SystemUserProfilePut(bodyUpdateUserProfileApiV1SystemUserProfilePut);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#updateUserProfileApiV1SystemUserProfilePut");
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
| **bodyUpdateUserProfileApiV1SystemUserProfilePut** | [**BodyUpdateUserProfileApiV1SystemUserProfilePut**](BodyUpdateUserProfileApiV1SystemUserProfilePut.md)|  | [optional] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="uploadAvatarApiV1SystemUserProfileAvatarPost"></a>
# **uploadAvatarApiV1SystemUserProfileAvatarPost**
> Object uploadAvatarApiV1SystemUserProfileAvatarPost(_file)

上传头像

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemApi apiInstance = new SystemApi(defaultClient);
    File _file = new File("/path/to/file"); // File | 
    try {
      Object result = apiInstance.uploadAvatarApiV1SystemUserProfileAvatarPost(_file);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemApi#uploadAvatarApiV1SystemUserProfileAvatarPost");
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
| **_file** | **File**|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

