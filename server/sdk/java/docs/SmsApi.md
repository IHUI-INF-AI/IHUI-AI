# SmsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**sendCodeApiV1AuthSmsSendPost**](SmsApi.md#sendCodeApiV1AuthSmsSendPost) | **POST** /api/v1/auth/sms/send | Send SMS code |
| [**sendCodeApiV1AuthSmsSendPost_0**](SmsApi.md#sendCodeApiV1AuthSmsSendPost_0) | **POST** /api/v1/auth/sms/send | Send SMS code |
| [**verifyCodeApiV1AuthSmsVerifyPost**](SmsApi.md#verifyCodeApiV1AuthSmsVerifyPost) | **POST** /api/v1/auth/sms/verify | Verify SMS code |
| [**verifyCodeApiV1AuthSmsVerifyPost_0**](SmsApi.md#verifyCodeApiV1AuthSmsVerifyPost_0) | **POST** /api/v1/auth/sms/verify | Verify SMS code |


<a id="sendCodeApiV1AuthSmsSendPost"></a>
# **sendCodeApiV1AuthSmsSendPost**
> Object sendCodeApiV1AuthSmsSendPost(phone)

Send SMS code

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SmsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SmsApi apiInstance = new SmsApi(defaultClient);
    String phone = "phone_example"; // String | 
    try {
      Object result = apiInstance.sendCodeApiV1AuthSmsSendPost(phone);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SmsApi#sendCodeApiV1AuthSmsSendPost");
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

<a id="sendCodeApiV1AuthSmsSendPost_0"></a>
# **sendCodeApiV1AuthSmsSendPost_0**
> Object sendCodeApiV1AuthSmsSendPost_0(phone)

Send SMS code

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SmsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SmsApi apiInstance = new SmsApi(defaultClient);
    String phone = "phone_example"; // String | 
    try {
      Object result = apiInstance.sendCodeApiV1AuthSmsSendPost_0(phone);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SmsApi#sendCodeApiV1AuthSmsSendPost_0");
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

<a id="verifyCodeApiV1AuthSmsVerifyPost"></a>
# **verifyCodeApiV1AuthSmsVerifyPost**
> Object verifyCodeApiV1AuthSmsVerifyPost(phone, code)

Verify SMS code

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SmsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SmsApi apiInstance = new SmsApi(defaultClient);
    String phone = "phone_example"; // String | 
    String code = "code_example"; // String | 
    try {
      Object result = apiInstance.verifyCodeApiV1AuthSmsVerifyPost(phone, code);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SmsApi#verifyCodeApiV1AuthSmsVerifyPost");
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

<a id="verifyCodeApiV1AuthSmsVerifyPost_0"></a>
# **verifyCodeApiV1AuthSmsVerifyPost_0**
> Object verifyCodeApiV1AuthSmsVerifyPost_0(phone, code)

Verify SMS code

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SmsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SmsApi apiInstance = new SmsApi(defaultClient);
    String phone = "phone_example"; // String | 
    String code = "code_example"; // String | 
    try {
      Object result = apiInstance.verifyCodeApiV1AuthSmsVerifyPost_0(phone, code);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SmsApi#verifyCodeApiV1AuthSmsVerifyPost_0");
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

