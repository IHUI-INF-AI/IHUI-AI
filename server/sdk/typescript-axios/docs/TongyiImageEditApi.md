# TongyiImageEditApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**textToImageApiV1TongyiImageEditTextToImagePost**](#texttoimageapiv1tongyiimageedittexttoimagepost) | **POST** /api/v1/tongyi-image-edit/text-to-image | 通义文生图|
|[**textToImageApiV1TongyiImageEditTextToImagePost_0**](#texttoimageapiv1tongyiimageedittexttoimagepost_0) | **POST** /api/v1/tongyi-image-edit/text-to-image | 通义文生图|
|[**tongyiImageEdit**](#tongyiimageedit) | **POST** /api/v1/tongyi-image-edit/image-edit | 通义图像编辑|
|[**tongyiImageEditListModels**](#tongyiimageeditlistmodels) | **GET** /api/v1/tongyi-image-edit/models | 通义可用模型|
|[**tongyiImageEditListModels_0**](#tongyiimageeditlistmodels_0) | **GET** /api/v1/tongyi-image-edit/models | 通义可用模型|
|[**tongyiImageEdit_0**](#tongyiimageedit_0) | **POST** /api/v1/tongyi-image-edit/image-edit | 通义图像编辑|

# **textToImageApiV1TongyiImageEditTextToImagePost**
> any textToImageApiV1TongyiImageEditTextToImagePost(bodyTextToImageApiV1TongyiImageEditTextToImagePost)


### Example

```typescript
import {
    TongyiImageEditApi,
    Configuration,
    BodyTextToImageApiV1TongyiImageEditTextToImagePost
} from './api';

const configuration = new Configuration();
const apiInstance = new TongyiImageEditApi(configuration);

let bodyTextToImageApiV1TongyiImageEditTextToImagePost: BodyTextToImageApiV1TongyiImageEditTextToImagePost; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.textToImageApiV1TongyiImageEditTextToImagePost(
    bodyTextToImageApiV1TongyiImageEditTextToImagePost,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyTextToImageApiV1TongyiImageEditTextToImagePost** | **BodyTextToImageApiV1TongyiImageEditTextToImagePost**|  | |
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

# **textToImageApiV1TongyiImageEditTextToImagePost_0**
> any textToImageApiV1TongyiImageEditTextToImagePost_0(bodyTextToImageApiV1TongyiImageEditTextToImagePost)


### Example

```typescript
import {
    TongyiImageEditApi,
    Configuration,
    BodyTextToImageApiV1TongyiImageEditTextToImagePost
} from './api';

const configuration = new Configuration();
const apiInstance = new TongyiImageEditApi(configuration);

let bodyTextToImageApiV1TongyiImageEditTextToImagePost: BodyTextToImageApiV1TongyiImageEditTextToImagePost; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.textToImageApiV1TongyiImageEditTextToImagePost_0(
    bodyTextToImageApiV1TongyiImageEditTextToImagePost,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyTextToImageApiV1TongyiImageEditTextToImagePost** | **BodyTextToImageApiV1TongyiImageEditTextToImagePost**|  | |
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

# **tongyiImageEdit**
> any tongyiImageEdit(bodyTongyiImageEdit)


### Example

```typescript
import {
    TongyiImageEditApi,
    Configuration,
    BodyTongyiImageEdit
} from './api';

const configuration = new Configuration();
const apiInstance = new TongyiImageEditApi(configuration);

let bodyTongyiImageEdit: BodyTongyiImageEdit; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.tongyiImageEdit(
    bodyTongyiImageEdit,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyTongyiImageEdit** | **BodyTongyiImageEdit**|  | |
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

# **tongyiImageEditListModels**
> any tongyiImageEditListModels()


### Example

```typescript
import {
    TongyiImageEditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TongyiImageEditApi(configuration);

const { status, data } = await apiInstance.tongyiImageEditListModels();
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

# **tongyiImageEditListModels_0**
> any tongyiImageEditListModels_0()


### Example

```typescript
import {
    TongyiImageEditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TongyiImageEditApi(configuration);

const { status, data } = await apiInstance.tongyiImageEditListModels_0();
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

# **tongyiImageEdit_0**
> any tongyiImageEdit_0(bodyTongyiImageEdit)


### Example

```typescript
import {
    TongyiImageEditApi,
    Configuration,
    BodyTongyiImageEdit
} from './api';

const configuration = new Configuration();
const apiInstance = new TongyiImageEditApi(configuration);

let bodyTongyiImageEdit: BodyTongyiImageEdit; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.tongyiImageEdit_0(
    bodyTongyiImageEdit,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyTongyiImageEdit** | **BodyTongyiImageEdit**|  | |
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

