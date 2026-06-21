# TongyiImage2ImageApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost**](#backgroundgenerationapiv1tongyiimage2imagebackgroundgenerationpost) | **POST** /api/v1/tongyi-image2image/background-generation | 通义背景生成|
|[**backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0**](#backgroundgenerationapiv1tongyiimage2imagebackgroundgenerationpost_0) | **POST** /api/v1/tongyi-image2image/background-generation | 通义背景生成|
|[**imageToImageApiV1TongyiImage2imageImageToImagePost**](#imagetoimageapiv1tongyiimage2imageimagetoimagepost) | **POST** /api/v1/tongyi-image2image/image-to-image | 通义图生图|
|[**imageToImageApiV1TongyiImage2imageImageToImagePost_0**](#imagetoimageapiv1tongyiimage2imageimagetoimagepost_0) | **POST** /api/v1/tongyi-image2image/image-to-image | 通义图生图|
|[**styleTransferApiV1TongyiImage2imageStyleTransferPost**](#styletransferapiv1tongyiimage2imagestyletransferpost) | **POST** /api/v1/tongyi-image2image/style-transfer | 通义风格迁移|
|[**styleTransferApiV1TongyiImage2imageStyleTransferPost_0**](#styletransferapiv1tongyiimage2imagestyletransferpost_0) | **POST** /api/v1/tongyi-image2image/style-transfer | 通义风格迁移|
|[**tongyiImage2imageListModels**](#tongyiimage2imagelistmodels) | **GET** /api/v1/tongyi-image2image/models | 通义图生图可用模型|
|[**tongyiImage2imageListModels_0**](#tongyiimage2imagelistmodels_0) | **GET** /api/v1/tongyi-image2image/models | 通义图生图可用模型|
|[**virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost**](#virtualtryonapiv1tongyiimage2imagevirtualtryonpost) | **POST** /api/v1/tongyi-image2image/virtual-try-on | 通义虚拟试衣|
|[**virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0**](#virtualtryonapiv1tongyiimage2imagevirtualtryonpost_0) | **POST** /api/v1/tongyi-image2image/virtual-try-on | 通义虚拟试衣|

# **backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost**
> any backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost(bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost)


### Example

```typescript
import {
    TongyiImage2ImageApi,
    Configuration,
    BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost
} from './api';

const configuration = new Configuration();
const apiInstance = new TongyiImage2ImageApi(configuration);

let bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost: BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost(
    bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost** | **BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost**|  | |
| **apiKey** | [**string**] |  | (optional) defaults to undefined|


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

# **backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0**
> any backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0(bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost)


### Example

```typescript
import {
    TongyiImage2ImageApi,
    Configuration,
    BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost
} from './api';

const configuration = new Configuration();
const apiInstance = new TongyiImage2ImageApi(configuration);

let bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost: BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.backgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost_0(
    bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost** | **BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost**|  | |
| **apiKey** | [**string**] |  | (optional) defaults to undefined|


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

# **imageToImageApiV1TongyiImage2imageImageToImagePost**
> any imageToImageApiV1TongyiImage2imageImageToImagePost(bodyImageToImageApiV1TongyiImage2imageImageToImagePost)


### Example

```typescript
import {
    TongyiImage2ImageApi,
    Configuration,
    BodyImageToImageApiV1TongyiImage2imageImageToImagePost
} from './api';

const configuration = new Configuration();
const apiInstance = new TongyiImage2ImageApi(configuration);

let bodyImageToImageApiV1TongyiImage2imageImageToImagePost: BodyImageToImageApiV1TongyiImage2imageImageToImagePost; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.imageToImageApiV1TongyiImage2imageImageToImagePost(
    bodyImageToImageApiV1TongyiImage2imageImageToImagePost,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyImageToImageApiV1TongyiImage2imageImageToImagePost** | **BodyImageToImageApiV1TongyiImage2imageImageToImagePost**|  | |
| **apiKey** | [**string**] |  | (optional) defaults to undefined|


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

# **imageToImageApiV1TongyiImage2imageImageToImagePost_0**
> any imageToImageApiV1TongyiImage2imageImageToImagePost_0(bodyImageToImageApiV1TongyiImage2imageImageToImagePost)


### Example

```typescript
import {
    TongyiImage2ImageApi,
    Configuration,
    BodyImageToImageApiV1TongyiImage2imageImageToImagePost
} from './api';

const configuration = new Configuration();
const apiInstance = new TongyiImage2ImageApi(configuration);

let bodyImageToImageApiV1TongyiImage2imageImageToImagePost: BodyImageToImageApiV1TongyiImage2imageImageToImagePost; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.imageToImageApiV1TongyiImage2imageImageToImagePost_0(
    bodyImageToImageApiV1TongyiImage2imageImageToImagePost,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyImageToImageApiV1TongyiImage2imageImageToImagePost** | **BodyImageToImageApiV1TongyiImage2imageImageToImagePost**|  | |
| **apiKey** | [**string**] |  | (optional) defaults to undefined|


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

# **styleTransferApiV1TongyiImage2imageStyleTransferPost**
> any styleTransferApiV1TongyiImage2imageStyleTransferPost(bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost)


### Example

```typescript
import {
    TongyiImage2ImageApi,
    Configuration,
    BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost
} from './api';

const configuration = new Configuration();
const apiInstance = new TongyiImage2ImageApi(configuration);

let bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost: BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.styleTransferApiV1TongyiImage2imageStyleTransferPost(
    bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost** | **BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost**|  | |
| **apiKey** | [**string**] |  | (optional) defaults to undefined|


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

# **styleTransferApiV1TongyiImage2imageStyleTransferPost_0**
> any styleTransferApiV1TongyiImage2imageStyleTransferPost_0(bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost)


### Example

```typescript
import {
    TongyiImage2ImageApi,
    Configuration,
    BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost
} from './api';

const configuration = new Configuration();
const apiInstance = new TongyiImage2ImageApi(configuration);

let bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost: BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.styleTransferApiV1TongyiImage2imageStyleTransferPost_0(
    bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyStyleTransferApiV1TongyiImage2imageStyleTransferPost** | **BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost**|  | |
| **apiKey** | [**string**] |  | (optional) defaults to undefined|


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

# **tongyiImage2imageListModels**
> any tongyiImage2imageListModels()


### Example

```typescript
import {
    TongyiImage2ImageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TongyiImage2ImageApi(configuration);

const { status, data } = await apiInstance.tongyiImage2imageListModels();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **tongyiImage2imageListModels_0**
> any tongyiImage2imageListModels_0()


### Example

```typescript
import {
    TongyiImage2ImageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TongyiImage2ImageApi(configuration);

const { status, data } = await apiInstance.tongyiImage2imageListModels_0();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost**
> any virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost(bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost)


### Example

```typescript
import {
    TongyiImage2ImageApi,
    Configuration,
    BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost
} from './api';

const configuration = new Configuration();
const apiInstance = new TongyiImage2ImageApi(configuration);

let bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost: BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost(
    bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost** | **BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost**|  | |
| **apiKey** | [**string**] |  | (optional) defaults to undefined|


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

# **virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0**
> any virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0(bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost)


### Example

```typescript
import {
    TongyiImage2ImageApi,
    Configuration,
    BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost
} from './api';

const configuration = new Configuration();
const apiInstance = new TongyiImage2ImageApi(configuration);

let bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost: BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.virtualTryOnApiV1TongyiImage2imageVirtualTryOnPost_0(
    bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost** | **BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost**|  | |
| **apiKey** | [**string**] |  | (optional) defaults to undefined|


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

