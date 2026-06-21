# DoubaoImageEditApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**doubaoImageEdit**](DoubaoImageEditApi.md#doubaoImageEdit) | **POST** /api/v1/doubao-image-edit/image-edit | 豆包图片编辑 |
| [**doubaoImageEditListModels**](DoubaoImageEditApi.md#doubaoImageEditListModels) | **GET** /api/v1/doubao-image-edit/models | 豆包可用模型 |
| [**doubaoImageEditListModels_0**](DoubaoImageEditApi.md#doubaoImageEditListModels_0) | **GET** /api/v1/doubao-image-edit/models | 豆包可用模型 |
| [**doubaoImageEdit_0**](DoubaoImageEditApi.md#doubaoImageEdit_0) | **POST** /api/v1/doubao-image-edit/image-edit | 豆包图片编辑 |
| [**imageGenerateApiV1DoubaoImageEditImageGeneratePost**](DoubaoImageEditApi.md#imageGenerateApiV1DoubaoImageEditImageGeneratePost) | **POST** /api/v1/doubao-image-edit/image-generate | 豆包文生图 |
| [**imageGenerateApiV1DoubaoImageEditImageGeneratePost_0**](DoubaoImageEditApi.md#imageGenerateApiV1DoubaoImageEditImageGeneratePost_0) | **POST** /api/v1/doubao-image-edit/image-generate | 豆包文生图 |


<a id="doubaoImageEdit"></a>
# **doubaoImageEdit**
> Object doubaoImageEdit(bodyDoubaoImageEdit, apiKey)

豆包图片编辑

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.DoubaoImageEditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    DoubaoImageEditApi apiInstance = new DoubaoImageEditApi(defaultClient);
    BodyDoubaoImageEdit bodyDoubaoImageEdit = new BodyDoubaoImageEdit(); // BodyDoubaoImageEdit | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.doubaoImageEdit(bodyDoubaoImageEdit, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling DoubaoImageEditApi#doubaoImageEdit");
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
| **bodyDoubaoImageEdit** | [**BodyDoubaoImageEdit**](BodyDoubaoImageEdit.md)|  | |
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

<a id="doubaoImageEditListModels"></a>
# **doubaoImageEditListModels**
> Object doubaoImageEditListModels()

豆包可用模型

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.DoubaoImageEditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    DoubaoImageEditApi apiInstance = new DoubaoImageEditApi(defaultClient);
    try {
      Object result = apiInstance.doubaoImageEditListModels();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling DoubaoImageEditApi#doubaoImageEditListModels");
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

<a id="doubaoImageEditListModels_0"></a>
# **doubaoImageEditListModels_0**
> Object doubaoImageEditListModels_0()

豆包可用模型

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.DoubaoImageEditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    DoubaoImageEditApi apiInstance = new DoubaoImageEditApi(defaultClient);
    try {
      Object result = apiInstance.doubaoImageEditListModels_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling DoubaoImageEditApi#doubaoImageEditListModels_0");
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

<a id="doubaoImageEdit_0"></a>
# **doubaoImageEdit_0**
> Object doubaoImageEdit_0(bodyDoubaoImageEdit, apiKey)

豆包图片编辑

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.DoubaoImageEditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    DoubaoImageEditApi apiInstance = new DoubaoImageEditApi(defaultClient);
    BodyDoubaoImageEdit bodyDoubaoImageEdit = new BodyDoubaoImageEdit(); // BodyDoubaoImageEdit | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.doubaoImageEdit_0(bodyDoubaoImageEdit, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling DoubaoImageEditApi#doubaoImageEdit_0");
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
| **bodyDoubaoImageEdit** | [**BodyDoubaoImageEdit**](BodyDoubaoImageEdit.md)|  | |
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

<a id="imageGenerateApiV1DoubaoImageEditImageGeneratePost"></a>
# **imageGenerateApiV1DoubaoImageEditImageGeneratePost**
> Object imageGenerateApiV1DoubaoImageEditImageGeneratePost(bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost, apiKey)

豆包文生图

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.DoubaoImageEditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    DoubaoImageEditApi apiInstance = new DoubaoImageEditApi(defaultClient);
    BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost = new BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost(); // BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.imageGenerateApiV1DoubaoImageEditImageGeneratePost(bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling DoubaoImageEditApi#imageGenerateApiV1DoubaoImageEditImageGeneratePost");
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
| **bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost** | [**BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost**](BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost.md)|  | |
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

<a id="imageGenerateApiV1DoubaoImageEditImageGeneratePost_0"></a>
# **imageGenerateApiV1DoubaoImageEditImageGeneratePost_0**
> Object imageGenerateApiV1DoubaoImageEditImageGeneratePost_0(bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost, apiKey)

豆包文生图

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.DoubaoImageEditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    DoubaoImageEditApi apiInstance = new DoubaoImageEditApi(defaultClient);
    BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost = new BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost(); // BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost | 
    String apiKey = "apiKey_example"; // String | 
    try {
      Object result = apiInstance.imageGenerateApiV1DoubaoImageEditImageGeneratePost_0(bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost, apiKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling DoubaoImageEditApi#imageGenerateApiV1DoubaoImageEditImageGeneratePost_0");
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
| **bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost** | [**BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost**](BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost.md)|  | |
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

