# AccountBindingsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**listBindingsApiV1AuthAuthBindingsGet**](AccountBindingsApi.md#listbindingsapiv1authauthbindingsget) | **GET** /api/v1/auth/auth/bindings/ | List all third-party bindings |
| [**listBindingsApiV1AuthAuthBindingsGet_0**](AccountBindingsApi.md#listbindingsapiv1authauthbindingsget_0) | **GET** /api/v1/auth/auth/bindings/ | List all third-party bindings |
| [**removeByPlatformApiV1AuthAuthBindingsRemovePost**](AccountBindingsApi.md#removebyplatformapiv1authauthbindingsremovepost) | **POST** /api/v1/auth/auth/bindings/remove | Unbind third-party account by platform |
| [**removeByPlatformApiV1AuthAuthBindingsRemovePost_0**](AccountBindingsApi.md#removebyplatformapiv1authauthbindingsremovepost_0) | **POST** /api/v1/auth/auth/bindings/remove | Unbind third-party account by platform |
| [**unbindApiV1AuthAuthBindingsBindingIdDelete**](AccountBindingsApi.md#unbindapiv1authauthbindingsbindingiddelete) | **DELETE** /api/v1/auth/auth/bindings/{binding_id} | Unbind third-party account by ID |
| [**unbindApiV1AuthAuthBindingsBindingIdDelete_0**](AccountBindingsApi.md#unbindapiv1authauthbindingsbindingiddelete_0) | **DELETE** /api/v1/auth/auth/bindings/{binding_id} | Unbind third-party account by ID |



## listBindingsApiV1AuthAuthBindingsGet

> any listBindingsApiV1AuthAuthBindingsGet()

List all third-party bindings

Get all third-party account bindings for the current user.  Matches Java: AuthorizationManagementServlet.getList(uuid)

### Example

```ts
import {
  Configuration,
  AccountBindingsApi,
} from '';
import type { ListBindingsApiV1AuthAuthBindingsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountBindingsApi(config);

  try {
    const data = await api.listBindingsApiV1AuthAuthBindingsGet();
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listBindingsApiV1AuthAuthBindingsGet_0

> any listBindingsApiV1AuthAuthBindingsGet_0()

List all third-party bindings

Get all third-party account bindings for the current user.  Matches Java: AuthorizationManagementServlet.getList(uuid)

### Example

```ts
import {
  Configuration,
  AccountBindingsApi,
} from '';
import type { ListBindingsApiV1AuthAuthBindingsGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountBindingsApi(config);

  try {
    const data = await api.listBindingsApiV1AuthAuthBindingsGet_0();
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## removeByPlatformApiV1AuthAuthBindingsRemovePost

> any removeByPlatformApiV1AuthAuthBindingsRemovePost(bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost)

Unbind third-party account by platform

Remove a third-party account binding by uuid + platform.  Matches Java: AuthorizationManagementController.delAuth -&gt; AuthorizationManagementServlet.delAuth(uuid, platform) SQL: DELETE FROM user_third_party_accounts WHERE user_uuid &#x3D; #{uuid} AND platform &#x3D; #{platform}

### Example

```ts
import {
  Configuration,
  AccountBindingsApi,
} from '';
import type { RemoveByPlatformApiV1AuthAuthBindingsRemovePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AccountBindingsApi();

  const body = {
    // BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost
    bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost: ...,
  } satisfies RemoveByPlatformApiV1AuthAuthBindingsRemovePostRequest;

  try {
    const data = await api.removeByPlatformApiV1AuthAuthBindingsRemovePost(body);
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
| **bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost** | [BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost](BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## removeByPlatformApiV1AuthAuthBindingsRemovePost_0

> any removeByPlatformApiV1AuthAuthBindingsRemovePost_0(bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost)

Unbind third-party account by platform

Remove a third-party account binding by uuid + platform.  Matches Java: AuthorizationManagementController.delAuth -&gt; AuthorizationManagementServlet.delAuth(uuid, platform) SQL: DELETE FROM user_third_party_accounts WHERE user_uuid &#x3D; #{uuid} AND platform &#x3D; #{platform}

### Example

```ts
import {
  Configuration,
  AccountBindingsApi,
} from '';
import type { RemoveByPlatformApiV1AuthAuthBindingsRemovePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AccountBindingsApi();

  const body = {
    // BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost
    bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost: ...,
  } satisfies RemoveByPlatformApiV1AuthAuthBindingsRemovePost0Request;

  try {
    const data = await api.removeByPlatformApiV1AuthAuthBindingsRemovePost_0(body);
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
| **bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost** | [BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost](BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## unbindApiV1AuthAuthBindingsBindingIdDelete

> any unbindApiV1AuthAuthBindingsBindingIdDelete(bindingId)

Unbind third-party account by ID

Remove a third-party account binding by ID.

### Example

```ts
import {
  Configuration,
  AccountBindingsApi,
} from '';
import type { UnbindApiV1AuthAuthBindingsBindingIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountBindingsApi(config);

  const body = {
    // number
    bindingId: 56,
  } satisfies UnbindApiV1AuthAuthBindingsBindingIdDeleteRequest;

  try {
    const data = await api.unbindApiV1AuthAuthBindingsBindingIdDelete(body);
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
| **bindingId** | `number` |  | [Defaults to `undefined`] |

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


## unbindApiV1AuthAuthBindingsBindingIdDelete_0

> any unbindApiV1AuthAuthBindingsBindingIdDelete_0(bindingId)

Unbind third-party account by ID

Remove a third-party account binding by ID.

### Example

```ts
import {
  Configuration,
  AccountBindingsApi,
} from '';
import type { UnbindApiV1AuthAuthBindingsBindingIdDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountBindingsApi(config);

  const body = {
    // number
    bindingId: 56,
  } satisfies UnbindApiV1AuthAuthBindingsBindingIdDelete0Request;

  try {
    const data = await api.unbindApiV1AuthAuthBindingsBindingIdDelete_0(body);
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
| **bindingId** | `number` |  | [Defaults to `undefined`] |

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

