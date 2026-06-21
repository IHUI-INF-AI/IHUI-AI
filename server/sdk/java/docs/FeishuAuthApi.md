# FeishuAuthApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**feishuPcTestApiV1AuthLoginFeishuPcTestGet**](FeishuAuthApi.md#feishuPcTestApiV1AuthLoginFeishuPcTestGet) | **GET** /api/v1/auth/login/feishu/pc/test | Feishu Pc Test |
| [**feishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet**](FeishuAuthApi.md#feishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet) | **GET** /api/v1/auth/login/feishu/pc/wxCode | Feishu Pc Wx Code |


<a id="feishuPcTestApiV1AuthLoginFeishuPcTestGet"></a>
# **feishuPcTestApiV1AuthLoginFeishuPcTestGet**
> Object feishuPcTestApiV1AuthLoginFeishuPcTestGet(code)

Feishu Pc Test

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FeishuAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FeishuAuthApi apiInstance = new FeishuAuthApi(defaultClient);
    String code = "code_example"; // String | test code
    try {
      Object result = apiInstance.feishuPcTestApiV1AuthLoginFeishuPcTestGet(code);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FeishuAuthApi#feishuPcTestApiV1AuthLoginFeishuPcTestGet");
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
| **code** | **String**| test code | |

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

<a id="feishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet"></a>
# **feishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet**
> Object feishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet(code)

Feishu Pc Wx Code

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FeishuAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FeishuAuthApi apiInstance = new FeishuAuthApi(defaultClient);
    String code = "code_example"; // String | Feishu auth code
    try {
      Object result = apiInstance.feishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet(code);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FeishuAuthApi#feishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet");
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
| **code** | **String**| Feishu auth code | |

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

