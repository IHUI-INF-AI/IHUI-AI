# MessageApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**batchDeleteApiV1MessageBatchDeleteDelete**](#batchdeleteapiv1messagebatchdeletedelete) | **DELETE** /api/v1/message/batch-delete | 批量删除|
|[**batchDeleteApiV1MessageBatchDeleteDelete_0**](#batchdeleteapiv1messagebatchdeletedelete_0) | **DELETE** /api/v1/message/batch-delete | 批量删除|
|[**createAnnouncementApiV1MessageAnnouncementPost**](#createannouncementapiv1messageannouncementpost) | **POST** /api/v1/message/announcement | 发布公告|
|[**createAnnouncementApiV1MessageAnnouncementPost_0**](#createannouncementapiv1messageannouncementpost_0) | **POST** /api/v1/message/announcement | 发布公告|
|[**createTemplateApiV1MessageTemplatePost**](#createtemplateapiv1messagetemplatepost) | **POST** /api/v1/message/template | 新增模板|
|[**createTemplateApiV1MessageTemplatePost_0**](#createtemplateapiv1messagetemplatepost_0) | **POST** /api/v1/message/template | 新增模板|
|[**deleteAnnouncementApiV1MessageAnnouncementAidDelete**](#deleteannouncementapiv1messageannouncementaiddelete) | **DELETE** /api/v1/message/announcement/{aid} | 删除公告|
|[**deleteAnnouncementApiV1MessageAnnouncementAidDelete_0**](#deleteannouncementapiv1messageannouncementaiddelete_0) | **DELETE** /api/v1/message/announcement/{aid} | 删除公告|
|[**deleteMessageApiV1MessageMidDelete**](#deletemessageapiv1messagemiddelete) | **DELETE** /api/v1/message/{mid} | 删除消息|
|[**deleteMessageApiV1MessageMidDelete_0**](#deletemessageapiv1messagemiddelete_0) | **DELETE** /api/v1/message/{mid} | 删除消息|
|[**getAnnouncementApiV1MessageAnnouncementAidGet**](#getannouncementapiv1messageannouncementaidget) | **GET** /api/v1/message/announcement/{aid} | 公告详情|
|[**getAnnouncementApiV1MessageAnnouncementAidGet_0**](#getannouncementapiv1messageannouncementaidget_0) | **GET** /api/v1/message/announcement/{aid} | 公告详情|
|[**listAnnouncementsApiV1MessageAnnouncementListGet**](#listannouncementsapiv1messageannouncementlistget) | **GET** /api/v1/message/announcement/list | 公告列表|
|[**listAnnouncementsApiV1MessageAnnouncementListGet_0**](#listannouncementsapiv1messageannouncementlistget_0) | **GET** /api/v1/message/announcement/list | 公告列表|
|[**listMessagesApiV1MessageListGet**](#listmessagesapiv1messagelistget) | **GET** /api/v1/message/list | 我的消息列表|
|[**listMessagesApiV1MessageListGet_0**](#listmessagesapiv1messagelistget_0) | **GET** /api/v1/message/list | 我的消息列表|
|[**markReadApiV1MessageMidReadPost**](#markreadapiv1messagemidreadpost) | **POST** /api/v1/message/{mid}/read | 标记已读|
|[**markReadApiV1MessageMidReadPost_0**](#markreadapiv1messagemidreadpost_0) | **POST** /api/v1/message/{mid}/read | 标记已读|
|[**messageMarkAllRead**](#messagemarkallread) | **POST** /api/v1/message/read-all | 全部标记已读|
|[**messageMarkAllRead_0**](#messagemarkallread_0) | **POST** /api/v1/message/read-all | 全部标记已读|
|[**messageUnreadCount**](#messageunreadcount) | **GET** /api/v1/message/unread-count | 未读消息数|
|[**messageUnreadCount_0**](#messageunreadcount_0) | **GET** /api/v1/message/unread-count | 未读消息数|
|[**sendPrivateApiV1MessagePrivatePost**](#sendprivateapiv1messageprivatepost) | **POST** /api/v1/message/private | 发送私信|
|[**sendPrivateApiV1MessagePrivatePost_0**](#sendprivateapiv1messageprivatepost_0) | **POST** /api/v1/message/private | 发送私信|
|[**templateListApiV1MessageTemplateListGet**](#templatelistapiv1messagetemplatelistget) | **GET** /api/v1/message/template/list | 消息模板列表|
|[**templateListApiV1MessageTemplateListGet_0**](#templatelistapiv1messagetemplatelistget_0) | **GET** /api/v1/message/template/list | 消息模板列表|
|[**updateAnnouncementApiV1MessageAnnouncementAidPut**](#updateannouncementapiv1messageannouncementaidput) | **PUT** /api/v1/message/announcement/{aid} | 修改公告|
|[**updateAnnouncementApiV1MessageAnnouncementAidPut_0**](#updateannouncementapiv1messageannouncementaidput_0) | **PUT** /api/v1/message/announcement/{aid} | 修改公告|

# **batchDeleteApiV1MessageBatchDeleteDelete**
> any batchDeleteApiV1MessageBatchDeleteDelete()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let ids: string; //ID列表,逗号分隔 (default to undefined)

const { status, data } = await apiInstance.batchDeleteApiV1MessageBatchDeleteDelete(
    ids
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **ids** | [**string**] | ID列表,逗号分隔 | defaults to undefined|


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

# **batchDeleteApiV1MessageBatchDeleteDelete_0**
> any batchDeleteApiV1MessageBatchDeleteDelete_0()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let ids: string; //ID列表,逗号分隔 (default to undefined)

const { status, data } = await apiInstance.batchDeleteApiV1MessageBatchDeleteDelete_0(
    ids
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **ids** | [**string**] | ID列表,逗号分隔 | defaults to undefined|


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

# **createAnnouncementApiV1MessageAnnouncementPost**
> any createAnnouncementApiV1MessageAnnouncementPost()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let title: string; // (default to undefined)
let content: string; // (default to undefined)
let cover: string; // (optional) (default to undefined)
let type: number; // (optional) (default to 1)
let priority: number; // (optional) (default to 1)
let targetUser: string; // (optional) (default to 'all')
let targetUrl: string; // (optional) (default to undefined)
let publishTime: string; // (optional) (default to undefined)
let expireTime: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createAnnouncementApiV1MessageAnnouncementPost(
    title,
    content,
    cover,
    type,
    priority,
    targetUser,
    targetUrl,
    publishTime,
    expireTime
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **cover** | [**string**] |  | (optional) defaults to undefined|
| **type** | [**number**] |  | (optional) defaults to 1|
| **priority** | [**number**] |  | (optional) defaults to 1|
| **targetUser** | [**string**] |  | (optional) defaults to 'all'|
| **targetUrl** | [**string**] |  | (optional) defaults to undefined|
| **publishTime** | [**string**] |  | (optional) defaults to undefined|
| **expireTime** | [**string**] |  | (optional) defaults to undefined|


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

# **createAnnouncementApiV1MessageAnnouncementPost_0**
> any createAnnouncementApiV1MessageAnnouncementPost_0()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let title: string; // (default to undefined)
let content: string; // (default to undefined)
let cover: string; // (optional) (default to undefined)
let type: number; // (optional) (default to 1)
let priority: number; // (optional) (default to 1)
let targetUser: string; // (optional) (default to 'all')
let targetUrl: string; // (optional) (default to undefined)
let publishTime: string; // (optional) (default to undefined)
let expireTime: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createAnnouncementApiV1MessageAnnouncementPost_0(
    title,
    content,
    cover,
    type,
    priority,
    targetUser,
    targetUrl,
    publishTime,
    expireTime
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **cover** | [**string**] |  | (optional) defaults to undefined|
| **type** | [**number**] |  | (optional) defaults to 1|
| **priority** | [**number**] |  | (optional) defaults to 1|
| **targetUser** | [**string**] |  | (optional) defaults to 'all'|
| **targetUrl** | [**string**] |  | (optional) defaults to undefined|
| **publishTime** | [**string**] |  | (optional) defaults to undefined|
| **expireTime** | [**string**] |  | (optional) defaults to undefined|


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

# **createTemplateApiV1MessageTemplatePost**
> any createTemplateApiV1MessageTemplatePost()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let code: string; // (default to undefined)
let name: string; // (default to undefined)
let type: string; // (default to undefined)
let content: string; // (default to undefined)
let subject: string; // (optional) (default to undefined)
let variables: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createTemplateApiV1MessageTemplatePost(
    code,
    name,
    type,
    content,
    subject,
    variables
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] |  | defaults to undefined|
| **name** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **subject** | [**string**] |  | (optional) defaults to undefined|
| **variables** | [**string**] |  | (optional) defaults to undefined|


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

# **createTemplateApiV1MessageTemplatePost_0**
> any createTemplateApiV1MessageTemplatePost_0()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let code: string; // (default to undefined)
let name: string; // (default to undefined)
let type: string; // (default to undefined)
let content: string; // (default to undefined)
let subject: string; // (optional) (default to undefined)
let variables: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createTemplateApiV1MessageTemplatePost_0(
    code,
    name,
    type,
    content,
    subject,
    variables
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] |  | defaults to undefined|
| **name** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **subject** | [**string**] |  | (optional) defaults to undefined|
| **variables** | [**string**] |  | (optional) defaults to undefined|


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

# **deleteAnnouncementApiV1MessageAnnouncementAidDelete**
> any deleteAnnouncementApiV1MessageAnnouncementAidDelete()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let aid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteAnnouncementApiV1MessageAnnouncementAidDelete(
    aid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|


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

# **deleteAnnouncementApiV1MessageAnnouncementAidDelete_0**
> any deleteAnnouncementApiV1MessageAnnouncementAidDelete_0()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let aid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteAnnouncementApiV1MessageAnnouncementAidDelete_0(
    aid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|


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

# **deleteMessageApiV1MessageMidDelete**
> any deleteMessageApiV1MessageMidDelete()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let mid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteMessageApiV1MessageMidDelete(
    mid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **mid** | [**number**] |  | defaults to undefined|


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

# **deleteMessageApiV1MessageMidDelete_0**
> any deleteMessageApiV1MessageMidDelete_0()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let mid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteMessageApiV1MessageMidDelete_0(
    mid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **mid** | [**number**] |  | defaults to undefined|


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

# **getAnnouncementApiV1MessageAnnouncementAidGet**
> any getAnnouncementApiV1MessageAnnouncementAidGet()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let aid: number; // (default to undefined)

const { status, data } = await apiInstance.getAnnouncementApiV1MessageAnnouncementAidGet(
    aid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|


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

# **getAnnouncementApiV1MessageAnnouncementAidGet_0**
> any getAnnouncementApiV1MessageAnnouncementAidGet_0()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let aid: number; // (default to undefined)

const { status, data } = await apiInstance.getAnnouncementApiV1MessageAnnouncementAidGet_0(
    aid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|


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

# **listAnnouncementsApiV1MessageAnnouncementListGet**
> any listAnnouncementsApiV1MessageAnnouncementListGet()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let type: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listAnnouncementsApiV1MessageAnnouncementListGet(
    page,
    limit,
    type
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **type** | [**number**] |  | (optional) defaults to undefined|


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

# **listAnnouncementsApiV1MessageAnnouncementListGet_0**
> any listAnnouncementsApiV1MessageAnnouncementListGet_0()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let type: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listAnnouncementsApiV1MessageAnnouncementListGet_0(
    page,
    limit,
    type
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **type** | [**number**] |  | (optional) defaults to undefined|


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

# **listMessagesApiV1MessageListGet**
> any listMessagesApiV1MessageListGet()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let type: string; // (optional) (default to undefined)
let isRead: boolean; // (optional) (default to undefined)

const { status, data } = await apiInstance.listMessagesApiV1MessageListGet(
    page,
    limit,
    type,
    isRead
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **type** | [**string**] |  | (optional) defaults to undefined|
| **isRead** | [**boolean**] |  | (optional) defaults to undefined|


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

# **listMessagesApiV1MessageListGet_0**
> any listMessagesApiV1MessageListGet_0()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let type: string; // (optional) (default to undefined)
let isRead: boolean; // (optional) (default to undefined)

const { status, data } = await apiInstance.listMessagesApiV1MessageListGet_0(
    page,
    limit,
    type,
    isRead
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **type** | [**string**] |  | (optional) defaults to undefined|
| **isRead** | [**boolean**] |  | (optional) defaults to undefined|


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

# **markReadApiV1MessageMidReadPost**
> any markReadApiV1MessageMidReadPost()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let mid: number; // (default to undefined)

const { status, data } = await apiInstance.markReadApiV1MessageMidReadPost(
    mid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **mid** | [**number**] |  | defaults to undefined|


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

# **markReadApiV1MessageMidReadPost_0**
> any markReadApiV1MessageMidReadPost_0()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let mid: number; // (default to undefined)

const { status, data } = await apiInstance.markReadApiV1MessageMidReadPost_0(
    mid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **mid** | [**number**] |  | defaults to undefined|


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

# **messageMarkAllRead**
> any messageMarkAllRead()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

const { status, data } = await apiInstance.messageMarkAllRead();
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

# **messageMarkAllRead_0**
> any messageMarkAllRead_0()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

const { status, data } = await apiInstance.messageMarkAllRead_0();
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

# **messageUnreadCount**
> any messageUnreadCount()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

const { status, data } = await apiInstance.messageUnreadCount();
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

# **messageUnreadCount_0**
> any messageUnreadCount_0()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

const { status, data } = await apiInstance.messageUnreadCount_0();
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

# **sendPrivateApiV1MessagePrivatePost**
> any sendPrivateApiV1MessagePrivatePost()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let toUserId: string; // (default to undefined)
let content: string; // (default to undefined)
let title: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.sendPrivateApiV1MessagePrivatePost(
    toUserId,
    content,
    title
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **toUserId** | [**string**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **title** | [**string**] |  | (optional) defaults to undefined|


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

# **sendPrivateApiV1MessagePrivatePost_0**
> any sendPrivateApiV1MessagePrivatePost_0()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let toUserId: string; // (default to undefined)
let content: string; // (default to undefined)
let title: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.sendPrivateApiV1MessagePrivatePost_0(
    toUserId,
    content,
    title
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **toUserId** | [**string**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **title** | [**string**] |  | (optional) defaults to undefined|


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

# **templateListApiV1MessageTemplateListGet**
> any templateListApiV1MessageTemplateListGet()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let type: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.templateListApiV1MessageTemplateListGet(
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

# **templateListApiV1MessageTemplateListGet_0**
> any templateListApiV1MessageTemplateListGet_0()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let type: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.templateListApiV1MessageTemplateListGet_0(
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

# **updateAnnouncementApiV1MessageAnnouncementAidPut**
> any updateAnnouncementApiV1MessageAnnouncementAidPut()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let aid: number; // (default to undefined)
let title: string; // (optional) (default to undefined)
let content: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let priority: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateAnnouncementApiV1MessageAnnouncementAidPut(
    aid,
    title,
    content,
    status,
    priority
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|
| **title** | [**string**] |  | (optional) defaults to undefined|
| **content** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
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

# **updateAnnouncementApiV1MessageAnnouncementAidPut_0**
> any updateAnnouncementApiV1MessageAnnouncementAidPut_0()


### Example

```typescript
import {
    MessageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MessageApi(configuration);

let aid: number; // (default to undefined)
let title: string; // (optional) (default to undefined)
let content: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let priority: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateAnnouncementApiV1MessageAnnouncementAidPut_0(
    aid,
    title,
    content,
    status,
    priority
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|
| **title** | [**string**] |  | (optional) defaults to undefined|
| **content** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
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

