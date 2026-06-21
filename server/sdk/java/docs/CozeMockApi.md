# CozeMockApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mockCozeAgents**](CozeMockApi.md#mockCozeAgents) | **GET** /cozeZhsApi/agents | Mock: Coze 智能体列表 |
| [**mockCozeCategories**](CozeMockApi.md#mockCozeCategories) | **GET** /cozeZhsApi/cache/agent-category-dict/categories | Mock: Coze 智能体分类字典 |
| [**mockCozeCategoryDetail**](CozeMockApi.md#mockCozeCategoryDetail) | **GET** /cozeZhsApi/cache/agent-category-dict/categories/{category_id} | Mock: Coze 分类详情 |


<a id="mockCozeAgents"></a>
# **mockCozeAgents**
> Object mockCozeAgents()

Mock: Coze 智能体列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeMockApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeMockApi apiInstance = new CozeMockApi(defaultClient);
    try {
      Object result = apiInstance.mockCozeAgents();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeMockApi#mockCozeAgents");
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

<a id="mockCozeCategories"></a>
# **mockCozeCategories**
> Object mockCozeCategories()

Mock: Coze 智能体分类字典

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeMockApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeMockApi apiInstance = new CozeMockApi(defaultClient);
    try {
      Object result = apiInstance.mockCozeCategories();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeMockApi#mockCozeCategories");
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

<a id="mockCozeCategoryDetail"></a>
# **mockCozeCategoryDetail**
> Object mockCozeCategoryDetail(categoryId)

Mock: Coze 分类详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeMockApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeMockApi apiInstance = new CozeMockApi(defaultClient);
    String categoryId = "categoryId_example"; // String | 
    try {
      Object result = apiInstance.mockCozeCategoryDetail(categoryId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeMockApi#mockCozeCategoryDetail");
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
| **categoryId** | **String**|  | |

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

