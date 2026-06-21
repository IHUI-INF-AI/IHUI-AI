# UserModelChatApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**imageApiV1UserModelChatImagePost**](#imageapiv1usermodelchatimagepost) | **POST** /api/v1/user-model-chat/image | AI模型生图|
|[**imageApiV1UserModelChatImagePost_0**](#imageapiv1usermodelchatimagepost_0) | **POST** /api/v1/user-model-chat/image | AI模型生图|
|[**listModelsApiV1UserModelChatListGet**](#listmodelsapiv1usermodelchatlistget) | **GET** /api/v1/user-model-chat/list | 可用模型列表|
|[**listModelsApiV1UserModelChatListGet_0**](#listmodelsapiv1usermodelchatlistget_0) | **GET** /api/v1/user-model-chat/list | 可用模型列表|
|[**userModelChatChat**](#usermodelchatchat) | **POST** /api/v1/user-model-chat/chat | AI模型对话|
|[**userModelChatChat_0**](#usermodelchatchat_0) | **POST** /api/v1/user-model-chat/chat | AI模型对话|

# **imageApiV1UserModelChatImagePost**
> any imageApiV1UserModelChatImagePost(bodyImageApiV1UserModelChatImagePost)


### Example

```typescript
import {
    UserModelChatApi,
    Configuration,
    BodyImageApiV1UserModelChatImagePost
} from './api';

const configuration = new Configuration();
const apiInstance = new UserModelChatApi(configuration);

let bodyImageApiV1UserModelChatImagePost: BodyImageApiV1UserModelChatImagePost; //
let apiKey: string; // (optional) (default to undefined)
let apiBase: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.imageApiV1UserModelChatImagePost(
    bodyImageApiV1UserModelChatImagePost,
    apiKey,
    apiBase
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyImageApiV1UserModelChatImagePost** | **BodyImageApiV1UserModelChatImagePost**|  | |
| **apiKey** | [**string**] |  | (optional) defaults to undefined|
| **apiBase** | [**string**] |  | (optional) defaults to undefined|


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

# **imageApiV1UserModelChatImagePost_0**
> any imageApiV1UserModelChatImagePost_0(bodyImageApiV1UserModelChatImagePost)


### Example

```typescript
import {
    UserModelChatApi,
    Configuration,
    BodyImageApiV1UserModelChatImagePost
} from './api';

const configuration = new Configuration();
const apiInstance = new UserModelChatApi(configuration);

let bodyImageApiV1UserModelChatImagePost: BodyImageApiV1UserModelChatImagePost; //
let apiKey: string; // (optional) (default to undefined)
let apiBase: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.imageApiV1UserModelChatImagePost_0(
    bodyImageApiV1UserModelChatImagePost,
    apiKey,
    apiBase
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyImageApiV1UserModelChatImagePost** | **BodyImageApiV1UserModelChatImagePost**|  | |
| **apiKey** | [**string**] |  | (optional) defaults to undefined|
| **apiBase** | [**string**] |  | (optional) defaults to undefined|


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

# **listModelsApiV1UserModelChatListGet**
> any listModelsApiV1UserModelChatListGet()

获取支持的AI模型列表

### Example

```typescript
import {
    UserModelChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserModelChatApi(configuration);

const { status, data } = await apiInstance.listModelsApiV1UserModelChatListGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listModelsApiV1UserModelChatListGet_0**
> any listModelsApiV1UserModelChatListGet_0()

获取支持的AI模型列表

### Example

```typescript
import {
    UserModelChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserModelChatApi(configuration);

const { status, data } = await apiInstance.listModelsApiV1UserModelChatListGet_0();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userModelChatChat**
> any userModelChatChat(bodyUserModelChatChat)

用户直接调用AI模型对话（不绑定Agent）

### Example

```typescript
import {
    UserModelChatApi,
    Configuration,
    BodyUserModelChatChat
} from './api';

const configuration = new Configuration();
const apiInstance = new UserModelChatApi(configuration);

let bodyUserModelChatChat: BodyUserModelChatChat; //
let apiKey: string; // (optional) (default to undefined)
let apiBase: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.userModelChatChat(
    bodyUserModelChatChat,
    apiKey,
    apiBase
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyUserModelChatChat** | **BodyUserModelChatChat**|  | |
| **apiKey** | [**string**] |  | (optional) defaults to undefined|
| **apiBase** | [**string**] |  | (optional) defaults to undefined|


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

# **userModelChatChat_0**
> any userModelChatChat_0(bodyUserModelChatChat)

用户直接调用AI模型对话（不绑定Agent）

### Example

```typescript
import {
    UserModelChatApi,
    Configuration,
    BodyUserModelChatChat
} from './api';

const configuration = new Configuration();
const apiInstance = new UserModelChatApi(configuration);

let bodyUserModelChatChat: BodyUserModelChatChat; //
let apiKey: string; // (optional) (default to undefined)
let apiBase: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.userModelChatChat_0(
    bodyUserModelChatChat,
    apiKey,
    apiBase
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyUserModelChatChat** | **BodyUserModelChatChat**|  | |
| **apiKey** | [**string**] |  | (optional) defaults to undefined|
| **apiBase** | [**string**] |  | (optional) defaults to undefined|


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

