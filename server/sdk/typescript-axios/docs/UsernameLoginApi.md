# UsernameLoginApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**loginByUsernameApiV1LoginUsernamePost**](#loginbyusernameapiv1loginusernamepost) | **POST** /api/v1/login/username | 用户名密码登录 (内置 admin/ry)|

# **loginByUsernameApiV1LoginUsernamePost**
> any loginByUsernameApiV1LoginUsernamePost()

前端演示登录: 用户名 + 密码, 返回 JWT + 用户信息.  对应 Java: AdminLoginController.login (若依版).

### Example

```typescript
import {
    UsernameLoginApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UsernameLoginApi(configuration);

let username: string; //用户名 (admin / ry) (default to undefined)
let password: string; //明文密码 (default to undefined)

const { status, data } = await apiInstance.loginByUsernameApiV1LoginUsernamePost(
    username,
    password
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **username** | [**string**] | 用户名 (admin / ry) | defaults to undefined|
| **password** | [**string**] | 明文密码 | defaults to undefined|


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

