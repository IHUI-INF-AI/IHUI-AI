# CozeDatasetsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createDatasetApiV1CozeDatasetsDatasetsPost**](CozeDatasetsApi.md#createDatasetApiV1CozeDatasetsDatasetsPost) | **POST** /api/v1/coze/datasets/datasets | Create Dataset |
| [**createDatasetApiV1CozeDatasetsDatasetsPost_0**](CozeDatasetsApi.md#createDatasetApiV1CozeDatasetsDatasetsPost_0) | **POST** /api/v1/coze/datasets/datasets | Create Dataset |
| [**listDatasetsApiV1CozeDatasetsDatasetsListPost**](CozeDatasetsApi.md#listDatasetsApiV1CozeDatasetsDatasetsListPost) | **POST** /api/v1/coze/datasets/datasets/list | List Datasets |
| [**listDatasetsApiV1CozeDatasetsDatasetsListPost_0**](CozeDatasetsApi.md#listDatasetsApiV1CozeDatasetsDatasetsListPost_0) | **POST** /api/v1/coze/datasets/datasets/list | List Datasets |
| [**listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost**](CozeDatasetsApi.md#listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost) | **POST** /api/v1/coze/datasets/datasets/documents/list | List Documents |
| [**listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0**](CozeDatasetsApi.md#listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0) | **POST** /api/v1/coze/datasets/datasets/documents/list | List Documents |
| [**listImagesApiV1CozeDatasetsDatasetsImagesListPost**](CozeDatasetsApi.md#listImagesApiV1CozeDatasetsDatasetsImagesListPost) | **POST** /api/v1/coze/datasets/datasets/images/list | List Images |
| [**listImagesApiV1CozeDatasetsDatasetsImagesListPost_0**](CozeDatasetsApi.md#listImagesApiV1CozeDatasetsDatasetsImagesListPost_0) | **POST** /api/v1/coze/datasets/datasets/images/list | List Images |
| [**uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost**](CozeDatasetsApi.md#uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost) | **POST** /api/v1/coze/datasets/datasets/documents/upload | Upload Document |
| [**uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0**](CozeDatasetsApi.md#uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0) | **POST** /api/v1/coze/datasets/datasets/documents/upload | Upload Document |
| [**uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost**](CozeDatasetsApi.md#uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost) | **POST** /api/v1/coze/datasets/datasets/images/upload | Upload Image |
| [**uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0**](CozeDatasetsApi.md#uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0) | **POST** /api/v1/coze/datasets/datasets/images/upload | Upload Image |


<a id="createDatasetApiV1CozeDatasetsDatasetsPost"></a>
# **createDatasetApiV1CozeDatasetsDatasetsPost**
> Object createDatasetApiV1CozeDatasetsDatasetsPost(datasetCreateReq)

Create Dataset

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeDatasetsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeDatasetsApi apiInstance = new CozeDatasetsApi(defaultClient);
    DatasetCreateReq datasetCreateReq = new DatasetCreateReq(); // DatasetCreateReq | 
    try {
      Object result = apiInstance.createDatasetApiV1CozeDatasetsDatasetsPost(datasetCreateReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeDatasetsApi#createDatasetApiV1CozeDatasetsDatasetsPost");
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
| **datasetCreateReq** | [**DatasetCreateReq**](DatasetCreateReq.md)|  | |

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

<a id="createDatasetApiV1CozeDatasetsDatasetsPost_0"></a>
# **createDatasetApiV1CozeDatasetsDatasetsPost_0**
> Object createDatasetApiV1CozeDatasetsDatasetsPost_0(datasetCreateReq)

Create Dataset

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeDatasetsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeDatasetsApi apiInstance = new CozeDatasetsApi(defaultClient);
    DatasetCreateReq datasetCreateReq = new DatasetCreateReq(); // DatasetCreateReq | 
    try {
      Object result = apiInstance.createDatasetApiV1CozeDatasetsDatasetsPost_0(datasetCreateReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeDatasetsApi#createDatasetApiV1CozeDatasetsDatasetsPost_0");
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
| **datasetCreateReq** | [**DatasetCreateReq**](DatasetCreateReq.md)|  | |

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

<a id="listDatasetsApiV1CozeDatasetsDatasetsListPost"></a>
# **listDatasetsApiV1CozeDatasetsDatasetsListPost**
> Object listDatasetsApiV1CozeDatasetsDatasetsListPost(datasetListReq)

List Datasets

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeDatasetsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeDatasetsApi apiInstance = new CozeDatasetsApi(defaultClient);
    DatasetListReq datasetListReq = new DatasetListReq(); // DatasetListReq | 
    try {
      Object result = apiInstance.listDatasetsApiV1CozeDatasetsDatasetsListPost(datasetListReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeDatasetsApi#listDatasetsApiV1CozeDatasetsDatasetsListPost");
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
| **datasetListReq** | [**DatasetListReq**](DatasetListReq.md)|  | |

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

<a id="listDatasetsApiV1CozeDatasetsDatasetsListPost_0"></a>
# **listDatasetsApiV1CozeDatasetsDatasetsListPost_0**
> Object listDatasetsApiV1CozeDatasetsDatasetsListPost_0(datasetListReq)

List Datasets

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeDatasetsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeDatasetsApi apiInstance = new CozeDatasetsApi(defaultClient);
    DatasetListReq datasetListReq = new DatasetListReq(); // DatasetListReq | 
    try {
      Object result = apiInstance.listDatasetsApiV1CozeDatasetsDatasetsListPost_0(datasetListReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeDatasetsApi#listDatasetsApiV1CozeDatasetsDatasetsListPost_0");
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
| **datasetListReq** | [**DatasetListReq**](DatasetListReq.md)|  | |

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

<a id="listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost"></a>
# **listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost**
> Object listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost(docListReq)

List Documents

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeDatasetsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeDatasetsApi apiInstance = new CozeDatasetsApi(defaultClient);
    DocListReq docListReq = new DocListReq(); // DocListReq | 
    try {
      Object result = apiInstance.listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost(docListReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeDatasetsApi#listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost");
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
| **docListReq** | [**DocListReq**](DocListReq.md)|  | |

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

<a id="listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0"></a>
# **listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0**
> Object listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0(docListReq)

List Documents

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeDatasetsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeDatasetsApi apiInstance = new CozeDatasetsApi(defaultClient);
    DocListReq docListReq = new DocListReq(); // DocListReq | 
    try {
      Object result = apiInstance.listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0(docListReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeDatasetsApi#listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0");
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
| **docListReq** | [**DocListReq**](DocListReq.md)|  | |

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

<a id="listImagesApiV1CozeDatasetsDatasetsImagesListPost"></a>
# **listImagesApiV1CozeDatasetsDatasetsImagesListPost**
> Object listImagesApiV1CozeDatasetsDatasetsImagesListPost(imageListReq)

List Images

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeDatasetsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeDatasetsApi apiInstance = new CozeDatasetsApi(defaultClient);
    ImageListReq imageListReq = new ImageListReq(); // ImageListReq | 
    try {
      Object result = apiInstance.listImagesApiV1CozeDatasetsDatasetsImagesListPost(imageListReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeDatasetsApi#listImagesApiV1CozeDatasetsDatasetsImagesListPost");
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
| **imageListReq** | [**ImageListReq**](ImageListReq.md)|  | |

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

<a id="listImagesApiV1CozeDatasetsDatasetsImagesListPost_0"></a>
# **listImagesApiV1CozeDatasetsDatasetsImagesListPost_0**
> Object listImagesApiV1CozeDatasetsDatasetsImagesListPost_0(imageListReq)

List Images

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeDatasetsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeDatasetsApi apiInstance = new CozeDatasetsApi(defaultClient);
    ImageListReq imageListReq = new ImageListReq(); // ImageListReq | 
    try {
      Object result = apiInstance.listImagesApiV1CozeDatasetsDatasetsImagesListPost_0(imageListReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeDatasetsApi#listImagesApiV1CozeDatasetsDatasetsImagesListPost_0");
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
| **imageListReq** | [**ImageListReq**](ImageListReq.md)|  | |

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

<a id="uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost"></a>
# **uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost**
> Object uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost(datasetId, _file)

Upload Document

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeDatasetsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeDatasetsApi apiInstance = new CozeDatasetsApi(defaultClient);
    String datasetId = "datasetId_example"; // String | 
    File _file = new File("/path/to/file"); // File | 
    try {
      Object result = apiInstance.uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost(datasetId, _file);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeDatasetsApi#uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost");
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
| **datasetId** | **String**|  | |
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

<a id="uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0"></a>
# **uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0**
> Object uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0(datasetId, _file)

Upload Document

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeDatasetsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeDatasetsApi apiInstance = new CozeDatasetsApi(defaultClient);
    String datasetId = "datasetId_example"; // String | 
    File _file = new File("/path/to/file"); // File | 
    try {
      Object result = apiInstance.uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0(datasetId, _file);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeDatasetsApi#uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0");
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
| **datasetId** | **String**|  | |
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

<a id="uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost"></a>
# **uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost**
> Object uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost(datasetId, _file)

Upload Image

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeDatasetsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeDatasetsApi apiInstance = new CozeDatasetsApi(defaultClient);
    String datasetId = "datasetId_example"; // String | 
    File _file = new File("/path/to/file"); // File | 
    try {
      Object result = apiInstance.uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost(datasetId, _file);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeDatasetsApi#uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost");
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
| **datasetId** | **String**|  | |
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

<a id="uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0"></a>
# **uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0**
> Object uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0(datasetId, _file)

Upload Image

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeDatasetsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeDatasetsApi apiInstance = new CozeDatasetsApi(defaultClient);
    String datasetId = "datasetId_example"; // String | 
    File _file = new File("/path/to/file"); // File | 
    try {
      Object result = apiInstance.uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0(datasetId, _file);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeDatasetsApi#uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0");
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
| **datasetId** | **String**|  | |
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

