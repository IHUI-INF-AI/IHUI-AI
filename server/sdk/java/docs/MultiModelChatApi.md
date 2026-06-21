# MultiModelChatApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**listVendorsApiV1ChatVendorsGet**](MultiModelChatApi.md#listVendorsApiV1ChatVendorsGet) | **GET** /api/v1/chat/vendors | 列出支持的 AI 厂商 |
| [**multiVendorChatApiV1ChatMultiPost**](MultiModelChatApi.md#multiVendorChatApiV1ChatMultiPost) | **POST** /api/v1/chat/multi | 同时调用多个厂商并返回结果列表（用于对比评测） |
| [**vendorChatApiV1ChatVendorChatPost**](MultiModelChatApi.md#vendorChatApiV1ChatVendorChatPost) | **POST** /api/v1/chat/{vendor}/chat | 多厂商同步聊天 |
| [**vendorChatStreamApiV1ChatVendorChatStreamPost**](MultiModelChatApi.md#vendorChatStreamApiV1ChatVendorChatStreamPost) | **POST** /api/v1/chat/{vendor}/chat/stream | 多厂商流式聊天（SSE） |


<a id="listVendorsApiV1ChatVendorsGet"></a>
# **listVendorsApiV1ChatVendorsGet**
> Object listVendorsApiV1ChatVendorsGet()

列出支持的 AI 厂商

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MultiModelChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MultiModelChatApi apiInstance = new MultiModelChatApi(defaultClient);
    try {
      Object result = apiInstance.listVendorsApiV1ChatVendorsGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MultiModelChatApi#listVendorsApiV1ChatVendorsGet");
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

<a id="multiVendorChatApiV1ChatMultiPost"></a>
# **multiVendorChatApiV1ChatMultiPost**
> Object multiVendorChatApiV1ChatMultiPost(vendors, message, model)

同时调用多个厂商并返回结果列表（用于对比评测）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MultiModelChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MultiModelChatApi apiInstance = new MultiModelChatApi(defaultClient);
    String vendors = "vendors_example"; // String | 逗号分隔的厂商列表，如 zhipu,openrouter
    String message = "message_example"; // String | 
    String model = "gpt-3.5-turbo"; // String | 
    try {
      Object result = apiInstance.multiVendorChatApiV1ChatMultiPost(vendors, message, model);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MultiModelChatApi#multiVendorChatApiV1ChatMultiPost");
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
| **vendors** | **String**| 逗号分隔的厂商列表，如 zhipu,openrouter | |
| **message** | **String**|  | |
| **model** | **String**|  | [optional] [default to gpt-3.5-turbo] |

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

<a id="vendorChatApiV1ChatVendorChatPost"></a>
# **vendorChatApiV1ChatVendorChatPost**
> Object vendorChatApiV1ChatVendorChatPost(vendor, model, message)

多厂商同步聊天

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MultiModelChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MultiModelChatApi apiInstance = new MultiModelChatApi(defaultClient);
    String vendor = "vendor_example"; // String | 
    String model = "model_example"; // String | 
    String message = "message_example"; // String | 
    try {
      Object result = apiInstance.vendorChatApiV1ChatVendorChatPost(vendor, model, message);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MultiModelChatApi#vendorChatApiV1ChatVendorChatPost");
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
| **vendor** | **String**|  | |
| **model** | **String**|  | |
| **message** | **String**|  | |

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

<a id="vendorChatStreamApiV1ChatVendorChatStreamPost"></a>
# **vendorChatStreamApiV1ChatVendorChatStreamPost**
> Object vendorChatStreamApiV1ChatVendorChatStreamPost(vendor, model, message)

多厂商流式聊天（SSE）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MultiModelChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MultiModelChatApi apiInstance = new MultiModelChatApi(defaultClient);
    String vendor = "vendor_example"; // String | 
    String model = "model_example"; // String | 
    String message = "message_example"; // String | 
    try {
      Object result = apiInstance.vendorChatStreamApiV1ChatVendorChatStreamPost(vendor, model, message);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MultiModelChatApi#vendorChatStreamApiV1ChatVendorChatStreamPost");
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
| **vendor** | **String**|  | |
| **model** | **String**|  | |
| **message** | **String**|  | |

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

