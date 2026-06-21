# UserVideoCommentApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addCommentApiV1UserVideoCommentPost**](UserVideoCommentApi.md#addcommentapiv1uservideocommentpost) | **POST** /api/v1/user-video-comment | 发表视频评论 |
| [**addCommentApiV1UserVideoCommentPost_0**](UserVideoCommentApi.md#addcommentapiv1uservideocommentpost_0) | **POST** /api/v1/user-video-comment | 发表视频评论 |
| [**deleteCommentApiV1UserVideoCommentCidDelete**](UserVideoCommentApi.md#deletecommentapiv1uservideocommentciddelete) | **DELETE** /api/v1/user-video-comment/{cid} | 删除视频评论 |
| [**deleteCommentApiV1UserVideoCommentCidDelete_0**](UserVideoCommentApi.md#deletecommentapiv1uservideocommentciddelete_0) | **DELETE** /api/v1/user-video-comment/{cid} | 删除视频评论 |
| [**listCommentsApiV1UserVideoCommentListGet**](UserVideoCommentApi.md#listcommentsapiv1uservideocommentlistget) | **GET** /api/v1/user-video-comment/list | 视频评论列表 |
| [**listCommentsApiV1UserVideoCommentListGet_0**](UserVideoCommentApi.md#listcommentsapiv1uservideocommentlistget_0) | **GET** /api/v1/user-video-comment/list | 视频评论列表 |



## addCommentApiV1UserVideoCommentPost

> any addCommentApiV1UserVideoCommentPost(videoId, content, pid, replyUserId, replyUserName)

发表视频评论

### Example

```ts
import {
  Configuration,
  UserVideoCommentApi,
} from '';
import type { AddCommentApiV1UserVideoCommentPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserVideoCommentApi();

  const body = {
    // number
    videoId: 56,
    // string
    content: content_example,
    // number (optional)
    pid: 56,
    // string (optional)
    replyUserId: replyUserId_example,
    // string (optional)
    replyUserName: replyUserName_example,
  } satisfies AddCommentApiV1UserVideoCommentPostRequest;

  try {
    const data = await api.addCommentApiV1UserVideoCommentPost(body);
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


## addCommentApiV1UserVideoCommentPost_0

> any addCommentApiV1UserVideoCommentPost_0(videoId, content, pid, replyUserId, replyUserName)

发表视频评论

### Example

```ts
import {
  Configuration,
  UserVideoCommentApi,
} from '';
import type { AddCommentApiV1UserVideoCommentPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserVideoCommentApi();

  const body = {
    // number
    videoId: 56,
    // string
    content: content_example,
    // number (optional)
    pid: 56,
    // string (optional)
    replyUserId: replyUserId_example,
    // string (optional)
    replyUserName: replyUserName_example,
  } satisfies AddCommentApiV1UserVideoCommentPost0Request;

  try {
    const data = await api.addCommentApiV1UserVideoCommentPost_0(body);
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


## deleteCommentApiV1UserVideoCommentCidDelete

> any deleteCommentApiV1UserVideoCommentCidDelete(cid)

删除视频评论

### Example

```ts
import {
  Configuration,
  UserVideoCommentApi,
} from '';
import type { DeleteCommentApiV1UserVideoCommentCidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserVideoCommentApi();

  const body = {
    // number
    cid: 56,
  } satisfies DeleteCommentApiV1UserVideoCommentCidDeleteRequest;

  try {
    const data = await api.deleteCommentApiV1UserVideoCommentCidDelete(body);
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


## deleteCommentApiV1UserVideoCommentCidDelete_0

> any deleteCommentApiV1UserVideoCommentCidDelete_0(cid)

删除视频评论

### Example

```ts
import {
  Configuration,
  UserVideoCommentApi,
} from '';
import type { DeleteCommentApiV1UserVideoCommentCidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserVideoCommentApi();

  const body = {
    // number
    cid: 56,
  } satisfies DeleteCommentApiV1UserVideoCommentCidDelete0Request;

  try {
    const data = await api.deleteCommentApiV1UserVideoCommentCidDelete_0(body);
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


## listCommentsApiV1UserVideoCommentListGet

> any listCommentsApiV1UserVideoCommentListGet(videoId, page, limit)

视频评论列表

### Example

```ts
import {
  Configuration,
  UserVideoCommentApi,
} from '';
import type { ListCommentsApiV1UserVideoCommentListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserVideoCommentApi();

  const body = {
    // number
    videoId: 56,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListCommentsApiV1UserVideoCommentListGetRequest;

  try {
    const data = await api.listCommentsApiV1UserVideoCommentListGet(body);
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


## listCommentsApiV1UserVideoCommentListGet_0

> any listCommentsApiV1UserVideoCommentListGet_0(videoId, page, limit)

视频评论列表

### Example

```ts
import {
  Configuration,
  UserVideoCommentApi,
} from '';
import type { ListCommentsApiV1UserVideoCommentListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserVideoCommentApi();

  const body = {
    // number
    videoId: 56,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListCommentsApiV1UserVideoCommentListGet0Request;

  try {
    const data = await api.listCommentsApiV1UserVideoCommentListGet_0(body);
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

