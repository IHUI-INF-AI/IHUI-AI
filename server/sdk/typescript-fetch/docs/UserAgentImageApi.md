# UserAgentImageApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createImageApiV1UserAgentImagePost**](UserAgentImageApi.md#createimageapiv1useragentimagepost) | **POST** /api/v1/user-agent-image | 记录图片交互 |
| [**createImageApiV1UserAgentImagePost_0**](UserAgentImageApi.md#createimageapiv1useragentimagepost_0) | **POST** /api/v1/user-agent-image | 记录图片交互 |
| [**deleteImageApiV1UserAgentImageIidDelete**](UserAgentImageApi.md#deleteimageapiv1useragentimageiiddelete) | **DELETE** /api/v1/user-agent-image/{iid} | 删除图片记录 |
| [**deleteImageApiV1UserAgentImageIidDelete_0**](UserAgentImageApi.md#deleteimageapiv1useragentimageiiddelete_0) | **DELETE** /api/v1/user-agent-image/{iid} | 删除图片记录 |
| [**getImageApiV1UserAgentImageIidGet**](UserAgentImageApi.md#getimageapiv1useragentimageiidget) | **GET** /api/v1/user-agent-image/{iid} | 图片详情 |
| [**getImageApiV1UserAgentImageIidGet_0**](UserAgentImageApi.md#getimageapiv1useragentimageiidget_0) | **GET** /api/v1/user-agent-image/{iid} | 图片详情 |
| [**listImagesApiV1UserAgentImageListGet**](UserAgentImageApi.md#listimagesapiv1useragentimagelistget) | **GET** /api/v1/user-agent-image/list | 我的图片交互 |
| [**listImagesApiV1UserAgentImageListGet_0**](UserAgentImageApi.md#listimagesapiv1useragentimagelistget_0) | **GET** /api/v1/user-agent-image/list | 我的图片交互 |



## createImageApiV1UserAgentImagePost

> any createImageApiV1UserAgentImagePost(imageUrl, imageType, agentId, agentName, prompt, model, taskId, status, cost, width, height, size)

记录图片交互

### Example

```ts
import {
  Configuration,
  UserAgentImageApi,
} from '';
import type { CreateImageApiV1UserAgentImagePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserAgentImageApi();

  const body = {
    // string
    imageUrl: imageUrl_example,
    // string (optional)
    imageType: imageType_example,
    // string (optional)
    agentId: agentId_example,
    // string (optional)
    agentName: agentName_example,
    // string (optional)
    prompt: prompt_example,
    // string (optional)
    model: model_example,
    // string (optional)
    taskId: taskId_example,
    // number (optional)
    status: 56,
    // number (optional)
    cost: 56,
    // number (optional)
    width: 56,
    // number (optional)
    height: 56,
    // number (optional)
    size: 56,
  } satisfies CreateImageApiV1UserAgentImagePostRequest;

  try {
    const data = await api.createImageApiV1UserAgentImagePost(body);
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
| **imageUrl** | `string` |  | [Defaults to `undefined`] |
| **imageType** | `string` |  | [Optional] [Defaults to `&#39;input&#39;`] |
| **agentId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **agentName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **prompt** | `string` |  | [Optional] [Defaults to `undefined`] |
| **model** | `string` |  | [Optional] [Defaults to `undefined`] |
| **taskId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `1`] |
| **cost** | `number` |  | [Optional] [Defaults to `0`] |
| **width** | `number` |  | [Optional] [Defaults to `0`] |
| **height** | `number` |  | [Optional] [Defaults to `0`] |
| **size** | `number` |  | [Optional] [Defaults to `0`] |

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


## createImageApiV1UserAgentImagePost_0

> any createImageApiV1UserAgentImagePost_0(imageUrl, imageType, agentId, agentName, prompt, model, taskId, status, cost, width, height, size)

记录图片交互

### Example

```ts
import {
  Configuration,
  UserAgentImageApi,
} from '';
import type { CreateImageApiV1UserAgentImagePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserAgentImageApi();

  const body = {
    // string
    imageUrl: imageUrl_example,
    // string (optional)
    imageType: imageType_example,
    // string (optional)
    agentId: agentId_example,
    // string (optional)
    agentName: agentName_example,
    // string (optional)
    prompt: prompt_example,
    // string (optional)
    model: model_example,
    // string (optional)
    taskId: taskId_example,
    // number (optional)
    status: 56,
    // number (optional)
    cost: 56,
    // number (optional)
    width: 56,
    // number (optional)
    height: 56,
    // number (optional)
    size: 56,
  } satisfies CreateImageApiV1UserAgentImagePost0Request;

  try {
    const data = await api.createImageApiV1UserAgentImagePost_0(body);
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
| **imageUrl** | `string` |  | [Defaults to `undefined`] |
| **imageType** | `string` |  | [Optional] [Defaults to `&#39;input&#39;`] |
| **agentId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **agentName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **prompt** | `string` |  | [Optional] [Defaults to `undefined`] |
| **model** | `string` |  | [Optional] [Defaults to `undefined`] |
| **taskId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `1`] |
| **cost** | `number` |  | [Optional] [Defaults to `0`] |
| **width** | `number` |  | [Optional] [Defaults to `0`] |
| **height** | `number` |  | [Optional] [Defaults to `0`] |
| **size** | `number` |  | [Optional] [Defaults to `0`] |

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


## deleteImageApiV1UserAgentImageIidDelete

> any deleteImageApiV1UserAgentImageIidDelete(iid)

删除图片记录

### Example

```ts
import {
  Configuration,
  UserAgentImageApi,
} from '';
import type { DeleteImageApiV1UserAgentImageIidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserAgentImageApi();

  const body = {
    // number
    iid: 56,
  } satisfies DeleteImageApiV1UserAgentImageIidDeleteRequest;

  try {
    const data = await api.deleteImageApiV1UserAgentImageIidDelete(body);
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
| **iid** | `number` |  | [Defaults to `undefined`] |

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


## deleteImageApiV1UserAgentImageIidDelete_0

> any deleteImageApiV1UserAgentImageIidDelete_0(iid)

删除图片记录

### Example

```ts
import {
  Configuration,
  UserAgentImageApi,
} from '';
import type { DeleteImageApiV1UserAgentImageIidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserAgentImageApi();

  const body = {
    // number
    iid: 56,
  } satisfies DeleteImageApiV1UserAgentImageIidDelete0Request;

  try {
    const data = await api.deleteImageApiV1UserAgentImageIidDelete_0(body);
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
| **iid** | `number` |  | [Defaults to `undefined`] |

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


## getImageApiV1UserAgentImageIidGet

> any getImageApiV1UserAgentImageIidGet(iid)

图片详情

### Example

```ts
import {
  Configuration,
  UserAgentImageApi,
} from '';
import type { GetImageApiV1UserAgentImageIidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserAgentImageApi();

  const body = {
    // number
    iid: 56,
  } satisfies GetImageApiV1UserAgentImageIidGetRequest;

  try {
    const data = await api.getImageApiV1UserAgentImageIidGet(body);
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
| **iid** | `number` |  | [Defaults to `undefined`] |

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


## getImageApiV1UserAgentImageIidGet_0

> any getImageApiV1UserAgentImageIidGet_0(iid)

图片详情

### Example

```ts
import {
  Configuration,
  UserAgentImageApi,
} from '';
import type { GetImageApiV1UserAgentImageIidGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserAgentImageApi();

  const body = {
    // number
    iid: 56,
  } satisfies GetImageApiV1UserAgentImageIidGet0Request;

  try {
    const data = await api.getImageApiV1UserAgentImageIidGet_0(body);
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
| **iid** | `number` |  | [Defaults to `undefined`] |

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


## listImagesApiV1UserAgentImageListGet

> any listImagesApiV1UserAgentImageListGet(page, limit, imageType, agentId)

我的图片交互

### Example

```ts
import {
  Configuration,
  UserAgentImageApi,
} from '';
import type { ListImagesApiV1UserAgentImageListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserAgentImageApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    imageType: imageType_example,
    // string (optional)
    agentId: agentId_example,
  } satisfies ListImagesApiV1UserAgentImageListGetRequest;

  try {
    const data = await api.listImagesApiV1UserAgentImageListGet(body);
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
| **imageType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **agentId** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## listImagesApiV1UserAgentImageListGet_0

> any listImagesApiV1UserAgentImageListGet_0(page, limit, imageType, agentId)

我的图片交互

### Example

```ts
import {
  Configuration,
  UserAgentImageApi,
} from '';
import type { ListImagesApiV1UserAgentImageListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserAgentImageApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    imageType: imageType_example,
    // string (optional)
    agentId: agentId_example,
  } satisfies ListImagesApiV1UserAgentImageListGet0Request;

  try {
    const data = await api.listImagesApiV1UserAgentImageListGet_0(body);
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
| **imageType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **agentId** | `string` |  | [Optional] [Defaults to `undefined`] |

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

