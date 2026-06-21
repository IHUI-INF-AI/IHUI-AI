# ContentActivityApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getActivityApiV1ContentActivityActivityIdGet**](ContentActivityApi.md#getActivityApiV1ContentActivityActivityIdGet) | **GET** /api/v1/content/activity/{activity_id} | 活动详情 |
| [**listActivitiesApiV1ContentActivityListGet**](ContentActivityApi.md#listActivitiesApiV1ContentActivityListGet) | **GET** /api/v1/content/activity/list | 活动列表 |


<a id="getActivityApiV1ContentActivityActivityIdGet"></a>
# **getActivityApiV1ContentActivityActivityIdGet**
> Object getActivityApiV1ContentActivityActivityIdGet(activityId)

活动详情

根据活动 ID 返回详情。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentActivityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentActivityApi apiInstance = new ContentActivityApi(defaultClient);
    String activityId = "activityId_example"; // String | 
    try {
      Object result = apiInstance.getActivityApiV1ContentActivityActivityIdGet(activityId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentActivityApi#getActivityApiV1ContentActivityActivityIdGet");
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
| **activityId** | **String**|  | |

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

<a id="listActivitiesApiV1ContentActivityListGet"></a>
# **listActivitiesApiV1ContentActivityListGet**
> Object listActivitiesApiV1ContentActivityListGet(page, limit, status)

活动列表

分页返回活动列表，可按 status 筛选。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentActivityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentActivityApi apiInstance = new ContentActivityApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer status = 56; // Integer | 筛选状态: 0=关闭 1=开启
    try {
      Object result = apiInstance.listActivitiesApiV1ContentActivityListGet(page, limit, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentActivityApi#listActivitiesApiV1ContentActivityListGet");
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
| **status** | **Integer**| 筛选状态: 0&#x3D;关闭 1&#x3D;开启 | [optional] |

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

