# FeedbackApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**deleteFeedbackApiV1FeedbackFidDelete**](FeedbackApi.md#deletefeedbackapiv1feedbackfiddelete) | **DELETE** /api/v1/feedback/{fid} | 删除反馈 |
| [**deleteFeedbackApiV1FeedbackFidDelete_0**](FeedbackApi.md#deletefeedbackapiv1feedbackfiddelete_0) | **DELETE** /api/v1/feedback/{fid} | 删除反馈 |
| [**feedbackAdminList**](FeedbackApi.md#feedbackadminlist) | **GET** /api/v1/feedback/admin/list | 反馈列表(管理员) |
| [**feedbackAdminList_0**](FeedbackApi.md#feedbackadminlist_0) | **GET** /api/v1/feedback/admin/list | 反馈列表(管理员) |
| [**getFeedbackApiV1FeedbackFidGet**](FeedbackApi.md#getfeedbackapiv1feedbackfidget) | **GET** /api/v1/feedback/{fid} | 反馈详情 |
| [**getFeedbackApiV1FeedbackFidGet_0**](FeedbackApi.md#getfeedbackapiv1feedbackfidget_0) | **GET** /api/v1/feedback/{fid} | 反馈详情 |
| [**handleFeedbackApiV1FeedbackFidHandlePut**](FeedbackApi.md#handlefeedbackapiv1feedbackfidhandleput) | **PUT** /api/v1/feedback/{fid}/handle | 处理反馈 |
| [**handleFeedbackApiV1FeedbackFidHandlePut_0**](FeedbackApi.md#handlefeedbackapiv1feedbackfidhandleput_0) | **PUT** /api/v1/feedback/{fid}/handle | 处理反馈 |
| [**listMyFeedbacksApiV1FeedbackListGet**](FeedbackApi.md#listmyfeedbacksapiv1feedbacklistget) | **GET** /api/v1/feedback/list | 我的反馈 |
| [**listMyFeedbacksApiV1FeedbackListGet_0**](FeedbackApi.md#listmyfeedbacksapiv1feedbacklistget_0) | **GET** /api/v1/feedback/list | 我的反馈 |
| [**rateFeedbackApiV1FeedbackFidRatePost**](FeedbackApi.md#ratefeedbackapiv1feedbackfidratepost) | **POST** /api/v1/feedback/{fid}/rate | 评价反馈 |
| [**rateFeedbackApiV1FeedbackFidRatePost_0**](FeedbackApi.md#ratefeedbackapiv1feedbackfidratepost_0) | **POST** /api/v1/feedback/{fid}/rate | 评价反馈 |
| [**submitFeedbackApiV1FeedbackPost**](FeedbackApi.md#submitfeedbackapiv1feedbackpost) | **POST** /api/v1/feedback | 提交反馈 |
| [**submitFeedbackApiV1FeedbackPost_0**](FeedbackApi.md#submitfeedbackapiv1feedbackpost_0) | **POST** /api/v1/feedback | 提交反馈 |



## deleteFeedbackApiV1FeedbackFidDelete

> any deleteFeedbackApiV1FeedbackFidDelete(fid)

删除反馈

### Example

```ts
import {
  Configuration,
  FeedbackApi,
} from '';
import type { DeleteFeedbackApiV1FeedbackFidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FeedbackApi();

  const body = {
    // number
    fid: 56,
  } satisfies DeleteFeedbackApiV1FeedbackFidDeleteRequest;

  try {
    const data = await api.deleteFeedbackApiV1FeedbackFidDelete(body);
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
| **fid** | `number` |  | [Defaults to `undefined`] |

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


## deleteFeedbackApiV1FeedbackFidDelete_0

> any deleteFeedbackApiV1FeedbackFidDelete_0(fid)

删除反馈

### Example

```ts
import {
  Configuration,
  FeedbackApi,
} from '';
import type { DeleteFeedbackApiV1FeedbackFidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FeedbackApi();

  const body = {
    // number
    fid: 56,
  } satisfies DeleteFeedbackApiV1FeedbackFidDelete0Request;

  try {
    const data = await api.deleteFeedbackApiV1FeedbackFidDelete_0(body);
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
| **fid** | `number` |  | [Defaults to `undefined`] |

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


## feedbackAdminList

> any feedbackAdminList(page, limit, status, type, priority)

反馈列表(管理员)

### Example

```ts
import {
  Configuration,
  FeedbackApi,
} from '';
import type { FeedbackAdminListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FeedbackApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    status: 56,
    // string (optional)
    type: type_example,
    // number (optional)
    priority: 56,
  } satisfies FeedbackAdminListRequest;

  try {
    const data = await api.feedbackAdminList(body);
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
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## feedbackAdminList_0

> any feedbackAdminList_0(page, limit, status, type, priority)

反馈列表(管理员)

### Example

```ts
import {
  Configuration,
  FeedbackApi,
} from '';
import type { FeedbackAdminList0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FeedbackApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    status: 56,
    // string (optional)
    type: type_example,
    // number (optional)
    priority: 56,
  } satisfies FeedbackAdminList0Request;

  try {
    const data = await api.feedbackAdminList_0(body);
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
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## getFeedbackApiV1FeedbackFidGet

> any getFeedbackApiV1FeedbackFidGet(fid)

反馈详情

### Example

```ts
import {
  Configuration,
  FeedbackApi,
} from '';
import type { GetFeedbackApiV1FeedbackFidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FeedbackApi();

  const body = {
    // number
    fid: 56,
  } satisfies GetFeedbackApiV1FeedbackFidGetRequest;

  try {
    const data = await api.getFeedbackApiV1FeedbackFidGet(body);
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
| **fid** | `number` |  | [Defaults to `undefined`] |

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


## getFeedbackApiV1FeedbackFidGet_0

> any getFeedbackApiV1FeedbackFidGet_0(fid)

反馈详情

### Example

```ts
import {
  Configuration,
  FeedbackApi,
} from '';
import type { GetFeedbackApiV1FeedbackFidGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FeedbackApi();

  const body = {
    // number
    fid: 56,
  } satisfies GetFeedbackApiV1FeedbackFidGet0Request;

  try {
    const data = await api.getFeedbackApiV1FeedbackFidGet_0(body);
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
| **fid** | `number` |  | [Defaults to `undefined`] |

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


## handleFeedbackApiV1FeedbackFidHandlePut

> any handleFeedbackApiV1FeedbackFidHandlePut(fid, status, remark, priority, reply)

处理反馈

### Example

```ts
import {
  Configuration,
  FeedbackApi,
} from '';
import type { HandleFeedbackApiV1FeedbackFidHandlePutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FeedbackApi();

  const body = {
    // number
    fid: 56,
    // number
    status: 56,
    // string (optional)
    remark: remark_example,
    // number (optional)
    priority: 56,
    // string (optional)
    reply: reply_example,
  } satisfies HandleFeedbackApiV1FeedbackFidHandlePutRequest;

  try {
    const data = await api.handleFeedbackApiV1FeedbackFidHandlePut(body);
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
| **fid** | `number` |  | [Defaults to `undefined`] |
| **status** | `number` |  | [Defaults to `undefined`] |
| **remark** | `string` |  | [Optional] [Defaults to `undefined`] |
| **priority** | `number` |  | [Optional] [Defaults to `undefined`] |
| **reply** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## handleFeedbackApiV1FeedbackFidHandlePut_0

> any handleFeedbackApiV1FeedbackFidHandlePut_0(fid, status, remark, priority, reply)

处理反馈

### Example

```ts
import {
  Configuration,
  FeedbackApi,
} from '';
import type { HandleFeedbackApiV1FeedbackFidHandlePut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FeedbackApi();

  const body = {
    // number
    fid: 56,
    // number
    status: 56,
    // string (optional)
    remark: remark_example,
    // number (optional)
    priority: 56,
    // string (optional)
    reply: reply_example,
  } satisfies HandleFeedbackApiV1FeedbackFidHandlePut0Request;

  try {
    const data = await api.handleFeedbackApiV1FeedbackFidHandlePut_0(body);
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
| **fid** | `number` |  | [Defaults to `undefined`] |
| **status** | `number` |  | [Defaults to `undefined`] |
| **remark** | `string` |  | [Optional] [Defaults to `undefined`] |
| **priority** | `number` |  | [Optional] [Defaults to `undefined`] |
| **reply** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## listMyFeedbacksApiV1FeedbackListGet

> any listMyFeedbacksApiV1FeedbackListGet(page, limit, type, status)

我的反馈

### Example

```ts
import {
  Configuration,
  FeedbackApi,
} from '';
import type { ListMyFeedbacksApiV1FeedbackListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FeedbackApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    type: type_example,
    // number (optional)
    status: 56,
  } satisfies ListMyFeedbacksApiV1FeedbackListGetRequest;

  try {
    const data = await api.listMyFeedbacksApiV1FeedbackListGet(body);
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


## listMyFeedbacksApiV1FeedbackListGet_0

> any listMyFeedbacksApiV1FeedbackListGet_0(page, limit, type, status)

我的反馈

### Example

```ts
import {
  Configuration,
  FeedbackApi,
} from '';
import type { ListMyFeedbacksApiV1FeedbackListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FeedbackApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    type: type_example,
    // number (optional)
    status: 56,
  } satisfies ListMyFeedbacksApiV1FeedbackListGet0Request;

  try {
    const data = await api.listMyFeedbacksApiV1FeedbackListGet_0(body);
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


## rateFeedbackApiV1FeedbackFidRatePost

> any rateFeedbackApiV1FeedbackFidRatePost(fid, rating)

评价反馈

### Example

```ts
import {
  Configuration,
  FeedbackApi,
} from '';
import type { RateFeedbackApiV1FeedbackFidRatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FeedbackApi();

  const body = {
    // number
    fid: 56,
    // number
    rating: 56,
  } satisfies RateFeedbackApiV1FeedbackFidRatePostRequest;

  try {
    const data = await api.rateFeedbackApiV1FeedbackFidRatePost(body);
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
| **fid** | `number` |  | [Defaults to `undefined`] |
| **rating** | `number` |  | [Defaults to `undefined`] |

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


## rateFeedbackApiV1FeedbackFidRatePost_0

> any rateFeedbackApiV1FeedbackFidRatePost_0(fid, rating)

评价反馈

### Example

```ts
import {
  Configuration,
  FeedbackApi,
} from '';
import type { RateFeedbackApiV1FeedbackFidRatePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FeedbackApi();

  const body = {
    // number
    fid: 56,
    // number
    rating: 56,
  } satisfies RateFeedbackApiV1FeedbackFidRatePost0Request;

  try {
    const data = await api.rateFeedbackApiV1FeedbackFidRatePost_0(body);
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
| **fid** | `number` |  | [Defaults to `undefined`] |
| **rating** | `number` |  | [Defaults to `undefined`] |

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


## submitFeedbackApiV1FeedbackPost

> any submitFeedbackApiV1FeedbackPost(title, content, type, images, contact, appVersion, deviceInfo)

提交反馈

### Example

```ts
import {
  Configuration,
  FeedbackApi,
} from '';
import type { SubmitFeedbackApiV1FeedbackPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FeedbackApi();

  const body = {
    // string
    title: title_example,
    // string
    content: content_example,
    // string (optional)
    type: type_example,
    // string (optional)
    images: images_example,
    // string (optional)
    contact: contact_example,
    // string (optional)
    appVersion: appVersion_example,
    // string (optional)
    deviceInfo: deviceInfo_example,
  } satisfies SubmitFeedbackApiV1FeedbackPostRequest;

  try {
    const data = await api.submitFeedbackApiV1FeedbackPost(body);
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
| **type** | `string` |  | [Optional] [Defaults to `&#39;bug&#39;`] |
| **images** | `string` |  | [Optional] [Defaults to `undefined`] |
| **contact** | `string` |  | [Optional] [Defaults to `undefined`] |
| **appVersion** | `string` |  | [Optional] [Defaults to `undefined`] |
| **deviceInfo** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## submitFeedbackApiV1FeedbackPost_0

> any submitFeedbackApiV1FeedbackPost_0(title, content, type, images, contact, appVersion, deviceInfo)

提交反馈

### Example

```ts
import {
  Configuration,
  FeedbackApi,
} from '';
import type { SubmitFeedbackApiV1FeedbackPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FeedbackApi();

  const body = {
    // string
    title: title_example,
    // string
    content: content_example,
    // string (optional)
    type: type_example,
    // string (optional)
    images: images_example,
    // string (optional)
    contact: contact_example,
    // string (optional)
    appVersion: appVersion_example,
    // string (optional)
    deviceInfo: deviceInfo_example,
  } satisfies SubmitFeedbackApiV1FeedbackPost0Request;

  try {
    const data = await api.submitFeedbackApiV1FeedbackPost_0(body);
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
| **type** | `string` |  | [Optional] [Defaults to `&#39;bug&#39;`] |
| **images** | `string` |  | [Optional] [Defaults to `undefined`] |
| **contact** | `string` |  | [Optional] [Defaults to `undefined`] |
| **appVersion** | `string` |  | [Optional] [Defaults to `undefined`] |
| **deviceInfo** | `string` |  | [Optional] [Defaults to `undefined`] |

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

