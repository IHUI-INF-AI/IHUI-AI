# NotificationApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**channelListApiV1NotificationChannelListGet**](#channellistapiv1notificationchannellistget) | **GET** /api/v1/notification/channel/list | 通知渠道列表|
|[**channelListApiV1NotificationChannelListGet_0**](#channellistapiv1notificationchannellistget_0) | **GET** /api/v1/notification/channel/list | 通知渠道列表|
|[**deleteNotificationApiV1NotificationNidDelete**](#deletenotificationapiv1notificationniddelete) | **DELETE** /api/v1/notification/{nid} | 删除通知|
|[**deleteNotificationApiV1NotificationNidDelete_0**](#deletenotificationapiv1notificationniddelete_0) | **DELETE** /api/v1/notification/{nid} | 删除通知|
|[**listNotificationsApiV1NotificationListGet**](#listnotificationsapiv1notificationlistget) | **GET** /api/v1/notification/list | 我的通知列表|
|[**listNotificationsApiV1NotificationListGet_0**](#listnotificationsapiv1notificationlistget_0) | **GET** /api/v1/notification/list | 我的通知列表|
|[**markReadApiV1NotificationNidReadPost**](#markreadapiv1notificationnidreadpost) | **POST** /api/v1/notification/{nid}/read | 标记已读|
|[**markReadApiV1NotificationNidReadPost_0**](#markreadapiv1notificationnidreadpost_0) | **POST** /api/v1/notification/{nid}/read | 标记已读|
|[**notificationCreateChannel**](#notificationcreatechannel) | **POST** /api/v1/notification/channel | 添加渠道|
|[**notificationCreateChannel_0**](#notificationcreatechannel_0) | **POST** /api/v1/notification/channel | 添加渠道|
|[**notificationDeleteChannel**](#notificationdeletechannel) | **DELETE** /api/v1/notification/channel/{cid} | 删除渠道|
|[**notificationDeleteChannel_0**](#notificationdeletechannel_0) | **DELETE** /api/v1/notification/channel/{cid} | 删除渠道|
|[**notificationLogList**](#notificationloglist) | **GET** /api/v1/notification/log/list | 通知发送日志|
|[**notificationLogList_0**](#notificationloglist_0) | **GET** /api/v1/notification/log/list | 通知发送日志|
|[**notificationMarkAllRead**](#notificationmarkallread) | **POST** /api/v1/notification/read-all | 全部标记已读|
|[**notificationMarkAllRead_0**](#notificationmarkallread_0) | **POST** /api/v1/notification/read-all | 全部标记已读|
|[**notificationUnreadCount**](#notificationunreadcount) | **GET** /api/v1/notification/unread-count | 未读通知数|
|[**notificationUnreadCount_0**](#notificationunreadcount_0) | **GET** /api/v1/notification/unread-count | 未读通知数|
|[**notificationUpdateChannel**](#notificationupdatechannel) | **PUT** /api/v1/notification/channel/{cid} | 修改渠道|
|[**notificationUpdateChannel_0**](#notificationupdatechannel_0) | **PUT** /api/v1/notification/channel/{cid} | 修改渠道|
|[**sendNotificationApiV1NotificationSendPost**](#sendnotificationapiv1notificationsendpost) | **POST** /api/v1/notification/send | 发送通知|
|[**sendNotificationApiV1NotificationSendPost_0**](#sendnotificationapiv1notificationsendpost_0) | **POST** /api/v1/notification/send | 发送通知|
|[**setSubscriptionApiV1NotificationSubscriptionPost**](#setsubscriptionapiv1notificationsubscriptionpost) | **POST** /api/v1/notification/subscription | 设置订阅|
|[**setSubscriptionApiV1NotificationSubscriptionPost_0**](#setsubscriptionapiv1notificationsubscriptionpost_0) | **POST** /api/v1/notification/subscription | 设置订阅|
|[**subscriptionListApiV1NotificationSubscriptionListGet**](#subscriptionlistapiv1notificationsubscriptionlistget) | **GET** /api/v1/notification/subscription/list | 我的订阅偏好|
|[**subscriptionListApiV1NotificationSubscriptionListGet_0**](#subscriptionlistapiv1notificationsubscriptionlistget_0) | **GET** /api/v1/notification/subscription/list | 我的订阅偏好|

# **channelListApiV1NotificationChannelListGet**
> any channelListApiV1NotificationChannelListGet()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let type: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.channelListApiV1NotificationChannelListGet(
    type
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **type** | [**string**] |  | (optional) defaults to undefined|


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

# **channelListApiV1NotificationChannelListGet_0**
> any channelListApiV1NotificationChannelListGet_0()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let type: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.channelListApiV1NotificationChannelListGet_0(
    type
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **type** | [**string**] |  | (optional) defaults to undefined|


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

# **deleteNotificationApiV1NotificationNidDelete**
> any deleteNotificationApiV1NotificationNidDelete()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let nid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteNotificationApiV1NotificationNidDelete(
    nid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **nid** | [**number**] |  | defaults to undefined|


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

# **deleteNotificationApiV1NotificationNidDelete_0**
> any deleteNotificationApiV1NotificationNidDelete_0()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let nid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteNotificationApiV1NotificationNidDelete_0(
    nid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **nid** | [**number**] |  | defaults to undefined|


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

# **listNotificationsApiV1NotificationListGet**
> any listNotificationsApiV1NotificationListGet()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let type: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listNotificationsApiV1NotificationListGet(
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

# **listNotificationsApiV1NotificationListGet_0**
> any listNotificationsApiV1NotificationListGet_0()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let type: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listNotificationsApiV1NotificationListGet_0(
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

# **markReadApiV1NotificationNidReadPost**
> any markReadApiV1NotificationNidReadPost()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let nid: number; // (default to undefined)

const { status, data } = await apiInstance.markReadApiV1NotificationNidReadPost(
    nid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **nid** | [**number**] |  | defaults to undefined|


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

# **markReadApiV1NotificationNidReadPost_0**
> any markReadApiV1NotificationNidReadPost_0()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let nid: number; // (default to undefined)

const { status, data } = await apiInstance.markReadApiV1NotificationNidReadPost_0(
    nid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **nid** | [**number**] |  | defaults to undefined|


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

# **notificationCreateChannel**
> any notificationCreateChannel()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let name: string; // (default to undefined)
let type: string; // (default to undefined)
let config: string; // (optional) (default to undefined)
let isDefault: boolean; // (optional) (default to false)

const { status, data } = await apiInstance.notificationCreateChannel(
    name,
    type,
    config,
    isDefault
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | defaults to undefined|
| **config** | [**string**] |  | (optional) defaults to undefined|
| **isDefault** | [**boolean**] |  | (optional) defaults to false|


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

# **notificationCreateChannel_0**
> any notificationCreateChannel_0()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let name: string; // (default to undefined)
let type: string; // (default to undefined)
let config: string; // (optional) (default to undefined)
let isDefault: boolean; // (optional) (default to false)

const { status, data } = await apiInstance.notificationCreateChannel_0(
    name,
    type,
    config,
    isDefault
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | defaults to undefined|
| **config** | [**string**] |  | (optional) defaults to undefined|
| **isDefault** | [**boolean**] |  | (optional) defaults to false|


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

# **notificationDeleteChannel**
> any notificationDeleteChannel()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.notificationDeleteChannel(
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

# **notificationDeleteChannel_0**
> any notificationDeleteChannel_0()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let cid: number; // (default to undefined)

const { status, data } = await apiInstance.notificationDeleteChannel_0(
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

# **notificationLogList**
> any notificationLogList()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let successFlag: boolean; // (optional) (default to undefined)

const { status, data } = await apiInstance.notificationLogList(
    page,
    limit,
    successFlag
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **successFlag** | [**boolean**] |  | (optional) defaults to undefined|


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

# **notificationLogList_0**
> any notificationLogList_0()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let successFlag: boolean; // (optional) (default to undefined)

const { status, data } = await apiInstance.notificationLogList_0(
    page,
    limit,
    successFlag
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **successFlag** | [**boolean**] |  | (optional) defaults to undefined|


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

# **notificationMarkAllRead**
> any notificationMarkAllRead()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

const { status, data } = await apiInstance.notificationMarkAllRead();
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

# **notificationMarkAllRead_0**
> any notificationMarkAllRead_0()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

const { status, data } = await apiInstance.notificationMarkAllRead_0();
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

# **notificationUnreadCount**
> any notificationUnreadCount()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

const { status, data } = await apiInstance.notificationUnreadCount();
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

# **notificationUnreadCount_0**
> any notificationUnreadCount_0()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

const { status, data } = await apiInstance.notificationUnreadCount_0();
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

# **notificationUpdateChannel**
> any notificationUpdateChannel()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let cid: number; // (default to undefined)
let name: string; // (optional) (default to undefined)
let config: string; // (optional) (default to undefined)
let isDefault: boolean; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.notificationUpdateChannel(
    cid,
    name,
    config,
    isDefault,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **cid** | [**number**] |  | defaults to undefined|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **config** | [**string**] |  | (optional) defaults to undefined|
| **isDefault** | [**boolean**] |  | (optional) defaults to undefined|
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

# **notificationUpdateChannel_0**
> any notificationUpdateChannel_0()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let cid: number; // (default to undefined)
let name: string; // (optional) (default to undefined)
let config: string; // (optional) (default to undefined)
let isDefault: boolean; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.notificationUpdateChannel_0(
    cid,
    name,
    config,
    isDefault,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **cid** | [**number**] |  | defaults to undefined|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **config** | [**string**] |  | (optional) defaults to undefined|
| **isDefault** | [**boolean**] |  | (optional) defaults to undefined|
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

# **sendNotificationApiV1NotificationSendPost**
> any sendNotificationApiV1NotificationSendPost()

发送通知: user_id(单用户) 或 user_ids(逗号分隔多用户)

### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let title: string; // (default to undefined)
let content: string; // (default to undefined)
let userId: string; // (optional) (default to undefined)
let type: string; // (optional) (default to 'site')
let channel: string; // (optional) (default to undefined)
let targetType: string; // (optional) (default to undefined)
let targetId: string; // (optional) (default to undefined)
let targetUrl: string; // (optional) (default to undefined)
let userIds: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.sendNotificationApiV1NotificationSendPost(
    title,
    content,
    userId,
    type,
    channel,
    targetType,
    targetId,
    targetUrl,
    userIds
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'site'|
| **channel** | [**string**] |  | (optional) defaults to undefined|
| **targetType** | [**string**] |  | (optional) defaults to undefined|
| **targetId** | [**string**] |  | (optional) defaults to undefined|
| **targetUrl** | [**string**] |  | (optional) defaults to undefined|
| **userIds** | [**string**] |  | (optional) defaults to undefined|


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

# **sendNotificationApiV1NotificationSendPost_0**
> any sendNotificationApiV1NotificationSendPost_0()

发送通知: user_id(单用户) 或 user_ids(逗号分隔多用户)

### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let title: string; // (default to undefined)
let content: string; // (default to undefined)
let userId: string; // (optional) (default to undefined)
let type: string; // (optional) (default to 'site')
let channel: string; // (optional) (default to undefined)
let targetType: string; // (optional) (default to undefined)
let targetId: string; // (optional) (default to undefined)
let targetUrl: string; // (optional) (default to undefined)
let userIds: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.sendNotificationApiV1NotificationSendPost_0(
    title,
    content,
    userId,
    type,
    channel,
    targetType,
    targetId,
    targetUrl,
    userIds
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'site'|
| **channel** | [**string**] |  | (optional) defaults to undefined|
| **targetType** | [**string**] |  | (optional) defaults to undefined|
| **targetId** | [**string**] |  | (optional) defaults to undefined|
| **targetUrl** | [**string**] |  | (optional) defaults to undefined|
| **userIds** | [**string**] |  | (optional) defaults to undefined|


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

# **setSubscriptionApiV1NotificationSubscriptionPost**
> any setSubscriptionApiV1NotificationSubscriptionPost()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let type: string; // (default to undefined)
let category: string; // (default to undefined)
let enabled: boolean; // (optional) (default to true)

const { status, data } = await apiInstance.setSubscriptionApiV1NotificationSubscriptionPost(
    type,
    category,
    enabled
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **type** | [**string**] |  | defaults to undefined|
| **category** | [**string**] |  | defaults to undefined|
| **enabled** | [**boolean**] |  | (optional) defaults to true|


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

# **setSubscriptionApiV1NotificationSubscriptionPost_0**
> any setSubscriptionApiV1NotificationSubscriptionPost_0()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

let type: string; // (default to undefined)
let category: string; // (default to undefined)
let enabled: boolean; // (optional) (default to true)

const { status, data } = await apiInstance.setSubscriptionApiV1NotificationSubscriptionPost_0(
    type,
    category,
    enabled
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **type** | [**string**] |  | defaults to undefined|
| **category** | [**string**] |  | defaults to undefined|
| **enabled** | [**boolean**] |  | (optional) defaults to true|


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

# **subscriptionListApiV1NotificationSubscriptionListGet**
> any subscriptionListApiV1NotificationSubscriptionListGet()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

const { status, data } = await apiInstance.subscriptionListApiV1NotificationSubscriptionListGet();
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

# **subscriptionListApiV1NotificationSubscriptionListGet_0**
> any subscriptionListApiV1NotificationSubscriptionListGet_0()


### Example

```typescript
import {
    NotificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NotificationApi(configuration);

const { status, data } = await apiInstance.subscriptionListApiV1NotificationSubscriptionListGet_0();
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

