# AgentCategoriesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**deleteCategoryApiV1AgentsCategoryIdDelete**](AgentCategoriesApi.md#deleteCategoryApiV1AgentsCategoryIdDelete) | **DELETE** /api/v1/agents/{category_id} | Delete agent category |
| [**getCategoryDetailApiV1AgentsCategoryIdGet**](AgentCategoriesApi.md#getCategoryDetailApiV1AgentsCategoryIdGet) | **GET** /api/v1/agents/{category_id} | Get category detail |
| [**updateCategoryApiV1AgentsCategoryIdPut**](AgentCategoriesApi.md#updateCategoryApiV1AgentsCategoryIdPut) | **PUT** /api/v1/agents/{category_id} | Update agent category |


<a id="deleteCategoryApiV1AgentsCategoryIdDelete"></a>
# **deleteCategoryApiV1AgentsCategoryIdDelete**
> Object deleteCategoryApiV1AgentsCategoryIdDelete(categoryId)

Delete agent category

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentCategoriesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentCategoriesApi apiInstance = new AgentCategoriesApi(defaultClient);
    Integer categoryId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteCategoryApiV1AgentsCategoryIdDelete(categoryId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentCategoriesApi#deleteCategoryApiV1AgentsCategoryIdDelete");
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
| **categoryId** | **Integer**|  | |

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

<a id="getCategoryDetailApiV1AgentsCategoryIdGet"></a>
# **getCategoryDetailApiV1AgentsCategoryIdGet**
> Object getCategoryDetailApiV1AgentsCategoryIdGet(categoryId)

Get category detail

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentCategoriesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentCategoriesApi apiInstance = new AgentCategoriesApi(defaultClient);
    Integer categoryId = 56; // Integer | 
    try {
      Object result = apiInstance.getCategoryDetailApiV1AgentsCategoryIdGet(categoryId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentCategoriesApi#getCategoryDetailApiV1AgentsCategoryIdGet");
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
| **categoryId** | **Integer**|  | |

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

<a id="updateCategoryApiV1AgentsCategoryIdPut"></a>
# **updateCategoryApiV1AgentsCategoryIdPut**
> Object updateCategoryApiV1AgentsCategoryIdPut(categoryId, categoryUpdateBody)

Update agent category

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentCategoriesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentCategoriesApi apiInstance = new AgentCategoriesApi(defaultClient);
    Integer categoryId = 56; // Integer | 
    CategoryUpdateBody categoryUpdateBody = new CategoryUpdateBody(); // CategoryUpdateBody | 
    try {
      Object result = apiInstance.updateCategoryApiV1AgentsCategoryIdPut(categoryId, categoryUpdateBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentCategoriesApi#updateCategoryApiV1AgentsCategoryIdPut");
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
| **categoryId** | **Integer**|  | |
| **categoryUpdateBody** | [**CategoryUpdateBody**](CategoryUpdateBody.md)|  | |

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

