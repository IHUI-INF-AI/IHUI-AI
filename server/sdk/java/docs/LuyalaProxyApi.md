# LuyalaProxyApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**luyalaChat**](LuyalaProxyApi.md#luyalaChat) | **POST** /api/v1/luyala-proxy/chat | 露雅拉对话 |
| [**luyalaChat_0**](LuyalaProxyApi.md#luyalaChat_0) | **POST** /api/v1/luyala-proxy/chat | 露雅拉对话 |
| [**luyalaCompletion**](LuyalaProxyApi.md#luyalaCompletion) | **POST** /api/v1/luyala-proxy/completion | 露雅拉文本补全 |
| [**luyalaCompletion_0**](LuyalaProxyApi.md#luyalaCompletion_0) | **POST** /api/v1/luyala-proxy/completion | 露雅拉文本补全 |
| [**luyalaEmbeddings**](LuyalaProxyApi.md#luyalaEmbeddings) | **POST** /api/v1/luyala-proxy/embeddings | 露雅拉Embedding |
| [**luyalaEmbeddings_0**](LuyalaProxyApi.md#luyalaEmbeddings_0) | **POST** /api/v1/luyala-proxy/embeddings | 露雅拉Embedding |
| [**luyalaModels**](LuyalaProxyApi.md#luyalaModels) | **GET** /api/v1/luyala-proxy/models | 可用模型列表 |
| [**luyalaModels_0**](LuyalaProxyApi.md#luyalaModels_0) | **GET** /api/v1/luyala-proxy/models | 可用模型列表 |


<a id="luyalaChat"></a>
# **luyalaChat**
> Object luyalaChat(bodyLuyalaChat, apiKey)

露雅拉对话

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LuyalaProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LuyalaProxyApi apiInstance = new LuyalaProxyApi(defaultClient);
    BodyLuyalaChat bodyLuyalaChat = new BodyLuyalaChat(); // BodyLuyalaChat | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.luyalaChat(bodyLuyalaChat, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LuyalaProxyApi#luyalaChat");
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
| **bodyLuyalaChat** | [**BodyLuyalaChat**](BodyLuyalaChat.md)|  | |
| **apiKey** | **String**|  | [optional] |

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

<a id="luyalaChat_0"></a>
# **luyalaChat_0**
> Object luyalaChat_0(bodyLuyalaChat, apiKey)

露雅拉对话

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LuyalaProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LuyalaProxyApi apiInstance = new LuyalaProxyApi(defaultClient);
    BodyLuyalaChat bodyLuyalaChat = new BodyLuyalaChat(); // BodyLuyalaChat | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.luyalaChat_0(bodyLuyalaChat, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LuyalaProxyApi#luyalaChat_0");
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
| **bodyLuyalaChat** | [**BodyLuyalaChat**](BodyLuyalaChat.md)|  | |
| **apiKey** | **String**|  | [optional] |

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

<a id="luyalaCompletion"></a>
# **luyalaCompletion**
> Object luyalaCompletion(bodyLuyalaCompletion, apiKey)

露雅拉文本补全

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LuyalaProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LuyalaProxyApi apiInstance = new LuyalaProxyApi(defaultClient);
    BodyLuyalaCompletion bodyLuyalaCompletion = new BodyLuyalaCompletion(); // BodyLuyalaCompletion | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.luyalaCompletion(bodyLuyalaCompletion, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LuyalaProxyApi#luyalaCompletion");
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
| **bodyLuyalaCompletion** | [**BodyLuyalaCompletion**](BodyLuyalaCompletion.md)|  | |
| **apiKey** | **String**|  | [optional] |

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

<a id="luyalaCompletion_0"></a>
# **luyalaCompletion_0**
> Object luyalaCompletion_0(bodyLuyalaCompletion, apiKey)

露雅拉文本补全

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LuyalaProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LuyalaProxyApi apiInstance = new LuyalaProxyApi(defaultClient);
    BodyLuyalaCompletion bodyLuyalaCompletion = new BodyLuyalaCompletion(); // BodyLuyalaCompletion | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.luyalaCompletion_0(bodyLuyalaCompletion, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LuyalaProxyApi#luyalaCompletion_0");
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
| **bodyLuyalaCompletion** | [**BodyLuyalaCompletion**](BodyLuyalaCompletion.md)|  | |
| **apiKey** | **String**|  | [optional] |

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

<a id="luyalaEmbeddings"></a>
# **luyalaEmbeddings**
> Object luyalaEmbeddings(bodyLuyalaEmbeddings, apiKey)

露雅拉Embedding

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LuyalaProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LuyalaProxyApi apiInstance = new LuyalaProxyApi(defaultClient);
    BodyLuyalaEmbeddings bodyLuyalaEmbeddings = new BodyLuyalaEmbeddings(); // BodyLuyalaEmbeddings | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.luyalaEmbeddings(bodyLuyalaEmbeddings, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LuyalaProxyApi#luyalaEmbeddings");
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
| **bodyLuyalaEmbeddings** | [**BodyLuyalaEmbeddings**](BodyLuyalaEmbeddings.md)|  | |
| **apiKey** | **String**|  | [optional] |

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

<a id="luyalaEmbeddings_0"></a>
# **luyalaEmbeddings_0**
> Object luyalaEmbeddings_0(bodyLuyalaEmbeddings, apiKey)

露雅拉Embedding

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LuyalaProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LuyalaProxyApi apiInstance = new LuyalaProxyApi(defaultClient);
    BodyLuyalaEmbeddings bodyLuyalaEmbeddings = new BodyLuyalaEmbeddings(); // BodyLuyalaEmbeddings | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.luyalaEmbeddings_0(bodyLuyalaEmbeddings, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LuyalaProxyApi#luyalaEmbeddings_0");
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
| **bodyLuyalaEmbeddings** | [**BodyLuyalaEmbeddings**](BodyLuyalaEmbeddings.md)|  | |
| **apiKey** | **String**|  | [optional] |

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

<a id="luyalaModels"></a>
# **luyalaModels**
> Object luyalaModels()

可用模型列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LuyalaProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LuyalaProxyApi apiInstance = new LuyalaProxyApi(defaultClient);
    try {
      Object result = apiInstance.luyalaModels();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LuyalaProxyApi#luyalaModels");
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

<a id="luyalaModels_0"></a>
# **luyalaModels_0**
> Object luyalaModels_0()

可用模型列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LuyalaProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LuyalaProxyApi apiInstance = new LuyalaProxyApi(defaultClient);
    try {
      Object result = apiInstance.luyalaModels_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LuyalaProxyApi#luyalaModels_0");
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

