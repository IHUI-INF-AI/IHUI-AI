# CircleApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**addCommentApiV1CirclePostPidCommentPost**](#addcommentapiv1circlepostpidcommentpost) | **POST** /api/v1/circle/post/{pid}/comment | 发表评论|
|[**circleCategoryList**](#circlecategorylist) | **GET** /api/v1/circle/category/list | 圈子分类列表|
|[**createCircleApiV1CirclePost**](#createcircleapiv1circlepost) | **POST** /api/v1/circle | 创建圈子|
|[**createPostApiV1CirclePostPost**](#createpostapiv1circlepostpost) | **POST** /api/v1/circle/post | 发布帖子|
|[**deleteCircleApiV1CircleCidDelete**](#deletecircleapiv1circleciddelete) | **DELETE** /api/v1/circle/{cid} | 删除圈子|
|[**deletePostApiV1CirclePostPidDelete**](#deletepostapiv1circlepostpiddelete) | **DELETE** /api/v1/circle/post/{pid} | 删除帖子|
|[**getCircleApiV1CircleCidGet**](#getcircleapiv1circlecidget) | **GET** /api/v1/circle/{cid} | 圈子详情|
|[**getPostApiV1CirclePostPidGet**](#getpostapiv1circlepostpidget) | **GET** /api/v1/circle/post/{pid} | 帖子详情|
|[**joinCircleApiV1CircleCidJoinPost**](#joincircleapiv1circlecidjoinpost) | **POST** /api/v1/circle/{cid}/join | 加入圈子|
|[**listCirclesApiV1CircleListGet**](#listcirclesapiv1circlelistget) | **GET** /api/v1/circle/list | 圈子列表|
|[**listCommentsApiV1CirclePostPidCommentsGet**](#listcommentsapiv1circlepostpidcommentsget) | **GET** /api/v1/circle/post/{pid}/comments | 评论列表|
|[**listMembersApiV1CircleCidMembersGet**](#listmembersapiv1circlecidmembersget) | **GET** /api/v1/circle/{cid}/members | 成员列表|
|[**listPostsApiV1CirclePostListGet**](#listpostsapiv1circlepostlistget) | **GET** /api/v1/circle/post/list | 帖子列表|
|[**quitCircleApiV1CircleCidQuitPost**](#quitcircleapiv1circlecidquitpost) | **POST** /api/v1/circle/{cid}/quit | 退出圈子|
|[**toggleLikeApiV1CirclePostPidLikePost**](#togglelikeapiv1circlepostpidlikepost) | **POST** /api/v1/circle/post/{pid}/like | 点赞/取消点赞|
|[**updateCircleApiV1CircleCidPut**](#updatecircleapiv1circlecidput) | **PUT** /api/v1/circle/{cid} | 修改圈子|
|[**updatePostApiV1CirclePostPidPut**](#updatepostapiv1circlepostpidput) | **PUT** /api/v1/circle/post/{pid} | 修改帖子|

# **addCommentApiV1CirclePostPidCommentPost**
> any addCommentApiV1CirclePostPidCommentPost()


### Example

```typescript
import {
    CircleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CircleApi(configuration);

let pid: number; // (default to undefined)
let content: string; // (default to undefined)
let pid2: number; // (optional) (default to 0)
let replyUserId: string; // (optional) (default to undefined)
let replyUserName: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.addCommentApiV1CirclePostPidCommentPost(
    pid,
    content,
    pid2,
    replyUserId,
    replyUserName
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **pid2** | [**number**] |  | (optional) defaults to 0|
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

# **circleCategoryList**
> any circleCategoryList()


### Example

```typescript
import {
    CircleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CircleApi(configuration);

const { status, data } = await apiInstance.circleCategoryList();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createCircleApiV1CirclePost**
> any createCircleApiV1CirclePost()


### Example

```typescript
import {
    CircleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CircleApi(configuration);

let name: string; // (default to undefined)
let description: string; // (optional) (default to undefined)
let categoryId: number; // (optional) (default to undefined)
let avatar: string; // (optional) (default to undefined)
let cover: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createCircleApiV1CirclePost(
    name,
    description,
    categoryId,
    avatar,
    cover
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **categoryId** | [**number**] |  | (optional) defaults to undefined|
| **avatar** | [**string**] |  | (optional) defaults to undefined|
| **cover** | [**string**] |  | (optional) defaults to undefined|


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

# **createPostApiV1CirclePostPost**
> any createPostApiV1CirclePostPost()


### Example

```typescript
import {
    CircleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CircleApi(configuration);

let circleId: number; // (default to undefined)
let content: string; // (default to undefined)
let images: string; // (optional) (default to undefined)
let video: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createPostApiV1CirclePostPost(
    circleId,
    content,
    images,
    video
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **circleId** | [**number**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **images** | [**string**] |  | (optional) defaults to undefined|
| **video** | [**string**] |  | (optional) defaults to undefined|


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

# **deleteCircleApiV1CircleCidDelete**
> any deleteCircleApiV1CircleCidDelete()


### Example

```typescript
import {
    CircleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CircleApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteCircleApiV1CircleCidDelete(
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

# **deletePostApiV1CirclePostPidDelete**
> any deletePostApiV1CirclePostPidDelete()


### Example

```typescript
import {
    CircleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CircleApi(configuration);

let pid: number; // (default to undefined)

const { status, data } = await apiInstance.deletePostApiV1CirclePostPidDelete(
    pid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|


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

# **getCircleApiV1CircleCidGet**
> any getCircleApiV1CircleCidGet()


### Example

```typescript
import {
    CircleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CircleApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.getCircleApiV1CircleCidGet(
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

# **getPostApiV1CirclePostPidGet**
> any getPostApiV1CirclePostPidGet()


### Example

```typescript
import {
    CircleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CircleApi(configuration);

let pid: number; // (default to undefined)

const { status, data } = await apiInstance.getPostApiV1CirclePostPidGet(
    pid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|


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

# **joinCircleApiV1CircleCidJoinPost**
> any joinCircleApiV1CircleCidJoinPost()


### Example

```typescript
import {
    CircleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CircleApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.joinCircleApiV1CircleCidJoinPost(
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

# **listCirclesApiV1CircleListGet**
> any listCirclesApiV1CircleListGet()


### Example

```typescript
import {
    CircleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CircleApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let categoryId: number; // (optional) (default to undefined)
let keyword: string; // (optional) (default to undefined)
let isOfficial: boolean; // (optional) (default to undefined)

const { status, data } = await apiInstance.listCirclesApiV1CircleListGet(
    page,
    limit,
    categoryId,
    keyword,
    isOfficial
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **categoryId** | [**number**] |  | (optional) defaults to undefined|
| **keyword** | [**string**] |  | (optional) defaults to undefined|
| **isOfficial** | [**boolean**] |  | (optional) defaults to undefined|


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

# **listCommentsApiV1CirclePostPidCommentsGet**
> any listCommentsApiV1CirclePostPidCommentsGet()


### Example

```typescript
import {
    CircleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CircleApi(configuration);

let pid: number; // (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listCommentsApiV1CirclePostPidCommentsGet(
    pid,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|
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

# **listMembersApiV1CircleCidMembersGet**
> any listMembersApiV1CircleCidMembersGet()


### Example

```typescript
import {
    CircleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CircleApi(configuration);

let cid: number; // (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listMembersApiV1CircleCidMembersGet(
    cid,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **cid** | [**number**] |  | defaults to undefined|
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

# **listPostsApiV1CirclePostListGet**
> any listPostsApiV1CirclePostListGet()


### Example

```typescript
import {
    CircleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CircleApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let circleId: number; // (optional) (default to undefined)
let userId: string; // (optional) (default to undefined)
let keyword: string; // (optional) (default to undefined)
let orderBy: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listPostsApiV1CirclePostListGet(
    page,
    limit,
    circleId,
    userId,
    keyword,
    orderBy
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **circleId** | [**number**] |  | (optional) defaults to undefined|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **keyword** | [**string**] |  | (optional) defaults to undefined|
| **orderBy** | [**string**] |  | (optional) defaults to undefined|


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

# **quitCircleApiV1CircleCidQuitPost**
> any quitCircleApiV1CircleCidQuitPost()


### Example

```typescript
import {
    CircleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CircleApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.quitCircleApiV1CircleCidQuitPost(
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

# **toggleLikeApiV1CirclePostPidLikePost**
> any toggleLikeApiV1CirclePostPidLikePost()


### Example

```typescript
import {
    CircleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CircleApi(configuration);

let pid: number; // (default to undefined)

const { status, data } = await apiInstance.toggleLikeApiV1CirclePostPidLikePost(
    pid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|


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

# **updateCircleApiV1CircleCidPut**
> any updateCircleApiV1CircleCidPut()


### Example

```typescript
import {
    CircleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CircleApi(configuration);

let cid: number; // (default to undefined)
let name: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)
let avatar: string; // (optional) (default to undefined)
let cover: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateCircleApiV1CircleCidPut(
    cid,
    name,
    description,
    avatar,
    cover
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **cid** | [**number**] |  | defaults to undefined|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **avatar** | [**string**] |  | (optional) defaults to undefined|
| **cover** | [**string**] |  | (optional) defaults to undefined|


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

# **updatePostApiV1CirclePostPidPut**
> any updatePostApiV1CirclePostPidPut()


### Example

```typescript
import {
    CircleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CircleApi(configuration);

let pid: number; // (default to undefined)
let content: string; // (optional) (default to undefined)
let images: string; // (optional) (default to undefined)
let video: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.updatePostApiV1CirclePostPidPut(
    pid,
    content,
    images,
    video
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|
| **content** | [**string**] |  | (optional) defaults to undefined|
| **images** | [**string**] |  | (optional) defaults to undefined|
| **video** | [**string**] |  | (optional) defaults to undefined|


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

