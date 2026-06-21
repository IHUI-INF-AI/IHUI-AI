# OAuthApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**authorizeApiV1AuthOauthAuthorizeGet**](OAuthApi.md#authorizeApiV1AuthOauthAuthorizeGet) | **GET** /api/v1/auth/oauth/authorize | OAuth authorize |
| [**authorizeApiV1AuthOauthAuthorizeGet_0**](OAuthApi.md#authorizeApiV1AuthOauthAuthorizeGet_0) | **GET** /api/v1/auth/oauth/authorize | OAuth authorize |
| [**createOauthAppApiV1AuthOauthAppsCreatePost**](OAuthApi.md#createOauthAppApiV1AuthOauthAppsCreatePost) | **POST** /api/v1/auth/oauth/apps/create | Create an OAuth application |
| [**createOauthAppApiV1AuthOauthAppsCreatePost_0**](OAuthApi.md#createOauthAppApiV1AuthOauthAppsCreatePost_0) | **POST** /api/v1/auth/oauth/apps/create | Create an OAuth application |
| [**deleteOauthAppApiV1AuthOauthAppsClientIdDelete**](OAuthApi.md#deleteOauthAppApiV1AuthOauthAppsClientIdDelete) | **DELETE** /api/v1/auth/oauth/apps/{client_id} | Delete OAuth application |
| [**deleteOauthAppApiV1AuthOauthAppsClientIdDelete_0**](OAuthApi.md#deleteOauthAppApiV1AuthOauthAppsClientIdDelete_0) | **DELETE** /api/v1/auth/oauth/apps/{client_id} | Delete OAuth application |
| [**getOauthAppApiV1AuthOauthAppsClientIdGet**](OAuthApi.md#getOauthAppApiV1AuthOauthAppsClientIdGet) | **GET** /api/v1/auth/oauth/apps/{client_id} | Get OAuth application by client_id |
| [**getOauthAppApiV1AuthOauthAppsClientIdGet_0**](OAuthApi.md#getOauthAppApiV1AuthOauthAppsClientIdGet_0) | **GET** /api/v1/auth/oauth/apps/{client_id} | Get OAuth application by client_id |
| [**getOauthUserApiV1AuthOauthUsersUserIdGet**](OAuthApi.md#getOauthUserApiV1AuthOauthUsersUserIdGet) | **GET** /api/v1/auth/oauth/users/{user_id} | OAuth 用户详情 |
| [**getOauthUserApiV1AuthOauthUsersUserIdGet_0**](OAuthApi.md#getOauthUserApiV1AuthOauthUsersUserIdGet_0) | **GET** /api/v1/auth/oauth/users/{user_id} | OAuth 用户详情 |
| [**listOauthAppsApiV1AuthOauthAppsListGet**](OAuthApi.md#listOauthAppsApiV1AuthOauthAppsListGet) | **GET** /api/v1/auth/oauth/apps/list | List OAuth applications |
| [**listOauthAppsApiV1AuthOauthAppsListGet_0**](OAuthApi.md#listOauthAppsApiV1AuthOauthAppsListGet_0) | **GET** /api/v1/auth/oauth/apps/list | List OAuth applications |
| [**listOauthUsersApiV1AuthOauthUsersListGet**](OAuthApi.md#listOauthUsersApiV1AuthOauthUsersListGet) | **GET** /api/v1/auth/oauth/users/list | OAuth 用户列表 |
| [**listOauthUsersApiV1AuthOauthUsersListGet_0**](OAuthApi.md#listOauthUsersApiV1AuthOauthUsersListGet_0) | **GET** /api/v1/auth/oauth/users/list | OAuth 用户列表 |
| [**oauthTokenApiV1AuthOauthTokenPost**](OAuthApi.md#oauthTokenApiV1AuthOauthTokenPost) | **POST** /api/v1/auth/oauth/token | Exchange code for token |
| [**oauthTokenApiV1AuthOauthTokenPost_0**](OAuthApi.md#oauthTokenApiV1AuthOauthTokenPost_0) | **POST** /api/v1/auth/oauth/token | Exchange code for token |


<a id="authorizeApiV1AuthOauthAuthorizeGet"></a>
# **authorizeApiV1AuthOauthAuthorizeGet**
> Object authorizeApiV1AuthOauthAuthorizeGet(clientId, redirectUri, responseType, state)

OAuth authorize

OAuth authorize. State 参数用于 CSRF 防护,客户端必须传并在回调时校验.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    OAuthApi apiInstance = new OAuthApi(defaultClient);
    String clientId = "clientId_example"; // String | 
    String redirectUri = "redirectUri_example"; // String | 
    String responseType = "code"; // String | 
    String state = "state_example"; // String | CSRF state parameter
    try {
      Object result = apiInstance.authorizeApiV1AuthOauthAuthorizeGet(clientId, redirectUri, responseType, state);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OAuthApi#authorizeApiV1AuthOauthAuthorizeGet");
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
| **clientId** | **String**|  | |
| **redirectUri** | **String**|  | |
| **responseType** | **String**|  | [optional] [default to code] |
| **state** | **String**| CSRF state parameter | [optional] |

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

<a id="authorizeApiV1AuthOauthAuthorizeGet_0"></a>
# **authorizeApiV1AuthOauthAuthorizeGet_0**
> Object authorizeApiV1AuthOauthAuthorizeGet_0(clientId, redirectUri, responseType, state)

OAuth authorize

OAuth authorize. State 参数用于 CSRF 防护,客户端必须传并在回调时校验.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    OAuthApi apiInstance = new OAuthApi(defaultClient);
    String clientId = "clientId_example"; // String | 
    String redirectUri = "redirectUri_example"; // String | 
    String responseType = "code"; // String | 
    String state = "state_example"; // String | CSRF state parameter
    try {
      Object result = apiInstance.authorizeApiV1AuthOauthAuthorizeGet_0(clientId, redirectUri, responseType, state);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OAuthApi#authorizeApiV1AuthOauthAuthorizeGet_0");
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
| **clientId** | **String**|  | |
| **redirectUri** | **String**|  | |
| **responseType** | **String**|  | [optional] [default to code] |
| **state** | **String**| CSRF state parameter | [optional] |

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

<a id="createOauthAppApiV1AuthOauthAppsCreatePost"></a>
# **createOauthAppApiV1AuthOauthAppsCreatePost**
> Object createOauthAppApiV1AuthOauthAppsCreatePost(oauthAppCreateBody)

Create an OAuth application

Register a new OAuth application and return client credentials.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    OAuthApi apiInstance = new OAuthApi(defaultClient);
    OAuthAppCreateBody oauthAppCreateBody = new OAuthAppCreateBody(); // OAuthAppCreateBody | 
    try {
      Object result = apiInstance.createOauthAppApiV1AuthOauthAppsCreatePost(oauthAppCreateBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OAuthApi#createOauthAppApiV1AuthOauthAppsCreatePost");
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
| **oauthAppCreateBody** | [**OAuthAppCreateBody**](OAuthAppCreateBody.md)|  | |

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

<a id="createOauthAppApiV1AuthOauthAppsCreatePost_0"></a>
# **createOauthAppApiV1AuthOauthAppsCreatePost_0**
> Object createOauthAppApiV1AuthOauthAppsCreatePost_0(oauthAppCreateBody)

Create an OAuth application

Register a new OAuth application and return client credentials.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    OAuthApi apiInstance = new OAuthApi(defaultClient);
    OAuthAppCreateBody oauthAppCreateBody = new OAuthAppCreateBody(); // OAuthAppCreateBody | 
    try {
      Object result = apiInstance.createOauthAppApiV1AuthOauthAppsCreatePost_0(oauthAppCreateBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OAuthApi#createOauthAppApiV1AuthOauthAppsCreatePost_0");
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
| **oauthAppCreateBody** | [**OAuthAppCreateBody**](OAuthAppCreateBody.md)|  | |

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

<a id="deleteOauthAppApiV1AuthOauthAppsClientIdDelete"></a>
# **deleteOauthAppApiV1AuthOauthAppsClientIdDelete**
> Object deleteOauthAppApiV1AuthOauthAppsClientIdDelete(clientId)

Delete OAuth application

Delete an OAuth application by its client_id.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    OAuthApi apiInstance = new OAuthApi(defaultClient);
    String clientId = "clientId_example"; // String | 
    try {
      Object result = apiInstance.deleteOauthAppApiV1AuthOauthAppsClientIdDelete(clientId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OAuthApi#deleteOauthAppApiV1AuthOauthAppsClientIdDelete");
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
| **clientId** | **String**|  | |

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

<a id="deleteOauthAppApiV1AuthOauthAppsClientIdDelete_0"></a>
# **deleteOauthAppApiV1AuthOauthAppsClientIdDelete_0**
> Object deleteOauthAppApiV1AuthOauthAppsClientIdDelete_0(clientId)

Delete OAuth application

Delete an OAuth application by its client_id.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    OAuthApi apiInstance = new OAuthApi(defaultClient);
    String clientId = "clientId_example"; // String | 
    try {
      Object result = apiInstance.deleteOauthAppApiV1AuthOauthAppsClientIdDelete_0(clientId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OAuthApi#deleteOauthAppApiV1AuthOauthAppsClientIdDelete_0");
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
| **clientId** | **String**|  | |

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

<a id="getOauthAppApiV1AuthOauthAppsClientIdGet"></a>
# **getOauthAppApiV1AuthOauthAppsClientIdGet**
> Object getOauthAppApiV1AuthOauthAppsClientIdGet(clientId)

Get OAuth application by client_id

Retrieve a single OAuth application by its client_id.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    OAuthApi apiInstance = new OAuthApi(defaultClient);
    String clientId = "clientId_example"; // String | 
    try {
      Object result = apiInstance.getOauthAppApiV1AuthOauthAppsClientIdGet(clientId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OAuthApi#getOauthAppApiV1AuthOauthAppsClientIdGet");
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
| **clientId** | **String**|  | |

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

<a id="getOauthAppApiV1AuthOauthAppsClientIdGet_0"></a>
# **getOauthAppApiV1AuthOauthAppsClientIdGet_0**
> Object getOauthAppApiV1AuthOauthAppsClientIdGet_0(clientId)

Get OAuth application by client_id

Retrieve a single OAuth application by its client_id.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    OAuthApi apiInstance = new OAuthApi(defaultClient);
    String clientId = "clientId_example"; // String | 
    try {
      Object result = apiInstance.getOauthAppApiV1AuthOauthAppsClientIdGet_0(clientId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OAuthApi#getOauthAppApiV1AuthOauthAppsClientIdGet_0");
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
| **clientId** | **String**|  | |

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

<a id="getOauthUserApiV1AuthOauthUsersUserIdGet"></a>
# **getOauthUserApiV1AuthOauthUsersUserIdGet**
> Object getOauthUserApiV1AuthOauthUsersUserIdGet(userId)

OAuth 用户详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    OAuthApi apiInstance = new OAuthApi(defaultClient);
    Integer userId = 56; // Integer | 
    try {
      Object result = apiInstance.getOauthUserApiV1AuthOauthUsersUserIdGet(userId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OAuthApi#getOauthUserApiV1AuthOauthUsersUserIdGet");
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
| **userId** | **Integer**|  | |

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

<a id="getOauthUserApiV1AuthOauthUsersUserIdGet_0"></a>
# **getOauthUserApiV1AuthOauthUsersUserIdGet_0**
> Object getOauthUserApiV1AuthOauthUsersUserIdGet_0(userId)

OAuth 用户详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    OAuthApi apiInstance = new OAuthApi(defaultClient);
    Integer userId = 56; // Integer | 
    try {
      Object result = apiInstance.getOauthUserApiV1AuthOauthUsersUserIdGet_0(userId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OAuthApi#getOauthUserApiV1AuthOauthUsersUserIdGet_0");
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
| **userId** | **Integer**|  | |

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

<a id="listOauthAppsApiV1AuthOauthAppsListGet"></a>
# **listOauthAppsApiV1AuthOauthAppsListGet**
> Object listOauthAppsApiV1AuthOauthAppsListGet(page, limit)

List OAuth applications

List all OAuth applications with pagination.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    OAuthApi apiInstance = new OAuthApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listOauthAppsApiV1AuthOauthAppsListGet(page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OAuthApi#listOauthAppsApiV1AuthOauthAppsListGet");
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

<a id="listOauthAppsApiV1AuthOauthAppsListGet_0"></a>
# **listOauthAppsApiV1AuthOauthAppsListGet_0**
> Object listOauthAppsApiV1AuthOauthAppsListGet_0(page, limit)

List OAuth applications

List all OAuth applications with pagination.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    OAuthApi apiInstance = new OAuthApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listOauthAppsApiV1AuthOauthAppsListGet_0(page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OAuthApi#listOauthAppsApiV1AuthOauthAppsListGet_0");
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

<a id="listOauthUsersApiV1AuthOauthUsersListGet"></a>
# **listOauthUsersApiV1AuthOauthUsersListGet**
> Object listOauthUsersApiV1AuthOauthUsersListGet(page, limit, provider)

OAuth 用户列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    OAuthApi apiInstance = new OAuthApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String provider = "provider_example"; // String | 按 provider 过滤
    try {
      Object result = apiInstance.listOauthUsersApiV1AuthOauthUsersListGet(page, limit, provider);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OAuthApi#listOauthUsersApiV1AuthOauthUsersListGet");
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
| **provider** | **String**| 按 provider 过滤 | [optional] |

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

<a id="listOauthUsersApiV1AuthOauthUsersListGet_0"></a>
# **listOauthUsersApiV1AuthOauthUsersListGet_0**
> Object listOauthUsersApiV1AuthOauthUsersListGet_0(page, limit, provider)

OAuth 用户列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    OAuthApi apiInstance = new OAuthApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String provider = "provider_example"; // String | 按 provider 过滤
    try {
      Object result = apiInstance.listOauthUsersApiV1AuthOauthUsersListGet_0(page, limit, provider);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OAuthApi#listOauthUsersApiV1AuthOauthUsersListGet_0");
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
| **provider** | **String**| 按 provider 过滤 | [optional] |

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

<a id="oauthTokenApiV1AuthOauthTokenPost"></a>
# **oauthTokenApiV1AuthOauthTokenPost**
> Object oauthTokenApiV1AuthOauthTokenPost(code, clientId, clientSecret, state)

Exchange code for token

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OAuthApi apiInstance = new OAuthApi(defaultClient);
    String code = "code_example"; // String | 
    String clientId = "clientId_example"; // String | 
    String clientSecret = "clientSecret_example"; // String | 
    String state = "state_example"; // String | CSRF state to verify against session
    try {
      Object result = apiInstance.oauthTokenApiV1AuthOauthTokenPost(code, clientId, clientSecret, state);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OAuthApi#oauthTokenApiV1AuthOauthTokenPost");
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
| **code** | **String**|  | |
| **clientId** | **String**|  | |
| **clientSecret** | **String**|  | |
| **state** | **String**| CSRF state to verify against session | [optional] |

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

<a id="oauthTokenApiV1AuthOauthTokenPost_0"></a>
# **oauthTokenApiV1AuthOauthTokenPost_0**
> Object oauthTokenApiV1AuthOauthTokenPost_0(code, clientId, clientSecret, state)

Exchange code for token

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OAuthApi apiInstance = new OAuthApi(defaultClient);
    String code = "code_example"; // String | 
    String clientId = "clientId_example"; // String | 
    String clientSecret = "clientSecret_example"; // String | 
    String state = "state_example"; // String | CSRF state to verify against session
    try {
      Object result = apiInstance.oauthTokenApiV1AuthOauthTokenPost_0(code, clientId, clientSecret, state);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OAuthApi#oauthTokenApiV1AuthOauthTokenPost_0");
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
| **code** | **String**|  | |
| **clientId** | **String**|  | |
| **clientSecret** | **String**|  | |
| **state** | **String**| CSRF state to verify against session | [optional] |

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

