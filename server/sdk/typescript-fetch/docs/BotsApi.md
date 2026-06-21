# BotsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createBotApiV1BotsCreatePost**](BotsApi.md#createbotapiv1botscreatepost) | **POST** /api/v1/bots/create | 创建 Bot |
| [**deleteBotApiV1BotsDeletePost**](BotsApi.md#deletebotapiv1botsdeletepost) | **POST** /api/v1/bots/delete | 删除 Bot |
| [**getBotApiV1BotsBotIdGet**](BotsApi.md#getbotapiv1botsbotidget) | **GET** /api/v1/bots/{bot_id} | Bot 详情 |
| [**listBotsApiV1BotsListGet**](BotsApi.md#listbotsapiv1botslistget) | **GET** /api/v1/bots/list | Bot 列表 |
| [**listDatasetsApiV1BotsDatasetsListGet**](BotsApi.md#listdatasetsapiv1botsdatasetslistget) | **GET** /api/v1/bots/datasets/list | Bot 关联知识库列表 |
| [**publishBotApiV1BotsPublishPost**](BotsApi.md#publishbotapiv1botspublishpost) | **POST** /api/v1/bots/publish | 发布 Bot |
| [**updateBotApiV1BotsUpdatePost**](BotsApi.md#updatebotapiv1botsupdatepost) | **POST** /api/v1/bots/update | 更新 Bot |



## createBotApiV1BotsCreatePost

> any createBotApiV1BotsCreatePost(name, description, persona)

创建 Bot

### Example

```ts
import {
  Configuration,
  BotsApi,
} from '';
import type { CreateBotApiV1BotsCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BotsApi(config);

  const body = {
    // string
    name: name_example,
    // string (optional)
    description: description_example,
    // string | Bot 人设描述 (optional)
    persona: persona_example,
  } satisfies CreateBotApiV1BotsCreatePostRequest;

  try {
    const data = await api.createBotApiV1BotsCreatePost(body);
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
| **description** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **persona** | `string` | Bot 人设描述 | [Optional] [Defaults to `&#39;&#39;`] |

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


## deleteBotApiV1BotsDeletePost

> any deleteBotApiV1BotsDeletePost(botId)

删除 Bot

### Example

```ts
import {
  Configuration,
  BotsApi,
} from '';
import type { DeleteBotApiV1BotsDeletePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BotsApi(config);

  const body = {
    // string
    botId: botId_example,
  } satisfies DeleteBotApiV1BotsDeletePostRequest;

  try {
    const data = await api.deleteBotApiV1BotsDeletePost(body);
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
| **botId** | `string` |  | [Defaults to `undefined`] |

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


## getBotApiV1BotsBotIdGet

> any getBotApiV1BotsBotIdGet(botId)

Bot 详情

### Example

```ts
import {
  Configuration,
  BotsApi,
} from '';
import type { GetBotApiV1BotsBotIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BotsApi(config);

  const body = {
    // string
    botId: botId_example,
  } satisfies GetBotApiV1BotsBotIdGetRequest;

  try {
    const data = await api.getBotApiV1BotsBotIdGet(body);
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
| **botId** | `string` |  | [Defaults to `undefined`] |

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


## listBotsApiV1BotsListGet

> any listBotsApiV1BotsListGet(page, pageSize, spaceId)

Bot 列表

### Example

```ts
import {
  Configuration,
  BotsApi,
} from '';
import type { ListBotsApiV1BotsListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BotsApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    pageSize: 56,
    // string | 空间 ID，默认使用 settings.COZE_ACCOUNT_ID (optional)
    spaceId: spaceId_example,
  } satisfies ListBotsApiV1BotsListGetRequest;

  try {
    const data = await api.listBotsApiV1BotsListGet(body);
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
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `20`] |
| **spaceId** | `string` | 空间 ID，默认使用 settings.COZE_ACCOUNT_ID | [Optional] [Defaults to `&#39;&#39;`] |

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


## listDatasetsApiV1BotsDatasetsListGet

> any listDatasetsApiV1BotsDatasetsListGet(page, pageSize)

Bot 关联知识库列表

### Example

```ts
import {
  Configuration,
  BotsApi,
} from '';
import type { ListDatasetsApiV1BotsDatasetsListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BotsApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    pageSize: 56,
  } satisfies ListDatasetsApiV1BotsDatasetsListGetRequest;

  try {
    const data = await api.listDatasetsApiV1BotsDatasetsListGet(body);
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
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `20`] |

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


## publishBotApiV1BotsPublishPost

> any publishBotApiV1BotsPublishPost(botId, version)

发布 Bot

### Example

```ts
import {
  Configuration,
  BotsApi,
} from '';
import type { PublishBotApiV1BotsPublishPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BotsApi(config);

  const body = {
    // string
    botId: botId_example,
    // string (optional)
    version: version_example,
  } satisfies PublishBotApiV1BotsPublishPostRequest;

  try {
    const data = await api.publishBotApiV1BotsPublishPost(body);
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
| **botId** | `string` |  | [Defaults to `undefined`] |
| **version** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |

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


## updateBotApiV1BotsUpdatePost

> any updateBotApiV1BotsUpdatePost(botId, name, description, persona)

更新 Bot

### Example

```ts
import {
  Configuration,
  BotsApi,
} from '';
import type { UpdateBotApiV1BotsUpdatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BotsApi(config);

  const body = {
    // string
    botId: botId_example,
    // string (optional)
    name: name_example,
    // string (optional)
    description: description_example,
    // string (optional)
    persona: persona_example,
  } satisfies UpdateBotApiV1BotsUpdatePostRequest;

  try {
    const data = await api.updateBotApiV1BotsUpdatePost(body);
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
| **botId** | `string` |  | [Defaults to `undefined`] |
| **name** | `string` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **persona** | `string` |  | [Optional] [Defaults to `undefined`] |

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

