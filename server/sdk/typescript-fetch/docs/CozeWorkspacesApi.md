# CozeWorkspacesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost**](CozeWorkspacesApi.md#createmembersapiv1cozeworkspacesworkspacesmemberscreatepost) | **POST** /api/v1/coze/workspaces/workspaces/members/create | Create Members |
| [**createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0**](CozeWorkspacesApi.md#createmembersapiv1cozeworkspacesworkspacesmemberscreatepost_0) | **POST** /api/v1/coze/workspaces/workspaces/members/create | Create Members |
| [**deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost**](CozeWorkspacesApi.md#deletemembersapiv1cozeworkspacesworkspacesmembersdeletepost) | **POST** /api/v1/coze/workspaces/workspaces/members/delete | Delete Members |
| [**deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0**](CozeWorkspacesApi.md#deletemembersapiv1cozeworkspacesworkspacesmembersdeletepost_0) | **POST** /api/v1/coze/workspaces/workspaces/members/delete | Delete Members |
| [**listWorkspacesApiV1CozeWorkspacesWorkspacesListGet**](CozeWorkspacesApi.md#listworkspacesapiv1cozeworkspacesworkspaceslistget) | **GET** /api/v1/coze/workspaces/workspaces/list | List Workspaces |
| [**listWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0**](CozeWorkspacesApi.md#listworkspacesapiv1cozeworkspacesworkspaceslistget_0) | **GET** /api/v1/coze/workspaces/workspaces/list | List Workspaces |



## createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost

> any createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost(membersReq)

Create Members

### Example

```ts
import {
  Configuration,
  CozeWorkspacesApi,
} from '';
import type { CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeWorkspacesApi();

  const body = {
    // MembersReq
    membersReq: ...,
  } satisfies CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePostRequest;

  try {
    const data = await api.createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost(body);
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
| **membersReq** | [MembersReq](MembersReq.md) |  | |

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


## createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0

> any createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0(membersReq)

Create Members

### Example

```ts
import {
  Configuration,
  CozeWorkspacesApi,
} from '';
import type { CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeWorkspacesApi();

  const body = {
    // MembersReq
    membersReq: ...,
  } satisfies CreateMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost0Request;

  try {
    const data = await api.createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0(body);
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
| **membersReq** | [MembersReq](MembersReq.md) |  | |

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


## deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost

> any deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost(deleteMembersReq)

Delete Members

### Example

```ts
import {
  Configuration,
  CozeWorkspacesApi,
} from '';
import type { DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeWorkspacesApi();

  const body = {
    // DeleteMembersReq
    deleteMembersReq: ...,
  } satisfies DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePostRequest;

  try {
    const data = await api.deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost(body);
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
| **deleteMembersReq** | [DeleteMembersReq](DeleteMembersReq.md) |  | |

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


## deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0

> any deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0(deleteMembersReq)

Delete Members

### Example

```ts
import {
  Configuration,
  CozeWorkspacesApi,
} from '';
import type { DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeWorkspacesApi();

  const body = {
    // DeleteMembersReq
    deleteMembersReq: ...,
  } satisfies DeleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost0Request;

  try {
    const data = await api.deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0(body);
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
| **deleteMembersReq** | [DeleteMembersReq](DeleteMembersReq.md) |  | |

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


## listWorkspacesApiV1CozeWorkspacesWorkspacesListGet

> any listWorkspacesApiV1CozeWorkspacesWorkspacesListGet(page, size)

List Workspaces

### Example

```ts
import {
  Configuration,
  CozeWorkspacesApi,
} from '';
import type { ListWorkspacesApiV1CozeWorkspacesWorkspacesListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeWorkspacesApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies ListWorkspacesApiV1CozeWorkspacesWorkspacesListGetRequest;

  try {
    const data = await api.listWorkspacesApiV1CozeWorkspacesWorkspacesListGet(body);
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
| **size** | `number` |  | [Optional] [Defaults to `20`] |

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


## listWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0

> any listWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0(page, size)

List Workspaces

### Example

```ts
import {
  Configuration,
  CozeWorkspacesApi,
} from '';
import type { ListWorkspacesApiV1CozeWorkspacesWorkspacesListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeWorkspacesApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies ListWorkspacesApiV1CozeWorkspacesWorkspacesListGet0Request;

  try {
    const data = await api.listWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0(body);
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
| **size** | `number` |  | [Optional] [Defaults to `20`] |

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

