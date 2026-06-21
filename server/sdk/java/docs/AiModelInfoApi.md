# AiModelInfoApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**compatCreateModelApiV1AiCompatCreatePost**](AiModelInfoApi.md#compatCreateModelApiV1AiCompatCreatePost) | **POST** /api/v1/ai/compat/create | [兼容] 新增模型 (前端 aiModelInfo.add) |
| [**compatDeleteModelApiV1AiCompatDeleteGet**](AiModelInfoApi.md#compatDeleteModelApiV1AiCompatDeleteGet) | **GET** /api/v1/ai/compat/delete | [兼容] 删除模型 (前端 aiModelInfo.delete) |
| [**compatUpdateModelApiV1AiCompatUpdatePost**](AiModelInfoApi.md#compatUpdateModelApiV1AiCompatUpdatePost) | **POST** /api/v1/ai/compat/update | [兼容] 更新模型 (前端 aiModelInfo.update) |
| [**createModelApiV1AiCreatePost**](AiModelInfoApi.md#createModelApiV1AiCreatePost) | **POST** /api/v1/ai/create | 新增模型 |
| [**deleteModelApiV1AiModelIdDelete**](AiModelInfoApi.md#deleteModelApiV1AiModelIdDelete) | **DELETE** /api/v1/ai/{model_id} | 删除AI模型 |
| [**updateModelApiV1AiUpdatePost**](AiModelInfoApi.md#updateModelApiV1AiUpdatePost) | **POST** /api/v1/ai/update | 更新模型 |
| [**vendorStatsApiV1AiVendorsGet**](AiModelInfoApi.md#vendorStatsApiV1AiVendorsGet) | **GET** /api/v1/ai/vendors | 支持的厂商统计 |


<a id="compatCreateModelApiV1AiCompatCreatePost"></a>
# **compatCreateModelApiV1AiCompatCreatePost**
> Object compatCreateModelApiV1AiCompatCreatePost(name, source, img, remark, type, creator)

[兼容] 新增模型 (前端 aiModelInfo.add)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiModelInfoApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiModelInfoApi apiInstance = new AiModelInfoApi(defaultClient);
    String name = "name_example"; // String | 
    String source = ""; // String | 
    String img = ""; // String | 
    String remark = ""; // String | 
    Integer type = 56; // Integer | 
    String creator = ""; // String | 
    try {
      Object result = apiInstance.compatCreateModelApiV1AiCompatCreatePost(name, source, img, remark, type, creator);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiModelInfoApi#compatCreateModelApiV1AiCompatCreatePost");
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
| **name** | **String**|  | |
| **source** | **String**|  | [optional] [default to ] |
| **img** | **String**|  | [optional] [default to ] |
| **remark** | **String**|  | [optional] [default to ] |
| **type** | **Integer**|  | [optional] |
| **creator** | **String**|  | [optional] [default to ] |

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

<a id="compatDeleteModelApiV1AiCompatDeleteGet"></a>
# **compatDeleteModelApiV1AiCompatDeleteGet**
> Object compatDeleteModelApiV1AiCompatDeleteGet(id, updator)

[兼容] 删除模型 (前端 aiModelInfo.delete)

逻辑删除：将 status 置为 0。前端用 GET + query params，此处兼容。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiModelInfoApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiModelInfoApi apiInstance = new AiModelInfoApi(defaultClient);
    String id = "id_example"; // String | 
    String updator = ""; // String | 
    try {
      Object result = apiInstance.compatDeleteModelApiV1AiCompatDeleteGet(id, updator);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiModelInfoApi#compatDeleteModelApiV1AiCompatDeleteGet");
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
| **id** | **String**|  | |
| **updator** | **String**|  | [optional] [default to ] |

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

<a id="compatUpdateModelApiV1AiCompatUpdatePost"></a>
# **compatUpdateModelApiV1AiCompatUpdatePost**
> Object compatUpdateModelApiV1AiCompatUpdatePost(id, name, source, img, remark, type, isDel, updator)

[兼容] 更新模型 (前端 aiModelInfo.update)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiModelInfoApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiModelInfoApi apiInstance = new AiModelInfoApi(defaultClient);
    String id = "id_example"; // String | 
    String name = "name_example"; // String | 
    String source = "source_example"; // String | 
    String img = "img_example"; // String | 
    String remark = "remark_example"; // String | 
    Integer type = 56; // Integer | 
    Integer isDel = 56; // Integer | 
    String updator = ""; // String | 
    try {
      Object result = apiInstance.compatUpdateModelApiV1AiCompatUpdatePost(id, name, source, img, remark, type, isDel, updator);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiModelInfoApi#compatUpdateModelApiV1AiCompatUpdatePost");
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
| **id** | **String**|  | |
| **name** | **String**|  | [optional] |
| **source** | **String**|  | [optional] |
| **img** | **String**|  | [optional] |
| **remark** | **String**|  | [optional] |
| **type** | **Integer**|  | [optional] |
| **isDel** | **Integer**|  | [optional] |
| **updator** | **String**|  | [optional] [default to ] |

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

<a id="createModelApiV1AiCreatePost"></a>
# **createModelApiV1AiCreatePost**
> Object createModelApiV1AiCreatePost(vendor, modelName, description, icon)

新增模型

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiModelInfoApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiModelInfoApi apiInstance = new AiModelInfoApi(defaultClient);
    String vendor = "vendor_example"; // String | 
    String modelName = "modelName_example"; // String | 
    String description = ""; // String | 
    String icon = ""; // String | 
    try {
      Object result = apiInstance.createModelApiV1AiCreatePost(vendor, modelName, description, icon);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiModelInfoApi#createModelApiV1AiCreatePost");
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
| **vendor** | **String**|  | |
| **modelName** | **String**|  | |
| **description** | **String**|  | [optional] [default to ] |
| **icon** | **String**|  | [optional] [default to ] |

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

<a id="deleteModelApiV1AiModelIdDelete"></a>
# **deleteModelApiV1AiModelIdDelete**
> Object deleteModelApiV1AiModelIdDelete(modelId)

删除AI模型

逻辑删除：将 status 置为 0。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiModelInfoApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiModelInfoApi apiInstance = new AiModelInfoApi(defaultClient);
    Integer modelId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteModelApiV1AiModelIdDelete(modelId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiModelInfoApi#deleteModelApiV1AiModelIdDelete");
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
| **modelId** | **Integer**|  | |

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

<a id="updateModelApiV1AiUpdatePost"></a>
# **updateModelApiV1AiUpdatePost**
> Object updateModelApiV1AiUpdatePost(modelId, displayName, status)

更新模型

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiModelInfoApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiModelInfoApi apiInstance = new AiModelInfoApi(defaultClient);
    Integer modelId = 56; // Integer | 
    String displayName = "displayName_example"; // String | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.updateModelApiV1AiUpdatePost(modelId, displayName, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiModelInfoApi#updateModelApiV1AiUpdatePost");
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
| **modelId** | **Integer**|  | |
| **displayName** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |

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

<a id="vendorStatsApiV1AiVendorsGet"></a>
# **vendorStatsApiV1AiVendorsGet**
> Object vendorStatsApiV1AiVendorsGet()

支持的厂商统计

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiModelInfoApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiModelInfoApi apiInstance = new AiModelInfoApi(defaultClient);
    try {
      Object result = apiInstance.vendorStatsApiV1AiVendorsGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiModelInfoApi#vendorStatsApiV1AiVendorsGet");
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

