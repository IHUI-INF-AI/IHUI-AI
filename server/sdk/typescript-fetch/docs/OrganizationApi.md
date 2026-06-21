# OrganizationApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addMemberApiV1OrganizationOidMemberPost**](OrganizationApi.md#addmemberapiv1organizationoidmemberpost) | **POST** /api/v1/organization/{oid}/member | 添加成员 |
| [**addMemberApiV1OrganizationOidMemberPost_0**](OrganizationApi.md#addmemberapiv1organizationoidmemberpost_0) | **POST** /api/v1/organization/{oid}/member | 添加成员 |
| [**createOrganizationApiV1OrganizationPost**](OrganizationApi.md#createorganizationapiv1organizationpost) | **POST** /api/v1/organization | 创建组织 |
| [**createOrganizationApiV1OrganizationPost_0**](OrganizationApi.md#createorganizationapiv1organizationpost_0) | **POST** /api/v1/organization | 创建组织 |
| [**deleteOrganizationApiV1OrganizationOidDelete**](OrganizationApi.md#deleteorganizationapiv1organizationoiddelete) | **DELETE** /api/v1/organization/{oid} | 删除组织 |
| [**deleteOrganizationApiV1OrganizationOidDelete_0**](OrganizationApi.md#deleteorganizationapiv1organizationoiddelete_0) | **DELETE** /api/v1/organization/{oid} | 删除组织 |
| [**getOrganizationApiV1OrganizationOidGet**](OrganizationApi.md#getorganizationapiv1organizationoidget) | **GET** /api/v1/organization/{oid} | 组织详情 |
| [**getOrganizationApiV1OrganizationOidGet_0**](OrganizationApi.md#getorganizationapiv1organizationoidget_0) | **GET** /api/v1/organization/{oid} | 组织详情 |
| [**listMembersApiV1OrganizationOidMembersGet**](OrganizationApi.md#listmembersapiv1organizationoidmembersget) | **GET** /api/v1/organization/{oid}/members | 组织成员 |
| [**listMembersApiV1OrganizationOidMembersGet_0**](OrganizationApi.md#listmembersapiv1organizationoidmembersget_0) | **GET** /api/v1/organization/{oid}/members | 组织成员 |
| [**listOrganizationsApiV1OrganizationListGet**](OrganizationApi.md#listorganizationsapiv1organizationlistget) | **GET** /api/v1/organization/list | 组织列表 |
| [**listOrganizationsApiV1OrganizationListGet_0**](OrganizationApi.md#listorganizationsapiv1organizationlistget_0) | **GET** /api/v1/organization/list | 组织列表 |
| [**orgTreeApiV1OrganizationTreeGet**](OrganizationApi.md#orgtreeapiv1organizationtreeget) | **GET** /api/v1/organization/tree | 组织树 |
| [**orgTreeApiV1OrganizationTreeGet_0**](OrganizationApi.md#orgtreeapiv1organizationtreeget_0) | **GET** /api/v1/organization/tree | 组织树 |
| [**removeMemberApiV1OrganizationOidMemberUserIdDelete**](OrganizationApi.md#removememberapiv1organizationoidmemberuseriddelete) | **DELETE** /api/v1/organization/{oid}/member/{user_id} | 移除成员 |
| [**removeMemberApiV1OrganizationOidMemberUserIdDelete_0**](OrganizationApi.md#removememberapiv1organizationoidmemberuseriddelete_0) | **DELETE** /api/v1/organization/{oid}/member/{user_id} | 移除成员 |
| [**updateOrganizationApiV1OrganizationOidPut**](OrganizationApi.md#updateorganizationapiv1organizationoidput) | **PUT** /api/v1/organization/{oid} | 修改组织 |
| [**updateOrganizationApiV1OrganizationOidPut_0**](OrganizationApi.md#updateorganizationapiv1organizationoidput_0) | **PUT** /api/v1/organization/{oid} | 修改组织 |



## addMemberApiV1OrganizationOidMemberPost

> any addMemberApiV1OrganizationOidMemberPost(oid, userId, role, position)

添加成员

### Example

```ts
import {
  Configuration,
  OrganizationApi,
} from '';
import type { AddMemberApiV1OrganizationOidMemberPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationApi();

  const body = {
    // number
    oid: 56,
    // string
    userId: userId_example,
    // string (optional)
    role: role_example,
    // string (optional)
    position: position_example,
  } satisfies AddMemberApiV1OrganizationOidMemberPostRequest;

  try {
    const data = await api.addMemberApiV1OrganizationOidMemberPost(body);
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
| **oid** | `number` |  | [Defaults to `undefined`] |
| **userId** | `string` |  | [Defaults to `undefined`] |
| **role** | `string` |  | [Optional] [Defaults to `&#39;member&#39;`] |
| **position** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## addMemberApiV1OrganizationOidMemberPost_0

> any addMemberApiV1OrganizationOidMemberPost_0(oid, userId, role, position)

添加成员

### Example

```ts
import {
  Configuration,
  OrganizationApi,
} from '';
import type { AddMemberApiV1OrganizationOidMemberPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationApi();

  const body = {
    // number
    oid: 56,
    // string
    userId: userId_example,
    // string (optional)
    role: role_example,
    // string (optional)
    position: position_example,
  } satisfies AddMemberApiV1OrganizationOidMemberPost0Request;

  try {
    const data = await api.addMemberApiV1OrganizationOidMemberPost_0(body);
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
| **oid** | `number` |  | [Defaults to `undefined`] |
| **userId** | `string` |  | [Defaults to `undefined`] |
| **role** | `string` |  | [Optional] [Defaults to `&#39;member&#39;`] |
| **position** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## createOrganizationApiV1OrganizationPost

> any createOrganizationApiV1OrganizationPost(name, pid, type, shortName, code, description, leader, leaderPhone, logo, address, sortOrder)

创建组织

### Example

```ts
import {
  Configuration,
  OrganizationApi,
} from '';
import type { CreateOrganizationApiV1OrganizationPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationApi();

  const body = {
    // string
    name: name_example,
    // number (optional)
    pid: 56,
    // string (optional)
    type: type_example,
    // string (optional)
    shortName: shortName_example,
    // string (optional)
    code: code_example,
    // string (optional)
    description: description_example,
    // string (optional)
    leader: leader_example,
    // string (optional)
    leaderPhone: leaderPhone_example,
    // string (optional)
    logo: logo_example,
    // string (optional)
    address: address_example,
    // number (optional)
    sortOrder: 56,
  } satisfies CreateOrganizationApiV1OrganizationPostRequest;

  try {
    const data = await api.createOrganizationApiV1OrganizationPost(body);
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
| **name** | `string` |  | [Defaults to `undefined`] |
| **pid** | `number` |  | [Optional] [Defaults to `0`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;company&#39;`] |
| **shortName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **code** | `string` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **leader** | `string` |  | [Optional] [Defaults to `undefined`] |
| **leaderPhone** | `string` |  | [Optional] [Defaults to `undefined`] |
| **logo** | `string` |  | [Optional] [Defaults to `undefined`] |
| **address** | `string` |  | [Optional] [Defaults to `undefined`] |
| **sortOrder** | `number` |  | [Optional] [Defaults to `0`] |

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


## createOrganizationApiV1OrganizationPost_0

> any createOrganizationApiV1OrganizationPost_0(name, pid, type, shortName, code, description, leader, leaderPhone, logo, address, sortOrder)

创建组织

### Example

```ts
import {
  Configuration,
  OrganizationApi,
} from '';
import type { CreateOrganizationApiV1OrganizationPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationApi();

  const body = {
    // string
    name: name_example,
    // number (optional)
    pid: 56,
    // string (optional)
    type: type_example,
    // string (optional)
    shortName: shortName_example,
    // string (optional)
    code: code_example,
    // string (optional)
    description: description_example,
    // string (optional)
    leader: leader_example,
    // string (optional)
    leaderPhone: leaderPhone_example,
    // string (optional)
    logo: logo_example,
    // string (optional)
    address: address_example,
    // number (optional)
    sortOrder: 56,
  } satisfies CreateOrganizationApiV1OrganizationPost0Request;

  try {
    const data = await api.createOrganizationApiV1OrganizationPost_0(body);
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
| **name** | `string` |  | [Defaults to `undefined`] |
| **pid** | `number` |  | [Optional] [Defaults to `0`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;company&#39;`] |
| **shortName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **code** | `string` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **leader** | `string` |  | [Optional] [Defaults to `undefined`] |
| **leaderPhone** | `string` |  | [Optional] [Defaults to `undefined`] |
| **logo** | `string` |  | [Optional] [Defaults to `undefined`] |
| **address** | `string` |  | [Optional] [Defaults to `undefined`] |
| **sortOrder** | `number` |  | [Optional] [Defaults to `0`] |

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


## deleteOrganizationApiV1OrganizationOidDelete

> any deleteOrganizationApiV1OrganizationOidDelete(oid)

删除组织

### Example

```ts
import {
  Configuration,
  OrganizationApi,
} from '';
import type { DeleteOrganizationApiV1OrganizationOidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationApi();

  const body = {
    // number
    oid: 56,
  } satisfies DeleteOrganizationApiV1OrganizationOidDeleteRequest;

  try {
    const data = await api.deleteOrganizationApiV1OrganizationOidDelete(body);
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
| **oid** | `number` |  | [Defaults to `undefined`] |

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


## deleteOrganizationApiV1OrganizationOidDelete_0

> any deleteOrganizationApiV1OrganizationOidDelete_0(oid)

删除组织

### Example

```ts
import {
  Configuration,
  OrganizationApi,
} from '';
import type { DeleteOrganizationApiV1OrganizationOidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationApi();

  const body = {
    // number
    oid: 56,
  } satisfies DeleteOrganizationApiV1OrganizationOidDelete0Request;

  try {
    const data = await api.deleteOrganizationApiV1OrganizationOidDelete_0(body);
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
| **oid** | `number` |  | [Defaults to `undefined`] |

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


## getOrganizationApiV1OrganizationOidGet

> any getOrganizationApiV1OrganizationOidGet(oid)

组织详情

### Example

```ts
import {
  Configuration,
  OrganizationApi,
} from '';
import type { GetOrganizationApiV1OrganizationOidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationApi();

  const body = {
    // number
    oid: 56,
  } satisfies GetOrganizationApiV1OrganizationOidGetRequest;

  try {
    const data = await api.getOrganizationApiV1OrganizationOidGet(body);
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
| **oid** | `number` |  | [Defaults to `undefined`] |

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


## getOrganizationApiV1OrganizationOidGet_0

> any getOrganizationApiV1OrganizationOidGet_0(oid)

组织详情

### Example

```ts
import {
  Configuration,
  OrganizationApi,
} from '';
import type { GetOrganizationApiV1OrganizationOidGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationApi();

  const body = {
    // number
    oid: 56,
  } satisfies GetOrganizationApiV1OrganizationOidGet0Request;

  try {
    const data = await api.getOrganizationApiV1OrganizationOidGet_0(body);
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
| **oid** | `number` |  | [Defaults to `undefined`] |

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


## listMembersApiV1OrganizationOidMembersGet

> any listMembersApiV1OrganizationOidMembersGet(oid, page, limit)

组织成员

### Example

```ts
import {
  Configuration,
  OrganizationApi,
} from '';
import type { ListMembersApiV1OrganizationOidMembersGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationApi();

  const body = {
    // number
    oid: 56,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListMembersApiV1OrganizationOidMembersGetRequest;

  try {
    const data = await api.listMembersApiV1OrganizationOidMembersGet(body);
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
| **oid** | `number` |  | [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

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


## listMembersApiV1OrganizationOidMembersGet_0

> any listMembersApiV1OrganizationOidMembersGet_0(oid, page, limit)

组织成员

### Example

```ts
import {
  Configuration,
  OrganizationApi,
} from '';
import type { ListMembersApiV1OrganizationOidMembersGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationApi();

  const body = {
    // number
    oid: 56,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListMembersApiV1OrganizationOidMembersGet0Request;

  try {
    const data = await api.listMembersApiV1OrganizationOidMembersGet_0(body);
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
| **oid** | `number` |  | [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

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


## listOrganizationsApiV1OrganizationListGet

> any listOrganizationsApiV1OrganizationListGet(pid, status, keyword)

组织列表

### Example

```ts
import {
  Configuration,
  OrganizationApi,
} from '';
import type { ListOrganizationsApiV1OrganizationListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationApi();

  const body = {
    // number (optional)
    pid: 56,
    // number (optional)
    status: 56,
    // string (optional)
    keyword: keyword_example,
  } satisfies ListOrganizationsApiV1OrganizationListGetRequest;

  try {
    const data = await api.listOrganizationsApiV1OrganizationListGet(body);
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
| **pid** | `number` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **keyword** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## listOrganizationsApiV1OrganizationListGet_0

> any listOrganizationsApiV1OrganizationListGet_0(pid, status, keyword)

组织列表

### Example

```ts
import {
  Configuration,
  OrganizationApi,
} from '';
import type { ListOrganizationsApiV1OrganizationListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationApi();

  const body = {
    // number (optional)
    pid: 56,
    // number (optional)
    status: 56,
    // string (optional)
    keyword: keyword_example,
  } satisfies ListOrganizationsApiV1OrganizationListGet0Request;

  try {
    const data = await api.listOrganizationsApiV1OrganizationListGet_0(body);
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
| **pid** | `number` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **keyword** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## orgTreeApiV1OrganizationTreeGet

> any orgTreeApiV1OrganizationTreeGet()

组织树

### Example

```ts
import {
  Configuration,
  OrganizationApi,
} from '';
import type { OrgTreeApiV1OrganizationTreeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationApi();

  try {
    const data = await api.orgTreeApiV1OrganizationTreeGet();
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


## orgTreeApiV1OrganizationTreeGet_0

> any orgTreeApiV1OrganizationTreeGet_0()

组织树

### Example

```ts
import {
  Configuration,
  OrganizationApi,
} from '';
import type { OrgTreeApiV1OrganizationTreeGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationApi();

  try {
    const data = await api.orgTreeApiV1OrganizationTreeGet_0();
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


## removeMemberApiV1OrganizationOidMemberUserIdDelete

> any removeMemberApiV1OrganizationOidMemberUserIdDelete(oid, userId)

移除成员

### Example

```ts
import {
  Configuration,
  OrganizationApi,
} from '';
import type { RemoveMemberApiV1OrganizationOidMemberUserIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationApi();

  const body = {
    // number
    oid: 56,
    // string
    userId: userId_example,
  } satisfies RemoveMemberApiV1OrganizationOidMemberUserIdDeleteRequest;

  try {
    const data = await api.removeMemberApiV1OrganizationOidMemberUserIdDelete(body);
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
| **oid** | `number` |  | [Defaults to `undefined`] |
| **userId** | `string` |  | [Defaults to `undefined`] |

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


## removeMemberApiV1OrganizationOidMemberUserIdDelete_0

> any removeMemberApiV1OrganizationOidMemberUserIdDelete_0(oid, userId)

移除成员

### Example

```ts
import {
  Configuration,
  OrganizationApi,
} from '';
import type { RemoveMemberApiV1OrganizationOidMemberUserIdDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationApi();

  const body = {
    // number
    oid: 56,
    // string
    userId: userId_example,
  } satisfies RemoveMemberApiV1OrganizationOidMemberUserIdDelete0Request;

  try {
    const data = await api.removeMemberApiV1OrganizationOidMemberUserIdDelete_0(body);
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
| **oid** | `number` |  | [Defaults to `undefined`] |
| **userId** | `string` |  | [Defaults to `undefined`] |

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


## updateOrganizationApiV1OrganizationOidPut

> any updateOrganizationApiV1OrganizationOidPut(oid, name, shortName, description, leader, leaderPhone, status, sortOrder)

修改组织

### Example

```ts
import {
  Configuration,
  OrganizationApi,
} from '';
import type { UpdateOrganizationApiV1OrganizationOidPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationApi();

  const body = {
    // number
    oid: 56,
    // string (optional)
    name: name_example,
    // string (optional)
    shortName: shortName_example,
    // string (optional)
    description: description_example,
    // string (optional)
    leader: leader_example,
    // string (optional)
    leaderPhone: leaderPhone_example,
    // number (optional)
    status: 56,
    // number (optional)
    sortOrder: 56,
  } satisfies UpdateOrganizationApiV1OrganizationOidPutRequest;

  try {
    const data = await api.updateOrganizationApiV1OrganizationOidPut(body);
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
| **oid** | `number` |  | [Defaults to `undefined`] |
| **name** | `string` |  | [Optional] [Defaults to `undefined`] |
| **shortName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **leader** | `string` |  | [Optional] [Defaults to `undefined`] |
| **leaderPhone** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **sortOrder** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## updateOrganizationApiV1OrganizationOidPut_0

> any updateOrganizationApiV1OrganizationOidPut_0(oid, name, shortName, description, leader, leaderPhone, status, sortOrder)

修改组织

### Example

```ts
import {
  Configuration,
  OrganizationApi,
} from '';
import type { UpdateOrganizationApiV1OrganizationOidPut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationApi();

  const body = {
    // number
    oid: 56,
    // string (optional)
    name: name_example,
    // string (optional)
    shortName: shortName_example,
    // string (optional)
    description: description_example,
    // string (optional)
    leader: leader_example,
    // string (optional)
    leaderPhone: leaderPhone_example,
    // number (optional)
    status: 56,
    // number (optional)
    sortOrder: 56,
  } satisfies UpdateOrganizationApiV1OrganizationOidPut0Request;

  try {
    const data = await api.updateOrganizationApiV1OrganizationOidPut_0(body);
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
| **oid** | `number` |  | [Defaults to `undefined`] |
| **name** | `string` |  | [Optional] [Defaults to `undefined`] |
| **shortName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **leader** | `string` |  | [Optional] [Defaults to `undefined`] |
| **leaderPhone** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **sortOrder** | `number` |  | [Optional] [Defaults to `undefined`] |

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

