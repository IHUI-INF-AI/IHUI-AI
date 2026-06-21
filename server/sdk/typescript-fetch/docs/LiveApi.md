# LiveApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addCommentApiV1LiveChannelCidCommentPost**](LiveApi.md#addcommentapiv1livechannelcidcommentpost) | **POST** /api/v1/live/channel/{cid}/comment | 发表评论 |
| [**addCommentApiV1LiveChannelCidCommentPost_0**](LiveApi.md#addcommentapiv1livechannelcidcommentpost_0) | **POST** /api/v1/live/channel/{cid}/comment | 发表评论 |
| [**getChannelApiV1LiveChannelCidGet**](LiveApi.md#getchannelapiv1livechannelcidget) | **GET** /api/v1/live/channel/{cid} | 直播详情 |
| [**getChannelApiV1LiveChannelCidGet_0**](LiveApi.md#getchannelapiv1livechannelcidget_0) | **GET** /api/v1/live/channel/{cid} | 直播详情 |
| [**listChannelsApiV1LiveChannelListGet**](LiveApi.md#listchannelsapiv1livechannellistget) | **GET** /api/v1/live/channel/list | 直播列表 |
| [**listChannelsApiV1LiveChannelListGet_0**](LiveApi.md#listchannelsapiv1livechannellistget_0) | **GET** /api/v1/live/channel/list | 直播列表 |
| [**listCommentsApiV1LiveChannelCidCommentsGet**](LiveApi.md#listcommentsapiv1livechannelcidcommentsget) | **GET** /api/v1/live/channel/{cid}/comments | 评论列表 |
| [**listCommentsApiV1LiveChannelCidCommentsGet_0**](LiveApi.md#listcommentsapiv1livechannelcidcommentsget_0) | **GET** /api/v1/live/channel/{cid}/comments | 评论列表 |
| [**liveChannelCategoryList**](LiveApi.md#livechannelcategorylist) | **GET** /api/v1/live/category/list | 直播分类 |
| [**liveChannelCategoryList_0**](LiveApi.md#livechannelcategorylist_0) | **GET** /api/v1/live/category/list | 直播分类 |
| [**liveCreateChannel**](LiveApi.md#livecreatechannel) | **POST** /api/v1/live/channel | 创建直播 |
| [**liveCreateChannel_0**](LiveApi.md#livecreatechannel_0) | **POST** /api/v1/live/channel | 创建直播 |
| [**liveDeleteChannel**](LiveApi.md#livedeletechannel) | **DELETE** /api/v1/live/channel/{cid} | 删除直播 |
| [**liveDeleteChannel_0**](LiveApi.md#livedeletechannel_0) | **DELETE** /api/v1/live/channel/{cid} | 删除直播 |
| [**liveUpdateChannel**](LiveApi.md#liveupdatechannel) | **PUT** /api/v1/live/channel/{cid} | 修改直播 |
| [**liveUpdateChannel_0**](LiveApi.md#liveupdatechannel_0) | **PUT** /api/v1/live/channel/{cid} | 修改直播 |
| [**startLiveApiV1LiveChannelCidStartPost**](LiveApi.md#startliveapiv1livechannelcidstartpost) | **POST** /api/v1/live/channel/{cid}/start | 开始直播 |
| [**startLiveApiV1LiveChannelCidStartPost_0**](LiveApi.md#startliveapiv1livechannelcidstartpost_0) | **POST** /api/v1/live/channel/{cid}/start | 开始直播 |
| [**stopLiveApiV1LiveChannelCidStopPost**](LiveApi.md#stopliveapiv1livechannelcidstoppost) | **POST** /api/v1/live/channel/{cid}/stop | 结束直播 |
| [**stopLiveApiV1LiveChannelCidStopPost_0**](LiveApi.md#stopliveapiv1livechannelcidstoppost_0) | **POST** /api/v1/live/channel/{cid}/stop | 结束直播 |
| [**toggleSubscribeApiV1LiveChannelCidSubscribePost**](LiveApi.md#togglesubscribeapiv1livechannelcidsubscribepost) | **POST** /api/v1/live/channel/{cid}/subscribe | 订阅/取消订阅 |
| [**toggleSubscribeApiV1LiveChannelCidSubscribePost_0**](LiveApi.md#togglesubscribeapiv1livechannelcidsubscribepost_0) | **POST** /api/v1/live/channel/{cid}/subscribe | 订阅/取消订阅 |



## addCommentApiV1LiveChannelCidCommentPost

> any addCommentApiV1LiveChannelCidCommentPost(cid, content, type)

发表评论

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { AddCommentApiV1LiveChannelCidCommentPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // number
    cid: 56,
    // string
    content: content_example,
    // number (optional)
    type: 56,
  } satisfies AddCommentApiV1LiveChannelCidCommentPostRequest;

  try {
    const data = await api.addCommentApiV1LiveChannelCidCommentPost(body);
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
| **content** | `string` |  | [Defaults to `undefined`] |
| **type** | `number` |  | [Optional] [Defaults to `1`] |

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


## addCommentApiV1LiveChannelCidCommentPost_0

> any addCommentApiV1LiveChannelCidCommentPost_0(cid, content, type)

发表评论

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { AddCommentApiV1LiveChannelCidCommentPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // number
    cid: 56,
    // string
    content: content_example,
    // number (optional)
    type: 56,
  } satisfies AddCommentApiV1LiveChannelCidCommentPost0Request;

  try {
    const data = await api.addCommentApiV1LiveChannelCidCommentPost_0(body);
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
| **content** | `string` |  | [Defaults to `undefined`] |
| **type** | `number` |  | [Optional] [Defaults to `1`] |

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


## getChannelApiV1LiveChannelCidGet

> any getChannelApiV1LiveChannelCidGet(cid)

直播详情

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { GetChannelApiV1LiveChannelCidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // number
    cid: 56,
  } satisfies GetChannelApiV1LiveChannelCidGetRequest;

  try {
    const data = await api.getChannelApiV1LiveChannelCidGet(body);
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


## getChannelApiV1LiveChannelCidGet_0

> any getChannelApiV1LiveChannelCidGet_0(cid)

直播详情

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { GetChannelApiV1LiveChannelCidGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // number
    cid: 56,
  } satisfies GetChannelApiV1LiveChannelCidGet0Request;

  try {
    const data = await api.getChannelApiV1LiveChannelCidGet_0(body);
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


## listChannelsApiV1LiveChannelListGet

> any listChannelsApiV1LiveChannelListGet(page, limit, status, categoryId, hostId, keyword)

直播列表

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { ListChannelsApiV1LiveChannelListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    status: 56,
    // number (optional)
    categoryId: 56,
    // string (optional)
    hostId: hostId_example,
    // string (optional)
    keyword: keyword_example,
  } satisfies ListChannelsApiV1LiveChannelListGetRequest;

  try {
    const data = await api.listChannelsApiV1LiveChannelListGet(body);
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
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **categoryId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **hostId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **keyword** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## listChannelsApiV1LiveChannelListGet_0

> any listChannelsApiV1LiveChannelListGet_0(page, limit, status, categoryId, hostId, keyword)

直播列表

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { ListChannelsApiV1LiveChannelListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    status: 56,
    // number (optional)
    categoryId: 56,
    // string (optional)
    hostId: hostId_example,
    // string (optional)
    keyword: keyword_example,
  } satisfies ListChannelsApiV1LiveChannelListGet0Request;

  try {
    const data = await api.listChannelsApiV1LiveChannelListGet_0(body);
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
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **categoryId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **hostId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **keyword** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## listCommentsApiV1LiveChannelCidCommentsGet

> any listCommentsApiV1LiveChannelCidCommentsGet(cid, page, limit)

评论列表

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { ListCommentsApiV1LiveChannelCidCommentsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // number
    cid: 56,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListCommentsApiV1LiveChannelCidCommentsGetRequest;

  try {
    const data = await api.listCommentsApiV1LiveChannelCidCommentsGet(body);
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
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `50`] |

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


## listCommentsApiV1LiveChannelCidCommentsGet_0

> any listCommentsApiV1LiveChannelCidCommentsGet_0(cid, page, limit)

评论列表

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { ListCommentsApiV1LiveChannelCidCommentsGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // number
    cid: 56,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListCommentsApiV1LiveChannelCidCommentsGet0Request;

  try {
    const data = await api.listCommentsApiV1LiveChannelCidCommentsGet_0(body);
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
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `50`] |

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


## liveChannelCategoryList

> any liveChannelCategoryList()

直播分类

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { LiveChannelCategoryListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  try {
    const data = await api.liveChannelCategoryList();
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


## liveChannelCategoryList_0

> any liveChannelCategoryList_0()

直播分类

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { LiveChannelCategoryList0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  try {
    const data = await api.liveChannelCategoryList_0();
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


## liveCreateChannel

> any liveCreateChannel(title, description, cover, categoryId, type, price, planStartTime, planDuration)

创建直播

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { LiveCreateChannelRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // string
    title: title_example,
    // string (optional)
    description: description_example,
    // string (optional)
    cover: cover_example,
    // number (optional)
    categoryId: 56,
    // number (optional)
    type: 56,
    // number (optional)
    price: 56,
    // Date (optional)
    planStartTime: 2013-10-20T19:20:30+01:00,
    // number (optional)
    planDuration: 56,
  } satisfies LiveCreateChannelRequest;

  try {
    const data = await api.liveCreateChannel(body);
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
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **cover** | `string` |  | [Optional] [Defaults to `undefined`] |
| **categoryId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **type** | `number` |  | [Optional] [Defaults to `1`] |
| **price** | `number` |  | [Optional] [Defaults to `0`] |
| **planStartTime** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **planDuration** | `number` |  | [Optional] [Defaults to `60`] |

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


## liveCreateChannel_0

> any liveCreateChannel_0(title, description, cover, categoryId, type, price, planStartTime, planDuration)

创建直播

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { LiveCreateChannel0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // string
    title: title_example,
    // string (optional)
    description: description_example,
    // string (optional)
    cover: cover_example,
    // number (optional)
    categoryId: 56,
    // number (optional)
    type: 56,
    // number (optional)
    price: 56,
    // Date (optional)
    planStartTime: 2013-10-20T19:20:30+01:00,
    // number (optional)
    planDuration: 56,
  } satisfies LiveCreateChannel0Request;

  try {
    const data = await api.liveCreateChannel_0(body);
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
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **cover** | `string` |  | [Optional] [Defaults to `undefined`] |
| **categoryId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **type** | `number` |  | [Optional] [Defaults to `1`] |
| **price** | `number` |  | [Optional] [Defaults to `0`] |
| **planStartTime** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **planDuration** | `number` |  | [Optional] [Defaults to `60`] |

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


## liveDeleteChannel

> any liveDeleteChannel(cid)

删除直播

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { LiveDeleteChannelRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // number
    cid: 56,
  } satisfies LiveDeleteChannelRequest;

  try {
    const data = await api.liveDeleteChannel(body);
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


## liveDeleteChannel_0

> any liveDeleteChannel_0(cid)

删除直播

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { LiveDeleteChannel0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // number
    cid: 56,
  } satisfies LiveDeleteChannel0Request;

  try {
    const data = await api.liveDeleteChannel_0(body);
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


## liveUpdateChannel

> any liveUpdateChannel(cid, title, description, cover, planStartTime)

修改直播

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { LiveUpdateChannelRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // number
    cid: 56,
    // string (optional)
    title: title_example,
    // string (optional)
    description: description_example,
    // string (optional)
    cover: cover_example,
    // Date (optional)
    planStartTime: 2013-10-20T19:20:30+01:00,
  } satisfies LiveUpdateChannelRequest;

  try {
    const data = await api.liveUpdateChannel(body);
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
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **cover** | `string` |  | [Optional] [Defaults to `undefined`] |
| **planStartTime** | `Date` |  | [Optional] [Defaults to `undefined`] |

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


## liveUpdateChannel_0

> any liveUpdateChannel_0(cid, title, description, cover, planStartTime)

修改直播

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { LiveUpdateChannel0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // number
    cid: 56,
    // string (optional)
    title: title_example,
    // string (optional)
    description: description_example,
    // string (optional)
    cover: cover_example,
    // Date (optional)
    planStartTime: 2013-10-20T19:20:30+01:00,
  } satisfies LiveUpdateChannel0Request;

  try {
    const data = await api.liveUpdateChannel_0(body);
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
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **cover** | `string` |  | [Optional] [Defaults to `undefined`] |
| **planStartTime** | `Date` |  | [Optional] [Defaults to `undefined`] |

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


## startLiveApiV1LiveChannelCidStartPost

> any startLiveApiV1LiveChannelCidStartPost(cid)

开始直播

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { StartLiveApiV1LiveChannelCidStartPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // number
    cid: 56,
  } satisfies StartLiveApiV1LiveChannelCidStartPostRequest;

  try {
    const data = await api.startLiveApiV1LiveChannelCidStartPost(body);
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


## startLiveApiV1LiveChannelCidStartPost_0

> any startLiveApiV1LiveChannelCidStartPost_0(cid)

开始直播

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { StartLiveApiV1LiveChannelCidStartPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // number
    cid: 56,
  } satisfies StartLiveApiV1LiveChannelCidStartPost0Request;

  try {
    const data = await api.startLiveApiV1LiveChannelCidStartPost_0(body);
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


## stopLiveApiV1LiveChannelCidStopPost

> any stopLiveApiV1LiveChannelCidStopPost(cid)

结束直播

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { StopLiveApiV1LiveChannelCidStopPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // number
    cid: 56,
  } satisfies StopLiveApiV1LiveChannelCidStopPostRequest;

  try {
    const data = await api.stopLiveApiV1LiveChannelCidStopPost(body);
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


## stopLiveApiV1LiveChannelCidStopPost_0

> any stopLiveApiV1LiveChannelCidStopPost_0(cid)

结束直播

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { StopLiveApiV1LiveChannelCidStopPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // number
    cid: 56,
  } satisfies StopLiveApiV1LiveChannelCidStopPost0Request;

  try {
    const data = await api.stopLiveApiV1LiveChannelCidStopPost_0(body);
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


## toggleSubscribeApiV1LiveChannelCidSubscribePost

> any toggleSubscribeApiV1LiveChannelCidSubscribePost(cid)

订阅/取消订阅

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { ToggleSubscribeApiV1LiveChannelCidSubscribePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // number
    cid: 56,
  } satisfies ToggleSubscribeApiV1LiveChannelCidSubscribePostRequest;

  try {
    const data = await api.toggleSubscribeApiV1LiveChannelCidSubscribePost(body);
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


## toggleSubscribeApiV1LiveChannelCidSubscribePost_0

> any toggleSubscribeApiV1LiveChannelCidSubscribePost_0(cid)

订阅/取消订阅

### Example

```ts
import {
  Configuration,
  LiveApi,
} from '';
import type { ToggleSubscribeApiV1LiveChannelCidSubscribePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LiveApi();

  const body = {
    // number
    cid: 56,
  } satisfies ToggleSubscribeApiV1LiveChannelCidSubscribePost0Request;

  try {
    const data = await api.toggleSubscribeApiV1LiveChannelCidSubscribePost_0(body);
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

