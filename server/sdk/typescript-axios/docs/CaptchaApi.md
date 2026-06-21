# CaptchaApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getCaptchaApiV1AuthCaptchaGet**](#getcaptchaapiv1authcaptchaget) | **GET** /api/v1/auth/captcha | 获取验证码图片|
|[**verifyCaptchaEndpointApiV1AuthCaptchaVerifyPost**](#verifycaptchaendpointapiv1authcaptchaverifypost) | **POST** /api/v1/auth/captcha/verify | 校验验证码|

# **getCaptchaApiV1AuthCaptchaGet**
> any getCaptchaApiV1AuthCaptchaGet()

Generate a new image captcha.  Returns a ``captcha_key`` (to send back on login) and a base64-encoded PNG image string (to render in an ``<img>`` tag).

### Example

```typescript
import {
    CaptchaApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CaptchaApi(configuration);

const { status, data } = await apiInstance.getCaptchaApiV1AuthCaptchaGet();
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

# **verifyCaptchaEndpointApiV1AuthCaptchaVerifyPost**
> any verifyCaptchaEndpointApiV1AuthCaptchaVerifyPost(captchaVerifyRequest)

Verify a captcha submission.  Returns success/failure.  Each captcha can only be verified once.

### Example

```typescript
import {
    CaptchaApi,
    Configuration,
    CaptchaVerifyRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new CaptchaApi(configuration);

let captchaVerifyRequest: CaptchaVerifyRequest; //

const { status, data } = await apiInstance.verifyCaptchaEndpointApiV1AuthCaptchaVerifyPost(
    captchaVerifyRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **captchaVerifyRequest** | **CaptchaVerifyRequest**|  | |


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

