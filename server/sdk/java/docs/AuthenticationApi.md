# AuthenticationApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**cancelAccountApiV1AuthAuthCancelDelete**](AuthenticationApi.md#cancelAccountApiV1AuthAuthCancelDelete) | **DELETE** /api/v1/auth/auth/cancel | User account cancellation (soft delete) |
| [**cancelAccountApiV1AuthAuthCancelDelete_0**](AuthenticationApi.md#cancelAccountApiV1AuthAuthCancelDelete_0) | **DELETE** /api/v1/auth/auth/cancel | User account cancellation (soft delete) |
| [**changePasswordApiV1AuthAuthProfilePasswordPut**](AuthenticationApi.md#changePasswordApiV1AuthAuthProfilePasswordPut) | **PUT** /api/v1/auth/auth/profile/password | Change password |
| [**changePasswordApiV1AuthAuthProfilePasswordPut_0**](AuthenticationApi.md#changePasswordApiV1AuthAuthProfilePasswordPut_0) | **PUT** /api/v1/auth/auth/profile/password | Change password |
| [**checkPhoneExistsApiV1AuthAuthExistPhoneGet**](AuthenticationApi.md#checkPhoneExistsApiV1AuthAuthExistPhoneGet) | **GET** /api/v1/auth/auth/exist/{phone} | Check if phone is registered |
| [**checkPhoneExistsApiV1AuthAuthExistPhoneGet_0**](AuthenticationApi.md#checkPhoneExistsApiV1AuthAuthExistPhoneGet_0) | **GET** /api/v1/auth/auth/exist/{phone} | Check if phone is registered |
| [**getProfileApiV1AuthAuthProfileGet**](AuthenticationApi.md#getProfileApiV1AuthAuthProfileGet) | **GET** /api/v1/auth/auth/profile | Get personal profile with roles and posts |
| [**getProfileApiV1AuthAuthProfileGet_0**](AuthenticationApi.md#getProfileApiV1AuthAuthProfileGet_0) | **GET** /api/v1/auth/auth/profile | Get personal profile with roles and posts |
| [**getUserInfoApiV1AuthAuthInfoGet**](AuthenticationApi.md#getUserInfoApiV1AuthAuthInfoGet) | **GET** /api/v1/auth/auth/info | Get current user info |
| [**getUserInfoApiV1AuthAuthInfoGet_0**](AuthenticationApi.md#getUserInfoApiV1AuthAuthInfoGet_0) | **GET** /api/v1/auth/auth/info | Get current user info |
| [**loginApiV1AuthAuthLoginPost**](AuthenticationApi.md#loginApiV1AuthAuthLoginPost) | **POST** /api/v1/auth/auth/login | Password login |
| [**loginApiV1AuthAuthLoginPost_0**](AuthenticationApi.md#loginApiV1AuthAuthLoginPost_0) | **POST** /api/v1/auth/auth/login | Password login |
| [**loginSmsApiV1AuthAuthLoginSmsPost**](AuthenticationApi.md#loginSmsApiV1AuthAuthLoginSmsPost) | **POST** /api/v1/auth/auth/login/sms | SMS code login |
| [**loginSmsApiV1AuthAuthLoginSmsPost_0**](AuthenticationApi.md#loginSmsApiV1AuthAuthLoginSmsPost_0) | **POST** /api/v1/auth/auth/login/sms | SMS code login |
| [**logoutApiV1AuthAuthLogoutPost**](AuthenticationApi.md#logoutApiV1AuthAuthLogoutPost) | **POST** /api/v1/auth/auth/logout | Logout |
| [**logoutApiV1AuthAuthLogoutPost_0**](AuthenticationApi.md#logoutApiV1AuthAuthLogoutPost_0) | **POST** /api/v1/auth/auth/logout | Logout |
| [**refreshTokenApiV1AuthAuthRefreshPost**](AuthenticationApi.md#refreshTokenApiV1AuthAuthRefreshPost) | **POST** /api/v1/auth/auth/refresh | Refresh access token (rotate) |
| [**refreshTokenApiV1AuthAuthRefreshPost_0**](AuthenticationApi.md#refreshTokenApiV1AuthAuthRefreshPost_0) | **POST** /api/v1/auth/auth/refresh | Refresh access token (rotate) |
| [**registerApiV1AuthAuthRegisterPost**](AuthenticationApi.md#registerApiV1AuthAuthRegisterPost) | **POST** /api/v1/auth/auth/register | Register new user |
| [**registerApiV1AuthAuthRegisterPost_0**](AuthenticationApi.md#registerApiV1AuthAuthRegisterPost_0) | **POST** /api/v1/auth/auth/register | Register new user |
| [**sendCodeApiV1AuthAuthSmsCodePost**](AuthenticationApi.md#sendCodeApiV1AuthAuthSmsCodePost) | **POST** /api/v1/auth/auth/sms/code | Send SMS verification code |
| [**sendCodeApiV1AuthAuthSmsCodePost_0**](AuthenticationApi.md#sendCodeApiV1AuthAuthSmsCodePost_0) | **POST** /api/v1/auth/auth/sms/code | Send SMS verification code |
| [**updateProfileApiV1AuthAuthProfilePut**](AuthenticationApi.md#updateProfileApiV1AuthAuthProfilePut) | **PUT** /api/v1/auth/auth/profile | Update personal profile |
| [**updateProfileApiV1AuthAuthProfilePut_0**](AuthenticationApi.md#updateProfileApiV1AuthAuthProfilePut_0) | **PUT** /api/v1/auth/auth/profile | Update personal profile |
| [**uploadAvatarApiV1AuthAuthProfileAvatarPost**](AuthenticationApi.md#uploadAvatarApiV1AuthAuthProfileAvatarPost) | **POST** /api/v1/auth/auth/profile/avatar | Upload avatar |
| [**uploadAvatarApiV1AuthAuthProfileAvatarPost_0**](AuthenticationApi.md#uploadAvatarApiV1AuthAuthProfileAvatarPost_0) | **POST** /api/v1/auth/auth/profile/avatar | Upload avatar |


<a id="cancelAccountApiV1AuthAuthCancelDelete"></a>
# **cancelAccountApiV1AuthAuthCancelDelete**
> Object cancelAccountApiV1AuthAuthCancelDelete()

User account cancellation (soft delete)

Cancel user account -- soft delete user and mask phone.  Matches Java SQL:   UPDATE users u LEFT JOIN user_auth_info uai ON u.uuid &#x3D; uai.user_uuid   SET u.status &#x3D; 3, uai.cancel_phone &#x3D; uai.phone, uai.phone &#x3D; NULL   WHERE u.uuid &#x3D; #{uuid}  Note: Java does NOT delete third-party bindings on cancel, only masks phone.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    try {
      Object result = apiInstance.cancelAccountApiV1AuthAuthCancelDelete();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#cancelAccountApiV1AuthAuthCancelDelete");
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

<a id="cancelAccountApiV1AuthAuthCancelDelete_0"></a>
# **cancelAccountApiV1AuthAuthCancelDelete_0**
> Object cancelAccountApiV1AuthAuthCancelDelete_0()

User account cancellation (soft delete)

Cancel user account -- soft delete user and mask phone.  Matches Java SQL:   UPDATE users u LEFT JOIN user_auth_info uai ON u.uuid &#x3D; uai.user_uuid   SET u.status &#x3D; 3, uai.cancel_phone &#x3D; uai.phone, uai.phone &#x3D; NULL   WHERE u.uuid &#x3D; #{uuid}  Note: Java does NOT delete third-party bindings on cancel, only masks phone.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    try {
      Object result = apiInstance.cancelAccountApiV1AuthAuthCancelDelete_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#cancelAccountApiV1AuthAuthCancelDelete_0");
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

<a id="changePasswordApiV1AuthAuthProfilePasswordPut"></a>
# **changePasswordApiV1AuthAuthProfilePasswordPut**
> Object changePasswordApiV1AuthAuthProfilePasswordPut(bodyChangePasswordApiV1AuthAuthProfilePasswordPut)

Change password

Change user password — verifies old password before setting new one.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    BodyChangePasswordApiV1AuthAuthProfilePasswordPut bodyChangePasswordApiV1AuthAuthProfilePasswordPut = new BodyChangePasswordApiV1AuthAuthProfilePasswordPut(); // BodyChangePasswordApiV1AuthAuthProfilePasswordPut | 
    try {
      Object result = apiInstance.changePasswordApiV1AuthAuthProfilePasswordPut(bodyChangePasswordApiV1AuthAuthProfilePasswordPut);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#changePasswordApiV1AuthAuthProfilePasswordPut");
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
| **bodyChangePasswordApiV1AuthAuthProfilePasswordPut** | [**BodyChangePasswordApiV1AuthAuthProfilePasswordPut**](BodyChangePasswordApiV1AuthAuthProfilePasswordPut.md)|  | |

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

<a id="changePasswordApiV1AuthAuthProfilePasswordPut_0"></a>
# **changePasswordApiV1AuthAuthProfilePasswordPut_0**
> Object changePasswordApiV1AuthAuthProfilePasswordPut_0(bodyChangePasswordApiV1AuthAuthProfilePasswordPut)

Change password

Change user password — verifies old password before setting new one.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    BodyChangePasswordApiV1AuthAuthProfilePasswordPut bodyChangePasswordApiV1AuthAuthProfilePasswordPut = new BodyChangePasswordApiV1AuthAuthProfilePasswordPut(); // BodyChangePasswordApiV1AuthAuthProfilePasswordPut | 
    try {
      Object result = apiInstance.changePasswordApiV1AuthAuthProfilePasswordPut_0(bodyChangePasswordApiV1AuthAuthProfilePasswordPut);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#changePasswordApiV1AuthAuthProfilePasswordPut_0");
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
| **bodyChangePasswordApiV1AuthAuthProfilePasswordPut** | [**BodyChangePasswordApiV1AuthAuthProfilePasswordPut**](BodyChangePasswordApiV1AuthAuthProfilePasswordPut.md)|  | |

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

<a id="checkPhoneExistsApiV1AuthAuthExistPhoneGet"></a>
# **checkPhoneExistsApiV1AuthAuthExistPhoneGet**
> Object checkPhoneExistsApiV1AuthAuthExistPhoneGet(phone)

Check if phone is registered

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    String phone = "phone_example"; // String | 
    try {
      Object result = apiInstance.checkPhoneExistsApiV1AuthAuthExistPhoneGet(phone);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#checkPhoneExistsApiV1AuthAuthExistPhoneGet");
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
| **phone** | **String**|  | |

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

<a id="checkPhoneExistsApiV1AuthAuthExistPhoneGet_0"></a>
# **checkPhoneExistsApiV1AuthAuthExistPhoneGet_0**
> Object checkPhoneExistsApiV1AuthAuthExistPhoneGet_0(phone)

Check if phone is registered

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    String phone = "phone_example"; // String | 
    try {
      Object result = apiInstance.checkPhoneExistsApiV1AuthAuthExistPhoneGet_0(phone);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#checkPhoneExistsApiV1AuthAuthExistPhoneGet_0");
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
| **phone** | **String**|  | |

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

<a id="getProfileApiV1AuthAuthProfileGet"></a>
# **getProfileApiV1AuthAuthProfileGet**
> Object getProfileApiV1AuthAuthProfileGet()

Get personal profile with roles and posts

Get detailed profile including roles and posts.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    try {
      Object result = apiInstance.getProfileApiV1AuthAuthProfileGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#getProfileApiV1AuthAuthProfileGet");
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

<a id="getProfileApiV1AuthAuthProfileGet_0"></a>
# **getProfileApiV1AuthAuthProfileGet_0**
> Object getProfileApiV1AuthAuthProfileGet_0()

Get personal profile with roles and posts

Get detailed profile including roles and posts.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    try {
      Object result = apiInstance.getProfileApiV1AuthAuthProfileGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#getProfileApiV1AuthAuthProfileGet_0");
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

<a id="getUserInfoApiV1AuthAuthInfoGet"></a>
# **getUserInfoApiV1AuthAuthInfoGet**
> Object getUserInfoApiV1AuthAuthInfoGet()

Get current user info

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    try {
      Object result = apiInstance.getUserInfoApiV1AuthAuthInfoGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#getUserInfoApiV1AuthAuthInfoGet");
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

<a id="getUserInfoApiV1AuthAuthInfoGet_0"></a>
# **getUserInfoApiV1AuthAuthInfoGet_0**
> Object getUserInfoApiV1AuthAuthInfoGet_0()

Get current user info

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    try {
      Object result = apiInstance.getUserInfoApiV1AuthAuthInfoGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#getUserInfoApiV1AuthAuthInfoGet_0");
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

<a id="loginApiV1AuthAuthLoginPost"></a>
# **loginApiV1AuthAuthLoginPost**
> Object loginApiV1AuthAuthLoginPost(phone, password)

Password login

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    String phone = "phone_example"; // String | 
    String password = "password_example"; // String | 
    try {
      Object result = apiInstance.loginApiV1AuthAuthLoginPost(phone, password);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#loginApiV1AuthAuthLoginPost");
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
| **phone** | **String**|  | |
| **password** | **String**|  | [optional] |

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

<a id="loginApiV1AuthAuthLoginPost_0"></a>
# **loginApiV1AuthAuthLoginPost_0**
> Object loginApiV1AuthAuthLoginPost_0(phone, password)

Password login

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    String phone = "phone_example"; // String | 
    String password = "password_example"; // String | 
    try {
      Object result = apiInstance.loginApiV1AuthAuthLoginPost_0(phone, password);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#loginApiV1AuthAuthLoginPost_0");
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
| **phone** | **String**|  | |
| **password** | **String**|  | [optional] |

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

<a id="loginSmsApiV1AuthAuthLoginSmsPost"></a>
# **loginSmsApiV1AuthAuthLoginSmsPost**
> Object loginSmsApiV1AuthAuthLoginSmsPost(phone, code)

SMS code login

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    String phone = "phone_example"; // String | 
    String code = "code_example"; // String | 
    try {
      Object result = apiInstance.loginSmsApiV1AuthAuthLoginSmsPost(phone, code);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#loginSmsApiV1AuthAuthLoginSmsPost");
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
| **phone** | **String**|  | |
| **code** | **String**|  | |

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

<a id="loginSmsApiV1AuthAuthLoginSmsPost_0"></a>
# **loginSmsApiV1AuthAuthLoginSmsPost_0**
> Object loginSmsApiV1AuthAuthLoginSmsPost_0(phone, code)

SMS code login

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    String phone = "phone_example"; // String | 
    String code = "code_example"; // String | 
    try {
      Object result = apiInstance.loginSmsApiV1AuthAuthLoginSmsPost_0(phone, code);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#loginSmsApiV1AuthAuthLoginSmsPost_0");
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
| **phone** | **String**|  | |
| **code** | **String**|  | |

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

<a id="logoutApiV1AuthAuthLogoutPost"></a>
# **logoutApiV1AuthAuthLogoutPost**
> Object logoutApiV1AuthAuthLogoutPost()

Logout

登出 - 把当前 token 加入黑名单, 立即失效.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    try {
      Object result = apiInstance.logoutApiV1AuthAuthLogoutPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#logoutApiV1AuthAuthLogoutPost");
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

<a id="logoutApiV1AuthAuthLogoutPost_0"></a>
# **logoutApiV1AuthAuthLogoutPost_0**
> Object logoutApiV1AuthAuthLogoutPost_0()

Logout

登出 - 把当前 token 加入黑名单, 立即失效.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    try {
      Object result = apiInstance.logoutApiV1AuthAuthLogoutPost_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#logoutApiV1AuthAuthLogoutPost_0");
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

<a id="refreshTokenApiV1AuthAuthRefreshPost"></a>
# **refreshTokenApiV1AuthAuthRefreshPost**
> Object refreshTokenApiV1AuthAuthRefreshPost(refreshToken)

Refresh access token (rotate)

使用 refresh token 轮转颁发新 access + refresh.  安全机制 (Bug-53 rotate_refresh):   - 旧 refresh 立即进入黑名单 (Redis SET, 7 天 TTL)   - 检测同 jti 二次使用 → 整 family 失效 + 上报重放告警   - 同 family 内的旧 jti 都失效, 用户必须重新登录

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    String refreshToken = "refreshToken_example"; // String | 
    try {
      Object result = apiInstance.refreshTokenApiV1AuthAuthRefreshPost(refreshToken);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#refreshTokenApiV1AuthAuthRefreshPost");
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
| **refreshToken** | **String**|  | |

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

<a id="refreshTokenApiV1AuthAuthRefreshPost_0"></a>
# **refreshTokenApiV1AuthAuthRefreshPost_0**
> Object refreshTokenApiV1AuthAuthRefreshPost_0(refreshToken)

Refresh access token (rotate)

使用 refresh token 轮转颁发新 access + refresh.  安全机制 (Bug-53 rotate_refresh):   - 旧 refresh 立即进入黑名单 (Redis SET, 7 天 TTL)   - 检测同 jti 二次使用 → 整 family 失效 + 上报重放告警   - 同 family 内的旧 jti 都失效, 用户必须重新登录

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    String refreshToken = "refreshToken_example"; // String | 
    try {
      Object result = apiInstance.refreshTokenApiV1AuthAuthRefreshPost_0(refreshToken);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#refreshTokenApiV1AuthAuthRefreshPost_0");
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
| **refreshToken** | **String**|  | |

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

<a id="registerApiV1AuthAuthRegisterPost"></a>
# **registerApiV1AuthAuthRegisterPost**
> Object registerApiV1AuthAuthRegisterPost(phone, password, nickname)

Register new user

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    String phone = "phone_example"; // String | 
    String password = "password_example"; // String | 
    String nickname = "nickname_example"; // String | 
    try {
      Object result = apiInstance.registerApiV1AuthAuthRegisterPost(phone, password, nickname);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#registerApiV1AuthAuthRegisterPost");
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
| **phone** | **String**|  | |
| **password** | **String**|  | |
| **nickname** | **String**|  | [optional] |

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

<a id="registerApiV1AuthAuthRegisterPost_0"></a>
# **registerApiV1AuthAuthRegisterPost_0**
> Object registerApiV1AuthAuthRegisterPost_0(phone, password, nickname)

Register new user

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    String phone = "phone_example"; // String | 
    String password = "password_example"; // String | 
    String nickname = "nickname_example"; // String | 
    try {
      Object result = apiInstance.registerApiV1AuthAuthRegisterPost_0(phone, password, nickname);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#registerApiV1AuthAuthRegisterPost_0");
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
| **phone** | **String**|  | |
| **password** | **String**|  | |
| **nickname** | **String**|  | [optional] |

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

<a id="sendCodeApiV1AuthAuthSmsCodePost"></a>
# **sendCodeApiV1AuthAuthSmsCodePost**
> Object sendCodeApiV1AuthAuthSmsCodePost(phone)

Send SMS verification code

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    String phone = "phone_example"; // String | 
    try {
      Object result = apiInstance.sendCodeApiV1AuthAuthSmsCodePost(phone);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#sendCodeApiV1AuthAuthSmsCodePost");
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
| **phone** | **String**|  | |

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

<a id="sendCodeApiV1AuthAuthSmsCodePost_0"></a>
# **sendCodeApiV1AuthAuthSmsCodePost_0**
> Object sendCodeApiV1AuthAuthSmsCodePost_0(phone)

Send SMS verification code

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    String phone = "phone_example"; // String | 
    try {
      Object result = apiInstance.sendCodeApiV1AuthAuthSmsCodePost_0(phone);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#sendCodeApiV1AuthAuthSmsCodePost_0");
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
| **phone** | **String**|  | |

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

<a id="updateProfileApiV1AuthAuthProfilePut"></a>
# **updateProfileApiV1AuthAuthProfilePut**
> Object updateProfileApiV1AuthAuthProfilePut(bodyUpdateProfileApiV1AuthAuthProfilePut)

Update personal profile

Update user profile fields (nickname, email, gender).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    BodyUpdateProfileApiV1AuthAuthProfilePut bodyUpdateProfileApiV1AuthAuthProfilePut = new BodyUpdateProfileApiV1AuthAuthProfilePut(); // BodyUpdateProfileApiV1AuthAuthProfilePut | 
    try {
      Object result = apiInstance.updateProfileApiV1AuthAuthProfilePut(bodyUpdateProfileApiV1AuthAuthProfilePut);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#updateProfileApiV1AuthAuthProfilePut");
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
| **bodyUpdateProfileApiV1AuthAuthProfilePut** | [**BodyUpdateProfileApiV1AuthAuthProfilePut**](BodyUpdateProfileApiV1AuthAuthProfilePut.md)|  | [optional] |

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

<a id="updateProfileApiV1AuthAuthProfilePut_0"></a>
# **updateProfileApiV1AuthAuthProfilePut_0**
> Object updateProfileApiV1AuthAuthProfilePut_0(bodyUpdateProfileApiV1AuthAuthProfilePut)

Update personal profile

Update user profile fields (nickname, email, gender).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    BodyUpdateProfileApiV1AuthAuthProfilePut bodyUpdateProfileApiV1AuthAuthProfilePut = new BodyUpdateProfileApiV1AuthAuthProfilePut(); // BodyUpdateProfileApiV1AuthAuthProfilePut | 
    try {
      Object result = apiInstance.updateProfileApiV1AuthAuthProfilePut_0(bodyUpdateProfileApiV1AuthAuthProfilePut);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#updateProfileApiV1AuthAuthProfilePut_0");
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
| **bodyUpdateProfileApiV1AuthAuthProfilePut** | [**BodyUpdateProfileApiV1AuthAuthProfilePut**](BodyUpdateProfileApiV1AuthAuthProfilePut.md)|  | [optional] |

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

<a id="uploadAvatarApiV1AuthAuthProfileAvatarPost"></a>
# **uploadAvatarApiV1AuthAuthProfileAvatarPost**
> Object uploadAvatarApiV1AuthAuthProfileAvatarPost(_file)

Upload avatar

Upload avatar image to MinIO and update user record.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    File _file = new File("/path/to/file"); // File | 
    try {
      Object result = apiInstance.uploadAvatarApiV1AuthAuthProfileAvatarPost(_file);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#uploadAvatarApiV1AuthAuthProfileAvatarPost");
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

<a id="uploadAvatarApiV1AuthAuthProfileAvatarPost_0"></a>
# **uploadAvatarApiV1AuthAuthProfileAvatarPost_0**
> Object uploadAvatarApiV1AuthAuthProfileAvatarPost_0(_file)

Upload avatar

Upload avatar image to MinIO and update user record.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AuthenticationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AuthenticationApi apiInstance = new AuthenticationApi(defaultClient);
    File _file = new File("/path/to/file"); // File | 
    try {
      Object result = apiInstance.uploadAvatarApiV1AuthAuthProfileAvatarPost_0(_file);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AuthenticationApi#uploadAvatarApiV1AuthAuthProfileAvatarPost_0");
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

