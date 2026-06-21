# TongyiImageEditApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**textToImageApiV1TongyiImageEditTextToImagePost**](TongyiImageEditApi.md#texttoimageapiv1tongyiimageedittexttoimagepost) | **POST** /api/v1/tongyi-image-edit/text-to-image | 通义文生图 |
| [**textToImageApiV1TongyiImageEditTextToImagePost_0**](TongyiImageEditApi.md#texttoimageapiv1tongyiimageedittexttoimagepost_0) | **POST** /api/v1/tongyi-image-edit/text-to-image | 通义文生图 |
| [**tongyiImageEdit**](TongyiImageEditApi.md#tongyiimageedit) | **POST** /api/v1/tongyi-image-edit/image-edit | 通义图像编辑 |
| [**tongyiImageEditListModels**](TongyiImageEditApi.md#tongyiimageeditlistmodels) | **GET** /api/v1/tongyi-image-edit/models | 通义可用模型 |
| [**tongyiImageEditListModels_0**](TongyiImageEditApi.md#tongyiimageeditlistmodels_0) | **GET** /api/v1/tongyi-image-edit/models | 通义可用模型 |
| [**tongyiImageEdit_0**](TongyiImageEditApi.md#tongyiimageedit_0) | **POST** /api/v1/tongyi-image-edit/image-edit | 通义图像编辑 |



## textToImageApiV1TongyiImageEditTextToImagePost

> any textToImageApiV1TongyiImageEditTextToImagePost(bodyTextToImageApiV1TongyiImageEditTextToImagePost, apiKey)

通义文生图

### Example

```ts
import {
  Configuration,
  TongyiImageEditApi,
} from '';
import type { TextToImageApiV1TongyiImageEditTextToImagePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TongyiImageEditApi();

  const body = {
    // BodyTextToImageApiV1TongyiImageEditTextToImagePost
    bodyTextToImageApiV1TongyiImageEditTextToImagePost: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies TextToImageApiV1TongyiImageEditTextToImagePostRequest;

  try {
    const data = await api.textToImageApiV1TongyiImageEditTextToImagePost(body);
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
| **bodyTextToImageApiV1TongyiImageEditTextToImagePost** | [BodyTextToImageApiV1TongyiImageEditTextToImagePost](BodyTextToImageApiV1TongyiImageEditTextToImagePost.md) |  | |
| **apiKey** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## textToImageApiV1TongyiImageEditTextToImagePost_0

> any textToImageApiV1TongyiImageEditTextToImagePost_0(bodyTextToImageApiV1TongyiImageEditTextToImagePost, apiKey)

通义文生图

### Example

```ts
import {
  Configuration,
  TongyiImageEditApi,
} from '';
import type { TextToImageApiV1TongyiImageEditTextToImagePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TongyiImageEditApi();

  const body = {
    // BodyTextToImageApiV1TongyiImageEditTextToImagePost
    bodyTextToImageApiV1TongyiImageEditTextToImagePost: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies TextToImageApiV1TongyiImageEditTextToImagePost0Request;

  try {
    const data = await api.textToImageApiV1TongyiImageEditTextToImagePost_0(body);
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
| **bodyTextToImageApiV1TongyiImageEditTextToImagePost** | [BodyTextToImageApiV1TongyiImageEditTextToImagePost](BodyTextToImageApiV1TongyiImageEditTextToImagePost.md) |  | |
| **apiKey** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## tongyiImageEdit

> any tongyiImageEdit(bodyTongyiImageEdit, apiKey)

通义图像编辑

### Example

```ts
import {
  Configuration,
  TongyiImageEditApi,
} from '';
import type { TongyiImageEditRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TongyiImageEditApi();

  const body = {
    // BodyTongyiImageEdit
    bodyTongyiImageEdit: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies TongyiImageEditRequest;

  try {
    const data = await api.tongyiImageEdit(body);
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
| **bodyTongyiImageEdit** | [BodyTongyiImageEdit](BodyTongyiImageEdit.md) |  | |
| **apiKey** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## tongyiImageEditListModels

> any tongyiImageEditListModels()

通义可用模型

### Example

```ts
import {
  Configuration,
  TongyiImageEditApi,
} from '';
import type { TongyiImageEditListModelsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TongyiImageEditApi();

  try {
    const data = await api.tongyiImageEditListModels();
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


## tongyiImageEditListModels_0

> any tongyiImageEditListModels_0()

通义可用模型

### Example

```ts
import {
  Configuration,
  TongyiImageEditApi,
} from '';
import type { TongyiImageEditListModels0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TongyiImageEditApi();

  try {
    const data = await api.tongyiImageEditListModels_0();
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


## tongyiImageEdit_0

> any tongyiImageEdit_0(bodyTongyiImageEdit, apiKey)

通义图像编辑

### Example

```ts
import {
  Configuration,
  TongyiImageEditApi,
} from '';
import type { TongyiImageEdit0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TongyiImageEditApi();

  const body = {
    // BodyTongyiImageEdit
    bodyTongyiImageEdit: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies TongyiImageEdit0Request;

  try {
    const data = await api.tongyiImageEdit_0(body);
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
| **bodyTongyiImageEdit** | [BodyTongyiImageEdit](BodyTongyiImageEdit.md) |  | |
| **apiKey** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

