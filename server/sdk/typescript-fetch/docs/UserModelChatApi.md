# UserModelChatApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**imageApiV1UserModelChatImagePost**](UserModelChatApi.md#imageapiv1usermodelchatimagepost) | **POST** /api/v1/user-model-chat/image | AI模型生图 |
| [**imageApiV1UserModelChatImagePost_0**](UserModelChatApi.md#imageapiv1usermodelchatimagepost_0) | **POST** /api/v1/user-model-chat/image | AI模型生图 |
| [**listModelsApiV1UserModelChatListGet**](UserModelChatApi.md#listmodelsapiv1usermodelchatlistget) | **GET** /api/v1/user-model-chat/list | 可用模型列表 |
| [**listModelsApiV1UserModelChatListGet_0**](UserModelChatApi.md#listmodelsapiv1usermodelchatlistget_0) | **GET** /api/v1/user-model-chat/list | 可用模型列表 |
| [**userModelChatChat**](UserModelChatApi.md#usermodelchatchat) | **POST** /api/v1/user-model-chat/chat | AI模型对话 |
| [**userModelChatChat_0**](UserModelChatApi.md#usermodelchatchat_0) | **POST** /api/v1/user-model-chat/chat | AI模型对话 |



## imageApiV1UserModelChatImagePost

> any imageApiV1UserModelChatImagePost(bodyImageApiV1UserModelChatImagePost, apiKey, apiBase)

AI模型生图

### Example

```ts
import {
  Configuration,
  UserModelChatApi,
} from '';
import type { ImageApiV1UserModelChatImagePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserModelChatApi();

  const body = {
    // BodyImageApiV1UserModelChatImagePost
    bodyImageApiV1UserModelChatImagePost: ...,
    // string (optional)
    apiKey: apiKey_example,
    // string (optional)
    apiBase: apiBase_example,
  } satisfies ImageApiV1UserModelChatImagePostRequest;

  try {
    const data = await api.imageApiV1UserModelChatImagePost(body);
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
| **bodyImageApiV1UserModelChatImagePost** | [BodyImageApiV1UserModelChatImagePost](BodyImageApiV1UserModelChatImagePost.md) |  | |
| **apiKey** | `string` |  | [Optional] [Defaults to `undefined`] |
| **apiBase** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## imageApiV1UserModelChatImagePost_0

> any imageApiV1UserModelChatImagePost_0(bodyImageApiV1UserModelChatImagePost, apiKey, apiBase)

AI模型生图

### Example

```ts
import {
  Configuration,
  UserModelChatApi,
} from '';
import type { ImageApiV1UserModelChatImagePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserModelChatApi();

  const body = {
    // BodyImageApiV1UserModelChatImagePost
    bodyImageApiV1UserModelChatImagePost: ...,
    // string (optional)
    apiKey: apiKey_example,
    // string (optional)
    apiBase: apiBase_example,
  } satisfies ImageApiV1UserModelChatImagePost0Request;

  try {
    const data = await api.imageApiV1UserModelChatImagePost_0(body);
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
| **bodyImageApiV1UserModelChatImagePost** | [BodyImageApiV1UserModelChatImagePost](BodyImageApiV1UserModelChatImagePost.md) |  | |
| **apiKey** | `string` |  | [Optional] [Defaults to `undefined`] |
| **apiBase** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## listModelsApiV1UserModelChatListGet

> any listModelsApiV1UserModelChatListGet()

可用模型列表

获取支持的AI模型列表

### Example

```ts
import {
  Configuration,
  UserModelChatApi,
} from '';
import type { ListModelsApiV1UserModelChatListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserModelChatApi();

  try {
    const data = await api.listModelsApiV1UserModelChatListGet();
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


## listModelsApiV1UserModelChatListGet_0

> any listModelsApiV1UserModelChatListGet_0()

可用模型列表

获取支持的AI模型列表

### Example

```ts
import {
  Configuration,
  UserModelChatApi,
} from '';
import type { ListModelsApiV1UserModelChatListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserModelChatApi();

  try {
    const data = await api.listModelsApiV1UserModelChatListGet_0();
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


## userModelChatChat

> any userModelChatChat(bodyUserModelChatChat, apiKey, apiBase)

AI模型对话

用户直接调用AI模型对话（不绑定Agent）

### Example

```ts
import {
  Configuration,
  UserModelChatApi,
} from '';
import type { UserModelChatChatRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserModelChatApi();

  const body = {
    // BodyUserModelChatChat
    bodyUserModelChatChat: ...,
    // string (optional)
    apiKey: apiKey_example,
    // string (optional)
    apiBase: apiBase_example,
  } satisfies UserModelChatChatRequest;

  try {
    const data = await api.userModelChatChat(body);
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
| **bodyUserModelChatChat** | [BodyUserModelChatChat](BodyUserModelChatChat.md) |  | |
| **apiKey** | `string` |  | [Optional] [Defaults to `undefined`] |
| **apiBase** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## userModelChatChat_0

> any userModelChatChat_0(bodyUserModelChatChat, apiKey, apiBase)

AI模型对话

用户直接调用AI模型对话（不绑定Agent）

### Example

```ts
import {
  Configuration,
  UserModelChatApi,
} from '';
import type { UserModelChatChat0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UserModelChatApi();

  const body = {
    // BodyUserModelChatChat
    bodyUserModelChatChat: ...,
    // string (optional)
    apiKey: apiKey_example,
    // string (optional)
    apiBase: apiBase_example,
  } satisfies UserModelChatChat0Request;

  try {
    const data = await api.userModelChatChat_0(body);
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
| **bodyUserModelChatChat** | [BodyUserModelChatChat](BodyUserModelChatChat.md) |  | |
| **apiKey** | `string` |  | [Optional] [Defaults to `undefined`] |
| **apiBase** | `string` |  | [Optional] [Defaults to `undefined`] |

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

