# AccountBindingsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**listBindingsApiV1AuthAuthBindingsGet**](AccountBindingsApi.md#listBindingsApiV1AuthAuthBindingsGet) | **GET** /api/v1/auth/auth/bindings/ | List all third-party bindings |
| [**listBindingsApiV1AuthAuthBindingsGet_0**](AccountBindingsApi.md#listBindingsApiV1AuthAuthBindingsGet_0) | **GET** /api/v1/auth/auth/bindings/ | List all third-party bindings |
| [**removeByPlatformApiV1AuthAuthBindingsRemovePost**](AccountBindingsApi.md#removeByPlatformApiV1AuthAuthBindingsRemovePost) | **POST** /api/v1/auth/auth/bindings/remove | Unbind third-party account by platform |
| [**removeByPlatformApiV1AuthAuthBindingsRemovePost_0**](AccountBindingsApi.md#removeByPlatformApiV1AuthAuthBindingsRemovePost_0) | **POST** /api/v1/auth/auth/bindings/remove | Unbind third-party account by platform |
| [**unbindApiV1AuthAuthBindingsBindingIdDelete**](AccountBindingsApi.md#unbindApiV1AuthAuthBindingsBindingIdDelete) | **DELETE** /api/v1/auth/auth/bindings/{binding_id} | Unbind third-party account by ID |
| [**unbindApiV1AuthAuthBindingsBindingIdDelete_0**](AccountBindingsApi.md#unbindApiV1AuthAuthBindingsBindingIdDelete_0) | **DELETE** /api/v1/auth/auth/bindings/{binding_id} | Unbind third-party account by ID |


<a id="listBindingsApiV1AuthAuthBindingsGet"></a>
# **listBindingsApiV1AuthAuthBindingsGet**
> Object listBindingsApiV1AuthAuthBindingsGet()

List all third-party bindings

Get all third-party account bindings for the current user.  Matches Java: AuthorizationManagementServlet.getList(uuid)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AccountBindingsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AccountBindingsApi apiInstance = new AccountBindingsApi(defaultClient);
    try {
      Object result = apiInstance.listBindingsApiV1AuthAuthBindingsGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AccountBindingsApi#listBindingsApiV1AuthAuthBindingsGet");
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

<a id="listBindingsApiV1AuthAuthBindingsGet_0"></a>
# **listBindingsApiV1AuthAuthBindingsGet_0**
> Object listBindingsApiV1AuthAuthBindingsGet_0()

List all third-party bindings

Get all third-party account bindings for the current user.  Matches Java: AuthorizationManagementServlet.getList(uuid)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AccountBindingsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AccountBindingsApi apiInstance = new AccountBindingsApi(defaultClient);
    try {
      Object result = apiInstance.listBindingsApiV1AuthAuthBindingsGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AccountBindingsApi#listBindingsApiV1AuthAuthBindingsGet_0");
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

<a id="removeByPlatformApiV1AuthAuthBindingsRemovePost"></a>
# **removeByPlatformApiV1AuthAuthBindingsRemovePost**
> Object removeByPlatformApiV1AuthAuthBindingsRemovePost(bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost)

Unbind third-party account by platform

Remove a third-party account binding by uuid + platform.  Matches Java: AuthorizationManagementController.delAuth -&gt; AuthorizationManagementServlet.delAuth(uuid, platform) SQL: DELETE FROM user_third_party_accounts WHERE user_uuid &#x3D; #{uuid} AND platform &#x3D; #{platform}

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AccountBindingsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AccountBindingsApi apiInstance = new AccountBindingsApi(defaultClient);
    BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost = new BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost(); // BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost | 
    try {
      Object result = apiInstance.removeByPlatformApiV1AuthAuthBindingsRemovePost(bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AccountBindingsApi#removeByPlatformApiV1AuthAuthBindingsRemovePost");
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
| **bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost** | [**BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost**](BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="removeByPlatformApiV1AuthAuthBindingsRemovePost_0"></a>
# **removeByPlatformApiV1AuthAuthBindingsRemovePost_0**
> Object removeByPlatformApiV1AuthAuthBindingsRemovePost_0(bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost)

Unbind third-party account by platform

Remove a third-party account binding by uuid + platform.  Matches Java: AuthorizationManagementController.delAuth -&gt; AuthorizationManagementServlet.delAuth(uuid, platform) SQL: DELETE FROM user_third_party_accounts WHERE user_uuid &#x3D; #{uuid} AND platform &#x3D; #{platform}

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AccountBindingsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AccountBindingsApi apiInstance = new AccountBindingsApi(defaultClient);
    BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost = new BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost(); // BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost | 
    try {
      Object result = apiInstance.removeByPlatformApiV1AuthAuthBindingsRemovePost_0(bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AccountBindingsApi#removeByPlatformApiV1AuthAuthBindingsRemovePost_0");
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
| **bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost** | [**BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost**](BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="unbindApiV1AuthAuthBindingsBindingIdDelete"></a>
# **unbindApiV1AuthAuthBindingsBindingIdDelete**
> Object unbindApiV1AuthAuthBindingsBindingIdDelete(bindingId)

Unbind third-party account by ID

Remove a third-party account binding by ID.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AccountBindingsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AccountBindingsApi apiInstance = new AccountBindingsApi(defaultClient);
    Integer bindingId = 56; // Integer | 
    try {
      Object result = apiInstance.unbindApiV1AuthAuthBindingsBindingIdDelete(bindingId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AccountBindingsApi#unbindApiV1AuthAuthBindingsBindingIdDelete");
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
| **bindingId** | **Integer**|  | |

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

<a id="unbindApiV1AuthAuthBindingsBindingIdDelete_0"></a>
# **unbindApiV1AuthAuthBindingsBindingIdDelete_0**
> Object unbindApiV1AuthAuthBindingsBindingIdDelete_0(bindingId)

Unbind third-party account by ID

Remove a third-party account binding by ID.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AccountBindingsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AccountBindingsApi apiInstance = new AccountBindingsApi(defaultClient);
    Integer bindingId = 56; // Integer | 
    try {
      Object result = apiInstance.unbindApiV1AuthAuthBindingsBindingIdDelete_0(bindingId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AccountBindingsApi#unbindApiV1AuthAuthBindingsBindingIdDelete_0");
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
| **bindingId** | **Integer**|  | |

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

