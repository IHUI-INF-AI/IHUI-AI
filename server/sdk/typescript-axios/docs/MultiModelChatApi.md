# MultiModelChatApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**listVendorsApiV1ChatVendorsGet**](#listvendorsapiv1chatvendorsget) | **GET** /api/v1/chat/vendors | 列出支持的 AI 厂商|
|[**multiVendorChatApiV1ChatMultiPost**](#multivendorchatapiv1chatmultipost) | **POST** /api/v1/chat/multi | 同时调用多个厂商并返回结果列表（用于对比评测）|
|[**vendorChatApiV1ChatVendorChatPost**](#vendorchatapiv1chatvendorchatpost) | **POST** /api/v1/chat/{vendor}/chat | 多厂商同步聊天|
|[**vendorChatStreamApiV1ChatVendorChatStreamPost**](#vendorchatstreamapiv1chatvendorchatstreampost) | **POST** /api/v1/chat/{vendor}/chat/stream | 多厂商流式聊天（SSE）|

# **listVendorsApiV1ChatVendorsGet**
> any listVendorsApiV1ChatVendorsGet()


### Example

```typescript
import {
    MultiModelChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MultiModelChatApi(configuration);

const { status, data } = await apiInstance.listVendorsApiV1ChatVendorsGet();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **multiVendorChatApiV1ChatMultiPost**
> any multiVendorChatApiV1ChatMultiPost()


### Example

```typescript
import {
    MultiModelChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MultiModelChatApi(configuration);

let vendors: string; //逗号分隔的厂商列表，如 zhipu,openrouter (default to undefined)
let message: string; // (default to undefined)
let model: string; // (optional) (default to 'gpt-3.5-turbo')

const { status, data } = await apiInstance.multiVendorChatApiV1ChatMultiPost(
    vendors,
    message,
    model
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **vendors** | [**string**] | 逗号分隔的厂商列表，如 zhipu,openrouter | defaults to undefined|
| **message** | [**string**] |  | defaults to undefined|
| **model** | [**string**] |  | (optional) defaults to 'gpt-3.5-turbo'|


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

# **vendorChatApiV1ChatVendorChatPost**
> any vendorChatApiV1ChatVendorChatPost()


### Example

```typescript
import {
    MultiModelChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MultiModelChatApi(configuration);

let vendor: string; // (default to undefined)
let model: string; // (default to undefined)
let message: string; // (default to undefined)

const { status, data } = await apiInstance.vendorChatApiV1ChatVendorChatPost(
    vendor,
    model,
    message
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **vendor** | [**string**] |  | defaults to undefined|
| **model** | [**string**] |  | defaults to undefined|
| **message** | [**string**] |  | defaults to undefined|


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

# **vendorChatStreamApiV1ChatVendorChatStreamPost**
> any vendorChatStreamApiV1ChatVendorChatStreamPost()


### Example

```typescript
import {
    MultiModelChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MultiModelChatApi(configuration);

let vendor: string; // (default to undefined)
let model: string; // (default to undefined)
let message: string; // (default to undefined)

const { status, data } = await apiInstance.vendorChatStreamApiV1ChatVendorChatStreamPost(
    vendor,
    model,
    message
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **vendor** | [**string**] |  | defaults to undefined|
| **model** | [**string**] |  | defaults to undefined|
| **message** | [**string**] |  | defaults to undefined|


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

