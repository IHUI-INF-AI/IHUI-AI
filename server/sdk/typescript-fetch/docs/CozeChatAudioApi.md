# CozeChatAudioApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost**](CozeChatAudioApi.md#onetooneaudioapiv1cozechataudiochataudioonetoonepost) | **POST** /api/v1/coze/chat-audio/chat-audio/one-to-one | One To One Audio |
| [**oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0**](CozeChatAudioApi.md#onetooneaudioapiv1cozechataudiochataudioonetoonepost_0) | **POST** /api/v1/coze/chat-audio/chat-audio/one-to-one | One To One Audio |
| [**pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost**](CozeChatAudioApi.md#pluginaudiochatapiv1cozechataudiochataudiopluginpost) | **POST** /api/v1/coze/chat-audio/chat-audio/plugin | Plugin Audio Chat |
| [**pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0**](CozeChatAudioApi.md#pluginaudiochatapiv1cozechataudiochataudiopluginpost_0) | **POST** /api/v1/coze/chat-audio/chat-audio/plugin | Plugin Audio Chat |
| [**simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost**](CozeChatAudioApi.md#simpleaudiochatapiv1cozechataudiochataudiosimplepost) | **POST** /api/v1/coze/chat-audio/chat-audio/simple | Simple Audio Chat |
| [**simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0**](CozeChatAudioApi.md#simpleaudiochatapiv1cozechataudiochataudiosimplepost_0) | **POST** /api/v1/coze/chat-audio/chat-audio/simple | Simple Audio Chat |



## oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost

> any oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost(oneToOneAudioReq)

One To One Audio

### Example

```ts
import {
  Configuration,
  CozeChatAudioApi,
} from '';
import type { OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeChatAudioApi();

  const body = {
    // OneToOneAudioReq
    oneToOneAudioReq: ...,
  } satisfies OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePostRequest;

  try {
    const data = await api.oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost(body);
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
| **oneToOneAudioReq** | [OneToOneAudioReq](OneToOneAudioReq.md) |  | |

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


## oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0

> any oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0(oneToOneAudioReq)

One To One Audio

### Example

```ts
import {
  Configuration,
  CozeChatAudioApi,
} from '';
import type { OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeChatAudioApi();

  const body = {
    // OneToOneAudioReq
    oneToOneAudioReq: ...,
  } satisfies OneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost0Request;

  try {
    const data = await api.oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0(body);
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
| **oneToOneAudioReq** | [OneToOneAudioReq](OneToOneAudioReq.md) |  | |

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


## pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost

> any pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost(pluginAudioReq)

Plugin Audio Chat

### Example

```ts
import {
  Configuration,
  CozeChatAudioApi,
} from '';
import type { PluginAudioChatApiV1CozeChatAudioChatAudioPluginPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeChatAudioApi();

  const body = {
    // PluginAudioReq
    pluginAudioReq: ...,
  } satisfies PluginAudioChatApiV1CozeChatAudioChatAudioPluginPostRequest;

  try {
    const data = await api.pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost(body);
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
| **pluginAudioReq** | [PluginAudioReq](PluginAudioReq.md) |  | |

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


## pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0

> any pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0(pluginAudioReq)

Plugin Audio Chat

### Example

```ts
import {
  Configuration,
  CozeChatAudioApi,
} from '';
import type { PluginAudioChatApiV1CozeChatAudioChatAudioPluginPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeChatAudioApi();

  const body = {
    // PluginAudioReq
    pluginAudioReq: ...,
  } satisfies PluginAudioChatApiV1CozeChatAudioChatAudioPluginPost0Request;

  try {
    const data = await api.pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0(body);
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
| **pluginAudioReq** | [PluginAudioReq](PluginAudioReq.md) |  | |

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


## simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost

> any simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost(simpleAudioReq)

Simple Audio Chat

### Example

```ts
import {
  Configuration,
  CozeChatAudioApi,
} from '';
import type { SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeChatAudioApi();

  const body = {
    // SimpleAudioReq
    simpleAudioReq: ...,
  } satisfies SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePostRequest;

  try {
    const data = await api.simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost(body);
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
| **simpleAudioReq** | [SimpleAudioReq](SimpleAudioReq.md) |  | |

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


## simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0

> any simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0(simpleAudioReq)

Simple Audio Chat

### Example

```ts
import {
  Configuration,
  CozeChatAudioApi,
} from '';
import type { SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeChatAudioApi();

  const body = {
    // SimpleAudioReq
    simpleAudioReq: ...,
  } satisfies SimpleAudioChatApiV1CozeChatAudioChatAudioSimplePost0Request;

  try {
    const data = await api.simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0(body);
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
| **simpleAudioReq** | [SimpleAudioReq](SimpleAudioReq.md) |  | |

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

