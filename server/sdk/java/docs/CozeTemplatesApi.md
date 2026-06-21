# CozeTemplatesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost**](CozeTemplatesApi.md#duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost) | **POST** /api/v1/coze/templates/templates/duplicate | Duplicate Template |
| [**duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0**](CozeTemplatesApi.md#duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0) | **POST** /api/v1/coze/templates/templates/duplicate | Duplicate Template |
| [**listTemplatesApiV1CozeTemplatesTemplatesListGet**](CozeTemplatesApi.md#listTemplatesApiV1CozeTemplatesTemplatesListGet) | **GET** /api/v1/coze/templates/templates/list | List Templates |
| [**listTemplatesApiV1CozeTemplatesTemplatesListGet_0**](CozeTemplatesApi.md#listTemplatesApiV1CozeTemplatesTemplatesListGet_0) | **GET** /api/v1/coze/templates/templates/list | List Templates |


<a id="duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost"></a>
# **duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost**
> Object duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost(duplicateTemplateReq)

Duplicate Template

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeTemplatesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeTemplatesApi apiInstance = new CozeTemplatesApi(defaultClient);
    DuplicateTemplateReq duplicateTemplateReq = new DuplicateTemplateReq(); // DuplicateTemplateReq | 
    try {
      Object result = apiInstance.duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost(duplicateTemplateReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeTemplatesApi#duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost");
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
| **duplicateTemplateReq** | [**DuplicateTemplateReq**](DuplicateTemplateReq.md)|  | |

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

<a id="duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0"></a>
# **duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0**
> Object duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0(duplicateTemplateReq)

Duplicate Template

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeTemplatesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeTemplatesApi apiInstance = new CozeTemplatesApi(defaultClient);
    DuplicateTemplateReq duplicateTemplateReq = new DuplicateTemplateReq(); // DuplicateTemplateReq | 
    try {
      Object result = apiInstance.duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0(duplicateTemplateReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeTemplatesApi#duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0");
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
| **duplicateTemplateReq** | [**DuplicateTemplateReq**](DuplicateTemplateReq.md)|  | |

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

<a id="listTemplatesApiV1CozeTemplatesTemplatesListGet"></a>
# **listTemplatesApiV1CozeTemplatesTemplatesListGet**
> Object listTemplatesApiV1CozeTemplatesTemplatesListGet(page, size)

List Templates

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeTemplatesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeTemplatesApi apiInstance = new CozeTemplatesApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.listTemplatesApiV1CozeTemplatesTemplatesListGet(page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeTemplatesApi#listTemplatesApiV1CozeTemplatesTemplatesListGet");
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
| **size** | **Integer**|  | [optional] [default to 20] |

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

<a id="listTemplatesApiV1CozeTemplatesTemplatesListGet_0"></a>
# **listTemplatesApiV1CozeTemplatesTemplatesListGet_0**
> Object listTemplatesApiV1CozeTemplatesTemplatesListGet_0(page, size)

List Templates

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeTemplatesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeTemplatesApi apiInstance = new CozeTemplatesApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.listTemplatesApiV1CozeTemplatesTemplatesListGet_0(page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeTemplatesApi#listTemplatesApiV1CozeTemplatesTemplatesListGet_0");
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
| **size** | **Integer**|  | [optional] [default to 20] |

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

