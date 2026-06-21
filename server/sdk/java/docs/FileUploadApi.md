# FileUploadApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**uploadBase64FileApiV1CozeZhsApiFileUploadBase64Post**](FileUploadApi.md#uploadBase64FileApiV1CozeZhsApiFileUploadBase64Post) | **POST** /api/v1/cozeZhsApi/file/upload/base64 | Upload base64 file |
| [**uploadFormFileApiV1CozeZhsApiFileUploadFormPost**](FileUploadApi.md#uploadFormFileApiV1CozeZhsApiFileUploadFormPost) | **POST** /api/v1/cozeZhsApi/file/upload/form | Upload file via form-data |
| [**uploadOctetFileApiV1CozeZhsApiFileUploadOctetPost**](FileUploadApi.md#uploadOctetFileApiV1CozeZhsApiFileUploadOctetPost) | **POST** /api/v1/cozeZhsApi/file/upload/octet | Upload file via octet-stream |


<a id="uploadBase64FileApiV1CozeZhsApiFileUploadBase64Post"></a>
# **uploadBase64FileApiV1CozeZhsApiFileUploadBase64Post**
> Object uploadBase64FileApiV1CozeZhsApiFileUploadBase64Post(base64UploadRequest)

Upload base64 file

Upload a base64-encoded file. Auto-converts webp to png.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FileUploadApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FileUploadApi apiInstance = new FileUploadApi(defaultClient);
    Base64UploadRequest base64UploadRequest = new Base64UploadRequest(); // Base64UploadRequest | 
    try {
      Object result = apiInstance.uploadBase64FileApiV1CozeZhsApiFileUploadBase64Post(base64UploadRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FileUploadApi#uploadBase64FileApiV1CozeZhsApiFileUploadBase64Post");
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
| **base64UploadRequest** | [**Base64UploadRequest**](Base64UploadRequest.md)|  | |

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

<a id="uploadFormFileApiV1CozeZhsApiFileUploadFormPost"></a>
# **uploadFormFileApiV1CozeZhsApiFileUploadFormPost**
> Object uploadFormFileApiV1CozeZhsApiFileUploadFormPost(_file)

Upload file via form-data

Upload any file via multipart/form-data.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FileUploadApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FileUploadApi apiInstance = new FileUploadApi(defaultClient);
    File _file = new File("/path/to/file"); // File | 
    try {
      Object result = apiInstance.uploadFormFileApiV1CozeZhsApiFileUploadFormPost(_file);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FileUploadApi#uploadFormFileApiV1CozeZhsApiFileUploadFormPost");
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
| **_file** | **File**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="uploadOctetFileApiV1CozeZhsApiFileUploadOctetPost"></a>
# **uploadOctetFileApiV1CozeZhsApiFileUploadOctetPost**
> Object uploadOctetFileApiV1CozeZhsApiFileUploadOctetPost(fileName)

Upload file via octet-stream

Upload file via raw octet-stream body. file_name in query.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FileUploadApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FileUploadApi apiInstance = new FileUploadApi(defaultClient);
    String fileName = "fileName_example"; // String | 
    try {
      Object result = apiInstance.uploadOctetFileApiV1CozeZhsApiFileUploadOctetPost(fileName);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FileUploadApi#uploadOctetFileApiV1CozeZhsApiFileUploadOctetPost");
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
| **fileName** | **String**|  | |

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

