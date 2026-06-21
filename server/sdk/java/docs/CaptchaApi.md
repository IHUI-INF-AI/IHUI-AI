# CaptchaApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getCaptchaApiV1AuthCaptchaGet**](CaptchaApi.md#getCaptchaApiV1AuthCaptchaGet) | **GET** /api/v1/auth/captcha | 获取验证码图片 |
| [**verifyCaptchaEndpointApiV1AuthCaptchaVerifyPost**](CaptchaApi.md#verifyCaptchaEndpointApiV1AuthCaptchaVerifyPost) | **POST** /api/v1/auth/captcha/verify | 校验验证码 |


<a id="getCaptchaApiV1AuthCaptchaGet"></a>
# **getCaptchaApiV1AuthCaptchaGet**
> Object getCaptchaApiV1AuthCaptchaGet()

获取验证码图片

Generate a new image captcha.  Returns a &#x60;&#x60;captcha_key&#x60;&#x60; (to send back on login) and a base64-encoded PNG image string (to render in an &#x60;&#x60;&lt;img&gt;&#x60;&#x60; tag).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CaptchaApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CaptchaApi apiInstance = new CaptchaApi(defaultClient);
    try {
      Object result = apiInstance.getCaptchaApiV1AuthCaptchaGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CaptchaApi#getCaptchaApiV1AuthCaptchaGet");
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

<a id="verifyCaptchaEndpointApiV1AuthCaptchaVerifyPost"></a>
# **verifyCaptchaEndpointApiV1AuthCaptchaVerifyPost**
> Object verifyCaptchaEndpointApiV1AuthCaptchaVerifyPost(captchaVerifyRequest)

校验验证码

Verify a captcha submission.  Returns success/failure.  Each captcha can only be verified once.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CaptchaApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CaptchaApi apiInstance = new CaptchaApi(defaultClient);
    CaptchaVerifyRequest captchaVerifyRequest = new CaptchaVerifyRequest(); // CaptchaVerifyRequest | 
    try {
      Object result = apiInstance.verifyCaptchaEndpointApiV1AuthCaptchaVerifyPost(captchaVerifyRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CaptchaApi#verifyCaptchaEndpointApiV1AuthCaptchaVerifyPost");
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
| **captchaVerifyRequest** | [**CaptchaVerifyRequest**](CaptchaVerifyRequest.md)|  | |

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

