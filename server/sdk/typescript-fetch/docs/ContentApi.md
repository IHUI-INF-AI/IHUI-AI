# ContentApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createVersionApiV1ContentVersionCreatePost**](ContentApi.md#createversionapiv1contentversioncreatepost) | **POST** /api/v1/content/version/create | 创建 App 版本 |
| [**deleteFeedbackApiV1ContentFeedbackDeleteDelete**](ContentApi.md#deletefeedbackapiv1contentfeedbackdeletedelete) | **DELETE** /api/v1/content/feedback/delete | 删除反馈 |
| [**deleteVersionApiV1ContentVersionDeleteDelete**](ContentApi.md#deleteversionapiv1contentversiondeletedelete) | **DELETE** /api/v1/content/version/delete | 删除 App 版本 |
| [**getAboutApiV1ContentAboutGet**](ContentApi.md#getaboutapiv1contentaboutget) | **GET** /api/v1/content/about | Get about us |
| [**getContactApiV1ContentContactGet**](ContentApi.md#getcontactapiv1contentcontactget) | **GET** /api/v1/content/contact | 获取联系信息 |
| [**getNewsApiV1ContentNewsNewsIdGet**](ContentApi.md#getnewsapiv1contentnewsnewsidget) | **GET** /api/v1/content/news/{news_id} | Get news detail |
| [**getVersionApiV1ContentVersionGet**](ContentApi.md#getversionapiv1contentversionget) | **GET** /api/v1/content/version | Get latest app version |
| [**listBannersApiV1ContentBannersGet**](ContentApi.md#listbannersapiv1contentbannersget) | **GET** /api/v1/content/banners | List banners |
| [**listFeedbacksApiV1ContentFeedbackListGet**](ContentApi.md#listfeedbacksapiv1contentfeedbacklistget) | **GET** /api/v1/content/feedback/list | 反馈列表 |
| [**listNewsApiV1ContentNewsGet**](ContentApi.md#listnewsapiv1contentnewsget) | **GET** /api/v1/content/news | List news |
| [**listVersionsApiV1ContentVersionListGet**](ContentApi.md#listversionsapiv1contentversionlistget) | **GET** /api/v1/content/version/list | App 版本列表 |
| [**submitFeedbackApiV1ContentFeedbackPost**](ContentApi.md#submitfeedbackapiv1contentfeedbackpost) | **POST** /api/v1/content/feedback | Submit feedback |
| [**updateFeedbackApiV1ContentFeedbackUpdatePut**](ContentApi.md#updatefeedbackapiv1contentfeedbackupdateput) | **PUT** /api/v1/content/feedback/update | 更新/回复反馈 |
| [**updateVersionApiV1ContentVersionUpdatePut**](ContentApi.md#updateversionapiv1contentversionupdateput) | **PUT** /api/v1/content/version/update | 更新 App 版本 |



## createVersionApiV1ContentVersionCreatePost

> any createVersionApiV1ContentVersionCreatePost(versionCode, versionName, downloadUrl, description, platform, forceUpdate)

创建 App 版本

### Example

```ts
import {
  Configuration,
  ContentApi,
} from '';
import type { CreateVersionApiV1ContentVersionCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContentApi(config);

  const body = {
    // string
    versionCode: versionCode_example,
    // string
    versionName: versionName_example,
    // string
    downloadUrl: downloadUrl_example,
    // string (optional)
    description: description_example,
    // string (optional)
    platform: platform_example,
    // number | 0=否 1=是 (optional)
    forceUpdate: 56,
  } satisfies CreateVersionApiV1ContentVersionCreatePostRequest;

  try {
    const data = await api.createVersionApiV1ContentVersionCreatePost(body);
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
| **versionCode** | `string` |  | [Defaults to `undefined`] |
| **versionName** | `string` |  | [Defaults to `undefined`] |
| **downloadUrl** | `string` |  | [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **platform** | `string` |  | [Optional] [Defaults to `&#39;android&#39;`] |
| **forceUpdate** | `number` | 0&#x3D;否 1&#x3D;是 | [Optional] [Defaults to `0`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteFeedbackApiV1ContentFeedbackDeleteDelete

> any deleteFeedbackApiV1ContentFeedbackDeleteDelete(feedbackId)

删除反馈

### Example

```ts
import {
  Configuration,
  ContentApi,
} from '';
import type { DeleteFeedbackApiV1ContentFeedbackDeleteDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContentApi(config);

  const body = {
    // number
    feedbackId: 56,
  } satisfies DeleteFeedbackApiV1ContentFeedbackDeleteDeleteRequest;

  try {
    const data = await api.deleteFeedbackApiV1ContentFeedbackDeleteDelete(body);
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
| **feedbackId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteVersionApiV1ContentVersionDeleteDelete

> any deleteVersionApiV1ContentVersionDeleteDelete(versionId)

删除 App 版本

### Example

```ts
import {
  Configuration,
  ContentApi,
} from '';
import type { DeleteVersionApiV1ContentVersionDeleteDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContentApi(config);

  const body = {
    // number
    versionId: 56,
  } satisfies DeleteVersionApiV1ContentVersionDeleteDeleteRequest;

  try {
    const data = await api.deleteVersionApiV1ContentVersionDeleteDelete(body);
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
| **versionId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getAboutApiV1ContentAboutGet

> any getAboutApiV1ContentAboutGet()

Get about us

### Example

```ts
import {
  Configuration,
  ContentApi,
} from '';
import type { GetAboutApiV1ContentAboutGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentApi();

  try {
    const data = await api.getAboutApiV1ContentAboutGet();
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


## getContactApiV1ContentContactGet

> any getContactApiV1ContentContactGet()

获取联系信息

Return the active contact-us entry.

### Example

```ts
import {
  Configuration,
  ContentApi,
} from '';
import type { GetContactApiV1ContentContactGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentApi();

  try {
    const data = await api.getContactApiV1ContentContactGet();
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


## getNewsApiV1ContentNewsNewsIdGet

> any getNewsApiV1ContentNewsNewsIdGet(newsId)

Get news detail

### Example

```ts
import {
  Configuration,
  ContentApi,
} from '';
import type { GetNewsApiV1ContentNewsNewsIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentApi();

  const body = {
    // number
    newsId: 56,
  } satisfies GetNewsApiV1ContentNewsNewsIdGetRequest;

  try {
    const data = await api.getNewsApiV1ContentNewsNewsIdGet(body);
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
| **newsId** | `number` |  | [Defaults to `undefined`] |

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


## getVersionApiV1ContentVersionGet

> any getVersionApiV1ContentVersionGet(platform)

Get latest app version

### Example

```ts
import {
  Configuration,
  ContentApi,
} from '';
import type { GetVersionApiV1ContentVersionGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentApi();

  const body = {
    // string (optional)
    platform: platform_example,
  } satisfies GetVersionApiV1ContentVersionGetRequest;

  try {
    const data = await api.getVersionApiV1ContentVersionGet(body);
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
| **platform** | `string` |  | [Optional] [Defaults to `&#39;android&#39;`] |

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


## listBannersApiV1ContentBannersGet

> any listBannersApiV1ContentBannersGet(position)

List banners

### Example

```ts
import {
  Configuration,
  ContentApi,
} from '';
import type { ListBannersApiV1ContentBannersGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentApi();

  const body = {
    // string (optional)
    position: position_example,
  } satisfies ListBannersApiV1ContentBannersGetRequest;

  try {
    const data = await api.listBannersApiV1ContentBannersGet(body);
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
| **position** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## listFeedbacksApiV1ContentFeedbackListGet

> any listFeedbacksApiV1ContentFeedbackListGet(page, limit, status)

反馈列表

### Example

```ts
import {
  Configuration,
  ContentApi,
} from '';
import type { ListFeedbacksApiV1ContentFeedbackListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContentApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number | 筛选状态: 0=未处理 1=已处理 (optional)
    status: 56,
  } satisfies ListFeedbacksApiV1ContentFeedbackListGetRequest;

  try {
    const data = await api.listFeedbacksApiV1ContentFeedbackListGet(body);
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
| **status** | `number` | 筛选状态: 0&#x3D;未处理 1&#x3D;已处理 | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listNewsApiV1ContentNewsGet

> any listNewsApiV1ContentNewsGet(page, limit)

List news

### Example

```ts
import {
  Configuration,
  ContentApi,
} from '';
import type { ListNewsApiV1ContentNewsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListNewsApiV1ContentNewsGetRequest;

  try {
    const data = await api.listNewsApiV1ContentNewsGet(body);
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


## listVersionsApiV1ContentVersionListGet

> any listVersionsApiV1ContentVersionListGet(page, limit, platform)

App 版本列表

### Example

```ts
import {
  Configuration,
  ContentApi,
} from '';
import type { ListVersionsApiV1ContentVersionListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContentApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    platform: platform_example,
  } satisfies ListVersionsApiV1ContentVersionListGetRequest;

  try {
    const data = await api.listVersionsApiV1ContentVersionListGet(body);
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
| **platform** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## submitFeedbackApiV1ContentFeedbackPost

> any submitFeedbackApiV1ContentFeedbackPost(content, images, type)

Submit feedback

### Example

```ts
import {
  Configuration,
  ContentApi,
} from '';
import type { SubmitFeedbackApiV1ContentFeedbackPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContentApi(config);

  const body = {
    // string
    content: content_example,
    // string (optional)
    images: images_example,
    // string (optional)
    type: type_example,
  } satisfies SubmitFeedbackApiV1ContentFeedbackPostRequest;

  try {
    const data = await api.submitFeedbackApiV1ContentFeedbackPost(body);
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
| **content** | `string` |  | [Defaults to `undefined`] |
| **images** | `string` |  | [Optional] [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateFeedbackApiV1ContentFeedbackUpdatePut

> any updateFeedbackApiV1ContentFeedbackUpdatePut(feedbackId, status, reply)

更新/回复反馈

### Example

```ts
import {
  Configuration,
  ContentApi,
} from '';
import type { UpdateFeedbackApiV1ContentFeedbackUpdatePutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContentApi(config);

  const body = {
    // number
    feedbackId: 56,
    // number (optional)
    status: 56,
    // string (optional)
    reply: reply_example,
  } satisfies UpdateFeedbackApiV1ContentFeedbackUpdatePutRequest;

  try {
    const data = await api.updateFeedbackApiV1ContentFeedbackUpdatePut(body);
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
| **feedbackId** | `number` |  | [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **reply** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateVersionApiV1ContentVersionUpdatePut

> any updateVersionApiV1ContentVersionUpdatePut(versionId, versionCode, versionName, downloadUrl, description, platform, forceUpdate, status)

更新 App 版本

### Example

```ts
import {
  Configuration,
  ContentApi,
} from '';
import type { UpdateVersionApiV1ContentVersionUpdatePutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContentApi(config);

  const body = {
    // number
    versionId: 56,
    // string (optional)
    versionCode: versionCode_example,
    // string (optional)
    versionName: versionName_example,
    // string (optional)
    downloadUrl: downloadUrl_example,
    // string (optional)
    description: description_example,
    // string (optional)
    platform: platform_example,
    // number (optional)
    forceUpdate: 56,
    // number (optional)
    status: 56,
  } satisfies UpdateVersionApiV1ContentVersionUpdatePutRequest;

  try {
    const data = await api.updateVersionApiV1ContentVersionUpdatePut(body);
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
| **versionId** | `number` |  | [Defaults to `undefined`] |
| **versionCode** | `string` |  | [Optional] [Defaults to `undefined`] |
| **versionName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **downloadUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **platform** | `string` |  | [Optional] [Defaults to `undefined`] |
| **forceUpdate** | `number` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

