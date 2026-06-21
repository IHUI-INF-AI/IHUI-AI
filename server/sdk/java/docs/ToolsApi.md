# ToolsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**listCategoriesApiV1ToolsCategoriesGet**](ToolsApi.md#listCategoriesApiV1ToolsCategoriesGet) | **GET** /api/v1/tools/categories | 获取工具分类列表 |
| [**listToolsApiV1ToolsListGet**](ToolsApi.md#listToolsApiV1ToolsListGet) | **GET** /api/v1/tools/list | 获取工具列表 |
| [**uploadFileApiV1ToolsUploadPost**](ToolsApi.md#uploadFileApiV1ToolsUploadPost) | **POST** /api/v1/tools/upload | Upload file to MinIO |


<a id="listCategoriesApiV1ToolsCategoriesGet"></a>
# **listCategoriesApiV1ToolsCategoriesGet**
> Object listCategoriesApiV1ToolsCategoriesGet()

获取工具分类列表

获取工具分类及每个分类的工具数量

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ToolsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ToolsApi apiInstance = new ToolsApi(defaultClient);
    try {
      Object result = apiInstance.listCategoriesApiV1ToolsCategoriesGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ToolsApi#listCategoriesApiV1ToolsCategoriesGet");
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

<a id="listToolsApiV1ToolsListGet"></a>
# **listToolsApiV1ToolsListGet**
> Object listToolsApiV1ToolsListGet(category, keyword, sort)

获取工具列表

获取工具列表 (对接 Tools.vue 前端)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ToolsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ToolsApi apiInstance = new ToolsApi(defaultClient);
    String category = "category_example"; // String | 分类过滤
    String keyword = "keyword_example"; // String | 搜索关键词
    String sort = "sort_example"; // String | 排序: default/name/hot
    try {
      Object result = apiInstance.listToolsApiV1ToolsListGet(category, keyword, sort);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ToolsApi#listToolsApiV1ToolsListGet");
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
| **category** | **String**| 分类过滤 | [optional] |
| **keyword** | **String**| 搜索关键词 | [optional] |
| **sort** | **String**| 排序: default/name/hot | [optional] |

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

<a id="uploadFileApiV1ToolsUploadPost"></a>
# **uploadFileApiV1ToolsUploadPost**
> Object uploadFileApiV1ToolsUploadPost(_file)

Upload file to MinIO

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ToolsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ToolsApi apiInstance = new ToolsApi(defaultClient);
    File _file = new File("/path/to/file"); // File | 
    try {
      Object result = apiInstance.uploadFileApiV1ToolsUploadPost(_file);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ToolsApi#uploadFileApiV1ToolsUploadPost");
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

