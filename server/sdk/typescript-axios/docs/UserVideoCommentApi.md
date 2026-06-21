# UserVideoCommentApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**addCommentApiV1UserVideoCommentPost**](#addcommentapiv1uservideocommentpost) | **POST** /api/v1/user-video-comment | 发表视频评论|
|[**addCommentApiV1UserVideoCommentPost_0**](#addcommentapiv1uservideocommentpost_0) | **POST** /api/v1/user-video-comment | 发表视频评论|
|[**deleteCommentApiV1UserVideoCommentCidDelete**](#deletecommentapiv1uservideocommentciddelete) | **DELETE** /api/v1/user-video-comment/{cid} | 删除视频评论|
|[**deleteCommentApiV1UserVideoCommentCidDelete_0**](#deletecommentapiv1uservideocommentciddelete_0) | **DELETE** /api/v1/user-video-comment/{cid} | 删除视频评论|
|[**listCommentsApiV1UserVideoCommentListGet**](#listcommentsapiv1uservideocommentlistget) | **GET** /api/v1/user-video-comment/list | 视频评论列表|
|[**listCommentsApiV1UserVideoCommentListGet_0**](#listcommentsapiv1uservideocommentlistget_0) | **GET** /api/v1/user-video-comment/list | 视频评论列表|

# **addCommentApiV1UserVideoCommentPost**
> any addCommentApiV1UserVideoCommentPost()


### Example

```typescript
import {
    UserVideoCommentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserVideoCommentApi(configuration);

let videoId: number; // (default to undefined)
let content: string; // (default to undefined)
let pid: number; // (optional) (default to 0)
let replyUserId: string; // (optional) (default to undefined)
let replyUserName: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.addCommentApiV1UserVideoCommentPost(
    videoId,
    content,
    pid,
    replyUserId,
    replyUserName
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoId** | [**number**] |  | defaults to undefined|
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

# **addCommentApiV1UserVideoCommentPost_0**
> any addCommentApiV1UserVideoCommentPost_0()


### Example

```typescript
import {
    UserVideoCommentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserVideoCommentApi(configuration);

let videoId: number; // (default to undefined)
let content: string; // (default to undefined)
let pid: number; // (optional) (default to 0)
let replyUserId: string; // (optional) (default to undefined)
let replyUserName: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.addCommentApiV1UserVideoCommentPost_0(
    videoId,
    content,
    pid,
    replyUserId,
    replyUserName
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoId** | [**number**] |  | defaults to undefined|
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

# **deleteCommentApiV1UserVideoCommentCidDelete**
> any deleteCommentApiV1UserVideoCommentCidDelete()


### Example

```typescript
import {
    UserVideoCommentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserVideoCommentApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteCommentApiV1UserVideoCommentCidDelete(
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

# **deleteCommentApiV1UserVideoCommentCidDelete_0**
> any deleteCommentApiV1UserVideoCommentCidDelete_0()


### Example

```typescript
import {
    UserVideoCommentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserVideoCommentApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteCommentApiV1UserVideoCommentCidDelete_0(
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

# **listCommentsApiV1UserVideoCommentListGet**
> any listCommentsApiV1UserVideoCommentListGet()


### Example

```typescript
import {
    UserVideoCommentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserVideoCommentApi(configuration);

let videoId: number; // (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listCommentsApiV1UserVideoCommentListGet(
    videoId,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoId** | [**number**] |  | defaults to undefined|
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

# **listCommentsApiV1UserVideoCommentListGet_0**
> any listCommentsApiV1UserVideoCommentListGet_0()


### Example

```typescript
import {
    UserVideoCommentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserVideoCommentApi(configuration);

let videoId: number; // (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listCommentsApiV1UserVideoCommentListGet_0(
    videoId,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **videoId** | [**number**] |  | defaults to undefined|
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

