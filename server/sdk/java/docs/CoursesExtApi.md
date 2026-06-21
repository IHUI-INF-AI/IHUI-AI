# CoursesExtApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**batchCreateVideosApiV1CoursesVideosBatchPost**](CoursesExtApi.md#batchCreateVideosApiV1CoursesVideosBatchPost) | **POST** /api/v1/courses/videos/batch | 批量创建视频 |
| [**bindUserPlatformApiV1CoursesUserPlatformBindPost**](CoursesExtApi.md#bindUserPlatformApiV1CoursesUserPlatformBindPost) | **POST** /api/v1/courses/user-platform/bind | 用户绑定教育平台 |
| [**createCommentApiV1CoursesCommentsCreatePost**](CoursesExtApi.md#createCommentApiV1CoursesCommentsCreatePost) | **POST** /api/v1/courses/comments/create | 提交课程评论 |
| [**createPlatformApiV1CoursesPlatformsCreatePost**](CoursesExtApi.md#createPlatformApiV1CoursesPlatformsCreatePost) | **POST** /api/v1/courses/platforms/create | 创建教育平台 |
| [**createVideoApiV1CoursesVideosCreatePost**](CoursesExtApi.md#createVideoApiV1CoursesVideosCreatePost) | **POST** /api/v1/courses/videos/create | 创建视频 |
| [**createVideoLogApiV1CoursesVideoLogPost**](CoursesExtApi.md#createVideoLogApiV1CoursesVideoLogPost) | **POST** /api/v1/courses/video-log | 记录用户视频观看日志 |
| [**deleteCommentApiV1CoursesCommentsCommentIdDelete**](CoursesExtApi.md#deleteCommentApiV1CoursesCommentsCommentIdDelete) | **DELETE** /api/v1/courses/comments/{comment_id} | 删除评论（软删除） |
| [**deletePlatformApiV1CoursesPlatformsPlatformIdDelete**](CoursesExtApi.md#deletePlatformApiV1CoursesPlatformsPlatformIdDelete) | **DELETE** /api/v1/courses/platforms/{platform_id} | 删除教育平台（软删除） |
| [**deleteVideoApiV1CoursesVideosVideoIdDelete**](CoursesExtApi.md#deleteVideoApiV1CoursesVideosVideoIdDelete) | **DELETE** /api/v1/courses/videos/{video_id} | 删除视频 |
| [**getCategoryParentApiV1CoursesCategoriesCategoryIdParentGet**](CoursesExtApi.md#getCategoryParentApiV1CoursesCategoriesCategoryIdParentGet) | **GET** /api/v1/courses/categories/{category_id}/parent | 查询分类的父级链 |
| [**getCommentParentApiV1CoursesCommentsParentGet**](CoursesExtApi.md#getCommentParentApiV1CoursesCommentsParentGet) | **GET** /api/v1/courses/comments/parent | 查询评论的父级评论 |
| [**getPlatformApiV1CoursesPlatformsCodeGet**](CoursesExtApi.md#getPlatformApiV1CoursesPlatformsCodeGet) | **GET** /api/v1/courses/platforms/{code} | 教育平台详情 |
| [**getVideoApiV1CoursesVideosVideoIdGet**](CoursesExtApi.md#getVideoApiV1CoursesVideosVideoIdGet) | **GET** /api/v1/courses/videos/{video_id} | 视频详情 |
| [**issueVideoApiV1CoursesVideosVideoIdIssuePost**](CoursesExtApi.md#issueVideoApiV1CoursesVideosVideoIdIssuePost) | **POST** /api/v1/courses/videos/{video_id}/issue | 视频发布/下架 |
| [**listCategoriesApiV1CoursesCategoriesGet**](CoursesExtApi.md#listCategoriesApiV1CoursesCategoriesGet) | **GET** /api/v1/courses/categories | 课程分类列表 |
| [**listCommentsApiV1CoursesCommentsGet**](CoursesExtApi.md#listCommentsApiV1CoursesCommentsGet) | **GET** /api/v1/courses/comments | 课程评论列表 |
| [**listOperateLogsApiV1CoursesOperateListGet**](CoursesExtApi.md#listOperateLogsApiV1CoursesOperateListGet) | **GET** /api/v1/courses/operate/list | 用户操作日志列表 |
| [**listPayLogsApiV1CoursesPayLogsGet**](CoursesExtApi.md#listPayLogsApiV1CoursesPayLogsGet) | **GET** /api/v1/courses/pay-logs | 课程支付日志列表 |
| [**listPlatformLogsApiV1CoursesPlatformLogsGet**](CoursesExtApi.md#listPlatformLogsApiV1CoursesPlatformLogsGet) | **GET** /api/v1/courses/platform-logs | 平台操作日志列表 |
| [**listPlatformsApiV1CoursesPlatformsGet**](CoursesExtApi.md#listPlatformsApiV1CoursesPlatformsGet) | **GET** /api/v1/courses/platforms | 教育平台列表 |
| [**listVideoLogsApiV1CoursesVideoLogListGet**](CoursesExtApi.md#listVideoLogsApiV1CoursesVideoLogListGet) | **GET** /api/v1/courses/video-log/list | 用户视频观看日志列表 |
| [**listVideosApiV1CoursesVideosGet**](CoursesExtApi.md#listVideosApiV1CoursesVideosGet) | **GET** /api/v1/courses/videos | 课程视频列表 |
| [**moveVideoApiV1CoursesVideosVideoIdMovePost**](CoursesExtApi.md#moveVideoApiV1CoursesVideosVideoIdMovePost) | **POST** /api/v1/courses/videos/{video_id}/move | 移动视频到其他课程 |
| [**myPlatformsApiV1CoursesUserPlatformMyGet**](CoursesExtApi.md#myPlatformsApiV1CoursesUserPlatformMyGet) | **GET** /api/v1/courses/user-platform/my | 我的平台绑定列表 |
| [**myVideosApiV1CoursesVideosMyGet**](CoursesExtApi.md#myVideosApiV1CoursesVideosMyGet) | **GET** /api/v1/courses/videos/my | 我创建的视频 |
| [**payCourseApiV1CoursesPayPost**](CoursesExtApi.md#payCourseApiV1CoursesPayPost) | **POST** /api/v1/courses/pay | 课程支付（先用 token 扣减） |
| [**unbindUserPlatformApiV1CoursesUserPlatformUnbindDelete**](CoursesExtApi.md#unbindUserPlatformApiV1CoursesUserPlatformUnbindDelete) | **DELETE** /api/v1/courses/user-platform/unbind | 用户解绑教育平台 |
| [**updatePlatformApiV1CoursesPlatformsPlatformIdPut**](CoursesExtApi.md#updatePlatformApiV1CoursesPlatformsPlatformIdPut) | **PUT** /api/v1/courses/platforms/{platform_id} | 更新教育平台 |
| [**updateVideoApiV1CoursesVideosVideoIdPut**](CoursesExtApi.md#updateVideoApiV1CoursesVideosVideoIdPut) | **PUT** /api/v1/courses/videos/{video_id} | 更新视频 |


<a id="batchCreateVideosApiV1CoursesVideosBatchPost"></a>
# **batchCreateVideosApiV1CoursesVideosBatchPost**
> Object batchCreateVideosApiV1CoursesVideosBatchPost(videoBatchCreate)

批量创建视频

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    VideoBatchCreate videoBatchCreate = new VideoBatchCreate(); // VideoBatchCreate | 
    try {
      Object result = apiInstance.batchCreateVideosApiV1CoursesVideosBatchPost(videoBatchCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#batchCreateVideosApiV1CoursesVideosBatchPost");
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
| **videoBatchCreate** | [**VideoBatchCreate**](VideoBatchCreate.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="bindUserPlatformApiV1CoursesUserPlatformBindPost"></a>
# **bindUserPlatformApiV1CoursesUserPlatformBindPost**
> Object bindUserPlatformApiV1CoursesUserPlatformBindPost(userPlatformBind)

用户绑定教育平台

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    UserPlatformBind userPlatformBind = new UserPlatformBind(); // UserPlatformBind | 
    try {
      Object result = apiInstance.bindUserPlatformApiV1CoursesUserPlatformBindPost(userPlatformBind);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#bindUserPlatformApiV1CoursesUserPlatformBindPost");
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
| **userPlatformBind** | [**UserPlatformBind**](UserPlatformBind.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createCommentApiV1CoursesCommentsCreatePost"></a>
# **createCommentApiV1CoursesCommentsCreatePost**
> Object createCommentApiV1CoursesCommentsCreatePost(appApiV1CoursesCoursesExtCommentCreate)

提交课程评论

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    AppApiV1CoursesCoursesExtCommentCreate appApiV1CoursesCoursesExtCommentCreate = new AppApiV1CoursesCoursesExtCommentCreate(); // AppApiV1CoursesCoursesExtCommentCreate | 
    try {
      Object result = apiInstance.createCommentApiV1CoursesCommentsCreatePost(appApiV1CoursesCoursesExtCommentCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#createCommentApiV1CoursesCommentsCreatePost");
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
| **appApiV1CoursesCoursesExtCommentCreate** | [**AppApiV1CoursesCoursesExtCommentCreate**](AppApiV1CoursesCoursesExtCommentCreate.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createPlatformApiV1CoursesPlatformsCreatePost"></a>
# **createPlatformApiV1CoursesPlatformsCreatePost**
> Object createPlatformApiV1CoursesPlatformsCreatePost(platformCreate)

创建教育平台

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    PlatformCreate platformCreate = new PlatformCreate(); // PlatformCreate | 
    try {
      Object result = apiInstance.createPlatformApiV1CoursesPlatformsCreatePost(platformCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#createPlatformApiV1CoursesPlatformsCreatePost");
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
| **platformCreate** | [**PlatformCreate**](PlatformCreate.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createVideoApiV1CoursesVideosCreatePost"></a>
# **createVideoApiV1CoursesVideosCreatePost**
> Object createVideoApiV1CoursesVideosCreatePost(videoCreate)

创建视频

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    VideoCreate videoCreate = new VideoCreate(); // VideoCreate | 
    try {
      Object result = apiInstance.createVideoApiV1CoursesVideosCreatePost(videoCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#createVideoApiV1CoursesVideosCreatePost");
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
| **videoCreate** | [**VideoCreate**](VideoCreate.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createVideoLogApiV1CoursesVideoLogPost"></a>
# **createVideoLogApiV1CoursesVideoLogPost**
> Object createVideoLogApiV1CoursesVideoLogPost(videoId, courseId, progress, duration)

记录用户视频观看日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer videoId = 56; // Integer | 
    Integer courseId = 56; // Integer | 
    Integer progress = 0; // Integer | 观看进度(秒)
    Integer duration = 0; // Integer | 视频总时长(秒)
    try {
      Object result = apiInstance.createVideoLogApiV1CoursesVideoLogPost(videoId, courseId, progress, duration);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#createVideoLogApiV1CoursesVideoLogPost");
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
| **courseId** | **Integer**|  | |
| **progress** | **Integer**| 观看进度(秒) | [optional] [default to 0] |
| **duration** | **Integer**| 视频总时长(秒) | [optional] [default to 0] |

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

<a id="deleteCommentApiV1CoursesCommentsCommentIdDelete"></a>
# **deleteCommentApiV1CoursesCommentsCommentIdDelete**
> Object deleteCommentApiV1CoursesCommentsCommentIdDelete(commentId)

删除评论（软删除）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer commentId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteCommentApiV1CoursesCommentsCommentIdDelete(commentId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#deleteCommentApiV1CoursesCommentsCommentIdDelete");
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
| **commentId** | **Integer**|  | |

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

<a id="deletePlatformApiV1CoursesPlatformsPlatformIdDelete"></a>
# **deletePlatformApiV1CoursesPlatformsPlatformIdDelete**
> Object deletePlatformApiV1CoursesPlatformsPlatformIdDelete(platformId)

删除教育平台（软删除）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer platformId = 56; // Integer | 
    try {
      Object result = apiInstance.deletePlatformApiV1CoursesPlatformsPlatformIdDelete(platformId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#deletePlatformApiV1CoursesPlatformsPlatformIdDelete");
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
| **platformId** | **Integer**|  | |

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

<a id="deleteVideoApiV1CoursesVideosVideoIdDelete"></a>
# **deleteVideoApiV1CoursesVideosVideoIdDelete**
> Object deleteVideoApiV1CoursesVideosVideoIdDelete(videoId)

删除视频

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer videoId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteVideoApiV1CoursesVideosVideoIdDelete(videoId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#deleteVideoApiV1CoursesVideosVideoIdDelete");
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

<a id="getCategoryParentApiV1CoursesCategoriesCategoryIdParentGet"></a>
# **getCategoryParentApiV1CoursesCategoriesCategoryIdParentGet**
> Object getCategoryParentApiV1CoursesCategoriesCategoryIdParentGet(categoryId)

查询分类的父级链

递归查询分类的父级链，返回从根到当前节点的完整路径。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer categoryId = 56; // Integer | 
    try {
      Object result = apiInstance.getCategoryParentApiV1CoursesCategoriesCategoryIdParentGet(categoryId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#getCategoryParentApiV1CoursesCategoriesCategoryIdParentGet");
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
| **categoryId** | **Integer**|  | |

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

<a id="getCommentParentApiV1CoursesCommentsParentGet"></a>
# **getCommentParentApiV1CoursesCommentsParentGet**
> Object getCommentParentApiV1CoursesCommentsParentGet(commentId)

查询评论的父级评论

查询指定评论的父级评论内容。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer commentId = 56; // Integer | 
    try {
      Object result = apiInstance.getCommentParentApiV1CoursesCommentsParentGet(commentId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#getCommentParentApiV1CoursesCommentsParentGet");
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
| **commentId** | **Integer**|  | |

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

<a id="getPlatformApiV1CoursesPlatformsCodeGet"></a>
# **getPlatformApiV1CoursesPlatformsCodeGet**
> Object getPlatformApiV1CoursesPlatformsCodeGet(code)

教育平台详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    String code = "code_example"; // String | 
    try {
      Object result = apiInstance.getPlatformApiV1CoursesPlatformsCodeGet(code);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#getPlatformApiV1CoursesPlatformsCodeGet");
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
| **code** | **String**|  | |

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

<a id="getVideoApiV1CoursesVideosVideoIdGet"></a>
# **getVideoApiV1CoursesVideosVideoIdGet**
> Object getVideoApiV1CoursesVideosVideoIdGet(videoId)

视频详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer videoId = 56; // Integer | 
    try {
      Object result = apiInstance.getVideoApiV1CoursesVideosVideoIdGet(videoId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#getVideoApiV1CoursesVideosVideoIdGet");
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

<a id="issueVideoApiV1CoursesVideosVideoIdIssuePost"></a>
# **issueVideoApiV1CoursesVideosVideoIdIssuePost**
> Object issueVideoApiV1CoursesVideosVideoIdIssuePost(videoId)

视频发布/下架

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer videoId = 56; // Integer | 
    try {
      Object result = apiInstance.issueVideoApiV1CoursesVideosVideoIdIssuePost(videoId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#issueVideoApiV1CoursesVideosVideoIdIssuePost");
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

<a id="listCategoriesApiV1CoursesCategoriesGet"></a>
# **listCategoriesApiV1CoursesCategoriesGet**
> Object listCategoriesApiV1CoursesCategoriesGet(status)

课程分类列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer status = 1; // Integer | 0 禁用 1 启用
    try {
      Object result = apiInstance.listCategoriesApiV1CoursesCategoriesGet(status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#listCategoriesApiV1CoursesCategoriesGet");
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
| **status** | **Integer**| 0 禁用 1 启用 | [optional] [default to 1] |

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

<a id="listCommentsApiV1CoursesCommentsGet"></a>
# **listCommentsApiV1CoursesCommentsGet**
> Object listCommentsApiV1CoursesCommentsGet(courseId, parentId, page, limit)

课程评论列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer courseId = 56; // Integer | 
    Integer parentId = 56; // Integer | 父评论 ID，不传则只查顶级
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listCommentsApiV1CoursesCommentsGet(courseId, parentId, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#listCommentsApiV1CoursesCommentsGet");
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
| **courseId** | **Integer**|  | |
| **parentId** | **Integer**| 父评论 ID，不传则只查顶级 | [optional] |
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

<a id="listOperateLogsApiV1CoursesOperateListGet"></a>
# **listOperateLogsApiV1CoursesOperateListGet**
> Object listOperateLogsApiV1CoursesOperateListGet(type, userId, page, limit)

用户操作日志列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    String type = "type_example"; // String | 操作类型: comment / pay / video 等
    String userId = "userId_example"; // String | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listOperateLogsApiV1CoursesOperateListGet(type, userId, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#listOperateLogsApiV1CoursesOperateListGet");
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
| **type** | **String**| 操作类型: comment / pay / video 等 | [optional] |
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

<a id="listPayLogsApiV1CoursesPayLogsGet"></a>
# **listPayLogsApiV1CoursesPayLogsGet**
> Object listPayLogsApiV1CoursesPayLogsGet(courseId, userId, page, limit)

课程支付日志列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer courseId = 56; // Integer | 
    String userId = "userId_example"; // String | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listPayLogsApiV1CoursesPayLogsGet(courseId, userId, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#listPayLogsApiV1CoursesPayLogsGet");
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
| **courseId** | **Integer**|  | [optional] |
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

<a id="listPlatformLogsApiV1CoursesPlatformLogsGet"></a>
# **listPlatformLogsApiV1CoursesPlatformLogsGet**
> Object listPlatformLogsApiV1CoursesPlatformLogsGet(platformId, userId, page, limit)

平台操作日志列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer platformId = 56; // Integer | 
    String userId = "userId_example"; // String | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listPlatformLogsApiV1CoursesPlatformLogsGet(platformId, userId, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#listPlatformLogsApiV1CoursesPlatformLogsGet");
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
| **platformId** | **Integer**|  | [optional] |
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

<a id="listPlatformsApiV1CoursesPlatformsGet"></a>
# **listPlatformsApiV1CoursesPlatformsGet**
> Object listPlatformsApiV1CoursesPlatformsGet(status, page, limit)

教育平台列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer status = 1; // Integer | 
    Integer page = 1; // Integer | 
    Integer limit = 100; // Integer | 
    try {
      Object result = apiInstance.listPlatformsApiV1CoursesPlatformsGet(status, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#listPlatformsApiV1CoursesPlatformsGet");
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
| **status** | **Integer**|  | [optional] [default to 1] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 100] |

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

<a id="listVideoLogsApiV1CoursesVideoLogListGet"></a>
# **listVideoLogsApiV1CoursesVideoLogListGet**
> Object listVideoLogsApiV1CoursesVideoLogListGet(courseId, page, limit)

用户视频观看日志列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer courseId = 56; // Integer | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listVideoLogsApiV1CoursesVideoLogListGet(courseId, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#listVideoLogsApiV1CoursesVideoLogListGet");
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
| **courseId** | **Integer**|  | [optional] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |

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

<a id="listVideosApiV1CoursesVideosGet"></a>
# **listVideosApiV1CoursesVideosGet**
> Object listVideosApiV1CoursesVideosGet(courseId, isPay, page, limit)

课程视频列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer courseId = 56; // Integer | 
    Integer isPay = 56; // Integer | 0 免费 1 付费
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listVideosApiV1CoursesVideosGet(courseId, isPay, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#listVideosApiV1CoursesVideosGet");
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
| **courseId** | **Integer**|  | |
| **isPay** | **Integer**| 0 免费 1 付费 | [optional] |
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

<a id="moveVideoApiV1CoursesVideosVideoIdMovePost"></a>
# **moveVideoApiV1CoursesVideosVideoIdMovePost**
> Object moveVideoApiV1CoursesVideosVideoIdMovePost(videoId, targetCourseId)

移动视频到其他课程

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer videoId = 56; // Integer | 
    Integer targetCourseId = 56; // Integer | 目标课程 ID
    try {
      Object result = apiInstance.moveVideoApiV1CoursesVideosVideoIdMovePost(videoId, targetCourseId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#moveVideoApiV1CoursesVideosVideoIdMovePost");
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
| **targetCourseId** | **Integer**| 目标课程 ID | |

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

<a id="myPlatformsApiV1CoursesUserPlatformMyGet"></a>
# **myPlatformsApiV1CoursesUserPlatformMyGet**
> Object myPlatformsApiV1CoursesUserPlatformMyGet()

我的平台绑定列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    try {
      Object result = apiInstance.myPlatformsApiV1CoursesUserPlatformMyGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#myPlatformsApiV1CoursesUserPlatformMyGet");
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="myVideosApiV1CoursesVideosMyGet"></a>
# **myVideosApiV1CoursesVideosMyGet**
> Object myVideosApiV1CoursesVideosMyGet(page, limit)

我创建的视频

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.myVideosApiV1CoursesVideosMyGet(page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#myVideosApiV1CoursesVideosMyGet");
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

<a id="payCourseApiV1CoursesPayPost"></a>
# **payCourseApiV1CoursesPayPost**
> Object payCourseApiV1CoursesPayPost(courseId, costTokens, payType)

课程支付（先用 token 扣减）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer courseId = 56; // Integer | 
    Integer costTokens = 56; // Integer | 所需 token
    Integer payType = 0; // Integer | 0 token 1 微信 2 支付宝
    try {
      Object result = apiInstance.payCourseApiV1CoursesPayPost(courseId, costTokens, payType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#payCourseApiV1CoursesPayPost");
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
| **courseId** | **Integer**|  | |
| **costTokens** | **Integer**| 所需 token | |
| **payType** | **Integer**| 0 token 1 微信 2 支付宝 | [optional] [default to 0] |

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

<a id="unbindUserPlatformApiV1CoursesUserPlatformUnbindDelete"></a>
# **unbindUserPlatformApiV1CoursesUserPlatformUnbindDelete**
> Object unbindUserPlatformApiV1CoursesUserPlatformUnbindDelete(platformId)

用户解绑教育平台

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer platformId = 56; // Integer | 
    try {
      Object result = apiInstance.unbindUserPlatformApiV1CoursesUserPlatformUnbindDelete(platformId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#unbindUserPlatformApiV1CoursesUserPlatformUnbindDelete");
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
| **platformId** | **Integer**|  | |

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

<a id="updatePlatformApiV1CoursesPlatformsPlatformIdPut"></a>
# **updatePlatformApiV1CoursesPlatformsPlatformIdPut**
> Object updatePlatformApiV1CoursesPlatformsPlatformIdPut(platformId, platformUpdate)

更新教育平台

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer platformId = 56; // Integer | 
    PlatformUpdate platformUpdate = new PlatformUpdate(); // PlatformUpdate | 
    try {
      Object result = apiInstance.updatePlatformApiV1CoursesPlatformsPlatformIdPut(platformId, platformUpdate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#updatePlatformApiV1CoursesPlatformsPlatformIdPut");
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
| **platformId** | **Integer**|  | |
| **platformUpdate** | [**PlatformUpdate**](PlatformUpdate.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="updateVideoApiV1CoursesVideosVideoIdPut"></a>
# **updateVideoApiV1CoursesVideosVideoIdPut**
> Object updateVideoApiV1CoursesVideosVideoIdPut(videoId, videoUpdate)

更新视频

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesExtApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesExtApi apiInstance = new CoursesExtApi(defaultClient);
    Integer videoId = 56; // Integer | 
    VideoUpdate videoUpdate = new VideoUpdate(); // VideoUpdate | 
    try {
      Object result = apiInstance.updateVideoApiV1CoursesVideosVideoIdPut(videoId, videoUpdate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesExtApi#updateVideoApiV1CoursesVideosVideoIdPut");
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
| **videoUpdate** | [**VideoUpdate**](VideoUpdate.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

