# CozeChatAudioApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost**](#onetooneaudioapiv1cozechataudiochataudioonetoonepost) | **POST** /api/v1/coze/chat-audio/chat-audio/one-to-one | One To One Audio|
|[**oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0**](#onetooneaudioapiv1cozechataudiochataudioonetoonepost_0) | **POST** /api/v1/coze/chat-audio/chat-audio/one-to-one | One To One Audio|
|[**pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost**](#pluginaudiochatapiv1cozechataudiochataudiopluginpost) | **POST** /api/v1/coze/chat-audio/chat-audio/plugin | Plugin Audio Chat|
|[**pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0**](#pluginaudiochatapiv1cozechataudiochataudiopluginpost_0) | **POST** /api/v1/coze/chat-audio/chat-audio/plugin | Plugin Audio Chat|
|[**simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost**](#simpleaudiochatapiv1cozechataudiochataudiosimplepost) | **POST** /api/v1/coze/chat-audio/chat-audio/simple | Simple Audio Chat|
|[**simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0**](#simpleaudiochatapiv1cozechataudiochataudiosimplepost_0) | **POST** /api/v1/coze/chat-audio/chat-audio/simple | Simple Audio Chat|

# **oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost**
> any oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost(oneToOneAudioReq)


### Example

```typescript
import {
    CozeChatAudioApi,
    Configuration,
    OneToOneAudioReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeChatAudioApi(configuration);

let oneToOneAudioReq: OneToOneAudioReq; //

const { status, data } = await apiInstance.oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost(
    oneToOneAudioReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **oneToOneAudioReq** | **OneToOneAudioReq**|  | |


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

# **oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0**
> any oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0(oneToOneAudioReq)


### Example

```typescript
import {
    CozeChatAudioApi,
    Configuration,
    OneToOneAudioReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeChatAudioApi(configuration);

let oneToOneAudioReq: OneToOneAudioReq; //

const { status, data } = await apiInstance.oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0(
    oneToOneAudioReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **oneToOneAudioReq** | **OneToOneAudioReq**|  | |


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

# **pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost**
> any pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost(pluginAudioReq)


### Example

```typescript
import {
    CozeChatAudioApi,
    Configuration,
    PluginAudioReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeChatAudioApi(configuration);

let pluginAudioReq: PluginAudioReq; //

const { status, data } = await apiInstance.pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost(
    pluginAudioReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pluginAudioReq** | **PluginAudioReq**|  | |


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

# **pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0**
> any pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0(pluginAudioReq)


### Example

```typescript
import {
    CozeChatAudioApi,
    Configuration,
    PluginAudioReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeChatAudioApi(configuration);

let pluginAudioReq: PluginAudioReq; //

const { status, data } = await apiInstance.pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0(
    pluginAudioReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pluginAudioReq** | **PluginAudioReq**|  | |


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

# **simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost**
> any simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost(simpleAudioReq)


### Example

```typescript
import {
    CozeChatAudioApi,
    Configuration,
    SimpleAudioReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeChatAudioApi(configuration);

let simpleAudioReq: SimpleAudioReq; //

const { status, data } = await apiInstance.simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost(
    simpleAudioReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **simpleAudioReq** | **SimpleAudioReq**|  | |


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

# **simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0**
> any simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0(simpleAudioReq)


### Example

```typescript
import {
    CozeChatAudioApi,
    Configuration,
    SimpleAudioReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeChatAudioApi(configuration);

let simpleAudioReq: SimpleAudioReq; //

const { status, data } = await apiInstance.simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0(
    simpleAudioReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **simpleAudioReq** | **SimpleAudioReq**|  | |


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

