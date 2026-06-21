# CozeAudioApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**chatAudioApiV1CozeAudioAudioChatAudioPost**](#chataudioapiv1cozeaudioaudiochataudiopost) | **POST** /api/v1/coze/audio/audio/chat-audio | Chat Audio|
|[**chatAudioApiV1CozeAudioAudioChatAudioPost_0**](#chataudioapiv1cozeaudioaudiochataudiopost_0) | **POST** /api/v1/coze/audio/audio/chat-audio | Chat Audio|
|[**createSpeechApiV1CozeAudioAudioSpeechPost**](#createspeechapiv1cozeaudioaudiospeechpost) | **POST** /api/v1/coze/audio/audio/speech | Create Speech|
|[**createSpeechApiV1CozeAudioAudioSpeechPost_0**](#createspeechapiv1cozeaudioaudiospeechpost_0) | **POST** /api/v1/coze/audio/audio/speech | Create Speech|
|[**createVoiceprintApiV1CozeAudioAudioVoiceprintsPost**](#createvoiceprintapiv1cozeaudioaudiovoiceprintspost) | **POST** /api/v1/coze/audio/audio/voiceprints | Create Voiceprint|
|[**createVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0**](#createvoiceprintapiv1cozeaudioaudiovoiceprintspost_0) | **POST** /api/v1/coze/audio/audio/voiceprints | Create Voiceprint|
|[**deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete**](#deletevoiceprintapiv1cozeaudioaudiovoiceprintsdelete) | **DELETE** /api/v1/coze/audio/audio/voiceprints | Delete Voiceprint|
|[**deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0**](#deletevoiceprintapiv1cozeaudioaudiovoiceprintsdelete_0) | **DELETE** /api/v1/coze/audio/audio/voiceprints | Delete Voiceprint|
|[**listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet**](#listvoiceprintsapiv1cozeaudioaudiovoiceprintsget) | **GET** /api/v1/coze/audio/audio/voiceprints | List Voiceprints|
|[**listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0**](#listvoiceprintsapiv1cozeaudioaudiovoiceprintsget_0) | **GET** /api/v1/coze/audio/audio/voiceprints | List Voiceprints|
|[**listVoicesApiV1CozeAudioAudioVoicesGet**](#listvoicesapiv1cozeaudioaudiovoicesget) | **GET** /api/v1/coze/audio/audio/voices | List Voices|
|[**listVoicesApiV1CozeAudioAudioVoicesGet_0**](#listvoicesapiv1cozeaudioaudiovoicesget_0) | **GET** /api/v1/coze/audio/audio/voices | List Voices|
|[**updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut**](#updatevoiceprintapiv1cozeaudioaudiovoiceprintsput) | **PUT** /api/v1/coze/audio/audio/voiceprints | Update Voiceprint|
|[**updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0**](#updatevoiceprintapiv1cozeaudioaudiovoiceprintsput_0) | **PUT** /api/v1/coze/audio/audio/voiceprints | Update Voiceprint|

# **chatAudioApiV1CozeAudioAudioChatAudioPost**
> any chatAudioApiV1CozeAudioAudioChatAudioPost(chatAudioReq)


### Example

```typescript
import {
    CozeAudioApi,
    Configuration,
    ChatAudioReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAudioApi(configuration);

let chatAudioReq: ChatAudioReq; //

const { status, data } = await apiInstance.chatAudioApiV1CozeAudioAudioChatAudioPost(
    chatAudioReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **chatAudioReq** | **ChatAudioReq**|  | |


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

# **chatAudioApiV1CozeAudioAudioChatAudioPost_0**
> any chatAudioApiV1CozeAudioAudioChatAudioPost_0(chatAudioReq)


### Example

```typescript
import {
    CozeAudioApi,
    Configuration,
    ChatAudioReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAudioApi(configuration);

let chatAudioReq: ChatAudioReq; //

const { status, data } = await apiInstance.chatAudioApiV1CozeAudioAudioChatAudioPost_0(
    chatAudioReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **chatAudioReq** | **ChatAudioReq**|  | |


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

# **createSpeechApiV1CozeAudioAudioSpeechPost**
> any createSpeechApiV1CozeAudioAudioSpeechPost(speechReq)


### Example

```typescript
import {
    CozeAudioApi,
    Configuration,
    SpeechReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAudioApi(configuration);

let speechReq: SpeechReq; //

const { status, data } = await apiInstance.createSpeechApiV1CozeAudioAudioSpeechPost(
    speechReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **speechReq** | **SpeechReq**|  | |


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

# **createSpeechApiV1CozeAudioAudioSpeechPost_0**
> any createSpeechApiV1CozeAudioAudioSpeechPost_0(speechReq)


### Example

```typescript
import {
    CozeAudioApi,
    Configuration,
    SpeechReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAudioApi(configuration);

let speechReq: SpeechReq; //

const { status, data } = await apiInstance.createSpeechApiV1CozeAudioAudioSpeechPost_0(
    speechReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **speechReq** | **SpeechReq**|  | |


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

# **createVoiceprintApiV1CozeAudioAudioVoiceprintsPost**
> any createVoiceprintApiV1CozeAudioAudioVoiceprintsPost(voiceprintCreateReq)


### Example

```typescript
import {
    CozeAudioApi,
    Configuration,
    VoiceprintCreateReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAudioApi(configuration);

let voiceprintCreateReq: VoiceprintCreateReq; //

const { status, data } = await apiInstance.createVoiceprintApiV1CozeAudioAudioVoiceprintsPost(
    voiceprintCreateReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **voiceprintCreateReq** | **VoiceprintCreateReq**|  | |


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

# **createVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0**
> any createVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0(voiceprintCreateReq)


### Example

```typescript
import {
    CozeAudioApi,
    Configuration,
    VoiceprintCreateReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAudioApi(configuration);

let voiceprintCreateReq: VoiceprintCreateReq; //

const { status, data } = await apiInstance.createVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0(
    voiceprintCreateReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **voiceprintCreateReq** | **VoiceprintCreateReq**|  | |


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

# **deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete**
> any deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete(voiceprintDeleteReq)


### Example

```typescript
import {
    CozeAudioApi,
    Configuration,
    VoiceprintDeleteReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAudioApi(configuration);

let voiceprintDeleteReq: VoiceprintDeleteReq; //

const { status, data } = await apiInstance.deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete(
    voiceprintDeleteReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **voiceprintDeleteReq** | **VoiceprintDeleteReq**|  | |


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

# **deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0**
> any deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0(voiceprintDeleteReq)


### Example

```typescript
import {
    CozeAudioApi,
    Configuration,
    VoiceprintDeleteReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAudioApi(configuration);

let voiceprintDeleteReq: VoiceprintDeleteReq; //

const { status, data } = await apiInstance.deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0(
    voiceprintDeleteReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **voiceprintDeleteReq** | **VoiceprintDeleteReq**|  | |


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

# **listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet**
> any listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet()


### Example

```typescript
import {
    CozeAudioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAudioApi(configuration);

const { status, data } = await apiInstance.listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet();
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

# **listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0**
> any listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0()


### Example

```typescript
import {
    CozeAudioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAudioApi(configuration);

const { status, data } = await apiInstance.listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0();
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

# **listVoicesApiV1CozeAudioAudioVoicesGet**
> any listVoicesApiV1CozeAudioAudioVoicesGet()


### Example

```typescript
import {
    CozeAudioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAudioApi(configuration);

let filterType: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listVoicesApiV1CozeAudioAudioVoicesGet(
    filterType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **filterType** | [**string**] |  | (optional) defaults to undefined|


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
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listVoicesApiV1CozeAudioAudioVoicesGet_0**
> any listVoicesApiV1CozeAudioAudioVoicesGet_0()


### Example

```typescript
import {
    CozeAudioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAudioApi(configuration);

let filterType: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listVoicesApiV1CozeAudioAudioVoicesGet_0(
    filterType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **filterType** | [**string**] |  | (optional) defaults to undefined|


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
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut**
> any updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut(voiceprintUpdateReq)


### Example

```typescript
import {
    CozeAudioApi,
    Configuration,
    VoiceprintUpdateReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAudioApi(configuration);

let voiceprintUpdateReq: VoiceprintUpdateReq; //

const { status, data } = await apiInstance.updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut(
    voiceprintUpdateReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **voiceprintUpdateReq** | **VoiceprintUpdateReq**|  | |


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

# **updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0**
> any updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0(voiceprintUpdateReq)


### Example

```typescript
import {
    CozeAudioApi,
    Configuration,
    VoiceprintUpdateReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeAudioApi(configuration);

let voiceprintUpdateReq: VoiceprintUpdateReq; //

const { status, data } = await apiInstance.updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0(
    voiceprintUpdateReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **voiceprintUpdateReq** | **VoiceprintUpdateReq**|  | |


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

