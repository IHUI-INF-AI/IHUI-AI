# ScheduleApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createScheduleApiV1SchedulePost**](ScheduleApi.md#createScheduleApiV1SchedulePost) | **POST** /api/v1/schedule | 创建日程 |
| [**createScheduleApiV1SchedulePost_0**](ScheduleApi.md#createScheduleApiV1SchedulePost_0) | **POST** /api/v1/schedule | 创建日程 |
| [**deleteScheduleApiV1ScheduleSidDelete**](ScheduleApi.md#deleteScheduleApiV1ScheduleSidDelete) | **DELETE** /api/v1/schedule/{sid} | 删除日程 |
| [**deleteScheduleApiV1ScheduleSidDelete_0**](ScheduleApi.md#deleteScheduleApiV1ScheduleSidDelete_0) | **DELETE** /api/v1/schedule/{sid} | 删除日程 |
| [**listSchedulesApiV1ScheduleListGet**](ScheduleApi.md#listSchedulesApiV1ScheduleListGet) | **GET** /api/v1/schedule/list | 我的日程 |
| [**listSchedulesApiV1ScheduleListGet_0**](ScheduleApi.md#listSchedulesApiV1ScheduleListGet_0) | **GET** /api/v1/schedule/list | 我的日程 |
| [**updateScheduleApiV1ScheduleSidPut**](ScheduleApi.md#updateScheduleApiV1ScheduleSidPut) | **PUT** /api/v1/schedule/{sid} | 修改日程 |
| [**updateScheduleApiV1ScheduleSidPut_0**](ScheduleApi.md#updateScheduleApiV1ScheduleSidPut_0) | **PUT** /api/v1/schedule/{sid} | 修改日程 |


<a id="createScheduleApiV1SchedulePost"></a>
# **createScheduleApiV1SchedulePost**
> Object createScheduleApiV1SchedulePost(title, startTime, description, endTime, allDay, type, color, remindBefore, location, refId, refType)

创建日程

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ScheduleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ScheduleApi apiInstance = new ScheduleApi(defaultClient);
    String title = "title_example"; // String | 
    OffsetDateTime startTime = OffsetDateTime.now(); // OffsetDateTime | 
    String description = "description_example"; // String | 
    OffsetDateTime endTime = OffsetDateTime.now(); // OffsetDateTime | 
    Boolean allDay = false; // Boolean | 
    String type = "personal"; // String | 
    String color = "color_example"; // String | 
    Integer remindBefore = 0; // Integer | 
    String location = "location_example"; // String | 
    String refId = "refId_example"; // String | 
    String refType = "refType_example"; // String | 
    try {
      Object result = apiInstance.createScheduleApiV1SchedulePost(title, startTime, description, endTime, allDay, type, color, remindBefore, location, refId, refType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ScheduleApi#createScheduleApiV1SchedulePost");
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
| **title** | **String**|  | |
| **startTime** | **OffsetDateTime**|  | |
| **description** | **String**|  | [optional] |
| **endTime** | **OffsetDateTime**|  | [optional] |
| **allDay** | **Boolean**|  | [optional] [default to false] |
| **type** | **String**|  | [optional] [default to personal] |
| **color** | **String**|  | [optional] |
| **remindBefore** | **Integer**|  | [optional] [default to 0] |
| **location** | **String**|  | [optional] |
| **refId** | **String**|  | [optional] |
| **refType** | **String**|  | [optional] |

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

<a id="createScheduleApiV1SchedulePost_0"></a>
# **createScheduleApiV1SchedulePost_0**
> Object createScheduleApiV1SchedulePost_0(title, startTime, description, endTime, allDay, type, color, remindBefore, location, refId, refType)

创建日程

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ScheduleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ScheduleApi apiInstance = new ScheduleApi(defaultClient);
    String title = "title_example"; // String | 
    OffsetDateTime startTime = OffsetDateTime.now(); // OffsetDateTime | 
    String description = "description_example"; // String | 
    OffsetDateTime endTime = OffsetDateTime.now(); // OffsetDateTime | 
    Boolean allDay = false; // Boolean | 
    String type = "personal"; // String | 
    String color = "color_example"; // String | 
    Integer remindBefore = 0; // Integer | 
    String location = "location_example"; // String | 
    String refId = "refId_example"; // String | 
    String refType = "refType_example"; // String | 
    try {
      Object result = apiInstance.createScheduleApiV1SchedulePost_0(title, startTime, description, endTime, allDay, type, color, remindBefore, location, refId, refType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ScheduleApi#createScheduleApiV1SchedulePost_0");
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
| **title** | **String**|  | |
| **startTime** | **OffsetDateTime**|  | |
| **description** | **String**|  | [optional] |
| **endTime** | **OffsetDateTime**|  | [optional] |
| **allDay** | **Boolean**|  | [optional] [default to false] |
| **type** | **String**|  | [optional] [default to personal] |
| **color** | **String**|  | [optional] |
| **remindBefore** | **Integer**|  | [optional] [default to 0] |
| **location** | **String**|  | [optional] |
| **refId** | **String**|  | [optional] |
| **refType** | **String**|  | [optional] |

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

<a id="deleteScheduleApiV1ScheduleSidDelete"></a>
# **deleteScheduleApiV1ScheduleSidDelete**
> Object deleteScheduleApiV1ScheduleSidDelete(sid)

删除日程

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ScheduleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ScheduleApi apiInstance = new ScheduleApi(defaultClient);
    Integer sid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteScheduleApiV1ScheduleSidDelete(sid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ScheduleApi#deleteScheduleApiV1ScheduleSidDelete");
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
| **sid** | **Integer**|  | |

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

<a id="deleteScheduleApiV1ScheduleSidDelete_0"></a>
# **deleteScheduleApiV1ScheduleSidDelete_0**
> Object deleteScheduleApiV1ScheduleSidDelete_0(sid)

删除日程

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ScheduleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ScheduleApi apiInstance = new ScheduleApi(defaultClient);
    Integer sid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteScheduleApiV1ScheduleSidDelete_0(sid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ScheduleApi#deleteScheduleApiV1ScheduleSidDelete_0");
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
| **sid** | **Integer**|  | |

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

<a id="listSchedulesApiV1ScheduleListGet"></a>
# **listSchedulesApiV1ScheduleListGet**
> Object listSchedulesApiV1ScheduleListGet(page, limit, type, startDate, endDate)

我的日程

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ScheduleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ScheduleApi apiInstance = new ScheduleApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String type = "type_example"; // String | 
    String startDate = "startDate_example"; // String | 
    String endDate = "endDate_example"; // String | 
    try {
      Object result = apiInstance.listSchedulesApiV1ScheduleListGet(page, limit, type, startDate, endDate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ScheduleApi#listSchedulesApiV1ScheduleListGet");
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
| **type** | **String**|  | [optional] |
| **startDate** | **String**|  | [optional] |
| **endDate** | **String**|  | [optional] |

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

<a id="listSchedulesApiV1ScheduleListGet_0"></a>
# **listSchedulesApiV1ScheduleListGet_0**
> Object listSchedulesApiV1ScheduleListGet_0(page, limit, type, startDate, endDate)

我的日程

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ScheduleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ScheduleApi apiInstance = new ScheduleApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String type = "type_example"; // String | 
    String startDate = "startDate_example"; // String | 
    String endDate = "endDate_example"; // String | 
    try {
      Object result = apiInstance.listSchedulesApiV1ScheduleListGet_0(page, limit, type, startDate, endDate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ScheduleApi#listSchedulesApiV1ScheduleListGet_0");
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
| **type** | **String**|  | [optional] |
| **startDate** | **String**|  | [optional] |
| **endDate** | **String**|  | [optional] |

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

<a id="updateScheduleApiV1ScheduleSidPut"></a>
# **updateScheduleApiV1ScheduleSidPut**
> Object updateScheduleApiV1ScheduleSidPut(sid, title, description, startTime, endTime, status, color)

修改日程

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ScheduleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ScheduleApi apiInstance = new ScheduleApi(defaultClient);
    Integer sid = 56; // Integer | 
    String title = "title_example"; // String | 
    String description = "description_example"; // String | 
    OffsetDateTime startTime = OffsetDateTime.now(); // OffsetDateTime | 
    OffsetDateTime endTime = OffsetDateTime.now(); // OffsetDateTime | 
    Integer status = 56; // Integer | 
    String color = "color_example"; // String | 
    try {
      Object result = apiInstance.updateScheduleApiV1ScheduleSidPut(sid, title, description, startTime, endTime, status, color);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ScheduleApi#updateScheduleApiV1ScheduleSidPut");
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
| **sid** | **Integer**|  | |
| **title** | **String**|  | [optional] |
| **description** | **String**|  | [optional] |
| **startTime** | **OffsetDateTime**|  | [optional] |
| **endTime** | **OffsetDateTime**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **color** | **String**|  | [optional] |

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

<a id="updateScheduleApiV1ScheduleSidPut_0"></a>
# **updateScheduleApiV1ScheduleSidPut_0**
> Object updateScheduleApiV1ScheduleSidPut_0(sid, title, description, startTime, endTime, status, color)

修改日程

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ScheduleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ScheduleApi apiInstance = new ScheduleApi(defaultClient);
    Integer sid = 56; // Integer | 
    String title = "title_example"; // String | 
    String description = "description_example"; // String | 
    OffsetDateTime startTime = OffsetDateTime.now(); // OffsetDateTime | 
    OffsetDateTime endTime = OffsetDateTime.now(); // OffsetDateTime | 
    Integer status = 56; // Integer | 
    String color = "color_example"; // String | 
    try {
      Object result = apiInstance.updateScheduleApiV1ScheduleSidPut_0(sid, title, description, startTime, endTime, status, color);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ScheduleApi#updateScheduleApiV1ScheduleSidPut_0");
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
| **sid** | **Integer**|  | |
| **title** | **String**|  | [optional] |
| **description** | **String**|  | [optional] |
| **startTime** | **OffsetDateTime**|  | [optional] |
| **endTime** | **OffsetDateTime**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **color** | **String**|  | [optional] |

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

