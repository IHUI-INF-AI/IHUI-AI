# TongyiImageEditApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**textToImageApiV1TongyiImageEditTextToImagePost**](TongyiImageEditApi.md#textToImageApiV1TongyiImageEditTextToImagePost) | **POST** /api/v1/tongyi-image-edit/text-to-image | 通义文生图 |
| [**textToImageApiV1TongyiImageEditTextToImagePost_0**](TongyiImageEditApi.md#textToImageApiV1TongyiImageEditTextToImagePost_0) | **POST** /api/v1/tongyi-image-edit/text-to-image | 通义文生图 |
| [**tongyiImageEdit**](TongyiImageEditApi.md#tongyiImageEdit) | **POST** /api/v1/tongyi-image-edit/image-edit | 通义图像编辑 |
| [**tongyiImageEditListModels**](TongyiImageEditApi.md#tongyiImageEditListModels) | **GET** /api/v1/tongyi-image-edit/models | 通义可用模型 |
| [**tongyiImageEditListModels_0**](TongyiImageEditApi.md#tongyiImageEditListModels_0) | **GET** /api/v1/tongyi-image-edit/models | 通义可用模型 |
| [**tongyiImageEdit_0**](TongyiImageEditApi.md#tongyiImageEdit_0) | **POST** /api/v1/tongyi-image-edit/image-edit | 通义图像编辑 |


<a id="textToImageApiV1TongyiImageEditTextToImagePost"></a>
# **textToImageApiV1TongyiImageEditTextToImagePost**
> Object textToImageApiV1TongyiImageEditTextToImagePost(bodyTextToImageApiV1TongyiImageEditTextToImagePost, apiKey)

通义文生图

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TongyiImageEditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TongyiImageEditApi apiInstance = new TongyiImageEditApi(defaultClient);
    BodyTextToImageApiV1TongyiImageEditTextToImagePost bodyTextToImageApiV1TongyiImageEditTextToImagePost = new BodyTextToImageApiV1TongyiImageEditTextToImagePost(); // BodyTextToImageApiV1TongyiImageEditTextToImagePost | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.textToImageApiV1TongyiImageEditTextToImagePost(bodyTextToImageApiV1TongyiImageEditTextToImagePost, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TongyiImageEditApi#textToImageApiV1TongyiImageEditTextToImagePost");
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
| **bodyTextToImageApiV1TongyiImageEditTextToImagePost** | [**BodyTextToImageApiV1TongyiImageEditTextToImagePost**](BodyTextToImageApiV1TongyiImageEditTextToImagePost.md)|  | |
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

<a id="textToImageApiV1TongyiImageEditTextToImagePost_0"></a>
# **textToImageApiV1TongyiImageEditTextToImagePost_0**
> Object textToImageApiV1TongyiImageEditTextToImagePost_0(bodyTextToImageApiV1TongyiImageEditTextToImagePost, apiKey)

通义文生图

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TongyiImageEditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TongyiImageEditApi apiInstance = new TongyiImageEditApi(defaultClient);
    BodyTextToImageApiV1TongyiImageEditTextToImagePost bodyTextToImageApiV1TongyiImageEditTextToImagePost = new BodyTextToImageApiV1TongyiImageEditTextToImagePost(); // BodyTextToImageApiV1TongyiImageEditTextToImagePost | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.textToImageApiV1TongyiImageEditTextToImagePost_0(bodyTextToImageApiV1TongyiImageEditTextToImagePost, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TongyiImageEditApi#textToImageApiV1TongyiImageEditTextToImagePost_0");
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
| **bodyTextToImageApiV1TongyiImageEditTextToImagePost** | [**BodyTextToImageApiV1TongyiImageEditTextToImagePost**](BodyTextToImageApiV1TongyiImageEditTextToImagePost.md)|  | |
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

<a id="tongyiImageEdit"></a>
# **tongyiImageEdit**
> Object tongyiImageEdit(bodyTongyiImageEdit, apiKey)

通义图像编辑

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TongyiImageEditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TongyiImageEditApi apiInstance = new TongyiImageEditApi(defaultClient);
    BodyTongyiImageEdit bodyTongyiImageEdit = new BodyTongyiImageEdit(); // BodyTongyiImageEdit | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.tongyiImageEdit(bodyTongyiImageEdit, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TongyiImageEditApi#tongyiImageEdit");
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
| **bodyTongyiImageEdit** | [**BodyTongyiImageEdit**](BodyTongyiImageEdit.md)|  | |
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

<a id="tongyiImageEditListModels"></a>
# **tongyiImageEditListModels**
> Object tongyiImageEditListModels()

通义可用模型

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TongyiImageEditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TongyiImageEditApi apiInstance = new TongyiImageEditApi(defaultClient);
    try {
      Object result = apiInstance.tongyiImageEditListModels();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TongyiImageEditApi#tongyiImageEditListModels");
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

<a id="tongyiImageEditListModels_0"></a>
# **tongyiImageEditListModels_0**
> Object tongyiImageEditListModels_0()

通义可用模型

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TongyiImageEditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TongyiImageEditApi apiInstance = new TongyiImageEditApi(defaultClient);
    try {
      Object result = apiInstance.tongyiImageEditListModels_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TongyiImageEditApi#tongyiImageEditListModels_0");
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

<a id="tongyiImageEdit_0"></a>
# **tongyiImageEdit_0**
> Object tongyiImageEdit_0(bodyTongyiImageEdit, apiKey)

通义图像编辑

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TongyiImageEditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TongyiImageEditApi apiInstance = new TongyiImageEditApi(defaultClient);
    BodyTongyiImageEdit bodyTongyiImageEdit = new BodyTongyiImageEdit(); // BodyTongyiImageEdit | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.tongyiImageEdit_0(bodyTongyiImageEdit, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TongyiImageEditApi#tongyiImageEdit_0");
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
| **bodyTongyiImageEdit** | [**BodyTongyiImageEdit**](BodyTongyiImageEdit.md)|  | |
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

