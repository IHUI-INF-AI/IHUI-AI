# BehaviorApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addSensitiveApiV1BehaviorSensitivePost**](BehaviorApi.md#addSensitiveApiV1BehaviorSensitivePost) | **POST** /api/v1/behavior/sensitive | 添加敏感词 |
| [**addSensitiveApiV1BehaviorSensitivePost_0**](BehaviorApi.md#addSensitiveApiV1BehaviorSensitivePost_0) | **POST** /api/v1/behavior/sensitive | 添加敏感词 |
| [**behaviorAddComment**](BehaviorApi.md#behaviorAddComment) | **POST** /api/v1/behavior/comment | 发表评论 |
| [**behaviorAddComment_0**](BehaviorApi.md#behaviorAddComment_0) | **POST** /api/v1/behavior/comment | 发表评论 |
| [**behaviorToggleFavorite**](BehaviorApi.md#behaviorToggleFavorite) | **POST** /api/v1/behavior/favorite | 收藏/取消收藏 |
| [**behaviorToggleFavorite_0**](BehaviorApi.md#behaviorToggleFavorite_0) | **POST** /api/v1/behavior/favorite | 收藏/取消收藏 |
| [**behaviorToggleLike**](BehaviorApi.md#behaviorToggleLike) | **POST** /api/v1/behavior/like | 点赞/取消点赞 |
| [**behaviorToggleLike_0**](BehaviorApi.md#behaviorToggleLike_0) | **POST** /api/v1/behavior/like | 点赞/取消点赞 |
| [**checkSensitiveApiV1BehaviorSensitiveCheckPost**](BehaviorApi.md#checkSensitiveApiV1BehaviorSensitiveCheckPost) | **POST** /api/v1/behavior/sensitive/check | 敏感词检测 |
| [**checkSensitiveApiV1BehaviorSensitiveCheckPost_0**](BehaviorApi.md#checkSensitiveApiV1BehaviorSensitiveCheckPost_0) | **POST** /api/v1/behavior/sensitive/check | 敏感词检测 |
| [**commentListApiV1BehaviorCommentListGet**](BehaviorApi.md#commentListApiV1BehaviorCommentListGet) | **GET** /api/v1/behavior/comment/list | 评论列表 |
| [**commentListApiV1BehaviorCommentListGet_0**](BehaviorApi.md#commentListApiV1BehaviorCommentListGet_0) | **GET** /api/v1/behavior/comment/list | 评论列表 |
| [**deleteCommentApiV1BehaviorCommentCidDelete**](BehaviorApi.md#deleteCommentApiV1BehaviorCommentCidDelete) | **DELETE** /api/v1/behavior/comment/{cid} | 删除评论 |
| [**deleteCommentApiV1BehaviorCommentCidDelete_0**](BehaviorApi.md#deleteCommentApiV1BehaviorCommentCidDelete_0) | **DELETE** /api/v1/behavior/comment/{cid} | 删除评论 |
| [**deleteSensitiveApiV1BehaviorSensitiveSidDelete**](BehaviorApi.md#deleteSensitiveApiV1BehaviorSensitiveSidDelete) | **DELETE** /api/v1/behavior/sensitive/{sid} | 删除敏感词 |
| [**deleteSensitiveApiV1BehaviorSensitiveSidDelete_0**](BehaviorApi.md#deleteSensitiveApiV1BehaviorSensitiveSidDelete_0) | **DELETE** /api/v1/behavior/sensitive/{sid} | 删除敏感词 |
| [**favoriteListApiV1BehaviorFavoriteListGet**](BehaviorApi.md#favoriteListApiV1BehaviorFavoriteListGet) | **GET** /api/v1/behavior/favorite/list | 收藏列表 |
| [**favoriteListApiV1BehaviorFavoriteListGet_0**](BehaviorApi.md#favoriteListApiV1BehaviorFavoriteListGet_0) | **GET** /api/v1/behavior/favorite/list | 收藏列表 |
| [**followListApiV1BehaviorFollowListGet**](BehaviorApi.md#followListApiV1BehaviorFollowListGet) | **GET** /api/v1/behavior/follow/list | 关注列表 |
| [**followListApiV1BehaviorFollowListGet_0**](BehaviorApi.md#followListApiV1BehaviorFollowListGet_0) | **GET** /api/v1/behavior/follow/list | 关注列表 |
| [**handleReportApiV1BehaviorReportRidHandlePut**](BehaviorApi.md#handleReportApiV1BehaviorReportRidHandlePut) | **PUT** /api/v1/behavior/report/{rid}/handle | 处理举报 |
| [**handleReportApiV1BehaviorReportRidHandlePut_0**](BehaviorApi.md#handleReportApiV1BehaviorReportRidHandlePut_0) | **PUT** /api/v1/behavior/report/{rid}/handle | 处理举报 |
| [**likeListApiV1BehaviorLikeListGet**](BehaviorApi.md#likeListApiV1BehaviorLikeListGet) | **GET** /api/v1/behavior/like/list | 点赞列表 |
| [**likeListApiV1BehaviorLikeListGet_0**](BehaviorApi.md#likeListApiV1BehaviorLikeListGet_0) | **GET** /api/v1/behavior/like/list | 点赞列表 |
| [**reportApiV1BehaviorReportPost**](BehaviorApi.md#reportApiV1BehaviorReportPost) | **POST** /api/v1/behavior/report | 举报 |
| [**reportApiV1BehaviorReportPost_0**](BehaviorApi.md#reportApiV1BehaviorReportPost_0) | **POST** /api/v1/behavior/report | 举报 |
| [**reportListApiV1BehaviorReportListGet**](BehaviorApi.md#reportListApiV1BehaviorReportListGet) | **GET** /api/v1/behavior/report/list | 举报列表 |
| [**reportListApiV1BehaviorReportListGet_0**](BehaviorApi.md#reportListApiV1BehaviorReportListGet_0) | **GET** /api/v1/behavior/report/list | 举报列表 |
| [**sensitiveListApiV1BehaviorSensitiveListGet**](BehaviorApi.md#sensitiveListApiV1BehaviorSensitiveListGet) | **GET** /api/v1/behavior/sensitive/list | 敏感词列表 |
| [**sensitiveListApiV1BehaviorSensitiveListGet_0**](BehaviorApi.md#sensitiveListApiV1BehaviorSensitiveListGet_0) | **GET** /api/v1/behavior/sensitive/list | 敏感词列表 |
| [**shareApiV1BehaviorSharePost**](BehaviorApi.md#shareApiV1BehaviorSharePost) | **POST** /api/v1/behavior/share | 分享 |
| [**shareApiV1BehaviorSharePost_0**](BehaviorApi.md#shareApiV1BehaviorSharePost_0) | **POST** /api/v1/behavior/share | 分享 |
| [**toggleFollowApiV1BehaviorFollowPost**](BehaviorApi.md#toggleFollowApiV1BehaviorFollowPost) | **POST** /api/v1/behavior/follow | 关注/取消关注 |
| [**toggleFollowApiV1BehaviorFollowPost_0**](BehaviorApi.md#toggleFollowApiV1BehaviorFollowPost_0) | **POST** /api/v1/behavior/follow | 关注/取消关注 |


<a id="addSensitiveApiV1BehaviorSensitivePost"></a>
# **addSensitiveApiV1BehaviorSensitivePost**
> Object addSensitiveApiV1BehaviorSensitivePost(word, category, level, action, replacement)

添加敏感词

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String word = "word_example"; // String | 
    String category = "category_example"; // String | 
    Integer level = 1; // Integer | 
    String action = "replace"; // String | 
    String replacement = "replacement_example"; // String | 
    try {
      Object result = apiInstance.addSensitiveApiV1BehaviorSensitivePost(word, category, level, action, replacement);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#addSensitiveApiV1BehaviorSensitivePost");
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
| **word** | **String**|  | |
| **category** | **String**|  | [optional] |
| **level** | **Integer**|  | [optional] [default to 1] |
| **action** | **String**|  | [optional] [default to replace] |
| **replacement** | **String**|  | [optional] |

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

<a id="addSensitiveApiV1BehaviorSensitivePost_0"></a>
# **addSensitiveApiV1BehaviorSensitivePost_0**
> Object addSensitiveApiV1BehaviorSensitivePost_0(word, category, level, action, replacement)

添加敏感词

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String word = "word_example"; // String | 
    String category = "category_example"; // String | 
    Integer level = 1; // Integer | 
    String action = "replace"; // String | 
    String replacement = "replacement_example"; // String | 
    try {
      Object result = apiInstance.addSensitiveApiV1BehaviorSensitivePost_0(word, category, level, action, replacement);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#addSensitiveApiV1BehaviorSensitivePost_0");
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
| **word** | **String**|  | |
| **category** | **String**|  | [optional] |
| **level** | **Integer**|  | [optional] [default to 1] |
| **action** | **String**|  | [optional] [default to replace] |
| **replacement** | **String**|  | [optional] |

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

<a id="behaviorAddComment"></a>
# **behaviorAddComment**
> Object behaviorAddComment(targetType, targetId, content, pid, replyUserId, replyUserName)

发表评论

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    String content = "content_example"; // String | 
    Integer pid = 0; // Integer | 
    String replyUserId = "replyUserId_example"; // String | 
    String replyUserName = "replyUserName_example"; // String | 
    try {
      Object result = apiInstance.behaviorAddComment(targetType, targetId, content, pid, replyUserId, replyUserName);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#behaviorAddComment");
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

<a id="behaviorAddComment_0"></a>
# **behaviorAddComment_0**
> Object behaviorAddComment_0(targetType, targetId, content, pid, replyUserId, replyUserName)

发表评论

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    String content = "content_example"; // String | 
    Integer pid = 0; // Integer | 
    String replyUserId = "replyUserId_example"; // String | 
    String replyUserName = "replyUserName_example"; // String | 
    try {
      Object result = apiInstance.behaviorAddComment_0(targetType, targetId, content, pid, replyUserId, replyUserName);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#behaviorAddComment_0");
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

<a id="behaviorToggleFavorite"></a>
# **behaviorToggleFavorite**
> Object behaviorToggleFavorite(targetType, targetId, folder)

收藏/取消收藏

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    String folder = "default"; // String | 
    try {
      Object result = apiInstance.behaviorToggleFavorite(targetType, targetId, folder);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#behaviorToggleFavorite");
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
| **folder** | **String**|  | [optional] [default to default] |

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

<a id="behaviorToggleFavorite_0"></a>
# **behaviorToggleFavorite_0**
> Object behaviorToggleFavorite_0(targetType, targetId, folder)

收藏/取消收藏

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    String folder = "default"; // String | 
    try {
      Object result = apiInstance.behaviorToggleFavorite_0(targetType, targetId, folder);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#behaviorToggleFavorite_0");
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
| **folder** | **String**|  | [optional] [default to default] |

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

<a id="behaviorToggleLike"></a>
# **behaviorToggleLike**
> Object behaviorToggleLike(targetType, targetId)

点赞/取消点赞

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    try {
      Object result = apiInstance.behaviorToggleLike(targetType, targetId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#behaviorToggleLike");
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

<a id="behaviorToggleLike_0"></a>
# **behaviorToggleLike_0**
> Object behaviorToggleLike_0(targetType, targetId)

点赞/取消点赞

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    try {
      Object result = apiInstance.behaviorToggleLike_0(targetType, targetId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#behaviorToggleLike_0");
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

<a id="checkSensitiveApiV1BehaviorSensitiveCheckPost"></a>
# **checkSensitiveApiV1BehaviorSensitiveCheckPost**
> Object checkSensitiveApiV1BehaviorSensitiveCheckPost(content)

敏感词检测

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String content = "content_example"; // String | 
    try {
      Object result = apiInstance.checkSensitiveApiV1BehaviorSensitiveCheckPost(content);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#checkSensitiveApiV1BehaviorSensitiveCheckPost");
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
| **content** | **String**|  | |

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

<a id="checkSensitiveApiV1BehaviorSensitiveCheckPost_0"></a>
# **checkSensitiveApiV1BehaviorSensitiveCheckPost_0**
> Object checkSensitiveApiV1BehaviorSensitiveCheckPost_0(content)

敏感词检测

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String content = "content_example"; // String | 
    try {
      Object result = apiInstance.checkSensitiveApiV1BehaviorSensitiveCheckPost_0(content);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#checkSensitiveApiV1BehaviorSensitiveCheckPost_0");
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
| **content** | **String**|  | |

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

<a id="commentListApiV1BehaviorCommentListGet"></a>
# **commentListApiV1BehaviorCommentListGet**
> Object commentListApiV1BehaviorCommentListGet(targetType, targetId, page, limit)

评论列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.commentListApiV1BehaviorCommentListGet(targetType, targetId, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#commentListApiV1BehaviorCommentListGet");
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

<a id="commentListApiV1BehaviorCommentListGet_0"></a>
# **commentListApiV1BehaviorCommentListGet_0**
> Object commentListApiV1BehaviorCommentListGet_0(targetType, targetId, page, limit)

评论列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.commentListApiV1BehaviorCommentListGet_0(targetType, targetId, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#commentListApiV1BehaviorCommentListGet_0");
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

<a id="deleteCommentApiV1BehaviorCommentCidDelete"></a>
# **deleteCommentApiV1BehaviorCommentCidDelete**
> Object deleteCommentApiV1BehaviorCommentCidDelete(cid)

删除评论

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteCommentApiV1BehaviorCommentCidDelete(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#deleteCommentApiV1BehaviorCommentCidDelete");
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

<a id="deleteCommentApiV1BehaviorCommentCidDelete_0"></a>
# **deleteCommentApiV1BehaviorCommentCidDelete_0**
> Object deleteCommentApiV1BehaviorCommentCidDelete_0(cid)

删除评论

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteCommentApiV1BehaviorCommentCidDelete_0(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#deleteCommentApiV1BehaviorCommentCidDelete_0");
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

<a id="deleteSensitiveApiV1BehaviorSensitiveSidDelete"></a>
# **deleteSensitiveApiV1BehaviorSensitiveSidDelete**
> Object deleteSensitiveApiV1BehaviorSensitiveSidDelete(sid)

删除敏感词

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    Integer sid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteSensitiveApiV1BehaviorSensitiveSidDelete(sid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#deleteSensitiveApiV1BehaviorSensitiveSidDelete");
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

<a id="deleteSensitiveApiV1BehaviorSensitiveSidDelete_0"></a>
# **deleteSensitiveApiV1BehaviorSensitiveSidDelete_0**
> Object deleteSensitiveApiV1BehaviorSensitiveSidDelete_0(sid)

删除敏感词

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    Integer sid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteSensitiveApiV1BehaviorSensitiveSidDelete_0(sid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#deleteSensitiveApiV1BehaviorSensitiveSidDelete_0");
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

<a id="favoriteListApiV1BehaviorFavoriteListGet"></a>
# **favoriteListApiV1BehaviorFavoriteListGet**
> Object favoriteListApiV1BehaviorFavoriteListGet(targetType, folder, page, limit)

收藏列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    String folder = "folder_example"; // String | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.favoriteListApiV1BehaviorFavoriteListGet(targetType, folder, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#favoriteListApiV1BehaviorFavoriteListGet");
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
| **targetType** | **String**|  | [optional] |
| **folder** | **String**|  | [optional] |
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

<a id="favoriteListApiV1BehaviorFavoriteListGet_0"></a>
# **favoriteListApiV1BehaviorFavoriteListGet_0**
> Object favoriteListApiV1BehaviorFavoriteListGet_0(targetType, folder, page, limit)

收藏列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    String folder = "folder_example"; // String | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.favoriteListApiV1BehaviorFavoriteListGet_0(targetType, folder, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#favoriteListApiV1BehaviorFavoriteListGet_0");
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
| **targetType** | **String**|  | [optional] |
| **folder** | **String**|  | [optional] |
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

<a id="followListApiV1BehaviorFollowListGet"></a>
# **followListApiV1BehaviorFollowListGet**
> Object followListApiV1BehaviorFollowListGet(page, limit, isFollower)

关注列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Boolean isFollower = false; // Boolean | 
    try {
      Object result = apiInstance.followListApiV1BehaviorFollowListGet(page, limit, isFollower);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#followListApiV1BehaviorFollowListGet");
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
| **isFollower** | **Boolean**|  | [optional] [default to false] |

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

<a id="followListApiV1BehaviorFollowListGet_0"></a>
# **followListApiV1BehaviorFollowListGet_0**
> Object followListApiV1BehaviorFollowListGet_0(page, limit, isFollower)

关注列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Boolean isFollower = false; // Boolean | 
    try {
      Object result = apiInstance.followListApiV1BehaviorFollowListGet_0(page, limit, isFollower);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#followListApiV1BehaviorFollowListGet_0");
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
| **isFollower** | **Boolean**|  | [optional] [default to false] |

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

<a id="handleReportApiV1BehaviorReportRidHandlePut"></a>
# **handleReportApiV1BehaviorReportRidHandlePut**
> Object handleReportApiV1BehaviorReportRidHandlePut(rid, status, remark)

处理举报

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    Integer rid = 56; // Integer | 
    Integer status = 56; // Integer | 
    String remark = "remark_example"; // String | 
    try {
      Object result = apiInstance.handleReportApiV1BehaviorReportRidHandlePut(rid, status, remark);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#handleReportApiV1BehaviorReportRidHandlePut");
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
| **rid** | **Integer**|  | |
| **status** | **Integer**|  | |
| **remark** | **String**|  | [optional] |

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

<a id="handleReportApiV1BehaviorReportRidHandlePut_0"></a>
# **handleReportApiV1BehaviorReportRidHandlePut_0**
> Object handleReportApiV1BehaviorReportRidHandlePut_0(rid, status, remark)

处理举报

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    Integer rid = 56; // Integer | 
    Integer status = 56; // Integer | 
    String remark = "remark_example"; // String | 
    try {
      Object result = apiInstance.handleReportApiV1BehaviorReportRidHandlePut_0(rid, status, remark);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#handleReportApiV1BehaviorReportRidHandlePut_0");
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
| **rid** | **Integer**|  | |
| **status** | **Integer**|  | |
| **remark** | **String**|  | [optional] |

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

<a id="likeListApiV1BehaviorLikeListGet"></a>
# **likeListApiV1BehaviorLikeListGet**
> Object likeListApiV1BehaviorLikeListGet(targetType, userId, page, limit)

点赞列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    String userId = "userId_example"; // String | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.likeListApiV1BehaviorLikeListGet(targetType, userId, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#likeListApiV1BehaviorLikeListGet");
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
| **targetType** | **String**|  | [optional] |
| **userId** | **String**|  | [optional] |
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

<a id="likeListApiV1BehaviorLikeListGet_0"></a>
# **likeListApiV1BehaviorLikeListGet_0**
> Object likeListApiV1BehaviorLikeListGet_0(targetType, userId, page, limit)

点赞列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    String userId = "userId_example"; // String | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.likeListApiV1BehaviorLikeListGet_0(targetType, userId, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#likeListApiV1BehaviorLikeListGet_0");
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
| **targetType** | **String**|  | [optional] |
| **userId** | **String**|  | [optional] |
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

<a id="reportApiV1BehaviorReportPost"></a>
# **reportApiV1BehaviorReportPost**
> Object reportApiV1BehaviorReportPost(targetType, targetId, reason, category)

举报

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    String reason = "reason_example"; // String | 
    String category = "category_example"; // String | 
    try {
      Object result = apiInstance.reportApiV1BehaviorReportPost(targetType, targetId, reason, category);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#reportApiV1BehaviorReportPost");
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
| **reason** | **String**|  | [optional] |
| **category** | **String**|  | [optional] |

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

<a id="reportApiV1BehaviorReportPost_0"></a>
# **reportApiV1BehaviorReportPost_0**
> Object reportApiV1BehaviorReportPost_0(targetType, targetId, reason, category)

举报

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    String reason = "reason_example"; // String | 
    String category = "category_example"; // String | 
    try {
      Object result = apiInstance.reportApiV1BehaviorReportPost_0(targetType, targetId, reason, category);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#reportApiV1BehaviorReportPost_0");
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
| **reason** | **String**|  | [optional] |
| **category** | **String**|  | [optional] |

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

<a id="reportListApiV1BehaviorReportListGet"></a>
# **reportListApiV1BehaviorReportListGet**
> Object reportListApiV1BehaviorReportListGet(page, limit, status)

举报列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.reportListApiV1BehaviorReportListGet(page, limit, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#reportListApiV1BehaviorReportListGet");
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

<a id="reportListApiV1BehaviorReportListGet_0"></a>
# **reportListApiV1BehaviorReportListGet_0**
> Object reportListApiV1BehaviorReportListGet_0(page, limit, status)

举报列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.reportListApiV1BehaviorReportListGet_0(page, limit, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#reportListApiV1BehaviorReportListGet_0");
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

<a id="sensitiveListApiV1BehaviorSensitiveListGet"></a>
# **sensitiveListApiV1BehaviorSensitiveListGet**
> Object sensitiveListApiV1BehaviorSensitiveListGet(page, limit, category)

敏感词列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 50; // Integer | 
    String category = "category_example"; // String | 
    try {
      Object result = apiInstance.sensitiveListApiV1BehaviorSensitiveListGet(page, limit, category);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#sensitiveListApiV1BehaviorSensitiveListGet");
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
| **limit** | **Integer**|  | [optional] [default to 50] |
| **category** | **String**|  | [optional] |

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

<a id="sensitiveListApiV1BehaviorSensitiveListGet_0"></a>
# **sensitiveListApiV1BehaviorSensitiveListGet_0**
> Object sensitiveListApiV1BehaviorSensitiveListGet_0(page, limit, category)

敏感词列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 50; // Integer | 
    String category = "category_example"; // String | 
    try {
      Object result = apiInstance.sensitiveListApiV1BehaviorSensitiveListGet_0(page, limit, category);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#sensitiveListApiV1BehaviorSensitiveListGet_0");
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
| **limit** | **Integer**|  | [optional] [default to 50] |
| **category** | **String**|  | [optional] |

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

<a id="shareApiV1BehaviorSharePost"></a>
# **shareApiV1BehaviorSharePost**
> Object shareApiV1BehaviorSharePost(targetType, targetId, platform, ip)

分享

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    String platform = "platform_example"; // String | 
    String ip = "ip_example"; // String | 
    try {
      Object result = apiInstance.shareApiV1BehaviorSharePost(targetType, targetId, platform, ip);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#shareApiV1BehaviorSharePost");
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
| **platform** | **String**|  | [optional] |
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

<a id="shareApiV1BehaviorSharePost_0"></a>
# **shareApiV1BehaviorSharePost_0**
> Object shareApiV1BehaviorSharePost_0(targetType, targetId, platform, ip)

分享

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    String platform = "platform_example"; // String | 
    String ip = "ip_example"; // String | 
    try {
      Object result = apiInstance.shareApiV1BehaviorSharePost_0(targetType, targetId, platform, ip);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#shareApiV1BehaviorSharePost_0");
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
| **platform** | **String**|  | [optional] |
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

<a id="toggleFollowApiV1BehaviorFollowPost"></a>
# **toggleFollowApiV1BehaviorFollowPost**
> Object toggleFollowApiV1BehaviorFollowPost(targetUserId)

关注/取消关注

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String targetUserId = "targetUserId_example"; // String | 
    try {
      Object result = apiInstance.toggleFollowApiV1BehaviorFollowPost(targetUserId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#toggleFollowApiV1BehaviorFollowPost");
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
| **targetUserId** | **String**|  | |

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

<a id="toggleFollowApiV1BehaviorFollowPost_0"></a>
# **toggleFollowApiV1BehaviorFollowPost_0**
> Object toggleFollowApiV1BehaviorFollowPost_0(targetUserId)

关注/取消关注

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BehaviorApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    BehaviorApi apiInstance = new BehaviorApi(defaultClient);
    String targetUserId = "targetUserId_example"; // String | 
    try {
      Object result = apiInstance.toggleFollowApiV1BehaviorFollowPost_0(targetUserId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BehaviorApi#toggleFollowApiV1BehaviorFollowPost_0");
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
| **targetUserId** | **String**|  | |

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

