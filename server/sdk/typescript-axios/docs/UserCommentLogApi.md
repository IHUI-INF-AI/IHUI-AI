# UserCommentLogApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**recordLogApiV1UserCommentLogRecordPost**](#recordlogapiv1usercommentlogrecordpost) | **POST** /api/v1/user-comment-log/record | 记录评论日志|
|[**recordLogApiV1UserCommentLogRecordPost_0**](#recordlogapiv1usercommentlogrecordpost_0) | **POST** /api/v1/user-comment-log/record | 记录评论日志|
|[**userCommentLogList**](#usercommentloglist) | **GET** /api/v1/user-comment-log/list | 评论日志|
|[**userCommentLogList_0**](#usercommentloglist_0) | **GET** /api/v1/user-comment-log/list | 评论日志|

# **recordLogApiV1UserCommentLogRecordPost**
> any recordLogApiV1UserCommentLogRecordPost()


### Example

```typescript
import {
    UserCommentLogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserCommentLogApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)
let commentId: number; // (default to undefined)
let content: string; // (default to undefined)
let action: string; // (optional) (default to 'add')
let ip: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.recordLogApiV1UserCommentLogRecordPost(
    targetType,
    targetId,
    commentId,
    content,
    action,
    ip
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | defaults to undefined|
| **targetId** | [**number**] |  | defaults to undefined|
| **commentId** | [**number**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **action** | [**string**] |  | (optional) defaults to 'add'|
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

# **recordLogApiV1UserCommentLogRecordPost_0**
> any recordLogApiV1UserCommentLogRecordPost_0()


### Example

```typescript
import {
    UserCommentLogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserCommentLogApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)
let commentId: number; // (default to undefined)
let content: string; // (default to undefined)
let action: string; // (optional) (default to 'add')
let ip: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.recordLogApiV1UserCommentLogRecordPost_0(
    targetType,
    targetId,
    commentId,
    content,
    action,
    ip
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | defaults to undefined|
| **targetId** | [**number**] |  | defaults to undefined|
| **commentId** | [**number**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **action** | [**string**] |  | (optional) defaults to 'add'|
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

# **userCommentLogList**
> any userCommentLogList()


### Example

```typescript
import {
    UserCommentLogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserCommentLogApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let userId: string; // (optional) (default to undefined)
let targetType: string; // (optional) (default to undefined)
let action: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.userCommentLogList(
    page,
    limit,
    userId,
    targetType,
    action
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **targetType** | [**string**] |  | (optional) defaults to undefined|
| **action** | [**string**] |  | (optional) defaults to undefined|


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

# **userCommentLogList_0**
> any userCommentLogList_0()


### Example

```typescript
import {
    UserCommentLogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserCommentLogApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let userId: string; // (optional) (default to undefined)
let targetType: string; // (optional) (default to undefined)
let action: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.userCommentLogList_0(
    page,
    limit,
    userId,
    targetType,
    action
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **targetType** | [**string**] |  | (optional) defaults to undefined|
| **action** | [**string**] |  | (optional) defaults to undefined|


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

