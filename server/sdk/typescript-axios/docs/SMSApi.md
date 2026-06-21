# SMSApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**sendCodeApiV1AuthSmsSendPost**](#sendcodeapiv1authsmssendpost) | **POST** /api/v1/auth/sms/send | Send SMS code|
|[**sendCodeApiV1AuthSmsSendPost_0**](#sendcodeapiv1authsmssendpost_0) | **POST** /api/v1/auth/sms/send | Send SMS code|
|[**verifyCodeApiV1AuthSmsVerifyPost**](#verifycodeapiv1authsmsverifypost) | **POST** /api/v1/auth/sms/verify | Verify SMS code|
|[**verifyCodeApiV1AuthSmsVerifyPost_0**](#verifycodeapiv1authsmsverifypost_0) | **POST** /api/v1/auth/sms/verify | Verify SMS code|

# **sendCodeApiV1AuthSmsSendPost**
> any sendCodeApiV1AuthSmsSendPost()


### Example

```typescript
import {
    SMSApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SMSApi(configuration);

let phone: string; // (default to undefined)

const { status, data } = await apiInstance.sendCodeApiV1AuthSmsSendPost(
    phone
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **phone** | [**string**] |  | defaults to undefined|


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

# **sendCodeApiV1AuthSmsSendPost_0**
> any sendCodeApiV1AuthSmsSendPost_0()


### Example

```typescript
import {
    SMSApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SMSApi(configuration);

let phone: string; // (default to undefined)

const { status, data } = await apiInstance.sendCodeApiV1AuthSmsSendPost_0(
    phone
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **phone** | [**string**] |  | defaults to undefined|


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

# **verifyCodeApiV1AuthSmsVerifyPost**
> any verifyCodeApiV1AuthSmsVerifyPost()


### Example

```typescript
import {
    SMSApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SMSApi(configuration);

let phone: string; // (default to undefined)
let code: string; // (default to undefined)

const { status, data } = await apiInstance.verifyCodeApiV1AuthSmsVerifyPost(
    phone,
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **phone** | [**string**] |  | defaults to undefined|
| **code** | [**string**] |  | defaults to undefined|


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

# **verifyCodeApiV1AuthSmsVerifyPost_0**
> any verifyCodeApiV1AuthSmsVerifyPost_0()


### Example

```typescript
import {
    SMSApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SMSApi(configuration);

let phone: string; // (default to undefined)
let code: string; // (default to undefined)

const { status, data } = await apiInstance.verifyCodeApiV1AuthSmsVerifyPost_0(
    phone,
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **phone** | [**string**] |  | defaults to undefined|
| **code** | [**string**] |  | defaults to undefined|


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

