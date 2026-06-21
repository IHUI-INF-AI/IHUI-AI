# CoursesExtApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**batchCreateVideosApiV1CoursesVideosBatchPost**](#batchcreatevideosapiv1coursesvideosbatchpost) | **POST** /api/v1/courses/videos/batch | 批量创建视频|
|[**bindUserPlatformApiV1CoursesUserPlatformBindPost**](#binduserplatformapiv1coursesuserplatformbindpost) | **POST** /api/v1/courses/user-platform/bind | 用户绑定教育平台|
|[**createCommentApiV1CoursesCommentsCreatePost**](#createcommentapiv1coursescommentscreatepost) | **POST** /api/v1/courses/comments/create | 提交课程评论|
|[**createPlatformApiV1CoursesPlatformsCreatePost**](#createplatformapiv1coursesplatformscreatepost) | **POST** /api/v1/courses/platforms/create | 创建教育平台|
|[**createVideoApiV1CoursesVideosCreatePost**](#createvideoapiv1coursesvideoscreatepost) | **POST** /api/v1/courses/videos/create | 创建视频|
|[**createVideoLogApiV1CoursesVideoLogPost**](#createvideologapiv1coursesvideologpost) | **POST** /api/v1/courses/video-log | 记录用户视频观看日志|
|[**deleteCommentApiV1CoursesCommentsCommentIdDelete**](#deletecommentapiv1coursescommentscommentiddelete) | **DELETE** /api/v1/courses/comments/{comment_id} | 删除评论（软删除）|
|[**deletePlatformApiV1CoursesPlatformsPlatformIdDelete**](#deleteplatformapiv1coursesplatformsplatformiddelete) | **DELETE** /api/v1/courses/platforms/{platform_id} | 删除教育平台（软删除）|
|[**deleteVideoApiV1CoursesVideosVideoIdDelete**](#deletevideoapiv1coursesvideosvideoiddelete) | **DELETE** /api/v1/courses/videos/{video_id} | 删除视频|
|[**getCategoryParentApiV1CoursesCategoriesCategoryIdParentGet**](#getcategoryparentapiv1coursescategoriescategoryidparentget) | **GET** /api/v1/courses/categories/{category_id}/parent | 查询分类的父级链|
|[**getCommentParentApiV1CoursesCommentsParentGet**](#getcommentparentapiv1coursescommentsparentget) | **GET** /api/v1/courses/comments/parent | 查询评论的父级评论|
|[**getPlatformApiV1CoursesPlatformsCodeGet**](#getplatformapiv1coursesplatformscodeget) | **GET** /api/v1/courses/platforms/{code} | 教育平台详情|
|[**getVideoApiV1CoursesVideosVideoIdGet**](#getvideoapiv1coursesvideosvideoidget) | **GET** /api/v1/courses/videos/{video_id} | 视频详情|
|[**issueVideoApiV1CoursesVideosVideoIdIssuePost**](#issuevideoapiv1coursesvideosvideoidissuepost) | **POST** /api/v1/courses/videos/{video_id}/issue | 视频发布/下架|
|[**listCategoriesApiV1CoursesCategoriesGet**](#listcategoriesapiv1coursescategoriesget) | **GET** /api/v1/courses/categories | 课程分类列表|
|[**listCommentsApiV1CoursesCommentsGet**](#listcommentsapiv1coursescommentsget) | **GET** /api/v1/courses/comments | 课程评论列表|
|[**listOperateLogsApiV1CoursesOperateListGet**](#listoperatelogsapiv1coursesoperatelistget) | **GET** /api/v1/courses/operate/list | 用户操作日志列表|
|[**listPayLogsApiV1CoursesPayLogsGet**](#listpaylogsapiv1coursespaylogsget) | **GET** /api/v1/courses/pay-logs | 课程支付日志列表|
|[**listPlatformLogsApiV1CoursesPlatformLogsGet**](#listplatformlogsapiv1coursesplatformlogsget) | **GET** /api/v1/courses/platform-logs | 平台操作日志列表|
|[**listPlatformsApiV1CoursesPlatformsGet**](#listplatformsapiv1coursesplatformsget) | **GET** /api/v1/courses/platforms | 教育平台列表|
|[**listVideoLogsApiV1CoursesVideoLogListGet**](#listvideologsapiv1coursesvideologlistget) | **GET** /api/v1/courses/video-log/list | 用户视频观看日志列表|
|[**listVideosApiV1CoursesVideosGet**](#listvideosapiv1coursesvideosget) | **GET** /api/v1/courses/videos | 课程视频列表|
|[**moveVideoApiV1CoursesVideosVideoIdMovePost**](#movevideoapiv1coursesvideosvideoidmovepost) | **POST** /api/v1/courses/videos/{video_id}/move | 移动视频到其他课程|
|[**myPlatformsApiV1CoursesUserPlatformMyGet**](#myplatformsapiv1coursesuserplatformmyget) | **GET** /api/v1/courses/user-platform/my | 我的平台绑定列表|
|[**myVideosApiV1CoursesVideosMyGet**](#myvideosapiv1coursesvideosmyget) | **GET** /api/v1/courses/videos/my | 我创建的视频|
|[**payCourseApiV1CoursesPayPost**](#paycourseapiv1coursespaypost) | **POST** /api/v1/courses/pay | 课程支付（先用 token 扣减）|
|[**unbindUserPlatformApiV1CoursesUserPlatformUnbindDelete**](#unbinduserplatformapiv1coursesuserplatformunbinddelete) | **DELETE** /api/v1/courses/user-platform/unbind | 用户解绑教育平台|
|[**updatePlatformApiV1CoursesPlatformsPlatformIdPut**](#updateplatformapiv1coursesplatformsplatformidput) | **PUT** /api/v1/courses/platforms/{platform_id} | 更新教育平台|
|[**updateVideoApiV1CoursesVideosVideoIdPut**](#updatevideoapiv1coursesvideosvideoidput) | **PUT** /api/v1/courses/videos/{video_id} | 更新视频|

# **batchCreateVideosApiV1CoursesVideosBatchPost**
> any batchCreateVideosApiV1CoursesVideosBatchPost(videoBatchCreate)


### Example

```typescript
import {
    CoursesExtApi,
    Configuration,
    VideoBatchCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let videoBatchCreate: VideoBatchCreate; //

const { status, data } = await apiInstance.batchCreateVideosApiV1CoursesVideosBatchPost(
    videoBatchCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoBatchCreate** | **VideoBatchCreate**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **bindUserPlatformApiV1CoursesUserPlatformBindPost**
> any bindUserPlatformApiV1CoursesUserPlatformBindPost(userPlatformBind)


### Example

```typescript
import {
    CoursesExtApi,
    Configuration,
    UserPlatformBind
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let userPlatformBind: UserPlatformBind; //

const { status, data } = await apiInstance.bindUserPlatformApiV1CoursesUserPlatformBindPost(
    userPlatformBind
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userPlatformBind** | **UserPlatformBind**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createCommentApiV1CoursesCommentsCreatePost**
> any createCommentApiV1CoursesCommentsCreatePost(appApiV1CoursesCoursesExtCommentCreate)


### Example

```typescript
import {
    CoursesExtApi,
    Configuration,
    AppApiV1CoursesCoursesExtCommentCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let appApiV1CoursesCoursesExtCommentCreate: AppApiV1CoursesCoursesExtCommentCreate; //

const { status, data } = await apiInstance.createCommentApiV1CoursesCommentsCreatePost(
    appApiV1CoursesCoursesExtCommentCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **appApiV1CoursesCoursesExtCommentCreate** | **AppApiV1CoursesCoursesExtCommentCreate**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createPlatformApiV1CoursesPlatformsCreatePost**
> any createPlatformApiV1CoursesPlatformsCreatePost(platformCreate)


### Example

```typescript
import {
    CoursesExtApi,
    Configuration,
    PlatformCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let platformCreate: PlatformCreate; //

const { status, data } = await apiInstance.createPlatformApiV1CoursesPlatformsCreatePost(
    platformCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **platformCreate** | **PlatformCreate**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createVideoApiV1CoursesVideosCreatePost**
> any createVideoApiV1CoursesVideosCreatePost(videoCreate)


### Example

```typescript
import {
    CoursesExtApi,
    Configuration,
    VideoCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let videoCreate: VideoCreate; //

const { status, data } = await apiInstance.createVideoApiV1CoursesVideosCreatePost(
    videoCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoCreate** | **VideoCreate**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createVideoLogApiV1CoursesVideoLogPost**
> any createVideoLogApiV1CoursesVideoLogPost()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let videoId: number; // (default to undefined)
let courseId: number; // (default to undefined)
let progress: number; //观看进度(秒) (optional) (default to 0)
let duration: number; //视频总时长(秒) (optional) (default to 0)

const { status, data } = await apiInstance.createVideoLogApiV1CoursesVideoLogPost(
    videoId,
    courseId,
    progress,
    duration
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoId** | [**number**] |  | defaults to undefined|
| **courseId** | [**number**] |  | defaults to undefined|
| **progress** | [**number**] | 观看进度(秒) | (optional) defaults to 0|
| **duration** | [**number**] | 视频总时长(秒) | (optional) defaults to 0|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteCommentApiV1CoursesCommentsCommentIdDelete**
> any deleteCommentApiV1CoursesCommentsCommentIdDelete()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let commentId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteCommentApiV1CoursesCommentsCommentIdDelete(
    commentId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **commentId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deletePlatformApiV1CoursesPlatformsPlatformIdDelete**
> any deletePlatformApiV1CoursesPlatformsPlatformIdDelete()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let platformId: number; // (default to undefined)

const { status, data } = await apiInstance.deletePlatformApiV1CoursesPlatformsPlatformIdDelete(
    platformId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **platformId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteVideoApiV1CoursesVideosVideoIdDelete**
> any deleteVideoApiV1CoursesVideosVideoIdDelete()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let videoId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteVideoApiV1CoursesVideosVideoIdDelete(
    videoId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getCategoryParentApiV1CoursesCategoriesCategoryIdParentGet**
> any getCategoryParentApiV1CoursesCategoriesCategoryIdParentGet()

递归查询分类的父级链，返回从根到当前节点的完整路径。

### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let categoryId: number; // (default to undefined)

const { status, data } = await apiInstance.getCategoryParentApiV1CoursesCategoriesCategoryIdParentGet(
    categoryId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **categoryId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getCommentParentApiV1CoursesCommentsParentGet**
> any getCommentParentApiV1CoursesCommentsParentGet()

查询指定评论的父级评论内容。

### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let commentId: number; // (default to undefined)

const { status, data } = await apiInstance.getCommentParentApiV1CoursesCommentsParentGet(
    commentId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **commentId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getPlatformApiV1CoursesPlatformsCodeGet**
> any getPlatformApiV1CoursesPlatformsCodeGet()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let code: string; // (default to undefined)

const { status, data } = await apiInstance.getPlatformApiV1CoursesPlatformsCodeGet(
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getVideoApiV1CoursesVideosVideoIdGet**
> any getVideoApiV1CoursesVideosVideoIdGet()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let videoId: number; // (default to undefined)

const { status, data } = await apiInstance.getVideoApiV1CoursesVideosVideoIdGet(
    videoId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **issueVideoApiV1CoursesVideosVideoIdIssuePost**
> any issueVideoApiV1CoursesVideosVideoIdIssuePost()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let videoId: number; // (default to undefined)

const { status, data } = await apiInstance.issueVideoApiV1CoursesVideosVideoIdIssuePost(
    videoId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listCategoriesApiV1CoursesCategoriesGet**
> any listCategoriesApiV1CoursesCategoriesGet()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let status: number; //0 禁用 1 启用 (optional) (default to 1)

const { status, data } = await apiInstance.listCategoriesApiV1CoursesCategoriesGet(
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **status** | [**number**] | 0 禁用 1 启用 | (optional) defaults to 1|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listCommentsApiV1CoursesCommentsGet**
> any listCommentsApiV1CoursesCommentsGet()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let courseId: number; // (default to undefined)
let parentId: number; //父评论 ID，不传则只查顶级 (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listCommentsApiV1CoursesCommentsGet(
    courseId,
    parentId,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **courseId** | [**number**] |  | defaults to undefined|
| **parentId** | [**number**] | 父评论 ID，不传则只查顶级 | (optional) defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listOperateLogsApiV1CoursesOperateListGet**
> any listOperateLogsApiV1CoursesOperateListGet()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let type: string; //操作类型: comment / pay / video 等 (optional) (default to undefined)
let userId: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listOperateLogsApiV1CoursesOperateListGet(
    type,
    userId,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **type** | [**string**] | 操作类型: comment / pay / video 等 | (optional) defaults to undefined|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listPayLogsApiV1CoursesPayLogsGet**
> any listPayLogsApiV1CoursesPayLogsGet()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let courseId: number; // (optional) (default to undefined)
let userId: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listPayLogsApiV1CoursesPayLogsGet(
    courseId,
    userId,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **courseId** | [**number**] |  | (optional) defaults to undefined|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listPlatformLogsApiV1CoursesPlatformLogsGet**
> any listPlatformLogsApiV1CoursesPlatformLogsGet()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let platformId: number; // (optional) (default to undefined)
let userId: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listPlatformLogsApiV1CoursesPlatformLogsGet(
    platformId,
    userId,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **platformId** | [**number**] |  | (optional) defaults to undefined|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listPlatformsApiV1CoursesPlatformsGet**
> any listPlatformsApiV1CoursesPlatformsGet()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let status: number; // (optional) (default to 1)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 100)

const { status, data } = await apiInstance.listPlatformsApiV1CoursesPlatformsGet(
    status,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **status** | [**number**] |  | (optional) defaults to 1|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 100|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listVideoLogsApiV1CoursesVideoLogListGet**
> any listVideoLogsApiV1CoursesVideoLogListGet()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let courseId: number; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listVideoLogsApiV1CoursesVideoLogListGet(
    courseId,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **courseId** | [**number**] |  | (optional) defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listVideosApiV1CoursesVideosGet**
> any listVideosApiV1CoursesVideosGet()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let courseId: number; // (default to undefined)
let isPay: number; //0 免费 1 付费 (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listVideosApiV1CoursesVideosGet(
    courseId,
    isPay,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **courseId** | [**number**] |  | defaults to undefined|
| **isPay** | [**number**] | 0 免费 1 付费 | (optional) defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **moveVideoApiV1CoursesVideosVideoIdMovePost**
> any moveVideoApiV1CoursesVideosVideoIdMovePost()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let videoId: number; // (default to undefined)
let targetCourseId: number; //目标课程 ID (default to undefined)

const { status, data } = await apiInstance.moveVideoApiV1CoursesVideosVideoIdMovePost(
    videoId,
    targetCourseId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoId** | [**number**] |  | defaults to undefined|
| **targetCourseId** | [**number**] | 目标课程 ID | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **myPlatformsApiV1CoursesUserPlatformMyGet**
> any myPlatformsApiV1CoursesUserPlatformMyGet()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

const { status, data } = await apiInstance.myPlatformsApiV1CoursesUserPlatformMyGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **myVideosApiV1CoursesVideosMyGet**
> any myVideosApiV1CoursesVideosMyGet()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.myVideosApiV1CoursesVideosMyGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **payCourseApiV1CoursesPayPost**
> any payCourseApiV1CoursesPayPost()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let courseId: number; // (default to undefined)
let costTokens: number; //所需 token (default to undefined)
let payType: number; //0 token 1 微信 2 支付宝 (optional) (default to 0)

const { status, data } = await apiInstance.payCourseApiV1CoursesPayPost(
    courseId,
    costTokens,
    payType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **courseId** | [**number**] |  | defaults to undefined|
| **costTokens** | [**number**] | 所需 token | defaults to undefined|
| **payType** | [**number**] | 0 token 1 微信 2 支付宝 | (optional) defaults to 0|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **unbindUserPlatformApiV1CoursesUserPlatformUnbindDelete**
> any unbindUserPlatformApiV1CoursesUserPlatformUnbindDelete()


### Example

```typescript
import {
    CoursesExtApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let platformId: number; // (default to undefined)

const { status, data } = await apiInstance.unbindUserPlatformApiV1CoursesUserPlatformUnbindDelete(
    platformId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **platformId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updatePlatformApiV1CoursesPlatformsPlatformIdPut**
> any updatePlatformApiV1CoursesPlatformsPlatformIdPut(platformUpdate)


### Example

```typescript
import {
    CoursesExtApi,
    Configuration,
    PlatformUpdate
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let platformId: number; // (default to undefined)
let platformUpdate: PlatformUpdate; //

const { status, data } = await apiInstance.updatePlatformApiV1CoursesPlatformsPlatformIdPut(
    platformId,
    platformUpdate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **platformUpdate** | **PlatformUpdate**|  | |
| **platformId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateVideoApiV1CoursesVideosVideoIdPut**
> any updateVideoApiV1CoursesVideosVideoIdPut(videoUpdate)


### Example

```typescript
import {
    CoursesExtApi,
    Configuration,
    VideoUpdate
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesExtApi(configuration);

let videoId: number; // (default to undefined)
let videoUpdate: VideoUpdate; //

const { status, data } = await apiInstance.updateVideoApiV1CoursesVideosVideoIdPut(
    videoId,
    videoUpdate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoUpdate** | **VideoUpdate**|  | |
| **videoId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

