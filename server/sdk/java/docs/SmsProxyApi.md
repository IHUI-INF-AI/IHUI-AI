# SmsProxyApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getProxyConfigApiV1ApiSmsProxyConfigGet**](SmsProxyApi.md#getProxyConfigApiV1ApiSmsProxyConfigGet) | **GET** /api/v1/api/sms-proxy/config | Get Proxy Config |
| [**quickRegisterApiV1ApiSmsProxyRegisterPost**](SmsProxyApi.md#quickRegisterApiV1ApiSmsProxyRegisterPost) | **POST** /api/v1/api/sms-proxy/register | Quick Register |
| [**sendSmsCodeApiV1ApiSmsProxySendPost**](SmsProxyApi.md#sendSmsCodeApiV1ApiSmsProxySendPost) | **POST** /api/v1/api/sms-proxy/send | Send Sms Code |
| [**verifySmsCodeApiV1ApiSmsProxyVerifyPost**](SmsProxyApi.md#verifySmsCodeApiV1ApiSmsProxyVerifyPost) | **POST** /api/v1/api/sms-proxy/verify | Verify Sms Code |


<a id="getProxyConfigApiV1ApiSmsProxyConfigGet"></a>
# **getProxyConfigApiV1ApiSmsProxyConfigGet**
> Object getProxyConfigApiV1ApiSmsProxyConfigGet()

Get Proxy Config

Return SMS proxy configuration.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SmsProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SmsProxyApi apiInstance = new SmsProxyApi(defaultClient);
    try {
      Object result = apiInstance.getProxyConfigApiV1ApiSmsProxyConfigGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SmsProxyApi#getProxyConfigApiV1ApiSmsProxyConfigGet");
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

<a id="quickRegisterApiV1ApiSmsProxyRegisterPost"></a>
# **quickRegisterApiV1ApiSmsProxyRegisterPost**
> Object quickRegisterApiV1ApiSmsProxyRegisterPost(registerRequest)

Quick Register

Quick register: verify code then register user.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SmsProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SmsProxyApi apiInstance = new SmsProxyApi(defaultClient);
    RegisterRequest registerRequest = new RegisterRequest(); // RegisterRequest | 
    try {
      Object result = apiInstance.quickRegisterApiV1ApiSmsProxyRegisterPost(registerRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SmsProxyApi#quickRegisterApiV1ApiSmsProxyRegisterPost");
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
| **registerRequest** | [**RegisterRequest**](RegisterRequest.md)|  | |

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

<a id="sendSmsCodeApiV1ApiSmsProxySendPost"></a>
# **sendSmsCodeApiV1ApiSmsProxySendPost**
> Object sendSmsCodeApiV1ApiSmsProxySendPost(smsVerifyRequest)

Send Sms Code

Send SMS verification code (proxy).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SmsProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SmsProxyApi apiInstance = new SmsProxyApi(defaultClient);
    SmsVerifyRequest smsVerifyRequest = new SmsVerifyRequest(); // SmsVerifyRequest | 
    try {
      Object result = apiInstance.sendSmsCodeApiV1ApiSmsProxySendPost(smsVerifyRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SmsProxyApi#sendSmsCodeApiV1ApiSmsProxySendPost");
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
| **smsVerifyRequest** | [**SmsVerifyRequest**](SmsVerifyRequest.md)|  | |

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

<a id="verifySmsCodeApiV1ApiSmsProxyVerifyPost"></a>
# **verifySmsCodeApiV1ApiSmsProxyVerifyPost**
> Object verifySmsCodeApiV1ApiSmsProxyVerifyPost(smsCodeVerifyRequest)

Verify Sms Code

Verify SMS code (proxy).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SmsProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SmsProxyApi apiInstance = new SmsProxyApi(defaultClient);
    SmsCodeVerifyRequest smsCodeVerifyRequest = new SmsCodeVerifyRequest(); // SmsCodeVerifyRequest | 
    try {
      Object result = apiInstance.verifySmsCodeApiV1ApiSmsProxyVerifyPost(smsCodeVerifyRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SmsProxyApi#verifySmsCodeApiV1ApiSmsProxyVerifyPost");
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
| **smsCodeVerifyRequest** | [**SmsCodeVerifyRequest**](SmsCodeVerifyRequest.md)|  | |

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

