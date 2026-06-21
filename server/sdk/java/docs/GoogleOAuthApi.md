# GoogleOAuthApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**androidWxCodeApiV1AuthGoogleAndroidWxCodeGet**](GoogleOAuthApi.md#androidWxCodeApiV1AuthGoogleAndroidWxCodeGet) | **GET** /api/v1/auth/google/android/wxCode | Google Android 登录 (id_token 直接登录) |
| [**googleConfigStatusApiV1AuthGoogleConfigGet**](GoogleOAuthApi.md#googleConfigStatusApiV1AuthGoogleConfigGet) | **GET** /api/v1/auth/google/config | 返回当前 Google OAuth 配置 (脱敏) |
| [**pcWxCodeApiV1AuthGooglePcWxCodeGet**](GoogleOAuthApi.md#pcWxCodeApiV1AuthGooglePcWxCodeGet) | **GET** /api/v1/auth/google/pc/wxCode | Google PC 登录 (用 code 换 token) |


<a id="androidWxCodeApiV1AuthGoogleAndroidWxCodeGet"></a>
# **androidWxCodeApiV1AuthGoogleAndroidWxCodeGet**
> Object androidWxCodeApiV1AuthGoogleAndroidWxCodeGet(idToken)

Google Android 登录 (id_token 直接登录)

对应 Java: GET /google/android/wxCode?id_token&#x3D;

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.GoogleOAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    GoogleOAuthApi apiInstance = new GoogleOAuthApi(defaultClient);
    String idToken = "idToken_example"; // String | Google id_token
    try {
      Object result = apiInstance.androidWxCodeApiV1AuthGoogleAndroidWxCodeGet(idToken);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling GoogleOAuthApi#androidWxCodeApiV1AuthGoogleAndroidWxCodeGet");
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
| **idToken** | **String**| Google id_token | |

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

<a id="googleConfigStatusApiV1AuthGoogleConfigGet"></a>
# **googleConfigStatusApiV1AuthGoogleConfigGet**
> Object googleConfigStatusApiV1AuthGoogleConfigGet()

返回当前 Google OAuth 配置 (脱敏)

运维端点, 用于确认配置是否加载.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.GoogleOAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    GoogleOAuthApi apiInstance = new GoogleOAuthApi(defaultClient);
    try {
      Object result = apiInstance.googleConfigStatusApiV1AuthGoogleConfigGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling GoogleOAuthApi#googleConfigStatusApiV1AuthGoogleConfigGet");
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

<a id="pcWxCodeApiV1AuthGooglePcWxCodeGet"></a>
# **pcWxCodeApiV1AuthGooglePcWxCodeGet**
> Object pcWxCodeApiV1AuthGooglePcWxCodeGet(code)

Google PC 登录 (用 code 换 token)

对应 Java: GET /google/pc/wxCode?code&#x3D;

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.GoogleOAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    GoogleOAuthApi apiInstance = new GoogleOAuthApi(defaultClient);
    String code = "code_example"; // String | Google 授权码
    try {
      Object result = apiInstance.pcWxCodeApiV1AuthGooglePcWxCodeGet(code);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling GoogleOAuthApi#pcWxCodeApiV1AuthGooglePcWxCodeGet");
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
| **code** | **String**| Google 授权码 | |

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

