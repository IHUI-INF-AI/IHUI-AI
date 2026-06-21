# CozeAudioApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**chatAudioApiV1CozeAudioAudioChatAudioPost**](CozeAudioApi.md#chataudioapiv1cozeaudioaudiochataudiopost) | **POST** /api/v1/coze/audio/audio/chat-audio | Chat Audio |
| [**chatAudioApiV1CozeAudioAudioChatAudioPost_0**](CozeAudioApi.md#chataudioapiv1cozeaudioaudiochataudiopost_0) | **POST** /api/v1/coze/audio/audio/chat-audio | Chat Audio |
| [**createSpeechApiV1CozeAudioAudioSpeechPost**](CozeAudioApi.md#createspeechapiv1cozeaudioaudiospeechpost) | **POST** /api/v1/coze/audio/audio/speech | Create Speech |
| [**createSpeechApiV1CozeAudioAudioSpeechPost_0**](CozeAudioApi.md#createspeechapiv1cozeaudioaudiospeechpost_0) | **POST** /api/v1/coze/audio/audio/speech | Create Speech |
| [**createVoiceprintApiV1CozeAudioAudioVoiceprintsPost**](CozeAudioApi.md#createvoiceprintapiv1cozeaudioaudiovoiceprintspost) | **POST** /api/v1/coze/audio/audio/voiceprints | Create Voiceprint |
| [**createVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0**](CozeAudioApi.md#createvoiceprintapiv1cozeaudioaudiovoiceprintspost_0) | **POST** /api/v1/coze/audio/audio/voiceprints | Create Voiceprint |
| [**deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete**](CozeAudioApi.md#deletevoiceprintapiv1cozeaudioaudiovoiceprintsdelete) | **DELETE** /api/v1/coze/audio/audio/voiceprints | Delete Voiceprint |
| [**deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0**](CozeAudioApi.md#deletevoiceprintapiv1cozeaudioaudiovoiceprintsdelete_0) | **DELETE** /api/v1/coze/audio/audio/voiceprints | Delete Voiceprint |
| [**listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet**](CozeAudioApi.md#listvoiceprintsapiv1cozeaudioaudiovoiceprintsget) | **GET** /api/v1/coze/audio/audio/voiceprints | List Voiceprints |
| [**listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0**](CozeAudioApi.md#listvoiceprintsapiv1cozeaudioaudiovoiceprintsget_0) | **GET** /api/v1/coze/audio/audio/voiceprints | List Voiceprints |
| [**listVoicesApiV1CozeAudioAudioVoicesGet**](CozeAudioApi.md#listvoicesapiv1cozeaudioaudiovoicesget) | **GET** /api/v1/coze/audio/audio/voices | List Voices |
| [**listVoicesApiV1CozeAudioAudioVoicesGet_0**](CozeAudioApi.md#listvoicesapiv1cozeaudioaudiovoicesget_0) | **GET** /api/v1/coze/audio/audio/voices | List Voices |
| [**updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut**](CozeAudioApi.md#updatevoiceprintapiv1cozeaudioaudiovoiceprintsput) | **PUT** /api/v1/coze/audio/audio/voiceprints | Update Voiceprint |
| [**updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0**](CozeAudioApi.md#updatevoiceprintapiv1cozeaudioaudiovoiceprintsput_0) | **PUT** /api/v1/coze/audio/audio/voiceprints | Update Voiceprint |



## chatAudioApiV1CozeAudioAudioChatAudioPost

> any chatAudioApiV1CozeAudioAudioChatAudioPost(chatAudioReq)

Chat Audio

### Example

```ts
import {
  Configuration,
  CozeAudioApi,
} from '';
import type { ChatAudioApiV1CozeAudioAudioChatAudioPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAudioApi();

  const body = {
    // ChatAudioReq
    chatAudioReq: ...,
  } satisfies ChatAudioApiV1CozeAudioAudioChatAudioPostRequest;

  try {
    const data = await api.chatAudioApiV1CozeAudioAudioChatAudioPost(body);
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
| **chatAudioReq** | [ChatAudioReq](ChatAudioReq.md) |  | |

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


## chatAudioApiV1CozeAudioAudioChatAudioPost_0

> any chatAudioApiV1CozeAudioAudioChatAudioPost_0(chatAudioReq)

Chat Audio

### Example

```ts
import {
  Configuration,
  CozeAudioApi,
} from '';
import type { ChatAudioApiV1CozeAudioAudioChatAudioPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAudioApi();

  const body = {
    // ChatAudioReq
    chatAudioReq: ...,
  } satisfies ChatAudioApiV1CozeAudioAudioChatAudioPost0Request;

  try {
    const data = await api.chatAudioApiV1CozeAudioAudioChatAudioPost_0(body);
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
| **chatAudioReq** | [ChatAudioReq](ChatAudioReq.md) |  | |

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


## createSpeechApiV1CozeAudioAudioSpeechPost

> any createSpeechApiV1CozeAudioAudioSpeechPost(speechReq)

Create Speech

### Example

```ts
import {
  Configuration,
  CozeAudioApi,
} from '';
import type { CreateSpeechApiV1CozeAudioAudioSpeechPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAudioApi();

  const body = {
    // SpeechReq
    speechReq: ...,
  } satisfies CreateSpeechApiV1CozeAudioAudioSpeechPostRequest;

  try {
    const data = await api.createSpeechApiV1CozeAudioAudioSpeechPost(body);
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
| **speechReq** | [SpeechReq](SpeechReq.md) |  | |

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


## createSpeechApiV1CozeAudioAudioSpeechPost_0

> any createSpeechApiV1CozeAudioAudioSpeechPost_0(speechReq)

Create Speech

### Example

```ts
import {
  Configuration,
  CozeAudioApi,
} from '';
import type { CreateSpeechApiV1CozeAudioAudioSpeechPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAudioApi();

  const body = {
    // SpeechReq
    speechReq: ...,
  } satisfies CreateSpeechApiV1CozeAudioAudioSpeechPost0Request;

  try {
    const data = await api.createSpeechApiV1CozeAudioAudioSpeechPost_0(body);
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
| **speechReq** | [SpeechReq](SpeechReq.md) |  | |

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


## createVoiceprintApiV1CozeAudioAudioVoiceprintsPost

> any createVoiceprintApiV1CozeAudioAudioVoiceprintsPost(voiceprintCreateReq)

Create Voiceprint

### Example

```ts
import {
  Configuration,
  CozeAudioApi,
} from '';
import type { CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAudioApi();

  const body = {
    // VoiceprintCreateReq
    voiceprintCreateReq: ...,
  } satisfies CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPostRequest;

  try {
    const data = await api.createVoiceprintApiV1CozeAudioAudioVoiceprintsPost(body);
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
| **voiceprintCreateReq** | [VoiceprintCreateReq](VoiceprintCreateReq.md) |  | |

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


## createVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0

> any createVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0(voiceprintCreateReq)

Create Voiceprint

### Example

```ts
import {
  Configuration,
  CozeAudioApi,
} from '';
import type { CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAudioApi();

  const body = {
    // VoiceprintCreateReq
    voiceprintCreateReq: ...,
  } satisfies CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost0Request;

  try {
    const data = await api.createVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0(body);
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
| **voiceprintCreateReq** | [VoiceprintCreateReq](VoiceprintCreateReq.md) |  | |

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


## deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete

> any deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete(voiceprintDeleteReq)

Delete Voiceprint

### Example

```ts
import {
  Configuration,
  CozeAudioApi,
} from '';
import type { DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAudioApi();

  const body = {
    // VoiceprintDeleteReq
    voiceprintDeleteReq: ...,
  } satisfies DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDeleteRequest;

  try {
    const data = await api.deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete(body);
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
| **voiceprintDeleteReq** | [VoiceprintDeleteReq](VoiceprintDeleteReq.md) |  | |

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


## deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0

> any deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0(voiceprintDeleteReq)

Delete Voiceprint

### Example

```ts
import {
  Configuration,
  CozeAudioApi,
} from '';
import type { DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAudioApi();

  const body = {
    // VoiceprintDeleteReq
    voiceprintDeleteReq: ...,
  } satisfies DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete0Request;

  try {
    const data = await api.deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0(body);
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
| **voiceprintDeleteReq** | [VoiceprintDeleteReq](VoiceprintDeleteReq.md) |  | |

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


## listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet

> any listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet()

List Voiceprints

### Example

```ts
import {
  Configuration,
  CozeAudioApi,
} from '';
import type { ListVoiceprintsApiV1CozeAudioAudioVoiceprintsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAudioApi();

  try {
    const data = await api.listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet();
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


## listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0

> any listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0()

List Voiceprints

### Example

```ts
import {
  Configuration,
  CozeAudioApi,
} from '';
import type { ListVoiceprintsApiV1CozeAudioAudioVoiceprintsGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAudioApi();

  try {
    const data = await api.listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0();
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


## listVoicesApiV1CozeAudioAudioVoicesGet

> any listVoicesApiV1CozeAudioAudioVoicesGet(filterType)

List Voices

### Example

```ts
import {
  Configuration,
  CozeAudioApi,
} from '';
import type { ListVoicesApiV1CozeAudioAudioVoicesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAudioApi();

  const body = {
    // string (optional)
    filterType: filterType_example,
  } satisfies ListVoicesApiV1CozeAudioAudioVoicesGetRequest;

  try {
    const data = await api.listVoicesApiV1CozeAudioAudioVoicesGet(body);
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
| **filterType** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## listVoicesApiV1CozeAudioAudioVoicesGet_0

> any listVoicesApiV1CozeAudioAudioVoicesGet_0(filterType)

List Voices

### Example

```ts
import {
  Configuration,
  CozeAudioApi,
} from '';
import type { ListVoicesApiV1CozeAudioAudioVoicesGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAudioApi();

  const body = {
    // string (optional)
    filterType: filterType_example,
  } satisfies ListVoicesApiV1CozeAudioAudioVoicesGet0Request;

  try {
    const data = await api.listVoicesApiV1CozeAudioAudioVoicesGet_0(body);
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
| **filterType** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut

> any updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut(voiceprintUpdateReq)

Update Voiceprint

### Example

```ts
import {
  Configuration,
  CozeAudioApi,
} from '';
import type { UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAudioApi();

  const body = {
    // VoiceprintUpdateReq
    voiceprintUpdateReq: ...,
  } satisfies UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPutRequest;

  try {
    const data = await api.updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut(body);
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
| **voiceprintUpdateReq** | [VoiceprintUpdateReq](VoiceprintUpdateReq.md) |  | |

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


## updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0

> any updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0(voiceprintUpdateReq)

Update Voiceprint

### Example

```ts
import {
  Configuration,
  CozeAudioApi,
} from '';
import type { UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAudioApi();

  const body = {
    // VoiceprintUpdateReq
    voiceprintUpdateReq: ...,
  } satisfies UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut0Request;

  try {
    const data = await api.updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0(body);
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
| **voiceprintUpdateReq** | [VoiceprintUpdateReq](VoiceprintUpdateReq.md) |  | |

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

