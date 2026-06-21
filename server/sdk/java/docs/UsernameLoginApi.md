# UsernameLoginApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**loginByUsernameApiV1LoginUsernamePost**](UsernameLoginApi.md#loginByUsernameApiV1LoginUsernamePost) | **POST** /api/v1/login/username | 用户名密码登录 (内置 admin/ry) |


<a id="loginByUsernameApiV1LoginUsernamePost"></a>
# **loginByUsernameApiV1LoginUsernamePost**
> Object loginByUsernameApiV1LoginUsernamePost(username, password)

用户名密码登录 (内置 admin/ry)

前端演示登录: 用户名 + 密码, 返回 JWT + 用户信息.  对应 Java: AdminLoginController.login (若依版).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UsernameLoginApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UsernameLoginApi apiInstance = new UsernameLoginApi(defaultClient);
    String username = "username_example"; // String | 用户名 (admin / ry)
    String password = "password_example"; // String | 明文密码
    try {
      Object result = apiInstance.loginByUsernameApiV1LoginUsernamePost(username, password);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UsernameLoginApi#loginByUsernameApiV1LoginUsernamePost");
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
| **username** | **String**| 用户名 (admin / ry) | |
| **password** | **String**| 明文密码 | |

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

