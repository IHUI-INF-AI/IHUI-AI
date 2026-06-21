# UserCommentLogApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**recordLogApiV1UserCommentLogRecordPost**](UserCommentLogApi.md#recordLogApiV1UserCommentLogRecordPost) | **POST** /api/v1/user-comment-log/record | 记录评论日志 |
| [**recordLogApiV1UserCommentLogRecordPost_0**](UserCommentLogApi.md#recordLogApiV1UserCommentLogRecordPost_0) | **POST** /api/v1/user-comment-log/record | 记录评论日志 |
| [**userCommentLogList**](UserCommentLogApi.md#userCommentLogList) | **GET** /api/v1/user-comment-log/list | 评论日志 |
| [**userCommentLogList_0**](UserCommentLogApi.md#userCommentLogList_0) | **GET** /api/v1/user-comment-log/list | 评论日志 |


<a id="recordLogApiV1UserCommentLogRecordPost"></a>
# **recordLogApiV1UserCommentLogRecordPost**
> Object recordLogApiV1UserCommentLogRecordPost(targetType, targetId, commentId, content, action, ip)

记录评论日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserCommentLogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserCommentLogApi apiInstance = new UserCommentLogApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    Integer commentId = 56; // Integer | 
    String content = "content_example"; // String | 
    String action = "add"; // String | 
    String ip = "ip_example"; // String | 
    try {
      Object result = apiInstance.recordLogApiV1UserCommentLogRecordPost(targetType, targetId, commentId, content, action, ip);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserCommentLogApi#recordLogApiV1UserCommentLogRecordPost");
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
| **targetType** | **String**|  | |
| **targetId** | **Integer**|  | |
| **commentId** | **Integer**|  | |
| **content** | **String**|  | |
| **action** | **String**|  | [optional] [default to add] |
| **ip** | **String**|  | [optional] |

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

<a id="recordLogApiV1UserCommentLogRecordPost_0"></a>
# **recordLogApiV1UserCommentLogRecordPost_0**
> Object recordLogApiV1UserCommentLogRecordPost_0(targetType, targetId, commentId, content, action, ip)

记录评论日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserCommentLogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserCommentLogApi apiInstance = new UserCommentLogApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    Integer commentId = 56; // Integer | 
    String content = "content_example"; // String | 
    String action = "add"; // String | 
    String ip = "ip_example"; // String | 
    try {
      Object result = apiInstance.recordLogApiV1UserCommentLogRecordPost_0(targetType, targetId, commentId, content, action, ip);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserCommentLogApi#recordLogApiV1UserCommentLogRecordPost_0");
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
| **targetType** | **String**|  | |
| **targetId** | **Integer**|  | |
| **commentId** | **Integer**|  | |
| **content** | **String**|  | |
| **action** | **String**|  | [optional] [default to add] |
| **ip** | **String**|  | [optional] |

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

<a id="userCommentLogList"></a>
# **userCommentLogList**
> Object userCommentLogList(page, limit, userId, targetType, action)

评论日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserCommentLogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserCommentLogApi apiInstance = new UserCommentLogApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String userId = "userId_example"; // String | 
    String targetType = "targetType_example"; // String | 
    String action = "action_example"; // String | 
    try {
      Object result = apiInstance.userCommentLogList(page, limit, userId, targetType, action);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserCommentLogApi#userCommentLogList");
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
| **targetType** | **String**|  | [optional] |
| **action** | **String**|  | [optional] |

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

<a id="userCommentLogList_0"></a>
# **userCommentLogList_0**
> Object userCommentLogList_0(page, limit, userId, targetType, action)

评论日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserCommentLogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserCommentLogApi apiInstance = new UserCommentLogApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String userId = "userId_example"; // String | 
    String targetType = "targetType_example"; // String | 
    String action = "action_example"; // String | 
    try {
      Object result = apiInstance.userCommentLogList_0(page, limit, userId, targetType, action);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserCommentLogApi#userCommentLogList_0");
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
| **targetType** | **String**|  | [optional] |
| **action** | **String**|  | [optional] |

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

