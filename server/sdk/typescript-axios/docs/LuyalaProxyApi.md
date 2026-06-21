# LuyalaProxyApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**luyalaChat**](#luyalachat) | **POST** /api/v1/luyala-proxy/chat | 露雅拉对话|
|[**luyalaChat_0**](#luyalachat_0) | **POST** /api/v1/luyala-proxy/chat | 露雅拉对话|
|[**luyalaCompletion**](#luyalacompletion) | **POST** /api/v1/luyala-proxy/completion | 露雅拉文本补全|
|[**luyalaCompletion_0**](#luyalacompletion_0) | **POST** /api/v1/luyala-proxy/completion | 露雅拉文本补全|
|[**luyalaEmbeddings**](#luyalaembeddings) | **POST** /api/v1/luyala-proxy/embeddings | 露雅拉Embedding|
|[**luyalaEmbeddings_0**](#luyalaembeddings_0) | **POST** /api/v1/luyala-proxy/embeddings | 露雅拉Embedding|
|[**luyalaModels**](#luyalamodels) | **GET** /api/v1/luyala-proxy/models | 可用模型列表|
|[**luyalaModels_0**](#luyalamodels_0) | **GET** /api/v1/luyala-proxy/models | 可用模型列表|

# **luyalaChat**
> any luyalaChat(bodyLuyalaChat)


### Example

```typescript
import {
    LuyalaProxyApi,
    Configuration,
    BodyLuyalaChat
} from './api';

const configuration = new Configuration();
const apiInstance = new LuyalaProxyApi(configuration);

let bodyLuyalaChat: BodyLuyalaChat; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.luyalaChat(
    bodyLuyalaChat,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyLuyalaChat** | **BodyLuyalaChat**|  | |
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

# **luyalaChat_0**
> any luyalaChat_0(bodyLuyalaChat)


### Example

```typescript
import {
    LuyalaProxyApi,
    Configuration,
    BodyLuyalaChat
} from './api';

const configuration = new Configuration();
const apiInstance = new LuyalaProxyApi(configuration);

let bodyLuyalaChat: BodyLuyalaChat; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.luyalaChat_0(
    bodyLuyalaChat,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyLuyalaChat** | **BodyLuyalaChat**|  | |
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

# **luyalaCompletion**
> any luyalaCompletion(bodyLuyalaCompletion)


### Example

```typescript
import {
    LuyalaProxyApi,
    Configuration,
    BodyLuyalaCompletion
} from './api';

const configuration = new Configuration();
const apiInstance = new LuyalaProxyApi(configuration);

let bodyLuyalaCompletion: BodyLuyalaCompletion; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.luyalaCompletion(
    bodyLuyalaCompletion,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyLuyalaCompletion** | **BodyLuyalaCompletion**|  | |
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

# **luyalaCompletion_0**
> any luyalaCompletion_0(bodyLuyalaCompletion)


### Example

```typescript
import {
    LuyalaProxyApi,
    Configuration,
    BodyLuyalaCompletion
} from './api';

const configuration = new Configuration();
const apiInstance = new LuyalaProxyApi(configuration);

let bodyLuyalaCompletion: BodyLuyalaCompletion; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.luyalaCompletion_0(
    bodyLuyalaCompletion,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyLuyalaCompletion** | **BodyLuyalaCompletion**|  | |
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

# **luyalaEmbeddings**
> any luyalaEmbeddings(bodyLuyalaEmbeddings)


### Example

```typescript
import {
    LuyalaProxyApi,
    Configuration,
    BodyLuyalaEmbeddings
} from './api';

const configuration = new Configuration();
const apiInstance = new LuyalaProxyApi(configuration);

let bodyLuyalaEmbeddings: BodyLuyalaEmbeddings; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.luyalaEmbeddings(
    bodyLuyalaEmbeddings,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyLuyalaEmbeddings** | **BodyLuyalaEmbeddings**|  | |
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

# **luyalaEmbeddings_0**
> any luyalaEmbeddings_0(bodyLuyalaEmbeddings)


### Example

```typescript
import {
    LuyalaProxyApi,
    Configuration,
    BodyLuyalaEmbeddings
} from './api';

const configuration = new Configuration();
const apiInstance = new LuyalaProxyApi(configuration);

let bodyLuyalaEmbeddings: BodyLuyalaEmbeddings; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.luyalaEmbeddings_0(
    bodyLuyalaEmbeddings,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyLuyalaEmbeddings** | **BodyLuyalaEmbeddings**|  | |
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

# **luyalaModels**
> any luyalaModels()


### Example

```typescript
import {
    LuyalaProxyApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LuyalaProxyApi(configuration);

const { status, data } = await apiInstance.luyalaModels();
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

# **luyalaModels_0**
> any luyalaModels_0()


### Example

```typescript
import {
    LuyalaProxyApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LuyalaProxyApi(configuration);

const { status, data } = await apiInstance.luyalaModels_0();
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

