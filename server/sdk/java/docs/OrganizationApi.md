# OrganizationApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addMemberApiV1OrganizationOidMemberPost**](OrganizationApi.md#addMemberApiV1OrganizationOidMemberPost) | **POST** /api/v1/organization/{oid}/member | 添加成员 |
| [**addMemberApiV1OrganizationOidMemberPost_0**](OrganizationApi.md#addMemberApiV1OrganizationOidMemberPost_0) | **POST** /api/v1/organization/{oid}/member | 添加成员 |
| [**createOrganizationApiV1OrganizationPost**](OrganizationApi.md#createOrganizationApiV1OrganizationPost) | **POST** /api/v1/organization | 创建组织 |
| [**createOrganizationApiV1OrganizationPost_0**](OrganizationApi.md#createOrganizationApiV1OrganizationPost_0) | **POST** /api/v1/organization | 创建组织 |
| [**deleteOrganizationApiV1OrganizationOidDelete**](OrganizationApi.md#deleteOrganizationApiV1OrganizationOidDelete) | **DELETE** /api/v1/organization/{oid} | 删除组织 |
| [**deleteOrganizationApiV1OrganizationOidDelete_0**](OrganizationApi.md#deleteOrganizationApiV1OrganizationOidDelete_0) | **DELETE** /api/v1/organization/{oid} | 删除组织 |
| [**getOrganizationApiV1OrganizationOidGet**](OrganizationApi.md#getOrganizationApiV1OrganizationOidGet) | **GET** /api/v1/organization/{oid} | 组织详情 |
| [**getOrganizationApiV1OrganizationOidGet_0**](OrganizationApi.md#getOrganizationApiV1OrganizationOidGet_0) | **GET** /api/v1/organization/{oid} | 组织详情 |
| [**listMembersApiV1OrganizationOidMembersGet**](OrganizationApi.md#listMembersApiV1OrganizationOidMembersGet) | **GET** /api/v1/organization/{oid}/members | 组织成员 |
| [**listMembersApiV1OrganizationOidMembersGet_0**](OrganizationApi.md#listMembersApiV1OrganizationOidMembersGet_0) | **GET** /api/v1/organization/{oid}/members | 组织成员 |
| [**listOrganizationsApiV1OrganizationListGet**](OrganizationApi.md#listOrganizationsApiV1OrganizationListGet) | **GET** /api/v1/organization/list | 组织列表 |
| [**listOrganizationsApiV1OrganizationListGet_0**](OrganizationApi.md#listOrganizationsApiV1OrganizationListGet_0) | **GET** /api/v1/organization/list | 组织列表 |
| [**orgTreeApiV1OrganizationTreeGet**](OrganizationApi.md#orgTreeApiV1OrganizationTreeGet) | **GET** /api/v1/organization/tree | 组织树 |
| [**orgTreeApiV1OrganizationTreeGet_0**](OrganizationApi.md#orgTreeApiV1OrganizationTreeGet_0) | **GET** /api/v1/organization/tree | 组织树 |
| [**removeMemberApiV1OrganizationOidMemberUserIdDelete**](OrganizationApi.md#removeMemberApiV1OrganizationOidMemberUserIdDelete) | **DELETE** /api/v1/organization/{oid}/member/{user_id} | 移除成员 |
| [**removeMemberApiV1OrganizationOidMemberUserIdDelete_0**](OrganizationApi.md#removeMemberApiV1OrganizationOidMemberUserIdDelete_0) | **DELETE** /api/v1/organization/{oid}/member/{user_id} | 移除成员 |
| [**updateOrganizationApiV1OrganizationOidPut**](OrganizationApi.md#updateOrganizationApiV1OrganizationOidPut) | **PUT** /api/v1/organization/{oid} | 修改组织 |
| [**updateOrganizationApiV1OrganizationOidPut_0**](OrganizationApi.md#updateOrganizationApiV1OrganizationOidPut_0) | **PUT** /api/v1/organization/{oid} | 修改组织 |


<a id="addMemberApiV1OrganizationOidMemberPost"></a>
# **addMemberApiV1OrganizationOidMemberPost**
> Object addMemberApiV1OrganizationOidMemberPost(oid, userId, role, position)

添加成员

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OrganizationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OrganizationApi apiInstance = new OrganizationApi(defaultClient);
    Integer oid = 56; // Integer | 
    String userId = "userId_example"; // String | 
    String role = "member"; // String | 
    String position = "position_example"; // String | 
    try {
      Object result = apiInstance.addMemberApiV1OrganizationOidMemberPost(oid, userId, role, position);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OrganizationApi#addMemberApiV1OrganizationOidMemberPost");
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
| **oid** | **Integer**|  | |
| **userId** | **String**|  | |
| **role** | **String**|  | [optional] [default to member] |
| **position** | **String**|  | [optional] |

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

<a id="addMemberApiV1OrganizationOidMemberPost_0"></a>
# **addMemberApiV1OrganizationOidMemberPost_0**
> Object addMemberApiV1OrganizationOidMemberPost_0(oid, userId, role, position)

添加成员

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OrganizationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OrganizationApi apiInstance = new OrganizationApi(defaultClient);
    Integer oid = 56; // Integer | 
    String userId = "userId_example"; // String | 
    String role = "member"; // String | 
    String position = "position_example"; // String | 
    try {
      Object result = apiInstance.addMemberApiV1OrganizationOidMemberPost_0(oid, userId, role, position);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OrganizationApi#addMemberApiV1OrganizationOidMemberPost_0");
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
| **oid** | **Integer**|  | |
| **userId** | **String**|  | |
| **role** | **String**|  | [optional] [default to member] |
| **position** | **String**|  | [optional] |

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

<a id="createOrganizationApiV1OrganizationPost"></a>
# **createOrganizationApiV1OrganizationPost**
> Object createOrganizationApiV1OrganizationPost(name, pid, type, shortName, code, description, leader, leaderPhone, logo, address, sortOrder)

创建组织

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OrganizationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OrganizationApi apiInstance = new OrganizationApi(defaultClient);
    String name = "name_example"; // String | 
    Integer pid = 0; // Integer | 
    String type = "company"; // String | 
    String shortName = "shortName_example"; // String | 
    String code = "code_example"; // String | 
    String description = "description_example"; // String | 
    String leader = "leader_example"; // String | 
    String leaderPhone = "leaderPhone_example"; // String | 
    String logo = "logo_example"; // String | 
    String address = "address_example"; // String | 
    Integer sortOrder = 0; // Integer | 
    try {
      Object result = apiInstance.createOrganizationApiV1OrganizationPost(name, pid, type, shortName, code, description, leader, leaderPhone, logo, address, sortOrder);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OrganizationApi#createOrganizationApiV1OrganizationPost");
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
| **name** | **String**|  | |
| **pid** | **Integer**|  | [optional] [default to 0] |
| **type** | **String**|  | [optional] [default to company] |
| **shortName** | **String**|  | [optional] |
| **code** | **String**|  | [optional] |
| **description** | **String**|  | [optional] |
| **leader** | **String**|  | [optional] |
| **leaderPhone** | **String**|  | [optional] |
| **logo** | **String**|  | [optional] |
| **address** | **String**|  | [optional] |
| **sortOrder** | **Integer**|  | [optional] [default to 0] |

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

<a id="createOrganizationApiV1OrganizationPost_0"></a>
# **createOrganizationApiV1OrganizationPost_0**
> Object createOrganizationApiV1OrganizationPost_0(name, pid, type, shortName, code, description, leader, leaderPhone, logo, address, sortOrder)

创建组织

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OrganizationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OrganizationApi apiInstance = new OrganizationApi(defaultClient);
    String name = "name_example"; // String | 
    Integer pid = 0; // Integer | 
    String type = "company"; // String | 
    String shortName = "shortName_example"; // String | 
    String code = "code_example"; // String | 
    String description = "description_example"; // String | 
    String leader = "leader_example"; // String | 
    String leaderPhone = "leaderPhone_example"; // String | 
    String logo = "logo_example"; // String | 
    String address = "address_example"; // String | 
    Integer sortOrder = 0; // Integer | 
    try {
      Object result = apiInstance.createOrganizationApiV1OrganizationPost_0(name, pid, type, shortName, code, description, leader, leaderPhone, logo, address, sortOrder);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OrganizationApi#createOrganizationApiV1OrganizationPost_0");
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
| **name** | **String**|  | |
| **pid** | **Integer**|  | [optional] [default to 0] |
| **type** | **String**|  | [optional] [default to company] |
| **shortName** | **String**|  | [optional] |
| **code** | **String**|  | [optional] |
| **description** | **String**|  | [optional] |
| **leader** | **String**|  | [optional] |
| **leaderPhone** | **String**|  | [optional] |
| **logo** | **String**|  | [optional] |
| **address** | **String**|  | [optional] |
| **sortOrder** | **Integer**|  | [optional] [default to 0] |

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

<a id="deleteOrganizationApiV1OrganizationOidDelete"></a>
# **deleteOrganizationApiV1OrganizationOidDelete**
> Object deleteOrganizationApiV1OrganizationOidDelete(oid)

删除组织

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OrganizationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OrganizationApi apiInstance = new OrganizationApi(defaultClient);
    Integer oid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteOrganizationApiV1OrganizationOidDelete(oid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OrganizationApi#deleteOrganizationApiV1OrganizationOidDelete");
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
| **oid** | **Integer**|  | |

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

<a id="deleteOrganizationApiV1OrganizationOidDelete_0"></a>
# **deleteOrganizationApiV1OrganizationOidDelete_0**
> Object deleteOrganizationApiV1OrganizationOidDelete_0(oid)

删除组织

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OrganizationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OrganizationApi apiInstance = new OrganizationApi(defaultClient);
    Integer oid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteOrganizationApiV1OrganizationOidDelete_0(oid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OrganizationApi#deleteOrganizationApiV1OrganizationOidDelete_0");
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
| **oid** | **Integer**|  | |

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

<a id="getOrganizationApiV1OrganizationOidGet"></a>
# **getOrganizationApiV1OrganizationOidGet**
> Object getOrganizationApiV1OrganizationOidGet(oid)

组织详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OrganizationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OrganizationApi apiInstance = new OrganizationApi(defaultClient);
    Integer oid = 56; // Integer | 
    try {
      Object result = apiInstance.getOrganizationApiV1OrganizationOidGet(oid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OrganizationApi#getOrganizationApiV1OrganizationOidGet");
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
| **oid** | **Integer**|  | |

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

<a id="getOrganizationApiV1OrganizationOidGet_0"></a>
# **getOrganizationApiV1OrganizationOidGet_0**
> Object getOrganizationApiV1OrganizationOidGet_0(oid)

组织详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OrganizationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OrganizationApi apiInstance = new OrganizationApi(defaultClient);
    Integer oid = 56; // Integer | 
    try {
      Object result = apiInstance.getOrganizationApiV1OrganizationOidGet_0(oid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OrganizationApi#getOrganizationApiV1OrganizationOidGet_0");
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
| **oid** | **Integer**|  | |

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

<a id="listMembersApiV1OrganizationOidMembersGet"></a>
# **listMembersApiV1OrganizationOidMembersGet**
> Object listMembersApiV1OrganizationOidMembersGet(oid, page, limit)

组织成员

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OrganizationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OrganizationApi apiInstance = new OrganizationApi(defaultClient);
    Integer oid = 56; // Integer | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listMembersApiV1OrganizationOidMembersGet(oid, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OrganizationApi#listMembersApiV1OrganizationOidMembersGet");
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
| **oid** | **Integer**|  | |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |

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

<a id="listMembersApiV1OrganizationOidMembersGet_0"></a>
# **listMembersApiV1OrganizationOidMembersGet_0**
> Object listMembersApiV1OrganizationOidMembersGet_0(oid, page, limit)

组织成员

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OrganizationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OrganizationApi apiInstance = new OrganizationApi(defaultClient);
    Integer oid = 56; // Integer | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listMembersApiV1OrganizationOidMembersGet_0(oid, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OrganizationApi#listMembersApiV1OrganizationOidMembersGet_0");
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
| **oid** | **Integer**|  | |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |

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

<a id="listOrganizationsApiV1OrganizationListGet"></a>
# **listOrganizationsApiV1OrganizationListGet**
> Object listOrganizationsApiV1OrganizationListGet(pid, status, keyword)

组织列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OrganizationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OrganizationApi apiInstance = new OrganizationApi(defaultClient);
    Integer pid = 56; // Integer | 
    Integer status = 56; // Integer | 
    String keyword = "keyword_example"; // String | 
    try {
      Object result = apiInstance.listOrganizationsApiV1OrganizationListGet(pid, status, keyword);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OrganizationApi#listOrganizationsApiV1OrganizationListGet");
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
| **pid** | **Integer**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **keyword** | **String**|  | [optional] |

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

<a id="listOrganizationsApiV1OrganizationListGet_0"></a>
# **listOrganizationsApiV1OrganizationListGet_0**
> Object listOrganizationsApiV1OrganizationListGet_0(pid, status, keyword)

组织列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OrganizationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OrganizationApi apiInstance = new OrganizationApi(defaultClient);
    Integer pid = 56; // Integer | 
    Integer status = 56; // Integer | 
    String keyword = "keyword_example"; // String | 
    try {
      Object result = apiInstance.listOrganizationsApiV1OrganizationListGet_0(pid, status, keyword);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OrganizationApi#listOrganizationsApiV1OrganizationListGet_0");
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
| **pid** | **Integer**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **keyword** | **String**|  | [optional] |

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

<a id="orgTreeApiV1OrganizationTreeGet"></a>
# **orgTreeApiV1OrganizationTreeGet**
> Object orgTreeApiV1OrganizationTreeGet()

组织树

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OrganizationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OrganizationApi apiInstance = new OrganizationApi(defaultClient);
    try {
      Object result = apiInstance.orgTreeApiV1OrganizationTreeGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OrganizationApi#orgTreeApiV1OrganizationTreeGet");
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

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="orgTreeApiV1OrganizationTreeGet_0"></a>
# **orgTreeApiV1OrganizationTreeGet_0**
> Object orgTreeApiV1OrganizationTreeGet_0()

组织树

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OrganizationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OrganizationApi apiInstance = new OrganizationApi(defaultClient);
    try {
      Object result = apiInstance.orgTreeApiV1OrganizationTreeGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OrganizationApi#orgTreeApiV1OrganizationTreeGet_0");
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

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="removeMemberApiV1OrganizationOidMemberUserIdDelete"></a>
# **removeMemberApiV1OrganizationOidMemberUserIdDelete**
> Object removeMemberApiV1OrganizationOidMemberUserIdDelete(oid, userId)

移除成员

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OrganizationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OrganizationApi apiInstance = new OrganizationApi(defaultClient);
    Integer oid = 56; // Integer | 
    String userId = "userId_example"; // String | 
    try {
      Object result = apiInstance.removeMemberApiV1OrganizationOidMemberUserIdDelete(oid, userId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OrganizationApi#removeMemberApiV1OrganizationOidMemberUserIdDelete");
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
| **oid** | **Integer**|  | |
| **userId** | **String**|  | |

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

<a id="removeMemberApiV1OrganizationOidMemberUserIdDelete_0"></a>
# **removeMemberApiV1OrganizationOidMemberUserIdDelete_0**
> Object removeMemberApiV1OrganizationOidMemberUserIdDelete_0(oid, userId)

移除成员

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OrganizationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OrganizationApi apiInstance = new OrganizationApi(defaultClient);
    Integer oid = 56; // Integer | 
    String userId = "userId_example"; // String | 
    try {
      Object result = apiInstance.removeMemberApiV1OrganizationOidMemberUserIdDelete_0(oid, userId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OrganizationApi#removeMemberApiV1OrganizationOidMemberUserIdDelete_0");
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
| **oid** | **Integer**|  | |
| **userId** | **String**|  | |

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

<a id="updateOrganizationApiV1OrganizationOidPut"></a>
# **updateOrganizationApiV1OrganizationOidPut**
> Object updateOrganizationApiV1OrganizationOidPut(oid, name, shortName, description, leader, leaderPhone, status, sortOrder)

修改组织

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OrganizationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OrganizationApi apiInstance = new OrganizationApi(defaultClient);
    Integer oid = 56; // Integer | 
    String name = "name_example"; // String | 
    String shortName = "shortName_example"; // String | 
    String description = "description_example"; // String | 
    String leader = "leader_example"; // String | 
    String leaderPhone = "leaderPhone_example"; // String | 
    Integer status = 56; // Integer | 
    Integer sortOrder = 56; // Integer | 
    try {
      Object result = apiInstance.updateOrganizationApiV1OrganizationOidPut(oid, name, shortName, description, leader, leaderPhone, status, sortOrder);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OrganizationApi#updateOrganizationApiV1OrganizationOidPut");
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
| **oid** | **Integer**|  | |
| **name** | **String**|  | [optional] |
| **shortName** | **String**|  | [optional] |
| **description** | **String**|  | [optional] |
| **leader** | **String**|  | [optional] |
| **leaderPhone** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **sortOrder** | **Integer**|  | [optional] |

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

<a id="updateOrganizationApiV1OrganizationOidPut_0"></a>
# **updateOrganizationApiV1OrganizationOidPut_0**
> Object updateOrganizationApiV1OrganizationOidPut_0(oid, name, shortName, description, leader, leaderPhone, status, sortOrder)

修改组织

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OrganizationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OrganizationApi apiInstance = new OrganizationApi(defaultClient);
    Integer oid = 56; // Integer | 
    String name = "name_example"; // String | 
    String shortName = "shortName_example"; // String | 
    String description = "description_example"; // String | 
    String leader = "leader_example"; // String | 
    String leaderPhone = "leaderPhone_example"; // String | 
    Integer status = 56; // Integer | 
    Integer sortOrder = 56; // Integer | 
    try {
      Object result = apiInstance.updateOrganizationApiV1OrganizationOidPut_0(oid, name, shortName, description, leader, leaderPhone, status, sortOrder);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OrganizationApi#updateOrganizationApiV1OrganizationOidPut_0");
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
| **oid** | **Integer**|  | |
| **name** | **String**|  | [optional] |
| **shortName** | **String**|  | [optional] |
| **description** | **String**|  | [optional] |
| **leader** | **String**|  | [optional] |
| **leaderPhone** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **sortOrder** | **Integer**|  | [optional] |

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

