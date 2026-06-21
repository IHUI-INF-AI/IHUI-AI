# SMSApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**sendCodeApiV1AuthSmsSendPost**](SMSApi.md#sendcodeapiv1authsmssendpost) | **POST** /api/v1/auth/sms/send | Send SMS code |
| [**sendCodeApiV1AuthSmsSendPost_0**](SMSApi.md#sendcodeapiv1authsmssendpost_0) | **POST** /api/v1/auth/sms/send | Send SMS code |
| [**verifyCodeApiV1AuthSmsVerifyPost**](SMSApi.md#verifycodeapiv1authsmsverifypost) | **POST** /api/v1/auth/sms/verify | Verify SMS code |
| [**verifyCodeApiV1AuthSmsVerifyPost_0**](SMSApi.md#verifycodeapiv1authsmsverifypost_0) | **POST** /api/v1/auth/sms/verify | Verify SMS code |



## sendCodeApiV1AuthSmsSendPost

> any sendCodeApiV1AuthSmsSendPost(phone)

Send SMS code

### Example

```ts
import {
  Configuration,
  SMSApi,
} from '';
import type { SendCodeApiV1AuthSmsSendPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SMSApi();

  const body = {
    // string
    phone: phone_example,
  } satisfies SendCodeApiV1AuthSmsSendPostRequest;

  try {
    const data = await api.sendCodeApiV1AuthSmsSendPost(body);
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
| **phone** | `string` |  | [Defaults to `undefined`] |

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


## sendCodeApiV1AuthSmsSendPost_0

> any sendCodeApiV1AuthSmsSendPost_0(phone)

Send SMS code

### Example

```ts
import {
  Configuration,
  SMSApi,
} from '';
import type { SendCodeApiV1AuthSmsSendPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SMSApi();

  const body = {
    // string
    phone: phone_example,
  } satisfies SendCodeApiV1AuthSmsSendPost0Request;

  try {
    const data = await api.sendCodeApiV1AuthSmsSendPost_0(body);
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
| **phone** | `string` |  | [Defaults to `undefined`] |

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


## verifyCodeApiV1AuthSmsVerifyPost

> any verifyCodeApiV1AuthSmsVerifyPost(phone, code)

Verify SMS code

### Example

```ts
import {
  Configuration,
  SMSApi,
} from '';
import type { VerifyCodeApiV1AuthSmsVerifyPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SMSApi();

  const body = {
    // string
    phone: phone_example,
    // string
    code: code_example,
  } satisfies VerifyCodeApiV1AuthSmsVerifyPostRequest;

  try {
    const data = await api.verifyCodeApiV1AuthSmsVerifyPost(body);
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
| **phone** | `string` |  | [Defaults to `undefined`] |
| **code** | `string` |  | [Defaults to `undefined`] |

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


## verifyCodeApiV1AuthSmsVerifyPost_0

> any verifyCodeApiV1AuthSmsVerifyPost_0(phone, code)

Verify SMS code

### Example

```ts
import {
  Configuration,
  SMSApi,
} from '';
import type { VerifyCodeApiV1AuthSmsVerifyPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SMSApi();

  const body = {
    // string
    phone: phone_example,
    // string
    code: code_example,
  } satisfies VerifyCodeApiV1AuthSmsVerifyPost0Request;

  try {
    const data = await api.verifyCodeApiV1AuthSmsVerifyPost_0(body);
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
| **phone** | `string` |  | [Defaults to `undefined`] |
| **code** | `string` |  | [Defaults to `undefined`] |

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

