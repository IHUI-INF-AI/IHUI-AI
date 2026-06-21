# OpenRouterProxyApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**creditsApiV1OpenrouterProxyCreditsGet**](#creditsapiv1openrouterproxycreditsget) | **GET** /api/v1/openrouter-proxy/credits | 账户额度|
|[**creditsApiV1OpenrouterProxyCreditsGet_0**](#creditsapiv1openrouterproxycreditsget_0) | **GET** /api/v1/openrouter-proxy/credits | 账户额度|
|[**openrouterChat**](#openrouterchat) | **POST** /api/v1/openrouter-proxy/chat | OpenRouter对话|
|[**openrouterChat_0**](#openrouterchat_0) | **POST** /api/v1/openrouter-proxy/chat | OpenRouter对话|
|[**openrouterCompletion**](#openroutercompletion) | **POST** /api/v1/openrouter-proxy/completion | OpenRouter文本补全|
|[**openrouterCompletion_0**](#openroutercompletion_0) | **POST** /api/v1/openrouter-proxy/completion | OpenRouter文本补全|
|[**openrouterEmbeddings**](#openrouterembeddings) | **POST** /api/v1/openrouter-proxy/embeddings | OpenRouter Embeddings|
|[**openrouterEmbeddings_0**](#openrouterembeddings_0) | **POST** /api/v1/openrouter-proxy/embeddings | OpenRouter Embeddings|
|[**openrouterModels**](#openroutermodels) | **GET** /api/v1/openrouter-proxy/models | 可用模型列表|
|[**openrouterModels_0**](#openroutermodels_0) | **GET** /api/v1/openrouter-proxy/models | 可用模型列表|

# **creditsApiV1OpenrouterProxyCreditsGet**
> any creditsApiV1OpenrouterProxyCreditsGet()


### Example

```typescript
import {
    OpenRouterProxyApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OpenRouterProxyApi(configuration);

let apiKey: string; // (optional) (default to '')

const { status, data } = await apiInstance.creditsApiV1OpenrouterProxyCreditsGet(
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **apiKey** | [**string**] |  | (optional) defaults to ''|


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

# **creditsApiV1OpenrouterProxyCreditsGet_0**
> any creditsApiV1OpenrouterProxyCreditsGet_0()


### Example

```typescript
import {
    OpenRouterProxyApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OpenRouterProxyApi(configuration);

let apiKey: string; // (optional) (default to '')

const { status, data } = await apiInstance.creditsApiV1OpenrouterProxyCreditsGet_0(
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **apiKey** | [**string**] |  | (optional) defaults to ''|


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

# **openrouterChat**
> any openrouterChat(bodyOpenrouterChat)


### Example

```typescript
import {
    OpenRouterProxyApi,
    Configuration,
    BodyOpenrouterChat
} from './api';

const configuration = new Configuration();
const apiInstance = new OpenRouterProxyApi(configuration);

let bodyOpenrouterChat: BodyOpenrouterChat; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.openrouterChat(
    bodyOpenrouterChat,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyOpenrouterChat** | **BodyOpenrouterChat**|  | |
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

# **openrouterChat_0**
> any openrouterChat_0(bodyOpenrouterChat)


### Example

```typescript
import {
    OpenRouterProxyApi,
    Configuration,
    BodyOpenrouterChat
} from './api';

const configuration = new Configuration();
const apiInstance = new OpenRouterProxyApi(configuration);

let bodyOpenrouterChat: BodyOpenrouterChat; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.openrouterChat_0(
    bodyOpenrouterChat,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyOpenrouterChat** | **BodyOpenrouterChat**|  | |
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

# **openrouterCompletion**
> any openrouterCompletion(bodyOpenrouterCompletion)


### Example

```typescript
import {
    OpenRouterProxyApi,
    Configuration,
    BodyOpenrouterCompletion
} from './api';

const configuration = new Configuration();
const apiInstance = new OpenRouterProxyApi(configuration);

let bodyOpenrouterCompletion: BodyOpenrouterCompletion; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.openrouterCompletion(
    bodyOpenrouterCompletion,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyOpenrouterCompletion** | **BodyOpenrouterCompletion**|  | |
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

# **openrouterCompletion_0**
> any openrouterCompletion_0(bodyOpenrouterCompletion)


### Example

```typescript
import {
    OpenRouterProxyApi,
    Configuration,
    BodyOpenrouterCompletion
} from './api';

const configuration = new Configuration();
const apiInstance = new OpenRouterProxyApi(configuration);

let bodyOpenrouterCompletion: BodyOpenrouterCompletion; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.openrouterCompletion_0(
    bodyOpenrouterCompletion,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyOpenrouterCompletion** | **BodyOpenrouterCompletion**|  | |
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

# **openrouterEmbeddings**
> any openrouterEmbeddings(bodyOpenrouterEmbeddings)


### Example

```typescript
import {
    OpenRouterProxyApi,
    Configuration,
    BodyOpenrouterEmbeddings
} from './api';

const configuration = new Configuration();
const apiInstance = new OpenRouterProxyApi(configuration);

let bodyOpenrouterEmbeddings: BodyOpenrouterEmbeddings; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.openrouterEmbeddings(
    bodyOpenrouterEmbeddings,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyOpenrouterEmbeddings** | **BodyOpenrouterEmbeddings**|  | |
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

# **openrouterEmbeddings_0**
> any openrouterEmbeddings_0(bodyOpenrouterEmbeddings)


### Example

```typescript
import {
    OpenRouterProxyApi,
    Configuration,
    BodyOpenrouterEmbeddings
} from './api';

const configuration = new Configuration();
const apiInstance = new OpenRouterProxyApi(configuration);

let bodyOpenrouterEmbeddings: BodyOpenrouterEmbeddings; //
let apiKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.openrouterEmbeddings_0(
    bodyOpenrouterEmbeddings,
    apiKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyOpenrouterEmbeddings** | **BodyOpenrouterEmbeddings**|  | |
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

# **openrouterModels**
> any openrouterModels()


### Example

```typescript
import {
    OpenRouterProxyApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OpenRouterProxyApi(configuration);

const { status, data } = await apiInstance.openrouterModels();
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

# **openrouterModels_0**
> any openrouterModels_0()


### Example

```typescript
import {
    OpenRouterProxyApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OpenRouterProxyApi(configuration);

const { status, data } = await apiInstance.openrouterModels_0();
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

