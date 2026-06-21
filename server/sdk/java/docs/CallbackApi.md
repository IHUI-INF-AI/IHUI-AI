# CallbackApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**callCallbackApiV1CallbackCallPost**](CallbackApi.md#callCallbackApiV1CallbackCallPost) | **POST** /api/v1/callback/call | 外呼回调 |
| [**callCallbackApiV1CallbackCallPost_0**](CallbackApi.md#callCallbackApiV1CallbackCallPost_0) | **POST** /api/v1/callback/call | 外呼回调 |
| [**callbackLogList**](CallbackApi.md#callbackLogList) | **GET** /api/v1/callback/log/list | 回调日志 |
| [**callbackLogList_0**](CallbackApi.md#callbackLogList_0) | **GET** /api/v1/callback/log/list | 回调日志 |
| [**logDetailApiV1CallbackLogLidGet**](CallbackApi.md#logDetailApiV1CallbackLogLidGet) | **GET** /api/v1/callback/log/{lid} | 回调详情 |
| [**logDetailApiV1CallbackLogLidGet_0**](CallbackApi.md#logDetailApiV1CallbackLogLidGet_0) | **GET** /api/v1/callback/log/{lid} | 回调详情 |
| [**paymentCallbackApiV1CallbackPaymentPost**](CallbackApi.md#paymentCallbackApiV1CallbackPaymentPost) | **POST** /api/v1/callback/payment | 支付回调 |
| [**paymentCallbackApiV1CallbackPaymentPost_0**](CallbackApi.md#paymentCallbackApiV1CallbackPaymentPost_0) | **POST** /api/v1/callback/payment | 支付回调 |
| [**smsCallbackApiV1CallbackSmsPost**](CallbackApi.md#smsCallbackApiV1CallbackSmsPost) | **POST** /api/v1/callback/sms | 短信回调 |
| [**smsCallbackApiV1CallbackSmsPost_0**](CallbackApi.md#smsCallbackApiV1CallbackSmsPost_0) | **POST** /api/v1/callback/sms | 短信回调 |


<a id="callCallbackApiV1CallbackCallPost"></a>
# **callCallbackApiV1CallbackCallPost**
> Object callCallbackApiV1CallbackCallPost(bizId, bizType, source, bodyCallCallbackApiV1CallbackCallPost)

外呼回调

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CallbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CallbackApi apiInstance = new CallbackApi(defaultClient);
    String bizId = "bizId_example"; // String | 
    String bizType = "call"; // String | 
    String source = "source_example"; // String | 
    BodyCallCallbackApiV1CallbackCallPost bodyCallCallbackApiV1CallbackCallPost = new BodyCallCallbackApiV1CallbackCallPost(); // BodyCallCallbackApiV1CallbackCallPost | 
    try {
      Object result = apiInstance.callCallbackApiV1CallbackCallPost(bizId, bizType, source, bodyCallCallbackApiV1CallbackCallPost);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CallbackApi#callCallbackApiV1CallbackCallPost");
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
| **bizId** | **String**|  | [optional] |
| **bizType** | **String**|  | [optional] [default to call] |
| **source** | **String**|  | [optional] |
| **bodyCallCallbackApiV1CallbackCallPost** | [**BodyCallCallbackApiV1CallbackCallPost**](BodyCallCallbackApiV1CallbackCallPost.md)|  | [optional] |

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

<a id="callCallbackApiV1CallbackCallPost_0"></a>
# **callCallbackApiV1CallbackCallPost_0**
> Object callCallbackApiV1CallbackCallPost_0(bizId, bizType, source, bodyCallCallbackApiV1CallbackCallPost)

外呼回调

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CallbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CallbackApi apiInstance = new CallbackApi(defaultClient);
    String bizId = "bizId_example"; // String | 
    String bizType = "call"; // String | 
    String source = "source_example"; // String | 
    BodyCallCallbackApiV1CallbackCallPost bodyCallCallbackApiV1CallbackCallPost = new BodyCallCallbackApiV1CallbackCallPost(); // BodyCallCallbackApiV1CallbackCallPost | 
    try {
      Object result = apiInstance.callCallbackApiV1CallbackCallPost_0(bizId, bizType, source, bodyCallCallbackApiV1CallbackCallPost);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CallbackApi#callCallbackApiV1CallbackCallPost_0");
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
| **bizId** | **String**|  | [optional] |
| **bizType** | **String**|  | [optional] [default to call] |
| **source** | **String**|  | [optional] |
| **bodyCallCallbackApiV1CallbackCallPost** | [**BodyCallCallbackApiV1CallbackCallPost**](BodyCallCallbackApiV1CallbackCallPost.md)|  | [optional] |

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

<a id="callbackLogList"></a>
# **callbackLogList**
> Object callbackLogList(page, limit, bizType, source, status)

回调日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CallbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CallbackApi apiInstance = new CallbackApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String bizType = "bizType_example"; // String | 
    String source = "source_example"; // String | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.callbackLogList(page, limit, bizType, source, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CallbackApi#callbackLogList");
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
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **bizType** | **String**|  | [optional] |
| **source** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |

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

<a id="callbackLogList_0"></a>
# **callbackLogList_0**
> Object callbackLogList_0(page, limit, bizType, source, status)

回调日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CallbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CallbackApi apiInstance = new CallbackApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String bizType = "bizType_example"; // String | 
    String source = "source_example"; // String | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.callbackLogList_0(page, limit, bizType, source, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CallbackApi#callbackLogList_0");
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
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **bizType** | **String**|  | [optional] |
| **source** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |

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

<a id="logDetailApiV1CallbackLogLidGet"></a>
# **logDetailApiV1CallbackLogLidGet**
> Object logDetailApiV1CallbackLogLidGet(lid)

回调详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CallbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CallbackApi apiInstance = new CallbackApi(defaultClient);
    Integer lid = 56; // Integer | 
    try {
      Object result = apiInstance.logDetailApiV1CallbackLogLidGet(lid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CallbackApi#logDetailApiV1CallbackLogLidGet");
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
| **lid** | **Integer**|  | |

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

<a id="logDetailApiV1CallbackLogLidGet_0"></a>
# **logDetailApiV1CallbackLogLidGet_0**
> Object logDetailApiV1CallbackLogLidGet_0(lid)

回调详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CallbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CallbackApi apiInstance = new CallbackApi(defaultClient);
    Integer lid = 56; // Integer | 
    try {
      Object result = apiInstance.logDetailApiV1CallbackLogLidGet_0(lid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CallbackApi#logDetailApiV1CallbackLogLidGet_0");
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
| **lid** | **Integer**|  | |

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

<a id="paymentCallbackApiV1CallbackPaymentPost"></a>
# **paymentCallbackApiV1CallbackPaymentPost**
> Object paymentCallbackApiV1CallbackPaymentPost(bizId, bodyPaymentCallbackApiV1CallbackPaymentPost)

支付回调

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CallbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CallbackApi apiInstance = new CallbackApi(defaultClient);
    String bizId = "bizId_example"; // String | 
    BodyPaymentCallbackApiV1CallbackPaymentPost bodyPaymentCallbackApiV1CallbackPaymentPost = new BodyPaymentCallbackApiV1CallbackPaymentPost(); // BodyPaymentCallbackApiV1CallbackPaymentPost | 
    try {
      Object result = apiInstance.paymentCallbackApiV1CallbackPaymentPost(bizId, bodyPaymentCallbackApiV1CallbackPaymentPost);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CallbackApi#paymentCallbackApiV1CallbackPaymentPost");
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
| **bizId** | **String**|  | [optional] |
| **bodyPaymentCallbackApiV1CallbackPaymentPost** | [**BodyPaymentCallbackApiV1CallbackPaymentPost**](BodyPaymentCallbackApiV1CallbackPaymentPost.md)|  | [optional] |

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

<a id="paymentCallbackApiV1CallbackPaymentPost_0"></a>
# **paymentCallbackApiV1CallbackPaymentPost_0**
> Object paymentCallbackApiV1CallbackPaymentPost_0(bizId, bodyPaymentCallbackApiV1CallbackPaymentPost)

支付回调

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CallbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CallbackApi apiInstance = new CallbackApi(defaultClient);
    String bizId = "bizId_example"; // String | 
    BodyPaymentCallbackApiV1CallbackPaymentPost bodyPaymentCallbackApiV1CallbackPaymentPost = new BodyPaymentCallbackApiV1CallbackPaymentPost(); // BodyPaymentCallbackApiV1CallbackPaymentPost | 
    try {
      Object result = apiInstance.paymentCallbackApiV1CallbackPaymentPost_0(bizId, bodyPaymentCallbackApiV1CallbackPaymentPost);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CallbackApi#paymentCallbackApiV1CallbackPaymentPost_0");
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
| **bizId** | **String**|  | [optional] |
| **bodyPaymentCallbackApiV1CallbackPaymentPost** | [**BodyPaymentCallbackApiV1CallbackPaymentPost**](BodyPaymentCallbackApiV1CallbackPaymentPost.md)|  | [optional] |

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

<a id="smsCallbackApiV1CallbackSmsPost"></a>
# **smsCallbackApiV1CallbackSmsPost**
> Object smsCallbackApiV1CallbackSmsPost(bizId, bodySmsCallbackApiV1CallbackSmsPost)

短信回调

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CallbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CallbackApi apiInstance = new CallbackApi(defaultClient);
    String bizId = "bizId_example"; // String | 
    BodySmsCallbackApiV1CallbackSmsPost bodySmsCallbackApiV1CallbackSmsPost = new BodySmsCallbackApiV1CallbackSmsPost(); // BodySmsCallbackApiV1CallbackSmsPost | 
    try {
      Object result = apiInstance.smsCallbackApiV1CallbackSmsPost(bizId, bodySmsCallbackApiV1CallbackSmsPost);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CallbackApi#smsCallbackApiV1CallbackSmsPost");
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
| **bizId** | **String**|  | [optional] |
| **bodySmsCallbackApiV1CallbackSmsPost** | [**BodySmsCallbackApiV1CallbackSmsPost**](BodySmsCallbackApiV1CallbackSmsPost.md)|  | [optional] |

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

<a id="smsCallbackApiV1CallbackSmsPost_0"></a>
# **smsCallbackApiV1CallbackSmsPost_0**
> Object smsCallbackApiV1CallbackSmsPost_0(bizId, bodySmsCallbackApiV1CallbackSmsPost)

短信回调

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CallbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CallbackApi apiInstance = new CallbackApi(defaultClient);
    String bizId = "bizId_example"; // String | 
    BodySmsCallbackApiV1CallbackSmsPost bodySmsCallbackApiV1CallbackSmsPost = new BodySmsCallbackApiV1CallbackSmsPost(); // BodySmsCallbackApiV1CallbackSmsPost | 
    try {
      Object result = apiInstance.smsCallbackApiV1CallbackSmsPost_0(bizId, bodySmsCallbackApiV1CallbackSmsPost);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CallbackApi#smsCallbackApiV1CallbackSmsPost_0");
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
| **bizId** | **String**|  | [optional] |
| **bodySmsCallbackApiV1CallbackSmsPost** | [**BodySmsCallbackApiV1CallbackSmsPost**](BodySmsCallbackApiV1CallbackSmsPost.md)|  | [optional] |

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

