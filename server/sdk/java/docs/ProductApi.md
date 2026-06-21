# ProductApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createProductApiV1ZhsProductPost**](ProductApi.md#createProductApiV1ZhsProductPost) | **POST** /api/v1/zhs_product | Create product |
| [**deleteProductsApiV1ZhsProductItemIdsDelete**](ProductApi.md#deleteProductsApiV1ZhsProductItemIdsDelete) | **DELETE** /api/v1/zhs_product/{item_ids} | Delete products |
| [**getProductApiV1ZhsProductItemIdGet**](ProductApi.md#getProductApiV1ZhsProductItemIdGet) | **GET** /api/v1/zhs_product/{item_id} | Get product detail |
| [**listProductsApiV1ZhsProductListGet**](ProductApi.md#listProductsApiV1ZhsProductListGet) | **GET** /api/v1/zhs_product/list | List products |
| [**updateProductApiV1ZhsProductPut**](ProductApi.md#updateProductApiV1ZhsProductPut) | **PUT** /api/v1/zhs_product | Update product |


<a id="createProductApiV1ZhsProductPost"></a>
# **createProductApiV1ZhsProductPost**
> Object createProductApiV1ZhsProductPost(productCreate)

Create product

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ProductApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ProductApi apiInstance = new ProductApi(defaultClient);
    ProductCreate productCreate = new ProductCreate(); // ProductCreate | 
    try {
      Object result = apiInstance.createProductApiV1ZhsProductPost(productCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ProductApi#createProductApiV1ZhsProductPost");
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
| **productCreate** | [**ProductCreate**](ProductCreate.md)|  | |

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

<a id="deleteProductsApiV1ZhsProductItemIdsDelete"></a>
# **deleteProductsApiV1ZhsProductItemIdsDelete**
> Object deleteProductsApiV1ZhsProductItemIdsDelete(itemIds)

Delete products

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ProductApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ProductApi apiInstance = new ProductApi(defaultClient);
    String itemIds = "itemIds_example"; // String | 
    try {
      Object result = apiInstance.deleteProductsApiV1ZhsProductItemIdsDelete(itemIds);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ProductApi#deleteProductsApiV1ZhsProductItemIdsDelete");
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

<a id="getProductApiV1ZhsProductItemIdGet"></a>
# **getProductApiV1ZhsProductItemIdGet**
> Object getProductApiV1ZhsProductItemIdGet(itemId)

Get product detail

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ProductApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ProductApi apiInstance = new ProductApi(defaultClient);
    String itemId = "itemId_example"; // String | 
    try {
      Object result = apiInstance.getProductApiV1ZhsProductItemIdGet(itemId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ProductApi#getProductApiV1ZhsProductItemIdGet");
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

<a id="listProductsApiV1ZhsProductListGet"></a>
# **listProductsApiV1ZhsProductListGet**
> Object listProductsApiV1ZhsProductListGet(page, limit, name, type, status)

List products

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ProductApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ProductApi apiInstance = new ProductApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String name = "name_example"; // String | 
    String type = "type_example"; // String | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.listProductsApiV1ZhsProductListGet(page, limit, name, type, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ProductApi#listProductsApiV1ZhsProductListGet");
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
| **type** | **String**|  | [optional] |
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

<a id="updateProductApiV1ZhsProductPut"></a>
# **updateProductApiV1ZhsProductPut**
> Object updateProductApiV1ZhsProductPut(productUpdate)

Update product

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ProductApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ProductApi apiInstance = new ProductApi(defaultClient);
    ProductUpdate productUpdate = new ProductUpdate(); // ProductUpdate | 
    try {
      Object result = apiInstance.updateProductApiV1ZhsProductPut(productUpdate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ProductApi#updateProductApiV1ZhsProductPut");
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
| **productUpdate** | [**ProductUpdate**](ProductUpdate.md)|  | |

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

