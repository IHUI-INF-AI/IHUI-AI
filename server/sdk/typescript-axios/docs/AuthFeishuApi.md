# AuthFeishuApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**feishuPcTestApiV1AuthLoginFeishuPcTestGet**](#feishupctestapiv1authloginfeishupctestget) | **GET** /api/v1/auth/login/feishu/pc/test | Feishu Pc Test|
|[**feishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet**](#feishupcwxcodeapiv1authloginfeishupcwxcodeget) | **GET** /api/v1/auth/login/feishu/pc/wxCode | Feishu Pc Wx Code|

# **feishuPcTestApiV1AuthLoginFeishuPcTestGet**
> any feishuPcTestApiV1AuthLoginFeishuPcTestGet()


### Example

```typescript
import {
    AuthFeishuApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthFeishuApi(configuration);

let code: string; //test code (default to undefined)

const { status, data } = await apiInstance.feishuPcTestApiV1AuthLoginFeishuPcTestGet(
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] | test code | defaults to undefined|


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

# **feishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet**
> any feishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet()


### Example

```typescript
import {
    AuthFeishuApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthFeishuApi(configuration);

let code: string; //Feishu auth code (default to undefined)

const { status, data } = await apiInstance.feishuPcWxCodeApiV1AuthLoginFeishuPcWxCodeGet(
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] | Feishu auth code | defaults to undefined|


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

