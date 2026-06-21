# WSTimbreApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createTimbreApiV1WsTimbreCreatePost**](#createtimbreapiv1wstimbrecreatepost) | **POST** /api/v1/ws/timbre/create | 新增音色|
|[**createTimbreTimbreCreatePost**](#createtimbretimbrecreatepost) | **POST** /timbre/create | 新增音色|
|[**deleteTimbreApiV1WsTimbreDeletePost**](#deletetimbreapiv1wstimbredeletepost) | **POST** /api/v1/ws/timbre/delete | 删除音色|
|[**deleteTimbreTimbreDeletePost**](#deletetimbretimbredeletepost) | **POST** /timbre/delete | 删除音色|
|[**listTimbresApiV1WsTimbreListGet**](#listtimbresapiv1wstimbrelistget) | **GET** /api/v1/ws/timbre/list | 音色列表|
|[**listTimbresTimbreListGet**](#listtimbrestimbrelistget) | **GET** /timbre/list | 音色列表|
|[**updateTimbreApiV1WsTimbreUpdatePost**](#updatetimbreapiv1wstimbreupdatepost) | **POST** /api/v1/ws/timbre/update | 更新音色|
|[**updateTimbreTimbreUpdatePost**](#updatetimbretimbreupdatepost) | **POST** /timbre/update | 更新音色|

# **createTimbreApiV1WsTimbreCreatePost**
> any createTimbreApiV1WsTimbreCreatePost()


### Example

```typescript
import {
    WSTimbreApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSTimbreApi(configuration);

let name: string; // (default to undefined)
let voiceId: string; // (default to undefined)
let language: string; // (optional) (default to 'zh')
let gender: string; // (optional) (default to 'female')
let ageRange: string; // (optional) (default to '')
let style: string; // (optional) (default to '')
let sampleUrl: string; // (optional) (default to '')

const { status, data } = await apiInstance.createTimbreApiV1WsTimbreCreatePost(
    name,
    voiceId,
    language,
    gender,
    ageRange,
    style,
    sampleUrl
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | defaults to undefined|
| **voiceId** | [**string**] |  | defaults to undefined|
| **language** | [**string**] |  | (optional) defaults to 'zh'|
| **gender** | [**string**] |  | (optional) defaults to 'female'|
| **ageRange** | [**string**] |  | (optional) defaults to ''|
| **style** | [**string**] |  | (optional) defaults to ''|
| **sampleUrl** | [**string**] |  | (optional) defaults to ''|


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

# **createTimbreTimbreCreatePost**
> any createTimbreTimbreCreatePost()


### Example

```typescript
import {
    WSTimbreApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSTimbreApi(configuration);

let name: string; // (default to undefined)
let voiceId: string; // (default to undefined)
let language: string; // (optional) (default to 'zh')
let gender: string; // (optional) (default to 'female')
let ageRange: string; // (optional) (default to '')
let style: string; // (optional) (default to '')
let sampleUrl: string; // (optional) (default to '')

const { status, data } = await apiInstance.createTimbreTimbreCreatePost(
    name,
    voiceId,
    language,
    gender,
    ageRange,
    style,
    sampleUrl
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | defaults to undefined|
| **voiceId** | [**string**] |  | defaults to undefined|
| **language** | [**string**] |  | (optional) defaults to 'zh'|
| **gender** | [**string**] |  | (optional) defaults to 'female'|
| **ageRange** | [**string**] |  | (optional) defaults to ''|
| **style** | [**string**] |  | (optional) defaults to ''|
| **sampleUrl** | [**string**] |  | (optional) defaults to ''|


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

# **deleteTimbreApiV1WsTimbreDeletePost**
> any deleteTimbreApiV1WsTimbreDeletePost()


### Example

```typescript
import {
    WSTimbreApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSTimbreApi(configuration);

let timbreId: string; // (default to undefined)

const { status, data } = await apiInstance.deleteTimbreApiV1WsTimbreDeletePost(
    timbreId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **timbreId** | [**string**] |  | defaults to undefined|


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

# **deleteTimbreTimbreDeletePost**
> any deleteTimbreTimbreDeletePost()


### Example

```typescript
import {
    WSTimbreApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSTimbreApi(configuration);

let timbreId: string; // (default to undefined)

const { status, data } = await apiInstance.deleteTimbreTimbreDeletePost(
    timbreId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **timbreId** | [**string**] |  | defaults to undefined|


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

# **listTimbresApiV1WsTimbreListGet**
> any listTimbresApiV1WsTimbreListGet()


### Example

```typescript
import {
    WSTimbreApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSTimbreApi(configuration);

let language: string; // (optional) (default to undefined)
let gender: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listTimbresApiV1WsTimbreListGet(
    language,
    gender,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **language** | [**string**] |  | (optional) defaults to undefined|
| **gender** | [**string**] |  | (optional) defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

# **listTimbresTimbreListGet**
> any listTimbresTimbreListGet()


### Example

```typescript
import {
    WSTimbreApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSTimbreApi(configuration);

let language: string; // (optional) (default to undefined)
let gender: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listTimbresTimbreListGet(
    language,
    gender,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **language** | [**string**] |  | (optional) defaults to undefined|
| **gender** | [**string**] |  | (optional) defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

# **updateTimbreApiV1WsTimbreUpdatePost**
> any updateTimbreApiV1WsTimbreUpdatePost()


### Example

```typescript
import {
    WSTimbreApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSTimbreApi(configuration);

let timbreId: string; // (default to undefined)
let name: string; // (optional) (default to undefined)
let sampleUrl: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateTimbreApiV1WsTimbreUpdatePost(
    timbreId,
    name,
    sampleUrl,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **timbreId** | [**string**] |  | defaults to undefined|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **sampleUrl** | [**string**] |  | (optional) defaults to undefined|
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

# **updateTimbreTimbreUpdatePost**
> any updateTimbreTimbreUpdatePost()


### Example

```typescript
import {
    WSTimbreApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WSTimbreApi(configuration);

let timbreId: string; // (default to undefined)
let name: string; // (optional) (default to undefined)
let sampleUrl: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateTimbreTimbreUpdatePost(
    timbreId,
    name,
    sampleUrl,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **timbreId** | [**string**] |  | defaults to undefined|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **sampleUrl** | [**string**] |  | (optional) defaults to undefined|
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

