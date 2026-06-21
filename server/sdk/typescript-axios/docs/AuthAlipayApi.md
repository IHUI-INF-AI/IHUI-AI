# AuthAlipayApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**aliPcWxCodeApiV1AuthLoginAliPcWxCodeGet**](#alipcwxcodeapiv1authloginalipcwxcodeget) | **GET** /api/v1/auth/login/ali/pc/wxCode | Ali Pc Wx Code|
|[**aliWebWxCodeApiV1AuthLoginAliWebWxCodeGet**](#aliwebwxcodeapiv1authloginaliwebwxcodeget) | **GET** /api/v1/auth/login/ali/web/wxCode | Ali Web Wx Code|

# **aliPcWxCodeApiV1AuthLoginAliPcWxCodeGet**
> any aliPcWxCodeApiV1AuthLoginAliPcWxCodeGet()


### Example

```typescript
import {
    AuthAlipayApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthAlipayApi(configuration);

let code: string; //Alipay auth code (default to undefined)

const { status, data } = await apiInstance.aliPcWxCodeApiV1AuthLoginAliPcWxCodeGet(
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] | Alipay auth code | defaults to undefined|


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

# **aliWebWxCodeApiV1AuthLoginAliWebWxCodeGet**
> any aliWebWxCodeApiV1AuthLoginAliWebWxCodeGet()


### Example

```typescript
import {
    AuthAlipayApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthAlipayApi(configuration);

let authCode: string; //Alipay web auth code (default to undefined)

const { status, data } = await apiInstance.aliWebWxCodeApiV1AuthLoginAliWebWxCodeGet(
    authCode
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **authCode** | [**string**] | Alipay web auth code | defaults to undefined|


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

