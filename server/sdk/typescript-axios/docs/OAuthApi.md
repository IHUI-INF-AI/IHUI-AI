# OAuthApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**authorizeApiV1AuthOauthAuthorizeGet**](#authorizeapiv1authoauthauthorizeget) | **GET** /api/v1/auth/oauth/authorize | OAuth authorize|
|[**authorizeApiV1AuthOauthAuthorizeGet_0**](#authorizeapiv1authoauthauthorizeget_0) | **GET** /api/v1/auth/oauth/authorize | OAuth authorize|
|[**createOauthAppApiV1AuthOauthAppsCreatePost**](#createoauthappapiv1authoauthappscreatepost) | **POST** /api/v1/auth/oauth/apps/create | Create an OAuth application|
|[**createOauthAppApiV1AuthOauthAppsCreatePost_0**](#createoauthappapiv1authoauthappscreatepost_0) | **POST** /api/v1/auth/oauth/apps/create | Create an OAuth application|
|[**deleteOauthAppApiV1AuthOauthAppsClientIdDelete**](#deleteoauthappapiv1authoauthappsclientiddelete) | **DELETE** /api/v1/auth/oauth/apps/{client_id} | Delete OAuth application|
|[**deleteOauthAppApiV1AuthOauthAppsClientIdDelete_0**](#deleteoauthappapiv1authoauthappsclientiddelete_0) | **DELETE** /api/v1/auth/oauth/apps/{client_id} | Delete OAuth application|
|[**getOauthAppApiV1AuthOauthAppsClientIdGet**](#getoauthappapiv1authoauthappsclientidget) | **GET** /api/v1/auth/oauth/apps/{client_id} | Get OAuth application by client_id|
|[**getOauthAppApiV1AuthOauthAppsClientIdGet_0**](#getoauthappapiv1authoauthappsclientidget_0) | **GET** /api/v1/auth/oauth/apps/{client_id} | Get OAuth application by client_id|
|[**getOauthUserApiV1AuthOauthUsersUserIdGet**](#getoauthuserapiv1authoauthusersuseridget) | **GET** /api/v1/auth/oauth/users/{user_id} | OAuth 用户详情|
|[**getOauthUserApiV1AuthOauthUsersUserIdGet_0**](#getoauthuserapiv1authoauthusersuseridget_0) | **GET** /api/v1/auth/oauth/users/{user_id} | OAuth 用户详情|
|[**listOauthAppsApiV1AuthOauthAppsListGet**](#listoauthappsapiv1authoauthappslistget) | **GET** /api/v1/auth/oauth/apps/list | List OAuth applications|
|[**listOauthAppsApiV1AuthOauthAppsListGet_0**](#listoauthappsapiv1authoauthappslistget_0) | **GET** /api/v1/auth/oauth/apps/list | List OAuth applications|
|[**listOauthUsersApiV1AuthOauthUsersListGet**](#listoauthusersapiv1authoauthuserslistget) | **GET** /api/v1/auth/oauth/users/list | OAuth 用户列表|
|[**listOauthUsersApiV1AuthOauthUsersListGet_0**](#listoauthusersapiv1authoauthuserslistget_0) | **GET** /api/v1/auth/oauth/users/list | OAuth 用户列表|
|[**oauthTokenApiV1AuthOauthTokenPost**](#oauthtokenapiv1authoauthtokenpost) | **POST** /api/v1/auth/oauth/token | Exchange code for token|
|[**oauthTokenApiV1AuthOauthTokenPost_0**](#oauthtokenapiv1authoauthtokenpost_0) | **POST** /api/v1/auth/oauth/token | Exchange code for token|

# **authorizeApiV1AuthOauthAuthorizeGet**
> any authorizeApiV1AuthOauthAuthorizeGet()

OAuth authorize. State 参数用于 CSRF 防护,客户端必须传并在回调时校验.

### Example

```typescript
import {
    OAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OAuthApi(configuration);

let clientId: string; // (default to undefined)
let redirectUri: string; // (default to undefined)
let responseType: string; // (optional) (default to 'code')
let state: string; //CSRF state parameter (optional) (default to undefined)

const { status, data } = await apiInstance.authorizeApiV1AuthOauthAuthorizeGet(
    clientId,
    redirectUri,
    responseType,
    state
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **clientId** | [**string**] |  | defaults to undefined|
| **redirectUri** | [**string**] |  | defaults to undefined|
| **responseType** | [**string**] |  | (optional) defaults to 'code'|
| **state** | [**string**] | CSRF state parameter | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authorizeApiV1AuthOauthAuthorizeGet_0**
> any authorizeApiV1AuthOauthAuthorizeGet_0()

OAuth authorize. State 参数用于 CSRF 防护,客户端必须传并在回调时校验.

### Example

```typescript
import {
    OAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OAuthApi(configuration);

let clientId: string; // (default to undefined)
let redirectUri: string; // (default to undefined)
let responseType: string; // (optional) (default to 'code')
let state: string; //CSRF state parameter (optional) (default to undefined)

const { status, data } = await apiInstance.authorizeApiV1AuthOauthAuthorizeGet_0(
    clientId,
    redirectUri,
    responseType,
    state
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **clientId** | [**string**] |  | defaults to undefined|
| **redirectUri** | [**string**] |  | defaults to undefined|
| **responseType** | [**string**] |  | (optional) defaults to 'code'|
| **state** | [**string**] | CSRF state parameter | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createOauthAppApiV1AuthOauthAppsCreatePost**
> any createOauthAppApiV1AuthOauthAppsCreatePost(oAuthAppCreateBody)

Register a new OAuth application and return client credentials.

### Example

```typescript
import {
    OAuthApi,
    Configuration,
    OAuthAppCreateBody
} from './api';

const configuration = new Configuration();
const apiInstance = new OAuthApi(configuration);

let oAuthAppCreateBody: OAuthAppCreateBody; //

const { status, data } = await apiInstance.createOauthAppApiV1AuthOauthAppsCreatePost(
    oAuthAppCreateBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **oAuthAppCreateBody** | **OAuthAppCreateBody**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createOauthAppApiV1AuthOauthAppsCreatePost_0**
> any createOauthAppApiV1AuthOauthAppsCreatePost_0(oAuthAppCreateBody)

Register a new OAuth application and return client credentials.

### Example

```typescript
import {
    OAuthApi,
    Configuration,
    OAuthAppCreateBody
} from './api';

const configuration = new Configuration();
const apiInstance = new OAuthApi(configuration);

let oAuthAppCreateBody: OAuthAppCreateBody; //

const { status, data } = await apiInstance.createOauthAppApiV1AuthOauthAppsCreatePost_0(
    oAuthAppCreateBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **oAuthAppCreateBody** | **OAuthAppCreateBody**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteOauthAppApiV1AuthOauthAppsClientIdDelete**
> any deleteOauthAppApiV1AuthOauthAppsClientIdDelete()

Delete an OAuth application by its client_id.

### Example

```typescript
import {
    OAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OAuthApi(configuration);

let clientId: string; // (default to undefined)

const { status, data } = await apiInstance.deleteOauthAppApiV1AuthOauthAppsClientIdDelete(
    clientId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **clientId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteOauthAppApiV1AuthOauthAppsClientIdDelete_0**
> any deleteOauthAppApiV1AuthOauthAppsClientIdDelete_0()

Delete an OAuth application by its client_id.

### Example

```typescript
import {
    OAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OAuthApi(configuration);

let clientId: string; // (default to undefined)

const { status, data } = await apiInstance.deleteOauthAppApiV1AuthOauthAppsClientIdDelete_0(
    clientId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **clientId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getOauthAppApiV1AuthOauthAppsClientIdGet**
> any getOauthAppApiV1AuthOauthAppsClientIdGet()

Retrieve a single OAuth application by its client_id.

### Example

```typescript
import {
    OAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OAuthApi(configuration);

let clientId: string; // (default to undefined)

const { status, data } = await apiInstance.getOauthAppApiV1AuthOauthAppsClientIdGet(
    clientId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **clientId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getOauthAppApiV1AuthOauthAppsClientIdGet_0**
> any getOauthAppApiV1AuthOauthAppsClientIdGet_0()

Retrieve a single OAuth application by its client_id.

### Example

```typescript
import {
    OAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OAuthApi(configuration);

let clientId: string; // (default to undefined)

const { status, data } = await apiInstance.getOauthAppApiV1AuthOauthAppsClientIdGet_0(
    clientId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **clientId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getOauthUserApiV1AuthOauthUsersUserIdGet**
> any getOauthUserApiV1AuthOauthUsersUserIdGet()


### Example

```typescript
import {
    OAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OAuthApi(configuration);

let userId: number; // (default to undefined)

const { status, data } = await apiInstance.getOauthUserApiV1AuthOauthUsersUserIdGet(
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getOauthUserApiV1AuthOauthUsersUserIdGet_0**
> any getOauthUserApiV1AuthOauthUsersUserIdGet_0()


### Example

```typescript
import {
    OAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OAuthApi(configuration);

let userId: number; // (default to undefined)

const { status, data } = await apiInstance.getOauthUserApiV1AuthOauthUsersUserIdGet_0(
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listOauthAppsApiV1AuthOauthAppsListGet**
> any listOauthAppsApiV1AuthOauthAppsListGet()

List all OAuth applications with pagination.

### Example

```typescript
import {
    OAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OAuthApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listOauthAppsApiV1AuthOauthAppsListGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listOauthAppsApiV1AuthOauthAppsListGet_0**
> any listOauthAppsApiV1AuthOauthAppsListGet_0()

List all OAuth applications with pagination.

### Example

```typescript
import {
    OAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OAuthApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listOauthAppsApiV1AuthOauthAppsListGet_0(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listOauthUsersApiV1AuthOauthUsersListGet**
> any listOauthUsersApiV1AuthOauthUsersListGet()


### Example

```typescript
import {
    OAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OAuthApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let provider: string; //按 provider 过滤 (optional) (default to undefined)

const { status, data } = await apiInstance.listOauthUsersApiV1AuthOauthUsersListGet(
    page,
    limit,
    provider
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **provider** | [**string**] | 按 provider 过滤 | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listOauthUsersApiV1AuthOauthUsersListGet_0**
> any listOauthUsersApiV1AuthOauthUsersListGet_0()


### Example

```typescript
import {
    OAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OAuthApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let provider: string; //按 provider 过滤 (optional) (default to undefined)

const { status, data } = await apiInstance.listOauthUsersApiV1AuthOauthUsersListGet_0(
    page,
    limit,
    provider
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **provider** | [**string**] | 按 provider 过滤 | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **oauthTokenApiV1AuthOauthTokenPost**
> any oauthTokenApiV1AuthOauthTokenPost()


### Example

```typescript
import {
    OAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OAuthApi(configuration);

let code: string; // (default to undefined)
let clientId: string; // (default to undefined)
let clientSecret: string; // (default to undefined)
let state: string; //CSRF state to verify against session (optional) (default to undefined)

const { status, data } = await apiInstance.oauthTokenApiV1AuthOauthTokenPost(
    code,
    clientId,
    clientSecret,
    state
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] |  | defaults to undefined|
| **clientId** | [**string**] |  | defaults to undefined|
| **clientSecret** | [**string**] |  | defaults to undefined|
| **state** | [**string**] | CSRF state to verify against session | (optional) defaults to undefined|


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

# **oauthTokenApiV1AuthOauthTokenPost_0**
> any oauthTokenApiV1AuthOauthTokenPost_0()


### Example

```typescript
import {
    OAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OAuthApi(configuration);

let code: string; // (default to undefined)
let clientId: string; // (default to undefined)
let clientSecret: string; // (default to undefined)
let state: string; //CSRF state to verify against session (optional) (default to undefined)

const { status, data } = await apiInstance.oauthTokenApiV1AuthOauthTokenPost_0(
    code,
    clientId,
    clientSecret,
    state
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] |  | defaults to undefined|
| **clientId** | [**string**] |  | defaults to undefined|
| **clientSecret** | [**string**] |  | defaults to undefined|
| **state** | [**string**] | CSRF state to verify against session | (optional) defaults to undefined|


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

