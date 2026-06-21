# BehaviorApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addSensitiveApiV1BehaviorSensitivePost**](BehaviorApi.md#addsensitiveapiv1behaviorsensitivepost) | **POST** /api/v1/behavior/sensitive | 添加敏感词 |
| [**addSensitiveApiV1BehaviorSensitivePost_0**](BehaviorApi.md#addsensitiveapiv1behaviorsensitivepost_0) | **POST** /api/v1/behavior/sensitive | 添加敏感词 |
| [**behaviorAddComment**](BehaviorApi.md#behavioraddcomment) | **POST** /api/v1/behavior/comment | 发表评论 |
| [**behaviorAddComment_0**](BehaviorApi.md#behavioraddcomment_0) | **POST** /api/v1/behavior/comment | 发表评论 |
| [**behaviorToggleFavorite**](BehaviorApi.md#behaviortogglefavorite) | **POST** /api/v1/behavior/favorite | 收藏/取消收藏 |
| [**behaviorToggleFavorite_0**](BehaviorApi.md#behaviortogglefavorite_0) | **POST** /api/v1/behavior/favorite | 收藏/取消收藏 |
| [**behaviorToggleLike**](BehaviorApi.md#behaviortogglelike) | **POST** /api/v1/behavior/like | 点赞/取消点赞 |
| [**behaviorToggleLike_0**](BehaviorApi.md#behaviortogglelike_0) | **POST** /api/v1/behavior/like | 点赞/取消点赞 |
| [**checkSensitiveApiV1BehaviorSensitiveCheckPost**](BehaviorApi.md#checksensitiveapiv1behaviorsensitivecheckpost) | **POST** /api/v1/behavior/sensitive/check | 敏感词检测 |
| [**checkSensitiveApiV1BehaviorSensitiveCheckPost_0**](BehaviorApi.md#checksensitiveapiv1behaviorsensitivecheckpost_0) | **POST** /api/v1/behavior/sensitive/check | 敏感词检测 |
| [**commentListApiV1BehaviorCommentListGet**](BehaviorApi.md#commentlistapiv1behaviorcommentlistget) | **GET** /api/v1/behavior/comment/list | 评论列表 |
| [**commentListApiV1BehaviorCommentListGet_0**](BehaviorApi.md#commentlistapiv1behaviorcommentlistget_0) | **GET** /api/v1/behavior/comment/list | 评论列表 |
| [**deleteCommentApiV1BehaviorCommentCidDelete**](BehaviorApi.md#deletecommentapiv1behaviorcommentciddelete) | **DELETE** /api/v1/behavior/comment/{cid} | 删除评论 |
| [**deleteCommentApiV1BehaviorCommentCidDelete_0**](BehaviorApi.md#deletecommentapiv1behaviorcommentciddelete_0) | **DELETE** /api/v1/behavior/comment/{cid} | 删除评论 |
| [**deleteSensitiveApiV1BehaviorSensitiveSidDelete**](BehaviorApi.md#deletesensitiveapiv1behaviorsensitivesiddelete) | **DELETE** /api/v1/behavior/sensitive/{sid} | 删除敏感词 |
| [**deleteSensitiveApiV1BehaviorSensitiveSidDelete_0**](BehaviorApi.md#deletesensitiveapiv1behaviorsensitivesiddelete_0) | **DELETE** /api/v1/behavior/sensitive/{sid} | 删除敏感词 |
| [**favoriteListApiV1BehaviorFavoriteListGet**](BehaviorApi.md#favoritelistapiv1behaviorfavoritelistget) | **GET** /api/v1/behavior/favorite/list | 收藏列表 |
| [**favoriteListApiV1BehaviorFavoriteListGet_0**](BehaviorApi.md#favoritelistapiv1behaviorfavoritelistget_0) | **GET** /api/v1/behavior/favorite/list | 收藏列表 |
| [**followListApiV1BehaviorFollowListGet**](BehaviorApi.md#followlistapiv1behaviorfollowlistget) | **GET** /api/v1/behavior/follow/list | 关注列表 |
| [**followListApiV1BehaviorFollowListGet_0**](BehaviorApi.md#followlistapiv1behaviorfollowlistget_0) | **GET** /api/v1/behavior/follow/list | 关注列表 |
| [**handleReportApiV1BehaviorReportRidHandlePut**](BehaviorApi.md#handlereportapiv1behaviorreportridhandleput) | **PUT** /api/v1/behavior/report/{rid}/handle | 处理举报 |
| [**handleReportApiV1BehaviorReportRidHandlePut_0**](BehaviorApi.md#handlereportapiv1behaviorreportridhandleput_0) | **PUT** /api/v1/behavior/report/{rid}/handle | 处理举报 |
| [**likeListApiV1BehaviorLikeListGet**](BehaviorApi.md#likelistapiv1behaviorlikelistget) | **GET** /api/v1/behavior/like/list | 点赞列表 |
| [**likeListApiV1BehaviorLikeListGet_0**](BehaviorApi.md#likelistapiv1behaviorlikelistget_0) | **GET** /api/v1/behavior/like/list | 点赞列表 |
| [**reportApiV1BehaviorReportPost**](BehaviorApi.md#reportapiv1behaviorreportpost) | **POST** /api/v1/behavior/report | 举报 |
| [**reportApiV1BehaviorReportPost_0**](BehaviorApi.md#reportapiv1behaviorreportpost_0) | **POST** /api/v1/behavior/report | 举报 |
| [**reportListApiV1BehaviorReportListGet**](BehaviorApi.md#reportlistapiv1behaviorreportlistget) | **GET** /api/v1/behavior/report/list | 举报列表 |
| [**reportListApiV1BehaviorReportListGet_0**](BehaviorApi.md#reportlistapiv1behaviorreportlistget_0) | **GET** /api/v1/behavior/report/list | 举报列表 |
| [**sensitiveListApiV1BehaviorSensitiveListGet**](BehaviorApi.md#sensitivelistapiv1behaviorsensitivelistget) | **GET** /api/v1/behavior/sensitive/list | 敏感词列表 |
| [**sensitiveListApiV1BehaviorSensitiveListGet_0**](BehaviorApi.md#sensitivelistapiv1behaviorsensitivelistget_0) | **GET** /api/v1/behavior/sensitive/list | 敏感词列表 |
| [**shareApiV1BehaviorSharePost**](BehaviorApi.md#shareapiv1behaviorsharepost) | **POST** /api/v1/behavior/share | 分享 |
| [**shareApiV1BehaviorSharePost_0**](BehaviorApi.md#shareapiv1behaviorsharepost_0) | **POST** /api/v1/behavior/share | 分享 |
| [**toggleFollowApiV1BehaviorFollowPost**](BehaviorApi.md#togglefollowapiv1behaviorfollowpost) | **POST** /api/v1/behavior/follow | 关注/取消关注 |
| [**toggleFollowApiV1BehaviorFollowPost_0**](BehaviorApi.md#togglefollowapiv1behaviorfollowpost_0) | **POST** /api/v1/behavior/follow | 关注/取消关注 |



## addSensitiveApiV1BehaviorSensitivePost

> any addSensitiveApiV1BehaviorSensitivePost(word, category, level, action, replacement)

添加敏感词

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { AddSensitiveApiV1BehaviorSensitivePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string
    word: word_example,
    // string (optional)
    category: category_example,
    // number (optional)
    level: 56,
    // string (optional)
    action: action_example,
    // string (optional)
    replacement: replacement_example,
  } satisfies AddSensitiveApiV1BehaviorSensitivePostRequest;

  try {
    const data = await api.addSensitiveApiV1BehaviorSensitivePost(body);
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
| **word** | `string` |  | [Defaults to `undefined`] |
| **category** | `string` |  | [Optional] [Defaults to `undefined`] |
| **level** | `number` |  | [Optional] [Defaults to `1`] |
| **action** | `string` |  | [Optional] [Defaults to `&#39;replace&#39;`] |
| **replacement** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## addSensitiveApiV1BehaviorSensitivePost_0

> any addSensitiveApiV1BehaviorSensitivePost_0(word, category, level, action, replacement)

添加敏感词

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { AddSensitiveApiV1BehaviorSensitivePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string
    word: word_example,
    // string (optional)
    category: category_example,
    // number (optional)
    level: 56,
    // string (optional)
    action: action_example,
    // string (optional)
    replacement: replacement_example,
  } satisfies AddSensitiveApiV1BehaviorSensitivePost0Request;

  try {
    const data = await api.addSensitiveApiV1BehaviorSensitivePost_0(body);
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
| **word** | `string` |  | [Defaults to `undefined`] |
| **category** | `string` |  | [Optional] [Defaults to `undefined`] |
| **level** | `number` |  | [Optional] [Defaults to `1`] |
| **action** | `string` |  | [Optional] [Defaults to `&#39;replace&#39;`] |
| **replacement** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## behaviorAddComment

> any behaviorAddComment(targetType, targetId, content, pid, replyUserId, replyUserName)

发表评论

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { BehaviorAddCommentRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
    // string
    content: content_example,
    // number (optional)
    pid: 56,
    // string (optional)
    replyUserId: replyUserId_example,
    // string (optional)
    replyUserName: replyUserName_example,
  } satisfies BehaviorAddCommentRequest;

  try {
    const data = await api.behaviorAddComment(body);
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
| **targetType** | `string` |  | [Defaults to `undefined`] |
| **targetId** | `number` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Defaults to `undefined`] |
| **pid** | `number` |  | [Optional] [Defaults to `0`] |
| **replyUserId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **replyUserName** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## behaviorAddComment_0

> any behaviorAddComment_0(targetType, targetId, content, pid, replyUserId, replyUserName)

发表评论

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { BehaviorAddComment0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
    // string
    content: content_example,
    // number (optional)
    pid: 56,
    // string (optional)
    replyUserId: replyUserId_example,
    // string (optional)
    replyUserName: replyUserName_example,
  } satisfies BehaviorAddComment0Request;

  try {
    const data = await api.behaviorAddComment_0(body);
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
| **targetType** | `string` |  | [Defaults to `undefined`] |
| **targetId** | `number` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Defaults to `undefined`] |
| **pid** | `number` |  | [Optional] [Defaults to `0`] |
| **replyUserId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **replyUserName** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## behaviorToggleFavorite

> any behaviorToggleFavorite(targetType, targetId, folder)

收藏/取消收藏

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { BehaviorToggleFavoriteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
    // string (optional)
    folder: folder_example,
  } satisfies BehaviorToggleFavoriteRequest;

  try {
    const data = await api.behaviorToggleFavorite(body);
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
| **targetType** | `string` |  | [Defaults to `undefined`] |
| **targetId** | `number` |  | [Defaults to `undefined`] |
| **folder** | `string` |  | [Optional] [Defaults to `&#39;default&#39;`] |

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


## behaviorToggleFavorite_0

> any behaviorToggleFavorite_0(targetType, targetId, folder)

收藏/取消收藏

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { BehaviorToggleFavorite0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
    // string (optional)
    folder: folder_example,
  } satisfies BehaviorToggleFavorite0Request;

  try {
    const data = await api.behaviorToggleFavorite_0(body);
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
| **targetType** | `string` |  | [Defaults to `undefined`] |
| **targetId** | `number` |  | [Defaults to `undefined`] |
| **folder** | `string` |  | [Optional] [Defaults to `&#39;default&#39;`] |

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


## behaviorToggleLike

> any behaviorToggleLike(targetType, targetId)

点赞/取消点赞

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { BehaviorToggleLikeRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
  } satisfies BehaviorToggleLikeRequest;

  try {
    const data = await api.behaviorToggleLike(body);
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
| **targetType** | `string` |  | [Defaults to `undefined`] |
| **targetId** | `number` |  | [Defaults to `undefined`] |

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


## behaviorToggleLike_0

> any behaviorToggleLike_0(targetType, targetId)

点赞/取消点赞

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { BehaviorToggleLike0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
  } satisfies BehaviorToggleLike0Request;

  try {
    const data = await api.behaviorToggleLike_0(body);
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
| **targetType** | `string` |  | [Defaults to `undefined`] |
| **targetId** | `number` |  | [Defaults to `undefined`] |

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


## checkSensitiveApiV1BehaviorSensitiveCheckPost

> any checkSensitiveApiV1BehaviorSensitiveCheckPost(content)

敏感词检测

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { CheckSensitiveApiV1BehaviorSensitiveCheckPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string
    content: content_example,
  } satisfies CheckSensitiveApiV1BehaviorSensitiveCheckPostRequest;

  try {
    const data = await api.checkSensitiveApiV1BehaviorSensitiveCheckPost(body);
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
| **content** | `string` |  | [Defaults to `undefined`] |

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


## checkSensitiveApiV1BehaviorSensitiveCheckPost_0

> any checkSensitiveApiV1BehaviorSensitiveCheckPost_0(content)

敏感词检测

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { CheckSensitiveApiV1BehaviorSensitiveCheckPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string
    content: content_example,
  } satisfies CheckSensitiveApiV1BehaviorSensitiveCheckPost0Request;

  try {
    const data = await api.checkSensitiveApiV1BehaviorSensitiveCheckPost_0(body);
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
| **content** | `string` |  | [Defaults to `undefined`] |

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


## commentListApiV1BehaviorCommentListGet

> any commentListApiV1BehaviorCommentListGet(targetType, targetId, page, limit)

评论列表

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { CommentListApiV1BehaviorCommentListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies CommentListApiV1BehaviorCommentListGetRequest;

  try {
    const data = await api.commentListApiV1BehaviorCommentListGet(body);
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
| **targetType** | `string` |  | [Defaults to `undefined`] |
| **targetId** | `number` |  | [Defaults to `undefined`] |
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


## commentListApiV1BehaviorCommentListGet_0

> any commentListApiV1BehaviorCommentListGet_0(targetType, targetId, page, limit)

评论列表

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { CommentListApiV1BehaviorCommentListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies CommentListApiV1BehaviorCommentListGet0Request;

  try {
    const data = await api.commentListApiV1BehaviorCommentListGet_0(body);
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
| **targetType** | `string` |  | [Defaults to `undefined`] |
| **targetId** | `number` |  | [Defaults to `undefined`] |
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


## deleteCommentApiV1BehaviorCommentCidDelete

> any deleteCommentApiV1BehaviorCommentCidDelete(cid)

删除评论

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { DeleteCommentApiV1BehaviorCommentCidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // number
    cid: 56,
  } satisfies DeleteCommentApiV1BehaviorCommentCidDeleteRequest;

  try {
    const data = await api.deleteCommentApiV1BehaviorCommentCidDelete(body);
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
| **cid** | `number` |  | [Defaults to `undefined`] |

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


## deleteCommentApiV1BehaviorCommentCidDelete_0

> any deleteCommentApiV1BehaviorCommentCidDelete_0(cid)

删除评论

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { DeleteCommentApiV1BehaviorCommentCidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // number
    cid: 56,
  } satisfies DeleteCommentApiV1BehaviorCommentCidDelete0Request;

  try {
    const data = await api.deleteCommentApiV1BehaviorCommentCidDelete_0(body);
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
| **cid** | `number` |  | [Defaults to `undefined`] |

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


## deleteSensitiveApiV1BehaviorSensitiveSidDelete

> any deleteSensitiveApiV1BehaviorSensitiveSidDelete(sid)

删除敏感词

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { DeleteSensitiveApiV1BehaviorSensitiveSidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // number
    sid: 56,
  } satisfies DeleteSensitiveApiV1BehaviorSensitiveSidDeleteRequest;

  try {
    const data = await api.deleteSensitiveApiV1BehaviorSensitiveSidDelete(body);
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
| **sid** | `number` |  | [Defaults to `undefined`] |

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


## deleteSensitiveApiV1BehaviorSensitiveSidDelete_0

> any deleteSensitiveApiV1BehaviorSensitiveSidDelete_0(sid)

删除敏感词

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { DeleteSensitiveApiV1BehaviorSensitiveSidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // number
    sid: 56,
  } satisfies DeleteSensitiveApiV1BehaviorSensitiveSidDelete0Request;

  try {
    const data = await api.deleteSensitiveApiV1BehaviorSensitiveSidDelete_0(body);
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
| **sid** | `number` |  | [Defaults to `undefined`] |

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


## favoriteListApiV1BehaviorFavoriteListGet

> any favoriteListApiV1BehaviorFavoriteListGet(targetType, folder, page, limit)

收藏列表

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { FavoriteListApiV1BehaviorFavoriteListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string (optional)
    targetType: targetType_example,
    // string (optional)
    folder: folder_example,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies FavoriteListApiV1BehaviorFavoriteListGetRequest;

  try {
    const data = await api.favoriteListApiV1BehaviorFavoriteListGet(body);
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
| **targetType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **folder** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## favoriteListApiV1BehaviorFavoriteListGet_0

> any favoriteListApiV1BehaviorFavoriteListGet_0(targetType, folder, page, limit)

收藏列表

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { FavoriteListApiV1BehaviorFavoriteListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string (optional)
    targetType: targetType_example,
    // string (optional)
    folder: folder_example,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies FavoriteListApiV1BehaviorFavoriteListGet0Request;

  try {
    const data = await api.favoriteListApiV1BehaviorFavoriteListGet_0(body);
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
| **targetType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **folder** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## followListApiV1BehaviorFollowListGet

> any followListApiV1BehaviorFollowListGet(page, limit, isFollower)

关注列表

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { FollowListApiV1BehaviorFollowListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // boolean (optional)
    isFollower: true,
  } satisfies FollowListApiV1BehaviorFollowListGetRequest;

  try {
    const data = await api.followListApiV1BehaviorFollowListGet(body);
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
| **isFollower** | `boolean` |  | [Optional] [Defaults to `false`] |

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


## followListApiV1BehaviorFollowListGet_0

> any followListApiV1BehaviorFollowListGet_0(page, limit, isFollower)

关注列表

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { FollowListApiV1BehaviorFollowListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // boolean (optional)
    isFollower: true,
  } satisfies FollowListApiV1BehaviorFollowListGet0Request;

  try {
    const data = await api.followListApiV1BehaviorFollowListGet_0(body);
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
| **isFollower** | `boolean` |  | [Optional] [Defaults to `false`] |

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


## handleReportApiV1BehaviorReportRidHandlePut

> any handleReportApiV1BehaviorReportRidHandlePut(rid, status, remark)

处理举报

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { HandleReportApiV1BehaviorReportRidHandlePutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // number
    rid: 56,
    // number
    status: 56,
    // string (optional)
    remark: remark_example,
  } satisfies HandleReportApiV1BehaviorReportRidHandlePutRequest;

  try {
    const data = await api.handleReportApiV1BehaviorReportRidHandlePut(body);
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
| **rid** | `number` |  | [Defaults to `undefined`] |
| **status** | `number` |  | [Defaults to `undefined`] |
| **remark** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## handleReportApiV1BehaviorReportRidHandlePut_0

> any handleReportApiV1BehaviorReportRidHandlePut_0(rid, status, remark)

处理举报

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { HandleReportApiV1BehaviorReportRidHandlePut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // number
    rid: 56,
    // number
    status: 56,
    // string (optional)
    remark: remark_example,
  } satisfies HandleReportApiV1BehaviorReportRidHandlePut0Request;

  try {
    const data = await api.handleReportApiV1BehaviorReportRidHandlePut_0(body);
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
| **rid** | `number` |  | [Defaults to `undefined`] |
| **status** | `number` |  | [Defaults to `undefined`] |
| **remark** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## likeListApiV1BehaviorLikeListGet

> any likeListApiV1BehaviorLikeListGet(targetType, userId, page, limit)

点赞列表

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { LikeListApiV1BehaviorLikeListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string (optional)
    targetType: targetType_example,
    // string (optional)
    userId: userId_example,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies LikeListApiV1BehaviorLikeListGetRequest;

  try {
    const data = await api.likeListApiV1BehaviorLikeListGet(body);
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
| **targetType** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## likeListApiV1BehaviorLikeListGet_0

> any likeListApiV1BehaviorLikeListGet_0(targetType, userId, page, limit)

点赞列表

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { LikeListApiV1BehaviorLikeListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string (optional)
    targetType: targetType_example,
    // string (optional)
    userId: userId_example,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies LikeListApiV1BehaviorLikeListGet0Request;

  try {
    const data = await api.likeListApiV1BehaviorLikeListGet_0(body);
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
| **targetType** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## reportApiV1BehaviorReportPost

> any reportApiV1BehaviorReportPost(targetType, targetId, reason, category)

举报

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { ReportApiV1BehaviorReportPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
    // string (optional)
    reason: reason_example,
    // string (optional)
    category: category_example,
  } satisfies ReportApiV1BehaviorReportPostRequest;

  try {
    const data = await api.reportApiV1BehaviorReportPost(body);
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
| **targetType** | `string` |  | [Defaults to `undefined`] |
| **targetId** | `number` |  | [Defaults to `undefined`] |
| **reason** | `string` |  | [Optional] [Defaults to `undefined`] |
| **category** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## reportApiV1BehaviorReportPost_0

> any reportApiV1BehaviorReportPost_0(targetType, targetId, reason, category)

举报

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { ReportApiV1BehaviorReportPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
    // string (optional)
    reason: reason_example,
    // string (optional)
    category: category_example,
  } satisfies ReportApiV1BehaviorReportPost0Request;

  try {
    const data = await api.reportApiV1BehaviorReportPost_0(body);
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
| **targetType** | `string` |  | [Defaults to `undefined`] |
| **targetId** | `number` |  | [Defaults to `undefined`] |
| **reason** | `string` |  | [Optional] [Defaults to `undefined`] |
| **category** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## reportListApiV1BehaviorReportListGet

> any reportListApiV1BehaviorReportListGet(page, limit, status)

举报列表

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { ReportListApiV1BehaviorReportListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    status: 56,
  } satisfies ReportListApiV1BehaviorReportListGetRequest;

  try {
    const data = await api.reportListApiV1BehaviorReportListGet(body);
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
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## reportListApiV1BehaviorReportListGet_0

> any reportListApiV1BehaviorReportListGet_0(page, limit, status)

举报列表

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { ReportListApiV1BehaviorReportListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    status: 56,
  } satisfies ReportListApiV1BehaviorReportListGet0Request;

  try {
    const data = await api.reportListApiV1BehaviorReportListGet_0(body);
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
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## sensitiveListApiV1BehaviorSensitiveListGet

> any sensitiveListApiV1BehaviorSensitiveListGet(page, limit, category)

敏感词列表

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { SensitiveListApiV1BehaviorSensitiveListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    category: category_example,
  } satisfies SensitiveListApiV1BehaviorSensitiveListGetRequest;

  try {
    const data = await api.sensitiveListApiV1BehaviorSensitiveListGet(body);
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
| **limit** | `number` |  | [Optional] [Defaults to `50`] |
| **category** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## sensitiveListApiV1BehaviorSensitiveListGet_0

> any sensitiveListApiV1BehaviorSensitiveListGet_0(page, limit, category)

敏感词列表

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { SensitiveListApiV1BehaviorSensitiveListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    category: category_example,
  } satisfies SensitiveListApiV1BehaviorSensitiveListGet0Request;

  try {
    const data = await api.sensitiveListApiV1BehaviorSensitiveListGet_0(body);
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
| **limit** | `number` |  | [Optional] [Defaults to `50`] |
| **category** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## shareApiV1BehaviorSharePost

> any shareApiV1BehaviorSharePost(targetType, targetId, platform, ip)

分享

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { ShareApiV1BehaviorSharePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
    // string (optional)
    platform: platform_example,
    // string (optional)
    ip: ip_example,
  } satisfies ShareApiV1BehaviorSharePostRequest;

  try {
    const data = await api.shareApiV1BehaviorSharePost(body);
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
| **targetType** | `string` |  | [Defaults to `undefined`] |
| **targetId** | `number` |  | [Defaults to `undefined`] |
| **platform** | `string` |  | [Optional] [Defaults to `undefined`] |
| **ip** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## shareApiV1BehaviorSharePost_0

> any shareApiV1BehaviorSharePost_0(targetType, targetId, platform, ip)

分享

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { ShareApiV1BehaviorSharePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
    // string (optional)
    platform: platform_example,
    // string (optional)
    ip: ip_example,
  } satisfies ShareApiV1BehaviorSharePost0Request;

  try {
    const data = await api.shareApiV1BehaviorSharePost_0(body);
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
| **targetType** | `string` |  | [Defaults to `undefined`] |
| **targetId** | `number` |  | [Defaults to `undefined`] |
| **platform** | `string` |  | [Optional] [Defaults to `undefined`] |
| **ip** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## toggleFollowApiV1BehaviorFollowPost

> any toggleFollowApiV1BehaviorFollowPost(targetUserId)

关注/取消关注

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { ToggleFollowApiV1BehaviorFollowPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string
    targetUserId: targetUserId_example,
  } satisfies ToggleFollowApiV1BehaviorFollowPostRequest;

  try {
    const data = await api.toggleFollowApiV1BehaviorFollowPost(body);
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
| **targetUserId** | `string` |  | [Defaults to `undefined`] |

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


## toggleFollowApiV1BehaviorFollowPost_0

> any toggleFollowApiV1BehaviorFollowPost_0(targetUserId)

关注/取消关注

### Example

```ts
import {
  Configuration,
  BehaviorApi,
} from '';
import type { ToggleFollowApiV1BehaviorFollowPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BehaviorApi();

  const body = {
    // string
    targetUserId: targetUserId_example,
  } satisfies ToggleFollowApiV1BehaviorFollowPost0Request;

  try {
    const data = await api.toggleFollowApiV1BehaviorFollowPost_0(body);
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
| **targetUserId** | `string` |  | [Defaults to `undefined`] |

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

