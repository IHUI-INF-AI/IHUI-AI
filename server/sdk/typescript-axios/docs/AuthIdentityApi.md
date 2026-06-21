# AuthIdentityApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**auditApiV1AuthIdentityAidAuditPut**](#auditapiv1authidentityaidauditput) | **PUT** /api/v1/auth-identity/{aid}/audit | 审核认证|
|[**auditApiV1AuthIdentityAidAuditPut_0**](#auditapiv1authidentityaidauditput_0) | **PUT** /api/v1/auth-identity/{aid}/audit | 审核认证|
|[**authIdentitySubmit**](#authidentitysubmit) | **POST** /api/v1/auth-identity/submit | 提交实名认证|
|[**authIdentitySubmit_0**](#authidentitysubmit_0) | **POST** /api/v1/auth-identity/submit | 提交实名认证|
|[**listIdentitiesApiV1AuthIdentityListGet**](#listidentitiesapiv1authidentitylistget) | **GET** /api/v1/auth-identity/list | 认证列表(管理员)|
|[**listIdentitiesApiV1AuthIdentityListGet_0**](#listidentitiesapiv1authidentitylistget_0) | **GET** /api/v1/auth-identity/list | 认证列表(管理员)|
|[**myIdentityApiV1AuthIdentityMyGet**](#myidentityapiv1authidentitymyget) | **GET** /api/v1/auth-identity/my | 我的认证|
|[**myIdentityApiV1AuthIdentityMyGet_0**](#myidentityapiv1authidentitymyget_0) | **GET** /api/v1/auth-identity/my | 我的认证|

# **auditApiV1AuthIdentityAidAuditPut**
> any auditApiV1AuthIdentityAidAuditPut()


### Example

```typescript
import {
    AuthIdentityApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthIdentityApi(configuration);

let aid: number; // (default to undefined)
let status: number; // (default to undefined)
let remark: string; // (optional) (default to undefined)
let expireDays: number; // (optional) (default to 365)

const { status, data } = await apiInstance.auditApiV1AuthIdentityAidAuditPut(
    aid,
    status,
    remark,
    expireDays
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|
| **status** | [**number**] |  | defaults to undefined|
| **remark** | [**string**] |  | (optional) defaults to undefined|
| **expireDays** | [**number**] |  | (optional) defaults to 365|


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

# **auditApiV1AuthIdentityAidAuditPut_0**
> any auditApiV1AuthIdentityAidAuditPut_0()


### Example

```typescript
import {
    AuthIdentityApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthIdentityApi(configuration);

let aid: number; // (default to undefined)
let status: number; // (default to undefined)
let remark: string; // (optional) (default to undefined)
let expireDays: number; // (optional) (default to 365)

const { status, data } = await apiInstance.auditApiV1AuthIdentityAidAuditPut_0(
    aid,
    status,
    remark,
    expireDays
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|
| **status** | [**number**] |  | defaults to undefined|
| **remark** | [**string**] |  | (optional) defaults to undefined|
| **expireDays** | [**number**] |  | (optional) defaults to 365|


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

# **authIdentitySubmit**
> any authIdentitySubmit()


### Example

```typescript
import {
    AuthIdentityApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthIdentityApi(configuration);

let realName: string; // (default to undefined)
let idCard: string; // (default to undefined)
let phone: string; // (optional) (default to undefined)
let idCardFront: string; // (optional) (default to undefined)
let idCardBack: string; // (optional) (default to undefined)
let type: number; // (optional) (default to 1)

const { status, data } = await apiInstance.authIdentitySubmit(
    realName,
    idCard,
    phone,
    idCardFront,
    idCardBack,
    type
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **realName** | [**string**] |  | defaults to undefined|
| **idCard** | [**string**] |  | defaults to undefined|
| **phone** | [**string**] |  | (optional) defaults to undefined|
| **idCardFront** | [**string**] |  | (optional) defaults to undefined|
| **idCardBack** | [**string**] |  | (optional) defaults to undefined|
| **type** | [**number**] |  | (optional) defaults to 1|


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

# **authIdentitySubmit_0**
> any authIdentitySubmit_0()


### Example

```typescript
import {
    AuthIdentityApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthIdentityApi(configuration);

let realName: string; // (default to undefined)
let idCard: string; // (default to undefined)
let phone: string; // (optional) (default to undefined)
let idCardFront: string; // (optional) (default to undefined)
let idCardBack: string; // (optional) (default to undefined)
let type: number; // (optional) (default to 1)

const { status, data } = await apiInstance.authIdentitySubmit_0(
    realName,
    idCard,
    phone,
    idCardFront,
    idCardBack,
    type
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **realName** | [**string**] |  | defaults to undefined|
| **idCard** | [**string**] |  | defaults to undefined|
| **phone** | [**string**] |  | (optional) defaults to undefined|
| **idCardFront** | [**string**] |  | (optional) defaults to undefined|
| **idCardBack** | [**string**] |  | (optional) defaults to undefined|
| **type** | [**number**] |  | (optional) defaults to 1|


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

# **listIdentitiesApiV1AuthIdentityListGet**
> any listIdentitiesApiV1AuthIdentityListGet()


### Example

```typescript
import {
    AuthIdentityApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthIdentityApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listIdentitiesApiV1AuthIdentityListGet(
    page,
    limit,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **status** | [**number**] |  | (optional) defaults to undefined|


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

# **listIdentitiesApiV1AuthIdentityListGet_0**
> any listIdentitiesApiV1AuthIdentityListGet_0()


### Example

```typescript
import {
    AuthIdentityApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthIdentityApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listIdentitiesApiV1AuthIdentityListGet_0(
    page,
    limit,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **status** | [**number**] |  | (optional) defaults to undefined|


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

# **myIdentityApiV1AuthIdentityMyGet**
> any myIdentityApiV1AuthIdentityMyGet()


### Example

```typescript
import {
    AuthIdentityApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthIdentityApi(configuration);

const { status, data } = await apiInstance.myIdentityApiV1AuthIdentityMyGet();
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

# **myIdentityApiV1AuthIdentityMyGet_0**
> any myIdentityApiV1AuthIdentityMyGet_0()


### Example

```typescript
import {
    AuthIdentityApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthIdentityApi(configuration);

const { status, data } = await apiInstance.myIdentityApiV1AuthIdentityMyGet_0();
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

