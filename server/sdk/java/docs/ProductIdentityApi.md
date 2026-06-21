# ProductIdentityApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createProductIdentityApiV1ProductIdentityPost**](ProductIdentityApi.md#createProductIdentityApiV1ProductIdentityPost) | **POST** /api/v1/product_identity | Create product identity |
| [**deleteProductIdentitiesApiV1ProductIdentityItemIdsDelete**](ProductIdentityApi.md#deleteProductIdentitiesApiV1ProductIdentityItemIdsDelete) | **DELETE** /api/v1/product_identity/{item_ids} | Delete product identities |
| [**getProductIdentityApiV1ProductIdentityItemIdGet**](ProductIdentityApi.md#getProductIdentityApiV1ProductIdentityItemIdGet) | **GET** /api/v1/product_identity/{item_id} | Get product identity detail |
| [**listProductIdentitiesApiV1ProductIdentityListGet**](ProductIdentityApi.md#listProductIdentitiesApiV1ProductIdentityListGet) | **GET** /api/v1/product_identity/list | List product identities |
| [**updateProductIdentityApiV1ProductIdentityPut**](ProductIdentityApi.md#updateProductIdentityApiV1ProductIdentityPut) | **PUT** /api/v1/product_identity | Update product identity |


<a id="createProductIdentityApiV1ProductIdentityPost"></a>
# **createProductIdentityApiV1ProductIdentityPost**
> Object createProductIdentityApiV1ProductIdentityPost(productIdentityCreate)

Create product identity

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ProductIdentityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ProductIdentityApi apiInstance = new ProductIdentityApi(defaultClient);
    ProductIdentityCreate productIdentityCreate = new ProductIdentityCreate(); // ProductIdentityCreate | 
    try {
      Object result = apiInstance.createProductIdentityApiV1ProductIdentityPost(productIdentityCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ProductIdentityApi#createProductIdentityApiV1ProductIdentityPost");
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
| **productIdentityCreate** | [**ProductIdentityCreate**](ProductIdentityCreate.md)|  | |

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

<a id="deleteProductIdentitiesApiV1ProductIdentityItemIdsDelete"></a>
# **deleteProductIdentitiesApiV1ProductIdentityItemIdsDelete**
> Object deleteProductIdentitiesApiV1ProductIdentityItemIdsDelete(itemIds)

Delete product identities

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ProductIdentityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ProductIdentityApi apiInstance = new ProductIdentityApi(defaultClient);
    String itemIds = "itemIds_example"; // String | 
    try {
      Object result = apiInstance.deleteProductIdentitiesApiV1ProductIdentityItemIdsDelete(itemIds);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ProductIdentityApi#deleteProductIdentitiesApiV1ProductIdentityItemIdsDelete");
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
| **itemIds** | **String**|  | |

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

<a id="getProductIdentityApiV1ProductIdentityItemIdGet"></a>
# **getProductIdentityApiV1ProductIdentityItemIdGet**
> Object getProductIdentityApiV1ProductIdentityItemIdGet(itemId)

Get product identity detail

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ProductIdentityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ProductIdentityApi apiInstance = new ProductIdentityApi(defaultClient);
    String itemId = "itemId_example"; // String | 
    try {
      Object result = apiInstance.getProductIdentityApiV1ProductIdentityItemIdGet(itemId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ProductIdentityApi#getProductIdentityApiV1ProductIdentityItemIdGet");
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
| **itemId** | **String**|  | |

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

<a id="listProductIdentitiesApiV1ProductIdentityListGet"></a>
# **listProductIdentitiesApiV1ProductIdentityListGet**
> Object listProductIdentitiesApiV1ProductIdentityListGet(page, limit, name, identityType, status)

List product identities

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ProductIdentityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ProductIdentityApi apiInstance = new ProductIdentityApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String name = "name_example"; // String | 
    String identityType = "identityType_example"; // String | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.listProductIdentitiesApiV1ProductIdentityListGet(page, limit, name, identityType, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ProductIdentityApi#listProductIdentitiesApiV1ProductIdentityListGet");
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
| **name** | **String**|  | [optional] |
| **identityType** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |

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

<a id="updateProductIdentityApiV1ProductIdentityPut"></a>
# **updateProductIdentityApiV1ProductIdentityPut**
> Object updateProductIdentityApiV1ProductIdentityPut(productIdentityUpdate)

Update product identity

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ProductIdentityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ProductIdentityApi apiInstance = new ProductIdentityApi(defaultClient);
    ProductIdentityUpdate productIdentityUpdate = new ProductIdentityUpdate(); // ProductIdentityUpdate | 
    try {
      Object result = apiInstance.updateProductIdentityApiV1ProductIdentityPut(productIdentityUpdate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ProductIdentityApi#updateProductIdentityApiV1ProductIdentityPut");
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
| **productIdentityUpdate** | [**ProductIdentityUpdate**](ProductIdentityUpdate.md)|  | |

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

