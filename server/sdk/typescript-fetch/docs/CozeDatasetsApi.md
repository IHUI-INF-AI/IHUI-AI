# CozeDatasetsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createDatasetApiV1CozeDatasetsDatasetsPost**](CozeDatasetsApi.md#createdatasetapiv1cozedatasetsdatasetspost) | **POST** /api/v1/coze/datasets/datasets | Create Dataset |
| [**createDatasetApiV1CozeDatasetsDatasetsPost_0**](CozeDatasetsApi.md#createdatasetapiv1cozedatasetsdatasetspost_0) | **POST** /api/v1/coze/datasets/datasets | Create Dataset |
| [**listDatasetsApiV1CozeDatasetsDatasetsListPost**](CozeDatasetsApi.md#listdatasetsapiv1cozedatasetsdatasetslistpost) | **POST** /api/v1/coze/datasets/datasets/list | List Datasets |
| [**listDatasetsApiV1CozeDatasetsDatasetsListPost_0**](CozeDatasetsApi.md#listdatasetsapiv1cozedatasetsdatasetslistpost_0) | **POST** /api/v1/coze/datasets/datasets/list | List Datasets |
| [**listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost**](CozeDatasetsApi.md#listdocumentsapiv1cozedatasetsdatasetsdocumentslistpost) | **POST** /api/v1/coze/datasets/datasets/documents/list | List Documents |
| [**listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0**](CozeDatasetsApi.md#listdocumentsapiv1cozedatasetsdatasetsdocumentslistpost_0) | **POST** /api/v1/coze/datasets/datasets/documents/list | List Documents |
| [**listImagesApiV1CozeDatasetsDatasetsImagesListPost**](CozeDatasetsApi.md#listimagesapiv1cozedatasetsdatasetsimageslistpost) | **POST** /api/v1/coze/datasets/datasets/images/list | List Images |
| [**listImagesApiV1CozeDatasetsDatasetsImagesListPost_0**](CozeDatasetsApi.md#listimagesapiv1cozedatasetsdatasetsimageslistpost_0) | **POST** /api/v1/coze/datasets/datasets/images/list | List Images |
| [**uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost**](CozeDatasetsApi.md#uploaddocumentapiv1cozedatasetsdatasetsdocumentsuploadpost) | **POST** /api/v1/coze/datasets/datasets/documents/upload | Upload Document |
| [**uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0**](CozeDatasetsApi.md#uploaddocumentapiv1cozedatasetsdatasetsdocumentsuploadpost_0) | **POST** /api/v1/coze/datasets/datasets/documents/upload | Upload Document |
| [**uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost**](CozeDatasetsApi.md#uploadimageapiv1cozedatasetsdatasetsimagesuploadpost) | **POST** /api/v1/coze/datasets/datasets/images/upload | Upload Image |
| [**uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0**](CozeDatasetsApi.md#uploadimageapiv1cozedatasetsdatasetsimagesuploadpost_0) | **POST** /api/v1/coze/datasets/datasets/images/upload | Upload Image |



## createDatasetApiV1CozeDatasetsDatasetsPost

> any createDatasetApiV1CozeDatasetsDatasetsPost(datasetCreateReq)

Create Dataset

### Example

```ts
import {
  Configuration,
  CozeDatasetsApi,
} from '';
import type { CreateDatasetApiV1CozeDatasetsDatasetsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeDatasetsApi();

  const body = {
    // DatasetCreateReq
    datasetCreateReq: ...,
  } satisfies CreateDatasetApiV1CozeDatasetsDatasetsPostRequest;

  try {
    const data = await api.createDatasetApiV1CozeDatasetsDatasetsPost(body);
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
| **datasetCreateReq** | [DatasetCreateReq](DatasetCreateReq.md) |  | |

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


## createDatasetApiV1CozeDatasetsDatasetsPost_0

> any createDatasetApiV1CozeDatasetsDatasetsPost_0(datasetCreateReq)

Create Dataset

### Example

```ts
import {
  Configuration,
  CozeDatasetsApi,
} from '';
import type { CreateDatasetApiV1CozeDatasetsDatasetsPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeDatasetsApi();

  const body = {
    // DatasetCreateReq
    datasetCreateReq: ...,
  } satisfies CreateDatasetApiV1CozeDatasetsDatasetsPost0Request;

  try {
    const data = await api.createDatasetApiV1CozeDatasetsDatasetsPost_0(body);
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
| **datasetCreateReq** | [DatasetCreateReq](DatasetCreateReq.md) |  | |

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


## listDatasetsApiV1CozeDatasetsDatasetsListPost

> any listDatasetsApiV1CozeDatasetsDatasetsListPost(datasetListReq)

List Datasets

### Example

```ts
import {
  Configuration,
  CozeDatasetsApi,
} from '';
import type { ListDatasetsApiV1CozeDatasetsDatasetsListPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeDatasetsApi();

  const body = {
    // DatasetListReq
    datasetListReq: ...,
  } satisfies ListDatasetsApiV1CozeDatasetsDatasetsListPostRequest;

  try {
    const data = await api.listDatasetsApiV1CozeDatasetsDatasetsListPost(body);
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
| **datasetListReq** | [DatasetListReq](DatasetListReq.md) |  | |

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


## listDatasetsApiV1CozeDatasetsDatasetsListPost_0

> any listDatasetsApiV1CozeDatasetsDatasetsListPost_0(datasetListReq)

List Datasets

### Example

```ts
import {
  Configuration,
  CozeDatasetsApi,
} from '';
import type { ListDatasetsApiV1CozeDatasetsDatasetsListPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeDatasetsApi();

  const body = {
    // DatasetListReq
    datasetListReq: ...,
  } satisfies ListDatasetsApiV1CozeDatasetsDatasetsListPost0Request;

  try {
    const data = await api.listDatasetsApiV1CozeDatasetsDatasetsListPost_0(body);
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
| **datasetListReq** | [DatasetListReq](DatasetListReq.md) |  | |

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


## listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost

> any listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost(docListReq)

List Documents

### Example

```ts
import {
  Configuration,
  CozeDatasetsApi,
} from '';
import type { ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeDatasetsApi();

  const body = {
    // DocListReq
    docListReq: ...,
  } satisfies ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPostRequest;

  try {
    const data = await api.listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost(body);
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
| **docListReq** | [DocListReq](DocListReq.md) |  | |

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


## listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0

> any listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0(docListReq)

List Documents

### Example

```ts
import {
  Configuration,
  CozeDatasetsApi,
} from '';
import type { ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeDatasetsApi();

  const body = {
    // DocListReq
    docListReq: ...,
  } satisfies ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost0Request;

  try {
    const data = await api.listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0(body);
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
| **docListReq** | [DocListReq](DocListReq.md) |  | |

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


## listImagesApiV1CozeDatasetsDatasetsImagesListPost

> any listImagesApiV1CozeDatasetsDatasetsImagesListPost(imageListReq)

List Images

### Example

```ts
import {
  Configuration,
  CozeDatasetsApi,
} from '';
import type { ListImagesApiV1CozeDatasetsDatasetsImagesListPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeDatasetsApi();

  const body = {
    // ImageListReq
    imageListReq: ...,
  } satisfies ListImagesApiV1CozeDatasetsDatasetsImagesListPostRequest;

  try {
    const data = await api.listImagesApiV1CozeDatasetsDatasetsImagesListPost(body);
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
| **imageListReq** | [ImageListReq](ImageListReq.md) |  | |

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


## listImagesApiV1CozeDatasetsDatasetsImagesListPost_0

> any listImagesApiV1CozeDatasetsDatasetsImagesListPost_0(imageListReq)

List Images

### Example

```ts
import {
  Configuration,
  CozeDatasetsApi,
} from '';
import type { ListImagesApiV1CozeDatasetsDatasetsImagesListPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeDatasetsApi();

  const body = {
    // ImageListReq
    imageListReq: ...,
  } satisfies ListImagesApiV1CozeDatasetsDatasetsImagesListPost0Request;

  try {
    const data = await api.listImagesApiV1CozeDatasetsDatasetsImagesListPost_0(body);
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
| **imageListReq** | [ImageListReq](ImageListReq.md) |  | |

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


## uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost

> any uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost(datasetId, file)

Upload Document

### Example

```ts
import {
  Configuration,
  CozeDatasetsApi,
} from '';
import type { UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeDatasetsApi();

  const body = {
    // string
    datasetId: datasetId_example,
    // Blob
    file: BINARY_DATA_HERE,
  } satisfies UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPostRequest;

  try {
    const data = await api.uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost(body);
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
| **datasetId** | `string` |  | [Defaults to `undefined`] |
| **file** | `Blob` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0

> any uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0(datasetId, file)

Upload Document

### Example

```ts
import {
  Configuration,
  CozeDatasetsApi,
} from '';
import type { UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeDatasetsApi();

  const body = {
    // string
    datasetId: datasetId_example,
    // Blob
    file: BINARY_DATA_HERE,
  } satisfies UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost0Request;

  try {
    const data = await api.uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0(body);
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
| **datasetId** | `string` |  | [Defaults to `undefined`] |
| **file** | `Blob` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost

> any uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost(datasetId, file)

Upload Image

### Example

```ts
import {
  Configuration,
  CozeDatasetsApi,
} from '';
import type { UploadImageApiV1CozeDatasetsDatasetsImagesUploadPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeDatasetsApi();

  const body = {
    // string
    datasetId: datasetId_example,
    // Blob
    file: BINARY_DATA_HERE,
  } satisfies UploadImageApiV1CozeDatasetsDatasetsImagesUploadPostRequest;

  try {
    const data = await api.uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost(body);
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
| **datasetId** | `string` |  | [Defaults to `undefined`] |
| **file** | `Blob` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0

> any uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0(datasetId, file)

Upload Image

### Example

```ts
import {
  Configuration,
  CozeDatasetsApi,
} from '';
import type { UploadImageApiV1CozeDatasetsDatasetsImagesUploadPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeDatasetsApi();

  const body = {
    // string
    datasetId: datasetId_example,
    // Blob
    file: BINARY_DATA_HERE,
  } satisfies UploadImageApiV1CozeDatasetsDatasetsImagesUploadPost0Request;

  try {
    const data = await api.uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0(body);
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
| **datasetId** | `string` |  | [Defaults to `undefined`] |
| **file** | `Blob` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

