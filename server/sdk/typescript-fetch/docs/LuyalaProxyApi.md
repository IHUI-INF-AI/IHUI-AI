# LuyalaProxyApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**luyalaChat**](LuyalaProxyApi.md#luyalachat) | **POST** /api/v1/luyala-proxy/chat | 露雅拉对话 |
| [**luyalaChat_0**](LuyalaProxyApi.md#luyalachat_0) | **POST** /api/v1/luyala-proxy/chat | 露雅拉对话 |
| [**luyalaCompletion**](LuyalaProxyApi.md#luyalacompletion) | **POST** /api/v1/luyala-proxy/completion | 露雅拉文本补全 |
| [**luyalaCompletion_0**](LuyalaProxyApi.md#luyalacompletion_0) | **POST** /api/v1/luyala-proxy/completion | 露雅拉文本补全 |
| [**luyalaEmbeddings**](LuyalaProxyApi.md#luyalaembeddings) | **POST** /api/v1/luyala-proxy/embeddings | 露雅拉Embedding |
| [**luyalaEmbeddings_0**](LuyalaProxyApi.md#luyalaembeddings_0) | **POST** /api/v1/luyala-proxy/embeddings | 露雅拉Embedding |
| [**luyalaModels**](LuyalaProxyApi.md#luyalamodels) | **GET** /api/v1/luyala-proxy/models | 可用模型列表 |
| [**luyalaModels_0**](LuyalaProxyApi.md#luyalamodels_0) | **GET** /api/v1/luyala-proxy/models | 可用模型列表 |



## luyalaChat

> any luyalaChat(bodyLuyalaChat, apiKey)

露雅拉对话

### Example

```ts
import {
  Configuration,
  LuyalaProxyApi,
} from '';
import type { LuyalaChatRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LuyalaProxyApi();

  const body = {
    // BodyLuyalaChat
    bodyLuyalaChat: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies LuyalaChatRequest;

  try {
    const data = await api.luyalaChat(body);
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
| **bodyLuyalaChat** | [BodyLuyalaChat](BodyLuyalaChat.md) |  | |
| **apiKey** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## luyalaChat_0

> any luyalaChat_0(bodyLuyalaChat, apiKey)

露雅拉对话

### Example

```ts
import {
  Configuration,
  LuyalaProxyApi,
} from '';
import type { LuyalaChat0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LuyalaProxyApi();

  const body = {
    // BodyLuyalaChat
    bodyLuyalaChat: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies LuyalaChat0Request;

  try {
    const data = await api.luyalaChat_0(body);
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
| **bodyLuyalaChat** | [BodyLuyalaChat](BodyLuyalaChat.md) |  | |
| **apiKey** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## luyalaCompletion

> any luyalaCompletion(bodyLuyalaCompletion, apiKey)

露雅拉文本补全

### Example

```ts
import {
  Configuration,
  LuyalaProxyApi,
} from '';
import type { LuyalaCompletionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LuyalaProxyApi();

  const body = {
    // BodyLuyalaCompletion
    bodyLuyalaCompletion: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies LuyalaCompletionRequest;

  try {
    const data = await api.luyalaCompletion(body);
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
| **bodyLuyalaCompletion** | [BodyLuyalaCompletion](BodyLuyalaCompletion.md) |  | |
| **apiKey** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## luyalaCompletion_0

> any luyalaCompletion_0(bodyLuyalaCompletion, apiKey)

露雅拉文本补全

### Example

```ts
import {
  Configuration,
  LuyalaProxyApi,
} from '';
import type { LuyalaCompletion0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LuyalaProxyApi();

  const body = {
    // BodyLuyalaCompletion
    bodyLuyalaCompletion: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies LuyalaCompletion0Request;

  try {
    const data = await api.luyalaCompletion_0(body);
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
| **bodyLuyalaCompletion** | [BodyLuyalaCompletion](BodyLuyalaCompletion.md) |  | |
| **apiKey** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## luyalaEmbeddings

> any luyalaEmbeddings(bodyLuyalaEmbeddings, apiKey)

露雅拉Embedding

### Example

```ts
import {
  Configuration,
  LuyalaProxyApi,
} from '';
import type { LuyalaEmbeddingsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LuyalaProxyApi();

  const body = {
    // BodyLuyalaEmbeddings
    bodyLuyalaEmbeddings: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies LuyalaEmbeddingsRequest;

  try {
    const data = await api.luyalaEmbeddings(body);
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
| **bodyLuyalaEmbeddings** | [BodyLuyalaEmbeddings](BodyLuyalaEmbeddings.md) |  | |
| **apiKey** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## luyalaEmbeddings_0

> any luyalaEmbeddings_0(bodyLuyalaEmbeddings, apiKey)

露雅拉Embedding

### Example

```ts
import {
  Configuration,
  LuyalaProxyApi,
} from '';
import type { LuyalaEmbeddings0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LuyalaProxyApi();

  const body = {
    // BodyLuyalaEmbeddings
    bodyLuyalaEmbeddings: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies LuyalaEmbeddings0Request;

  try {
    const data = await api.luyalaEmbeddings_0(body);
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
| **bodyLuyalaEmbeddings** | [BodyLuyalaEmbeddings](BodyLuyalaEmbeddings.md) |  | |
| **apiKey** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## luyalaModels

> any luyalaModels()

可用模型列表

### Example

```ts
import {
  Configuration,
  LuyalaProxyApi,
} from '';
import type { LuyalaModelsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LuyalaProxyApi();

  try {
    const data = await api.luyalaModels();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## luyalaModels_0

> any luyalaModels_0()

可用模型列表

### Example

```ts
import {
  Configuration,
  LuyalaProxyApi,
} from '';
import type { LuyalaModels0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LuyalaProxyApi();

  try {
    const data = await api.luyalaModels_0();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

