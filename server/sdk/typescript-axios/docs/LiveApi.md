# LiveApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**addCommentApiV1LiveChannelCidCommentPost**](#addcommentapiv1livechannelcidcommentpost) | **POST** /api/v1/live/channel/{cid}/comment | 发表评论|
|[**addCommentApiV1LiveChannelCidCommentPost_0**](#addcommentapiv1livechannelcidcommentpost_0) | **POST** /api/v1/live/channel/{cid}/comment | 发表评论|
|[**getChannelApiV1LiveChannelCidGet**](#getchannelapiv1livechannelcidget) | **GET** /api/v1/live/channel/{cid} | 直播详情|
|[**getChannelApiV1LiveChannelCidGet_0**](#getchannelapiv1livechannelcidget_0) | **GET** /api/v1/live/channel/{cid} | 直播详情|
|[**listChannelsApiV1LiveChannelListGet**](#listchannelsapiv1livechannellistget) | **GET** /api/v1/live/channel/list | 直播列表|
|[**listChannelsApiV1LiveChannelListGet_0**](#listchannelsapiv1livechannellistget_0) | **GET** /api/v1/live/channel/list | 直播列表|
|[**listCommentsApiV1LiveChannelCidCommentsGet**](#listcommentsapiv1livechannelcidcommentsget) | **GET** /api/v1/live/channel/{cid}/comments | 评论列表|
|[**listCommentsApiV1LiveChannelCidCommentsGet_0**](#listcommentsapiv1livechannelcidcommentsget_0) | **GET** /api/v1/live/channel/{cid}/comments | 评论列表|
|[**liveChannelCategoryList**](#livechannelcategorylist) | **GET** /api/v1/live/category/list | 直播分类|
|[**liveChannelCategoryList_0**](#livechannelcategorylist_0) | **GET** /api/v1/live/category/list | 直播分类|
|[**liveCreateChannel**](#livecreatechannel) | **POST** /api/v1/live/channel | 创建直播|
|[**liveCreateChannel_0**](#livecreatechannel_0) | **POST** /api/v1/live/channel | 创建直播|
|[**liveDeleteChannel**](#livedeletechannel) | **DELETE** /api/v1/live/channel/{cid} | 删除直播|
|[**liveDeleteChannel_0**](#livedeletechannel_0) | **DELETE** /api/v1/live/channel/{cid} | 删除直播|
|[**liveUpdateChannel**](#liveupdatechannel) | **PUT** /api/v1/live/channel/{cid} | 修改直播|
|[**liveUpdateChannel_0**](#liveupdatechannel_0) | **PUT** /api/v1/live/channel/{cid} | 修改直播|
|[**startLiveApiV1LiveChannelCidStartPost**](#startliveapiv1livechannelcidstartpost) | **POST** /api/v1/live/channel/{cid}/start | 开始直播|
|[**startLiveApiV1LiveChannelCidStartPost_0**](#startliveapiv1livechannelcidstartpost_0) | **POST** /api/v1/live/channel/{cid}/start | 开始直播|
|[**stopLiveApiV1LiveChannelCidStopPost**](#stopliveapiv1livechannelcidstoppost) | **POST** /api/v1/live/channel/{cid}/stop | 结束直播|
|[**stopLiveApiV1LiveChannelCidStopPost_0**](#stopliveapiv1livechannelcidstoppost_0) | **POST** /api/v1/live/channel/{cid}/stop | 结束直播|
|[**toggleSubscribeApiV1LiveChannelCidSubscribePost**](#togglesubscribeapiv1livechannelcidsubscribepost) | **POST** /api/v1/live/channel/{cid}/subscribe | 订阅/取消订阅|
|[**toggleSubscribeApiV1LiveChannelCidSubscribePost_0**](#togglesubscribeapiv1livechannelcidsubscribepost_0) | **POST** /api/v1/live/channel/{cid}/subscribe | 订阅/取消订阅|

# **addCommentApiV1LiveChannelCidCommentPost**
> any addCommentApiV1LiveChannelCidCommentPost()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let cid: number; // (default to undefined)
let content: string; // (default to undefined)
let type: number; // (optional) (default to 1)

const { status, data } = await apiInstance.addCommentApiV1LiveChannelCidCommentPost(
    cid,
    content,
    type
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **cid** | [**number**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **type** | [**number**] |  | (optional) defaults to 1|


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

# **addCommentApiV1LiveChannelCidCommentPost_0**
> any addCommentApiV1LiveChannelCidCommentPost_0()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let cid: number; // (default to undefined)
let content: string; // (default to undefined)
let type: number; // (optional) (default to 1)

const { status, data } = await apiInstance.addCommentApiV1LiveChannelCidCommentPost_0(
    cid,
    content,
    type
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **cid** | [**number**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **type** | [**number**] |  | (optional) defaults to 1|


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

# **getChannelApiV1LiveChannelCidGet**
> any getChannelApiV1LiveChannelCidGet()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.getChannelApiV1LiveChannelCidGet(
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

# **getChannelApiV1LiveChannelCidGet_0**
> any getChannelApiV1LiveChannelCidGet_0()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.getChannelApiV1LiveChannelCidGet_0(
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

# **listChannelsApiV1LiveChannelListGet**
> any listChannelsApiV1LiveChannelListGet()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; // (optional) (default to undefined)
let categoryId: number; // (optional) (default to undefined)
let hostId: string; // (optional) (default to undefined)
let keyword: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listChannelsApiV1LiveChannelListGet(
    page,
    limit,
    status,
    categoryId,
    hostId,
    keyword
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **categoryId** | [**number**] |  | (optional) defaults to undefined|
| **hostId** | [**string**] |  | (optional) defaults to undefined|
| **keyword** | [**string**] |  | (optional) defaults to undefined|


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

# **listChannelsApiV1LiveChannelListGet_0**
> any listChannelsApiV1LiveChannelListGet_0()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; // (optional) (default to undefined)
let categoryId: number; // (optional) (default to undefined)
let hostId: string; // (optional) (default to undefined)
let keyword: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listChannelsApiV1LiveChannelListGet_0(
    page,
    limit,
    status,
    categoryId,
    hostId,
    keyword
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **categoryId** | [**number**] |  | (optional) defaults to undefined|
| **hostId** | [**string**] |  | (optional) defaults to undefined|
| **keyword** | [**string**] |  | (optional) defaults to undefined|


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

# **listCommentsApiV1LiveChannelCidCommentsGet**
> any listCommentsApiV1LiveChannelCidCommentsGet()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let cid: number; // (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 50)

const { status, data } = await apiInstance.listCommentsApiV1LiveChannelCidCommentsGet(
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
| **limit** | [**number**] |  | (optional) defaults to 50|


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

# **listCommentsApiV1LiveChannelCidCommentsGet_0**
> any listCommentsApiV1LiveChannelCidCommentsGet_0()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let cid: number; // (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 50)

const { status, data } = await apiInstance.listCommentsApiV1LiveChannelCidCommentsGet_0(
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
| **limit** | [**number**] |  | (optional) defaults to 50|


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

# **liveChannelCategoryList**
> any liveChannelCategoryList()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

const { status, data } = await apiInstance.liveChannelCategoryList();
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

# **liveChannelCategoryList_0**
> any liveChannelCategoryList_0()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

const { status, data } = await apiInstance.liveChannelCategoryList_0();
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

# **liveCreateChannel**
> any liveCreateChannel()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let title: string; // (default to undefined)
let description: string; // (optional) (default to undefined)
let cover: string; // (optional) (default to undefined)
let categoryId: number; // (optional) (default to undefined)
let type: number; // (optional) (default to 1)
let price: number; // (optional) (default to 0)
let planStartTime: string; // (optional) (default to undefined)
let planDuration: number; // (optional) (default to 60)

const { status, data } = await apiInstance.liveCreateChannel(
    title,
    description,
    cover,
    categoryId,
    type,
    price,
    planStartTime,
    planDuration
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **cover** | [**string**] |  | (optional) defaults to undefined|
| **categoryId** | [**number**] |  | (optional) defaults to undefined|
| **type** | [**number**] |  | (optional) defaults to 1|
| **price** | [**number**] |  | (optional) defaults to 0|
| **planStartTime** | [**string**] |  | (optional) defaults to undefined|
| **planDuration** | [**number**] |  | (optional) defaults to 60|


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

# **liveCreateChannel_0**
> any liveCreateChannel_0()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let title: string; // (default to undefined)
let description: string; // (optional) (default to undefined)
let cover: string; // (optional) (default to undefined)
let categoryId: number; // (optional) (default to undefined)
let type: number; // (optional) (default to 1)
let price: number; // (optional) (default to 0)
let planStartTime: string; // (optional) (default to undefined)
let planDuration: number; // (optional) (default to 60)

const { status, data } = await apiInstance.liveCreateChannel_0(
    title,
    description,
    cover,
    categoryId,
    type,
    price,
    planStartTime,
    planDuration
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **cover** | [**string**] |  | (optional) defaults to undefined|
| **categoryId** | [**number**] |  | (optional) defaults to undefined|
| **type** | [**number**] |  | (optional) defaults to 1|
| **price** | [**number**] |  | (optional) defaults to 0|
| **planStartTime** | [**string**] |  | (optional) defaults to undefined|
| **planDuration** | [**number**] |  | (optional) defaults to 60|


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

# **liveDeleteChannel**
> any liveDeleteChannel()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.liveDeleteChannel(
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

# **liveDeleteChannel_0**
> any liveDeleteChannel_0()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.liveDeleteChannel_0(
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

# **liveUpdateChannel**
> any liveUpdateChannel()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let cid: number; // (default to undefined)
let title: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)
let cover: string; // (optional) (default to undefined)
let planStartTime: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.liveUpdateChannel(
    cid,
    title,
    description,
    cover,
    planStartTime
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **cid** | [**number**] |  | defaults to undefined|
| **title** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **cover** | [**string**] |  | (optional) defaults to undefined|
| **planStartTime** | [**string**] |  | (optional) defaults to undefined|


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

# **liveUpdateChannel_0**
> any liveUpdateChannel_0()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let cid: number; // (default to undefined)
let title: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)
let cover: string; // (optional) (default to undefined)
let planStartTime: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.liveUpdateChannel_0(
    cid,
    title,
    description,
    cover,
    planStartTime
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **cid** | [**number**] |  | defaults to undefined|
| **title** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **cover** | [**string**] |  | (optional) defaults to undefined|
| **planStartTime** | [**string**] |  | (optional) defaults to undefined|


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

# **startLiveApiV1LiveChannelCidStartPost**
> any startLiveApiV1LiveChannelCidStartPost()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.startLiveApiV1LiveChannelCidStartPost(
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

# **startLiveApiV1LiveChannelCidStartPost_0**
> any startLiveApiV1LiveChannelCidStartPost_0()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.startLiveApiV1LiveChannelCidStartPost_0(
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

# **stopLiveApiV1LiveChannelCidStopPost**
> any stopLiveApiV1LiveChannelCidStopPost()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.stopLiveApiV1LiveChannelCidStopPost(
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

# **stopLiveApiV1LiveChannelCidStopPost_0**
> any stopLiveApiV1LiveChannelCidStopPost_0()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.stopLiveApiV1LiveChannelCidStopPost_0(
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

# **toggleSubscribeApiV1LiveChannelCidSubscribePost**
> any toggleSubscribeApiV1LiveChannelCidSubscribePost()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.toggleSubscribeApiV1LiveChannelCidSubscribePost(
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

# **toggleSubscribeApiV1LiveChannelCidSubscribePost_0**
> any toggleSubscribeApiV1LiveChannelCidSubscribePost_0()


### Example

```typescript
import {
    LiveApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LiveApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.toggleSubscribeApiV1LiveChannelCidSubscribePost_0(
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

