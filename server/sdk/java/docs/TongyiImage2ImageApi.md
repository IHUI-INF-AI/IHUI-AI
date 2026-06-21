# TongyiImage2ImageApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost**](TongyiImage2ImageApi.md#backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost) | **POST** /api/v1/tongyi-image2image/background-generation | 通义背景生成 |
| [**backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0**](TongyiImage2ImageApi.md#backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0) | **POST** /api/v1/tongyi-image2image/background-generation | 通义背景生成 |
| [**imageToImageApiV1TongyiImage2imageImageToImagePost**](TongyiImage2ImageApi.md#imageToImageApiV1TongyiImage2imageImageToImagePost) | **POST** /api/v1/tongyi-image2image/image-to-image | 通义图生图 |
| [**imageToImageApiV1TongyiImage2imageImageToImagePost_0**](TongyiImage2ImageApi.md#imageToImageApiV1TongyiImage2imageImageToImagePost_0) | **POST** /api/v1/tongyi-image2image/image-to-image | 通义图生图 |
| [**styleTransferApiV1TongyiImage2imageStyleTransferPost**](TongyiImage2ImageApi.md#styleTransferApiV1TongyiImage2imageStyleTransferPost) | **POST** /api/v1/tongyi-image2image/style-transfer | 通义风格迁移 |
| [**styleTransferApiV1TongyiImage2imageStyleTransferPost_0**](TongyiImage2ImageApi.md#styleTransferApiV1TongyiImage2imageStyleTransferPost_0) | **POST** /api/v1/tongyi-image2image/style-transfer | 通义风格迁移 |
| [**tongyiImage2imageListModels**](TongyiImage2ImageApi.md#tongyiImage2imageListModels) | **GET** /api/v1/tongyi-image2image/models | 通义图生图可用模型 |
| [**tongyiImage2imageListModels_0**](TongyiImage2ImageApi.md#tongyiImage2imageListModels_0) | **GET** /api/v1/tongyi-image2image/models | 通义图生图可用模型 |
| [**virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost**](TongyiImage2ImageApi.md#virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost) | **POST** /api/v1/tongyi-image2image/virtual-try-on | 通义虚拟试衣 |
| [**virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0**](TongyiImage2ImageApi.md#virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0) | **POST** /api/v1/tongyi-image2image/virtual-try-on | 通义虚拟试衣 |


<a id="backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost"></a>
# **backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost**
> Object backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost(bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost, apiKey)

通义背景生成

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TongyiImage2ImageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TongyiImage2ImageApi apiInstance = new TongyiImage2ImageApi(defaultClient);
    BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost = new BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost(); // BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost(bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TongyiImage2ImageApi#backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost");
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
| **bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost** | [**BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost**](BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost.md)|  | |
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

<a id="backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0"></a>
# **backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0**
> Object backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0(bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost, apiKey)

通义背景生成

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TongyiImage2ImageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TongyiImage2ImageApi apiInstance = new TongyiImage2ImageApi(defaultClient);
    BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost = new BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost(); // BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0(bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TongyiImage2ImageApi#backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0");
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
| **bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost** | [**BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost**](BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost.md)|  | |
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

<a id="imageToImageApiV1TongyiImage2imageImageToImagePost"></a>
# **imageToImageApiV1TongyiImage2imageImageToImagePost**
> Object imageToImageApiV1TongyiImage2imageImageToImagePost(bodyImageToImageApiV1TongyiImage2imageImageToImagePost, apiKey)

通义图生图

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TongyiImage2ImageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TongyiImage2ImageApi apiInstance = new TongyiImage2ImageApi(defaultClient);
    BodyImageToImageApiV1TongyiImage2imageImageToImagePost bodyImageToImageApiV1TongyiImage2imageImageToImagePost = new BodyImageToImageApiV1TongyiImage2imageImageToImagePost(); // BodyImageToImageApiV1TongyiImage2imageImageToImagePost | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.imageToImageApiV1TongyiImage2imageImageToImagePost(bodyImageToImageApiV1TongyiImage2imageImageToImagePost, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TongyiImage2ImageApi#imageToImageApiV1TongyiImage2imageImageToImagePost");
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
| **bodyImageToImageApiV1TongyiImage2imageImageToImagePost** | [**BodyImageToImageApiV1TongyiImage2imageImageToImagePost**](BodyImageToImageApiV1TongyiImage2imageImageToImagePost.md)|  | |
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

<a id="imageToImageApiV1TongyiImage2imageImageToImagePost_0"></a>
# **imageToImageApiV1TongyiImage2imageImageToImagePost_0**
> Object imageToImageApiV1TongyiImage2imageImageToImagePost_0(bodyImageToImageApiV1TongyiImage2imageImageToImagePost, apiKey)

通义图生图

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TongyiImage2ImageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TongyiImage2ImageApi apiInstance = new TongyiImage2ImageApi(defaultClient);
    BodyImageToImageApiV1TongyiImage2imageImageToImagePost bodyImageToImageApiV1TongyiImage2imageImageToImagePost = new BodyImageToImageApiV1TongyiImage2imageImageToImagePost(); // BodyImageToImageApiV1TongyiImage2imageImageToImagePost | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.imageToImageApiV1TongyiImage2imageImageToImagePost_0(bodyImageToImageApiV1TongyiImage2imageImageToImagePost, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TongyiImage2ImageApi#imageToImageApiV1TongyiImage2imageImageToImagePost_0");
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
| **bodyImageToImageApiV1TongyiImage2imageImageToImagePost** | [**BodyImageToImageApiV1TongyiImage2imageImageToImagePost**](BodyImageToImageApiV1TongyiImage2imageImageToImagePost.md)|  | |
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

<a id="styleTransferApiV1TongyiImage2imageStyleTransferPost"></a>
# **styleTransferApiV1TongyiImage2imageStyleTransferPost**
> Object styleTransferApiV1TongyiImage2imageStyleTransferPost(bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost, apiKey)

通义风格迁移

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TongyiImage2ImageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TongyiImage2ImageApi apiInstance = new TongyiImage2ImageApi(defaultClient);
    BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost = new BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost(); // BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.styleTransferApiV1TongyiImage2imageStyleTransferPost(bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TongyiImage2ImageApi#styleTransferApiV1TongyiImage2imageStyleTransferPost");
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
| **bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost** | [**BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost**](BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost.md)|  | |
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

<a id="styleTransferApiV1TongyiImage2imageStyleTransferPost_0"></a>
# **styleTransferApiV1TongyiImage2imageStyleTransferPost_0**
> Object styleTransferApiV1TongyiImage2imageStyleTransferPost_0(bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost, apiKey)

通义风格迁移

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TongyiImage2ImageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TongyiImage2ImageApi apiInstance = new TongyiImage2ImageApi(defaultClient);
    BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost = new BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost(); // BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.styleTransferApiV1TongyiImage2imageStyleTransferPost_0(bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TongyiImage2ImageApi#styleTransferApiV1TongyiImage2imageStyleTransferPost_0");
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
| **bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost** | [**BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost**](BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost.md)|  | |
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

<a id="tongyiImage2imageListModels"></a>
# **tongyiImage2imageListModels**
> Object tongyiImage2imageListModels()

通义图生图可用模型

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TongyiImage2ImageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TongyiImage2ImageApi apiInstance = new TongyiImage2ImageApi(defaultClient);
    try {
      Object result = apiInstance.tongyiImage2imageListModels();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TongyiImage2ImageApi#tongyiImage2imageListModels");
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

<a id="tongyiImage2imageListModels_0"></a>
# **tongyiImage2imageListModels_0**
> Object tongyiImage2imageListModels_0()

通义图生图可用模型

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TongyiImage2ImageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TongyiImage2ImageApi apiInstance = new TongyiImage2ImageApi(defaultClient);
    try {
      Object result = apiInstance.tongyiImage2imageListModels_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TongyiImage2ImageApi#tongyiImage2imageListModels_0");
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

<a id="virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost"></a>
# **virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost**
> Object virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost(bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost, apiKey)

通义虚拟试衣

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TongyiImage2ImageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TongyiImage2ImageApi apiInstance = new TongyiImage2ImageApi(defaultClient);
    BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost = new BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost(); // BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost(bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TongyiImage2ImageApi#virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost");
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
| **bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost** | [**BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost**](BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost.md)|  | |
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

<a id="virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0"></a>
# **virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0**
> Object virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0(bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost, apiKey)

通义虚拟试衣

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TongyiImage2ImageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TongyiImage2ImageApi apiInstance = new TongyiImage2ImageApi(defaultClient);
    BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost = new BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost(); // BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0(bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TongyiImage2ImageApi#virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0");
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
| **bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost** | [**BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost**](BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost.md)|  | |
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

