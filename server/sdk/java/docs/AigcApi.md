# AigcApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createAigcApiV1ContentAigcPost**](AigcApi.md#createAigcApiV1ContentAigcPost) | **POST** /api/v1/content/aigc | Create AIGC record |
| [**deleteAigcApiV1ContentAigcItemIdsDelete**](AigcApi.md#deleteAigcApiV1ContentAigcItemIdsDelete) | **DELETE** /api/v1/content/aigc/{item_ids} | Delete AIGC records |
| [**getAigcApiV1ContentAigcItemIdGet**](AigcApi.md#getAigcApiV1ContentAigcItemIdGet) | **GET** /api/v1/content/aigc/{item_id} | Get AIGC detail |
| [**listAigcApiV1ContentAigcListGet**](AigcApi.md#listAigcApiV1ContentAigcListGet) | **GET** /api/v1/content/aigc/list | List AIGC records |
| [**updateAigcApiV1ContentAigcPut**](AigcApi.md#updateAigcApiV1ContentAigcPut) | **PUT** /api/v1/content/aigc | Update AIGC record |


<a id="createAigcApiV1ContentAigcPost"></a>
# **createAigcApiV1ContentAigcPost**
> Object createAigcApiV1ContentAigcPost(aiGcCreate)

Create AIGC record

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AigcApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AigcApi apiInstance = new AigcApi(defaultClient);
    AiGcCreate aiGcCreate = new AiGcCreate(); // AiGcCreate | 
    try {
      Object result = apiInstance.createAigcApiV1ContentAigcPost(aiGcCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AigcApi#createAigcApiV1ContentAigcPost");
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
| **aiGcCreate** | [**AiGcCreate**](AiGcCreate.md)|  | |

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

<a id="deleteAigcApiV1ContentAigcItemIdsDelete"></a>
# **deleteAigcApiV1ContentAigcItemIdsDelete**
> Object deleteAigcApiV1ContentAigcItemIdsDelete(itemIds)

Delete AIGC records

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AigcApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AigcApi apiInstance = new AigcApi(defaultClient);
    String itemIds = "itemIds_example"; // String | 
    try {
      Object result = apiInstance.deleteAigcApiV1ContentAigcItemIdsDelete(itemIds);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AigcApi#deleteAigcApiV1ContentAigcItemIdsDelete");
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

<a id="getAigcApiV1ContentAigcItemIdGet"></a>
# **getAigcApiV1ContentAigcItemIdGet**
> Object getAigcApiV1ContentAigcItemIdGet(itemId)

Get AIGC detail

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AigcApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AigcApi apiInstance = new AigcApi(defaultClient);
    Integer itemId = 56; // Integer | 
    try {
      Object result = apiInstance.getAigcApiV1ContentAigcItemIdGet(itemId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AigcApi#getAigcApiV1ContentAigcItemIdGet");
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
| **itemId** | **Integer**|  | |

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

<a id="listAigcApiV1ContentAigcListGet"></a>
# **listAigcApiV1ContentAigcListGet**
> Object listAigcApiV1ContentAigcListGet(page, limit, userUuid, gcType, status)

List AIGC records

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AigcApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AigcApi apiInstance = new AigcApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String userUuid = "userUuid_example"; // String | 
    String gcType = "gcType_example"; // String | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.listAigcApiV1ContentAigcListGet(page, limit, userUuid, gcType, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AigcApi#listAigcApiV1ContentAigcListGet");
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
| **userUuid** | **String**|  | [optional] |
| **gcType** | **String**|  | [optional] |
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

<a id="updateAigcApiV1ContentAigcPut"></a>
# **updateAigcApiV1ContentAigcPut**
> Object updateAigcApiV1ContentAigcPut(aiGcUpdate)

Update AIGC record

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AigcApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AigcApi apiInstance = new AigcApi(defaultClient);
    AiGcUpdate aiGcUpdate = new AiGcUpdate(); // AiGcUpdate | 
    try {
      Object result = apiInstance.updateAigcApiV1ContentAigcPut(aiGcUpdate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AigcApi#updateAigcApiV1ContentAigcPut");
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
| **aiGcUpdate** | [**AiGcUpdate**](AiGcUpdate.md)|  | |

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

