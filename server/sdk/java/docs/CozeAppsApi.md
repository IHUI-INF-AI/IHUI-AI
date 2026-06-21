# CozeAppsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**listApiAppsApiV1CozeAppsAppsListApiAppsGet**](CozeAppsApi.md#listApiAppsApiV1CozeAppsAppsListApiAppsGet) | **GET** /api/v1/coze/apps/apps/list_api_apps | List Api Apps |
| [**listApiAppsApiV1CozeAppsAppsListApiAppsGet_0**](CozeAppsApi.md#listApiAppsApiV1CozeAppsAppsListApiAppsGet_0) | **GET** /api/v1/coze/apps/apps/list_api_apps | List Api Apps |
| [**listAppEventsApiV1CozeAppsAppsEventsGet**](CozeAppsApi.md#listAppEventsApiV1CozeAppsAppsEventsGet) | **GET** /api/v1/coze/apps/apps/events | List App Events |
| [**listAppEventsApiV1CozeAppsAppsEventsGet_0**](CozeAppsApi.md#listAppEventsApiV1CozeAppsAppsEventsGet_0) | **GET** /api/v1/coze/apps/apps/events | List App Events |
| [**listAppsApiV1CozeAppsAppsListGet**](CozeAppsApi.md#listAppsApiV1CozeAppsAppsListGet) | **GET** /api/v1/coze/apps/apps/list | List Apps |
| [**listAppsApiV1CozeAppsAppsListGet_0**](CozeAppsApi.md#listAppsApiV1CozeAppsAppsListGet_0) | **GET** /api/v1/coze/apps/apps/list | List Apps |


<a id="listApiAppsApiV1CozeAppsAppsListApiAppsGet"></a>
# **listApiAppsApiV1CozeAppsAppsListApiAppsGet**
> Object listApiAppsApiV1CozeAppsAppsListApiAppsGet(page, size)

List Api Apps

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAppsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAppsApi apiInstance = new CozeAppsApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.listApiAppsApiV1CozeAppsAppsListApiAppsGet(page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAppsApi#listApiAppsApiV1CozeAppsAppsListApiAppsGet");
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

<a id="listApiAppsApiV1CozeAppsAppsListApiAppsGet_0"></a>
# **listApiAppsApiV1CozeAppsAppsListApiAppsGet_0**
> Object listApiAppsApiV1CozeAppsAppsListApiAppsGet_0(page, size)

List Api Apps

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAppsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAppsApi apiInstance = new CozeAppsApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.listApiAppsApiV1CozeAppsAppsListApiAppsGet_0(page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAppsApi#listApiAppsApiV1CozeAppsAppsListApiAppsGet_0");
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

<a id="listAppEventsApiV1CozeAppsAppsEventsGet"></a>
# **listAppEventsApiV1CozeAppsAppsEventsGet**
> Object listAppEventsApiV1CozeAppsAppsEventsGet(appId, page, size)

List App Events

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAppsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAppsApi apiInstance = new CozeAppsApi(defaultClient);
    String appId = "appId_example"; // String | 
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.listAppEventsApiV1CozeAppsAppsEventsGet(appId, page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAppsApi#listAppEventsApiV1CozeAppsAppsEventsGet");
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
| **appId** | **String**|  | |
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

<a id="listAppEventsApiV1CozeAppsAppsEventsGet_0"></a>
# **listAppEventsApiV1CozeAppsAppsEventsGet_0**
> Object listAppEventsApiV1CozeAppsAppsEventsGet_0(appId, page, size)

List App Events

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAppsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAppsApi apiInstance = new CozeAppsApi(defaultClient);
    String appId = "appId_example"; // String | 
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.listAppEventsApiV1CozeAppsAppsEventsGet_0(appId, page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAppsApi#listAppEventsApiV1CozeAppsAppsEventsGet_0");
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
| **appId** | **String**|  | |
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

<a id="listAppsApiV1CozeAppsAppsListGet"></a>
# **listAppsApiV1CozeAppsAppsListGet**
> Object listAppsApiV1CozeAppsAppsListGet(page, size)

List Apps

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAppsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAppsApi apiInstance = new CozeAppsApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.listAppsApiV1CozeAppsAppsListGet(page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAppsApi#listAppsApiV1CozeAppsAppsListGet");
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

<a id="listAppsApiV1CozeAppsAppsListGet_0"></a>
# **listAppsApiV1CozeAppsAppsListGet_0**
> Object listAppsApiV1CozeAppsAppsListGet_0(page, size)

List Apps

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAppsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAppsApi apiInstance = new CozeAppsApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.listAppsApiV1CozeAppsAppsListGet_0(page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAppsApi#listAppsApiV1CozeAppsAppsListGet_0");
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

