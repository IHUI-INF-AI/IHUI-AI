# ContentInformationApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createInformationApiV1ContentInformationCreatePost**](ContentInformationApi.md#createInformationApiV1ContentInformationCreatePost) | **POST** /api/v1/content/information/create | 创建资讯 |
| [**listDictionaryApiV1ContentInformationDictionaryGet**](ContentInformationApi.md#listDictionaryApiV1ContentInformationDictionaryGet) | **GET** /api/v1/content/information/dictionary | 资讯分类字典 |
| [**listInformationApiV1ContentInformationListGet**](ContentInformationApi.md#listInformationApiV1ContentInformationListGet) | **GET** /api/v1/content/information/list | 资讯列表 |


<a id="createInformationApiV1ContentInformationCreatePost"></a>
# **createInformationApiV1ContentInformationCreatePost**
> Object createInformationApiV1ContentInformationCreatePost(title, content, type, sort)

创建资讯

管理端创建一条 AI 资讯。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentInformationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ContentInformationApi apiInstance = new ContentInformationApi(defaultClient);
    String title = "title_example"; // String | 
    String content = ""; // String | 
    Integer type = 56; // Integer | 资讯分类 type
    Integer sort = 0; // Integer | 
    try {
      Object result = apiInstance.createInformationApiV1ContentInformationCreatePost(title, content, type, sort);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentInformationApi#createInformationApiV1ContentInformationCreatePost");
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
| **title** | **String**|  | |
| **content** | **String**|  | [optional] [default to ] |
| **type** | **Integer**| 资讯分类 type | [optional] |
| **sort** | **Integer**|  | [optional] [default to 0] |

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

<a id="listDictionaryApiV1ContentInformationDictionaryGet"></a>
# **listDictionaryApiV1ContentInformationDictionaryGet**
> Object listDictionaryApiV1ContentInformationDictionaryGet(type)

资讯分类字典

返回 zhs_category_dictionary 中的分类字典列表。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentInformationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentInformationApi apiInstance = new ContentInformationApi(defaultClient);
    String type = "type_example"; // String | 字典类型筛选
    try {
      Object result = apiInstance.listDictionaryApiV1ContentInformationDictionaryGet(type);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentInformationApi#listDictionaryApiV1ContentInformationDictionaryGet");
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
| **type** | **String**| 字典类型筛选 | [optional] |

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

<a id="listInformationApiV1ContentInformationListGet"></a>
# **listInformationApiV1ContentInformationListGet**
> Object listInformationApiV1ContentInformationListGet(page, limit, type, status)

资讯列表

分页返回资讯列表。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentInformationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentInformationApi apiInstance = new ContentInformationApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer type = 56; // Integer | 按分类筛选
    Integer status = 56; // Integer | 筛选状态: 0=禁用 1=启用
    try {
      Object result = apiInstance.listInformationApiV1ContentInformationListGet(page, limit, type, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentInformationApi#listInformationApiV1ContentInformationListGet");
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
| **type** | **Integer**| 按分类筛选 | [optional] |
| **status** | **Integer**| 筛选状态: 0&#x3D;禁用 1&#x3D;启用 | [optional] |

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

