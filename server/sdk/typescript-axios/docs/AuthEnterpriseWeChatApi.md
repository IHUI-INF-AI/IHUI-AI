# AuthEnterpriseWeChatApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**enterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost**](#enterprisepccallbackapiv1authloginenterprisepccallbackpost) | **POST** /api/v1/auth/login/enterprise/pc/callback | Enterprise Pc Callback|
|[**enterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet**](#enterprisepcwxcodeapiv1authloginenterprisepcwxcodeget) | **GET** /api/v1/auth/login/enterprise/pc/wxCode | Enterprise Pc Wx Code|

# **enterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost**
> any enterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost()


### Example

```typescript
import {
    AuthEnterpriseWeChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthEnterpriseWeChatApi(configuration);

let msgSignature: string; // (optional) (default to '')
let timestamp: string; // (optional) (default to '')
let nonce: string; // (optional) (default to '')

const { status, data } = await apiInstance.enterprisePcCallbackApiV1AuthLoginEnterprisePcCallbackPost(
    msgSignature,
    timestamp,
    nonce
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **msgSignature** | [**string**] |  | (optional) defaults to ''|
| **timestamp** | [**string**] |  | (optional) defaults to ''|
| **nonce** | [**string**] |  | (optional) defaults to ''|


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

# **enterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet**
> any enterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet()


### Example

```typescript
import {
    AuthEnterpriseWeChatApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthEnterpriseWeChatApi(configuration);

let code: string; //WeCom js_code (default to undefined)

const { status, data } = await apiInstance.enterprisePcWxCodeApiV1AuthLoginEnterprisePcWxCodeGet(
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] | WeCom js_code | defaults to undefined|


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

