# CirclePostApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addCommentApiV1CirclePostPidCommentPost**](CirclePostApi.md#addCommentApiV1CirclePostPidCommentPost) | **POST** /api/v1/circle/post/{pid}/comment | 发表评论 |
| [**createPostApiV1CirclePostPost**](CirclePostApi.md#createPostApiV1CirclePostPost) | **POST** /api/v1/circle/post | 发布帖子 |
| [**deletePostApiV1CirclePostPidDelete**](CirclePostApi.md#deletePostApiV1CirclePostPidDelete) | **DELETE** /api/v1/circle/post/{pid} | 删除帖子 |
| [**getPostApiV1CirclePostPidGet**](CirclePostApi.md#getPostApiV1CirclePostPidGet) | **GET** /api/v1/circle/post/{pid} | 帖子详情 |
| [**listCommentsApiV1CirclePostPidCommentsGet**](CirclePostApi.md#listCommentsApiV1CirclePostPidCommentsGet) | **GET** /api/v1/circle/post/{pid}/comments | 评论列表 |
| [**listPostsApiV1CirclePostListGet**](CirclePostApi.md#listPostsApiV1CirclePostListGet) | **GET** /api/v1/circle/post/list | 帖子列表 |
| [**toggleLikeApiV1CirclePostPidLikePost**](CirclePostApi.md#toggleLikeApiV1CirclePostPidLikePost) | **POST** /api/v1/circle/post/{pid}/like | 点赞/取消点赞 |
| [**updatePostApiV1CirclePostPidPut**](CirclePostApi.md#updatePostApiV1CirclePostPidPut) | **PUT** /api/v1/circle/post/{pid} | 修改帖子 |


<a id="addCommentApiV1CirclePostPidCommentPost"></a>
# **addCommentApiV1CirclePostPidCommentPost**
> Object addCommentApiV1CirclePostPidCommentPost(pid, content, pid2, replyUserId, replyUserName)

发表评论

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CirclePostApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CirclePostApi apiInstance = new CirclePostApi(defaultClient);
    Integer pid = 56; // Integer | 
    String content = "content_example"; // String | 
    Integer pid2 = 0; // Integer | 
    String replyUserId = "replyUserId_example"; // String | 
    String replyUserName = "replyUserName_example"; // String | 
    try {
      Object result = apiInstance.addCommentApiV1CirclePostPidCommentPost(pid, content, pid2, replyUserId, replyUserName);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CirclePostApi#addCommentApiV1CirclePostPidCommentPost");
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
| **pid** | **Integer**|  | |
| **content** | **String**|  | |
| **pid2** | **Integer**|  | [optional] [default to 0] |
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

<a id="createPostApiV1CirclePostPost"></a>
# **createPostApiV1CirclePostPost**
> Object createPostApiV1CirclePostPost(circleId, content, images, video)

发布帖子

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CirclePostApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CirclePostApi apiInstance = new CirclePostApi(defaultClient);
    Integer circleId = 56; // Integer | 
    String content = "content_example"; // String | 
    String images = "images_example"; // String | 
    String video = "video_example"; // String | 
    try {
      Object result = apiInstance.createPostApiV1CirclePostPost(circleId, content, images, video);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CirclePostApi#createPostApiV1CirclePostPost");
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
| **circleId** | **Integer**|  | |
| **content** | **String**|  | |
| **images** | **String**|  | [optional] |
| **video** | **String**|  | [optional] |

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

<a id="deletePostApiV1CirclePostPidDelete"></a>
# **deletePostApiV1CirclePostPidDelete**
> Object deletePostApiV1CirclePostPidDelete(pid)

删除帖子

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CirclePostApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CirclePostApi apiInstance = new CirclePostApi(defaultClient);
    Integer pid = 56; // Integer | 
    try {
      Object result = apiInstance.deletePostApiV1CirclePostPidDelete(pid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CirclePostApi#deletePostApiV1CirclePostPidDelete");
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
| **pid** | **Integer**|  | |

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

<a id="getPostApiV1CirclePostPidGet"></a>
# **getPostApiV1CirclePostPidGet**
> Object getPostApiV1CirclePostPidGet(pid)

帖子详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CirclePostApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CirclePostApi apiInstance = new CirclePostApi(defaultClient);
    Integer pid = 56; // Integer | 
    try {
      Object result = apiInstance.getPostApiV1CirclePostPidGet(pid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CirclePostApi#getPostApiV1CirclePostPidGet");
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
| **pid** | **Integer**|  | |

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

<a id="listCommentsApiV1CirclePostPidCommentsGet"></a>
# **listCommentsApiV1CirclePostPidCommentsGet**
> Object listCommentsApiV1CirclePostPidCommentsGet(pid, page, limit)

评论列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CirclePostApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CirclePostApi apiInstance = new CirclePostApi(defaultClient);
    Integer pid = 56; // Integer | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listCommentsApiV1CirclePostPidCommentsGet(pid, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CirclePostApi#listCommentsApiV1CirclePostPidCommentsGet");
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
| **pid** | **Integer**|  | |
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

<a id="listPostsApiV1CirclePostListGet"></a>
# **listPostsApiV1CirclePostListGet**
> Object listPostsApiV1CirclePostListGet(page, limit, circleId, userId, keyword, orderBy)

帖子列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CirclePostApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CirclePostApi apiInstance = new CirclePostApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer circleId = 56; // Integer | 
    String userId = "userId_example"; // String | 
    String keyword = "keyword_example"; // String | 
    String orderBy = "orderBy_example"; // String | 
    try {
      Object result = apiInstance.listPostsApiV1CirclePostListGet(page, limit, circleId, userId, keyword, orderBy);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CirclePostApi#listPostsApiV1CirclePostListGet");
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
| **circleId** | **Integer**|  | [optional] |
| **userId** | **String**|  | [optional] |
| **keyword** | **String**|  | [optional] |
| **orderBy** | **String**|  | [optional] |

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

<a id="toggleLikeApiV1CirclePostPidLikePost"></a>
# **toggleLikeApiV1CirclePostPidLikePost**
> Object toggleLikeApiV1CirclePostPidLikePost(pid)

点赞/取消点赞

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CirclePostApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CirclePostApi apiInstance = new CirclePostApi(defaultClient);
    Integer pid = 56; // Integer | 
    try {
      Object result = apiInstance.toggleLikeApiV1CirclePostPidLikePost(pid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CirclePostApi#toggleLikeApiV1CirclePostPidLikePost");
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
| **pid** | **Integer**|  | |

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

<a id="updatePostApiV1CirclePostPidPut"></a>
# **updatePostApiV1CirclePostPidPut**
> Object updatePostApiV1CirclePostPidPut(pid, content, images, video)

修改帖子

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CirclePostApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CirclePostApi apiInstance = new CirclePostApi(defaultClient);
    Integer pid = 56; // Integer | 
    String content = "content_example"; // String | 
    String images = "images_example"; // String | 
    String video = "video_example"; // String | 
    try {
      Object result = apiInstance.updatePostApiV1CirclePostPidPut(pid, content, images, video);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CirclePostApi#updatePostApiV1CirclePostPidPut");
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
| **pid** | **Integer**|  | |
| **content** | **String**|  | [optional] |
| **images** | **String**|  | [optional] |
| **video** | **String**|  | [optional] |

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

