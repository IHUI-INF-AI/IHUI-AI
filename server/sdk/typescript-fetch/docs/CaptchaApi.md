# CaptchaApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getCaptchaApiV1AuthCaptchaGet**](CaptchaApi.md#getcaptchaapiv1authcaptchaget) | **GET** /api/v1/auth/captcha | 获取验证码图片 |
| [**verifyCaptchaEndpointApiV1AuthCaptchaVerifyPost**](CaptchaApi.md#verifycaptchaendpointapiv1authcaptchaverifypost) | **POST** /api/v1/auth/captcha/verify | 校验验证码 |



## getCaptchaApiV1AuthCaptchaGet

> any getCaptchaApiV1AuthCaptchaGet()

获取验证码图片

Generate a new image captcha.  Returns a &#x60;&#x60;captcha_key&#x60;&#x60; (to send back on login) and a base64-encoded PNG image string (to render in an &#x60;&#x60;&lt;img&gt;&#x60;&#x60; tag).

### Example

```ts
import {
  Configuration,
  CaptchaApi,
} from '';
import type { GetCaptchaApiV1AuthCaptchaGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CaptchaApi();

  try {
    const data = await api.getCaptchaApiV1AuthCaptchaGet();
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


## verifyCaptchaEndpointApiV1AuthCaptchaVerifyPost

> any verifyCaptchaEndpointApiV1AuthCaptchaVerifyPost(captchaVerifyRequest)

校验验证码

Verify a captcha submission.  Returns success/failure.  Each captcha can only be verified once.

### Example

```ts
import {
  Configuration,
  CaptchaApi,
} from '';
import type { VerifyCaptchaEndpointApiV1AuthCaptchaVerifyPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CaptchaApi();

  const body = {
    // CaptchaVerifyRequest
    captchaVerifyRequest: ...,
  } satisfies VerifyCaptchaEndpointApiV1AuthCaptchaVerifyPostRequest;

  try {
    const data = await api.verifyCaptchaEndpointApiV1AuthCaptchaVerifyPost(body);
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
| **captchaVerifyRequest** | [CaptchaVerifyRequest](CaptchaVerifyRequest.md) |  | |

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

