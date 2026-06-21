# ContentFileStorageApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**deleteFileApiV1ContentFilesFileIdDelete**](ContentFileStorageApi.md#deleteFileApiV1ContentFilesFileIdDelete) | **DELETE** /api/v1/content/files/{file_id} | 删除文件 |
| [**listFilesApiV1ContentFilesListGet**](ContentFileStorageApi.md#listFilesApiV1ContentFilesListGet) | **GET** /api/v1/content/files/list | 文件列表 |
| [**uploadFileApiV1ContentFilesUploadPost**](ContentFileStorageApi.md#uploadFileApiV1ContentFilesUploadPost) | **POST** /api/v1/content/files/upload | 上传文件记录 |


<a id="deleteFileApiV1ContentFilesFileIdDelete"></a>
# **deleteFileApiV1ContentFilesFileIdDelete**
> Object deleteFileApiV1ContentFilesFileIdDelete(fileId)

删除文件

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentFileStorageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ContentFileStorageApi apiInstance = new ContentFileStorageApi(defaultClient);
    Integer fileId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteFileApiV1ContentFilesFileIdDelete(fileId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentFileStorageApi#deleteFileApiV1ContentFilesFileIdDelete");
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
| **fileId** | **Integer**|  | |

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

<a id="listFilesApiV1ContentFilesListGet"></a>
# **listFilesApiV1ContentFilesListGet**
> Object listFilesApiV1ContentFilesListGet(page, limit, fileType)

文件列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentFileStorageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ContentFileStorageApi apiInstance = new ContentFileStorageApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String fileType = "fileType_example"; // String | 按文件类型过滤
    try {
      Object result = apiInstance.listFilesApiV1ContentFilesListGet(page, limit, fileType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentFileStorageApi#listFilesApiV1ContentFilesListGet");
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
| **fileType** | **String**| 按文件类型过滤 | [optional] |

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

<a id="uploadFileApiV1ContentFilesUploadPost"></a>
# **uploadFileApiV1ContentFilesUploadPost**
> Object uploadFileApiV1ContentFilesUploadPost(fileUploadBody)

上传文件记录

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentFileStorageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ContentFileStorageApi apiInstance = new ContentFileStorageApi(defaultClient);
    FileUploadBody fileUploadBody = new FileUploadBody(); // FileUploadBody | 
    try {
      Object result = apiInstance.uploadFileApiV1ContentFilesUploadPost(fileUploadBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentFileStorageApi#uploadFileApiV1ContentFilesUploadPost");
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
| **fileUploadBody** | [**FileUploadBody**](FileUploadBody.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

