# AIVolcEngineApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**jimeng31GenerateApiV1AiVolcengineJimengGeneratePost**](#jimeng31generateapiv1aivolcenginejimenggeneratepost) | **POST** /api/v1/ai/volcengine/jimeng/generate | JiMeng 3.1 generation|
|[**jimeng4ImageApiV1AiVolcengineJimengImagePost**](#jimeng4imageapiv1aivolcenginejimengimagepost) | **POST** /api/v1/ai/volcengine/jimeng/image | JiMeng 4.0 text-to-image (async)|
|[**jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost**](#jimeng4processapiv1aivolcenginejimeng4processpost) | **POST** /api/v1/ai/volcengine/jimeng4/process | 即梦4.0 CVProcess 通用转发|
|[**pingApiV1AiVolcenginePingGet**](#pingapiv1aivolcenginepingget) | **GET** /api/v1/ai/volcengine/ping | Health check|
|[**visualProxyApiV1AiVolcengineVisualReqKeyPost**](#visualproxyapiv1aivolcenginevisualreqkeypost) | **POST** /api/v1/ai/volcengine/visual/{req_key} | 火山视觉通用代理 (CVSync2Async async submit+poll)|

# **jimeng31GenerateApiV1AiVolcengineJimengGeneratePost**
> any jimeng31GenerateApiV1AiVolcengineJimengGeneratePost(jimeng31Request)

Proxy a JiMeng 3.1 generation request via CVProcess.

### Example

```typescript
import {
    AIVolcEngineApi,
    Configuration,
    Jimeng31Request
} from './api';

const configuration = new Configuration();
const apiInstance = new AIVolcEngineApi(configuration);

let jimeng31Request: Jimeng31Request; //

const { status, data } = await apiInstance.jimeng31GenerateApiV1AiVolcengineJimengGeneratePost(
    jimeng31Request
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **jimeng31Request** | **Jimeng31Request**|  | |


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

# **jimeng4ImageApiV1AiVolcengineJimengImagePost**
> any jimeng4ImageApiV1AiVolcengineJimengImagePost(jimeng4ImageRequest)

Submit a JiMeng 4.0 image generation task via CVSync2Async, poll until complete, and return image URLs / base64 data.

### Example

```typescript
import {
    AIVolcEngineApi,
    Configuration,
    Jimeng4ImageRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIVolcEngineApi(configuration);

let jimeng4ImageRequest: Jimeng4ImageRequest; //

const { status, data } = await apiInstance.jimeng4ImageApiV1AiVolcengineJimengImagePost(
    jimeng4ImageRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **jimeng4ImageRequest** | **Jimeng4ImageRequest**|  | |


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

# **jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost**
> any jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost(jimeng4ProcessRequest)

JiMeng 4.0 CVProcess generic proxy. Forwards the body (with arbitrary extra fields) via CVProcess to Volcengine. Mirrors the original volcengine_visual_proxy.py /jimeng4/process endpoint.

### Example

```typescript
import {
    AIVolcEngineApi,
    Configuration,
    Jimeng4ProcessRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIVolcEngineApi(configuration);

let jimeng4ProcessRequest: Jimeng4ProcessRequest; //

const { status, data } = await apiInstance.jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost(
    jimeng4ProcessRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **jimeng4ProcessRequest** | **Jimeng4ProcessRequest**|  | |


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

# **pingApiV1AiVolcenginePingGet**
> any pingApiV1AiVolcenginePingGet()


### Example

```typescript
import {
    AIVolcEngineApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIVolcEngineApi(configuration);

const { status, data } = await apiInstance.pingApiV1AiVolcenginePingGet();
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

# **visualProxyApiV1AiVolcengineVisualReqKeyPost**
> any visualProxyApiV1AiVolcengineVisualReqKeyPost(visualGenericRequest)

Submit a Volcengine visual task (text-to-video, image-to-video, etc.) via CVSync2Async, poll until complete, persist the resulting video, deduct tokens, and return the video URL.  Mirrors the original volcengine_visual_proxy.py /visual/{req_key} endpoint.

### Example

```typescript
import {
    AIVolcEngineApi,
    Configuration,
    VisualGenericRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIVolcEngineApi(configuration);

let reqKey: string; // (default to undefined)
let visualGenericRequest: VisualGenericRequest; //

const { status, data } = await apiInstance.visualProxyApiV1AiVolcengineVisualReqKeyPost(
    reqKey,
    visualGenericRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **visualGenericRequest** | **VisualGenericRequest**|  | |
| **reqKey** | [**string**] |  | defaults to undefined|


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

