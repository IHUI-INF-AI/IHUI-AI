# AiVideoTasksApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getVideoTaskApiV1AiTaskIdGet**](AiVideoTasksApi.md#getVideoTaskApiV1AiTaskIdGet) | **GET** /api/v1/ai/{task_id} | 任务详情 |
| [**listVideoTasksApiV1AiListGet**](AiVideoTasksApi.md#listVideoTasksApiV1AiListGet) | **GET** /api/v1/ai/list | 视频任务列表 |


<a id="getVideoTaskApiV1AiTaskIdGet"></a>
# **getVideoTaskApiV1AiTaskIdGet**
> Object getVideoTaskApiV1AiTaskIdGet(taskId)

任务详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiVideoTasksApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiVideoTasksApi apiInstance = new AiVideoTasksApi(defaultClient);
    String taskId = "taskId_example"; // String | 
    try {
      Object result = apiInstance.getVideoTaskApiV1AiTaskIdGet(taskId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiVideoTasksApi#getVideoTaskApiV1AiTaskIdGet");
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
| **taskId** | **String**|  | |

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

<a id="listVideoTasksApiV1AiListGet"></a>
# **listVideoTasksApiV1AiListGet**
> Object listVideoTasksApiV1AiListGet(page, limit, status)

视频任务列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiVideoTasksApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiVideoTasksApi apiInstance = new AiVideoTasksApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String status = "status_example"; // String | 任务状态过滤: accepted / processing / completed / failed
    try {
      Object result = apiInstance.listVideoTasksApiV1AiListGet(page, limit, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiVideoTasksApi#listVideoTasksApiV1AiListGet");
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
| **status** | **String**| 任务状态过滤: accepted / processing / completed / failed | [optional] |

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

