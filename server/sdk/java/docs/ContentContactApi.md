# ContentContactApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**contactAddApiV1ContentContactPost**](ContentContactApi.md#contactAddApiV1ContentContactPost) | **POST** /api/v1/content/contact | Contact Add |
| [**contactEditApiV1ContentContactPut**](ContentContactApi.md#contactEditApiV1ContentContactPut) | **PUT** /api/v1/content/contact | Contact Edit |
| [**contactGetInfoApiV1ContentContactItemIdGet**](ContentContactApi.md#contactGetInfoApiV1ContentContactItemIdGet) | **GET** /api/v1/content/contact/{item_id} | Contact Get Info |
| [**contactListApiV1ContentContactListGet**](ContentContactApi.md#contactListApiV1ContentContactListGet) | **GET** /api/v1/content/contact/list | Contact List |
| [**contactRemoveApiV1ContentContactItemIdsDelete**](ContentContactApi.md#contactRemoveApiV1ContentContactItemIdsDelete) | **DELETE** /api/v1/content/contact/{item_ids} | Contact Remove |


<a id="contactAddApiV1ContentContactPost"></a>
# **contactAddApiV1ContentContactPost**
> Object contactAddApiV1ContentContactPost(contactIn)

Contact Add

Create new contact.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentContactApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ContentContactApi apiInstance = new ContentContactApi(defaultClient);
    ContactIn contactIn = new ContactIn(); // ContactIn | 
    try {
      Object result = apiInstance.contactAddApiV1ContentContactPost(contactIn);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentContactApi#contactAddApiV1ContentContactPost");
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
| **contactIn** | [**ContactIn**](ContactIn.md)|  | |

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

<a id="contactEditApiV1ContentContactPut"></a>
# **contactEditApiV1ContentContactPut**
> Object contactEditApiV1ContentContactPut(id, contactIn)

Contact Edit

Update contact.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentContactApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ContentContactApi apiInstance = new ContentContactApi(defaultClient);
    Integer id = 56; // Integer | 
    ContactIn contactIn = new ContactIn(); // ContactIn | 
    try {
      Object result = apiInstance.contactEditApiV1ContentContactPut(id, contactIn);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentContactApi#contactEditApiV1ContentContactPut");
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
| **id** | **Integer**|  | |
| **contactIn** | [**ContactIn**](ContactIn.md)|  | |

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

<a id="contactGetInfoApiV1ContentContactItemIdGet"></a>
# **contactGetInfoApiV1ContentContactItemIdGet**
> Object contactGetInfoApiV1ContentContactItemIdGet(itemId)

Contact Get Info

Get contact detail by ID.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentContactApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentContactApi apiInstance = new ContentContactApi(defaultClient);
    Integer itemId = 56; // Integer | 
    try {
      Object result = apiInstance.contactGetInfoApiV1ContentContactItemIdGet(itemId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentContactApi#contactGetInfoApiV1ContentContactItemIdGet");
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

<a id="contactListApiV1ContentContactListGet"></a>
# **contactListApiV1ContentContactListGet**
> Object contactListApiV1ContentContactListGet(pageNum, pageSize)

Contact List

List contacts with pagination.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentContactApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentContactApi apiInstance = new ContentContactApi(defaultClient);
    Integer pageNum = 1; // Integer | 
    Integer pageSize = 10; // Integer | 
    try {
      Object result = apiInstance.contactListApiV1ContentContactListGet(pageNum, pageSize);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentContactApi#contactListApiV1ContentContactListGet");
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
| **pageNum** | **Integer**|  | [optional] [default to 1] |
| **pageSize** | **Integer**|  | [optional] [default to 10] |

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

<a id="contactRemoveApiV1ContentContactItemIdsDelete"></a>
# **contactRemoveApiV1ContentContactItemIdsDelete**
> Object contactRemoveApiV1ContentContactItemIdsDelete(itemIds)

Contact Remove

Delete contacts by comma-separated IDs.  Fixed: Use parameterized queries to prevent SQL injection. IDs are validated as integers before use.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentContactApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ContentContactApi apiInstance = new ContentContactApi(defaultClient);
    String itemIds = "itemIds_example"; // String | 
    try {
      Object result = apiInstance.contactRemoveApiV1ContentContactItemIdsDelete(itemIds);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentContactApi#contactRemoveApiV1ContentContactItemIdsDelete");
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

