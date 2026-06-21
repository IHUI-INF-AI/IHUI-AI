# EnterpriseWeChatApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**enterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost**](EnterpriseWeChatApi.md#enterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost) | **POST** /api/v1/auth/login/enterprise/pc/callback | Enterprise Pc Callback |
| [**enterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet**](EnterpriseWeChatApi.md#enterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet) | **GET** /api/v1/auth/login/enterprise/pc/wxCode | Enterprise Pc Wx Code |


<a id="enterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost"></a>
# **enterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost**
> Object enterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost(msgSignature, timestamp, nonce)

Enterprise Pc Callback

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.EnterpriseWeChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    EnterpriseWeChatApi apiInstance = new EnterpriseWeChatApi(defaultClient);
    String msgSignature = ""; // String | 
    String timestamp = ""; // String | 
    String nonce = ""; // String | 
    try {
      Object result = apiInstance.enterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost(msgSignature, timestamp, nonce);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling EnterpriseWeChatApi#enterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost");
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
| **msgSignature** | **String**|  | [optional] [default to ] |
| **timestamp** | **String**|  | [optional] [default to ] |
| **nonce** | **String**|  | [optional] [default to ] |

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

<a id="enterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet"></a>
# **enterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet**
> Object enterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet(code)

Enterprise Pc Wx Code

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.EnterpriseWeChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    EnterpriseWeChatApi apiInstance = new EnterpriseWeChatApi(defaultClient);
    String code = "code_example"; // String | WeCom js_code
    try {
      Object result = apiInstance.enterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet(code);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling EnterpriseWeChatApi#enterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet");
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
| **code** | **String**| WeCom js_code | |

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

