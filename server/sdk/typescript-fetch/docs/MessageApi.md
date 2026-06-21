# MessageApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**batchDeleteApiV1MessageBatchDeleteDelete**](MessageApi.md#batchdeleteapiv1messagebatchdeletedelete) | **DELETE** /api/v1/message/batch-delete | 批量删除 |
| [**batchDeleteApiV1MessageBatchDeleteDelete_0**](MessageApi.md#batchdeleteapiv1messagebatchdeletedelete_0) | **DELETE** /api/v1/message/batch-delete | 批量删除 |
| [**createAnnouncementApiV1MessageAnnouncementPost**](MessageApi.md#createannouncementapiv1messageannouncementpost) | **POST** /api/v1/message/announcement | 发布公告 |
| [**createAnnouncementApiV1MessageAnnouncementPost_0**](MessageApi.md#createannouncementapiv1messageannouncementpost_0) | **POST** /api/v1/message/announcement | 发布公告 |
| [**createTemplateApiV1MessageTemplatePost**](MessageApi.md#createtemplateapiv1messagetemplatepost) | **POST** /api/v1/message/template | 新增模板 |
| [**createTemplateApiV1MessageTemplatePost_0**](MessageApi.md#createtemplateapiv1messagetemplatepost_0) | **POST** /api/v1/message/template | 新增模板 |
| [**deleteAnnouncementApiV1MessageAnnouncementAidDelete**](MessageApi.md#deleteannouncementapiv1messageannouncementaiddelete) | **DELETE** /api/v1/message/announcement/{aid} | 删除公告 |
| [**deleteAnnouncementApiV1MessageAnnouncementAidDelete_0**](MessageApi.md#deleteannouncementapiv1messageannouncementaiddelete_0) | **DELETE** /api/v1/message/announcement/{aid} | 删除公告 |
| [**deleteMessageApiV1MessageMidDelete**](MessageApi.md#deletemessageapiv1messagemiddelete) | **DELETE** /api/v1/message/{mid} | 删除消息 |
| [**deleteMessageApiV1MessageMidDelete_0**](MessageApi.md#deletemessageapiv1messagemiddelete_0) | **DELETE** /api/v1/message/{mid} | 删除消息 |
| [**getAnnouncementApiV1MessageAnnouncementAidGet**](MessageApi.md#getannouncementapiv1messageannouncementaidget) | **GET** /api/v1/message/announcement/{aid} | 公告详情 |
| [**getAnnouncementApiV1MessageAnnouncementAidGet_0**](MessageApi.md#getannouncementapiv1messageannouncementaidget_0) | **GET** /api/v1/message/announcement/{aid} | 公告详情 |
| [**listAnnouncementsApiV1MessageAnnouncementListGet**](MessageApi.md#listannouncementsapiv1messageannouncementlistget) | **GET** /api/v1/message/announcement/list | 公告列表 |
| [**listAnnouncementsApiV1MessageAnnouncementListGet_0**](MessageApi.md#listannouncementsapiv1messageannouncementlistget_0) | **GET** /api/v1/message/announcement/list | 公告列表 |
| [**listMessagesApiV1MessageListGet**](MessageApi.md#listmessagesapiv1messagelistget) | **GET** /api/v1/message/list | 我的消息列表 |
| [**listMessagesApiV1MessageListGet_0**](MessageApi.md#listmessagesapiv1messagelistget_0) | **GET** /api/v1/message/list | 我的消息列表 |
| [**markReadApiV1MessageMidReadPost**](MessageApi.md#markreadapiv1messagemidreadpost) | **POST** /api/v1/message/{mid}/read | 标记已读 |
| [**markReadApiV1MessageMidReadPost_0**](MessageApi.md#markreadapiv1messagemidreadpost_0) | **POST** /api/v1/message/{mid}/read | 标记已读 |
| [**messageMarkAllRead**](MessageApi.md#messagemarkallread) | **POST** /api/v1/message/read-all | 全部标记已读 |
| [**messageMarkAllRead_0**](MessageApi.md#messagemarkallread_0) | **POST** /api/v1/message/read-all | 全部标记已读 |
| [**messageUnreadCount**](MessageApi.md#messageunreadcount) | **GET** /api/v1/message/unread-count | 未读消息数 |
| [**messageUnreadCount_0**](MessageApi.md#messageunreadcount_0) | **GET** /api/v1/message/unread-count | 未读消息数 |
| [**sendPrivateApiV1MessagePrivatePost**](MessageApi.md#sendprivateapiv1messageprivatepost) | **POST** /api/v1/message/private | 发送私信 |
| [**sendPrivateApiV1MessagePrivatePost_0**](MessageApi.md#sendprivateapiv1messageprivatepost_0) | **POST** /api/v1/message/private | 发送私信 |
| [**templateListApiV1MessageTemplateListGet**](MessageApi.md#templatelistapiv1messagetemplatelistget) | **GET** /api/v1/message/template/list | 消息模板列表 |
| [**templateListApiV1MessageTemplateListGet_0**](MessageApi.md#templatelistapiv1messagetemplatelistget_0) | **GET** /api/v1/message/template/list | 消息模板列表 |
| [**updateAnnouncementApiV1MessageAnnouncementAidPut**](MessageApi.md#updateannouncementapiv1messageannouncementaidput) | **PUT** /api/v1/message/announcement/{aid} | 修改公告 |
| [**updateAnnouncementApiV1MessageAnnouncementAidPut_0**](MessageApi.md#updateannouncementapiv1messageannouncementaidput_0) | **PUT** /api/v1/message/announcement/{aid} | 修改公告 |



## batchDeleteApiV1MessageBatchDeleteDelete

> any batchDeleteApiV1MessageBatchDeleteDelete(ids)

批量删除

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { BatchDeleteApiV1MessageBatchDeleteDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // string | ID列表,逗号分隔
    ids: ids_example,
  } satisfies BatchDeleteApiV1MessageBatchDeleteDeleteRequest;

  try {
    const data = await api.batchDeleteApiV1MessageBatchDeleteDelete(body);
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
| **ids** | `string` | ID列表,逗号分隔 | [Defaults to `undefined`] |

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


## batchDeleteApiV1MessageBatchDeleteDelete_0

> any batchDeleteApiV1MessageBatchDeleteDelete_0(ids)

批量删除

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { BatchDeleteApiV1MessageBatchDeleteDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // string | ID列表,逗号分隔
    ids: ids_example,
  } satisfies BatchDeleteApiV1MessageBatchDeleteDelete0Request;

  try {
    const data = await api.batchDeleteApiV1MessageBatchDeleteDelete_0(body);
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
| **ids** | `string` | ID列表,逗号分隔 | [Defaults to `undefined`] |

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


## createAnnouncementApiV1MessageAnnouncementPost

> any createAnnouncementApiV1MessageAnnouncementPost(title, content, cover, type, priority, targetUser, targetUrl, publishTime, expireTime)

发布公告

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { CreateAnnouncementApiV1MessageAnnouncementPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // string
    title: title_example,
    // string
    content: content_example,
    // string (optional)
    cover: cover_example,
    // number (optional)
    type: 56,
    // number (optional)
    priority: 56,
    // string (optional)
    targetUser: targetUser_example,
    // string (optional)
    targetUrl: targetUrl_example,
    // Date (optional)
    publishTime: 2013-10-20T19:20:30+01:00,
    // Date (optional)
    expireTime: 2013-10-20T19:20:30+01:00,
  } satisfies CreateAnnouncementApiV1MessageAnnouncementPostRequest;

  try {
    const data = await api.createAnnouncementApiV1MessageAnnouncementPost(body);
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
| **cover** | `string` |  | [Optional] [Defaults to `undefined`] |
| **type** | `number` |  | [Optional] [Defaults to `1`] |
| **priority** | `number` |  | [Optional] [Defaults to `1`] |
| **targetUser** | `string` |  | [Optional] [Defaults to `&#39;all&#39;`] |
| **targetUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **publishTime** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **expireTime** | `Date` |  | [Optional] [Defaults to `undefined`] |

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


## createAnnouncementApiV1MessageAnnouncementPost_0

> any createAnnouncementApiV1MessageAnnouncementPost_0(title, content, cover, type, priority, targetUser, targetUrl, publishTime, expireTime)

发布公告

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { CreateAnnouncementApiV1MessageAnnouncementPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // string
    title: title_example,
    // string
    content: content_example,
    // string (optional)
    cover: cover_example,
    // number (optional)
    type: 56,
    // number (optional)
    priority: 56,
    // string (optional)
    targetUser: targetUser_example,
    // string (optional)
    targetUrl: targetUrl_example,
    // Date (optional)
    publishTime: 2013-10-20T19:20:30+01:00,
    // Date (optional)
    expireTime: 2013-10-20T19:20:30+01:00,
  } satisfies CreateAnnouncementApiV1MessageAnnouncementPost0Request;

  try {
    const data = await api.createAnnouncementApiV1MessageAnnouncementPost_0(body);
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
| **cover** | `string` |  | [Optional] [Defaults to `undefined`] |
| **type** | `number` |  | [Optional] [Defaults to `1`] |
| **priority** | `number` |  | [Optional] [Defaults to `1`] |
| **targetUser** | `string` |  | [Optional] [Defaults to `&#39;all&#39;`] |
| **targetUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **publishTime** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **expireTime** | `Date` |  | [Optional] [Defaults to `undefined`] |

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


## createTemplateApiV1MessageTemplatePost

> any createTemplateApiV1MessageTemplatePost(code, name, type, content, subject, variables)

新增模板

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { CreateTemplateApiV1MessageTemplatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // string
    code: code_example,
    // string
    name: name_example,
    // string
    type: type_example,
    // string
    content: content_example,
    // string (optional)
    subject: subject_example,
    // string (optional)
    variables: variables_example,
  } satisfies CreateTemplateApiV1MessageTemplatePostRequest;

  try {
    const data = await api.createTemplateApiV1MessageTemplatePost(body);
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
| **code** | `string` |  | [Defaults to `undefined`] |
| **name** | `string` |  | [Defaults to `undefined`] |
| **type** | `string` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Defaults to `undefined`] |
| **subject** | `string` |  | [Optional] [Defaults to `undefined`] |
| **variables** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## createTemplateApiV1MessageTemplatePost_0

> any createTemplateApiV1MessageTemplatePost_0(code, name, type, content, subject, variables)

新增模板

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { CreateTemplateApiV1MessageTemplatePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // string
    code: code_example,
    // string
    name: name_example,
    // string
    type: type_example,
    // string
    content: content_example,
    // string (optional)
    subject: subject_example,
    // string (optional)
    variables: variables_example,
  } satisfies CreateTemplateApiV1MessageTemplatePost0Request;

  try {
    const data = await api.createTemplateApiV1MessageTemplatePost_0(body);
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
| **code** | `string` |  | [Defaults to `undefined`] |
| **name** | `string` |  | [Defaults to `undefined`] |
| **type** | `string` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Defaults to `undefined`] |
| **subject** | `string` |  | [Optional] [Defaults to `undefined`] |
| **variables** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## deleteAnnouncementApiV1MessageAnnouncementAidDelete

> any deleteAnnouncementApiV1MessageAnnouncementAidDelete(aid)

删除公告

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { DeleteAnnouncementApiV1MessageAnnouncementAidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // number
    aid: 56,
  } satisfies DeleteAnnouncementApiV1MessageAnnouncementAidDeleteRequest;

  try {
    const data = await api.deleteAnnouncementApiV1MessageAnnouncementAidDelete(body);
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
| **aid** | `number` |  | [Defaults to `undefined`] |

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


## deleteAnnouncementApiV1MessageAnnouncementAidDelete_0

> any deleteAnnouncementApiV1MessageAnnouncementAidDelete_0(aid)

删除公告

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { DeleteAnnouncementApiV1MessageAnnouncementAidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // number
    aid: 56,
  } satisfies DeleteAnnouncementApiV1MessageAnnouncementAidDelete0Request;

  try {
    const data = await api.deleteAnnouncementApiV1MessageAnnouncementAidDelete_0(body);
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
| **aid** | `number` |  | [Defaults to `undefined`] |

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


## deleteMessageApiV1MessageMidDelete

> any deleteMessageApiV1MessageMidDelete(mid)

删除消息

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { DeleteMessageApiV1MessageMidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // number
    mid: 56,
  } satisfies DeleteMessageApiV1MessageMidDeleteRequest;

  try {
    const data = await api.deleteMessageApiV1MessageMidDelete(body);
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
| **mid** | `number` |  | [Defaults to `undefined`] |

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


## deleteMessageApiV1MessageMidDelete_0

> any deleteMessageApiV1MessageMidDelete_0(mid)

删除消息

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { DeleteMessageApiV1MessageMidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // number
    mid: 56,
  } satisfies DeleteMessageApiV1MessageMidDelete0Request;

  try {
    const data = await api.deleteMessageApiV1MessageMidDelete_0(body);
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
| **mid** | `number` |  | [Defaults to `undefined`] |

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


## getAnnouncementApiV1MessageAnnouncementAidGet

> any getAnnouncementApiV1MessageAnnouncementAidGet(aid)

公告详情

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { GetAnnouncementApiV1MessageAnnouncementAidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // number
    aid: 56,
  } satisfies GetAnnouncementApiV1MessageAnnouncementAidGetRequest;

  try {
    const data = await api.getAnnouncementApiV1MessageAnnouncementAidGet(body);
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
| **aid** | `number` |  | [Defaults to `undefined`] |

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


## getAnnouncementApiV1MessageAnnouncementAidGet_0

> any getAnnouncementApiV1MessageAnnouncementAidGet_0(aid)

公告详情

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { GetAnnouncementApiV1MessageAnnouncementAidGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // number
    aid: 56,
  } satisfies GetAnnouncementApiV1MessageAnnouncementAidGet0Request;

  try {
    const data = await api.getAnnouncementApiV1MessageAnnouncementAidGet_0(body);
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
| **aid** | `number` |  | [Defaults to `undefined`] |

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


## listAnnouncementsApiV1MessageAnnouncementListGet

> any listAnnouncementsApiV1MessageAnnouncementListGet(page, limit, type)

公告列表

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { ListAnnouncementsApiV1MessageAnnouncementListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    type: 56,
  } satisfies ListAnnouncementsApiV1MessageAnnouncementListGetRequest;

  try {
    const data = await api.listAnnouncementsApiV1MessageAnnouncementListGet(body);
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
| **type** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## listAnnouncementsApiV1MessageAnnouncementListGet_0

> any listAnnouncementsApiV1MessageAnnouncementListGet_0(page, limit, type)

公告列表

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { ListAnnouncementsApiV1MessageAnnouncementListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    type: 56,
  } satisfies ListAnnouncementsApiV1MessageAnnouncementListGet0Request;

  try {
    const data = await api.listAnnouncementsApiV1MessageAnnouncementListGet_0(body);
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
| **type** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## listMessagesApiV1MessageListGet

> any listMessagesApiV1MessageListGet(page, limit, type, isRead)

我的消息列表

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { ListMessagesApiV1MessageListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    type: type_example,
    // boolean (optional)
    isRead: true,
  } satisfies ListMessagesApiV1MessageListGetRequest;

  try {
    const data = await api.listMessagesApiV1MessageListGet(body);
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
| **isRead** | `boolean` |  | [Optional] [Defaults to `undefined`] |

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


## listMessagesApiV1MessageListGet_0

> any listMessagesApiV1MessageListGet_0(page, limit, type, isRead)

我的消息列表

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { ListMessagesApiV1MessageListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    type: type_example,
    // boolean (optional)
    isRead: true,
  } satisfies ListMessagesApiV1MessageListGet0Request;

  try {
    const data = await api.listMessagesApiV1MessageListGet_0(body);
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
| **isRead** | `boolean` |  | [Optional] [Defaults to `undefined`] |

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


## markReadApiV1MessageMidReadPost

> any markReadApiV1MessageMidReadPost(mid)

标记已读

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { MarkReadApiV1MessageMidReadPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // number
    mid: 56,
  } satisfies MarkReadApiV1MessageMidReadPostRequest;

  try {
    const data = await api.markReadApiV1MessageMidReadPost(body);
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
| **mid** | `number` |  | [Defaults to `undefined`] |

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


## markReadApiV1MessageMidReadPost_0

> any markReadApiV1MessageMidReadPost_0(mid)

标记已读

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { MarkReadApiV1MessageMidReadPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // number
    mid: 56,
  } satisfies MarkReadApiV1MessageMidReadPost0Request;

  try {
    const data = await api.markReadApiV1MessageMidReadPost_0(body);
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
| **mid** | `number` |  | [Defaults to `undefined`] |

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


## messageMarkAllRead

> any messageMarkAllRead()

全部标记已读

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { MessageMarkAllReadRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  try {
    const data = await api.messageMarkAllRead();
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


## messageMarkAllRead_0

> any messageMarkAllRead_0()

全部标记已读

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { MessageMarkAllRead0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  try {
    const data = await api.messageMarkAllRead_0();
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


## messageUnreadCount

> any messageUnreadCount()

未读消息数

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { MessageUnreadCountRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  try {
    const data = await api.messageUnreadCount();
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


## messageUnreadCount_0

> any messageUnreadCount_0()

未读消息数

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { MessageUnreadCount0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  try {
    const data = await api.messageUnreadCount_0();
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


## sendPrivateApiV1MessagePrivatePost

> any sendPrivateApiV1MessagePrivatePost(toUserId, content, title)

发送私信

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { SendPrivateApiV1MessagePrivatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // string
    toUserId: toUserId_example,
    // string
    content: content_example,
    // string (optional)
    title: title_example,
  } satisfies SendPrivateApiV1MessagePrivatePostRequest;

  try {
    const data = await api.sendPrivateApiV1MessagePrivatePost(body);
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
| **toUserId** | `string` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## sendPrivateApiV1MessagePrivatePost_0

> any sendPrivateApiV1MessagePrivatePost_0(toUserId, content, title)

发送私信

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { SendPrivateApiV1MessagePrivatePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // string
    toUserId: toUserId_example,
    // string
    content: content_example,
    // string (optional)
    title: title_example,
  } satisfies SendPrivateApiV1MessagePrivatePost0Request;

  try {
    const data = await api.sendPrivateApiV1MessagePrivatePost_0(body);
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
| **toUserId** | `string` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## templateListApiV1MessageTemplateListGet

> any templateListApiV1MessageTemplateListGet(type)

消息模板列表

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { TemplateListApiV1MessageTemplateListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // string (optional)
    type: type_example,
  } satisfies TemplateListApiV1MessageTemplateListGetRequest;

  try {
    const data = await api.templateListApiV1MessageTemplateListGet(body);
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


## templateListApiV1MessageTemplateListGet_0

> any templateListApiV1MessageTemplateListGet_0(type)

消息模板列表

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { TemplateListApiV1MessageTemplateListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // string (optional)
    type: type_example,
  } satisfies TemplateListApiV1MessageTemplateListGet0Request;

  try {
    const data = await api.templateListApiV1MessageTemplateListGet_0(body);
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


## updateAnnouncementApiV1MessageAnnouncementAidPut

> any updateAnnouncementApiV1MessageAnnouncementAidPut(aid, title, content, status, priority)

修改公告

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { UpdateAnnouncementApiV1MessageAnnouncementAidPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // number
    aid: 56,
    // string (optional)
    title: title_example,
    // string (optional)
    content: content_example,
    // number (optional)
    status: 56,
    // number (optional)
    priority: 56,
  } satisfies UpdateAnnouncementApiV1MessageAnnouncementAidPutRequest;

  try {
    const data = await api.updateAnnouncementApiV1MessageAnnouncementAidPut(body);
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
| **aid** | `number` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |
| **content** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **priority** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## updateAnnouncementApiV1MessageAnnouncementAidPut_0

> any updateAnnouncementApiV1MessageAnnouncementAidPut_0(aid, title, content, status, priority)

修改公告

### Example

```ts
import {
  Configuration,
  MessageApi,
} from '';
import type { UpdateAnnouncementApiV1MessageAnnouncementAidPut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MessageApi();

  const body = {
    // number
    aid: 56,
    // string (optional)
    title: title_example,
    // string (optional)
    content: content_example,
    // number (optional)
    status: 56,
    // number (optional)
    priority: 56,
  } satisfies UpdateAnnouncementApiV1MessageAnnouncementAidPut0Request;

  try {
    const data = await api.updateAnnouncementApiV1MessageAnnouncementAidPut_0(body);
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
| **aid** | `number` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |
| **content** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **priority** | `number` |  | [Optional] [Defaults to `undefined`] |

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

