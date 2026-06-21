# DoubaoImageEditApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**doubaoImageEdit**](DoubaoImageEditApi.md#doubaoimageedit) | **POST** /api/v1/doubao-image-edit/image-edit | 豆包图片编辑 |
| [**doubaoImageEditListModels**](DoubaoImageEditApi.md#doubaoimageeditlistmodels) | **GET** /api/v1/doubao-image-edit/models | 豆包可用模型 |
| [**doubaoImageEditListModels_0**](DoubaoImageEditApi.md#doubaoimageeditlistmodels_0) | **GET** /api/v1/doubao-image-edit/models | 豆包可用模型 |
| [**doubaoImageEdit_0**](DoubaoImageEditApi.md#doubaoimageedit_0) | **POST** /api/v1/doubao-image-edit/image-edit | 豆包图片编辑 |
| [**imageGenerateApiV1DoubaoImageEditImageGeneratePost**](DoubaoImageEditApi.md#imagegenerateapiv1doubaoimageeditimagegeneratepost) | **POST** /api/v1/doubao-image-edit/image-generate | 豆包文生图 |
| [**imageGenerateApiV1DoubaoImageEditImageGeneratePost_0**](DoubaoImageEditApi.md#imagegenerateapiv1doubaoimageeditimagegeneratepost_0) | **POST** /api/v1/doubao-image-edit/image-generate | 豆包文生图 |



## doubaoImageEdit

> any doubaoImageEdit(bodyDoubaoImageEdit, apiKey)

豆包图片编辑

### Example

```ts
import {
  Configuration,
  DoubaoImageEditApi,
} from '';
import type { DoubaoImageEditRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DoubaoImageEditApi();

  const body = {
    // BodyDoubaoImageEdit
    bodyDoubaoImageEdit: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies DoubaoImageEditRequest;

  try {
    const data = await api.doubaoImageEdit(body);
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
| **bodyDoubaoImageEdit** | [BodyDoubaoImageEdit](BodyDoubaoImageEdit.md) |  | |
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


## doubaoImageEditListModels

> any doubaoImageEditListModels()

豆包可用模型

### Example

```ts
import {
  Configuration,
  DoubaoImageEditApi,
} from '';
import type { DoubaoImageEditListModelsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DoubaoImageEditApi();

  try {
    const data = await api.doubaoImageEditListModels();
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


## doubaoImageEditListModels_0

> any doubaoImageEditListModels_0()

豆包可用模型

### Example

```ts
import {
  Configuration,
  DoubaoImageEditApi,
} from '';
import type { DoubaoImageEditListModels0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DoubaoImageEditApi();

  try {
    const data = await api.doubaoImageEditListModels_0();
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


## doubaoImageEdit_0

> any doubaoImageEdit_0(bodyDoubaoImageEdit, apiKey)

豆包图片编辑

### Example

```ts
import {
  Configuration,
  DoubaoImageEditApi,
} from '';
import type { DoubaoImageEdit0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DoubaoImageEditApi();

  const body = {
    // BodyDoubaoImageEdit
    bodyDoubaoImageEdit: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies DoubaoImageEdit0Request;

  try {
    const data = await api.doubaoImageEdit_0(body);
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
| **bodyDoubaoImageEdit** | [BodyDoubaoImageEdit](BodyDoubaoImageEdit.md) |  | |
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


## imageGenerateApiV1DoubaoImageEditImageGeneratePost

> any imageGenerateApiV1DoubaoImageEditImageGeneratePost(bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost, apiKey)

豆包文生图

### Example

```ts
import {
  Configuration,
  DoubaoImageEditApi,
} from '';
import type { ImageGenerateApiV1DoubaoImageEditImageGeneratePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DoubaoImageEditApi();

  const body = {
    // BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost
    bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies ImageGenerateApiV1DoubaoImageEditImageGeneratePostRequest;

  try {
    const data = await api.imageGenerateApiV1DoubaoImageEditImageGeneratePost(body);
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
| **bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost** | [BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost](BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost.md) |  | |
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


## imageGenerateApiV1DoubaoImageEditImageGeneratePost_0

> any imageGenerateApiV1DoubaoImageEditImageGeneratePost_0(bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost, apiKey)

豆包文生图

### Example

```ts
import {
  Configuration,
  DoubaoImageEditApi,
} from '';
import type { ImageGenerateApiV1DoubaoImageEditImageGeneratePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DoubaoImageEditApi();

  const body = {
    // BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost
    bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies ImageGenerateApiV1DoubaoImageEditImageGeneratePost0Request;

  try {
    const data = await api.imageGenerateApiV1DoubaoImageEditImageGeneratePost_0(body);
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
| **bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost** | [BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost](BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost.md) |  | |
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

