# CallbackApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**callCallbackApiV1CallbackCallPost**](#callcallbackapiv1callbackcallpost) | **POST** /api/v1/callback/call | 外呼回调|
|[**callCallbackApiV1CallbackCallPost_0**](#callcallbackapiv1callbackcallpost_0) | **POST** /api/v1/callback/call | 外呼回调|
|[**callbackLogList**](#callbackloglist) | **GET** /api/v1/callback/log/list | 回调日志|
|[**callbackLogList_0**](#callbackloglist_0) | **GET** /api/v1/callback/log/list | 回调日志|
|[**logDetailApiV1CallbackLogLidGet**](#logdetailapiv1callbackloglidget) | **GET** /api/v1/callback/log/{lid} | 回调详情|
|[**logDetailApiV1CallbackLogLidGet_0**](#logdetailapiv1callbackloglidget_0) | **GET** /api/v1/callback/log/{lid} | 回调详情|
|[**paymentCallbackApiV1CallbackPaymentPost**](#paymentcallbackapiv1callbackpaymentpost) | **POST** /api/v1/callback/payment | 支付回调|
|[**paymentCallbackApiV1CallbackPaymentPost_0**](#paymentcallbackapiv1callbackpaymentpost_0) | **POST** /api/v1/callback/payment | 支付回调|
|[**smsCallbackApiV1CallbackSmsPost**](#smscallbackapiv1callbacksmspost) | **POST** /api/v1/callback/sms | 短信回调|
|[**smsCallbackApiV1CallbackSmsPost_0**](#smscallbackapiv1callbacksmspost_0) | **POST** /api/v1/callback/sms | 短信回调|

# **callCallbackApiV1CallbackCallPost**
> any callCallbackApiV1CallbackCallPost()


### Example

```typescript
import {
    CallbackApi,
    Configuration,
    BodyCallCallbackApiV1CallbackCallPost
} from './api';

const configuration = new Configuration();
const apiInstance = new CallbackApi(configuration);

let bizId: string; // (optional) (default to undefined)
let bizType: string; // (optional) (default to 'call')
let source: string; // (optional) (default to undefined)
let bodyCallCallbackApiV1CallbackCallPost: BodyCallCallbackApiV1CallbackCallPost; // (optional)

const { status, data } = await apiInstance.callCallbackApiV1CallbackCallPost(
    bizId,
    bizType,
    source,
    bodyCallCallbackApiV1CallbackCallPost
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyCallCallbackApiV1CallbackCallPost** | **BodyCallCallbackApiV1CallbackCallPost**|  | |
| **bizId** | [**string**] |  | (optional) defaults to undefined|
| **bizType** | [**string**] |  | (optional) defaults to 'call'|
| **source** | [**string**] |  | (optional) defaults to undefined|


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

# **callCallbackApiV1CallbackCallPost_0**
> any callCallbackApiV1CallbackCallPost_0()


### Example

```typescript
import {
    CallbackApi,
    Configuration,
    BodyCallCallbackApiV1CallbackCallPost
} from './api';

const configuration = new Configuration();
const apiInstance = new CallbackApi(configuration);

let bizId: string; // (optional) (default to undefined)
let bizType: string; // (optional) (default to 'call')
let source: string; // (optional) (default to undefined)
let bodyCallCallbackApiV1CallbackCallPost: BodyCallCallbackApiV1CallbackCallPost; // (optional)

const { status, data } = await apiInstance.callCallbackApiV1CallbackCallPost_0(
    bizId,
    bizType,
    source,
    bodyCallCallbackApiV1CallbackCallPost
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyCallCallbackApiV1CallbackCallPost** | **BodyCallCallbackApiV1CallbackCallPost**|  | |
| **bizId** | [**string**] |  | (optional) defaults to undefined|
| **bizType** | [**string**] |  | (optional) defaults to 'call'|
| **source** | [**string**] |  | (optional) defaults to undefined|


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

# **callbackLogList**
> any callbackLogList()


### Example

```typescript
import {
    CallbackApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CallbackApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let bizType: string; // (optional) (default to undefined)
let source: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.callbackLogList(
    page,
    limit,
    bizType,
    source,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **bizType** | [**string**] |  | (optional) defaults to undefined|
| **source** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|


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

# **callbackLogList_0**
> any callbackLogList_0()


### Example

```typescript
import {
    CallbackApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CallbackApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let bizType: string; // (optional) (default to undefined)
let source: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.callbackLogList_0(
    page,
    limit,
    bizType,
    source,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **bizType** | [**string**] |  | (optional) defaults to undefined|
| **source** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|


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

# **logDetailApiV1CallbackLogLidGet**
> any logDetailApiV1CallbackLogLidGet()


### Example

```typescript
import {
    CallbackApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CallbackApi(configuration);

let lid: number; // (default to undefined)

const { status, data } = await apiInstance.logDetailApiV1CallbackLogLidGet(
    lid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **lid** | [**number**] |  | defaults to undefined|


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

# **logDetailApiV1CallbackLogLidGet_0**
> any logDetailApiV1CallbackLogLidGet_0()


### Example

```typescript
import {
    CallbackApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CallbackApi(configuration);

let lid: number; // (default to undefined)

const { status, data } = await apiInstance.logDetailApiV1CallbackLogLidGet_0(
    lid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **lid** | [**number**] |  | defaults to undefined|


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

# **paymentCallbackApiV1CallbackPaymentPost**
> any paymentCallbackApiV1CallbackPaymentPost()


### Example

```typescript
import {
    CallbackApi,
    Configuration,
    BodyPaymentCallbackApiV1CallbackPaymentPost
} from './api';

const configuration = new Configuration();
const apiInstance = new CallbackApi(configuration);

let bizId: string; // (optional) (default to undefined)
let bodyPaymentCallbackApiV1CallbackPaymentPost: BodyPaymentCallbackApiV1CallbackPaymentPost; // (optional)

const { status, data } = await apiInstance.paymentCallbackApiV1CallbackPaymentPost(
    bizId,
    bodyPaymentCallbackApiV1CallbackPaymentPost
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyPaymentCallbackApiV1CallbackPaymentPost** | **BodyPaymentCallbackApiV1CallbackPaymentPost**|  | |
| **bizId** | [**string**] |  | (optional) defaults to undefined|


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

# **paymentCallbackApiV1CallbackPaymentPost_0**
> any paymentCallbackApiV1CallbackPaymentPost_0()


### Example

```typescript
import {
    CallbackApi,
    Configuration,
    BodyPaymentCallbackApiV1CallbackPaymentPost
} from './api';

const configuration = new Configuration();
const apiInstance = new CallbackApi(configuration);

let bizId: string; // (optional) (default to undefined)
let bodyPaymentCallbackApiV1CallbackPaymentPost: BodyPaymentCallbackApiV1CallbackPaymentPost; // (optional)

const { status, data } = await apiInstance.paymentCallbackApiV1CallbackPaymentPost_0(
    bizId,
    bodyPaymentCallbackApiV1CallbackPaymentPost
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyPaymentCallbackApiV1CallbackPaymentPost** | **BodyPaymentCallbackApiV1CallbackPaymentPost**|  | |
| **bizId** | [**string**] |  | (optional) defaults to undefined|


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

# **smsCallbackApiV1CallbackSmsPost**
> any smsCallbackApiV1CallbackSmsPost()


### Example

```typescript
import {
    CallbackApi,
    Configuration,
    BodySmsCallbackApiV1CallbackSmsPost
} from './api';

const configuration = new Configuration();
const apiInstance = new CallbackApi(configuration);

let bizId: string; // (optional) (default to undefined)
let bodySmsCallbackApiV1CallbackSmsPost: BodySmsCallbackApiV1CallbackSmsPost; // (optional)

const { status, data } = await apiInstance.smsCallbackApiV1CallbackSmsPost(
    bizId,
    bodySmsCallbackApiV1CallbackSmsPost
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodySmsCallbackApiV1CallbackSmsPost** | **BodySmsCallbackApiV1CallbackSmsPost**|  | |
| **bizId** | [**string**] |  | (optional) defaults to undefined|


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

# **smsCallbackApiV1CallbackSmsPost_0**
> any smsCallbackApiV1CallbackSmsPost_0()


### Example

```typescript
import {
    CallbackApi,
    Configuration,
    BodySmsCallbackApiV1CallbackSmsPost
} from './api';

const configuration = new Configuration();
const apiInstance = new CallbackApi(configuration);

let bizId: string; // (optional) (default to undefined)
let bodySmsCallbackApiV1CallbackSmsPost: BodySmsCallbackApiV1CallbackSmsPost; // (optional)

const { status, data } = await apiInstance.smsCallbackApiV1CallbackSmsPost_0(
    bizId,
    bodySmsCallbackApiV1CallbackSmsPost
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodySmsCallbackApiV1CallbackSmsPost** | **BodySmsCallbackApiV1CallbackSmsPost**|  | |
| **bizId** | [**string**] |  | (optional) defaults to undefined|


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

