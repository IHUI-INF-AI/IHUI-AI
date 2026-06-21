# AdvertiseApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createAdvertiseApiV1AdvertisePost**](AdvertiseApi.md#createadvertiseapiv1advertisepost) | **POST** /api/v1/advertise | 新增广告 |
| [**createAdvertiseApiV1AdvertisePost_0**](AdvertiseApi.md#createadvertiseapiv1advertisepost_0) | **POST** /api/v1/advertise | 新增广告 |
| [**createPositionApiV1AdvertisePositionPost**](AdvertiseApi.md#createpositionapiv1advertisepositionpost) | **POST** /api/v1/advertise/position | 新增广告位 |
| [**createPositionApiV1AdvertisePositionPost_0**](AdvertiseApi.md#createpositionapiv1advertisepositionpost_0) | **POST** /api/v1/advertise/position | 新增广告位 |
| [**deleteAdvertiseApiV1AdvertiseAidDelete**](AdvertiseApi.md#deleteadvertiseapiv1advertiseaiddelete) | **DELETE** /api/v1/advertise/{aid} | 删除广告 |
| [**deleteAdvertiseApiV1AdvertiseAidDelete_0**](AdvertiseApi.md#deleteadvertiseapiv1advertiseaiddelete_0) | **DELETE** /api/v1/advertise/{aid} | 删除广告 |
| [**getAdvertiseApiV1AdvertiseAidGet**](AdvertiseApi.md#getadvertiseapiv1advertiseaidget) | **GET** /api/v1/advertise/{aid} | 广告详情 |
| [**getAdvertiseApiV1AdvertiseAidGet_0**](AdvertiseApi.md#getadvertiseapiv1advertiseaidget_0) | **GET** /api/v1/advertise/{aid} | 广告详情 |
| [**listAdvertisesApiV1AdvertiseListGet**](AdvertiseApi.md#listadvertisesapiv1advertiselistget) | **GET** /api/v1/advertise/list | 广告列表 |
| [**listAdvertisesApiV1AdvertiseListGet_0**](AdvertiseApi.md#listadvertisesapiv1advertiselistget_0) | **GET** /api/v1/advertise/list | 广告列表 |
| [**positionListApiV1AdvertisePositionListGet**](AdvertiseApi.md#positionlistapiv1advertisepositionlistget) | **GET** /api/v1/advertise/position/list | 广告位列表 |
| [**positionListApiV1AdvertisePositionListGet_0**](AdvertiseApi.md#positionlistapiv1advertisepositionlistget_0) | **GET** /api/v1/advertise/position/list | 广告位列表 |
| [**recordClickApiV1AdvertiseAidClickPost**](AdvertiseApi.md#recordclickapiv1advertiseaidclickpost) | **POST** /api/v1/advertise/{aid}/click | 记录广告点击 |
| [**recordClickApiV1AdvertiseAidClickPost_0**](AdvertiseApi.md#recordclickapiv1advertiseaidclickpost_0) | **POST** /api/v1/advertise/{aid}/click | 记录广告点击 |
| [**updateAdvertiseApiV1AdvertiseAidPut**](AdvertiseApi.md#updateadvertiseapiv1advertiseaidput) | **PUT** /api/v1/advertise/{aid} | 修改广告 |
| [**updateAdvertiseApiV1AdvertiseAidPut_0**](AdvertiseApi.md#updateadvertiseapiv1advertiseaidput_0) | **PUT** /api/v1/advertise/{aid} | 修改广告 |



## createAdvertiseApiV1AdvertisePost

> any createAdvertiseApiV1AdvertisePost(title, positionId, image, url, type, content, startTime, endTime, sortOrder, targetUser)

新增广告

### Example

```ts
import {
  Configuration,
  AdvertiseApi,
} from '';
import type { CreateAdvertiseApiV1AdvertisePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AdvertiseApi();

  const body = {
    // string
    title: title_example,
    // number
    positionId: 56,
    // string (optional)
    image: image_example,
    // string (optional)
    url: url_example,
    // string (optional)
    type: type_example,
    // string (optional)
    content: content_example,
    // Date (optional)
    startTime: 2013-10-20T19:20:30+01:00,
    // Date (optional)
    endTime: 2013-10-20T19:20:30+01:00,
    // number (optional)
    sortOrder: 56,
    // string (optional)
    targetUser: targetUser_example,
  } satisfies CreateAdvertiseApiV1AdvertisePostRequest;

  try {
    const data = await api.createAdvertiseApiV1AdvertisePost(body);
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
| **positionId** | `number` |  | [Defaults to `undefined`] |
| **image** | `string` |  | [Optional] [Defaults to `undefined`] |
| **url** | `string` |  | [Optional] [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;image&#39;`] |
| **content** | `string` |  | [Optional] [Defaults to `undefined`] |
| **startTime** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **endTime** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **sortOrder** | `number` |  | [Optional] [Defaults to `0`] |
| **targetUser** | `string` |  | [Optional] [Defaults to `&#39;all&#39;`] |

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


## createAdvertiseApiV1AdvertisePost_0

> any createAdvertiseApiV1AdvertisePost_0(title, positionId, image, url, type, content, startTime, endTime, sortOrder, targetUser)

新增广告

### Example

```ts
import {
  Configuration,
  AdvertiseApi,
} from '';
import type { CreateAdvertiseApiV1AdvertisePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AdvertiseApi();

  const body = {
    // string
    title: title_example,
    // number
    positionId: 56,
    // string (optional)
    image: image_example,
    // string (optional)
    url: url_example,
    // string (optional)
    type: type_example,
    // string (optional)
    content: content_example,
    // Date (optional)
    startTime: 2013-10-20T19:20:30+01:00,
    // Date (optional)
    endTime: 2013-10-20T19:20:30+01:00,
    // number (optional)
    sortOrder: 56,
    // string (optional)
    targetUser: targetUser_example,
  } satisfies CreateAdvertiseApiV1AdvertisePost0Request;

  try {
    const data = await api.createAdvertiseApiV1AdvertisePost_0(body);
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
| **positionId** | `number` |  | [Defaults to `undefined`] |
| **image** | `string` |  | [Optional] [Defaults to `undefined`] |
| **url** | `string` |  | [Optional] [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;image&#39;`] |
| **content** | `string` |  | [Optional] [Defaults to `undefined`] |
| **startTime** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **endTime** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **sortOrder** | `number` |  | [Optional] [Defaults to `0`] |
| **targetUser** | `string` |  | [Optional] [Defaults to `&#39;all&#39;`] |

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


## createPositionApiV1AdvertisePositionPost

> any createPositionApiV1AdvertisePositionPost(name, code, description, width, height)

新增广告位

### Example

```ts
import {
  Configuration,
  AdvertiseApi,
} from '';
import type { CreatePositionApiV1AdvertisePositionPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AdvertiseApi();

  const body = {
    // string
    name: name_example,
    // string
    code: code_example,
    // string (optional)
    description: description_example,
    // number (optional)
    width: 56,
    // number (optional)
    height: 56,
  } satisfies CreatePositionApiV1AdvertisePositionPostRequest;

  try {
    const data = await api.createPositionApiV1AdvertisePositionPost(body);
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
| **code** | `string` |  | [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **width** | `number` |  | [Optional] [Defaults to `0`] |
| **height** | `number` |  | [Optional] [Defaults to `0`] |

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


## createPositionApiV1AdvertisePositionPost_0

> any createPositionApiV1AdvertisePositionPost_0(name, code, description, width, height)

新增广告位

### Example

```ts
import {
  Configuration,
  AdvertiseApi,
} from '';
import type { CreatePositionApiV1AdvertisePositionPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AdvertiseApi();

  const body = {
    // string
    name: name_example,
    // string
    code: code_example,
    // string (optional)
    description: description_example,
    // number (optional)
    width: 56,
    // number (optional)
    height: 56,
  } satisfies CreatePositionApiV1AdvertisePositionPost0Request;

  try {
    const data = await api.createPositionApiV1AdvertisePositionPost_0(body);
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
| **code** | `string` |  | [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **width** | `number` |  | [Optional] [Defaults to `0`] |
| **height** | `number` |  | [Optional] [Defaults to `0`] |

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


## deleteAdvertiseApiV1AdvertiseAidDelete

> any deleteAdvertiseApiV1AdvertiseAidDelete(aid)

删除广告

### Example

```ts
import {
  Configuration,
  AdvertiseApi,
} from '';
import type { DeleteAdvertiseApiV1AdvertiseAidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AdvertiseApi();

  const body = {
    // number
    aid: 56,
  } satisfies DeleteAdvertiseApiV1AdvertiseAidDeleteRequest;

  try {
    const data = await api.deleteAdvertiseApiV1AdvertiseAidDelete(body);
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


## deleteAdvertiseApiV1AdvertiseAidDelete_0

> any deleteAdvertiseApiV1AdvertiseAidDelete_0(aid)

删除广告

### Example

```ts
import {
  Configuration,
  AdvertiseApi,
} from '';
import type { DeleteAdvertiseApiV1AdvertiseAidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AdvertiseApi();

  const body = {
    // number
    aid: 56,
  } satisfies DeleteAdvertiseApiV1AdvertiseAidDelete0Request;

  try {
    const data = await api.deleteAdvertiseApiV1AdvertiseAidDelete_0(body);
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


## getAdvertiseApiV1AdvertiseAidGet

> any getAdvertiseApiV1AdvertiseAidGet(aid)

广告详情

### Example

```ts
import {
  Configuration,
  AdvertiseApi,
} from '';
import type { GetAdvertiseApiV1AdvertiseAidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AdvertiseApi();

  const body = {
    // number
    aid: 56,
  } satisfies GetAdvertiseApiV1AdvertiseAidGetRequest;

  try {
    const data = await api.getAdvertiseApiV1AdvertiseAidGet(body);
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


## getAdvertiseApiV1AdvertiseAidGet_0

> any getAdvertiseApiV1AdvertiseAidGet_0(aid)

广告详情

### Example

```ts
import {
  Configuration,
  AdvertiseApi,
} from '';
import type { GetAdvertiseApiV1AdvertiseAidGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AdvertiseApi();

  const body = {
    // number
    aid: 56,
  } satisfies GetAdvertiseApiV1AdvertiseAidGet0Request;

  try {
    const data = await api.getAdvertiseApiV1AdvertiseAidGet_0(body);
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


## listAdvertisesApiV1AdvertiseListGet

> any listAdvertisesApiV1AdvertiseListGet(positionId, status, page, limit)

广告列表

### Example

```ts
import {
  Configuration,
  AdvertiseApi,
} from '';
import type { ListAdvertisesApiV1AdvertiseListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AdvertiseApi();

  const body = {
    // number (optional)
    positionId: 56,
    // number (optional)
    status: 56,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListAdvertisesApiV1AdvertiseListGetRequest;

  try {
    const data = await api.listAdvertisesApiV1AdvertiseListGet(body);
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
| **positionId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
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


## listAdvertisesApiV1AdvertiseListGet_0

> any listAdvertisesApiV1AdvertiseListGet_0(positionId, status, page, limit)

广告列表

### Example

```ts
import {
  Configuration,
  AdvertiseApi,
} from '';
import type { ListAdvertisesApiV1AdvertiseListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AdvertiseApi();

  const body = {
    // number (optional)
    positionId: 56,
    // number (optional)
    status: 56,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListAdvertisesApiV1AdvertiseListGet0Request;

  try {
    const data = await api.listAdvertisesApiV1AdvertiseListGet_0(body);
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
| **positionId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
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


## positionListApiV1AdvertisePositionListGet

> any positionListApiV1AdvertisePositionListGet()

广告位列表

### Example

```ts
import {
  Configuration,
  AdvertiseApi,
} from '';
import type { PositionListApiV1AdvertisePositionListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AdvertiseApi();

  try {
    const data = await api.positionListApiV1AdvertisePositionListGet();
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


## positionListApiV1AdvertisePositionListGet_0

> any positionListApiV1AdvertisePositionListGet_0()

广告位列表

### Example

```ts
import {
  Configuration,
  AdvertiseApi,
} from '';
import type { PositionListApiV1AdvertisePositionListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AdvertiseApi();

  try {
    const data = await api.positionListApiV1AdvertisePositionListGet_0();
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


## recordClickApiV1AdvertiseAidClickPost

> any recordClickApiV1AdvertiseAidClickPost(aid)

记录广告点击

### Example

```ts
import {
  Configuration,
  AdvertiseApi,
} from '';
import type { RecordClickApiV1AdvertiseAidClickPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AdvertiseApi();

  const body = {
    // number
    aid: 56,
  } satisfies RecordClickApiV1AdvertiseAidClickPostRequest;

  try {
    const data = await api.recordClickApiV1AdvertiseAidClickPost(body);
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


## recordClickApiV1AdvertiseAidClickPost_0

> any recordClickApiV1AdvertiseAidClickPost_0(aid)

记录广告点击

### Example

```ts
import {
  Configuration,
  AdvertiseApi,
} from '';
import type { RecordClickApiV1AdvertiseAidClickPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AdvertiseApi();

  const body = {
    // number
    aid: 56,
  } satisfies RecordClickApiV1AdvertiseAidClickPost0Request;

  try {
    const data = await api.recordClickApiV1AdvertiseAidClickPost_0(body);
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


## updateAdvertiseApiV1AdvertiseAidPut

> any updateAdvertiseApiV1AdvertiseAidPut(aid, title, image, url, status, sortOrder)

修改广告

### Example

```ts
import {
  Configuration,
  AdvertiseApi,
} from '';
import type { UpdateAdvertiseApiV1AdvertiseAidPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AdvertiseApi();

  const body = {
    // number
    aid: 56,
    // string (optional)
    title: title_example,
    // string (optional)
    image: image_example,
    // string (optional)
    url: url_example,
    // number (optional)
    status: 56,
    // number (optional)
    sortOrder: 56,
  } satisfies UpdateAdvertiseApiV1AdvertiseAidPutRequest;

  try {
    const data = await api.updateAdvertiseApiV1AdvertiseAidPut(body);
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
| **image** | `string` |  | [Optional] [Defaults to `undefined`] |
| **url** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **sortOrder** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## updateAdvertiseApiV1AdvertiseAidPut_0

> any updateAdvertiseApiV1AdvertiseAidPut_0(aid, title, image, url, status, sortOrder)

修改广告

### Example

```ts
import {
  Configuration,
  AdvertiseApi,
} from '';
import type { UpdateAdvertiseApiV1AdvertiseAidPut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AdvertiseApi();

  const body = {
    // number
    aid: 56,
    // string (optional)
    title: title_example,
    // string (optional)
    image: image_example,
    // string (optional)
    url: url_example,
    // number (optional)
    status: 56,
    // number (optional)
    sortOrder: 56,
  } satisfies UpdateAdvertiseApiV1AdvertiseAidPut0Request;

  try {
    const data = await api.updateAdvertiseApiV1AdvertiseAidPut_0(body);
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
| **image** | `string` |  | [Optional] [Defaults to `undefined`] |
| **url** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **sortOrder** | `number` |  | [Optional] [Defaults to `undefined`] |

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

