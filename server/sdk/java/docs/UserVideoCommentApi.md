# UserVideoCommentApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addCommentApiV1UserVideoCommentPost**](UserVideoCommentApi.md#addCommentApiV1UserVideoCommentPost) | **POST** /api/v1/user-video-comment | 发表视频评论 |
| [**addCommentApiV1UserVideoCommentPost_0**](UserVideoCommentApi.md#addCommentApiV1UserVideoCommentPost_0) | **POST** /api/v1/user-video-comment | 发表视频评论 |
| [**deleteCommentApiV1UserVideoCommentCidDelete**](UserVideoCommentApi.md#deleteCommentApiV1UserVideoCommentCidDelete) | **DELETE** /api/v1/user-video-comment/{cid} | 删除视频评论 |
| [**deleteCommentApiV1UserVideoCommentCidDelete_0**](UserVideoCommentApi.md#deleteCommentApiV1UserVideoCommentCidDelete_0) | **DELETE** /api/v1/user-video-comment/{cid} | 删除视频评论 |
| [**listCommentsApiV1UserVideoCommentListGet**](UserVideoCommentApi.md#listCommentsApiV1UserVideoCommentListGet) | **GET** /api/v1/user-video-comment/list | 视频评论列表 |
| [**listCommentsApiV1UserVideoCommentListGet_0**](UserVideoCommentApi.md#listCommentsApiV1UserVideoCommentListGet_0) | **GET** /api/v1/user-video-comment/list | 视频评论列表 |


<a id="addCommentApiV1UserVideoCommentPost"></a>
# **addCommentApiV1UserVideoCommentPost**
> Object addCommentApiV1UserVideoCommentPost(videoId, content, pid, replyUserId, replyUserName)

发表视频评论

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserVideoCommentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserVideoCommentApi apiInstance = new UserVideoCommentApi(defaultClient);
    Integer videoId = 56; // Integer | 
    String content = "content_example"; // String | 
    Integer pid = 0; // Integer | 
    String replyUserId = "replyUserId_example"; // String | 
    String replyUserName = "replyUserName_example"; // String | 
    try {
      Object result = apiInstance.addCommentApiV1UserVideoCommentPost(videoId, content, pid, replyUserId, replyUserName);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserVideoCommentApi#addCommentApiV1UserVideoCommentPost");
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
| **videoId** | **Integer**|  | |
| **content** | **String**|  | |
| **pid** | **Integer**|  | [optional] [default to 0] |
| **replyUserId** | **String**|  | [optional] |
| **replyUserName** | **String**|  | [optional] |

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

<a id="addCommentApiV1UserVideoCommentPost_0"></a>
# **addCommentApiV1UserVideoCommentPost_0**
> Object addCommentApiV1UserVideoCommentPost_0(videoId, content, pid, replyUserId, replyUserName)

发表视频评论

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserVideoCommentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserVideoCommentApi apiInstance = new UserVideoCommentApi(defaultClient);
    Integer videoId = 56; // Integer | 
    String content = "content_example"; // String | 
    Integer pid = 0; // Integer | 
    String replyUserId = "replyUserId_example"; // String | 
    String replyUserName = "replyUserName_example"; // String | 
    try {
      Object result = apiInstance.addCommentApiV1UserVideoCommentPost_0(videoId, content, pid, replyUserId, replyUserName);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserVideoCommentApi#addCommentApiV1UserVideoCommentPost_0");
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
| **videoId** | **Integer**|  | |
| **content** | **String**|  | |
| **pid** | **Integer**|  | [optional] [default to 0] |
| **replyUserId** | **String**|  | [optional] |
| **replyUserName** | **String**|  | [optional] |

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

<a id="deleteCommentApiV1UserVideoCommentCidDelete"></a>
# **deleteCommentApiV1UserVideoCommentCidDelete**
> Object deleteCommentApiV1UserVideoCommentCidDelete(cid)

删除视频评论

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserVideoCommentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserVideoCommentApi apiInstance = new UserVideoCommentApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteCommentApiV1UserVideoCommentCidDelete(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserVideoCommentApi#deleteCommentApiV1UserVideoCommentCidDelete");
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
| **cid** | **Integer**|  | |

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

<a id="deleteCommentApiV1UserVideoCommentCidDelete_0"></a>
# **deleteCommentApiV1UserVideoCommentCidDelete_0**
> Object deleteCommentApiV1UserVideoCommentCidDelete_0(cid)

删除视频评论

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserVideoCommentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserVideoCommentApi apiInstance = new UserVideoCommentApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteCommentApiV1UserVideoCommentCidDelete_0(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserVideoCommentApi#deleteCommentApiV1UserVideoCommentCidDelete_0");
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
| **cid** | **Integer**|  | |

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

<a id="listCommentsApiV1UserVideoCommentListGet"></a>
# **listCommentsApiV1UserVideoCommentListGet**
> Object listCommentsApiV1UserVideoCommentListGet(videoId, page, limit)

视频评论列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserVideoCommentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserVideoCommentApi apiInstance = new UserVideoCommentApi(defaultClient);
    Integer videoId = 56; // Integer | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listCommentsApiV1UserVideoCommentListGet(videoId, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserVideoCommentApi#listCommentsApiV1UserVideoCommentListGet");
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
| **videoId** | **Integer**|  | |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |

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

<a id="listCommentsApiV1UserVideoCommentListGet_0"></a>
# **listCommentsApiV1UserVideoCommentListGet_0**
> Object listCommentsApiV1UserVideoCommentListGet_0(videoId, page, limit)

视频评论列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserVideoCommentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserVideoCommentApi apiInstance = new UserVideoCommentApi(defaultClient);
    Integer videoId = 56; // Integer | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listCommentsApiV1UserVideoCommentListGet_0(videoId, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserVideoCommentApi#listCommentsApiV1UserVideoCommentListGet_0");
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
| **videoId** | **Integer**|  | |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |

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

