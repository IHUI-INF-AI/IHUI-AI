# CoursesExtApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**batchCreateVideosApiV1CoursesVideosBatchPost**](CoursesExtApi.md#batchcreatevideosapiv1coursesvideosbatchpost) | **POST** /api/v1/courses/videos/batch | 批量创建视频 |
| [**bindUserPlatformApiV1CoursesUserPlatformBindPost**](CoursesExtApi.md#binduserplatformapiv1coursesuserplatformbindpost) | **POST** /api/v1/courses/user-platform/bind | 用户绑定教育平台 |
| [**createCommentApiV1CoursesCommentsCreatePost**](CoursesExtApi.md#createcommentapiv1coursescommentscreatepost) | **POST** /api/v1/courses/comments/create | 提交课程评论 |
| [**createPlatformApiV1CoursesPlatformsCreatePost**](CoursesExtApi.md#createplatformapiv1coursesplatformscreatepost) | **POST** /api/v1/courses/platforms/create | 创建教育平台 |
| [**createVideoApiV1CoursesVideosCreatePost**](CoursesExtApi.md#createvideoapiv1coursesvideoscreatepost) | **POST** /api/v1/courses/videos/create | 创建视频 |
| [**createVideoLogApiV1CoursesVideoLogPost**](CoursesExtApi.md#createvideologapiv1coursesvideologpost) | **POST** /api/v1/courses/video-log | 记录用户视频观看日志 |
| [**deleteCommentApiV1CoursesCommentsCommentIdDelete**](CoursesExtApi.md#deletecommentapiv1coursescommentscommentiddelete) | **DELETE** /api/v1/courses/comments/{comment_id} | 删除评论（软删除） |
| [**deletePlatformApiV1CoursesPlatformsPlatformIdDelete**](CoursesExtApi.md#deleteplatformapiv1coursesplatformsplatformiddelete) | **DELETE** /api/v1/courses/platforms/{platform_id} | 删除教育平台（软删除） |
| [**deleteVideoApiV1CoursesVideosVideoIdDelete**](CoursesExtApi.md#deletevideoapiv1coursesvideosvideoiddelete) | **DELETE** /api/v1/courses/videos/{video_id} | 删除视频 |
| [**getCategoryParentApiV1CoursesCategoriesCategoryIdParentGet**](CoursesExtApi.md#getcategoryparentapiv1coursescategoriescategoryidparentget) | **GET** /api/v1/courses/categories/{category_id}/parent | 查询分类的父级链 |
| [**getCommentParentApiV1CoursesCommentsParentGet**](CoursesExtApi.md#getcommentparentapiv1coursescommentsparentget) | **GET** /api/v1/courses/comments/parent | 查询评论的父级评论 |
| [**getPlatformApiV1CoursesPlatformsCodeGet**](CoursesExtApi.md#getplatformapiv1coursesplatformscodeget) | **GET** /api/v1/courses/platforms/{code} | 教育平台详情 |
| [**getVideoApiV1CoursesVideosVideoIdGet**](CoursesExtApi.md#getvideoapiv1coursesvideosvideoidget) | **GET** /api/v1/courses/videos/{video_id} | 视频详情 |
| [**issueVideoApiV1CoursesVideosVideoIdIssuePost**](CoursesExtApi.md#issuevideoapiv1coursesvideosvideoidissuepost) | **POST** /api/v1/courses/videos/{video_id}/issue | 视频发布/下架 |
| [**listCategoriesApiV1CoursesCategoriesGet**](CoursesExtApi.md#listcategoriesapiv1coursescategoriesget) | **GET** /api/v1/courses/categories | 课程分类列表 |
| [**listCommentsApiV1CoursesCommentsGet**](CoursesExtApi.md#listcommentsapiv1coursescommentsget) | **GET** /api/v1/courses/comments | 课程评论列表 |
| [**listOperateLogsApiV1CoursesOperateListGet**](CoursesExtApi.md#listoperatelogsapiv1coursesoperatelistget) | **GET** /api/v1/courses/operate/list | 用户操作日志列表 |
| [**listPayLogsApiV1CoursesPayLogsGet**](CoursesExtApi.md#listpaylogsapiv1coursespaylogsget) | **GET** /api/v1/courses/pay-logs | 课程支付日志列表 |
| [**listPlatformLogsApiV1CoursesPlatformLogsGet**](CoursesExtApi.md#listplatformlogsapiv1coursesplatformlogsget) | **GET** /api/v1/courses/platform-logs | 平台操作日志列表 |
| [**listPlatformsApiV1CoursesPlatformsGet**](CoursesExtApi.md#listplatformsapiv1coursesplatformsget) | **GET** /api/v1/courses/platforms | 教育平台列表 |
| [**listVideoLogsApiV1CoursesVideoLogListGet**](CoursesExtApi.md#listvideologsapiv1coursesvideologlistget) | **GET** /api/v1/courses/video-log/list | 用户视频观看日志列表 |
| [**listVideosApiV1CoursesVideosGet**](CoursesExtApi.md#listvideosapiv1coursesvideosget) | **GET** /api/v1/courses/videos | 课程视频列表 |
| [**moveVideoApiV1CoursesVideosVideoIdMovePost**](CoursesExtApi.md#movevideoapiv1coursesvideosvideoidmovepost) | **POST** /api/v1/courses/videos/{video_id}/move | 移动视频到其他课程 |
| [**myPlatformsApiV1CoursesUserPlatformMyGet**](CoursesExtApi.md#myplatformsapiv1coursesuserplatformmyget) | **GET** /api/v1/courses/user-platform/my | 我的平台绑定列表 |
| [**myVideosApiV1CoursesVideosMyGet**](CoursesExtApi.md#myvideosapiv1coursesvideosmyget) | **GET** /api/v1/courses/videos/my | 我创建的视频 |
| [**payCourseApiV1CoursesPayPost**](CoursesExtApi.md#paycourseapiv1coursespaypost) | **POST** /api/v1/courses/pay | 课程支付（先用 token 扣减） |
| [**unbindUserPlatformApiV1CoursesUserPlatformUnbindDelete**](CoursesExtApi.md#unbinduserplatformapiv1coursesuserplatformunbinddelete) | **DELETE** /api/v1/courses/user-platform/unbind | 用户解绑教育平台 |
| [**updatePlatformApiV1CoursesPlatformsPlatformIdPut**](CoursesExtApi.md#updateplatformapiv1coursesplatformsplatformidput) | **PUT** /api/v1/courses/platforms/{platform_id} | 更新教育平台 |
| [**updateVideoApiV1CoursesVideosVideoIdPut**](CoursesExtApi.md#updatevideoapiv1coursesvideosvideoidput) | **PUT** /api/v1/courses/videos/{video_id} | 更新视频 |



## batchCreateVideosApiV1CoursesVideosBatchPost

> any batchCreateVideosApiV1CoursesVideosBatchPost(videoBatchCreate)

批量创建视频

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { BatchCreateVideosApiV1CoursesVideosBatchPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesExtApi(config);

  const body = {
    // VideoBatchCreate
    videoBatchCreate: ...,
  } satisfies BatchCreateVideosApiV1CoursesVideosBatchPostRequest;

  try {
    const data = await api.batchCreateVideosApiV1CoursesVideosBatchPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **videoBatchCreate** | [VideoBatchCreate](VideoBatchCreate.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bindUserPlatformApiV1CoursesUserPlatformBindPost

> any bindUserPlatformApiV1CoursesUserPlatformBindPost(userPlatformBind)

用户绑定教育平台

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { BindUserPlatformApiV1CoursesUserPlatformBindPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesExtApi(config);

  const body = {
    // UserPlatformBind
    userPlatformBind: ...,
  } satisfies BindUserPlatformApiV1CoursesUserPlatformBindPostRequest;

  try {
    const data = await api.bindUserPlatformApiV1CoursesUserPlatformBindPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **userPlatformBind** | [UserPlatformBind](UserPlatformBind.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createCommentApiV1CoursesCommentsCreatePost

> any createCommentApiV1CoursesCommentsCreatePost(appApiV1CoursesCoursesExtCommentCreate)

提交课程评论

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { CreateCommentApiV1CoursesCommentsCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesExtApi(config);

  const body = {
    // AppApiV1CoursesCoursesExtCommentCreate
    appApiV1CoursesCoursesExtCommentCreate: ...,
  } satisfies CreateCommentApiV1CoursesCommentsCreatePostRequest;

  try {
    const data = await api.createCommentApiV1CoursesCommentsCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **appApiV1CoursesCoursesExtCommentCreate** | [AppApiV1CoursesCoursesExtCommentCreate](AppApiV1CoursesCoursesExtCommentCreate.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createPlatformApiV1CoursesPlatformsCreatePost

> any createPlatformApiV1CoursesPlatformsCreatePost(platformCreate)

创建教育平台

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { CreatePlatformApiV1CoursesPlatformsCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesExtApi(config);

  const body = {
    // PlatformCreate
    platformCreate: ...,
  } satisfies CreatePlatformApiV1CoursesPlatformsCreatePostRequest;

  try {
    const data = await api.createPlatformApiV1CoursesPlatformsCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **platformCreate** | [PlatformCreate](PlatformCreate.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createVideoApiV1CoursesVideosCreatePost

> any createVideoApiV1CoursesVideosCreatePost(videoCreate)

创建视频

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { CreateVideoApiV1CoursesVideosCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesExtApi(config);

  const body = {
    // VideoCreate
    videoCreate: ...,
  } satisfies CreateVideoApiV1CoursesVideosCreatePostRequest;

  try {
    const data = await api.createVideoApiV1CoursesVideosCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **videoCreate** | [VideoCreate](VideoCreate.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createVideoLogApiV1CoursesVideoLogPost

> any createVideoLogApiV1CoursesVideoLogPost(videoId, courseId, progress, duration)

记录用户视频观看日志

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { CreateVideoLogApiV1CoursesVideoLogPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesExtApi(config);

  const body = {
    // number
    videoId: 56,
    // number
    courseId: 56,
    // number | 观看进度(秒) (optional)
    progress: 56,
    // number | 视频总时长(秒) (optional)
    duration: 56,
  } satisfies CreateVideoLogApiV1CoursesVideoLogPostRequest;

  try {
    const data = await api.createVideoLogApiV1CoursesVideoLogPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **videoId** | `number` |  | [Defaults to `undefined`] |
| **courseId** | `number` |  | [Defaults to `undefined`] |
| **progress** | `number` | 观看进度(秒) | [Optional] [Defaults to `0`] |
| **duration** | `number` | 视频总时长(秒) | [Optional] [Defaults to `0`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteCommentApiV1CoursesCommentsCommentIdDelete

> any deleteCommentApiV1CoursesCommentsCommentIdDelete(commentId)

删除评论（软删除）

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { DeleteCommentApiV1CoursesCommentsCommentIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesExtApi(config);

  const body = {
    // number
    commentId: 56,
  } satisfies DeleteCommentApiV1CoursesCommentsCommentIdDeleteRequest;

  try {
    const data = await api.deleteCommentApiV1CoursesCommentsCommentIdDelete(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **commentId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deletePlatformApiV1CoursesPlatformsPlatformIdDelete

> any deletePlatformApiV1CoursesPlatformsPlatformIdDelete(platformId)

删除教育平台（软删除）

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { DeletePlatformApiV1CoursesPlatformsPlatformIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesExtApi(config);

  const body = {
    // number
    platformId: 56,
  } satisfies DeletePlatformApiV1CoursesPlatformsPlatformIdDeleteRequest;

  try {
    const data = await api.deletePlatformApiV1CoursesPlatformsPlatformIdDelete(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **platformId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteVideoApiV1CoursesVideosVideoIdDelete

> any deleteVideoApiV1CoursesVideosVideoIdDelete(videoId)

删除视频

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { DeleteVideoApiV1CoursesVideosVideoIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesExtApi(config);

  const body = {
    // number
    videoId: 56,
  } satisfies DeleteVideoApiV1CoursesVideosVideoIdDeleteRequest;

  try {
    const data = await api.deleteVideoApiV1CoursesVideosVideoIdDelete(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **videoId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getCategoryParentApiV1CoursesCategoriesCategoryIdParentGet

> any getCategoryParentApiV1CoursesCategoriesCategoryIdParentGet(categoryId)

查询分类的父级链

递归查询分类的父级链，返回从根到当前节点的完整路径。

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { GetCategoryParentApiV1CoursesCategoriesCategoryIdParentGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CoursesExtApi();

  const body = {
    // number
    categoryId: 56,
  } satisfies GetCategoryParentApiV1CoursesCategoriesCategoryIdParentGetRequest;

  try {
    const data = await api.getCategoryParentApiV1CoursesCategoriesCategoryIdParentGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **categoryId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getCommentParentApiV1CoursesCommentsParentGet

> any getCommentParentApiV1CoursesCommentsParentGet(commentId)

查询评论的父级评论

查询指定评论的父级评论内容。

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { GetCommentParentApiV1CoursesCommentsParentGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CoursesExtApi();

  const body = {
    // number
    commentId: 56,
  } satisfies GetCommentParentApiV1CoursesCommentsParentGetRequest;

  try {
    const data = await api.getCommentParentApiV1CoursesCommentsParentGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **commentId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getPlatformApiV1CoursesPlatformsCodeGet

> any getPlatformApiV1CoursesPlatformsCodeGet(code)

教育平台详情

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { GetPlatformApiV1CoursesPlatformsCodeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CoursesExtApi();

  const body = {
    // string
    code: code_example,
  } satisfies GetPlatformApiV1CoursesPlatformsCodeGetRequest;

  try {
    const data = await api.getPlatformApiV1CoursesPlatformsCodeGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **code** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getVideoApiV1CoursesVideosVideoIdGet

> any getVideoApiV1CoursesVideosVideoIdGet(videoId)

视频详情

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { GetVideoApiV1CoursesVideosVideoIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CoursesExtApi();

  const body = {
    // number
    videoId: 56,
  } satisfies GetVideoApiV1CoursesVideosVideoIdGetRequest;

  try {
    const data = await api.getVideoApiV1CoursesVideosVideoIdGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **videoId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## issueVideoApiV1CoursesVideosVideoIdIssuePost

> any issueVideoApiV1CoursesVideosVideoIdIssuePost(videoId)

视频发布/下架

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { IssueVideoApiV1CoursesVideosVideoIdIssuePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesExtApi(config);

  const body = {
    // number
    videoId: 56,
  } satisfies IssueVideoApiV1CoursesVideosVideoIdIssuePostRequest;

  try {
    const data = await api.issueVideoApiV1CoursesVideosVideoIdIssuePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **videoId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listCategoriesApiV1CoursesCategoriesGet

> any listCategoriesApiV1CoursesCategoriesGet(status)

课程分类列表

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { ListCategoriesApiV1CoursesCategoriesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CoursesExtApi();

  const body = {
    // number | 0 禁用 1 启用 (optional)
    status: 56,
  } satisfies ListCategoriesApiV1CoursesCategoriesGetRequest;

  try {
    const data = await api.listCategoriesApiV1CoursesCategoriesGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **status** | `number` | 0 禁用 1 启用 | [Optional] [Defaults to `1`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listCommentsApiV1CoursesCommentsGet

> any listCommentsApiV1CoursesCommentsGet(courseId, parentId, page, limit)

课程评论列表

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { ListCommentsApiV1CoursesCommentsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CoursesExtApi();

  const body = {
    // number
    courseId: 56,
    // number | 父评论 ID，不传则只查顶级 (optional)
    parentId: 56,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListCommentsApiV1CoursesCommentsGetRequest;

  try {
    const data = await api.listCommentsApiV1CoursesCommentsGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **courseId** | `number` |  | [Defaults to `undefined`] |
| **parentId** | `number` | 父评论 ID，不传则只查顶级 | [Optional] [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listOperateLogsApiV1CoursesOperateListGet

> any listOperateLogsApiV1CoursesOperateListGet(type, userId, page, limit)

用户操作日志列表

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { ListOperateLogsApiV1CoursesOperateListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CoursesExtApi();

  const body = {
    // string | 操作类型: comment / pay / video 等 (optional)
    type: type_example,
    // string (optional)
    userId: userId_example,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListOperateLogsApiV1CoursesOperateListGetRequest;

  try {
    const data = await api.listOperateLogsApiV1CoursesOperateListGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **type** | `string` | 操作类型: comment / pay / video 等 | [Optional] [Defaults to `undefined`] |
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listPayLogsApiV1CoursesPayLogsGet

> any listPayLogsApiV1CoursesPayLogsGet(courseId, userId, page, limit)

课程支付日志列表

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { ListPayLogsApiV1CoursesPayLogsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CoursesExtApi();

  const body = {
    // number (optional)
    courseId: 56,
    // string (optional)
    userId: userId_example,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListPayLogsApiV1CoursesPayLogsGetRequest;

  try {
    const data = await api.listPayLogsApiV1CoursesPayLogsGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **courseId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listPlatformLogsApiV1CoursesPlatformLogsGet

> any listPlatformLogsApiV1CoursesPlatformLogsGet(platformId, userId, page, limit)

平台操作日志列表

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { ListPlatformLogsApiV1CoursesPlatformLogsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CoursesExtApi();

  const body = {
    // number (optional)
    platformId: 56,
    // string (optional)
    userId: userId_example,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListPlatformLogsApiV1CoursesPlatformLogsGetRequest;

  try {
    const data = await api.listPlatformLogsApiV1CoursesPlatformLogsGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **platformId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listPlatformsApiV1CoursesPlatformsGet

> any listPlatformsApiV1CoursesPlatformsGet(status, page, limit)

教育平台列表

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { ListPlatformsApiV1CoursesPlatformsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CoursesExtApi();

  const body = {
    // number (optional)
    status: 56,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListPlatformsApiV1CoursesPlatformsGetRequest;

  try {
    const data = await api.listPlatformsApiV1CoursesPlatformsGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **status** | `number` |  | [Optional] [Defaults to `1`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `100`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listVideoLogsApiV1CoursesVideoLogListGet

> any listVideoLogsApiV1CoursesVideoLogListGet(courseId, page, limit)

用户视频观看日志列表

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { ListVideoLogsApiV1CoursesVideoLogListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesExtApi(config);

  const body = {
    // number (optional)
    courseId: 56,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListVideoLogsApiV1CoursesVideoLogListGetRequest;

  try {
    const data = await api.listVideoLogsApiV1CoursesVideoLogListGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **courseId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listVideosApiV1CoursesVideosGet

> any listVideosApiV1CoursesVideosGet(courseId, isPay, page, limit)

课程视频列表

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { ListVideosApiV1CoursesVideosGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CoursesExtApi();

  const body = {
    // number
    courseId: 56,
    // number | 0 免费 1 付费 (optional)
    isPay: 56,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListVideosApiV1CoursesVideosGetRequest;

  try {
    const data = await api.listVideosApiV1CoursesVideosGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **courseId** | `number` |  | [Defaults to `undefined`] |
| **isPay** | `number` | 0 免费 1 付费 | [Optional] [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## moveVideoApiV1CoursesVideosVideoIdMovePost

> any moveVideoApiV1CoursesVideosVideoIdMovePost(videoId, targetCourseId)

移动视频到其他课程

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { MoveVideoApiV1CoursesVideosVideoIdMovePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesExtApi(config);

  const body = {
    // number
    videoId: 56,
    // number | 目标课程 ID
    targetCourseId: 56,
  } satisfies MoveVideoApiV1CoursesVideosVideoIdMovePostRequest;

  try {
    const data = await api.moveVideoApiV1CoursesVideosVideoIdMovePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **videoId** | `number` |  | [Defaults to `undefined`] |
| **targetCourseId** | `number` | 目标课程 ID | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## myPlatformsApiV1CoursesUserPlatformMyGet

> any myPlatformsApiV1CoursesUserPlatformMyGet()

我的平台绑定列表

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { MyPlatformsApiV1CoursesUserPlatformMyGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesExtApi(config);

  try {
    const data = await api.myPlatformsApiV1CoursesUserPlatformMyGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## myVideosApiV1CoursesVideosMyGet

> any myVideosApiV1CoursesVideosMyGet(page, limit)

我创建的视频

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { MyVideosApiV1CoursesVideosMyGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesExtApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies MyVideosApiV1CoursesVideosMyGetRequest;

  try {
    const data = await api.myVideosApiV1CoursesVideosMyGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## payCourseApiV1CoursesPayPost

> any payCourseApiV1CoursesPayPost(courseId, costTokens, payType)

课程支付（先用 token 扣减）

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { PayCourseApiV1CoursesPayPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesExtApi(config);

  const body = {
    // number
    courseId: 56,
    // number | 所需 token
    costTokens: 56,
    // number | 0 token 1 微信 2 支付宝 (optional)
    payType: 56,
  } satisfies PayCourseApiV1CoursesPayPostRequest;

  try {
    const data = await api.payCourseApiV1CoursesPayPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **courseId** | `number` |  | [Defaults to `undefined`] |
| **costTokens** | `number` | 所需 token | [Defaults to `undefined`] |
| **payType** | `number` | 0 token 1 微信 2 支付宝 | [Optional] [Defaults to `0`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## unbindUserPlatformApiV1CoursesUserPlatformUnbindDelete

> any unbindUserPlatformApiV1CoursesUserPlatformUnbindDelete(platformId)

用户解绑教育平台

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { UnbindUserPlatformApiV1CoursesUserPlatformUnbindDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesExtApi(config);

  const body = {
    // number
    platformId: 56,
  } satisfies UnbindUserPlatformApiV1CoursesUserPlatformUnbindDeleteRequest;

  try {
    const data = await api.unbindUserPlatformApiV1CoursesUserPlatformUnbindDelete(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **platformId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updatePlatformApiV1CoursesPlatformsPlatformIdPut

> any updatePlatformApiV1CoursesPlatformsPlatformIdPut(platformId, platformUpdate)

更新教育平台

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { UpdatePlatformApiV1CoursesPlatformsPlatformIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesExtApi(config);

  const body = {
    // number
    platformId: 56,
    // PlatformUpdate
    platformUpdate: ...,
  } satisfies UpdatePlatformApiV1CoursesPlatformsPlatformIdPutRequest;

  try {
    const data = await api.updatePlatformApiV1CoursesPlatformsPlatformIdPut(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **platformId** | `number` |  | [Defaults to `undefined`] |
| **platformUpdate** | [PlatformUpdate](PlatformUpdate.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateVideoApiV1CoursesVideosVideoIdPut

> any updateVideoApiV1CoursesVideosVideoIdPut(videoId, videoUpdate)

更新视频

### Example

```ts
import {
  Configuration,
  CoursesExtApi,
} from '';
import type { UpdateVideoApiV1CoursesVideosVideoIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesExtApi(config);

  const body = {
    // number
    videoId: 56,
    // VideoUpdate
    videoUpdate: ...,
  } satisfies UpdateVideoApiV1CoursesVideosVideoIdPutRequest;

  try {
    const data = await api.updateVideoApiV1CoursesVideosVideoIdPut(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **videoId** | `number` |  | [Defaults to `undefined`] |
| **videoUpdate** | [VideoUpdate](VideoUpdate.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

