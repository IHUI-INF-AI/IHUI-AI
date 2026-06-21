# AgentUploadApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**deleteUploadApiV1AgentUploadUidDelete**](AgentUploadApi.md#deleteUploadApiV1AgentUploadUidDelete) | **DELETE** /api/v1/agent-upload/{uid} | 删除上传记录 |
| [**deleteUploadApiV1AgentUploadUidDelete_0**](AgentUploadApi.md#deleteUploadApiV1AgentUploadUidDelete_0) | **DELETE** /api/v1/agent-upload/{uid} | 删除上传记录 |
| [**listUploadsApiV1AgentUploadListGet**](AgentUploadApi.md#listUploadsApiV1AgentUploadListGet) | **GET** /api/v1/agent-upload/list | 我的上传 |
| [**listUploadsApiV1AgentUploadListGet_0**](AgentUploadApi.md#listUploadsApiV1AgentUploadListGet_0) | **GET** /api/v1/agent-upload/list | 我的上传 |
| [**recordUploadApiV1AgentUploadPost**](AgentUploadApi.md#recordUploadApiV1AgentUploadPost) | **POST** /api/v1/agent-upload | 记录上传 |
| [**recordUploadApiV1AgentUploadPost_0**](AgentUploadApi.md#recordUploadApiV1AgentUploadPost_0) | **POST** /api/v1/agent-upload | 记录上传 |


<a id="deleteUploadApiV1AgentUploadUidDelete"></a>
# **deleteUploadApiV1AgentUploadUidDelete**
> Object deleteUploadApiV1AgentUploadUidDelete(uid)

删除上传记录

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentUploadApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentUploadApi apiInstance = new AgentUploadApi(defaultClient);
    Integer uid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteUploadApiV1AgentUploadUidDelete(uid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentUploadApi#deleteUploadApiV1AgentUploadUidDelete");
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
| **uid** | **Integer**|  | |

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

<a id="deleteUploadApiV1AgentUploadUidDelete_0"></a>
# **deleteUploadApiV1AgentUploadUidDelete_0**
> Object deleteUploadApiV1AgentUploadUidDelete_0(uid)

删除上传记录

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentUploadApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentUploadApi apiInstance = new AgentUploadApi(defaultClient);
    Integer uid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteUploadApiV1AgentUploadUidDelete_0(uid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentUploadApi#deleteUploadApiV1AgentUploadUidDelete_0");
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
| **uid** | **Integer**|  | |

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

<a id="listUploadsApiV1AgentUploadListGet"></a>
# **listUploadsApiV1AgentUploadListGet**
> Object listUploadsApiV1AgentUploadListGet(page, limit, agentId, bizType, fileType)

我的上传

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentUploadApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentUploadApi apiInstance = new AgentUploadApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String agentId = "agentId_example"; // String | 
    String bizType = "bizType_example"; // String | 
    String fileType = "fileType_example"; // String | 
    try {
      Object result = apiInstance.listUploadsApiV1AgentUploadListGet(page, limit, agentId, bizType, fileType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentUploadApi#listUploadsApiV1AgentUploadListGet");
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
| **agentId** | **String**|  | [optional] |
| **bizType** | **String**|  | [optional] |
| **fileType** | **String**|  | [optional] |

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

<a id="listUploadsApiV1AgentUploadListGet_0"></a>
# **listUploadsApiV1AgentUploadListGet_0**
> Object listUploadsApiV1AgentUploadListGet_0(page, limit, agentId, bizType, fileType)

我的上传

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentUploadApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentUploadApi apiInstance = new AgentUploadApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String agentId = "agentId_example"; // String | 
    String bizType = "bizType_example"; // String | 
    String fileType = "fileType_example"; // String | 
    try {
      Object result = apiInstance.listUploadsApiV1AgentUploadListGet_0(page, limit, agentId, bizType, fileType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentUploadApi#listUploadsApiV1AgentUploadListGet_0");
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
| **agentId** | **String**|  | [optional] |
| **bizType** | **String**|  | [optional] |
| **fileType** | **String**|  | [optional] |

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

<a id="recordUploadApiV1AgentUploadPost"></a>
# **recordUploadApiV1AgentUploadPost**
> Object recordUploadApiV1AgentUploadPost(fileName, fileUrl, fileType, fileSize, mimeType, ext, agentId, agentName, bizType)

记录上传

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentUploadApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentUploadApi apiInstance = new AgentUploadApi(defaultClient);
    String fileName = "fileName_example"; // String | 
    String fileUrl = "fileUrl_example"; // String | 
    String fileType = "fileType_example"; // String | 
    Integer fileSize = 0; // Integer | 
    String mimeType = "mimeType_example"; // String | 
    String ext = "ext_example"; // String | 
    String agentId = "agentId_example"; // String | 
    String agentName = "agentName_example"; // String | 
    String bizType = "avatar"; // String | 
    try {
      Object result = apiInstance.recordUploadApiV1AgentUploadPost(fileName, fileUrl, fileType, fileSize, mimeType, ext, agentId, agentName, bizType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentUploadApi#recordUploadApiV1AgentUploadPost");
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
| **fileUrl** | **String**|  | |
| **fileType** | **String**|  | [optional] |
| **fileSize** | **Integer**|  | [optional] [default to 0] |
| **mimeType** | **String**|  | [optional] |
| **ext** | **String**|  | [optional] |
| **agentId** | **String**|  | [optional] |
| **agentName** | **String**|  | [optional] |
| **bizType** | **String**|  | [optional] [default to avatar] |

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

<a id="recordUploadApiV1AgentUploadPost_0"></a>
# **recordUploadApiV1AgentUploadPost_0**
> Object recordUploadApiV1AgentUploadPost_0(fileName, fileUrl, fileType, fileSize, mimeType, ext, agentId, agentName, bizType)

记录上传

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentUploadApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentUploadApi apiInstance = new AgentUploadApi(defaultClient);
    String fileName = "fileName_example"; // String | 
    String fileUrl = "fileUrl_example"; // String | 
    String fileType = "fileType_example"; // String | 
    Integer fileSize = 0; // Integer | 
    String mimeType = "mimeType_example"; // String | 
    String ext = "ext_example"; // String | 
    String agentId = "agentId_example"; // String | 
    String agentName = "agentName_example"; // String | 
    String bizType = "avatar"; // String | 
    try {
      Object result = apiInstance.recordUploadApiV1AgentUploadPost_0(fileName, fileUrl, fileType, fileSize, mimeType, ext, agentId, agentName, bizType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentUploadApi#recordUploadApiV1AgentUploadPost_0");
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
| **fileUrl** | **String**|  | |
| **fileType** | **String**|  | [optional] |
| **fileSize** | **Integer**|  | [optional] [default to 0] |
| **mimeType** | **String**|  | [optional] |
| **ext** | **String**|  | [optional] |
| **agentId** | **String**|  | [optional] |
| **agentName** | **String**|  | [optional] |
| **bizType** | **String**|  | [optional] [default to avatar] |

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

