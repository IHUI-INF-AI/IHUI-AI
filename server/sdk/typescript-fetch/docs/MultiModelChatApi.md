# MultiModelChatApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**listVendorsApiV1ChatVendorsGet**](MultiModelChatApi.md#listvendorsapiv1chatvendorsget) | **GET** /api/v1/chat/vendors | 列出支持的 AI 厂商 |
| [**multiVendorChatApiV1ChatMultiPost**](MultiModelChatApi.md#multivendorchatapiv1chatmultipost) | **POST** /api/v1/chat/multi | 同时调用多个厂商并返回结果列表（用于对比评测） |
| [**vendorChatApiV1ChatVendorChatPost**](MultiModelChatApi.md#vendorchatapiv1chatvendorchatpost) | **POST** /api/v1/chat/{vendor}/chat | 多厂商同步聊天 |
| [**vendorChatStreamApiV1ChatVendorChatStreamPost**](MultiModelChatApi.md#vendorchatstreamapiv1chatvendorchatstreampost) | **POST** /api/v1/chat/{vendor}/chat/stream | 多厂商流式聊天（SSE） |



## listVendorsApiV1ChatVendorsGet

> any listVendorsApiV1ChatVendorsGet()

列出支持的 AI 厂商

### Example

```ts
import {
  Configuration,
  MultiModelChatApi,
} from '';
import type { ListVendorsApiV1ChatVendorsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MultiModelChatApi(config);

  try {
    const data = await api.listVendorsApiV1ChatVendorsGet();
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## multiVendorChatApiV1ChatMultiPost

> any multiVendorChatApiV1ChatMultiPost(vendors, message, model)

同时调用多个厂商并返回结果列表（用于对比评测）

### Example

```ts
import {
  Configuration,
  MultiModelChatApi,
} from '';
import type { MultiVendorChatApiV1ChatMultiPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MultiModelChatApi(config);

  const body = {
    // string | 逗号分隔的厂商列表，如 zhipu,openrouter
    vendors: vendors_example,
    // string
    message: message_example,
    // string (optional)
    model: model_example,
  } satisfies MultiVendorChatApiV1ChatMultiPostRequest;

  try {
    const data = await api.multiVendorChatApiV1ChatMultiPost(body);
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
| **vendors** | `string` | 逗号分隔的厂商列表，如 zhipu,openrouter | [Defaults to `undefined`] |
| **message** | `string` |  | [Defaults to `undefined`] |
| **model** | `string` |  | [Optional] [Defaults to `&#39;gpt-3.5-turbo&#39;`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## vendorChatApiV1ChatVendorChatPost

> any vendorChatApiV1ChatVendorChatPost(vendor, model, message)

多厂商同步聊天

### Example

```ts
import {
  Configuration,
  MultiModelChatApi,
} from '';
import type { VendorChatApiV1ChatVendorChatPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MultiModelChatApi(config);

  const body = {
    // string
    vendor: vendor_example,
    // string
    model: model_example,
    // string
    message: message_example,
  } satisfies VendorChatApiV1ChatVendorChatPostRequest;

  try {
    const data = await api.vendorChatApiV1ChatVendorChatPost(body);
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
| **vendor** | `string` |  | [Defaults to `undefined`] |
| **model** | `string` |  | [Defaults to `undefined`] |
| **message** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## vendorChatStreamApiV1ChatVendorChatStreamPost

> any vendorChatStreamApiV1ChatVendorChatStreamPost(vendor, model, message)

多厂商流式聊天（SSE）

### Example

```ts
import {
  Configuration,
  MultiModelChatApi,
} from '';
import type { VendorChatStreamApiV1ChatVendorChatStreamPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MultiModelChatApi(config);

  const body = {
    // string
    vendor: vendor_example,
    // string
    model: model_example,
    // string
    message: message_example,
  } satisfies VendorChatStreamApiV1ChatVendorChatStreamPostRequest;

  try {
    const data = await api.vendorChatStreamApiV1ChatVendorChatStreamPost(body);
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
| **vendor** | `string` |  | [Defaults to `undefined`] |
| **model** | `string` |  | [Defaults to `undefined`] |
| **message** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

