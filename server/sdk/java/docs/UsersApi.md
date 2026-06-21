# UsersApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getProfileApiV1UserInfoGet**](UsersApi.md#getProfileApiV1UserInfoGet) | **GET** /api/v1/user/info | Get current user profile |
| [**updateProfileApiV1UserUpdatePut**](UsersApi.md#updateProfileApiV1UserUpdatePut) | **PUT** /api/v1/user/update | Update user profile |


<a id="getProfileApiV1UserInfoGet"></a>
# **getProfileApiV1UserInfoGet**
> Object getProfileApiV1UserInfoGet()

Get current user profile

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UsersApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    UsersApi apiInstance = new UsersApi(defaultClient);
    try {
      Object result = apiInstance.getProfileApiV1UserInfoGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UsersApi#getProfileApiV1UserInfoGet");
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

<a id="updateProfileApiV1UserUpdatePut"></a>
# **updateProfileApiV1UserUpdatePut**
> Object updateProfileApiV1UserUpdatePut(nickname, avatar, gender)

Update user profile

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UsersApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    UsersApi apiInstance = new UsersApi(defaultClient);
    String nickname = "nickname_example"; // String | 
    String avatar = "avatar_example"; // String | 
    Integer gender = 56; // Integer | 
    try {
      Object result = apiInstance.updateProfileApiV1UserUpdatePut(nickname, avatar, gender);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UsersApi#updateProfileApiV1UserUpdatePut");
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
| **nickname** | **String**|  | [optional] |
| **avatar** | **String**|  | [optional] |
| **gender** | **Integer**|  | [optional] |

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

