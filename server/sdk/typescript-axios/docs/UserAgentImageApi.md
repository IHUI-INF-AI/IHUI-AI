# UserAgentImageApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createImageApiV1UserAgentImagePost**](#createimageapiv1useragentimagepost) | **POST** /api/v1/user-agent-image | 记录图片交互|
|[**createImageApiV1UserAgentImagePost_0**](#createimageapiv1useragentimagepost_0) | **POST** /api/v1/user-agent-image | 记录图片交互|
|[**deleteImageApiV1UserAgentImageIidDelete**](#deleteimageapiv1useragentimageiiddelete) | **DELETE** /api/v1/user-agent-image/{iid} | 删除图片记录|
|[**deleteImageApiV1UserAgentImageIidDelete_0**](#deleteimageapiv1useragentimageiiddelete_0) | **DELETE** /api/v1/user-agent-image/{iid} | 删除图片记录|
|[**getImageApiV1UserAgentImageIidGet**](#getimageapiv1useragentimageiidget) | **GET** /api/v1/user-agent-image/{iid} | 图片详情|
|[**getImageApiV1UserAgentImageIidGet_0**](#getimageapiv1useragentimageiidget_0) | **GET** /api/v1/user-agent-image/{iid} | 图片详情|
|[**listImagesApiV1UserAgentImageListGet**](#listimagesapiv1useragentimagelistget) | **GET** /api/v1/user-agent-image/list | 我的图片交互|
|[**listImagesApiV1UserAgentImageListGet_0**](#listimagesapiv1useragentimagelistget_0) | **GET** /api/v1/user-agent-image/list | 我的图片交互|

# **createImageApiV1UserAgentImagePost**
> any createImageApiV1UserAgentImagePost()


### Example

```typescript
import {
    UserAgentImageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserAgentImageApi(configuration);

let imageUrl: string; // (default to undefined)
let imageType: string; // (optional) (default to 'input')
let agentId: string; // (optional) (default to undefined)
let agentName: string; // (optional) (default to undefined)
let prompt: string; // (optional) (default to undefined)
let model: string; // (optional) (default to undefined)
let taskId: string; // (optional) (default to undefined)
let status: number; // (optional) (default to 1)
let cost: number; // (optional) (default to 0)
let width: number; // (optional) (default to 0)
let height: number; // (optional) (default to 0)
let size: number; // (optional) (default to 0)

const { status, data } = await apiInstance.createImageApiV1UserAgentImagePost(
    imageUrl,
    imageType,
    agentId,
    agentName,
    prompt,
    model,
    taskId,
    status,
    cost,
    width,
    height,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imageUrl** | [**string**] |  | defaults to undefined|
| **imageType** | [**string**] |  | (optional) defaults to 'input'|
| **agentId** | [**string**] |  | (optional) defaults to undefined|
| **agentName** | [**string**] |  | (optional) defaults to undefined|
| **prompt** | [**string**] |  | (optional) defaults to undefined|
| **model** | [**string**] |  | (optional) defaults to undefined|
| **taskId** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to 1|
| **cost** | [**number**] |  | (optional) defaults to 0|
| **width** | [**number**] |  | (optional) defaults to 0|
| **height** | [**number**] |  | (optional) defaults to 0|
| **size** | [**number**] |  | (optional) defaults to 0|


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
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createImageApiV1UserAgentImagePost_0**
> any createImageApiV1UserAgentImagePost_0()


### Example

```typescript
import {
    UserAgentImageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserAgentImageApi(configuration);

let imageUrl: string; // (default to undefined)
let imageType: string; // (optional) (default to 'input')
let agentId: string; // (optional) (default to undefined)
let agentName: string; // (optional) (default to undefined)
let prompt: string; // (optional) (default to undefined)
let model: string; // (optional) (default to undefined)
let taskId: string; // (optional) (default to undefined)
let status: number; // (optional) (default to 1)
let cost: number; // (optional) (default to 0)
let width: number; // (optional) (default to 0)
let height: number; // (optional) (default to 0)
let size: number; // (optional) (default to 0)

const { status, data } = await apiInstance.createImageApiV1UserAgentImagePost_0(
    imageUrl,
    imageType,
    agentId,
    agentName,
    prompt,
    model,
    taskId,
    status,
    cost,
    width,
    height,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imageUrl** | [**string**] |  | defaults to undefined|
| **imageType** | [**string**] |  | (optional) defaults to 'input'|
| **agentId** | [**string**] |  | (optional) defaults to undefined|
| **agentName** | [**string**] |  | (optional) defaults to undefined|
| **prompt** | [**string**] |  | (optional) defaults to undefined|
| **model** | [**string**] |  | (optional) defaults to undefined|
| **taskId** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to 1|
| **cost** | [**number**] |  | (optional) defaults to 0|
| **width** | [**number**] |  | (optional) defaults to 0|
| **height** | [**number**] |  | (optional) defaults to 0|
| **size** | [**number**] |  | (optional) defaults to 0|


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
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteImageApiV1UserAgentImageIidDelete**
> any deleteImageApiV1UserAgentImageIidDelete()


### Example

```typescript
import {
    UserAgentImageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserAgentImageApi(configuration);

let iid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteImageApiV1UserAgentImageIidDelete(
    iid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **iid** | [**number**] |  | defaults to undefined|


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
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteImageApiV1UserAgentImageIidDelete_0**
> any deleteImageApiV1UserAgentImageIidDelete_0()


### Example

```typescript
import {
    UserAgentImageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserAgentImageApi(configuration);

let iid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteImageApiV1UserAgentImageIidDelete_0(
    iid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **iid** | [**number**] |  | defaults to undefined|


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
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getImageApiV1UserAgentImageIidGet**
> any getImageApiV1UserAgentImageIidGet()


### Example

```typescript
import {
    UserAgentImageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserAgentImageApi(configuration);

let iid: number; // (default to undefined)

const { status, data } = await apiInstance.getImageApiV1UserAgentImageIidGet(
    iid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **iid** | [**number**] |  | defaults to undefined|


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
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getImageApiV1UserAgentImageIidGet_0**
> any getImageApiV1UserAgentImageIidGet_0()


### Example

```typescript
import {
    UserAgentImageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserAgentImageApi(configuration);

let iid: number; // (default to undefined)

const { status, data } = await apiInstance.getImageApiV1UserAgentImageIidGet_0(
    iid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **iid** | [**number**] |  | defaults to undefined|


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
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listImagesApiV1UserAgentImageListGet**
> any listImagesApiV1UserAgentImageListGet()


### Example

```typescript
import {
    UserAgentImageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserAgentImageApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let imageType: string; // (optional) (default to undefined)
let agentId: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listImagesApiV1UserAgentImageListGet(
    page,
    limit,
    imageType,
    agentId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **imageType** | [**string**] |  | (optional) defaults to undefined|
| **agentId** | [**string**] |  | (optional) defaults to undefined|


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
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listImagesApiV1UserAgentImageListGet_0**
> any listImagesApiV1UserAgentImageListGet_0()


### Example

```typescript
import {
    UserAgentImageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserAgentImageApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let imageType: string; // (optional) (default to undefined)
let agentId: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listImagesApiV1UserAgentImageListGet_0(
    page,
    limit,
    imageType,
    agentId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **imageType** | [**string**] |  | (optional) defaults to undefined|
| **agentId** | [**string**] |  | (optional) defaults to undefined|


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
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

