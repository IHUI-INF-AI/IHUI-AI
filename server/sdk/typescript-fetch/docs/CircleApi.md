# CircleApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addCommentApiV1CirclePostPidCommentPost**](CircleApi.md#addcommentapiv1circlepostpidcommentpost) | **POST** /api/v1/circle/post/{pid}/comment | 发表评论 |
| [**circleCategoryList**](CircleApi.md#circlecategorylist) | **GET** /api/v1/circle/category/list | 圈子分类列表 |
| [**createCircleApiV1CirclePost**](CircleApi.md#createcircleapiv1circlepost) | **POST** /api/v1/circle | 创建圈子 |
| [**createPostApiV1CirclePostPost**](CircleApi.md#createpostapiv1circlepostpost) | **POST** /api/v1/circle/post | 发布帖子 |
| [**deleteCircleApiV1CircleCidDelete**](CircleApi.md#deletecircleapiv1circleciddelete) | **DELETE** /api/v1/circle/{cid} | 删除圈子 |
| [**deletePostApiV1CirclePostPidDelete**](CircleApi.md#deletepostapiv1circlepostpiddelete) | **DELETE** /api/v1/circle/post/{pid} | 删除帖子 |
| [**getCircleApiV1CircleCidGet**](CircleApi.md#getcircleapiv1circlecidget) | **GET** /api/v1/circle/{cid} | 圈子详情 |
| [**getPostApiV1CirclePostPidGet**](CircleApi.md#getpostapiv1circlepostpidget) | **GET** /api/v1/circle/post/{pid} | 帖子详情 |
| [**joinCircleApiV1CircleCidJoinPost**](CircleApi.md#joincircleapiv1circlecidjoinpost) | **POST** /api/v1/circle/{cid}/join | 加入圈子 |
| [**listCirclesApiV1CircleListGet**](CircleApi.md#listcirclesapiv1circlelistget) | **GET** /api/v1/circle/list | 圈子列表 |
| [**listCommentsApiV1CirclePostPidCommentsGet**](CircleApi.md#listcommentsapiv1circlepostpidcommentsget) | **GET** /api/v1/circle/post/{pid}/comments | 评论列表 |
| [**listMembersApiV1CircleCidMembersGet**](CircleApi.md#listmembersapiv1circlecidmembersget) | **GET** /api/v1/circle/{cid}/members | 成员列表 |
| [**listPostsApiV1CirclePostListGet**](CircleApi.md#listpostsapiv1circlepostlistget) | **GET** /api/v1/circle/post/list | 帖子列表 |
| [**quitCircleApiV1CircleCidQuitPost**](CircleApi.md#quitcircleapiv1circlecidquitpost) | **POST** /api/v1/circle/{cid}/quit | 退出圈子 |
| [**toggleLikeApiV1CirclePostPidLikePost**](CircleApi.md#togglelikeapiv1circlepostpidlikepost) | **POST** /api/v1/circle/post/{pid}/like | 点赞/取消点赞 |
| [**updateCircleApiV1CircleCidPut**](CircleApi.md#updatecircleapiv1circlecidput) | **PUT** /api/v1/circle/{cid} | 修改圈子 |
| [**updatePostApiV1CirclePostPidPut**](CircleApi.md#updatepostapiv1circlepostpidput) | **PUT** /api/v1/circle/post/{pid} | 修改帖子 |



## addCommentApiV1CirclePostPidCommentPost

> any addCommentApiV1CirclePostPidCommentPost(pid, content, pid2, replyUserId, replyUserName)

发表评论

### Example

```ts
import {
  Configuration,
  CircleApi,
} from '';
import type { AddCommentApiV1CirclePostPidCommentPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleApi();

  const body = {
    // number
    pid: 56,
    // string
    content: content_example,
    // number (optional)
    pid2: 56,
    // string (optional)
    replyUserId: replyUserId_example,
    // string (optional)
    replyUserName: replyUserName_example,
  } satisfies AddCommentApiV1CirclePostPidCommentPostRequest;

  try {
    const data = await api.addCommentApiV1CirclePostPidCommentPost(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Defaults to `undefined`] |
| **pid2** | `number` |  | [Optional] [Defaults to `0`] |
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


## circleCategoryList

> any circleCategoryList()

圈子分类列表

### Example

```ts
import {
  Configuration,
  CircleApi,
} from '';
import type { CircleCategoryListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleApi();

  try {
    const data = await api.circleCategoryList();
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

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createCircleApiV1CirclePost

> any createCircleApiV1CirclePost(name, description, categoryId, avatar, cover)

创建圈子

### Example

```ts
import {
  Configuration,
  CircleApi,
} from '';
import type { CreateCircleApiV1CirclePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleApi();

  const body = {
    // string
    name: name_example,
    // string (optional)
    description: description_example,
    // number (optional)
    categoryId: 56,
    // string (optional)
    avatar: avatar_example,
    // string (optional)
    cover: cover_example,
  } satisfies CreateCircleApiV1CirclePostRequest;

  try {
    const data = await api.createCircleApiV1CirclePost(body);
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
| **name** | `string` |  | [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **categoryId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **avatar** | `string` |  | [Optional] [Defaults to `undefined`] |
| **cover** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## createPostApiV1CirclePostPost

> any createPostApiV1CirclePostPost(circleId, content, images, video)

发布帖子

### Example

```ts
import {
  Configuration,
  CircleApi,
} from '';
import type { CreatePostApiV1CirclePostPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleApi();

  const body = {
    // number
    circleId: 56,
    // string
    content: content_example,
    // string (optional)
    images: images_example,
    // string (optional)
    video: video_example,
  } satisfies CreatePostApiV1CirclePostPostRequest;

  try {
    const data = await api.createPostApiV1CirclePostPost(body);
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
| **circleId** | `number` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Defaults to `undefined`] |
| **images** | `string` |  | [Optional] [Defaults to `undefined`] |
| **video** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## deleteCircleApiV1CircleCidDelete

> any deleteCircleApiV1CircleCidDelete(cid)

删除圈子

### Example

```ts
import {
  Configuration,
  CircleApi,
} from '';
import type { DeleteCircleApiV1CircleCidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleApi();

  const body = {
    // number
    cid: 56,
  } satisfies DeleteCircleApiV1CircleCidDeleteRequest;

  try {
    const data = await api.deleteCircleApiV1CircleCidDelete(body);
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


## deletePostApiV1CirclePostPidDelete

> any deletePostApiV1CirclePostPidDelete(pid)

删除帖子

### Example

```ts
import {
  Configuration,
  CircleApi,
} from '';
import type { DeletePostApiV1CirclePostPidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleApi();

  const body = {
    // number
    pid: 56,
  } satisfies DeletePostApiV1CirclePostPidDeleteRequest;

  try {
    const data = await api.deletePostApiV1CirclePostPidDelete(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |

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


## getCircleApiV1CircleCidGet

> any getCircleApiV1CircleCidGet(cid)

圈子详情

### Example

```ts
import {
  Configuration,
  CircleApi,
} from '';
import type { GetCircleApiV1CircleCidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleApi();

  const body = {
    // number
    cid: 56,
  } satisfies GetCircleApiV1CircleCidGetRequest;

  try {
    const data = await api.getCircleApiV1CircleCidGet(body);
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


## getPostApiV1CirclePostPidGet

> any getPostApiV1CirclePostPidGet(pid)

帖子详情

### Example

```ts
import {
  Configuration,
  CircleApi,
} from '';
import type { GetPostApiV1CirclePostPidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleApi();

  const body = {
    // number
    pid: 56,
  } satisfies GetPostApiV1CirclePostPidGetRequest;

  try {
    const data = await api.getPostApiV1CirclePostPidGet(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |

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


## joinCircleApiV1CircleCidJoinPost

> any joinCircleApiV1CircleCidJoinPost(cid)

加入圈子

### Example

```ts
import {
  Configuration,
  CircleApi,
} from '';
import type { JoinCircleApiV1CircleCidJoinPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleApi();

  const body = {
    // number
    cid: 56,
  } satisfies JoinCircleApiV1CircleCidJoinPostRequest;

  try {
    const data = await api.joinCircleApiV1CircleCidJoinPost(body);
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


## listCirclesApiV1CircleListGet

> any listCirclesApiV1CircleListGet(page, limit, categoryId, keyword, isOfficial)

圈子列表

### Example

```ts
import {
  Configuration,
  CircleApi,
} from '';
import type { ListCirclesApiV1CircleListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    categoryId: 56,
    // string (optional)
    keyword: keyword_example,
    // boolean (optional)
    isOfficial: true,
  } satisfies ListCirclesApiV1CircleListGetRequest;

  try {
    const data = await api.listCirclesApiV1CircleListGet(body);
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
| **categoryId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **keyword** | `string` |  | [Optional] [Defaults to `undefined`] |
| **isOfficial** | `boolean` |  | [Optional] [Defaults to `undefined`] |

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


## listCommentsApiV1CirclePostPidCommentsGet

> any listCommentsApiV1CirclePostPidCommentsGet(pid, page, limit)

评论列表

### Example

```ts
import {
  Configuration,
  CircleApi,
} from '';
import type { ListCommentsApiV1CirclePostPidCommentsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleApi();

  const body = {
    // number
    pid: 56,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListCommentsApiV1CirclePostPidCommentsGetRequest;

  try {
    const data = await api.listCommentsApiV1CirclePostPidCommentsGet(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |
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


## listMembersApiV1CircleCidMembersGet

> any listMembersApiV1CircleCidMembersGet(cid, page, limit)

成员列表

### Example

```ts
import {
  Configuration,
  CircleApi,
} from '';
import type { ListMembersApiV1CircleCidMembersGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleApi();

  const body = {
    // number
    cid: 56,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListMembersApiV1CircleCidMembersGetRequest;

  try {
    const data = await api.listMembersApiV1CircleCidMembersGet(body);
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


## listPostsApiV1CirclePostListGet

> any listPostsApiV1CirclePostListGet(page, limit, circleId, userId, keyword, orderBy)

帖子列表

### Example

```ts
import {
  Configuration,
  CircleApi,
} from '';
import type { ListPostsApiV1CirclePostListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    circleId: 56,
    // string (optional)
    userId: userId_example,
    // string (optional)
    keyword: keyword_example,
    // string (optional)
    orderBy: orderBy_example,
  } satisfies ListPostsApiV1CirclePostListGetRequest;

  try {
    const data = await api.listPostsApiV1CirclePostListGet(body);
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
| **circleId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **keyword** | `string` |  | [Optional] [Defaults to `undefined`] |
| **orderBy** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## quitCircleApiV1CircleCidQuitPost

> any quitCircleApiV1CircleCidQuitPost(cid)

退出圈子

### Example

```ts
import {
  Configuration,
  CircleApi,
} from '';
import type { QuitCircleApiV1CircleCidQuitPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleApi();

  const body = {
    // number
    cid: 56,
  } satisfies QuitCircleApiV1CircleCidQuitPostRequest;

  try {
    const data = await api.quitCircleApiV1CircleCidQuitPost(body);
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


## toggleLikeApiV1CirclePostPidLikePost

> any toggleLikeApiV1CirclePostPidLikePost(pid)

点赞/取消点赞

### Example

```ts
import {
  Configuration,
  CircleApi,
} from '';
import type { ToggleLikeApiV1CirclePostPidLikePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleApi();

  const body = {
    // number
    pid: 56,
  } satisfies ToggleLikeApiV1CirclePostPidLikePostRequest;

  try {
    const data = await api.toggleLikeApiV1CirclePostPidLikePost(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |

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


## updateCircleApiV1CircleCidPut

> any updateCircleApiV1CircleCidPut(cid, name, description, avatar, cover)

修改圈子

### Example

```ts
import {
  Configuration,
  CircleApi,
} from '';
import type { UpdateCircleApiV1CircleCidPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleApi();

  const body = {
    // number
    cid: 56,
    // string (optional)
    name: name_example,
    // string (optional)
    description: description_example,
    // string (optional)
    avatar: avatar_example,
    // string (optional)
    cover: cover_example,
  } satisfies UpdateCircleApiV1CircleCidPutRequest;

  try {
    const data = await api.updateCircleApiV1CircleCidPut(body);
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
| **name** | `string` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **avatar** | `string` |  | [Optional] [Defaults to `undefined`] |
| **cover** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## updatePostApiV1CirclePostPidPut

> any updatePostApiV1CirclePostPidPut(pid, content, images, video)

修改帖子

### Example

```ts
import {
  Configuration,
  CircleApi,
} from '';
import type { UpdatePostApiV1CirclePostPidPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleApi();

  const body = {
    // number
    pid: 56,
    // string (optional)
    content: content_example,
    // string (optional)
    images: images_example,
    // string (optional)
    video: video_example,
  } satisfies UpdatePostApiV1CirclePostPidPutRequest;

  try {
    const data = await api.updatePostApiV1CirclePostPidPut(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Optional] [Defaults to `undefined`] |
| **images** | `string` |  | [Optional] [Defaults to `undefined`] |
| **video** | `string` |  | [Optional] [Defaults to `undefined`] |

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

