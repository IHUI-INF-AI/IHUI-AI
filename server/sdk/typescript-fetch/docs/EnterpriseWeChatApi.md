# EnterpriseWeChatApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**enterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost**](EnterpriseWeChatApi.md#enterprisepccallbackapiv1authloginenterprisepccallbackpost) | **POST** /api/v1/auth/login/enterprise/pc/callback | Enterprise Pc Callback |
| [**enterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet**](EnterpriseWeChatApi.md#enterprisepcwxcodeapiv1authloginenterprisepcwxcodeget) | **GET** /api/v1/auth/login/enterprise/pc/wxCode | Enterprise Pc Wx Code |



## enterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost

> any enterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost(msgSignature, timestamp, nonce)

Enterprise Pc Callback

### Example

```ts
import {
  Configuration,
  EnterpriseWeChatApi,
} from '';
import type { EnterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EnterpriseWeChatApi();

  const body = {
    // string (optional)
    msgSignature: msgSignature_example,
    // string (optional)
    timestamp: timestamp_example,
    // string (optional)
    nonce: nonce_example,
  } satisfies EnterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPostRequest;

  try {
    const data = await api.enterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost(body);
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
| **msgSignature** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **timestamp** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **nonce** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |

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


## enterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet

> any enterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet(code)

Enterprise Pc Wx Code

### Example

```ts
import {
  Configuration,
  EnterpriseWeChatApi,
} from '';
import type { EnterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EnterpriseWeChatApi();

  const body = {
    // string | WeCom js_code
    code: code_example,
  } satisfies EnterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGetRequest;

  try {
    const data = await api.enterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet(body);
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
| **code** | `string` | WeCom js_code | [Defaults to `undefined`] |

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

