# UsernameLoginRuoyiDemoApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**loginByUsernameApiV1LoginUsernamePost**](UsernameLoginRuoyiDemoApi.md#loginbyusernameapiv1loginusernamepost) | **POST** /api/v1/login/username | 用户名密码登录 (内置 admin/ry) |



## loginByUsernameApiV1LoginUsernamePost

> any loginByUsernameApiV1LoginUsernamePost(username, password)

用户名密码登录 (内置 admin/ry)

前端演示登录: 用户名 + 密码, 返回 JWT + 用户信息.  对应 Java: AdminLoginController.login (若依版).

### Example

```ts
import {
  Configuration,
  UsernameLoginRuoyiDemoApi,
} from '';
import type { LoginByUsernameApiV1LoginUsernamePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UsernameLoginRuoyiDemoApi();

  const body = {
    // string | 用户名 (admin / ry)
    username: username_example,
    // string | 明文密码
    password: password_example,
  } satisfies LoginByUsernameApiV1LoginUsernamePostRequest;

  try {
    const data = await api.loginByUsernameApiV1LoginUsernamePost(body);
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
| **username** | `string` | 用户名 (admin / ry) | [Defaults to `undefined`] |
| **password** | `string` | 明文密码 | [Defaults to `undefined`] |

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

