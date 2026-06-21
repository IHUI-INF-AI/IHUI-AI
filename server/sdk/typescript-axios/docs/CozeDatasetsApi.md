# CozeDatasetsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createDatasetApiV1CozeDatasetsDatasetsPost**](#createdatasetapiv1cozedatasetsdatasetspost) | **POST** /api/v1/coze/datasets/datasets | Create Dataset|
|[**createDatasetApiV1CozeDatasetsDatasetsPost_0**](#createdatasetapiv1cozedatasetsdatasetspost_0) | **POST** /api/v1/coze/datasets/datasets | Create Dataset|
|[**listDatasetsApiV1CozeDatasetsDatasetsListPost**](#listdatasetsapiv1cozedatasetsdatasetslistpost) | **POST** /api/v1/coze/datasets/datasets/list | List Datasets|
|[**listDatasetsApiV1CozeDatasetsDatasetsListPost_0**](#listdatasetsapiv1cozedatasetsdatasetslistpost_0) | **POST** /api/v1/coze/datasets/datasets/list | List Datasets|
|[**listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost**](#listdocumentsapiv1cozedatasetsdatasetsdocumentslistpost) | **POST** /api/v1/coze/datasets/datasets/documents/list | List Documents|
|[**listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0**](#listdocumentsapiv1cozedatasetsdatasetsdocumentslistpost_0) | **POST** /api/v1/coze/datasets/datasets/documents/list | List Documents|
|[**listImagesApiV1CozeDatasetsDatasetsImagesListPost**](#listimagesapiv1cozedatasetsdatasetsimageslistpost) | **POST** /api/v1/coze/datasets/datasets/images/list | List Images|
|[**listImagesApiV1CozeDatasetsDatasetsImagesListPost_0**](#listimagesapiv1cozedatasetsdatasetsimageslistpost_0) | **POST** /api/v1/coze/datasets/datasets/images/list | List Images|
|[**uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost**](#uploaddocumentapiv1cozedatasetsdatasetsdocumentsuploadpost) | **POST** /api/v1/coze/datasets/datasets/documents/upload | Upload Document|
|[**uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0**](#uploaddocumentapiv1cozedatasetsdatasetsdocumentsuploadpost_0) | **POST** /api/v1/coze/datasets/datasets/documents/upload | Upload Document|
|[**uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost**](#uploadimageapiv1cozedatasetsdatasetsimagesuploadpost) | **POST** /api/v1/coze/datasets/datasets/images/upload | Upload Image|
|[**uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0**](#uploadimageapiv1cozedatasetsdatasetsimagesuploadpost_0) | **POST** /api/v1/coze/datasets/datasets/images/upload | Upload Image|

# **createDatasetApiV1CozeDatasetsDatasetsPost**
> any createDatasetApiV1CozeDatasetsDatasetsPost(datasetCreateReq)


### Example

```typescript
import {
    CozeDatasetsApi,
    Configuration,
    DatasetCreateReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeDatasetsApi(configuration);

let datasetCreateReq: DatasetCreateReq; //

const { status, data } = await apiInstance.createDatasetApiV1CozeDatasetsDatasetsPost(
    datasetCreateReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **datasetCreateReq** | **DatasetCreateReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createDatasetApiV1CozeDatasetsDatasetsPost_0**
> any createDatasetApiV1CozeDatasetsDatasetsPost_0(datasetCreateReq)


### Example

```typescript
import {
    CozeDatasetsApi,
    Configuration,
    DatasetCreateReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeDatasetsApi(configuration);

let datasetCreateReq: DatasetCreateReq; //

const { status, data } = await apiInstance.createDatasetApiV1CozeDatasetsDatasetsPost_0(
    datasetCreateReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **datasetCreateReq** | **DatasetCreateReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listDatasetsApiV1CozeDatasetsDatasetsListPost**
> any listDatasetsApiV1CozeDatasetsDatasetsListPost(datasetListReq)


### Example

```typescript
import {
    CozeDatasetsApi,
    Configuration,
    DatasetListReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeDatasetsApi(configuration);

let datasetListReq: DatasetListReq; //

const { status, data } = await apiInstance.listDatasetsApiV1CozeDatasetsDatasetsListPost(
    datasetListReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **datasetListReq** | **DatasetListReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listDatasetsApiV1CozeDatasetsDatasetsListPost_0**
> any listDatasetsApiV1CozeDatasetsDatasetsListPost_0(datasetListReq)


### Example

```typescript
import {
    CozeDatasetsApi,
    Configuration,
    DatasetListReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeDatasetsApi(configuration);

let datasetListReq: DatasetListReq; //

const { status, data } = await apiInstance.listDatasetsApiV1CozeDatasetsDatasetsListPost_0(
    datasetListReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **datasetListReq** | **DatasetListReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost**
> any listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost(docListReq)


### Example

```typescript
import {
    CozeDatasetsApi,
    Configuration,
    DocListReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeDatasetsApi(configuration);

let docListReq: DocListReq; //

const { status, data } = await apiInstance.listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost(
    docListReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **docListReq** | **DocListReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0**
> any listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0(docListReq)


### Example

```typescript
import {
    CozeDatasetsApi,
    Configuration,
    DocListReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeDatasetsApi(configuration);

let docListReq: DocListReq; //

const { status, data } = await apiInstance.listDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0(
    docListReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **docListReq** | **DocListReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listImagesApiV1CozeDatasetsDatasetsImagesListPost**
> any listImagesApiV1CozeDatasetsDatasetsImagesListPost(imageListReq)


### Example

```typescript
import {
    CozeDatasetsApi,
    Configuration,
    ImageListReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeDatasetsApi(configuration);

let imageListReq: ImageListReq; //

const { status, data } = await apiInstance.listImagesApiV1CozeDatasetsDatasetsImagesListPost(
    imageListReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imageListReq** | **ImageListReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listImagesApiV1CozeDatasetsDatasetsImagesListPost_0**
> any listImagesApiV1CozeDatasetsDatasetsImagesListPost_0(imageListReq)


### Example

```typescript
import {
    CozeDatasetsApi,
    Configuration,
    ImageListReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeDatasetsApi(configuration);

let imageListReq: ImageListReq; //

const { status, data } = await apiInstance.listImagesApiV1CozeDatasetsDatasetsImagesListPost_0(
    imageListReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imageListReq** | **ImageListReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost**
> any uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost()


### Example

```typescript
import {
    CozeDatasetsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeDatasetsApi(configuration);

let datasetId: string; // (default to undefined)
let file: File; // (default to undefined)

const { status, data } = await apiInstance.uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost(
    datasetId,
    file
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **datasetId** | [**string**] |  | defaults to undefined|
| **file** | [**File**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0**
> any uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0()


### Example

```typescript
import {
    CozeDatasetsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeDatasetsApi(configuration);

let datasetId: string; // (default to undefined)
let file: File; // (default to undefined)

const { status, data } = await apiInstance.uploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0(
    datasetId,
    file
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **datasetId** | [**string**] |  | defaults to undefined|
| **file** | [**File**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost**
> any uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost()


### Example

```typescript
import {
    CozeDatasetsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeDatasetsApi(configuration);

let datasetId: string; // (default to undefined)
let file: File; // (default to undefined)

const { status, data } = await apiInstance.uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost(
    datasetId,
    file
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **datasetId** | [**string**] |  | defaults to undefined|
| **file** | [**File**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0**
> any uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0()


### Example

```typescript
import {
    CozeDatasetsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeDatasetsApi(configuration);

let datasetId: string; // (default to undefined)
let file: File; // (default to undefined)

const { status, data } = await apiInstance.uploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0(
    datasetId,
    file
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **datasetId** | [**string**] |  | defaults to undefined|
| **file** | [**File**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

