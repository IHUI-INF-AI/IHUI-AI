# CirclePostApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addCommentApiV1CirclePostPidCommentPost**](CirclePostApi.md#addcommentapiv1circlepostpidcommentpost) | **POST** /api/v1/circle/post/{pid}/comment | 发表评论 |
| [**createPostApiV1CirclePostPost**](CirclePostApi.md#createpostapiv1circlepostpost) | **POST** /api/v1/circle/post | 发布帖子 |
| [**deletePostApiV1CirclePostPidDelete**](CirclePostApi.md#deletepostapiv1circlepostpiddelete) | **DELETE** /api/v1/circle/post/{pid} | 删除帖子 |
| [**getPostApiV1CirclePostPidGet**](CirclePostApi.md#getpostapiv1circlepostpidget) | **GET** /api/v1/circle/post/{pid} | 帖子详情 |
| [**listCommentsApiV1CirclePostPidCommentsGet**](CirclePostApi.md#listcommentsapiv1circlepostpidcommentsget) | **GET** /api/v1/circle/post/{pid}/comments | 评论列表 |
| [**listPostsApiV1CirclePostListGet**](CirclePostApi.md#listpostsapiv1circlepostlistget) | **GET** /api/v1/circle/post/list | 帖子列表 |
| [**toggleLikeApiV1CirclePostPidLikePost**](CirclePostApi.md#togglelikeapiv1circlepostpidlikepost) | **POST** /api/v1/circle/post/{pid}/like | 点赞/取消点赞 |
| [**updatePostApiV1CirclePostPidPut**](CirclePostApi.md#updatepostapiv1circlepostpidput) | **PUT** /api/v1/circle/post/{pid} | 修改帖子 |



## addCommentApiV1CirclePostPidCommentPost

> any addCommentApiV1CirclePostPidCommentPost(pid, content, pid2, replyUserId, replyUserName)

发表评论

### Example

```ts
import {
  Configuration,
  CirclePostApi,
} from '';
import type { AddCommentApiV1CirclePostPidCommentPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CirclePostApi();

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


## createPostApiV1CirclePostPost

> any createPostApiV1CirclePostPost(circleId, content, images, video)

发布帖子

### Example

```ts
import {
  Configuration,
  CirclePostApi,
} from '';
import type { CreatePostApiV1CirclePostPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CirclePostApi();

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


## deletePostApiV1CirclePostPidDelete

> any deletePostApiV1CirclePostPidDelete(pid)

删除帖子

### Example

```ts
import {
  Configuration,
  CirclePostApi,
} from '';
import type { DeletePostApiV1CirclePostPidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CirclePostApi();

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


## getPostApiV1CirclePostPidGet

> any getPostApiV1CirclePostPidGet(pid)

帖子详情

### Example

```ts
import {
  Configuration,
  CirclePostApi,
} from '';
import type { GetPostApiV1CirclePostPidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CirclePostApi();

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


## listCommentsApiV1CirclePostPidCommentsGet

> any listCommentsApiV1CirclePostPidCommentsGet(pid, page, limit)

评论列表

### Example

```ts
import {
  Configuration,
  CirclePostApi,
} from '';
import type { ListCommentsApiV1CirclePostPidCommentsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CirclePostApi();

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


## listPostsApiV1CirclePostListGet

> any listPostsApiV1CirclePostListGet(page, limit, circleId, userId, keyword, orderBy)

帖子列表

### Example

```ts
import {
  Configuration,
  CirclePostApi,
} from '';
import type { ListPostsApiV1CirclePostListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CirclePostApi();

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


## toggleLikeApiV1CirclePostPidLikePost

> any toggleLikeApiV1CirclePostPidLikePost(pid)

点赞/取消点赞

### Example

```ts
import {
  Configuration,
  CirclePostApi,
} from '';
import type { ToggleLikeApiV1CirclePostPidLikePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CirclePostApi();

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


## updatePostApiV1CirclePostPidPut

> any updatePostApiV1CirclePostPidPut(pid, content, images, video)

修改帖子

### Example

```ts
import {
  Configuration,
  CirclePostApi,
} from '';
import type { UpdatePostApiV1CirclePostPidPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CirclePostApi();

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

