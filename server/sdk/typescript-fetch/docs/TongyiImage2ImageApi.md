# TongyiImage2ImageApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost**](TongyiImage2ImageApi.md#backgroundgenerationapiv1tongyiimage2imagebackgroundgenerationpost) | **POST** /api/v1/tongyi-image2image/background-generation | 通义背景生成 |
| [**backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0**](TongyiImage2ImageApi.md#backgroundgenerationapiv1tongyiimage2imagebackgroundgenerationpost_0) | **POST** /api/v1/tongyi-image2image/background-generation | 通义背景生成 |
| [**imageToImageApiV1TongyiImage2imageImageToImagePost**](TongyiImage2ImageApi.md#imagetoimageapiv1tongyiimage2imageimagetoimagepost) | **POST** /api/v1/tongyi-image2image/image-to-image | 通义图生图 |
| [**imageToImageApiV1TongyiImage2imageImageToImagePost_0**](TongyiImage2ImageApi.md#imagetoimageapiv1tongyiimage2imageimagetoimagepost_0) | **POST** /api/v1/tongyi-image2image/image-to-image | 通义图生图 |
| [**styleTransferApiV1TongyiImage2imageStyleTransferPost**](TongyiImage2ImageApi.md#styletransferapiv1tongyiimage2imagestyletransferpost) | **POST** /api/v1/tongyi-image2image/style-transfer | 通义风格迁移 |
| [**styleTransferApiV1TongyiImage2imageStyleTransferPost_0**](TongyiImage2ImageApi.md#styletransferapiv1tongyiimage2imagestyletransferpost_0) | **POST** /api/v1/tongyi-image2image/style-transfer | 通义风格迁移 |
| [**tongyiImage2imageListModels**](TongyiImage2ImageApi.md#tongyiimage2imagelistmodels) | **GET** /api/v1/tongyi-image2image/models | 通义图生图可用模型 |
| [**tongyiImage2imageListModels_0**](TongyiImage2ImageApi.md#tongyiimage2imagelistmodels_0) | **GET** /api/v1/tongyi-image2image/models | 通义图生图可用模型 |
| [**virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost**](TongyiImage2ImageApi.md#virtualtryonapiv1tongyiimage2imagevirtualtryonpost) | **POST** /api/v1/tongyi-image2image/virtual-try-on | 通义虚拟试衣 |
| [**virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0**](TongyiImage2ImageApi.md#virtualtryonapiv1tongyiimage2imagevirtualtryonpost_0) | **POST** /api/v1/tongyi-image2image/virtual-try-on | 通义虚拟试衣 |



## backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost

> any backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost(bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost, apiKey)

通义背景生成

### Example

```ts
import {
  Configuration,
  TongyiImage2ImageApi,
} from '';
import type { BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TongyiImage2ImageApi();

  const body = {
    // BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost
    bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPostRequest;

  try {
    const data = await api.backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost(body);
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
| **bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost** | [BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost](BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost.md) |  | |
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


## backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0

> any backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0(bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost, apiKey)

通义背景生成

### Example

```ts
import {
  Configuration,
  TongyiImage2ImageApi,
} from '';
import type { BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TongyiImage2ImageApi();

  const body = {
    // BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost
    bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies BackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost0Request;

  try {
    const data = await api.backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0(body);
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
| **bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost** | [BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost](BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost.md) |  | |
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


## imageToImageApiV1TongyiImage2imageImageToImagePost

> any imageToImageApiV1TongyiImage2imageImageToImagePost(bodyImageToImageApiV1TongyiImage2imageImageToImagePost, apiKey)

通义图生图

### Example

```ts
import {
  Configuration,
  TongyiImage2ImageApi,
} from '';
import type { ImageToImageApiV1TongyiImage2imageImageToImagePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TongyiImage2ImageApi();

  const body = {
    // BodyImageToImageApiV1TongyiImage2imageImageToImagePost
    bodyImageToImageApiV1TongyiImage2imageImageToImagePost: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies ImageToImageApiV1TongyiImage2imageImageToImagePostRequest;

  try {
    const data = await api.imageToImageApiV1TongyiImage2imageImageToImagePost(body);
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
| **bodyImageToImageApiV1TongyiImage2imageImageToImagePost** | [BodyImageToImageApiV1TongyiImage2imageImageToImagePost](BodyImageToImageApiV1TongyiImage2imageImageToImagePost.md) |  | |
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


## imageToImageApiV1TongyiImage2imageImageToImagePost_0

> any imageToImageApiV1TongyiImage2imageImageToImagePost_0(bodyImageToImageApiV1TongyiImage2imageImageToImagePost, apiKey)

通义图生图

### Example

```ts
import {
  Configuration,
  TongyiImage2ImageApi,
} from '';
import type { ImageToImageApiV1TongyiImage2imageImageToImagePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TongyiImage2ImageApi();

  const body = {
    // BodyImageToImageApiV1TongyiImage2imageImageToImagePost
    bodyImageToImageApiV1TongyiImage2imageImageToImagePost: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies ImageToImageApiV1TongyiImage2imageImageToImagePost0Request;

  try {
    const data = await api.imageToImageApiV1TongyiImage2imageImageToImagePost_0(body);
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
| **bodyImageToImageApiV1TongyiImage2imageImageToImagePost** | [BodyImageToImageApiV1TongyiImage2imageImageToImagePost](BodyImageToImageApiV1TongyiImage2imageImageToImagePost.md) |  | |
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


## styleTransferApiV1TongyiImage2imageStyleTransferPost

> any styleTransferApiV1TongyiImage2imageStyleTransferPost(bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost, apiKey)

通义风格迁移

### Example

```ts
import {
  Configuration,
  TongyiImage2ImageApi,
} from '';
import type { StyleTransferApiV1TongyiImage2imageStyleTransferPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TongyiImage2ImageApi();

  const body = {
    // BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost
    bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies StyleTransferApiV1TongyiImage2imageStyleTransferPostRequest;

  try {
    const data = await api.styleTransferApiV1TongyiImage2imageStyleTransferPost(body);
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
| **bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost** | [BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost](BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost.md) |  | |
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


## styleTransferApiV1TongyiImage2imageStyleTransferPost_0

> any styleTransferApiV1TongyiImage2imageStyleTransferPost_0(bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost, apiKey)

通义风格迁移

### Example

```ts
import {
  Configuration,
  TongyiImage2ImageApi,
} from '';
import type { StyleTransferApiV1TongyiImage2imageStyleTransferPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TongyiImage2ImageApi();

  const body = {
    // BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost
    bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies StyleTransferApiV1TongyiImage2imageStyleTransferPost0Request;

  try {
    const data = await api.styleTransferApiV1TongyiImage2imageStyleTransferPost_0(body);
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
| **bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost** | [BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost](BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost.md) |  | |
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


## tongyiImage2imageListModels

> any tongyiImage2imageListModels()

通义图生图可用模型

### Example

```ts
import {
  Configuration,
  TongyiImage2ImageApi,
} from '';
import type { TongyiImage2imageListModelsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TongyiImage2ImageApi();

  try {
    const data = await api.tongyiImage2imageListModels();
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


## tongyiImage2imageListModels_0

> any tongyiImage2imageListModels_0()

通义图生图可用模型

### Example

```ts
import {
  Configuration,
  TongyiImage2ImageApi,
} from '';
import type { TongyiImage2imageListModels0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TongyiImage2ImageApi();

  try {
    const data = await api.tongyiImage2imageListModels_0();
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


## virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost

> any virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost(bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost, apiKey)

通义虚拟试衣

### Example

```ts
import {
  Configuration,
  TongyiImage2ImageApi,
} from '';
import type { VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TongyiImage2ImageApi();

  const body = {
    // BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost
    bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPostRequest;

  try {
    const data = await api.virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost(body);
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
| **bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost** | [BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost](BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost.md) |  | |
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


## virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0

> any virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0(bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost, apiKey)

通义虚拟试衣

### Example

```ts
import {
  Configuration,
  TongyiImage2ImageApi,
} from '';
import type { VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TongyiImage2ImageApi();

  const body = {
    // BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost
    bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies VirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost0Request;

  try {
    const data = await api.virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0(body);
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
| **bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost** | [BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost](BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost.md) |  | |
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

