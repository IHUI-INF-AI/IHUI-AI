# CallbackApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**callCallbackApiV1CallbackCallPost**](CallbackApi.md#callcallbackapiv1callbackcallpost) | **POST** /api/v1/callback/call | 外呼回调 |
| [**callCallbackApiV1CallbackCallPost_0**](CallbackApi.md#callcallbackapiv1callbackcallpost_0) | **POST** /api/v1/callback/call | 外呼回调 |
| [**callbackLogList**](CallbackApi.md#callbackloglist) | **GET** /api/v1/callback/log/list | 回调日志 |
| [**callbackLogList_0**](CallbackApi.md#callbackloglist_0) | **GET** /api/v1/callback/log/list | 回调日志 |
| [**logDetailApiV1CallbackLogLidGet**](CallbackApi.md#logdetailapiv1callbackloglidget) | **GET** /api/v1/callback/log/{lid} | 回调详情 |
| [**logDetailApiV1CallbackLogLidGet_0**](CallbackApi.md#logdetailapiv1callbackloglidget_0) | **GET** /api/v1/callback/log/{lid} | 回调详情 |
| [**paymentCallbackApiV1CallbackPaymentPost**](CallbackApi.md#paymentcallbackapiv1callbackpaymentpost) | **POST** /api/v1/callback/payment | 支付回调 |
| [**paymentCallbackApiV1CallbackPaymentPost_0**](CallbackApi.md#paymentcallbackapiv1callbackpaymentpost_0) | **POST** /api/v1/callback/payment | 支付回调 |
| [**smsCallbackApiV1CallbackSmsPost**](CallbackApi.md#smscallbackapiv1callbacksmspost) | **POST** /api/v1/callback/sms | 短信回调 |
| [**smsCallbackApiV1CallbackSmsPost_0**](CallbackApi.md#smscallbackapiv1callbacksmspost_0) | **POST** /api/v1/callback/sms | 短信回调 |



## callCallbackApiV1CallbackCallPost

> any callCallbackApiV1CallbackCallPost(bizId, bizType, source, bodyCallCallbackApiV1CallbackCallPost)

外呼回调

### Example

```ts
import {
  Configuration,
  CallbackApi,
} from '';
import type { CallCallbackApiV1CallbackCallPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CallbackApi();

  const body = {
    // string (optional)
    bizId: bizId_example,
    // string (optional)
    bizType: bizType_example,
    // string (optional)
    source: source_example,
    // BodyCallCallbackApiV1CallbackCallPost (optional)
    bodyCallCallbackApiV1CallbackCallPost: ...,
  } satisfies CallCallbackApiV1CallbackCallPostRequest;

  try {
    const data = await api.callCallbackApiV1CallbackCallPost(body);
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
| **bizId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **bizType** | `string` |  | [Optional] [Defaults to `&#39;call&#39;`] |
| **source** | `string` |  | [Optional] [Defaults to `undefined`] |
| **bodyCallCallbackApiV1CallbackCallPost** | [BodyCallCallbackApiV1CallbackCallPost](BodyCallCallbackApiV1CallbackCallPost.md) |  | [Optional] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## callCallbackApiV1CallbackCallPost_0

> any callCallbackApiV1CallbackCallPost_0(bizId, bizType, source, bodyCallCallbackApiV1CallbackCallPost)

外呼回调

### Example

```ts
import {
  Configuration,
  CallbackApi,
} from '';
import type { CallCallbackApiV1CallbackCallPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CallbackApi();

  const body = {
    // string (optional)
    bizId: bizId_example,
    // string (optional)
    bizType: bizType_example,
    // string (optional)
    source: source_example,
    // BodyCallCallbackApiV1CallbackCallPost (optional)
    bodyCallCallbackApiV1CallbackCallPost: ...,
  } satisfies CallCallbackApiV1CallbackCallPost0Request;

  try {
    const data = await api.callCallbackApiV1CallbackCallPost_0(body);
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
| **bizId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **bizType** | `string` |  | [Optional] [Defaults to `&#39;call&#39;`] |
| **source** | `string` |  | [Optional] [Defaults to `undefined`] |
| **bodyCallCallbackApiV1CallbackCallPost** | [BodyCallCallbackApiV1CallbackCallPost](BodyCallCallbackApiV1CallbackCallPost.md) |  | [Optional] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## callbackLogList

> any callbackLogList(page, limit, bizType, source, status)

回调日志

### Example

```ts
import {
  Configuration,
  CallbackApi,
} from '';
import type { CallbackLogListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CallbackApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    bizType: bizType_example,
    // string (optional)
    source: source_example,
    // number (optional)
    status: 56,
  } satisfies CallbackLogListRequest;

  try {
    const data = await api.callbackLogList(body);
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
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **bizType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **source** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## callbackLogList_0

> any callbackLogList_0(page, limit, bizType, source, status)

回调日志

### Example

```ts
import {
  Configuration,
  CallbackApi,
} from '';
import type { CallbackLogList0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CallbackApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    bizType: bizType_example,
    // string (optional)
    source: source_example,
    // number (optional)
    status: 56,
  } satisfies CallbackLogList0Request;

  try {
    const data = await api.callbackLogList_0(body);
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
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **bizType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **source** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## logDetailApiV1CallbackLogLidGet

> any logDetailApiV1CallbackLogLidGet(lid)

回调详情

### Example

```ts
import {
  Configuration,
  CallbackApi,
} from '';
import type { LogDetailApiV1CallbackLogLidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CallbackApi();

  const body = {
    // number
    lid: 56,
  } satisfies LogDetailApiV1CallbackLogLidGetRequest;

  try {
    const data = await api.logDetailApiV1CallbackLogLidGet(body);
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
| **lid** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## logDetailApiV1CallbackLogLidGet_0

> any logDetailApiV1CallbackLogLidGet_0(lid)

回调详情

### Example

```ts
import {
  Configuration,
  CallbackApi,
} from '';
import type { LogDetailApiV1CallbackLogLidGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CallbackApi();

  const body = {
    // number
    lid: 56,
  } satisfies LogDetailApiV1CallbackLogLidGet0Request;

  try {
    const data = await api.logDetailApiV1CallbackLogLidGet_0(body);
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
| **lid** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## paymentCallbackApiV1CallbackPaymentPost

> any paymentCallbackApiV1CallbackPaymentPost(bizId, bodyPaymentCallbackApiV1CallbackPaymentPost)

支付回调

### Example

```ts
import {
  Configuration,
  CallbackApi,
} from '';
import type { PaymentCallbackApiV1CallbackPaymentPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CallbackApi();

  const body = {
    // string (optional)
    bizId: bizId_example,
    // BodyPaymentCallbackApiV1CallbackPaymentPost (optional)
    bodyPaymentCallbackApiV1CallbackPaymentPost: ...,
  } satisfies PaymentCallbackApiV1CallbackPaymentPostRequest;

  try {
    const data = await api.paymentCallbackApiV1CallbackPaymentPost(body);
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
| **bizId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **bodyPaymentCallbackApiV1CallbackPaymentPost** | [BodyPaymentCallbackApiV1CallbackPaymentPost](BodyPaymentCallbackApiV1CallbackPaymentPost.md) |  | [Optional] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## paymentCallbackApiV1CallbackPaymentPost_0

> any paymentCallbackApiV1CallbackPaymentPost_0(bizId, bodyPaymentCallbackApiV1CallbackPaymentPost)

支付回调

### Example

```ts
import {
  Configuration,
  CallbackApi,
} from '';
import type { PaymentCallbackApiV1CallbackPaymentPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CallbackApi();

  const body = {
    // string (optional)
    bizId: bizId_example,
    // BodyPaymentCallbackApiV1CallbackPaymentPost (optional)
    bodyPaymentCallbackApiV1CallbackPaymentPost: ...,
  } satisfies PaymentCallbackApiV1CallbackPaymentPost0Request;

  try {
    const data = await api.paymentCallbackApiV1CallbackPaymentPost_0(body);
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
| **bizId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **bodyPaymentCallbackApiV1CallbackPaymentPost** | [BodyPaymentCallbackApiV1CallbackPaymentPost](BodyPaymentCallbackApiV1CallbackPaymentPost.md) |  | [Optional] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## smsCallbackApiV1CallbackSmsPost

> any smsCallbackApiV1CallbackSmsPost(bizId, bodySmsCallbackApiV1CallbackSmsPost)

短信回调

### Example

```ts
import {
  Configuration,
  CallbackApi,
} from '';
import type { SmsCallbackApiV1CallbackSmsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CallbackApi();

  const body = {
    // string (optional)
    bizId: bizId_example,
    // BodySmsCallbackApiV1CallbackSmsPost (optional)
    bodySmsCallbackApiV1CallbackSmsPost: ...,
  } satisfies SmsCallbackApiV1CallbackSmsPostRequest;

  try {
    const data = await api.smsCallbackApiV1CallbackSmsPost(body);
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
| **bizId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **bodySmsCallbackApiV1CallbackSmsPost** | [BodySmsCallbackApiV1CallbackSmsPost](BodySmsCallbackApiV1CallbackSmsPost.md) |  | [Optional] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## smsCallbackApiV1CallbackSmsPost_0

> any smsCallbackApiV1CallbackSmsPost_0(bizId, bodySmsCallbackApiV1CallbackSmsPost)

短信回调

### Example

```ts
import {
  Configuration,
  CallbackApi,
} from '';
import type { SmsCallbackApiV1CallbackSmsPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CallbackApi();

  const body = {
    // string (optional)
    bizId: bizId_example,
    // BodySmsCallbackApiV1CallbackSmsPost (optional)
    bodySmsCallbackApiV1CallbackSmsPost: ...,
  } satisfies SmsCallbackApiV1CallbackSmsPost0Request;

  try {
    const data = await api.smsCallbackApiV1CallbackSmsPost_0(body);
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
| **bizId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **bodySmsCallbackApiV1CallbackSmsPost** | [BodySmsCallbackApiV1CallbackSmsPost](BodySmsCallbackApiV1CallbackSmsPost.md) |  | [Optional] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

