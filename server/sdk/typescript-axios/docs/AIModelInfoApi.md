# AIModelInfoApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**compatCreateModelApiV1AiCompatCreatePost**](#compatcreatemodelapiv1aicompatcreatepost) | **POST** /api/v1/ai/compat/create | [兼容] 新增模型 (前端 aiModelInfo.add)|
|[**compatDeleteModelApiV1AiCompatDeleteGet**](#compatdeletemodelapiv1aicompatdeleteget) | **GET** /api/v1/ai/compat/delete | [兼容] 删除模型 (前端 aiModelInfo.delete)|
|[**compatUpdateModelApiV1AiCompatUpdatePost**](#compatupdatemodelapiv1aicompatupdatepost) | **POST** /api/v1/ai/compat/update | [兼容] 更新模型 (前端 aiModelInfo.update)|
|[**createModelApiV1AiCreatePost**](#createmodelapiv1aicreatepost) | **POST** /api/v1/ai/create | 新增模型|
|[**deleteModelApiV1AiModelIdDelete**](#deletemodelapiv1aimodeliddelete) | **DELETE** /api/v1/ai/{model_id} | 删除AI模型|
|[**updateModelApiV1AiUpdatePost**](#updatemodelapiv1aiupdatepost) | **POST** /api/v1/ai/update | 更新模型|
|[**vendorStatsApiV1AiVendorsGet**](#vendorstatsapiv1aivendorsget) | **GET** /api/v1/ai/vendors | 支持的厂商统计|

# **compatCreateModelApiV1AiCompatCreatePost**
> any compatCreateModelApiV1AiCompatCreatePost()


### Example

```typescript
import {
    AIModelInfoApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIModelInfoApi(configuration);

let name: string; // (default to undefined)
let source: string; // (optional) (default to '')
let img: string; // (optional) (default to '')
let remark: string; // (optional) (default to '')
let type: number; // (optional) (default to undefined)
let creator: string; // (optional) (default to '')

const { status, data } = await apiInstance.compatCreateModelApiV1AiCompatCreatePost(
    name,
    source,
    img,
    remark,
    type,
    creator
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | defaults to undefined|
| **source** | [**string**] |  | (optional) defaults to ''|
| **img** | [**string**] |  | (optional) defaults to ''|
| **remark** | [**string**] |  | (optional) defaults to ''|
| **type** | [**number**] |  | (optional) defaults to undefined|
| **creator** | [**string**] |  | (optional) defaults to ''|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **compatDeleteModelApiV1AiCompatDeleteGet**
> any compatDeleteModelApiV1AiCompatDeleteGet()

逻辑删除：将 status 置为 0。前端用 GET + query params，此处兼容。

### Example

```typescript
import {
    AIModelInfoApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIModelInfoApi(configuration);

let id: string; // (default to undefined)
let updator: string; // (optional) (default to '')

const { status, data } = await apiInstance.compatDeleteModelApiV1AiCompatDeleteGet(
    id,
    updator
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] |  | defaults to undefined|
| **updator** | [**string**] |  | (optional) defaults to ''|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **compatUpdateModelApiV1AiCompatUpdatePost**
> any compatUpdateModelApiV1AiCompatUpdatePost()


### Example

```typescript
import {
    AIModelInfoApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIModelInfoApi(configuration);

let id: string; // (default to undefined)
let name: string; // (optional) (default to undefined)
let source: string; // (optional) (default to undefined)
let img: string; // (optional) (default to undefined)
let remark: string; // (optional) (default to undefined)
let type: number; // (optional) (default to undefined)
let isDel: number; // (optional) (default to undefined)
let updator: string; // (optional) (default to '')

const { status, data } = await apiInstance.compatUpdateModelApiV1AiCompatUpdatePost(
    id,
    name,
    source,
    img,
    remark,
    type,
    isDel,
    updator
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] |  | defaults to undefined|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **source** | [**string**] |  | (optional) defaults to undefined|
| **img** | [**string**] |  | (optional) defaults to undefined|
| **remark** | [**string**] |  | (optional) defaults to undefined|
| **type** | [**number**] |  | (optional) defaults to undefined|
| **isDel** | [**number**] |  | (optional) defaults to undefined|
| **updator** | [**string**] |  | (optional) defaults to ''|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createModelApiV1AiCreatePost**
> any createModelApiV1AiCreatePost()


### Example

```typescript
import {
    AIModelInfoApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIModelInfoApi(configuration);

let vendor: string; // (default to undefined)
let modelName: string; // (default to undefined)
let description: string; // (optional) (default to '')
let icon: string; // (optional) (default to '')

const { status, data } = await apiInstance.createModelApiV1AiCreatePost(
    vendor,
    modelName,
    description,
    icon
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **vendor** | [**string**] |  | defaults to undefined|
| **modelName** | [**string**] |  | defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to ''|
| **icon** | [**string**] |  | (optional) defaults to ''|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteModelApiV1AiModelIdDelete**
> any deleteModelApiV1AiModelIdDelete()

逻辑删除：将 status 置为 0。

### Example

```typescript
import {
    AIModelInfoApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIModelInfoApi(configuration);

let modelId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteModelApiV1AiModelIdDelete(
    modelId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **modelId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateModelApiV1AiUpdatePost**
> any updateModelApiV1AiUpdatePost()


### Example

```typescript
import {
    AIModelInfoApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIModelInfoApi(configuration);

let modelId: number; // (default to undefined)
let displayName: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateModelApiV1AiUpdatePost(
    modelId,
    displayName,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **modelId** | [**number**] |  | defaults to undefined|
| **displayName** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **vendorStatsApiV1AiVendorsGet**
> any vendorStatsApiV1AiVendorsGet()


### Example

```typescript
import {
    AIModelInfoApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIModelInfoApi(configuration);

const { status, data } = await apiInstance.vendorStatsApiV1AiVendorsGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

