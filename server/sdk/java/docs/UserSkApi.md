# UserSkApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createSkApiV1AuthUserSkCreatePost**](UserSkApi.md#createSkApiV1AuthUserSkCreatePost) | **POST** /api/v1/auth/user-sk/create | Create a secret key |
| [**createSkApiV1AuthUserSkCreatePost_0**](UserSkApi.md#createSkApiV1AuthUserSkCreatePost_0) | **POST** /api/v1/auth/user-sk/create | Create a secret key |
| [**deleteSkApiV1AuthUserSkSkIdDelete**](UserSkApi.md#deleteSkApiV1AuthUserSkSkIdDelete) | **DELETE** /api/v1/auth/user-sk/{sk_id} | Delete a secret key |
| [**deleteSkApiV1AuthUserSkSkIdDelete_0**](UserSkApi.md#deleteSkApiV1AuthUserSkSkIdDelete_0) | **DELETE** /api/v1/auth/user-sk/{sk_id} | Delete a secret key |
| [**listSksApiV1AuthUserSkListGet**](UserSkApi.md#listSksApiV1AuthUserSkListGet) | **GET** /api/v1/auth/user-sk/list | List user secret keys |
| [**listSksApiV1AuthUserSkListGet_0**](UserSkApi.md#listSksApiV1AuthUserSkListGet_0) | **GET** /api/v1/auth/user-sk/list | List user secret keys |
| [**updateSkApiV1AuthUserSkSkIdPut**](UserSkApi.md#updateSkApiV1AuthUserSkSkIdPut) | **PUT** /api/v1/auth/user-sk/{sk_id} | Update a secret key |
| [**updateSkApiV1AuthUserSkSkIdPut_0**](UserSkApi.md#updateSkApiV1AuthUserSkSkIdPut_0) | **PUT** /api/v1/auth/user-sk/{sk_id} | Update a secret key |


<a id="createSkApiV1AuthUserSkCreatePost"></a>
# **createSkApiV1AuthUserSkCreatePost**
> Object createSkApiV1AuthUserSkCreatePost(body)

Create a secret key

Generate a new secret key for the authenticated user.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserSkApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    UserSkApi apiInstance = new UserSkApi(defaultClient);
    Object body = null; // Object | 
    try {
      Object result = apiInstance.createSkApiV1AuthUserSkCreatePost(body);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserSkApi#createSkApiV1AuthUserSkCreatePost");
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
| **body** | **Object**|  | |

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

<a id="createSkApiV1AuthUserSkCreatePost_0"></a>
# **createSkApiV1AuthUserSkCreatePost_0**
> Object createSkApiV1AuthUserSkCreatePost_0(body)

Create a secret key

Generate a new secret key for the authenticated user.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserSkApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    UserSkApi apiInstance = new UserSkApi(defaultClient);
    Object body = null; // Object | 
    try {
      Object result = apiInstance.createSkApiV1AuthUserSkCreatePost_0(body);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserSkApi#createSkApiV1AuthUserSkCreatePost_0");
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
| **body** | **Object**|  | |

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

<a id="deleteSkApiV1AuthUserSkSkIdDelete"></a>
# **deleteSkApiV1AuthUserSkSkIdDelete**
> Object deleteSkApiV1AuthUserSkSkIdDelete(skId)

Delete a secret key

Delete a secret key owned by the authenticated user.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserSkApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    UserSkApi apiInstance = new UserSkApi(defaultClient);
    Integer skId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteSkApiV1AuthUserSkSkIdDelete(skId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserSkApi#deleteSkApiV1AuthUserSkSkIdDelete");
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
| **skId** | **Integer**|  | |

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

<a id="deleteSkApiV1AuthUserSkSkIdDelete_0"></a>
# **deleteSkApiV1AuthUserSkSkIdDelete_0**
> Object deleteSkApiV1AuthUserSkSkIdDelete_0(skId)

Delete a secret key

Delete a secret key owned by the authenticated user.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserSkApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    UserSkApi apiInstance = new UserSkApi(defaultClient);
    Integer skId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteSkApiV1AuthUserSkSkIdDelete_0(skId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserSkApi#deleteSkApiV1AuthUserSkSkIdDelete_0");
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
| **skId** | **Integer**|  | |

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

<a id="listSksApiV1AuthUserSkListGet"></a>
# **listSksApiV1AuthUserSkListGet**
> Object listSksApiV1AuthUserSkListGet(page, limit)

List user secret keys

List all secret keys for the authenticated user with pagination.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserSkApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    UserSkApi apiInstance = new UserSkApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listSksApiV1AuthUserSkListGet(page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserSkApi#listSksApiV1AuthUserSkListGet");
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

<a id="listSksApiV1AuthUserSkListGet_0"></a>
# **listSksApiV1AuthUserSkListGet_0**
> Object listSksApiV1AuthUserSkListGet_0(page, limit)

List user secret keys

List all secret keys for the authenticated user with pagination.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserSkApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    UserSkApi apiInstance = new UserSkApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listSksApiV1AuthUserSkListGet_0(page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserSkApi#listSksApiV1AuthUserSkListGet_0");
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

<a id="updateSkApiV1AuthUserSkSkIdPut"></a>
# **updateSkApiV1AuthUserSkSkIdPut**
> Object updateSkApiV1AuthUserSkSkIdPut(skId, skUpdateBody)

Update a secret key

Update secret key name or status.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserSkApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    UserSkApi apiInstance = new UserSkApi(defaultClient);
    Integer skId = 56; // Integer | 
    SKUpdateBody skUpdateBody = new SKUpdateBody(); // SKUpdateBody | 
    try {
      Object result = apiInstance.updateSkApiV1AuthUserSkSkIdPut(skId, skUpdateBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserSkApi#updateSkApiV1AuthUserSkSkIdPut");
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
| **skId** | **Integer**|  | |
| **skUpdateBody** | [**SKUpdateBody**](SKUpdateBody.md)|  | |

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

<a id="updateSkApiV1AuthUserSkSkIdPut_0"></a>
# **updateSkApiV1AuthUserSkSkIdPut_0**
> Object updateSkApiV1AuthUserSkSkIdPut_0(skId, skUpdateBody)

Update a secret key

Update secret key name or status.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserSkApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    UserSkApi apiInstance = new UserSkApi(defaultClient);
    Integer skId = 56; // Integer | 
    SKUpdateBody skUpdateBody = new SKUpdateBody(); // SKUpdateBody | 
    try {
      Object result = apiInstance.updateSkApiV1AuthUserSkSkIdPut_0(skId, skUpdateBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserSkApi#updateSkApiV1AuthUserSkSkIdPut_0");
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
| **skId** | **Integer**|  | |
| **skUpdateBody** | [**SKUpdateBody**](SKUpdateBody.md)|  | |

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

