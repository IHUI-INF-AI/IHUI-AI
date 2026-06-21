# AuthIdentityApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**auditApiV1AuthIdentityAidAuditPut**](AuthIdentityApi.md#auditApiV1AuthIdentityAidAuditPut) | **PUT** /api/v1/auth-identity/{aid}/audit | 审核认证 |
| [**auditApiV1AuthIdentityAidAuditPut_0**](AuthIdentityApi.md#auditApiV1AuthIdentityAidAuditPut_0) | **PUT** /api/v1/auth-identity/{aid}/audit | 审核认证 |
| [**authIdentitySubmit**](AuthIdentityApi.md#authIdentitySubmit) | **POST** /api/v1/auth-identity/submit | 提交实名认证 |
| [**authIdentitySubmit_0**](AuthIdentityApi.md#authIdentitySubmit_0) | **POST** /api/v1/auth-identity/submit | 提交实名认证 |
| [**listIdentitiesApiV1AuthIdentityListGet**](AuthIdentityApi.md#listIdentitiesApiV1AuthIdentityListGet) | **GET** /api/v1/auth-identity/list | 认证列表(管理员) |
| [**listIdentitiesApiV1AuthIdentityListGet_0**](AuthIdentityApi.md#listIdentitiesApiV1AuthIdentityListGet_0) | **GET** /api/v1/auth-identity/list | 认证列表(管理员) |
| [**myIdentityApiV1AuthIdentityMyGet**](AuthIdentityApi.md#myIdentityApiV1AuthIdentityMyGet) | **GET** /api/v1/auth-identity/my | 我的认证 |
| [**myIdentityApiV1AuthIdentityMyGet_0**](AuthIdentityApi.md#myIdentityApiV1AuthIdentityMyGet_0) | **GET** /api/v1/auth-identity/my | 我的认证 |


<a id="auditApiV1AuthIdentityAidAuditPut"></a>
# **auditApiV1AuthIdentityAidAuditPut**
> Object auditApiV1AuthIdentityAidAuditPut(aid, status, remark, expireDays)

审核认证

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthIdentityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthIdentityApi apiInstance = new AuthIdentityApi(defaultClient);
    Integer aid = 56; // Integer | 
    Integer status = 56; // Integer | 
    String remark = "remark_example"; // String | 
    Integer expireDays = 365; // Integer | 
    try {
      Object result = apiInstance.auditApiV1AuthIdentityAidAuditPut(aid, status, remark, expireDays);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthIdentityApi#auditApiV1AuthIdentityAidAuditPut");
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
| **aid** | **Integer**|  | |
| **status** | **Integer**|  | |
| **remark** | **String**|  | [optional] |
| **expireDays** | **Integer**|  | [optional] [default to 365] |

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

<a id="auditApiV1AuthIdentityAidAuditPut_0"></a>
# **auditApiV1AuthIdentityAidAuditPut_0**
> Object auditApiV1AuthIdentityAidAuditPut_0(aid, status, remark, expireDays)

审核认证

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthIdentityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthIdentityApi apiInstance = new AuthIdentityApi(defaultClient);
    Integer aid = 56; // Integer | 
    Integer status = 56; // Integer | 
    String remark = "remark_example"; // String | 
    Integer expireDays = 365; // Integer | 
    try {
      Object result = apiInstance.auditApiV1AuthIdentityAidAuditPut_0(aid, status, remark, expireDays);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthIdentityApi#auditApiV1AuthIdentityAidAuditPut_0");
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
| **aid** | **Integer**|  | |
| **status** | **Integer**|  | |
| **remark** | **String**|  | [optional] |
| **expireDays** | **Integer**|  | [optional] [default to 365] |

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

<a id="authIdentitySubmit"></a>
# **authIdentitySubmit**
> Object authIdentitySubmit(realName, idCard, phone, idCardFront, idCardBack, type)

提交实名认证

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthIdentityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthIdentityApi apiInstance = new AuthIdentityApi(defaultClient);
    String realName = "realName_example"; // String | 
    String idCard = "idCard_example"; // String | 
    String phone = "phone_example"; // String | 
    String idCardFront = "idCardFront_example"; // String | 
    String idCardBack = "idCardBack_example"; // String | 
    Integer type = 1; // Integer | 
    try {
      Object result = apiInstance.authIdentitySubmit(realName, idCard, phone, idCardFront, idCardBack, type);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthIdentityApi#authIdentitySubmit");
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
| **realName** | **String**|  | |
| **idCard** | **String**|  | |
| **phone** | **String**|  | [optional] |
| **idCardFront** | **String**|  | [optional] |
| **idCardBack** | **String**|  | [optional] |
| **type** | **Integer**|  | [optional] [default to 1] |

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

<a id="authIdentitySubmit_0"></a>
# **authIdentitySubmit_0**
> Object authIdentitySubmit_0(realName, idCard, phone, idCardFront, idCardBack, type)

提交实名认证

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthIdentityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthIdentityApi apiInstance = new AuthIdentityApi(defaultClient);
    String realName = "realName_example"; // String | 
    String idCard = "idCard_example"; // String | 
    String phone = "phone_example"; // String | 
    String idCardFront = "idCardFront_example"; // String | 
    String idCardBack = "idCardBack_example"; // String | 
    Integer type = 1; // Integer | 
    try {
      Object result = apiInstance.authIdentitySubmit_0(realName, idCard, phone, idCardFront, idCardBack, type);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthIdentityApi#authIdentitySubmit_0");
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
| **realName** | **String**|  | |
| **idCard** | **String**|  | |
| **phone** | **String**|  | [optional] |
| **idCardFront** | **String**|  | [optional] |
| **idCardBack** | **String**|  | [optional] |
| **type** | **Integer**|  | [optional] [default to 1] |

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

<a id="listIdentitiesApiV1AuthIdentityListGet"></a>
# **listIdentitiesApiV1AuthIdentityListGet**
> Object listIdentitiesApiV1AuthIdentityListGet(page, limit, status)

认证列表(管理员)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthIdentityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthIdentityApi apiInstance = new AuthIdentityApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.listIdentitiesApiV1AuthIdentityListGet(page, limit, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthIdentityApi#listIdentitiesApiV1AuthIdentityListGet");
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
| **status** | **Integer**|  | [optional] |

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

<a id="listIdentitiesApiV1AuthIdentityListGet_0"></a>
# **listIdentitiesApiV1AuthIdentityListGet_0**
> Object listIdentitiesApiV1AuthIdentityListGet_0(page, limit, status)

认证列表(管理员)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthIdentityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthIdentityApi apiInstance = new AuthIdentityApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.listIdentitiesApiV1AuthIdentityListGet_0(page, limit, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthIdentityApi#listIdentitiesApiV1AuthIdentityListGet_0");
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
| **status** | **Integer**|  | [optional] |

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

<a id="myIdentityApiV1AuthIdentityMyGet"></a>
# **myIdentityApiV1AuthIdentityMyGet**
> Object myIdentityApiV1AuthIdentityMyGet()

我的认证

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthIdentityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthIdentityApi apiInstance = new AuthIdentityApi(defaultClient);
    try {
      Object result = apiInstance.myIdentityApiV1AuthIdentityMyGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthIdentityApi#myIdentityApiV1AuthIdentityMyGet");
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

<a id="myIdentityApiV1AuthIdentityMyGet_0"></a>
# **myIdentityApiV1AuthIdentityMyGet_0**
> Object myIdentityApiV1AuthIdentityMyGet_0()

我的认证

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthIdentityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthIdentityApi apiInstance = new AuthIdentityApi(defaultClient);
    try {
      Object result = apiInstance.myIdentityApiV1AuthIdentityMyGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthIdentityApi#myIdentityApiV1AuthIdentityMyGet_0");
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

