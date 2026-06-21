# SMSProxyApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getProxyConfigApiV1ApiSmsProxyConfigGet**](SMSProxyApi.md#getproxyconfigapiv1apismsproxyconfigget) | **GET** /api/v1/api/sms-proxy/config | Get Proxy Config |
| [**quickRegisterApiV1ApiSmsProxyRegisterPost**](SMSProxyApi.md#quickregisterapiv1apismsproxyregisterpost) | **POST** /api/v1/api/sms-proxy/register | Quick Register |
| [**sendSmsCodeApiV1ApiSmsProxySendPost**](SMSProxyApi.md#sendsmscodeapiv1apismsproxysendpost) | **POST** /api/v1/api/sms-proxy/send | Send Sms Code |
| [**verifySmsCodeApiV1ApiSmsProxyVerifyPost**](SMSProxyApi.md#verifysmscodeapiv1apismsproxyverifypost) | **POST** /api/v1/api/sms-proxy/verify | Verify Sms Code |



## getProxyConfigApiV1ApiSmsProxyConfigGet

> any getProxyConfigApiV1ApiSmsProxyConfigGet()

Get Proxy Config

Return SMS proxy configuration.

### Example

```ts
import {
  Configuration,
  SMSProxyApi,
} from '';
import type { GetProxyConfigApiV1ApiSmsProxyConfigGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SMSProxyApi();

  try {
    const data = await api.getProxyConfigApiV1ApiSmsProxyConfigGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## quickRegisterApiV1ApiSmsProxyRegisterPost

> any quickRegisterApiV1ApiSmsProxyRegisterPost(registerRequest)

Quick Register

Quick register: verify code then register user.

### Example

```ts
import {
  Configuration,
  SMSProxyApi,
} from '';
import type { QuickRegisterApiV1ApiSmsProxyRegisterPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SMSProxyApi();

  const body = {
    // RegisterRequest
    registerRequest: ...,
  } satisfies QuickRegisterApiV1ApiSmsProxyRegisterPostRequest;

  try {
    const data = await api.quickRegisterApiV1ApiSmsProxyRegisterPost(body);
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
| **registerRequest** | [RegisterRequest](RegisterRequest.md) |  | |

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


## sendSmsCodeApiV1ApiSmsProxySendPost

> any sendSmsCodeApiV1ApiSmsProxySendPost(smsVerifyRequest)

Send Sms Code

Send SMS verification code (proxy).

### Example

```ts
import {
  Configuration,
  SMSProxyApi,
} from '';
import type { SendSmsCodeApiV1ApiSmsProxySendPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SMSProxyApi();

  const body = {
    // SmsVerifyRequest
    smsVerifyRequest: ...,
  } satisfies SendSmsCodeApiV1ApiSmsProxySendPostRequest;

  try {
    const data = await api.sendSmsCodeApiV1ApiSmsProxySendPost(body);
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
| **smsVerifyRequest** | [SmsVerifyRequest](SmsVerifyRequest.md) |  | |

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


## verifySmsCodeApiV1ApiSmsProxyVerifyPost

> any verifySmsCodeApiV1ApiSmsProxyVerifyPost(smsCodeVerifyRequest)

Verify Sms Code

Verify SMS code (proxy).

### Example

```ts
import {
  Configuration,
  SMSProxyApi,
} from '';
import type { VerifySmsCodeApiV1ApiSmsProxyVerifyPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SMSProxyApi();

  const body = {
    // SmsCodeVerifyRequest
    smsCodeVerifyRequest: ...,
  } satisfies VerifySmsCodeApiV1ApiSmsProxyVerifyPostRequest;

  try {
    const data = await api.verifySmsCodeApiV1ApiSmsProxyVerifyPost(body);
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
| **smsCodeVerifyRequest** | [SmsCodeVerifyRequest](SmsCodeVerifyRequest.md) |  | |

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

