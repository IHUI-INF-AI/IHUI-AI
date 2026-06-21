# AuthFeishuApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**feishuPcTestApiV1AuthLoginFeishuPcTestGet**](AuthFeishuApi.md#feishupctestapiv1authloginfeishupctestget) | **GET** /api/v1/auth/login/feishu/pc/test | Feishu Pc Test |
| [**feishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet**](AuthFeishuApi.md#feishupcwxcodeapiv1authloginfeishupcwxcodeget) | **GET** /api/v1/auth/login/feishu/pc/wxCode | Feishu Pc Wx Code |



## feishuPcTestApiV1AuthLoginFeishuPcTestGet

> any feishuPcTestApiV1AuthLoginFeishuPcTestGet(code)

Feishu Pc Test

### Example

```ts
import {
  Configuration,
  AuthFeishuApi,
} from '';
import type { FeishuPcTestApiV1AuthLoginFeishuPcTestGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthFeishuApi();

  const body = {
    // string | test code
    code: code_example,
  } satisfies FeishuPcTestApiV1AuthLoginFeishuPcTestGetRequest;

  try {
    const data = await api.feishuPcTestApiV1AuthLoginFeishuPcTestGet(body);
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
| **code** | `string` | test code | [Defaults to `undefined`] |

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


## feishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet

> any feishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet(code)

Feishu Pc Wx Code

### Example

```ts
import {
  Configuration,
  AuthFeishuApi,
} from '';
import type { FeishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthFeishuApi();

  const body = {
    // string | Feishu auth code
    code: code_example,
  } satisfies FeishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGetRequest;

  try {
    const data = await api.feishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet(body);
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
| **code** | `string` | Feishu auth code | [Defaults to `undefined`] |

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

