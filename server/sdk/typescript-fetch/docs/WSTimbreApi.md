# WSTimbreApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createTimbreApiV1WsTimbreCreatePost**](WSTimbreApi.md#createtimbreapiv1wstimbrecreatepost) | **POST** /api/v1/ws/timbre/create | 新增音色 |
| [**createTimbreTimbreCreatePost**](WSTimbreApi.md#createtimbretimbrecreatepost) | **POST** /timbre/create | 新增音色 |
| [**deleteTimbreApiV1WsTimbreDeletePost**](WSTimbreApi.md#deletetimbreapiv1wstimbredeletepost) | **POST** /api/v1/ws/timbre/delete | 删除音色 |
| [**deleteTimbreTimbreDeletePost**](WSTimbreApi.md#deletetimbretimbredeletepost) | **POST** /timbre/delete | 删除音色 |
| [**listTimbresApiV1WsTimbreListGet**](WSTimbreApi.md#listtimbresapiv1wstimbrelistget) | **GET** /api/v1/ws/timbre/list | 音色列表 |
| [**listTimbresTimbreListGet**](WSTimbreApi.md#listtimbrestimbrelistget) | **GET** /timbre/list | 音色列表 |
| [**updateTimbreApiV1WsTimbreUpdatePost**](WSTimbreApi.md#updatetimbreapiv1wstimbreupdatepost) | **POST** /api/v1/ws/timbre/update | 更新音色 |
| [**updateTimbreTimbreUpdatePost**](WSTimbreApi.md#updatetimbretimbreupdatepost) | **POST** /timbre/update | 更新音色 |



## createTimbreApiV1WsTimbreCreatePost

> any createTimbreApiV1WsTimbreCreatePost(name, voiceId, language, gender, ageRange, style, sampleUrl)

新增音色

### Example

```ts
import {
  Configuration,
  WSTimbreApi,
} from '';
import type { CreateTimbreApiV1WsTimbreCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSTimbreApi(config);

  const body = {
    // string
    name: name_example,
    // string
    voiceId: voiceId_example,
    // string (optional)
    language: language_example,
    // string (optional)
    gender: gender_example,
    // string (optional)
    ageRange: ageRange_example,
    // string (optional)
    style: style_example,
    // string (optional)
    sampleUrl: sampleUrl_example,
  } satisfies CreateTimbreApiV1WsTimbreCreatePostRequest;

  try {
    const data = await api.createTimbreApiV1WsTimbreCreatePost(body);
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
| **name** | `string` |  | [Defaults to `undefined`] |
| **voiceId** | `string` |  | [Defaults to `undefined`] |
| **language** | `string` |  | [Optional] [Defaults to `&#39;zh&#39;`] |
| **gender** | `string` |  | [Optional] [Defaults to `&#39;female&#39;`] |
| **ageRange** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **style** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **sampleUrl** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |

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


## createTimbreTimbreCreatePost

> any createTimbreTimbreCreatePost(name, voiceId, language, gender, ageRange, style, sampleUrl)

新增音色

### Example

```ts
import {
  Configuration,
  WSTimbreApi,
} from '';
import type { CreateTimbreTimbreCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSTimbreApi(config);

  const body = {
    // string
    name: name_example,
    // string
    voiceId: voiceId_example,
    // string (optional)
    language: language_example,
    // string (optional)
    gender: gender_example,
    // string (optional)
    ageRange: ageRange_example,
    // string (optional)
    style: style_example,
    // string (optional)
    sampleUrl: sampleUrl_example,
  } satisfies CreateTimbreTimbreCreatePostRequest;

  try {
    const data = await api.createTimbreTimbreCreatePost(body);
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
| **name** | `string` |  | [Defaults to `undefined`] |
| **voiceId** | `string` |  | [Defaults to `undefined`] |
| **language** | `string` |  | [Optional] [Defaults to `&#39;zh&#39;`] |
| **gender** | `string` |  | [Optional] [Defaults to `&#39;female&#39;`] |
| **ageRange** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **style** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **sampleUrl** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |

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


## deleteTimbreApiV1WsTimbreDeletePost

> any deleteTimbreApiV1WsTimbreDeletePost(timbreId)

删除音色

### Example

```ts
import {
  Configuration,
  WSTimbreApi,
} from '';
import type { DeleteTimbreApiV1WsTimbreDeletePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSTimbreApi(config);

  const body = {
    // string
    timbreId: timbreId_example,
  } satisfies DeleteTimbreApiV1WsTimbreDeletePostRequest;

  try {
    const data = await api.deleteTimbreApiV1WsTimbreDeletePost(body);
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
| **timbreId** | `string` |  | [Defaults to `undefined`] |

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


## deleteTimbreTimbreDeletePost

> any deleteTimbreTimbreDeletePost(timbreId)

删除音色

### Example

```ts
import {
  Configuration,
  WSTimbreApi,
} from '';
import type { DeleteTimbreTimbreDeletePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSTimbreApi(config);

  const body = {
    // string
    timbreId: timbreId_example,
  } satisfies DeleteTimbreTimbreDeletePostRequest;

  try {
    const data = await api.deleteTimbreTimbreDeletePost(body);
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
| **timbreId** | `string` |  | [Defaults to `undefined`] |

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


## listTimbresApiV1WsTimbreListGet

> any listTimbresApiV1WsTimbreListGet(language, gender, page, limit)

音色列表

### Example

```ts
import {
  Configuration,
  WSTimbreApi,
} from '';
import type { ListTimbresApiV1WsTimbreListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSTimbreApi(config);

  const body = {
    // string (optional)
    language: language_example,
    // string (optional)
    gender: gender_example,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListTimbresApiV1WsTimbreListGetRequest;

  try {
    const data = await api.listTimbresApiV1WsTimbreListGet(body);
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
| **language** | `string` |  | [Optional] [Defaults to `undefined`] |
| **gender** | `string` |  | [Optional] [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

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


## listTimbresTimbreListGet

> any listTimbresTimbreListGet(language, gender, page, limit)

音色列表

### Example

```ts
import {
  Configuration,
  WSTimbreApi,
} from '';
import type { ListTimbresTimbreListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSTimbreApi(config);

  const body = {
    // string (optional)
    language: language_example,
    // string (optional)
    gender: gender_example,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListTimbresTimbreListGetRequest;

  try {
    const data = await api.listTimbresTimbreListGet(body);
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
| **language** | `string` |  | [Optional] [Defaults to `undefined`] |
| **gender** | `string` |  | [Optional] [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

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


## updateTimbreApiV1WsTimbreUpdatePost

> any updateTimbreApiV1WsTimbreUpdatePost(timbreId, name, sampleUrl, status)

更新音色

### Example

```ts
import {
  Configuration,
  WSTimbreApi,
} from '';
import type { UpdateTimbreApiV1WsTimbreUpdatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSTimbreApi(config);

  const body = {
    // string
    timbreId: timbreId_example,
    // string (optional)
    name: name_example,
    // string (optional)
    sampleUrl: sampleUrl_example,
    // number (optional)
    status: 56,
  } satisfies UpdateTimbreApiV1WsTimbreUpdatePostRequest;

  try {
    const data = await api.updateTimbreApiV1WsTimbreUpdatePost(body);
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
| **timbreId** | `string` |  | [Defaults to `undefined`] |
| **name** | `string` |  | [Optional] [Defaults to `undefined`] |
| **sampleUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## updateTimbreTimbreUpdatePost

> any updateTimbreTimbreUpdatePost(timbreId, name, sampleUrl, status)

更新音色

### Example

```ts
import {
  Configuration,
  WSTimbreApi,
} from '';
import type { UpdateTimbreTimbreUpdatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WSTimbreApi(config);

  const body = {
    // string
    timbreId: timbreId_example,
    // string (optional)
    name: name_example,
    // string (optional)
    sampleUrl: sampleUrl_example,
    // number (optional)
    status: 56,
  } satisfies UpdateTimbreTimbreUpdatePostRequest;

  try {
    const data = await api.updateTimbreTimbreUpdatePost(body);
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
| **timbreId** | `string` |  | [Defaults to `undefined`] |
| **name** | `string` |  | [Optional] [Defaults to `undefined`] |
| **sampleUrl** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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

