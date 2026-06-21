# OAuthApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**authorizeApiV1AuthOauthAuthorizeGet**](OAuthApi.md#authorizeapiv1authoauthauthorizeget) | **GET** /api/v1/auth/oauth/authorize | OAuth authorize |
| [**authorizeApiV1AuthOauthAuthorizeGet_0**](OAuthApi.md#authorizeapiv1authoauthauthorizeget_0) | **GET** /api/v1/auth/oauth/authorize | OAuth authorize |
| [**createOauthAppApiV1AuthOauthAppsCreatePost**](OAuthApi.md#createoauthappapiv1authoauthappscreatepost) | **POST** /api/v1/auth/oauth/apps/create | Create an OAuth application |
| [**createOauthAppApiV1AuthOauthAppsCreatePost_0**](OAuthApi.md#createoauthappapiv1authoauthappscreatepost_0) | **POST** /api/v1/auth/oauth/apps/create | Create an OAuth application |
| [**deleteOauthAppApiV1AuthOauthAppsClientIdDelete**](OAuthApi.md#deleteoauthappapiv1authoauthappsclientiddelete) | **DELETE** /api/v1/auth/oauth/apps/{client_id} | Delete OAuth application |
| [**deleteOauthAppApiV1AuthOauthAppsClientIdDelete_0**](OAuthApi.md#deleteoauthappapiv1authoauthappsclientiddelete_0) | **DELETE** /api/v1/auth/oauth/apps/{client_id} | Delete OAuth application |
| [**getOauthAppApiV1AuthOauthAppsClientIdGet**](OAuthApi.md#getoauthappapiv1authoauthappsclientidget) | **GET** /api/v1/auth/oauth/apps/{client_id} | Get OAuth application by client_id |
| [**getOauthAppApiV1AuthOauthAppsClientIdGet_0**](OAuthApi.md#getoauthappapiv1authoauthappsclientidget_0) | **GET** /api/v1/auth/oauth/apps/{client_id} | Get OAuth application by client_id |
| [**getOauthUserApiV1AuthOauthUsersUserIdGet**](OAuthApi.md#getoauthuserapiv1authoauthusersuseridget) | **GET** /api/v1/auth/oauth/users/{user_id} | OAuth 用户详情 |
| [**getOauthUserApiV1AuthOauthUsersUserIdGet_0**](OAuthApi.md#getoauthuserapiv1authoauthusersuseridget_0) | **GET** /api/v1/auth/oauth/users/{user_id} | OAuth 用户详情 |
| [**listOauthAppsApiV1AuthOauthAppsListGet**](OAuthApi.md#listoauthappsapiv1authoauthappslistget) | **GET** /api/v1/auth/oauth/apps/list | List OAuth applications |
| [**listOauthAppsApiV1AuthOauthAppsListGet_0**](OAuthApi.md#listoauthappsapiv1authoauthappslistget_0) | **GET** /api/v1/auth/oauth/apps/list | List OAuth applications |
| [**listOauthUsersApiV1AuthOauthUsersListGet**](OAuthApi.md#listoauthusersapiv1authoauthuserslistget) | **GET** /api/v1/auth/oauth/users/list | OAuth 用户列表 |
| [**listOauthUsersApiV1AuthOauthUsersListGet_0**](OAuthApi.md#listoauthusersapiv1authoauthuserslistget_0) | **GET** /api/v1/auth/oauth/users/list | OAuth 用户列表 |
| [**oauthTokenApiV1AuthOauthTokenPost**](OAuthApi.md#oauthtokenapiv1authoauthtokenpost) | **POST** /api/v1/auth/oauth/token | Exchange code for token |
| [**oauthTokenApiV1AuthOauthTokenPost_0**](OAuthApi.md#oauthtokenapiv1authoauthtokenpost_0) | **POST** /api/v1/auth/oauth/token | Exchange code for token |



## authorizeApiV1AuthOauthAuthorizeGet

> any authorizeApiV1AuthOauthAuthorizeGet(clientId, redirectUri, responseType, state)

OAuth authorize

OAuth authorize. State 参数用于 CSRF 防护,客户端必须传并在回调时校验.

### Example

```ts
import {
  Configuration,
  OAuthApi,
} from '';
import type { AuthorizeApiV1AuthOauthAuthorizeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OAuthApi(config);

  const body = {
    // string
    clientId: clientId_example,
    // string
    redirectUri: redirectUri_example,
    // string (optional)
    responseType: responseType_example,
    // string | CSRF state parameter (optional)
    state: state_example,
  } satisfies AuthorizeApiV1AuthOauthAuthorizeGetRequest;

  try {
    const data = await api.authorizeApiV1AuthOauthAuthorizeGet(body);
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
| **clientId** | `string` |  | [Defaults to `undefined`] |
| **redirectUri** | `string` |  | [Defaults to `undefined`] |
| **responseType** | `string` |  | [Optional] [Defaults to `&#39;code&#39;`] |
| **state** | `string` | CSRF state parameter | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authorizeApiV1AuthOauthAuthorizeGet_0

> any authorizeApiV1AuthOauthAuthorizeGet_0(clientId, redirectUri, responseType, state)

OAuth authorize

OAuth authorize. State 参数用于 CSRF 防护,客户端必须传并在回调时校验.

### Example

```ts
import {
  Configuration,
  OAuthApi,
} from '';
import type { AuthorizeApiV1AuthOauthAuthorizeGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OAuthApi(config);

  const body = {
    // string
    clientId: clientId_example,
    // string
    redirectUri: redirectUri_example,
    // string (optional)
    responseType: responseType_example,
    // string | CSRF state parameter (optional)
    state: state_example,
  } satisfies AuthorizeApiV1AuthOauthAuthorizeGet0Request;

  try {
    const data = await api.authorizeApiV1AuthOauthAuthorizeGet_0(body);
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
| **clientId** | `string` |  | [Defaults to `undefined`] |
| **redirectUri** | `string` |  | [Defaults to `undefined`] |
| **responseType** | `string` |  | [Optional] [Defaults to `&#39;code&#39;`] |
| **state** | `string` | CSRF state parameter | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createOauthAppApiV1AuthOauthAppsCreatePost

> any createOauthAppApiV1AuthOauthAppsCreatePost(oAuthAppCreateBody)

Create an OAuth application

Register a new OAuth application and return client credentials.

### Example

```ts
import {
  Configuration,
  OAuthApi,
} from '';
import type { CreateOauthAppApiV1AuthOauthAppsCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OAuthApi(config);

  const body = {
    // OAuthAppCreateBody
    oAuthAppCreateBody: ...,
  } satisfies CreateOauthAppApiV1AuthOauthAppsCreatePostRequest;

  try {
    const data = await api.createOauthAppApiV1AuthOauthAppsCreatePost(body);
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
| **oAuthAppCreateBody** | [OAuthAppCreateBody](OAuthAppCreateBody.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createOauthAppApiV1AuthOauthAppsCreatePost_0

> any createOauthAppApiV1AuthOauthAppsCreatePost_0(oAuthAppCreateBody)

Create an OAuth application

Register a new OAuth application and return client credentials.

### Example

```ts
import {
  Configuration,
  OAuthApi,
} from '';
import type { CreateOauthAppApiV1AuthOauthAppsCreatePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OAuthApi(config);

  const body = {
    // OAuthAppCreateBody
    oAuthAppCreateBody: ...,
  } satisfies CreateOauthAppApiV1AuthOauthAppsCreatePost0Request;

  try {
    const data = await api.createOauthAppApiV1AuthOauthAppsCreatePost_0(body);
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
| **oAuthAppCreateBody** | [OAuthAppCreateBody](OAuthAppCreateBody.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteOauthAppApiV1AuthOauthAppsClientIdDelete

> any deleteOauthAppApiV1AuthOauthAppsClientIdDelete(clientId)

Delete OAuth application

Delete an OAuth application by its client_id.

### Example

```ts
import {
  Configuration,
  OAuthApi,
} from '';
import type { DeleteOauthAppApiV1AuthOauthAppsClientIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OAuthApi(config);

  const body = {
    // string
    clientId: clientId_example,
  } satisfies DeleteOauthAppApiV1AuthOauthAppsClientIdDeleteRequest;

  try {
    const data = await api.deleteOauthAppApiV1AuthOauthAppsClientIdDelete(body);
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
| **clientId** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteOauthAppApiV1AuthOauthAppsClientIdDelete_0

> any deleteOauthAppApiV1AuthOauthAppsClientIdDelete_0(clientId)

Delete OAuth application

Delete an OAuth application by its client_id.

### Example

```ts
import {
  Configuration,
  OAuthApi,
} from '';
import type { DeleteOauthAppApiV1AuthOauthAppsClientIdDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OAuthApi(config);

  const body = {
    // string
    clientId: clientId_example,
  } satisfies DeleteOauthAppApiV1AuthOauthAppsClientIdDelete0Request;

  try {
    const data = await api.deleteOauthAppApiV1AuthOauthAppsClientIdDelete_0(body);
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
| **clientId** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getOauthAppApiV1AuthOauthAppsClientIdGet

> any getOauthAppApiV1AuthOauthAppsClientIdGet(clientId)

Get OAuth application by client_id

Retrieve a single OAuth application by its client_id.

### Example

```ts
import {
  Configuration,
  OAuthApi,
} from '';
import type { GetOauthAppApiV1AuthOauthAppsClientIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OAuthApi(config);

  const body = {
    // string
    clientId: clientId_example,
  } satisfies GetOauthAppApiV1AuthOauthAppsClientIdGetRequest;

  try {
    const data = await api.getOauthAppApiV1AuthOauthAppsClientIdGet(body);
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
| **clientId** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getOauthAppApiV1AuthOauthAppsClientIdGet_0

> any getOauthAppApiV1AuthOauthAppsClientIdGet_0(clientId)

Get OAuth application by client_id

Retrieve a single OAuth application by its client_id.

### Example

```ts
import {
  Configuration,
  OAuthApi,
} from '';
import type { GetOauthAppApiV1AuthOauthAppsClientIdGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OAuthApi(config);

  const body = {
    // string
    clientId: clientId_example,
  } satisfies GetOauthAppApiV1AuthOauthAppsClientIdGet0Request;

  try {
    const data = await api.getOauthAppApiV1AuthOauthAppsClientIdGet_0(body);
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
| **clientId** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getOauthUserApiV1AuthOauthUsersUserIdGet

> any getOauthUserApiV1AuthOauthUsersUserIdGet(userId)

OAuth 用户详情

### Example

```ts
import {
  Configuration,
  OAuthApi,
} from '';
import type { GetOauthUserApiV1AuthOauthUsersUserIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OAuthApi(config);

  const body = {
    // number
    userId: 56,
  } satisfies GetOauthUserApiV1AuthOauthUsersUserIdGetRequest;

  try {
    const data = await api.getOauthUserApiV1AuthOauthUsersUserIdGet(body);
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
| **userId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getOauthUserApiV1AuthOauthUsersUserIdGet_0

> any getOauthUserApiV1AuthOauthUsersUserIdGet_0(userId)

OAuth 用户详情

### Example

```ts
import {
  Configuration,
  OAuthApi,
} from '';
import type { GetOauthUserApiV1AuthOauthUsersUserIdGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OAuthApi(config);

  const body = {
    // number
    userId: 56,
  } satisfies GetOauthUserApiV1AuthOauthUsersUserIdGet0Request;

  try {
    const data = await api.getOauthUserApiV1AuthOauthUsersUserIdGet_0(body);
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
| **userId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listOauthAppsApiV1AuthOauthAppsListGet

> any listOauthAppsApiV1AuthOauthAppsListGet(page, limit)

List OAuth applications

List all OAuth applications with pagination.

### Example

```ts
import {
  Configuration,
  OAuthApi,
} from '';
import type { ListOauthAppsApiV1AuthOauthAppsListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OAuthApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListOauthAppsApiV1AuthOauthAppsListGetRequest;

  try {
    const data = await api.listOauthAppsApiV1AuthOauthAppsListGet(body);
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

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listOauthAppsApiV1AuthOauthAppsListGet_0

> any listOauthAppsApiV1AuthOauthAppsListGet_0(page, limit)

List OAuth applications

List all OAuth applications with pagination.

### Example

```ts
import {
  Configuration,
  OAuthApi,
} from '';
import type { ListOauthAppsApiV1AuthOauthAppsListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OAuthApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListOauthAppsApiV1AuthOauthAppsListGet0Request;

  try {
    const data = await api.listOauthAppsApiV1AuthOauthAppsListGet_0(body);
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

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listOauthUsersApiV1AuthOauthUsersListGet

> any listOauthUsersApiV1AuthOauthUsersListGet(page, limit, provider)

OAuth 用户列表

### Example

```ts
import {
  Configuration,
  OAuthApi,
} from '';
import type { ListOauthUsersApiV1AuthOauthUsersListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OAuthApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string | 按 provider 过滤 (optional)
    provider: provider_example,
  } satisfies ListOauthUsersApiV1AuthOauthUsersListGetRequest;

  try {
    const data = await api.listOauthUsersApiV1AuthOauthUsersListGet(body);
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
| **provider** | `string` | 按 provider 过滤 | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listOauthUsersApiV1AuthOauthUsersListGet_0

> any listOauthUsersApiV1AuthOauthUsersListGet_0(page, limit, provider)

OAuth 用户列表

### Example

```ts
import {
  Configuration,
  OAuthApi,
} from '';
import type { ListOauthUsersApiV1AuthOauthUsersListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OAuthApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string | 按 provider 过滤 (optional)
    provider: provider_example,
  } satisfies ListOauthUsersApiV1AuthOauthUsersListGet0Request;

  try {
    const data = await api.listOauthUsersApiV1AuthOauthUsersListGet_0(body);
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
| **provider** | `string` | 按 provider 过滤 | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## oauthTokenApiV1AuthOauthTokenPost

> any oauthTokenApiV1AuthOauthTokenPost(code, clientId, clientSecret, state)

Exchange code for token

### Example

```ts
import {
  Configuration,
  OAuthApi,
} from '';
import type { OauthTokenApiV1AuthOauthTokenPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OAuthApi();

  const body = {
    // string
    code: code_example,
    // string
    clientId: clientId_example,
    // string
    clientSecret: clientSecret_example,
    // string | CSRF state to verify against session (optional)
    state: state_example,
  } satisfies OauthTokenApiV1AuthOauthTokenPostRequest;

  try {
    const data = await api.oauthTokenApiV1AuthOauthTokenPost(body);
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
| **code** | `string` |  | [Defaults to `undefined`] |
| **clientId** | `string` |  | [Defaults to `undefined`] |
| **clientSecret** | `string` |  | [Defaults to `undefined`] |
| **state** | `string` | CSRF state to verify against session | [Optional] [Defaults to `undefined`] |

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


## oauthTokenApiV1AuthOauthTokenPost_0

> any oauthTokenApiV1AuthOauthTokenPost_0(code, clientId, clientSecret, state)

Exchange code for token

### Example

```ts
import {
  Configuration,
  OAuthApi,
} from '';
import type { OauthTokenApiV1AuthOauthTokenPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OAuthApi();

  const body = {
    // string
    code: code_example,
    // string
    clientId: clientId_example,
    // string
    clientSecret: clientSecret_example,
    // string | CSRF state to verify against session (optional)
    state: state_example,
  } satisfies OauthTokenApiV1AuthOauthTokenPost0Request;

  try {
    const data = await api.oauthTokenApiV1AuthOauthTokenPost_0(body);
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
| **code** | `string` |  | [Defaults to `undefined`] |
| **clientId** | `string` |  | [Defaults to `undefined`] |
| **clientSecret** | `string` |  | [Defaults to `undefined`] |
| **state** | `string` | CSRF state to verify against session | [Optional] [Defaults to `undefined`] |

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

