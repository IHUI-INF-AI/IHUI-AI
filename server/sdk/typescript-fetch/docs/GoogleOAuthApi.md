# GoogleOAuthApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**androidWxCodeApiV1AuthGoogleAndroidWxCodeGet**](GoogleOAuthApi.md#androidwxcodeapiv1authgoogleandroidwxcodeget) | **GET** /api/v1/auth/google/android/wxCode | Google Android 登录 (id_token 直接登录) |
| [**googleConfigStatusApiV1AuthGoogleConfigGet**](GoogleOAuthApi.md#googleconfigstatusapiv1authgoogleconfigget) | **GET** /api/v1/auth/google/config | 返回当前 Google OAuth 配置 (脱敏) |
| [**pcWxCodeApiV1AuthGooglePcWxCodeGet**](GoogleOAuthApi.md#pcwxcodeapiv1authgooglepcwxcodeget) | **GET** /api/v1/auth/google/pc/wxCode | Google PC 登录 (用 code 换 token) |



## androidWxCodeApiV1AuthGoogleAndroidWxCodeGet

> any androidWxCodeApiV1AuthGoogleAndroidWxCodeGet(idToken)

Google Android 登录 (id_token 直接登录)

对应 Java: GET /google/android/wxCode?id_token&#x3D;

### Example

```ts
import {
  Configuration,
  GoogleOAuthApi,
} from '';
import type { AndroidWxCodeApiV1AuthGoogleAndroidWxCodeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new GoogleOAuthApi();

  const body = {
    // string | Google id_token
    idToken: idToken_example,
  } satisfies AndroidWxCodeApiV1AuthGoogleAndroidWxCodeGetRequest;

  try {
    const data = await api.androidWxCodeApiV1AuthGoogleAndroidWxCodeGet(body);
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
| **idToken** | `string` | Google id_token | [Defaults to `undefined`] |

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


## googleConfigStatusApiV1AuthGoogleConfigGet

> any googleConfigStatusApiV1AuthGoogleConfigGet()

返回当前 Google OAuth 配置 (脱敏)

运维端点, 用于确认配置是否加载.

### Example

```ts
import {
  Configuration,
  GoogleOAuthApi,
} from '';
import type { GoogleConfigStatusApiV1AuthGoogleConfigGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new GoogleOAuthApi();

  try {
    const data = await api.googleConfigStatusApiV1AuthGoogleConfigGet();
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


## pcWxCodeApiV1AuthGooglePcWxCodeGet

> any pcWxCodeApiV1AuthGooglePcWxCodeGet(code)

Google PC 登录 (用 code 换 token)

对应 Java: GET /google/pc/wxCode?code&#x3D;

### Example

```ts
import {
  Configuration,
  GoogleOAuthApi,
} from '';
import type { PcWxCodeApiV1AuthGooglePcWxCodeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new GoogleOAuthApi();

  const body = {
    // string | Google 授权码
    code: code_example,
  } satisfies PcWxCodeApiV1AuthGooglePcWxCodeGetRequest;

  try {
    const data = await api.pcWxCodeApiV1AuthGooglePcWxCodeGet(body);
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
| **code** | `string` | Google 授权码 | [Defaults to `undefined`] |

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

