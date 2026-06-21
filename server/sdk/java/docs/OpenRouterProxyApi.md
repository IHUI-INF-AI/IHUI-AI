# OpenRouterProxyApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**creditsApiV1OpenrouterProxyCreditsGet**](OpenRouterProxyApi.md#creditsApiV1OpenrouterProxyCreditsGet) | **GET** /api/v1/openrouter-proxy/credits | 账户额度 |
| [**creditsApiV1OpenrouterProxyCreditsGet_0**](OpenRouterProxyApi.md#creditsApiV1OpenrouterProxyCreditsGet_0) | **GET** /api/v1/openrouter-proxy/credits | 账户额度 |
| [**openrouterChat**](OpenRouterProxyApi.md#openrouterChat) | **POST** /api/v1/openrouter-proxy/chat | OpenRouter对话 |
| [**openrouterChat_0**](OpenRouterProxyApi.md#openrouterChat_0) | **POST** /api/v1/openrouter-proxy/chat | OpenRouter对话 |
| [**openrouterCompletion**](OpenRouterProxyApi.md#openrouterCompletion) | **POST** /api/v1/openrouter-proxy/completion | OpenRouter文本补全 |
| [**openrouterCompletion_0**](OpenRouterProxyApi.md#openrouterCompletion_0) | **POST** /api/v1/openrouter-proxy/completion | OpenRouter文本补全 |
| [**openrouterEmbeddings**](OpenRouterProxyApi.md#openrouterEmbeddings) | **POST** /api/v1/openrouter-proxy/embeddings | OpenRouter Embeddings |
| [**openrouterEmbeddings_0**](OpenRouterProxyApi.md#openrouterEmbeddings_0) | **POST** /api/v1/openrouter-proxy/embeddings | OpenRouter Embeddings |
| [**openrouterModels**](OpenRouterProxyApi.md#openrouterModels) | **GET** /api/v1/openrouter-proxy/models | 可用模型列表 |
| [**openrouterModels_0**](OpenRouterProxyApi.md#openrouterModels_0) | **GET** /api/v1/openrouter-proxy/models | 可用模型列表 |


<a id="creditsApiV1OpenrouterProxyCreditsGet"></a>
# **creditsApiV1OpenrouterProxyCreditsGet**
> Object creditsApiV1OpenrouterProxyCreditsGet(apiKey)

账户额度

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OpenRouterProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OpenRouterProxyApi apiInstance = new OpenRouterProxyApi(defaultClient);
    String apiKey = ""; // String | 
    try {
      Object result = apiInstance.creditsApiV1OpenrouterProxyCreditsGet(apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OpenRouterProxyApi#creditsApiV1OpenrouterProxyCreditsGet");
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
| **apiKey** | **String**|  | [optional] [default to ] |

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

<a id="creditsApiV1OpenrouterProxyCreditsGet_0"></a>
# **creditsApiV1OpenrouterProxyCreditsGet_0**
> Object creditsApiV1OpenrouterProxyCreditsGet_0(apiKey)

账户额度

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OpenRouterProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OpenRouterProxyApi apiInstance = new OpenRouterProxyApi(defaultClient);
    String apiKey = ""; // String | 
    try {
      Object result = apiInstance.creditsApiV1OpenrouterProxyCreditsGet_0(apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OpenRouterProxyApi#creditsApiV1OpenrouterProxyCreditsGet_0");
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
| **apiKey** | **String**|  | [optional] [default to ] |

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

<a id="openrouterChat"></a>
# **openrouterChat**
> Object openrouterChat(bodyOpenrouterChat, apiKey)

OpenRouter对话

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OpenRouterProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OpenRouterProxyApi apiInstance = new OpenRouterProxyApi(defaultClient);
    BodyOpenrouterChat bodyOpenrouterChat = new BodyOpenrouterChat(); // BodyOpenrouterChat | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.openrouterChat(bodyOpenrouterChat, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OpenRouterProxyApi#openrouterChat");
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
| **bodyOpenrouterChat** | [**BodyOpenrouterChat**](BodyOpenrouterChat.md)|  | |
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

<a id="openrouterChat_0"></a>
# **openrouterChat_0**
> Object openrouterChat_0(bodyOpenrouterChat, apiKey)

OpenRouter对话

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OpenRouterProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OpenRouterProxyApi apiInstance = new OpenRouterProxyApi(defaultClient);
    BodyOpenrouterChat bodyOpenrouterChat = new BodyOpenrouterChat(); // BodyOpenrouterChat | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.openrouterChat_0(bodyOpenrouterChat, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OpenRouterProxyApi#openrouterChat_0");
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
| **bodyOpenrouterChat** | [**BodyOpenrouterChat**](BodyOpenrouterChat.md)|  | |
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

<a id="openrouterCompletion"></a>
# **openrouterCompletion**
> Object openrouterCompletion(bodyOpenrouterCompletion, apiKey)

OpenRouter文本补全

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OpenRouterProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OpenRouterProxyApi apiInstance = new OpenRouterProxyApi(defaultClient);
    BodyOpenrouterCompletion bodyOpenrouterCompletion = new BodyOpenrouterCompletion(); // BodyOpenrouterCompletion | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.openrouterCompletion(bodyOpenrouterCompletion, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OpenRouterProxyApi#openrouterCompletion");
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
| **bodyOpenrouterCompletion** | [**BodyOpenrouterCompletion**](BodyOpenrouterCompletion.md)|  | |
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

<a id="openrouterCompletion_0"></a>
# **openrouterCompletion_0**
> Object openrouterCompletion_0(bodyOpenrouterCompletion, apiKey)

OpenRouter文本补全

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OpenRouterProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OpenRouterProxyApi apiInstance = new OpenRouterProxyApi(defaultClient);
    BodyOpenrouterCompletion bodyOpenrouterCompletion = new BodyOpenrouterCompletion(); // BodyOpenrouterCompletion | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.openrouterCompletion_0(bodyOpenrouterCompletion, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OpenRouterProxyApi#openrouterCompletion_0");
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
| **bodyOpenrouterCompletion** | [**BodyOpenrouterCompletion**](BodyOpenrouterCompletion.md)|  | |
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

<a id="openrouterEmbeddings"></a>
# **openrouterEmbeddings**
> Object openrouterEmbeddings(bodyOpenrouterEmbeddings, apiKey)

OpenRouter Embeddings

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OpenRouterProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OpenRouterProxyApi apiInstance = new OpenRouterProxyApi(defaultClient);
    BodyOpenrouterEmbeddings bodyOpenrouterEmbeddings = new BodyOpenrouterEmbeddings(); // BodyOpenrouterEmbeddings | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.openrouterEmbeddings(bodyOpenrouterEmbeddings, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OpenRouterProxyApi#openrouterEmbeddings");
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
| **bodyOpenrouterEmbeddings** | [**BodyOpenrouterEmbeddings**](BodyOpenrouterEmbeddings.md)|  | |
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

<a id="openrouterEmbeddings_0"></a>
# **openrouterEmbeddings_0**
> Object openrouterEmbeddings_0(bodyOpenrouterEmbeddings, apiKey)

OpenRouter Embeddings

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OpenRouterProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OpenRouterProxyApi apiInstance = new OpenRouterProxyApi(defaultClient);
    BodyOpenrouterEmbeddings bodyOpenrouterEmbeddings = new BodyOpenrouterEmbeddings(); // BodyOpenrouterEmbeddings | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.openrouterEmbeddings_0(bodyOpenrouterEmbeddings, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OpenRouterProxyApi#openrouterEmbeddings_0");
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
| **bodyOpenrouterEmbeddings** | [**BodyOpenrouterEmbeddings**](BodyOpenrouterEmbeddings.md)|  | |
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

<a id="openrouterModels"></a>
# **openrouterModels**
> Object openrouterModels()

可用模型列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OpenRouterProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OpenRouterProxyApi apiInstance = new OpenRouterProxyApi(defaultClient);
    try {
      Object result = apiInstance.openrouterModels();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OpenRouterProxyApi#openrouterModels");
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

<a id="openrouterModels_0"></a>
# **openrouterModels_0**
> Object openrouterModels_0()

可用模型列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.OpenRouterProxyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    OpenRouterProxyApi apiInstance = new OpenRouterProxyApi(defaultClient);
    try {
      Object result = apiInstance.openrouterModels_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling OpenRouterProxyApi#openrouterModels_0");
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

