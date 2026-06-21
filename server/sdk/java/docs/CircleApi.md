# CircleApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addCommentApiV1CirclePostPidCommentPost**](CircleApi.md#addCommentApiV1CirclePostPidCommentPost) | **POST** /api/v1/circle/post/{pid}/comment | 发表评论 |
| [**circleCategoryList**](CircleApi.md#circleCategoryList) | **GET** /api/v1/circle/category/list | 圈子分类列表 |
| [**createCircleApiV1CirclePost**](CircleApi.md#createCircleApiV1CirclePost) | **POST** /api/v1/circle | 创建圈子 |
| [**createPostApiV1CirclePostPost**](CircleApi.md#createPostApiV1CirclePostPost) | **POST** /api/v1/circle/post | 发布帖子 |
| [**deleteCircleApiV1CircleCidDelete**](CircleApi.md#deleteCircleApiV1CircleCidDelete) | **DELETE** /api/v1/circle/{cid} | 删除圈子 |
| [**deletePostApiV1CirclePostPidDelete**](CircleApi.md#deletePostApiV1CirclePostPidDelete) | **DELETE** /api/v1/circle/post/{pid} | 删除帖子 |
| [**getCircleApiV1CircleCidGet**](CircleApi.md#getCircleApiV1CircleCidGet) | **GET** /api/v1/circle/{cid} | 圈子详情 |
| [**getPostApiV1CirclePostPidGet**](CircleApi.md#getPostApiV1CirclePostPidGet) | **GET** /api/v1/circle/post/{pid} | 帖子详情 |
| [**joinCircleApiV1CircleCidJoinPost**](CircleApi.md#joinCircleApiV1CircleCidJoinPost) | **POST** /api/v1/circle/{cid}/join | 加入圈子 |
| [**listCirclesApiV1CircleListGet**](CircleApi.md#listCirclesApiV1CircleListGet) | **GET** /api/v1/circle/list | 圈子列表 |
| [**listCommentsApiV1CirclePostPidCommentsGet**](CircleApi.md#listCommentsApiV1CirclePostPidCommentsGet) | **GET** /api/v1/circle/post/{pid}/comments | 评论列表 |
| [**listMembersApiV1CircleCidMembersGet**](CircleApi.md#listMembersApiV1CircleCidMembersGet) | **GET** /api/v1/circle/{cid}/members | 成员列表 |
| [**listPostsApiV1CirclePostListGet**](CircleApi.md#listPostsApiV1CirclePostListGet) | **GET** /api/v1/circle/post/list | 帖子列表 |
| [**quitCircleApiV1CircleCidQuitPost**](CircleApi.md#quitCircleApiV1CircleCidQuitPost) | **POST** /api/v1/circle/{cid}/quit | 退出圈子 |
| [**toggleLikeApiV1CirclePostPidLikePost**](CircleApi.md#toggleLikeApiV1CirclePostPidLikePost) | **POST** /api/v1/circle/post/{pid}/like | 点赞/取消点赞 |
| [**updateCircleApiV1CircleCidPut**](CircleApi.md#updateCircleApiV1CircleCidPut) | **PUT** /api/v1/circle/{cid} | 修改圈子 |
| [**updatePostApiV1CirclePostPidPut**](CircleApi.md#updatePostApiV1CirclePostPidPut) | **PUT** /api/v1/circle/post/{pid} | 修改帖子 |


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
import org.openapitools.client.api.CircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleApi apiInstance = new CircleApi(defaultClient);
    Integer pid = 56; // Integer | 
    String content = "content_example"; // String | 
    Integer pid2 = 0; // Integer | 
    String replyUserId = "replyUserId_example"; // String | 
    String replyUserName = "replyUserName_example"; // String | 
    try {
      Object result = apiInstance.addCommentApiV1CirclePostPidCommentPost(pid, content, pid2, replyUserId, replyUserName);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleApi#addCommentApiV1CirclePostPidCommentPost");
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

<a id="circleCategoryList"></a>
# **circleCategoryList**
> Object circleCategoryList()

圈子分类列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleApi apiInstance = new CircleApi(defaultClient);
    try {
      Object result = apiInstance.circleCategoryList();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleApi#circleCategoryList");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

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

<a id="createCircleApiV1CirclePost"></a>
# **createCircleApiV1CirclePost**
> Object createCircleApiV1CirclePost(name, description, categoryId, avatar, cover)

创建圈子

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleApi apiInstance = new CircleApi(defaultClient);
    String name = "name_example"; // String | 
    String description = "description_example"; // String | 
    Integer categoryId = 56; // Integer | 
    String avatar = "avatar_example"; // String | 
    String cover = "cover_example"; // String | 
    try {
      Object result = apiInstance.createCircleApiV1CirclePost(name, description, categoryId, avatar, cover);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleApi#createCircleApiV1CirclePost");
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
| **name** | **String**|  | |
| **description** | **String**|  | [optional] |
| **categoryId** | **Integer**|  | [optional] |
| **avatar** | **String**|  | [optional] |
| **cover** | **String**|  | [optional] |

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
import org.openapitools.client.api.CircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleApi apiInstance = new CircleApi(defaultClient);
    Integer circleId = 56; // Integer | 
    String content = "content_example"; // String | 
    String images = "images_example"; // String | 
    String video = "video_example"; // String | 
    try {
      Object result = apiInstance.createPostApiV1CirclePostPost(circleId, content, images, video);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleApi#createPostApiV1CirclePostPost");
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

<a id="deleteCircleApiV1CircleCidDelete"></a>
# **deleteCircleApiV1CircleCidDelete**
> Object deleteCircleApiV1CircleCidDelete(cid)

删除圈子

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleApi apiInstance = new CircleApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteCircleApiV1CircleCidDelete(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleApi#deleteCircleApiV1CircleCidDelete");
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
import org.openapitools.client.api.CircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleApi apiInstance = new CircleApi(defaultClient);
    Integer pid = 56; // Integer | 
    try {
      Object result = apiInstance.deletePostApiV1CirclePostPidDelete(pid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleApi#deletePostApiV1CirclePostPidDelete");
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

<a id="getCircleApiV1CircleCidGet"></a>
# **getCircleApiV1CircleCidGet**
> Object getCircleApiV1CircleCidGet(cid)

圈子详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleApi apiInstance = new CircleApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.getCircleApiV1CircleCidGet(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleApi#getCircleApiV1CircleCidGet");
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
import org.openapitools.client.api.CircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleApi apiInstance = new CircleApi(defaultClient);
    Integer pid = 56; // Integer | 
    try {
      Object result = apiInstance.getPostApiV1CirclePostPidGet(pid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleApi#getPostApiV1CirclePostPidGet");
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

<a id="joinCircleApiV1CircleCidJoinPost"></a>
# **joinCircleApiV1CircleCidJoinPost**
> Object joinCircleApiV1CircleCidJoinPost(cid)

加入圈子

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleApi apiInstance = new CircleApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.joinCircleApiV1CircleCidJoinPost(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleApi#joinCircleApiV1CircleCidJoinPost");
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

<a id="listCirclesApiV1CircleListGet"></a>
# **listCirclesApiV1CircleListGet**
> Object listCirclesApiV1CircleListGet(page, limit, categoryId, keyword, isOfficial)

圈子列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleApi apiInstance = new CircleApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer categoryId = 56; // Integer | 
    String keyword = "keyword_example"; // String | 
    Boolean isOfficial = true; // Boolean | 
    try {
      Object result = apiInstance.listCirclesApiV1CircleListGet(page, limit, categoryId, keyword, isOfficial);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleApi#listCirclesApiV1CircleListGet");
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
| **categoryId** | **Integer**|  | [optional] |
| **keyword** | **String**|  | [optional] |
| **isOfficial** | **Boolean**|  | [optional] |

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
import org.openapitools.client.api.CircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleApi apiInstance = new CircleApi(defaultClient);
    Integer pid = 56; // Integer | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listCommentsApiV1CirclePostPidCommentsGet(pid, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleApi#listCommentsApiV1CirclePostPidCommentsGet");
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

<a id="listMembersApiV1CircleCidMembersGet"></a>
# **listMembersApiV1CircleCidMembersGet**
> Object listMembersApiV1CircleCidMembersGet(cid, page, limit)

成员列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleApi apiInstance = new CircleApi(defaultClient);
    Integer cid = 56; // Integer | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listMembersApiV1CircleCidMembersGet(cid, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleApi#listMembersApiV1CircleCidMembersGet");
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
import org.openapitools.client.api.CircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleApi apiInstance = new CircleApi(defaultClient);
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
      System.err.println("Exception when calling CircleApi#listPostsApiV1CirclePostListGet");
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

<a id="quitCircleApiV1CircleCidQuitPost"></a>
# **quitCircleApiV1CircleCidQuitPost**
> Object quitCircleApiV1CircleCidQuitPost(cid)

退出圈子

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleApi apiInstance = new CircleApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.quitCircleApiV1CircleCidQuitPost(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleApi#quitCircleApiV1CircleCidQuitPost");
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
import org.openapitools.client.api.CircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleApi apiInstance = new CircleApi(defaultClient);
    Integer pid = 56; // Integer | 
    try {
      Object result = apiInstance.toggleLikeApiV1CirclePostPidLikePost(pid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleApi#toggleLikeApiV1CirclePostPidLikePost");
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

<a id="updateCircleApiV1CircleCidPut"></a>
# **updateCircleApiV1CircleCidPut**
> Object updateCircleApiV1CircleCidPut(cid, name, description, avatar, cover)

修改圈子

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleApi apiInstance = new CircleApi(defaultClient);
    Integer cid = 56; // Integer | 
    String name = "name_example"; // String | 
    String description = "description_example"; // String | 
    String avatar = "avatar_example"; // String | 
    String cover = "cover_example"; // String | 
    try {
      Object result = apiInstance.updateCircleApiV1CircleCidPut(cid, name, description, avatar, cover);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleApi#updateCircleApiV1CircleCidPut");
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
| **name** | **String**|  | [optional] |
| **description** | **String**|  | [optional] |
| **avatar** | **String**|  | [optional] |
| **cover** | **String**|  | [optional] |

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
import org.openapitools.client.api.CircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleApi apiInstance = new CircleApi(defaultClient);
    Integer pid = 56; // Integer | 
    String content = "content_example"; // String | 
    String images = "images_example"; // String | 
    String video = "video_example"; // String | 
    try {
      Object result = apiInstance.updatePostApiV1CirclePostPidPut(pid, content, images, video);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleApi#updatePostApiV1CirclePostPidPut");
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

