# AuthIdentityApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**auditApiV1AuthIdentityAidAuditPut**](AuthIdentityApi.md#auditapiv1authidentityaidauditput) | **PUT** /api/v1/auth-identity/{aid}/audit | 审核认证 |
| [**auditApiV1AuthIdentityAidAuditPut_0**](AuthIdentityApi.md#auditapiv1authidentityaidauditput_0) | **PUT** /api/v1/auth-identity/{aid}/audit | 审核认证 |
| [**authIdentitySubmit**](AuthIdentityApi.md#authidentitysubmit) | **POST** /api/v1/auth-identity/submit | 提交实名认证 |
| [**authIdentitySubmit_0**](AuthIdentityApi.md#authidentitysubmit_0) | **POST** /api/v1/auth-identity/submit | 提交实名认证 |
| [**listIdentitiesApiV1AuthIdentityListGet**](AuthIdentityApi.md#listidentitiesapiv1authidentitylistget) | **GET** /api/v1/auth-identity/list | 认证列表(管理员) |
| [**listIdentitiesApiV1AuthIdentityListGet_0**](AuthIdentityApi.md#listidentitiesapiv1authidentitylistget_0) | **GET** /api/v1/auth-identity/list | 认证列表(管理员) |
| [**myIdentityApiV1AuthIdentityMyGet**](AuthIdentityApi.md#myidentityapiv1authidentitymyget) | **GET** /api/v1/auth-identity/my | 我的认证 |
| [**myIdentityApiV1AuthIdentityMyGet_0**](AuthIdentityApi.md#myidentityapiv1authidentitymyget_0) | **GET** /api/v1/auth-identity/my | 我的认证 |



## auditApiV1AuthIdentityAidAuditPut

> any auditApiV1AuthIdentityAidAuditPut(aid, status, remark, expireDays)

审核认证

### Example

```ts
import {
  Configuration,
  AuthIdentityApi,
} from '';
import type { AuditApiV1AuthIdentityAidAuditPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthIdentityApi();

  const body = {
    // number
    aid: 56,
    // number
    status: 56,
    // string (optional)
    remark: remark_example,
    // number (optional)
    expireDays: 56,
  } satisfies AuditApiV1AuthIdentityAidAuditPutRequest;

  try {
    const data = await api.auditApiV1AuthIdentityAidAuditPut(body);
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
| **aid** | `number` |  | [Defaults to `undefined`] |
| **status** | `number` |  | [Defaults to `undefined`] |
| **remark** | `string` |  | [Optional] [Defaults to `undefined`] |
| **expireDays** | `number` |  | [Optional] [Defaults to `365`] |

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


## auditApiV1AuthIdentityAidAuditPut_0

> any auditApiV1AuthIdentityAidAuditPut_0(aid, status, remark, expireDays)

审核认证

### Example

```ts
import {
  Configuration,
  AuthIdentityApi,
} from '';
import type { AuditApiV1AuthIdentityAidAuditPut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthIdentityApi();

  const body = {
    // number
    aid: 56,
    // number
    status: 56,
    // string (optional)
    remark: remark_example,
    // number (optional)
    expireDays: 56,
  } satisfies AuditApiV1AuthIdentityAidAuditPut0Request;

  try {
    const data = await api.auditApiV1AuthIdentityAidAuditPut_0(body);
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
| **aid** | `number` |  | [Defaults to `undefined`] |
| **status** | `number` |  | [Defaults to `undefined`] |
| **remark** | `string` |  | [Optional] [Defaults to `undefined`] |
| **expireDays** | `number` |  | [Optional] [Defaults to `365`] |

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


## authIdentitySubmit

> any authIdentitySubmit(realName, idCard, phone, idCardFront, idCardBack, type)

提交实名认证

### Example

```ts
import {
  Configuration,
  AuthIdentityApi,
} from '';
import type { AuthIdentitySubmitRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthIdentityApi();

  const body = {
    // string
    realName: realName_example,
    // string
    idCard: idCard_example,
    // string (optional)
    phone: phone_example,
    // string (optional)
    idCardFront: idCardFront_example,
    // string (optional)
    idCardBack: idCardBack_example,
    // number (optional)
    type: 56,
  } satisfies AuthIdentitySubmitRequest;

  try {
    const data = await api.authIdentitySubmit(body);
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
| **realName** | `string` |  | [Defaults to `undefined`] |
| **idCard** | `string` |  | [Defaults to `undefined`] |
| **phone** | `string` |  | [Optional] [Defaults to `undefined`] |
| **idCardFront** | `string` |  | [Optional] [Defaults to `undefined`] |
| **idCardBack** | `string` |  | [Optional] [Defaults to `undefined`] |
| **type** | `number` |  | [Optional] [Defaults to `1`] |

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


## authIdentitySubmit_0

> any authIdentitySubmit_0(realName, idCard, phone, idCardFront, idCardBack, type)

提交实名认证

### Example

```ts
import {
  Configuration,
  AuthIdentityApi,
} from '';
import type { AuthIdentitySubmit0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthIdentityApi();

  const body = {
    // string
    realName: realName_example,
    // string
    idCard: idCard_example,
    // string (optional)
    phone: phone_example,
    // string (optional)
    idCardFront: idCardFront_example,
    // string (optional)
    idCardBack: idCardBack_example,
    // number (optional)
    type: 56,
  } satisfies AuthIdentitySubmit0Request;

  try {
    const data = await api.authIdentitySubmit_0(body);
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
| **realName** | `string` |  | [Defaults to `undefined`] |
| **idCard** | `string` |  | [Defaults to `undefined`] |
| **phone** | `string` |  | [Optional] [Defaults to `undefined`] |
| **idCardFront** | `string` |  | [Optional] [Defaults to `undefined`] |
| **idCardBack** | `string` |  | [Optional] [Defaults to `undefined`] |
| **type** | `number` |  | [Optional] [Defaults to `1`] |

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


## listIdentitiesApiV1AuthIdentityListGet

> any listIdentitiesApiV1AuthIdentityListGet(page, limit, status)

认证列表(管理员)

### Example

```ts
import {
  Configuration,
  AuthIdentityApi,
} from '';
import type { ListIdentitiesApiV1AuthIdentityListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthIdentityApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    status: 56,
  } satisfies ListIdentitiesApiV1AuthIdentityListGetRequest;

  try {
    const data = await api.listIdentitiesApiV1AuthIdentityListGet(body);
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
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## listIdentitiesApiV1AuthIdentityListGet_0

> any listIdentitiesApiV1AuthIdentityListGet_0(page, limit, status)

认证列表(管理员)

### Example

```ts
import {
  Configuration,
  AuthIdentityApi,
} from '';
import type { ListIdentitiesApiV1AuthIdentityListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthIdentityApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    status: 56,
  } satisfies ListIdentitiesApiV1AuthIdentityListGet0Request;

  try {
    const data = await api.listIdentitiesApiV1AuthIdentityListGet_0(body);
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
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## myIdentityApiV1AuthIdentityMyGet

> any myIdentityApiV1AuthIdentityMyGet()

我的认证

### Example

```ts
import {
  Configuration,
  AuthIdentityApi,
} from '';
import type { MyIdentityApiV1AuthIdentityMyGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthIdentityApi();

  try {
    const data = await api.myIdentityApiV1AuthIdentityMyGet();
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


## myIdentityApiV1AuthIdentityMyGet_0

> any myIdentityApiV1AuthIdentityMyGet_0()

我的认证

### Example

```ts
import {
  Configuration,
  AuthIdentityApi,
} from '';
import type { MyIdentityApiV1AuthIdentityMyGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthIdentityApi();

  try {
    const data = await api.myIdentityApiV1AuthIdentityMyGet_0();
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

