# AliLoginApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**aliPcWxCodeApiV1AuthLoginAliPcWxCodeGet**](AliLoginApi.md#aliPcWxCodeApiV1AuthLoginAliPcWxCodeGet) | **GET** /api/v1/auth/login/ali/pc/wxCode | Ali Pc Wx Code |
| [**aliWebWxCodeApiV1AuthLoginAliWebWxCodeGet**](AliLoginApi.md#aliWebWxCodeApiV1AuthLoginAliWebWxCodeGet) | **GET** /api/v1/auth/login/ali/web/wxCode | Ali Web Wx Code |


<a id="aliPcWxCodeApiV1AuthLoginAliPcWxCodeGet"></a>
# **aliPcWxCodeApiV1AuthLoginAliPcWxCodeGet**
> Object aliPcWxCodeApiV1AuthLoginAliPcWxCodeGet(code)

Ali Pc Wx Code

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AliLoginApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AliLoginApi apiInstance = new AliLoginApi(defaultClient);
    String code = "code_example"; // String | Alipay auth code
    try {
      Object result = apiInstance.aliPcWxCodeApiV1AuthLoginAliPcWxCodeGet(code);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AliLoginApi#aliPcWxCodeApiV1AuthLoginAliPcWxCodeGet");
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
| **code** | **String**| Alipay auth code | |

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

<a id="aliWebWxCodeApiV1AuthLoginAliWebWxCodeGet"></a>
# **aliWebWxCodeApiV1AuthLoginAliWebWxCodeGet**
> Object aliWebWxCodeApiV1AuthLoginAliWebWxCodeGet(authCode)

Ali Web Wx Code

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AliLoginApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AliLoginApi apiInstance = new AliLoginApi(defaultClient);
    String authCode = "authCode_example"; // String | Alipay web auth code
    try {
      Object result = apiInstance.aliWebWxCodeApiV1AuthLoginAliWebWxCodeGet(authCode);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AliLoginApi#aliWebWxCodeApiV1AuthLoginAliWebWxCodeGet");
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
| **authCode** | **String**| Alipay web auth code | |

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

