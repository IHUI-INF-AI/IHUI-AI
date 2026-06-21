# AppVersionApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**checkUpdateApiV1AppVersionCheckGet**](AppVersionApi.md#checkupdateapiv1appversioncheckget) | **GET** /api/v1/app-version/check | 检查更新 |
| [**checkUpdateApiV1AppVersionCheckGet_0**](AppVersionApi.md#checkupdateapiv1appversioncheckget_0) | **GET** /api/v1/app-version/check | 检查更新 |
| [**createVersionApiV1AppVersionPost**](AppVersionApi.md#createversionapiv1appversionpost) | **POST** /api/v1/app-version | 新增版本 |
| [**createVersionApiV1AppVersionPost_0**](AppVersionApi.md#createversionapiv1appversionpost_0) | **POST** /api/v1/app-version | 新增版本 |
| [**deleteVersionApiV1AppVersionVidDelete**](AppVersionApi.md#deleteversionapiv1appversionviddelete) | **DELETE** /api/v1/app-version/{vid} | 删除版本 |
| [**deleteVersionApiV1AppVersionVidDelete_0**](AppVersionApi.md#deleteversionapiv1appversionviddelete_0) | **DELETE** /api/v1/app-version/{vid} | 删除版本 |
| [**listVersionsApiV1AppVersionListGet**](AppVersionApi.md#listversionsapiv1appversionlistget) | **GET** /api/v1/app-version/list | 版本列表 |
| [**listVersionsApiV1AppVersionListGet_0**](AppVersionApi.md#listversionsapiv1appversionlistget_0) | **GET** /api/v1/app-version/list | 版本列表 |
| [**updateVersionApiV1AppVersionVidPut**](AppVersionApi.md#updateversionapiv1appversionvidput) | **PUT** /api/v1/app-version/{vid} | 修改版本 |
| [**updateVersionApiV1AppVersionVidPut_0**](AppVersionApi.md#updateversionapiv1appversionvidput_0) | **PUT** /api/v1/app-version/{vid} | 修改版本 |



## checkUpdateApiV1AppVersionCheckGet

> any checkUpdateApiV1AppVersionCheckGet(platform, currentVersion, build)

检查更新

### Example

```ts
import {
  Configuration,
  AppVersionApi,
} from '';
import type { CheckUpdateApiV1AppVersionCheckGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AppVersionApi();

  const body = {
    // string
    platform: platform_example,
    // string
    currentVersion: currentVersion_example,
    // number (optional)
    build: 56,
  } satisfies CheckUpdateApiV1AppVersionCheckGetRequest;

  try {
    const data = await api.checkUpdateApiV1AppVersionCheckGet(body);
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
| **platform** | `string` |  | [Defaults to `undefined`] |
| **currentVersion** | `string` |  | [Defaults to `undefined`] |
| **build** | `number` |  | [Optional] [Defaults to `0`] |

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


## checkUpdateApiV1AppVersionCheckGet_0

> any checkUpdateApiV1AppVersionCheckGet_0(platform, currentVersion, build)

检查更新

### Example

```ts
import {
  Configuration,
  AppVersionApi,
} from '';
import type { CheckUpdateApiV1AppVersionCheckGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AppVersionApi();

  const body = {
    // string
    platform: platform_example,
    // string
    currentVersion: currentVersion_example,
    // number (optional)
    build: 56,
  } satisfies CheckUpdateApiV1AppVersionCheckGet0Request;

  try {
    const data = await api.checkUpdateApiV1AppVersionCheckGet_0(body);
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
| **platform** | `string` |  | [Defaults to `undefined`] |
| **currentVersion** | `string` |  | [Defaults to `undefined`] |
| **build** | `number` |  | [Optional] [Defaults to `0`] |

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


## createVersionApiV1AppVersionPost

> any createVersionApiV1AppVersionPost(platform, version, title, content, build, downloadUrl, isForce, isSilent, minVersion, grayRatio, fileSize, md5)

新增版本

### Example

```ts
import {
  Configuration,
  AppVersionApi,
} from '';
import type { CreateVersionApiV1AppVersionPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AppVersionApi();

  const body = {
    // string
    platform: platform_example,
    // string
    version: version_example,
    // string
    title: title_example,
    // string
    content: content_example,
    // number (optional)
    build: 56,
    // string (optional)
    downloadUrl: downloadUrl_example,
    // boolean (optional)
    isForce: true,
    // boolean (optional)
    isSilent: true,
    // string (optional)
    minVersion: minVersion_example,
    // number (optional)
    grayRatio: 56,
    // number (optional)
    fileSize: 56,
    // string (optional)
    md5: md5_example,
  } satisfies CreateVersionApiV1AppVersionPostRequest;

  try {
    const data = await api.createVersionApiV1AppVersionPost(body);
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
| **platform** | `string` |  | [Defaults to `undefined`] |
| **version** | `string` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Defaults to `undefined`] |
| **build** | `number` |  | [Optional] [Defaults to `1`] |
| **downloadUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **isForce** | `boolean` |  | [Optional] [Defaults to `false`] |
| **isSilent** | `boolean` |  | [Optional] [Defaults to `false`] |
| **minVersion** | `string` |  | [Optional] [Defaults to `undefined`] |
| **grayRatio** | `number` |  | [Optional] [Defaults to `0`] |
| **fileSize** | `number` |  | [Optional] [Defaults to `0`] |
| **md5** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## createVersionApiV1AppVersionPost_0

> any createVersionApiV1AppVersionPost_0(platform, version, title, content, build, downloadUrl, isForce, isSilent, minVersion, grayRatio, fileSize, md5)

新增版本

### Example

```ts
import {
  Configuration,
  AppVersionApi,
} from '';
import type { CreateVersionApiV1AppVersionPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AppVersionApi();

  const body = {
    // string
    platform: platform_example,
    // string
    version: version_example,
    // string
    title: title_example,
    // string
    content: content_example,
    // number (optional)
    build: 56,
    // string (optional)
    downloadUrl: downloadUrl_example,
    // boolean (optional)
    isForce: true,
    // boolean (optional)
    isSilent: true,
    // string (optional)
    minVersion: minVersion_example,
    // number (optional)
    grayRatio: 56,
    // number (optional)
    fileSize: 56,
    // string (optional)
    md5: md5_example,
  } satisfies CreateVersionApiV1AppVersionPost0Request;

  try {
    const data = await api.createVersionApiV1AppVersionPost_0(body);
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
| **platform** | `string` |  | [Defaults to `undefined`] |
| **version** | `string` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Defaults to `undefined`] |
| **build** | `number` |  | [Optional] [Defaults to `1`] |
| **downloadUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **isForce** | `boolean` |  | [Optional] [Defaults to `false`] |
| **isSilent** | `boolean` |  | [Optional] [Defaults to `false`] |
| **minVersion** | `string` |  | [Optional] [Defaults to `undefined`] |
| **grayRatio** | `number` |  | [Optional] [Defaults to `0`] |
| **fileSize** | `number` |  | [Optional] [Defaults to `0`] |
| **md5** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## deleteVersionApiV1AppVersionVidDelete

> any deleteVersionApiV1AppVersionVidDelete(vid)

删除版本

### Example

```ts
import {
  Configuration,
  AppVersionApi,
} from '';
import type { DeleteVersionApiV1AppVersionVidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AppVersionApi();

  const body = {
    // number
    vid: 56,
  } satisfies DeleteVersionApiV1AppVersionVidDeleteRequest;

  try {
    const data = await api.deleteVersionApiV1AppVersionVidDelete(body);
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
| **vid** | `number` |  | [Defaults to `undefined`] |

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


## deleteVersionApiV1AppVersionVidDelete_0

> any deleteVersionApiV1AppVersionVidDelete_0(vid)

删除版本

### Example

```ts
import {
  Configuration,
  AppVersionApi,
} from '';
import type { DeleteVersionApiV1AppVersionVidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AppVersionApi();

  const body = {
    // number
    vid: 56,
  } satisfies DeleteVersionApiV1AppVersionVidDelete0Request;

  try {
    const data = await api.deleteVersionApiV1AppVersionVidDelete_0(body);
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
| **vid** | `number` |  | [Defaults to `undefined`] |

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


## listVersionsApiV1AppVersionListGet

> any listVersionsApiV1AppVersionListGet(platform, page, limit)

版本列表

### Example

```ts
import {
  Configuration,
  AppVersionApi,
} from '';
import type { ListVersionsApiV1AppVersionListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AppVersionApi();

  const body = {
    // string (optional)
    platform: platform_example,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListVersionsApiV1AppVersionListGetRequest;

  try {
    const data = await api.listVersionsApiV1AppVersionListGet(body);
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
| **platform** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## listVersionsApiV1AppVersionListGet_0

> any listVersionsApiV1AppVersionListGet_0(platform, page, limit)

版本列表

### Example

```ts
import {
  Configuration,
  AppVersionApi,
} from '';
import type { ListVersionsApiV1AppVersionListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AppVersionApi();

  const body = {
    // string (optional)
    platform: platform_example,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListVersionsApiV1AppVersionListGet0Request;

  try {
    const data = await api.listVersionsApiV1AppVersionListGet_0(body);
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
| **platform** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## updateVersionApiV1AppVersionVidPut

> any updateVersionApiV1AppVersionVidPut(vid, title, content, status, isForce, downloadUrl, grayRatio)

修改版本

### Example

```ts
import {
  Configuration,
  AppVersionApi,
} from '';
import type { UpdateVersionApiV1AppVersionVidPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AppVersionApi();

  const body = {
    // number
    vid: 56,
    // string (optional)
    title: title_example,
    // string (optional)
    content: content_example,
    // number (optional)
    status: 56,
    // boolean (optional)
    isForce: true,
    // string (optional)
    downloadUrl: downloadUrl_example,
    // number (optional)
    grayRatio: 56,
  } satisfies UpdateVersionApiV1AppVersionVidPutRequest;

  try {
    const data = await api.updateVersionApiV1AppVersionVidPut(body);
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
| **vid** | `number` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |
| **content** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **isForce** | `boolean` |  | [Optional] [Defaults to `undefined`] |
| **downloadUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **grayRatio** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## updateVersionApiV1AppVersionVidPut_0

> any updateVersionApiV1AppVersionVidPut_0(vid, title, content, status, isForce, downloadUrl, grayRatio)

修改版本

### Example

```ts
import {
  Configuration,
  AppVersionApi,
} from '';
import type { UpdateVersionApiV1AppVersionVidPut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AppVersionApi();

  const body = {
    // number
    vid: 56,
    // string (optional)
    title: title_example,
    // string (optional)
    content: content_example,
    // number (optional)
    status: 56,
    // boolean (optional)
    isForce: true,
    // string (optional)
    downloadUrl: downloadUrl_example,
    // number (optional)
    grayRatio: 56,
  } satisfies UpdateVersionApiV1AppVersionVidPut0Request;

  try {
    const data = await api.updateVersionApiV1AppVersionVidPut_0(body);
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
| **vid** | `number` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |
| **content** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **isForce** | `boolean` |  | [Optional] [Defaults to `undefined`] |
| **downloadUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **grayRatio** | `number` |  | [Optional] [Defaults to `undefined`] |

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

