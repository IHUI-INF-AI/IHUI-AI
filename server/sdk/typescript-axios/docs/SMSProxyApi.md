# SMSProxyApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getProxyConfigApiV1ApiSmsProxyConfigGet**](#getproxyconfigapiv1apismsproxyconfigget) | **GET** /api/v1/api/sms-proxy/config | Get Proxy Config|
|[**quickRegisterApiV1ApiSmsProxyRegisterPost**](#quickregisterapiv1apismsproxyregisterpost) | **POST** /api/v1/api/sms-proxy/register | Quick Register|
|[**sendSmsCodeApiV1ApiSmsProxySendPost**](#sendsmscodeapiv1apismsproxysendpost) | **POST** /api/v1/api/sms-proxy/send | Send Sms Code|
|[**verifySmsCodeApiV1ApiSmsProxyVerifyPost**](#verifysmscodeapiv1apismsproxyverifypost) | **POST** /api/v1/api/sms-proxy/verify | Verify Sms Code|

# **getProxyConfigApiV1ApiSmsProxyConfigGet**
> any getProxyConfigApiV1ApiSmsProxyConfigGet()

Return SMS proxy configuration.

### Example

```typescript
import {
    SMSProxyApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SMSProxyApi(configuration);

const { status, data } = await apiInstance.getProxyConfigApiV1ApiSmsProxyConfigGet();
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

# **quickRegisterApiV1ApiSmsProxyRegisterPost**
> any quickRegisterApiV1ApiSmsProxyRegisterPost(registerRequest)

Quick register: verify code then register user.

### Example

```typescript
import {
    SMSProxyApi,
    Configuration,
    RegisterRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new SMSProxyApi(configuration);

let registerRequest: RegisterRequest; //

const { status, data } = await apiInstance.quickRegisterApiV1ApiSmsProxyRegisterPost(
    registerRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **registerRequest** | **RegisterRequest**|  | |


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

# **sendSmsCodeApiV1ApiSmsProxySendPost**
> any sendSmsCodeApiV1ApiSmsProxySendPost(smsVerifyRequest)

Send SMS verification code (proxy).

### Example

```typescript
import {
    SMSProxyApi,
    Configuration,
    SmsVerifyRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new SMSProxyApi(configuration);

let smsVerifyRequest: SmsVerifyRequest; //

const { status, data } = await apiInstance.sendSmsCodeApiV1ApiSmsProxySendPost(
    smsVerifyRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **smsVerifyRequest** | **SmsVerifyRequest**|  | |


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

# **verifySmsCodeApiV1ApiSmsProxyVerifyPost**
> any verifySmsCodeApiV1ApiSmsProxyVerifyPost(smsCodeVerifyRequest)

Verify SMS code (proxy).

### Example

```typescript
import {
    SMSProxyApi,
    Configuration,
    SmsCodeVerifyRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new SMSProxyApi(configuration);

let smsCodeVerifyRequest: SmsCodeVerifyRequest; //

const { status, data } = await apiInstance.verifySmsCodeApiV1ApiSmsProxyVerifyPost(
    smsCodeVerifyRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **smsCodeVerifyRequest** | **SmsCodeVerifyRequest**|  | |


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

