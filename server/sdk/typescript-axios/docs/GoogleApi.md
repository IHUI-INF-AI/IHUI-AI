# GoogleApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**androidWxCodeApiV1AuthGoogleAndroidWxCodeGet**](#androidwxcodeapiv1authgoogleandroidwxcodeget) | **GET** /api/v1/auth/google/android/wxCode | Google Android 登录 (id_token 直接登录)|
|[**googleConfigStatusApiV1AuthGoogleConfigGet**](#googleconfigstatusapiv1authgoogleconfigget) | **GET** /api/v1/auth/google/config | 返回当前 Google OAuth 配置 (脱敏)|
|[**pcWxCodeApiV1AuthGooglePcWxCodeGet**](#pcwxcodeapiv1authgooglepcwxcodeget) | **GET** /api/v1/auth/google/pc/wxCode | Google PC 登录 (用 code 换 token)|

# **androidWxCodeApiV1AuthGoogleAndroidWxCodeGet**
> any androidWxCodeApiV1AuthGoogleAndroidWxCodeGet()

对应 Java: GET /google/android/wxCode?id_token=

### Example

```typescript
import {
    GoogleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new GoogleApi(configuration);

let idToken: string; //Google id_token (default to undefined)

const { status, data } = await apiInstance.androidWxCodeApiV1AuthGoogleAndroidWxCodeGet(
    idToken
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **idToken** | [**string**] | Google id_token | defaults to undefined|


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

# **googleConfigStatusApiV1AuthGoogleConfigGet**
> any googleConfigStatusApiV1AuthGoogleConfigGet()

运维端点, 用于确认配置是否加载.

### Example

```typescript
import {
    GoogleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new GoogleApi(configuration);

const { status, data } = await apiInstance.googleConfigStatusApiV1AuthGoogleConfigGet();
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

# **pcWxCodeApiV1AuthGooglePcWxCodeGet**
> any pcWxCodeApiV1AuthGooglePcWxCodeGet()

对应 Java: GET /google/pc/wxCode?code=

### Example

```typescript
import {
    GoogleApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new GoogleApi(configuration);

let code: string; //Google 授权码 (default to undefined)

const { status, data } = await apiInstance.pcWxCodeApiV1AuthGooglePcWxCodeGet(
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] | Google 授权码 | defaults to undefined|


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

