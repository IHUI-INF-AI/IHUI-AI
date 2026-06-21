# CozeFilesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**uploadFileApiV1CozeFilesFilesUploadPost**](CozeFilesApi.md#uploadFileApiV1CozeFilesFilesUploadPost) | **POST** /api/v1/coze/files/files/upload | Upload File |
| [**uploadFileApiV1CozeFilesFilesUploadPost_0**](CozeFilesApi.md#uploadFileApiV1CozeFilesFilesUploadPost_0) | **POST** /api/v1/coze/files/files/upload | Upload File |


<a id="uploadFileApiV1CozeFilesFilesUploadPost"></a>
# **uploadFileApiV1CozeFilesFilesUploadPost**
> Object uploadFileApiV1CozeFilesFilesUploadPost(_file)

Upload File

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeFilesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeFilesApi apiInstance = new CozeFilesApi(defaultClient);
    File _file = new File("/path/to/file"); // File | 
    try {
      Object result = apiInstance.uploadFileApiV1CozeFilesFilesUploadPost(_file);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeFilesApi#uploadFileApiV1CozeFilesFilesUploadPost");
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

<a id="uploadFileApiV1CozeFilesFilesUploadPost_0"></a>
# **uploadFileApiV1CozeFilesFilesUploadPost_0**
> Object uploadFileApiV1CozeFilesFilesUploadPost_0(_file)

Upload File

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeFilesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeFilesApi apiInstance = new CozeFilesApi(defaultClient);
    File _file = new File("/path/to/file"); // File | 
    try {
      Object result = apiInstance.uploadFileApiV1CozeFilesFilesUploadPost_0(_file);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeFilesApi#uploadFileApiV1CozeFilesFilesUploadPost_0");
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

