# NotificationApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**channelListApiV1NotificationChannelListGet**](NotificationApi.md#channellistapiv1notificationchannellistget) | **GET** /api/v1/notification/channel/list | 通知渠道列表 |
| [**channelListApiV1NotificationChannelListGet_0**](NotificationApi.md#channellistapiv1notificationchannellistget_0) | **GET** /api/v1/notification/channel/list | 通知渠道列表 |
| [**deleteNotificationApiV1NotificationNidDelete**](NotificationApi.md#deletenotificationapiv1notificationniddelete) | **DELETE** /api/v1/notification/{nid} | 删除通知 |
| [**deleteNotificationApiV1NotificationNidDelete_0**](NotificationApi.md#deletenotificationapiv1notificationniddelete_0) | **DELETE** /api/v1/notification/{nid} | 删除通知 |
| [**listNotificationsApiV1NotificationListGet**](NotificationApi.md#listnotificationsapiv1notificationlistget) | **GET** /api/v1/notification/list | 我的通知列表 |
| [**listNotificationsApiV1NotificationListGet_0**](NotificationApi.md#listnotificationsapiv1notificationlistget_0) | **GET** /api/v1/notification/list | 我的通知列表 |
| [**markReadApiV1NotificationNidReadPost**](NotificationApi.md#markreadapiv1notificationnidreadpost) | **POST** /api/v1/notification/{nid}/read | 标记已读 |
| [**markReadApiV1NotificationNidReadPost_0**](NotificationApi.md#markreadapiv1notificationnidreadpost_0) | **POST** /api/v1/notification/{nid}/read | 标记已读 |
| [**notificationCreateChannel**](NotificationApi.md#notificationcreatechannel) | **POST** /api/v1/notification/channel | 添加渠道 |
| [**notificationCreateChannel_0**](NotificationApi.md#notificationcreatechannel_0) | **POST** /api/v1/notification/channel | 添加渠道 |
| [**notificationDeleteChannel**](NotificationApi.md#notificationdeletechannel) | **DELETE** /api/v1/notification/channel/{cid} | 删除渠道 |
| [**notificationDeleteChannel_0**](NotificationApi.md#notificationdeletechannel_0) | **DELETE** /api/v1/notification/channel/{cid} | 删除渠道 |
| [**notificationLogList**](NotificationApi.md#notificationloglist) | **GET** /api/v1/notification/log/list | 通知发送日志 |
| [**notificationLogList_0**](NotificationApi.md#notificationloglist_0) | **GET** /api/v1/notification/log/list | 通知发送日志 |
| [**notificationMarkAllRead**](NotificationApi.md#notificationmarkallread) | **POST** /api/v1/notification/read-all | 全部标记已读 |
| [**notificationMarkAllRead_0**](NotificationApi.md#notificationmarkallread_0) | **POST** /api/v1/notification/read-all | 全部标记已读 |
| [**notificationUnreadCount**](NotificationApi.md#notificationunreadcount) | **GET** /api/v1/notification/unread-count | 未读通知数 |
| [**notificationUnreadCount_0**](NotificationApi.md#notificationunreadcount_0) | **GET** /api/v1/notification/unread-count | 未读通知数 |
| [**notificationUpdateChannel**](NotificationApi.md#notificationupdatechannel) | **PUT** /api/v1/notification/channel/{cid} | 修改渠道 |
| [**notificationUpdateChannel_0**](NotificationApi.md#notificationupdatechannel_0) | **PUT** /api/v1/notification/channel/{cid} | 修改渠道 |
| [**sendNotificationApiV1NotificationSendPost**](NotificationApi.md#sendnotificationapiv1notificationsendpost) | **POST** /api/v1/notification/send | 发送通知 |
| [**sendNotificationApiV1NotificationSendPost_0**](NotificationApi.md#sendnotificationapiv1notificationsendpost_0) | **POST** /api/v1/notification/send | 发送通知 |
| [**setSubscriptionApiV1NotificationSubscriptionPost**](NotificationApi.md#setsubscriptionapiv1notificationsubscriptionpost) | **POST** /api/v1/notification/subscription | 设置订阅 |
| [**setSubscriptionApiV1NotificationSubscriptionPost_0**](NotificationApi.md#setsubscriptionapiv1notificationsubscriptionpost_0) | **POST** /api/v1/notification/subscription | 设置订阅 |
| [**subscriptionListApiV1NotificationSubscriptionListGet**](NotificationApi.md#subscriptionlistapiv1notificationsubscriptionlistget) | **GET** /api/v1/notification/subscription/list | 我的订阅偏好 |
| [**subscriptionListApiV1NotificationSubscriptionListGet_0**](NotificationApi.md#subscriptionlistapiv1notificationsubscriptionlistget_0) | **GET** /api/v1/notification/subscription/list | 我的订阅偏好 |



## channelListApiV1NotificationChannelListGet

> any channelListApiV1NotificationChannelListGet(type)

通知渠道列表

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { ChannelListApiV1NotificationChannelListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // string (optional)
    type: type_example,
  } satisfies ChannelListApiV1NotificationChannelListGetRequest;

  try {
    const data = await api.channelListApiV1NotificationChannelListGet(body);
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
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## channelListApiV1NotificationChannelListGet_0

> any channelListApiV1NotificationChannelListGet_0(type)

通知渠道列表

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { ChannelListApiV1NotificationChannelListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // string (optional)
    type: type_example,
  } satisfies ChannelListApiV1NotificationChannelListGet0Request;

  try {
    const data = await api.channelListApiV1NotificationChannelListGet_0(body);
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
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## deleteNotificationApiV1NotificationNidDelete

> any deleteNotificationApiV1NotificationNidDelete(nid)

删除通知

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { DeleteNotificationApiV1NotificationNidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // number
    nid: 56,
  } satisfies DeleteNotificationApiV1NotificationNidDeleteRequest;

  try {
    const data = await api.deleteNotificationApiV1NotificationNidDelete(body);
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
| **nid** | `number` |  | [Defaults to `undefined`] |

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


## deleteNotificationApiV1NotificationNidDelete_0

> any deleteNotificationApiV1NotificationNidDelete_0(nid)

删除通知

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { DeleteNotificationApiV1NotificationNidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // number
    nid: 56,
  } satisfies DeleteNotificationApiV1NotificationNidDelete0Request;

  try {
    const data = await api.deleteNotificationApiV1NotificationNidDelete_0(body);
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
| **nid** | `number` |  | [Defaults to `undefined`] |

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


## listNotificationsApiV1NotificationListGet

> any listNotificationsApiV1NotificationListGet(page, limit, type, status)

我的通知列表

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { ListNotificationsApiV1NotificationListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    type: type_example,
    // number (optional)
    status: 56,
  } satisfies ListNotificationsApiV1NotificationListGetRequest;

  try {
    const data = await api.listNotificationsApiV1NotificationListGet(body);
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
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## listNotificationsApiV1NotificationListGet_0

> any listNotificationsApiV1NotificationListGet_0(page, limit, type, status)

我的通知列表

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { ListNotificationsApiV1NotificationListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    type: type_example,
    // number (optional)
    status: 56,
  } satisfies ListNotificationsApiV1NotificationListGet0Request;

  try {
    const data = await api.listNotificationsApiV1NotificationListGet_0(body);
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
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## markReadApiV1NotificationNidReadPost

> any markReadApiV1NotificationNidReadPost(nid)

标记已读

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { MarkReadApiV1NotificationNidReadPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // number
    nid: 56,
  } satisfies MarkReadApiV1NotificationNidReadPostRequest;

  try {
    const data = await api.markReadApiV1NotificationNidReadPost(body);
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
| **nid** | `number` |  | [Defaults to `undefined`] |

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


## markReadApiV1NotificationNidReadPost_0

> any markReadApiV1NotificationNidReadPost_0(nid)

标记已读

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { MarkReadApiV1NotificationNidReadPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // number
    nid: 56,
  } satisfies MarkReadApiV1NotificationNidReadPost0Request;

  try {
    const data = await api.markReadApiV1NotificationNidReadPost_0(body);
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
| **nid** | `number` |  | [Defaults to `undefined`] |

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


## notificationCreateChannel

> any notificationCreateChannel(name, type, config, isDefault)

添加渠道

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { NotificationCreateChannelRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // string
    name: name_example,
    // string
    type: type_example,
    // string (optional)
    config: config_example,
    // boolean (optional)
    isDefault: true,
  } satisfies NotificationCreateChannelRequest;

  try {
    const data = await api.notificationCreateChannel(body);
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
| **type** | `string` |  | [Defaults to `undefined`] |
| **config** | `string` |  | [Optional] [Defaults to `undefined`] |
| **isDefault** | `boolean` |  | [Optional] [Defaults to `false`] |

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


## notificationCreateChannel_0

> any notificationCreateChannel_0(name, type, config, isDefault)

添加渠道

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { NotificationCreateChannel0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // string
    name: name_example,
    // string
    type: type_example,
    // string (optional)
    config: config_example,
    // boolean (optional)
    isDefault: true,
  } satisfies NotificationCreateChannel0Request;

  try {
    const data = await api.notificationCreateChannel_0(body);
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
| **type** | `string` |  | [Defaults to `undefined`] |
| **config** | `string` |  | [Optional] [Defaults to `undefined`] |
| **isDefault** | `boolean` |  | [Optional] [Defaults to `false`] |

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


## notificationDeleteChannel

> any notificationDeleteChannel(cid)

删除渠道

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { NotificationDeleteChannelRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // number
    cid: 56,
  } satisfies NotificationDeleteChannelRequest;

  try {
    const data = await api.notificationDeleteChannel(body);
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


## notificationDeleteChannel_0

> any notificationDeleteChannel_0(cid)

删除渠道

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { NotificationDeleteChannel0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // number
    cid: 56,
  } satisfies NotificationDeleteChannel0Request;

  try {
    const data = await api.notificationDeleteChannel_0(body);
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


## notificationLogList

> any notificationLogList(page, limit, successFlag)

通知发送日志

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { NotificationLogListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // boolean (optional)
    successFlag: true,
  } satisfies NotificationLogListRequest;

  try {
    const data = await api.notificationLogList(body);
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
| **successFlag** | `boolean` |  | [Optional] [Defaults to `undefined`] |

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


## notificationLogList_0

> any notificationLogList_0(page, limit, successFlag)

通知发送日志

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { NotificationLogList0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // boolean (optional)
    successFlag: true,
  } satisfies NotificationLogList0Request;

  try {
    const data = await api.notificationLogList_0(body);
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
| **successFlag** | `boolean` |  | [Optional] [Defaults to `undefined`] |

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


## notificationMarkAllRead

> any notificationMarkAllRead()

全部标记已读

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { NotificationMarkAllReadRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  try {
    const data = await api.notificationMarkAllRead();
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


## notificationMarkAllRead_0

> any notificationMarkAllRead_0()

全部标记已读

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { NotificationMarkAllRead0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  try {
    const data = await api.notificationMarkAllRead_0();
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


## notificationUnreadCount

> any notificationUnreadCount()

未读通知数

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { NotificationUnreadCountRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  try {
    const data = await api.notificationUnreadCount();
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


## notificationUnreadCount_0

> any notificationUnreadCount_0()

未读通知数

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { NotificationUnreadCount0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  try {
    const data = await api.notificationUnreadCount_0();
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


## notificationUpdateChannel

> any notificationUpdateChannel(cid, name, config, isDefault, status)

修改渠道

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { NotificationUpdateChannelRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // number
    cid: 56,
    // string (optional)
    name: name_example,
    // string (optional)
    config: config_example,
    // boolean (optional)
    isDefault: true,
    // number (optional)
    status: 56,
  } satisfies NotificationUpdateChannelRequest;

  try {
    const data = await api.notificationUpdateChannel(body);
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
| **config** | `string` |  | [Optional] [Defaults to `undefined`] |
| **isDefault** | `boolean` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## notificationUpdateChannel_0

> any notificationUpdateChannel_0(cid, name, config, isDefault, status)

修改渠道

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { NotificationUpdateChannel0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // number
    cid: 56,
    // string (optional)
    name: name_example,
    // string (optional)
    config: config_example,
    // boolean (optional)
    isDefault: true,
    // number (optional)
    status: 56,
  } satisfies NotificationUpdateChannel0Request;

  try {
    const data = await api.notificationUpdateChannel_0(body);
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
| **config** | `string` |  | [Optional] [Defaults to `undefined`] |
| **isDefault** | `boolean` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## sendNotificationApiV1NotificationSendPost

> any sendNotificationApiV1NotificationSendPost(title, content, userId, type, channel, targetType, targetId, targetUrl, userIds)

发送通知

发送通知: user_id(单用户) 或 user_ids(逗号分隔多用户)

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { SendNotificationApiV1NotificationSendPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // string
    title: title_example,
    // string
    content: content_example,
    // string (optional)
    userId: userId_example,
    // string (optional)
    type: type_example,
    // string (optional)
    channel: channel_example,
    // string (optional)
    targetType: targetType_example,
    // string (optional)
    targetId: targetId_example,
    // string (optional)
    targetUrl: targetUrl_example,
    // string (optional)
    userIds: userIds_example,
  } satisfies SendNotificationApiV1NotificationSendPostRequest;

  try {
    const data = await api.sendNotificationApiV1NotificationSendPost(body);
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
| **title** | `string` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Defaults to `undefined`] |
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;site&#39;`] |
| **channel** | `string` |  | [Optional] [Defaults to `undefined`] |
| **targetType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **targetId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **targetUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **userIds** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## sendNotificationApiV1NotificationSendPost_0

> any sendNotificationApiV1NotificationSendPost_0(title, content, userId, type, channel, targetType, targetId, targetUrl, userIds)

发送通知

发送通知: user_id(单用户) 或 user_ids(逗号分隔多用户)

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { SendNotificationApiV1NotificationSendPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // string
    title: title_example,
    // string
    content: content_example,
    // string (optional)
    userId: userId_example,
    // string (optional)
    type: type_example,
    // string (optional)
    channel: channel_example,
    // string (optional)
    targetType: targetType_example,
    // string (optional)
    targetId: targetId_example,
    // string (optional)
    targetUrl: targetUrl_example,
    // string (optional)
    userIds: userIds_example,
  } satisfies SendNotificationApiV1NotificationSendPost0Request;

  try {
    const data = await api.sendNotificationApiV1NotificationSendPost_0(body);
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
| **title** | `string` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Defaults to `undefined`] |
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;site&#39;`] |
| **channel** | `string` |  | [Optional] [Defaults to `undefined`] |
| **targetType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **targetId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **targetUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **userIds** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## setSubscriptionApiV1NotificationSubscriptionPost

> any setSubscriptionApiV1NotificationSubscriptionPost(type, category, enabled)

设置订阅

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { SetSubscriptionApiV1NotificationSubscriptionPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // string
    type: type_example,
    // string
    category: category_example,
    // boolean (optional)
    enabled: true,
  } satisfies SetSubscriptionApiV1NotificationSubscriptionPostRequest;

  try {
    const data = await api.setSubscriptionApiV1NotificationSubscriptionPost(body);
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
| **type** | `string` |  | [Defaults to `undefined`] |
| **category** | `string` |  | [Defaults to `undefined`] |
| **enabled** | `boolean` |  | [Optional] [Defaults to `true`] |

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


## setSubscriptionApiV1NotificationSubscriptionPost_0

> any setSubscriptionApiV1NotificationSubscriptionPost_0(type, category, enabled)

设置订阅

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { SetSubscriptionApiV1NotificationSubscriptionPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  const body = {
    // string
    type: type_example,
    // string
    category: category_example,
    // boolean (optional)
    enabled: true,
  } satisfies SetSubscriptionApiV1NotificationSubscriptionPost0Request;

  try {
    const data = await api.setSubscriptionApiV1NotificationSubscriptionPost_0(body);
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
| **type** | `string` |  | [Defaults to `undefined`] |
| **category** | `string` |  | [Defaults to `undefined`] |
| **enabled** | `boolean` |  | [Optional] [Defaults to `true`] |

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


## subscriptionListApiV1NotificationSubscriptionListGet

> any subscriptionListApiV1NotificationSubscriptionListGet()

我的订阅偏好

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { SubscriptionListApiV1NotificationSubscriptionListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  try {
    const data = await api.subscriptionListApiV1NotificationSubscriptionListGet();
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


## subscriptionListApiV1NotificationSubscriptionListGet_0

> any subscriptionListApiV1NotificationSubscriptionListGet_0()

我的订阅偏好

### Example

```ts
import {
  Configuration,
  NotificationApi,
} from '';
import type { SubscriptionListApiV1NotificationSubscriptionListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new NotificationApi();

  try {
    const data = await api.subscriptionListApiV1NotificationSubscriptionListGet_0();
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

