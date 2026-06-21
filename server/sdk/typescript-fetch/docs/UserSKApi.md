# UserSKApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createSkApiV1AuthUserSkCreatePost**](UserSKApi.md#createskapiv1authuserskcreatepost) | **POST** /api/v1/auth/user-sk/create | Create a secret key |
| [**createSkApiV1AuthUserSkCreatePost_0**](UserSKApi.md#createskapiv1authuserskcreatepost_0) | **POST** /api/v1/auth/user-sk/create | Create a secret key |
| [**deleteSkApiV1AuthUserSkSkIdDelete**](UserSKApi.md#deleteskapiv1authuserskskiddelete) | **DELETE** /api/v1/auth/user-sk/{sk_id} | Delete a secret key |
| [**deleteSkApiV1AuthUserSkSkIdDelete_0**](UserSKApi.md#deleteskapiv1authuserskskiddelete_0) | **DELETE** /api/v1/auth/user-sk/{sk_id} | Delete a secret key |
| [**listSksApiV1AuthUserSkListGet**](UserSKApi.md#listsksapiv1authusersklistget) | **GET** /api/v1/auth/user-sk/list | List user secret keys |
| [**listSksApiV1AuthUserSkListGet_0**](UserSKApi.md#listsksapiv1authusersklistget_0) | **GET** /api/v1/auth/user-sk/list | List user secret keys |
| [**updateSkApiV1AuthUserSkSkIdPut**](UserSKApi.md#updateskapiv1authuserskskidput) | **PUT** /api/v1/auth/user-sk/{sk_id} | Update a secret key |
| [**updateSkApiV1AuthUserSkSkIdPut_0**](UserSKApi.md#updateskapiv1authuserskskidput_0) | **PUT** /api/v1/auth/user-sk/{sk_id} | Update a secret key |



## createSkApiV1AuthUserSkCreatePost

> any createSkApiV1AuthUserSkCreatePost(body)

Create a secret key

Generate a new secret key for the authenticated user.

### Example

```ts
import {
  Configuration,
  UserSKApi,
} from '';
import type { CreateSkApiV1AuthUserSkCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UserSKApi(config);

  const body = {
    // object
    body: Object,
  } satisfies CreateSkApiV1AuthUserSkCreatePostRequest;

  try {
    const data = await api.createSkApiV1AuthUserSkCreatePost(body);
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
| **body** | `object` |  | |

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


## createSkApiV1AuthUserSkCreatePost_0

> any createSkApiV1AuthUserSkCreatePost_0(body)

Create a secret key

Generate a new secret key for the authenticated user.

### Example

```ts
import {
  Configuration,
  UserSKApi,
} from '';
import type { CreateSkApiV1AuthUserSkCreatePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UserSKApi(config);

  const body = {
    // object
    body: Object,
  } satisfies CreateSkApiV1AuthUserSkCreatePost0Request;

  try {
    const data = await api.createSkApiV1AuthUserSkCreatePost_0(body);
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
| **body** | `object` |  | |

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


## deleteSkApiV1AuthUserSkSkIdDelete

> any deleteSkApiV1AuthUserSkSkIdDelete(skId)

Delete a secret key

Delete a secret key owned by the authenticated user.

### Example

```ts
import {
  Configuration,
  UserSKApi,
} from '';
import type { DeleteSkApiV1AuthUserSkSkIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UserSKApi(config);

  const body = {
    // number
    skId: 56,
  } satisfies DeleteSkApiV1AuthUserSkSkIdDeleteRequest;

  try {
    const data = await api.deleteSkApiV1AuthUserSkSkIdDelete(body);
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
| **skId** | `number` |  | [Defaults to `undefined`] |

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


## deleteSkApiV1AuthUserSkSkIdDelete_0

> any deleteSkApiV1AuthUserSkSkIdDelete_0(skId)

Delete a secret key

Delete a secret key owned by the authenticated user.

### Example

```ts
import {
  Configuration,
  UserSKApi,
} from '';
import type { DeleteSkApiV1AuthUserSkSkIdDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UserSKApi(config);

  const body = {
    // number
    skId: 56,
  } satisfies DeleteSkApiV1AuthUserSkSkIdDelete0Request;

  try {
    const data = await api.deleteSkApiV1AuthUserSkSkIdDelete_0(body);
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
| **skId** | `number` |  | [Defaults to `undefined`] |

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


## listSksApiV1AuthUserSkListGet

> any listSksApiV1AuthUserSkListGet(page, limit)

List user secret keys

List all secret keys for the authenticated user with pagination.

### Example

```ts
import {
  Configuration,
  UserSKApi,
} from '';
import type { ListSksApiV1AuthUserSkListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UserSKApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListSksApiV1AuthUserSkListGetRequest;

  try {
    const data = await api.listSksApiV1AuthUserSkListGet(body);
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


## listSksApiV1AuthUserSkListGet_0

> any listSksApiV1AuthUserSkListGet_0(page, limit)

List user secret keys

List all secret keys for the authenticated user with pagination.

### Example

```ts
import {
  Configuration,
  UserSKApi,
} from '';
import type { ListSksApiV1AuthUserSkListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UserSKApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListSksApiV1AuthUserSkListGet0Request;

  try {
    const data = await api.listSksApiV1AuthUserSkListGet_0(body);
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


## updateSkApiV1AuthUserSkSkIdPut

> any updateSkApiV1AuthUserSkSkIdPut(skId, sKUpdateBody)

Update a secret key

Update secret key name or status.

### Example

```ts
import {
  Configuration,
  UserSKApi,
} from '';
import type { UpdateSkApiV1AuthUserSkSkIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UserSKApi(config);

  const body = {
    // number
    skId: 56,
    // SKUpdateBody
    sKUpdateBody: ...,
  } satisfies UpdateSkApiV1AuthUserSkSkIdPutRequest;

  try {
    const data = await api.updateSkApiV1AuthUserSkSkIdPut(body);
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
| **skId** | `number` |  | [Defaults to `undefined`] |
| **sKUpdateBody** | [SKUpdateBody](SKUpdateBody.md) |  | |

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


## updateSkApiV1AuthUserSkSkIdPut_0

> any updateSkApiV1AuthUserSkSkIdPut_0(skId, sKUpdateBody)

Update a secret key

Update secret key name or status.

### Example

```ts
import {
  Configuration,
  UserSKApi,
} from '';
import type { UpdateSkApiV1AuthUserSkSkIdPut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UserSKApi(config);

  const body = {
    // number
    skId: 56,
    // SKUpdateBody
    sKUpdateBody: ...,
  } satisfies UpdateSkApiV1AuthUserSkSkIdPut0Request;

  try {
    const data = await api.updateSkApiV1AuthUserSkSkIdPut_0(body);
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
| **skId** | `number` |  | [Defaults to `undefined`] |
| **sKUpdateBody** | [SKUpdateBody](SKUpdateBody.md) |  | |

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

