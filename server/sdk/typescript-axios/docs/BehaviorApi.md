# BehaviorApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**addSensitiveApiV1BehaviorSensitivePost**](#addsensitiveapiv1behaviorsensitivepost) | **POST** /api/v1/behavior/sensitive | 添加敏感词|
|[**addSensitiveApiV1BehaviorSensitivePost_0**](#addsensitiveapiv1behaviorsensitivepost_0) | **POST** /api/v1/behavior/sensitive | 添加敏感词|
|[**behaviorAddComment**](#behavioraddcomment) | **POST** /api/v1/behavior/comment | 发表评论|
|[**behaviorAddComment_0**](#behavioraddcomment_0) | **POST** /api/v1/behavior/comment | 发表评论|
|[**behaviorToggleFavorite**](#behaviortogglefavorite) | **POST** /api/v1/behavior/favorite | 收藏/取消收藏|
|[**behaviorToggleFavorite_0**](#behaviortogglefavorite_0) | **POST** /api/v1/behavior/favorite | 收藏/取消收藏|
|[**behaviorToggleLike**](#behaviortogglelike) | **POST** /api/v1/behavior/like | 点赞/取消点赞|
|[**behaviorToggleLike_0**](#behaviortogglelike_0) | **POST** /api/v1/behavior/like | 点赞/取消点赞|
|[**checkSensitiveApiV1BehaviorSensitiveCheckPost**](#checksensitiveapiv1behaviorsensitivecheckpost) | **POST** /api/v1/behavior/sensitive/check | 敏感词检测|
|[**checkSensitiveApiV1BehaviorSensitiveCheckPost_0**](#checksensitiveapiv1behaviorsensitivecheckpost_0) | **POST** /api/v1/behavior/sensitive/check | 敏感词检测|
|[**commentListApiV1BehaviorCommentListGet**](#commentlistapiv1behaviorcommentlistget) | **GET** /api/v1/behavior/comment/list | 评论列表|
|[**commentListApiV1BehaviorCommentListGet_0**](#commentlistapiv1behaviorcommentlistget_0) | **GET** /api/v1/behavior/comment/list | 评论列表|
|[**deleteCommentApiV1BehaviorCommentCidDelete**](#deletecommentapiv1behaviorcommentciddelete) | **DELETE** /api/v1/behavior/comment/{cid} | 删除评论|
|[**deleteCommentApiV1BehaviorCommentCidDelete_0**](#deletecommentapiv1behaviorcommentciddelete_0) | **DELETE** /api/v1/behavior/comment/{cid} | 删除评论|
|[**deleteSensitiveApiV1BehaviorSensitiveSidDelete**](#deletesensitiveapiv1behaviorsensitivesiddelete) | **DELETE** /api/v1/behavior/sensitive/{sid} | 删除敏感词|
|[**deleteSensitiveApiV1BehaviorSensitiveSidDelete_0**](#deletesensitiveapiv1behaviorsensitivesiddelete_0) | **DELETE** /api/v1/behavior/sensitive/{sid} | 删除敏感词|
|[**favoriteListApiV1BehaviorFavoriteListGet**](#favoritelistapiv1behaviorfavoritelistget) | **GET** /api/v1/behavior/favorite/list | 收藏列表|
|[**favoriteListApiV1BehaviorFavoriteListGet_0**](#favoritelistapiv1behaviorfavoritelistget_0) | **GET** /api/v1/behavior/favorite/list | 收藏列表|
|[**followListApiV1BehaviorFollowListGet**](#followlistapiv1behaviorfollowlistget) | **GET** /api/v1/behavior/follow/list | 关注列表|
|[**followListApiV1BehaviorFollowListGet_0**](#followlistapiv1behaviorfollowlistget_0) | **GET** /api/v1/behavior/follow/list | 关注列表|
|[**handleReportApiV1BehaviorReportRidHandlePut**](#handlereportapiv1behaviorreportridhandleput) | **PUT** /api/v1/behavior/report/{rid}/handle | 处理举报|
|[**handleReportApiV1BehaviorReportRidHandlePut_0**](#handlereportapiv1behaviorreportridhandleput_0) | **PUT** /api/v1/behavior/report/{rid}/handle | 处理举报|
|[**likeListApiV1BehaviorLikeListGet**](#likelistapiv1behaviorlikelistget) | **GET** /api/v1/behavior/like/list | 点赞列表|
|[**likeListApiV1BehaviorLikeListGet_0**](#likelistapiv1behaviorlikelistget_0) | **GET** /api/v1/behavior/like/list | 点赞列表|
|[**reportApiV1BehaviorReportPost**](#reportapiv1behaviorreportpost) | **POST** /api/v1/behavior/report | 举报|
|[**reportApiV1BehaviorReportPost_0**](#reportapiv1behaviorreportpost_0) | **POST** /api/v1/behavior/report | 举报|
|[**reportListApiV1BehaviorReportListGet**](#reportlistapiv1behaviorreportlistget) | **GET** /api/v1/behavior/report/list | 举报列表|
|[**reportListApiV1BehaviorReportListGet_0**](#reportlistapiv1behaviorreportlistget_0) | **GET** /api/v1/behavior/report/list | 举报列表|
|[**sensitiveListApiV1BehaviorSensitiveListGet**](#sensitivelistapiv1behaviorsensitivelistget) | **GET** /api/v1/behavior/sensitive/list | 敏感词列表|
|[**sensitiveListApiV1BehaviorSensitiveListGet_0**](#sensitivelistapiv1behaviorsensitivelistget_0) | **GET** /api/v1/behavior/sensitive/list | 敏感词列表|
|[**shareApiV1BehaviorSharePost**](#shareapiv1behaviorsharepost) | **POST** /api/v1/behavior/share | 分享|
|[**shareApiV1BehaviorSharePost_0**](#shareapiv1behaviorsharepost_0) | **POST** /api/v1/behavior/share | 分享|
|[**toggleFollowApiV1BehaviorFollowPost**](#togglefollowapiv1behaviorfollowpost) | **POST** /api/v1/behavior/follow | 关注/取消关注|
|[**toggleFollowApiV1BehaviorFollowPost_0**](#togglefollowapiv1behaviorfollowpost_0) | **POST** /api/v1/behavior/follow | 关注/取消关注|

# **addSensitiveApiV1BehaviorSensitivePost**
> any addSensitiveApiV1BehaviorSensitivePost()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let word: string; // (default to undefined)
let category: string; // (optional) (default to undefined)
let level: number; // (optional) (default to 1)
let action: string; // (optional) (default to 'replace')
let replacement: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.addSensitiveApiV1BehaviorSensitivePost(
    word,
    category,
    level,
    action,
    replacement
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **word** | [**string**] |  | defaults to undefined|
| **category** | [**string**] |  | (optional) defaults to undefined|
| **level** | [**number**] |  | (optional) defaults to 1|
| **action** | [**string**] |  | (optional) defaults to 'replace'|
| **replacement** | [**string**] |  | (optional) defaults to undefined|


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

# **addSensitiveApiV1BehaviorSensitivePost_0**
> any addSensitiveApiV1BehaviorSensitivePost_0()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let word: string; // (default to undefined)
let category: string; // (optional) (default to undefined)
let level: number; // (optional) (default to 1)
let action: string; // (optional) (default to 'replace')
let replacement: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.addSensitiveApiV1BehaviorSensitivePost_0(
    word,
    category,
    level,
    action,
    replacement
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **word** | [**string**] |  | defaults to undefined|
| **category** | [**string**] |  | (optional) defaults to undefined|
| **level** | [**number**] |  | (optional) defaults to 1|
| **action** | [**string**] |  | (optional) defaults to 'replace'|
| **replacement** | [**string**] |  | (optional) defaults to undefined|


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

# **behaviorAddComment**
> any behaviorAddComment()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)
let content: string; // (default to undefined)
let pid: number; // (optional) (default to 0)
let replyUserId: string; // (optional) (default to undefined)
let replyUserName: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.behaviorAddComment(
    targetType,
    targetId,
    content,
    pid,
    replyUserId,
    replyUserName
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | defaults to undefined|
| **targetId** | [**number**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **pid** | [**number**] |  | (optional) defaults to 0|
| **replyUserId** | [**string**] |  | (optional) defaults to undefined|
| **replyUserName** | [**string**] |  | (optional) defaults to undefined|


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

# **behaviorAddComment_0**
> any behaviorAddComment_0()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)
let content: string; // (default to undefined)
let pid: number; // (optional) (default to 0)
let replyUserId: string; // (optional) (default to undefined)
let replyUserName: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.behaviorAddComment_0(
    targetType,
    targetId,
    content,
    pid,
    replyUserId,
    replyUserName
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | defaults to undefined|
| **targetId** | [**number**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **pid** | [**number**] |  | (optional) defaults to 0|
| **replyUserId** | [**string**] |  | (optional) defaults to undefined|
| **replyUserName** | [**string**] |  | (optional) defaults to undefined|


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

# **behaviorToggleFavorite**
> any behaviorToggleFavorite()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)
let folder: string; // (optional) (default to 'default')

const { status, data } = await apiInstance.behaviorToggleFavorite(
    targetType,
    targetId,
    folder
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | defaults to undefined|
| **targetId** | [**number**] |  | defaults to undefined|
| **folder** | [**string**] |  | (optional) defaults to 'default'|


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

# **behaviorToggleFavorite_0**
> any behaviorToggleFavorite_0()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)
let folder: string; // (optional) (default to 'default')

const { status, data } = await apiInstance.behaviorToggleFavorite_0(
    targetType,
    targetId,
    folder
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | defaults to undefined|
| **targetId** | [**number**] |  | defaults to undefined|
| **folder** | [**string**] |  | (optional) defaults to 'default'|


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

# **behaviorToggleLike**
> any behaviorToggleLike()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)

const { status, data } = await apiInstance.behaviorToggleLike(
    targetType,
    targetId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | defaults to undefined|
| **targetId** | [**number**] |  | defaults to undefined|


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

# **behaviorToggleLike_0**
> any behaviorToggleLike_0()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)

const { status, data } = await apiInstance.behaviorToggleLike_0(
    targetType,
    targetId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | defaults to undefined|
| **targetId** | [**number**] |  | defaults to undefined|


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

# **checkSensitiveApiV1BehaviorSensitiveCheckPost**
> any checkSensitiveApiV1BehaviorSensitiveCheckPost()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let content: string; // (default to undefined)

const { status, data } = await apiInstance.checkSensitiveApiV1BehaviorSensitiveCheckPost(
    content
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **content** | [**string**] |  | defaults to undefined|


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

# **checkSensitiveApiV1BehaviorSensitiveCheckPost_0**
> any checkSensitiveApiV1BehaviorSensitiveCheckPost_0()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let content: string; // (default to undefined)

const { status, data } = await apiInstance.checkSensitiveApiV1BehaviorSensitiveCheckPost_0(
    content
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **content** | [**string**] |  | defaults to undefined|


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

# **commentListApiV1BehaviorCommentListGet**
> any commentListApiV1BehaviorCommentListGet()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.commentListApiV1BehaviorCommentListGet(
    targetType,
    targetId,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | defaults to undefined|
| **targetId** | [**number**] |  | defaults to undefined|
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

# **commentListApiV1BehaviorCommentListGet_0**
> any commentListApiV1BehaviorCommentListGet_0()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.commentListApiV1BehaviorCommentListGet_0(
    targetType,
    targetId,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | defaults to undefined|
| **targetId** | [**number**] |  | defaults to undefined|
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

# **deleteCommentApiV1BehaviorCommentCidDelete**
> any deleteCommentApiV1BehaviorCommentCidDelete()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteCommentApiV1BehaviorCommentCidDelete(
    cid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **cid** | [**number**] |  | defaults to undefined|


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

# **deleteCommentApiV1BehaviorCommentCidDelete_0**
> any deleteCommentApiV1BehaviorCommentCidDelete_0()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteCommentApiV1BehaviorCommentCidDelete_0(
    cid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **cid** | [**number**] |  | defaults to undefined|


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

# **deleteSensitiveApiV1BehaviorSensitiveSidDelete**
> any deleteSensitiveApiV1BehaviorSensitiveSidDelete()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let sid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteSensitiveApiV1BehaviorSensitiveSidDelete(
    sid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sid** | [**number**] |  | defaults to undefined|


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

# **deleteSensitiveApiV1BehaviorSensitiveSidDelete_0**
> any deleteSensitiveApiV1BehaviorSensitiveSidDelete_0()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let sid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteSensitiveApiV1BehaviorSensitiveSidDelete_0(
    sid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sid** | [**number**] |  | defaults to undefined|


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

# **favoriteListApiV1BehaviorFavoriteListGet**
> any favoriteListApiV1BehaviorFavoriteListGet()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let targetType: string; // (optional) (default to undefined)
let folder: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.favoriteListApiV1BehaviorFavoriteListGet(
    targetType,
    folder,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | (optional) defaults to undefined|
| **folder** | [**string**] |  | (optional) defaults to undefined|
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

# **favoriteListApiV1BehaviorFavoriteListGet_0**
> any favoriteListApiV1BehaviorFavoriteListGet_0()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let targetType: string; // (optional) (default to undefined)
let folder: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.favoriteListApiV1BehaviorFavoriteListGet_0(
    targetType,
    folder,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | (optional) defaults to undefined|
| **folder** | [**string**] |  | (optional) defaults to undefined|
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

# **followListApiV1BehaviorFollowListGet**
> any followListApiV1BehaviorFollowListGet()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let isFollower: boolean; // (optional) (default to false)

const { status, data } = await apiInstance.followListApiV1BehaviorFollowListGet(
    page,
    limit,
    isFollower
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **isFollower** | [**boolean**] |  | (optional) defaults to false|


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

# **followListApiV1BehaviorFollowListGet_0**
> any followListApiV1BehaviorFollowListGet_0()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let isFollower: boolean; // (optional) (default to false)

const { status, data } = await apiInstance.followListApiV1BehaviorFollowListGet_0(
    page,
    limit,
    isFollower
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **isFollower** | [**boolean**] |  | (optional) defaults to false|


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

# **handleReportApiV1BehaviorReportRidHandlePut**
> any handleReportApiV1BehaviorReportRidHandlePut()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let rid: number; // (default to undefined)
let status: number; // (default to undefined)
let remark: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.handleReportApiV1BehaviorReportRidHandlePut(
    rid,
    status,
    remark
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **rid** | [**number**] |  | defaults to undefined|
| **status** | [**number**] |  | defaults to undefined|
| **remark** | [**string**] |  | (optional) defaults to undefined|


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

# **handleReportApiV1BehaviorReportRidHandlePut_0**
> any handleReportApiV1BehaviorReportRidHandlePut_0()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let rid: number; // (default to undefined)
let status: number; // (default to undefined)
let remark: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.handleReportApiV1BehaviorReportRidHandlePut_0(
    rid,
    status,
    remark
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **rid** | [**number**] |  | defaults to undefined|
| **status** | [**number**] |  | defaults to undefined|
| **remark** | [**string**] |  | (optional) defaults to undefined|


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

# **likeListApiV1BehaviorLikeListGet**
> any likeListApiV1BehaviorLikeListGet()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let targetType: string; // (optional) (default to undefined)
let userId: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.likeListApiV1BehaviorLikeListGet(
    targetType,
    userId,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | (optional) defaults to undefined|
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

# **likeListApiV1BehaviorLikeListGet_0**
> any likeListApiV1BehaviorLikeListGet_0()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let targetType: string; // (optional) (default to undefined)
let userId: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.likeListApiV1BehaviorLikeListGet_0(
    targetType,
    userId,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | (optional) defaults to undefined|
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

# **reportApiV1BehaviorReportPost**
> any reportApiV1BehaviorReportPost()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)
let reason: string; // (optional) (default to undefined)
let category: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.reportApiV1BehaviorReportPost(
    targetType,
    targetId,
    reason,
    category
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | defaults to undefined|
| **targetId** | [**number**] |  | defaults to undefined|
| **reason** | [**string**] |  | (optional) defaults to undefined|
| **category** | [**string**] |  | (optional) defaults to undefined|


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

# **reportApiV1BehaviorReportPost_0**
> any reportApiV1BehaviorReportPost_0()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)
let reason: string; // (optional) (default to undefined)
let category: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.reportApiV1BehaviorReportPost_0(
    targetType,
    targetId,
    reason,
    category
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | defaults to undefined|
| **targetId** | [**number**] |  | defaults to undefined|
| **reason** | [**string**] |  | (optional) defaults to undefined|
| **category** | [**string**] |  | (optional) defaults to undefined|


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

# **reportListApiV1BehaviorReportListGet**
> any reportListApiV1BehaviorReportListGet()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.reportListApiV1BehaviorReportListGet(
    page,
    limit,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **status** | [**number**] |  | (optional) defaults to undefined|


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

# **reportListApiV1BehaviorReportListGet_0**
> any reportListApiV1BehaviorReportListGet_0()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.reportListApiV1BehaviorReportListGet_0(
    page,
    limit,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **status** | [**number**] |  | (optional) defaults to undefined|


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

# **sensitiveListApiV1BehaviorSensitiveListGet**
> any sensitiveListApiV1BehaviorSensitiveListGet()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 50)
let category: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.sensitiveListApiV1BehaviorSensitiveListGet(
    page,
    limit,
    category
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 50|
| **category** | [**string**] |  | (optional) defaults to undefined|


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

# **sensitiveListApiV1BehaviorSensitiveListGet_0**
> any sensitiveListApiV1BehaviorSensitiveListGet_0()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 50)
let category: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.sensitiveListApiV1BehaviorSensitiveListGet_0(
    page,
    limit,
    category
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 50|
| **category** | [**string**] |  | (optional) defaults to undefined|


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

# **shareApiV1BehaviorSharePost**
> any shareApiV1BehaviorSharePost()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)
let platform: string; // (optional) (default to undefined)
let ip: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.shareApiV1BehaviorSharePost(
    targetType,
    targetId,
    platform,
    ip
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | defaults to undefined|
| **targetId** | [**number**] |  | defaults to undefined|
| **platform** | [**string**] |  | (optional) defaults to undefined|
| **ip** | [**string**] |  | (optional) defaults to undefined|


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

# **shareApiV1BehaviorSharePost_0**
> any shareApiV1BehaviorSharePost_0()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)
let platform: string; // (optional) (default to undefined)
let ip: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.shareApiV1BehaviorSharePost_0(
    targetType,
    targetId,
    platform,
    ip
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | defaults to undefined|
| **targetId** | [**number**] |  | defaults to undefined|
| **platform** | [**string**] |  | (optional) defaults to undefined|
| **ip** | [**string**] |  | (optional) defaults to undefined|


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

# **toggleFollowApiV1BehaviorFollowPost**
> any toggleFollowApiV1BehaviorFollowPost()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let targetUserId: string; // (default to undefined)

const { status, data } = await apiInstance.toggleFollowApiV1BehaviorFollowPost(
    targetUserId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetUserId** | [**string**] |  | defaults to undefined|


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

# **toggleFollowApiV1BehaviorFollowPost_0**
> any toggleFollowApiV1BehaviorFollowPost_0()


### Example

```typescript
import {
    BehaviorApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BehaviorApi(configuration);

let targetUserId: string; // (default to undefined)

const { status, data } = await apiInstance.toggleFollowApiV1BehaviorFollowPost_0(
    targetUserId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetUserId** | [**string**] |  | defaults to undefined|


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

