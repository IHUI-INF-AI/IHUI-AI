# AIJimengApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**jimeng4ImageApiV1AiJimeng4Post**](#jimeng4imageapiv1aijimeng4post) | **POST** /api/v1/ai/jimeng4 | 即梦 4.0 文字生成图片（兼容旧路径）|

# **jimeng4ImageApiV1AiJimeng4Post**
> any jimeng4ImageApiV1AiJimeng4Post(jimeng4ImageRequest)

Submit a JiMeng 4.0 image generation task via CVSync2Async, poll until complete, and return image URLs / base64 data.

### Example

```typescript
import {
    AIJimengApi,
    Configuration,
    Jimeng4ImageRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIJimengApi(configuration);

let jimeng4ImageRequest: Jimeng4ImageRequest; //

const { status, data } = await apiInstance.jimeng4ImageApiV1AiJimeng4Post(
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

