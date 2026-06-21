# DoubaoImageEditApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**doubaoImageEdit**](#doubaoimageedit) | **POST** /api/v1/doubao-image-edit/image-edit | 豆包图片编辑|
|[**doubaoImageEditListModels**](#doubaoimageeditlistmodels) | **GET** /api/v1/doubao-image-edit/models | 豆包可用模型|
|[**doubaoImageEditListModels_0**](#doubaoimageeditlistmodels_0) | **GET** /api/v1/doubao-image-edit/models | 豆包可用模型|
|[**doubaoImageEdit_0**](#doubaoimageedit_0) | **POST** /api/v1/doubao-image-edit/image-edit | 豆包图片编辑|
|[**imageGenerateApiV1DoubaoImageEditImageGeneratePost**](#imagegenerateapiv1doubaoimageeditimagegeneratepost) | **POST** /api/v1/doubao-image-edit/image-generate | 豆包文生图|
|[**imageGenerateApiV1DoubaoImageEditImageGeneratePost_0**](#imagegenerateapiv1doubaoimageeditimagegeneratepost_0) | **POST** /api/v1/doubao-image-edit/image-generate | 豆包文生图|

# **doubaoImageEdit**
> any doubaoImageEdit(bodyDoubaoImageEdit)


### Example

```typescript
import {
    DoubaoImageEditApi,
    Configuration,
    BodyDoubaoImageEdit
} from './api';

const configuration = new Configuration();
const apiInstance = new DoubaoImageEditApi(configuration);

let bodyDoubaoImageEdit: BodyDoubaoImageEdit; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.doubaoImageEdit(
    bodyDoubaoImageEdit,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyDoubaoImageEdit** | **BodyDoubaoImageEdit**|  | |
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

# **doubaoImageEditListModels**
> any doubaoImageEditListModels()


### Example

```typescript
import {
    DoubaoImageEditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DoubaoImageEditApi(configuration);

const { status, data } = await apiInstance.doubaoImageEditListModels();
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

# **doubaoImageEditListModels_0**
> any doubaoImageEditListModels_0()


### Example

```typescript
import {
    DoubaoImageEditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DoubaoImageEditApi(configuration);

const { status, data } = await apiInstance.doubaoImageEditListModels_0();
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

# **doubaoImageEdit_0**
> any doubaoImageEdit_0(bodyDoubaoImageEdit)


### Example

```typescript
import {
    DoubaoImageEditApi,
    Configuration,
    BodyDoubaoImageEdit
} from './api';

const configuration = new Configuration();
const apiInstance = new DoubaoImageEditApi(configuration);

let bodyDoubaoImageEdit: BodyDoubaoImageEdit; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.doubaoImageEdit_0(
    bodyDoubaoImageEdit,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyDoubaoImageEdit** | **BodyDoubaoImageEdit**|  | |
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

# **imageGenerateApiV1DoubaoImageEditImageGeneratePost**
> any imageGenerateApiV1DoubaoImageEditImageGeneratePost(bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost)


### Example

```typescript
import {
    DoubaoImageEditApi,
    Configuration,
    BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost
} from './api';

const configuration = new Configuration();
const apiInstance = new DoubaoImageEditApi(configuration);

let bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost: BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.imageGenerateApiV1DoubaoImageEditImageGeneratePost(
    bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost** | **BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost**|  | |
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

# **imageGenerateApiV1DoubaoImageEditImageGeneratePost_0**
> any imageGenerateApiV1DoubaoImageEditImageGeneratePost_0(bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost)


### Example

```typescript
import {
    DoubaoImageEditApi,
    Configuration,
    BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost
} from './api';

const configuration = new Configuration();
const apiInstance = new DoubaoImageEditApi(configuration);

let bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost: BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.imageGenerateApiV1DoubaoImageEditImageGeneratePost_0(
    bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyImageGenerateApiV1DoubaoImageEditImageGeneratePost** | **BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost**|  | |
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

