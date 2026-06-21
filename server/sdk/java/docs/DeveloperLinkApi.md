# DeveloperLinkApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**assignAccountApiV1DeveloperLinkAssignAccountPut**](DeveloperLinkApi.md#assignAccountApiV1DeveloperLinkAssignAccountPut) | **PUT** /api/v1/developerLink/assignAccount | Assign Coze account to developer |
| [**createDeveloperLinkApiV1DeveloperLinkPost**](DeveloperLinkApi.md#createDeveloperLinkApiV1DeveloperLinkPost) | **POST** /api/v1/developerLink | Create developer link |
| [**deleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete**](DeveloperLinkApi.md#deleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete) | **DELETE** /api/v1/developerLink/{item_ids} | Delete developer links |
| [**getDeveloperLinkApiV1DeveloperLinkItemIdGet**](DeveloperLinkApi.md#getDeveloperLinkApiV1DeveloperLinkItemIdGet) | **GET** /api/v1/developerLink/{item_id} | Get developer link detail |
| [**listDeveloperLinksApiV1DeveloperLinkListGet**](DeveloperLinkApi.md#listDeveloperLinksApiV1DeveloperLinkListGet) | **GET** /api/v1/developerLink/list | List developer links |
| [**updateDeveloperLinkApiV1DeveloperLinkPut**](DeveloperLinkApi.md#updateDeveloperLinkApiV1DeveloperLinkPut) | **PUT** /api/v1/developerLink | Update developer link |


<a id="assignAccountApiV1DeveloperLinkAssignAccountPut"></a>
# **assignAccountApiV1DeveloperLinkAssignAccountPut**
> Object assignAccountApiV1DeveloperLinkAssignAccountPut(assignAccountRequest)

Assign Coze account to developer

Assign a Coze account to a developer link.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.DeveloperLinkApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    DeveloperLinkApi apiInstance = new DeveloperLinkApi(defaultClient);
    AssignAccountRequest assignAccountRequest = new AssignAccountRequest(); // AssignAccountRequest | 
    try {
      Object result = apiInstance.assignAccountApiV1DeveloperLinkAssignAccountPut(assignAccountRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling DeveloperLinkApi#assignAccountApiV1DeveloperLinkAssignAccountPut");
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
| **assignAccountRequest** | [**AssignAccountRequest**](AssignAccountRequest.md)|  | |

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

<a id="createDeveloperLinkApiV1DeveloperLinkPost"></a>
# **createDeveloperLinkApiV1DeveloperLinkPost**
> Object createDeveloperLinkApiV1DeveloperLinkPost(developerLinkCreate)

Create developer link

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.DeveloperLinkApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    DeveloperLinkApi apiInstance = new DeveloperLinkApi(defaultClient);
    DeveloperLinkCreate developerLinkCreate = new DeveloperLinkCreate(); // DeveloperLinkCreate | 
    try {
      Object result = apiInstance.createDeveloperLinkApiV1DeveloperLinkPost(developerLinkCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling DeveloperLinkApi#createDeveloperLinkApiV1DeveloperLinkPost");
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
| **developerLinkCreate** | [**DeveloperLinkCreate**](DeveloperLinkCreate.md)|  | |

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

<a id="deleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete"></a>
# **deleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete**
> Object deleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete(itemIds)

Delete developer links

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.DeveloperLinkApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    DeveloperLinkApi apiInstance = new DeveloperLinkApi(defaultClient);
    String itemIds = "itemIds_example"; // String | 
    try {
      Object result = apiInstance.deleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete(itemIds);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling DeveloperLinkApi#deleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete");
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

<a id="getDeveloperLinkApiV1DeveloperLinkItemIdGet"></a>
# **getDeveloperLinkApiV1DeveloperLinkItemIdGet**
> Object getDeveloperLinkApiV1DeveloperLinkItemIdGet(itemId)

Get developer link detail

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.DeveloperLinkApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    DeveloperLinkApi apiInstance = new DeveloperLinkApi(defaultClient);
    Integer itemId = 56; // Integer | 
    try {
      Object result = apiInstance.getDeveloperLinkApiV1DeveloperLinkItemIdGet(itemId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling DeveloperLinkApi#getDeveloperLinkApiV1DeveloperLinkItemIdGet");
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

<a id="listDeveloperLinksApiV1DeveloperLinkListGet"></a>
# **listDeveloperLinksApiV1DeveloperLinkListGet**
> Object listDeveloperLinksApiV1DeveloperLinkListGet(page, limit, userId, status)

List developer links

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.DeveloperLinkApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    DeveloperLinkApi apiInstance = new DeveloperLinkApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String userId = "userId_example"; // String | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.listDeveloperLinksApiV1DeveloperLinkListGet(page, limit, userId, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling DeveloperLinkApi#listDeveloperLinksApiV1DeveloperLinkListGet");
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
| **userId** | **String**|  | [optional] |
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

<a id="updateDeveloperLinkApiV1DeveloperLinkPut"></a>
# **updateDeveloperLinkApiV1DeveloperLinkPut**
> Object updateDeveloperLinkApiV1DeveloperLinkPut(developerLinkUpdate)

Update developer link

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.DeveloperLinkApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    DeveloperLinkApi apiInstance = new DeveloperLinkApi(defaultClient);
    DeveloperLinkUpdate developerLinkUpdate = new DeveloperLinkUpdate(); // DeveloperLinkUpdate | 
    try {
      Object result = apiInstance.updateDeveloperLinkApiV1DeveloperLinkPut(developerLinkUpdate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling DeveloperLinkApi#updateDeveloperLinkApiV1DeveloperLinkPut");
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
| **developerLinkUpdate** | [**DeveloperLinkUpdate**](DeveloperLinkUpdate.md)|  | |

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

