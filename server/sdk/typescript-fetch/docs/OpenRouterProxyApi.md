# OpenRouterProxyApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**creditsApiV1OpenrouterProxyCreditsGet**](OpenRouterProxyApi.md#creditsapiv1openrouterproxycreditsget) | **GET** /api/v1/openrouter-proxy/credits | 账户额度 |
| [**creditsApiV1OpenrouterProxyCreditsGet_0**](OpenRouterProxyApi.md#creditsapiv1openrouterproxycreditsget_0) | **GET** /api/v1/openrouter-proxy/credits | 账户额度 |
| [**openrouterChat**](OpenRouterProxyApi.md#openrouterchat) | **POST** /api/v1/openrouter-proxy/chat | OpenRouter对话 |
| [**openrouterChat_0**](OpenRouterProxyApi.md#openrouterchat_0) | **POST** /api/v1/openrouter-proxy/chat | OpenRouter对话 |
| [**openrouterCompletion**](OpenRouterProxyApi.md#openroutercompletion) | **POST** /api/v1/openrouter-proxy/completion | OpenRouter文本补全 |
| [**openrouterCompletion_0**](OpenRouterProxyApi.md#openroutercompletion_0) | **POST** /api/v1/openrouter-proxy/completion | OpenRouter文本补全 |
| [**openrouterEmbeddings**](OpenRouterProxyApi.md#openrouterembeddings) | **POST** /api/v1/openrouter-proxy/embeddings | OpenRouter Embeddings |
| [**openrouterEmbeddings_0**](OpenRouterProxyApi.md#openrouterembeddings_0) | **POST** /api/v1/openrouter-proxy/embeddings | OpenRouter Embeddings |
| [**openrouterModels**](OpenRouterProxyApi.md#openroutermodels) | **GET** /api/v1/openrouter-proxy/models | 可用模型列表 |
| [**openrouterModels_0**](OpenRouterProxyApi.md#openroutermodels_0) | **GET** /api/v1/openrouter-proxy/models | 可用模型列表 |



## creditsApiV1OpenrouterProxyCreditsGet

> any creditsApiV1OpenrouterProxyCreditsGet(apiKey)

账户额度

### Example

```ts
import {
  Configuration,
  OpenRouterProxyApi,
} from '';
import type { CreditsApiV1OpenrouterProxyCreditsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OpenRouterProxyApi();

  const body = {
    // string (optional)
    apiKey: apiKey_example,
  } satisfies CreditsApiV1OpenrouterProxyCreditsGetRequest;

  try {
    const data = await api.creditsApiV1OpenrouterProxyCreditsGet(body);
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
| **apiKey** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |

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
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## creditsApiV1OpenrouterProxyCreditsGet_0

> any creditsApiV1OpenrouterProxyCreditsGet_0(apiKey)

账户额度

### Example

```ts
import {
  Configuration,
  OpenRouterProxyApi,
} from '';
import type { CreditsApiV1OpenrouterProxyCreditsGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OpenRouterProxyApi();

  const body = {
    // string (optional)
    apiKey: apiKey_example,
  } satisfies CreditsApiV1OpenrouterProxyCreditsGet0Request;

  try {
    const data = await api.creditsApiV1OpenrouterProxyCreditsGet_0(body);
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
| **apiKey** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |

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
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## openrouterChat

> any openrouterChat(bodyOpenrouterChat, apiKey)

OpenRouter对话

### Example

```ts
import {
  Configuration,
  OpenRouterProxyApi,
} from '';
import type { OpenrouterChatRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OpenRouterProxyApi();

  const body = {
    // BodyOpenrouterChat
    bodyOpenrouterChat: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies OpenrouterChatRequest;

  try {
    const data = await api.openrouterChat(body);
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
| **bodyOpenrouterChat** | [BodyOpenrouterChat](BodyOpenrouterChat.md) |  | |
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


## openrouterChat_0

> any openrouterChat_0(bodyOpenrouterChat, apiKey)

OpenRouter对话

### Example

```ts
import {
  Configuration,
  OpenRouterProxyApi,
} from '';
import type { OpenrouterChat0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OpenRouterProxyApi();

  const body = {
    // BodyOpenrouterChat
    bodyOpenrouterChat: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies OpenrouterChat0Request;

  try {
    const data = await api.openrouterChat_0(body);
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
| **bodyOpenrouterChat** | [BodyOpenrouterChat](BodyOpenrouterChat.md) |  | |
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


## openrouterCompletion

> any openrouterCompletion(bodyOpenrouterCompletion, apiKey)

OpenRouter文本补全

### Example

```ts
import {
  Configuration,
  OpenRouterProxyApi,
} from '';
import type { OpenrouterCompletionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OpenRouterProxyApi();

  const body = {
    // BodyOpenrouterCompletion
    bodyOpenrouterCompletion: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies OpenrouterCompletionRequest;

  try {
    const data = await api.openrouterCompletion(body);
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
| **bodyOpenrouterCompletion** | [BodyOpenrouterCompletion](BodyOpenrouterCompletion.md) |  | |
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


## openrouterCompletion_0

> any openrouterCompletion_0(bodyOpenrouterCompletion, apiKey)

OpenRouter文本补全

### Example

```ts
import {
  Configuration,
  OpenRouterProxyApi,
} from '';
import type { OpenrouterCompletion0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OpenRouterProxyApi();

  const body = {
    // BodyOpenrouterCompletion
    bodyOpenrouterCompletion: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies OpenrouterCompletion0Request;

  try {
    const data = await api.openrouterCompletion_0(body);
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
| **bodyOpenrouterCompletion** | [BodyOpenrouterCompletion](BodyOpenrouterCompletion.md) |  | |
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


## openrouterEmbeddings

> any openrouterEmbeddings(bodyOpenrouterEmbeddings, apiKey)

OpenRouter Embeddings

### Example

```ts
import {
  Configuration,
  OpenRouterProxyApi,
} from '';
import type { OpenrouterEmbeddingsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OpenRouterProxyApi();

  const body = {
    // BodyOpenrouterEmbeddings
    bodyOpenrouterEmbeddings: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies OpenrouterEmbeddingsRequest;

  try {
    const data = await api.openrouterEmbeddings(body);
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
| **bodyOpenrouterEmbeddings** | [BodyOpenrouterEmbeddings](BodyOpenrouterEmbeddings.md) |  | |
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


## openrouterEmbeddings_0

> any openrouterEmbeddings_0(bodyOpenrouterEmbeddings, apiKey)

OpenRouter Embeddings

### Example

```ts
import {
  Configuration,
  OpenRouterProxyApi,
} from '';
import type { OpenrouterEmbeddings0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OpenRouterProxyApi();

  const body = {
    // BodyOpenrouterEmbeddings
    bodyOpenrouterEmbeddings: ...,
    // string (optional)
    apiKey: apiKey_example,
  } satisfies OpenrouterEmbeddings0Request;

  try {
    const data = await api.openrouterEmbeddings_0(body);
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
| **bodyOpenrouterEmbeddings** | [BodyOpenrouterEmbeddings](BodyOpenrouterEmbeddings.md) |  | |
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


## openrouterModels

> any openrouterModels()

可用模型列表

### Example

```ts
import {
  Configuration,
  OpenRouterProxyApi,
} from '';
import type { OpenrouterModelsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OpenRouterProxyApi();

  try {
    const data = await api.openrouterModels();
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


## openrouterModels_0

> any openrouterModels_0()

可用模型列表

### Example

```ts
import {
  Configuration,
  OpenRouterProxyApi,
} from '';
import type { OpenrouterModels0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OpenRouterProxyApi();

  try {
    const data = await api.openrouterModels_0();
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

