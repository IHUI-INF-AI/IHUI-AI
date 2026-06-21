# FeedbackApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**deleteFeedbackApiV1FeedbackFidDelete**](#deletefeedbackapiv1feedbackfiddelete) | **DELETE** /api/v1/feedback/{fid} | 删除反馈|
|[**deleteFeedbackApiV1FeedbackFidDelete_0**](#deletefeedbackapiv1feedbackfiddelete_0) | **DELETE** /api/v1/feedback/{fid} | 删除反馈|
|[**feedbackAdminList**](#feedbackadminlist) | **GET** /api/v1/feedback/admin/list | 反馈列表(管理员)|
|[**feedbackAdminList_0**](#feedbackadminlist_0) | **GET** /api/v1/feedback/admin/list | 反馈列表(管理员)|
|[**getFeedbackApiV1FeedbackFidGet**](#getfeedbackapiv1feedbackfidget) | **GET** /api/v1/feedback/{fid} | 反馈详情|
|[**getFeedbackApiV1FeedbackFidGet_0**](#getfeedbackapiv1feedbackfidget_0) | **GET** /api/v1/feedback/{fid} | 反馈详情|
|[**handleFeedbackApiV1FeedbackFidHandlePut**](#handlefeedbackapiv1feedbackfidhandleput) | **PUT** /api/v1/feedback/{fid}/handle | 处理反馈|
|[**handleFeedbackApiV1FeedbackFidHandlePut_0**](#handlefeedbackapiv1feedbackfidhandleput_0) | **PUT** /api/v1/feedback/{fid}/handle | 处理反馈|
|[**listMyFeedbacksApiV1FeedbackListGet**](#listmyfeedbacksapiv1feedbacklistget) | **GET** /api/v1/feedback/list | 我的反馈|
|[**listMyFeedbacksApiV1FeedbackListGet_0**](#listmyfeedbacksapiv1feedbacklistget_0) | **GET** /api/v1/feedback/list | 我的反馈|
|[**rateFeedbackApiV1FeedbackFidRatePost**](#ratefeedbackapiv1feedbackfidratepost) | **POST** /api/v1/feedback/{fid}/rate | 评价反馈|
|[**rateFeedbackApiV1FeedbackFidRatePost_0**](#ratefeedbackapiv1feedbackfidratepost_0) | **POST** /api/v1/feedback/{fid}/rate | 评价反馈|
|[**submitFeedbackApiV1FeedbackPost**](#submitfeedbackapiv1feedbackpost) | **POST** /api/v1/feedback | 提交反馈|
|[**submitFeedbackApiV1FeedbackPost_0**](#submitfeedbackapiv1feedbackpost_0) | **POST** /api/v1/feedback | 提交反馈|

# **deleteFeedbackApiV1FeedbackFidDelete**
> any deleteFeedbackApiV1FeedbackFidDelete()


### Example

```typescript
import {
    FeedbackApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FeedbackApi(configuration);

let fid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteFeedbackApiV1FeedbackFidDelete(
    fid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fid** | [**number**] |  | defaults to undefined|


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

# **deleteFeedbackApiV1FeedbackFidDelete_0**
> any deleteFeedbackApiV1FeedbackFidDelete_0()


### Example

```typescript
import {
    FeedbackApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FeedbackApi(configuration);

let fid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteFeedbackApiV1FeedbackFidDelete_0(
    fid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fid** | [**number**] |  | defaults to undefined|


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

# **feedbackAdminList**
> any feedbackAdminList()


### Example

```typescript
import {
    FeedbackApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FeedbackApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; // (optional) (default to undefined)
let type: string; // (optional) (default to undefined)
let priority: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.feedbackAdminList(
    page,
    limit,
    status,
    type,
    priority
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to undefined|
| **priority** | [**number**] |  | (optional) defaults to undefined|


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

# **feedbackAdminList_0**
> any feedbackAdminList_0()


### Example

```typescript
import {
    FeedbackApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FeedbackApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; // (optional) (default to undefined)
let type: string; // (optional) (default to undefined)
let priority: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.feedbackAdminList_0(
    page,
    limit,
    status,
    type,
    priority
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to undefined|
| **priority** | [**number**] |  | (optional) defaults to undefined|


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

# **getFeedbackApiV1FeedbackFidGet**
> any getFeedbackApiV1FeedbackFidGet()


### Example

```typescript
import {
    FeedbackApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FeedbackApi(configuration);

let fid: number; // (default to undefined)

const { status, data } = await apiInstance.getFeedbackApiV1FeedbackFidGet(
    fid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fid** | [**number**] |  | defaults to undefined|


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

# **getFeedbackApiV1FeedbackFidGet_0**
> any getFeedbackApiV1FeedbackFidGet_0()


### Example

```typescript
import {
    FeedbackApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FeedbackApi(configuration);

let fid: number; // (default to undefined)

const { status, data } = await apiInstance.getFeedbackApiV1FeedbackFidGet_0(
    fid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fid** | [**number**] |  | defaults to undefined|


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

# **handleFeedbackApiV1FeedbackFidHandlePut**
> any handleFeedbackApiV1FeedbackFidHandlePut()


### Example

```typescript
import {
    FeedbackApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FeedbackApi(configuration);

let fid: number; // (default to undefined)
let status: number; // (default to undefined)
let remark: string; // (optional) (default to undefined)
let priority: number; // (optional) (default to undefined)
let reply: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.handleFeedbackApiV1FeedbackFidHandlePut(
    fid,
    status,
    remark,
    priority,
    reply
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fid** | [**number**] |  | defaults to undefined|
| **status** | [**number**] |  | defaults to undefined|
| **remark** | [**string**] |  | (optional) defaults to undefined|
| **priority** | [**number**] |  | (optional) defaults to undefined|
| **reply** | [**string**] |  | (optional) defaults to undefined|


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

# **handleFeedbackApiV1FeedbackFidHandlePut_0**
> any handleFeedbackApiV1FeedbackFidHandlePut_0()


### Example

```typescript
import {
    FeedbackApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FeedbackApi(configuration);

let fid: number; // (default to undefined)
let status: number; // (default to undefined)
let remark: string; // (optional) (default to undefined)
let priority: number; // (optional) (default to undefined)
let reply: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.handleFeedbackApiV1FeedbackFidHandlePut_0(
    fid,
    status,
    remark,
    priority,
    reply
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fid** | [**number**] |  | defaults to undefined|
| **status** | [**number**] |  | defaults to undefined|
| **remark** | [**string**] |  | (optional) defaults to undefined|
| **priority** | [**number**] |  | (optional) defaults to undefined|
| **reply** | [**string**] |  | (optional) defaults to undefined|


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

# **listMyFeedbacksApiV1FeedbackListGet**
> any listMyFeedbacksApiV1FeedbackListGet()


### Example

```typescript
import {
    FeedbackApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FeedbackApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let type: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listMyFeedbacksApiV1FeedbackListGet(
    page,
    limit,
    type,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **type** | [**string**] |  | (optional) defaults to undefined|
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

# **listMyFeedbacksApiV1FeedbackListGet_0**
> any listMyFeedbacksApiV1FeedbackListGet_0()


### Example

```typescript
import {
    FeedbackApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FeedbackApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let type: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listMyFeedbacksApiV1FeedbackListGet_0(
    page,
    limit,
    type,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **type** | [**string**] |  | (optional) defaults to undefined|
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

# **rateFeedbackApiV1FeedbackFidRatePost**
> any rateFeedbackApiV1FeedbackFidRatePost()


### Example

```typescript
import {
    FeedbackApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FeedbackApi(configuration);

let fid: number; // (default to undefined)
let rating: number; // (default to undefined)

const { status, data } = await apiInstance.rateFeedbackApiV1FeedbackFidRatePost(
    fid,
    rating
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fid** | [**number**] |  | defaults to undefined|
| **rating** | [**number**] |  | defaults to undefined|


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

# **rateFeedbackApiV1FeedbackFidRatePost_0**
> any rateFeedbackApiV1FeedbackFidRatePost_0()


### Example

```typescript
import {
    FeedbackApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FeedbackApi(configuration);

let fid: number; // (default to undefined)
let rating: number; // (default to undefined)

const { status, data } = await apiInstance.rateFeedbackApiV1FeedbackFidRatePost_0(
    fid,
    rating
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fid** | [**number**] |  | defaults to undefined|
| **rating** | [**number**] |  | defaults to undefined|


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

# **submitFeedbackApiV1FeedbackPost**
> any submitFeedbackApiV1FeedbackPost()


### Example

```typescript
import {
    FeedbackApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FeedbackApi(configuration);

let title: string; // (default to undefined)
let content: string; // (default to undefined)
let type: string; // (optional) (default to 'bug')
let images: string; // (optional) (default to undefined)
let contact: string; // (optional) (default to undefined)
let appVersion: string; // (optional) (default to undefined)
let deviceInfo: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.submitFeedbackApiV1FeedbackPost(
    title,
    content,
    type,
    images,
    contact,
    appVersion,
    deviceInfo
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'bug'|
| **images** | [**string**] |  | (optional) defaults to undefined|
| **contact** | [**string**] |  | (optional) defaults to undefined|
| **appVersion** | [**string**] |  | (optional) defaults to undefined|
| **deviceInfo** | [**string**] |  | (optional) defaults to undefined|


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

# **submitFeedbackApiV1FeedbackPost_0**
> any submitFeedbackApiV1FeedbackPost_0()


### Example

```typescript
import {
    FeedbackApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FeedbackApi(configuration);

let title: string; // (default to undefined)
let content: string; // (default to undefined)
let type: string; // (optional) (default to 'bug')
let images: string; // (optional) (default to undefined)
let contact: string; // (optional) (default to undefined)
let appVersion: string; // (optional) (default to undefined)
let deviceInfo: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.submitFeedbackApiV1FeedbackPost_0(
    title,
    content,
    type,
    images,
    contact,
    appVersion,
    deviceInfo
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'bug'|
| **images** | [**string**] |  | (optional) defaults to undefined|
| **contact** | [**string**] |  | (optional) defaults to undefined|
| **appVersion** | [**string**] |  | (optional) defaults to undefined|
| **deviceInfo** | [**string**] |  | (optional) defaults to undefined|


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

