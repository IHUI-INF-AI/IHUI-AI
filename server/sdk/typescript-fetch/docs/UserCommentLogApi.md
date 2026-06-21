# UserCommentLogApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**recordLogApiV1UserCommentLogRecordPost**](UserCommentLogApi.md#recordlogapiv1usercommentlogrecordpost) | **POST** /api/v1/user-comment-log/record | 记录评论日志 |
| [**recordLogApiV1UserCommentLogRecordPost_0**](UserCommentLogApi.md#recordlogapiv1usercommentlogrecordpost_0) | **POST** /api/v1/user-comment-log/record | 记录评论日志 |
| [**userCommentLogList**](UserCommentLogApi.md#usercommentloglist) | **GET** /api/v1/user-comment-log/list | 评论日志 |
| [**userCommentLogList_0**](UserCommentLogApi.md#usercommentloglist_0) | **GET** /api/v1/user-comment-log/list | 评论日志 |



## recordLogApiV1UserCommentLogRecordPost

> any recordLogApiV1UserCommentLogRecordPost(targetType, targetId, commentId, content, action, ip)

记录评论日志

### Example

```ts
import {
  Configuration,
  UserCommentLogApi,
} from '';
import type { RecordLogApiV1UserCommentLogRecordPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserCommentLogApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
    // number
    commentId: 56,
    // string
    content: content_example,
    // string (optional)
    action: action_example,
    // string (optional)
    ip: ip_example,
  } satisfies RecordLogApiV1UserCommentLogRecordPostRequest;

  try {
    const data = await api.recordLogApiV1UserCommentLogRecordPost(body);
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
| **commentId** | `number` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Defaults to `undefined`] |
| **action** | `string` |  | [Optional] [Defaults to `&#39;add&#39;`] |
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


## recordLogApiV1UserCommentLogRecordPost_0

> any recordLogApiV1UserCommentLogRecordPost_0(targetType, targetId, commentId, content, action, ip)

记录评论日志

### Example

```ts
import {
  Configuration,
  UserCommentLogApi,
} from '';
import type { RecordLogApiV1UserCommentLogRecordPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserCommentLogApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
    // number
    commentId: 56,
    // string
    content: content_example,
    // string (optional)
    action: action_example,
    // string (optional)
    ip: ip_example,
  } satisfies RecordLogApiV1UserCommentLogRecordPost0Request;

  try {
    const data = await api.recordLogApiV1UserCommentLogRecordPost_0(body);
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
| **commentId** | `number` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Defaults to `undefined`] |
| **action** | `string` |  | [Optional] [Defaults to `&#39;add&#39;`] |
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


## userCommentLogList

> any userCommentLogList(page, limit, userId, targetType, action)

评论日志

### Example

```ts
import {
  Configuration,
  UserCommentLogApi,
} from '';
import type { UserCommentLogListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserCommentLogApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    userId: userId_example,
    // string (optional)
    targetType: targetType_example,
    // string (optional)
    action: action_example,
  } satisfies UserCommentLogListRequest;

  try {
    const data = await api.userCommentLogList(body);
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
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **targetType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **action** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## userCommentLogList_0

> any userCommentLogList_0(page, limit, userId, targetType, action)

评论日志

### Example

```ts
import {
  Configuration,
  UserCommentLogApi,
} from '';
import type { UserCommentLogList0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserCommentLogApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    userId: userId_example,
    // string (optional)
    targetType: targetType_example,
    // string (optional)
    action: action_example,
  } satisfies UserCommentLogList0Request;

  try {
    const data = await api.userCommentLogList_0(body);
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
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **targetType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **action** | `string` |  | [Optional] [Defaults to `undefined`] |

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

