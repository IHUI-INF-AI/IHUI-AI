# APIV2ExperimentalApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**v2InfoApiV2InfoGet**](APIV2ExperimentalApi.md#v2infoapiv2infoget) | **GET** /api/v2/info | v2 API 元数据 |
| [**v2LoginApiV2AuthLoginPost**](APIV2ExperimentalApi.md#v2loginapiv2authloginpost) | **POST** /api/v2/auth/login | [v2] 用户名+密码登录 - 增强返回 refresh_token + expires_in + scope |
| [**v2PingApiV2PingGet**](APIV2ExperimentalApi.md#v2pingapiv2pingget) | **GET** /api/v2/ping | v2 API ping |



## v2InfoApiV2InfoGet

> any v2InfoApiV2InfoGet()

v2 API 元数据

返回 v2 API 元信息 (供客户端探测).

### Example

```ts
import {
  Configuration,
  APIV2ExperimentalApi,
} from '';
import type { V2InfoApiV2InfoGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new APIV2ExperimentalApi();

  try {
    const data = await api.v2InfoApiV2InfoGet();
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


## v2LoginApiV2AuthLoginPost

> any v2LoginApiV2AuthLoginPost()

[v2] 用户名+密码登录 - 增强返回 refresh_token + expires_in + scope

v2 登录 - 完整版.  请求体: {\&quot;username\&quot;: \&quot;xxx\&quot;, \&quot;password\&quot;: \&quot;xxx\&quot;} 或 query 参数 响应体: {\&quot;code\&quot;: \&quot;0\&quot;, \&quot;msg\&quot;: \&quot;success\&quot;, \&quot;data\&quot;: {access_token, refresh_token, expires_in, scope, user}}

### Example

```ts
import {
  Configuration,
  APIV2ExperimentalApi,
} from '';
import type { V2LoginApiV2AuthLoginPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new APIV2ExperimentalApi();

  try {
    const data = await api.v2LoginApiV2AuthLoginPost();
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


## v2PingApiV2PingGet

> any v2PingApiV2PingGet()

v2 API ping

### Example

```ts
import {
  Configuration,
  APIV2ExperimentalApi,
} from '';
import type { V2PingApiV2PingGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new APIV2ExperimentalApi();

  try {
    const data = await api.v2PingApiV2PingGet();
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

