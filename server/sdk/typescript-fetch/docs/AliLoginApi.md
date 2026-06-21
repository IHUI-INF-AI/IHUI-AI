# AliLoginApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**aliPcWxCodeApiV1AuthLoginAliPcWxCodeGet**](AliLoginApi.md#alipcwxcodeapiv1authloginalipcwxcodeget) | **GET** /api/v1/auth/login/ali/pc/wxCode | Ali Pc Wx Code |
| [**aliWebWxCodeApiV1AuthLoginAliWebWxCodeGet**](AliLoginApi.md#aliwebwxcodeapiv1authloginaliwebwxcodeget) | **GET** /api/v1/auth/login/ali/web/wxCode | Ali Web Wx Code |



## aliPcWxCodeApiV1AuthLoginAliPcWxCodeGet

> any aliPcWxCodeApiV1AuthLoginAliPcWxCodeGet(code)

Ali Pc Wx Code

### Example

```ts
import {
  Configuration,
  AliLoginApi,
} from '';
import type { AliPcWxCodeApiV1AuthLoginAliPcWxCodeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AliLoginApi();

  const body = {
    // string | Alipay auth code
    code: code_example,
  } satisfies AliPcWxCodeApiV1AuthLoginAliPcWxCodeGetRequest;

  try {
    const data = await api.aliPcWxCodeApiV1AuthLoginAliPcWxCodeGet(body);
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
| **code** | `string` | Alipay auth code | [Defaults to `undefined`] |

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


## aliWebWxCodeApiV1AuthLoginAliWebWxCodeGet

> any aliWebWxCodeApiV1AuthLoginAliWebWxCodeGet(authCode)

Ali Web Wx Code

### Example

```ts
import {
  Configuration,
  AliLoginApi,
} from '';
import type { AliWebWxCodeApiV1AuthLoginAliWebWxCodeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AliLoginApi();

  const body = {
    // string | Alipay web auth code
    authCode: authCode_example,
  } satisfies AliWebWxCodeApiV1AuthLoginAliWebWxCodeGetRequest;

  try {
    const data = await api.aliWebWxCodeApiV1AuthLoginAliWebWxCodeGet(body);
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
| **authCode** | `string` | Alipay web auth code | [Defaults to `undefined`] |

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

