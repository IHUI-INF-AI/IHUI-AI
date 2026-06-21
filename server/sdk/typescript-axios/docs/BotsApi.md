# BotsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createBotApiV1BotsCreatePost**](#createbotapiv1botscreatepost) | **POST** /api/v1/bots/create | 创建 Bot|
|[**deleteBotApiV1BotsDeletePost**](#deletebotapiv1botsdeletepost) | **POST** /api/v1/bots/delete | 删除 Bot|
|[**getBotApiV1BotsBotIdGet**](#getbotapiv1botsbotidget) | **GET** /api/v1/bots/{bot_id} | Bot 详情|
|[**listBotsApiV1BotsListGet**](#listbotsapiv1botslistget) | **GET** /api/v1/bots/list | Bot 列表|
|[**listDatasetsApiV1BotsDatasetsListGet**](#listdatasetsapiv1botsdatasetslistget) | **GET** /api/v1/bots/datasets/list | Bot 关联知识库列表|
|[**publishBotApiV1BotsPublishPost**](#publishbotapiv1botspublishpost) | **POST** /api/v1/bots/publish | 发布 Bot|
|[**updateBotApiV1BotsUpdatePost**](#updatebotapiv1botsupdatepost) | **POST** /api/v1/bots/update | 更新 Bot|

# **createBotApiV1BotsCreatePost**
> any createBotApiV1BotsCreatePost()


### Example

```typescript
import {
    BotsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BotsApi(configuration);

let name: string; // (default to undefined)
let description: string; // (optional) (default to '')
let persona: string; //Bot 人设描述 (optional) (default to '')

const { status, data } = await apiInstance.createBotApiV1BotsCreatePost(
    name,
    description,
    persona
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to ''|
| **persona** | [**string**] | Bot 人设描述 | (optional) defaults to ''|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteBotApiV1BotsDeletePost**
> any deleteBotApiV1BotsDeletePost()


### Example

```typescript
import {
    BotsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BotsApi(configuration);

let botId: string; // (default to undefined)

const { status, data } = await apiInstance.deleteBotApiV1BotsDeletePost(
    botId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **botId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getBotApiV1BotsBotIdGet**
> any getBotApiV1BotsBotIdGet()


### Example

```typescript
import {
    BotsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BotsApi(configuration);

let botId: string; // (default to undefined)

const { status, data } = await apiInstance.getBotApiV1BotsBotIdGet(
    botId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **botId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listBotsApiV1BotsListGet**
> any listBotsApiV1BotsListGet()


### Example

```typescript
import {
    BotsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BotsApi(configuration);

let page: number; // (optional) (default to 1)
let pageSize: number; // (optional) (default to 20)
let spaceId: string; //空间 ID，默认使用 settings.COZE_ACCOUNT_ID (optional) (default to '')

const { status, data } = await apiInstance.listBotsApiV1BotsListGet(
    page,
    pageSize,
    spaceId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **pageSize** | [**number**] |  | (optional) defaults to 20|
| **spaceId** | [**string**] | 空间 ID，默认使用 settings.COZE_ACCOUNT_ID | (optional) defaults to ''|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listDatasetsApiV1BotsDatasetsListGet**
> any listDatasetsApiV1BotsDatasetsListGet()


### Example

```typescript
import {
    BotsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BotsApi(configuration);

let page: number; // (optional) (default to 1)
let pageSize: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listDatasetsApiV1BotsDatasetsListGet(
    page,
    pageSize
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **pageSize** | [**number**] |  | (optional) defaults to 20|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **publishBotApiV1BotsPublishPost**
> any publishBotApiV1BotsPublishPost()


### Example

```typescript
import {
    BotsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BotsApi(configuration);

let botId: string; // (default to undefined)
let version: string; // (optional) (default to '')

const { status, data } = await apiInstance.publishBotApiV1BotsPublishPost(
    botId,
    version
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **botId** | [**string**] |  | defaults to undefined|
| **version** | [**string**] |  | (optional) defaults to ''|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateBotApiV1BotsUpdatePost**
> any updateBotApiV1BotsUpdatePost()


### Example

```typescript
import {
    BotsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BotsApi(configuration);

let botId: string; // (default to undefined)
let name: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)
let persona: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateBotApiV1BotsUpdatePost(
    botId,
    name,
    description,
    persona
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **botId** | [**string**] |  | defaults to undefined|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **persona** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

