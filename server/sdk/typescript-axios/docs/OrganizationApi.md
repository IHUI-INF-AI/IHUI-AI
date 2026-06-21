# OrganizationApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**addMemberApiV1OrganizationOidMemberPost**](#addmemberapiv1organizationoidmemberpost) | **POST** /api/v1/organization/{oid}/member | 添加成员|
|[**addMemberApiV1OrganizationOidMemberPost_0**](#addmemberapiv1organizationoidmemberpost_0) | **POST** /api/v1/organization/{oid}/member | 添加成员|
|[**createOrganizationApiV1OrganizationPost**](#createorganizationapiv1organizationpost) | **POST** /api/v1/organization | 创建组织|
|[**createOrganizationApiV1OrganizationPost_0**](#createorganizationapiv1organizationpost_0) | **POST** /api/v1/organization | 创建组织|
|[**deleteOrganizationApiV1OrganizationOidDelete**](#deleteorganizationapiv1organizationoiddelete) | **DELETE** /api/v1/organization/{oid} | 删除组织|
|[**deleteOrganizationApiV1OrganizationOidDelete_0**](#deleteorganizationapiv1organizationoiddelete_0) | **DELETE** /api/v1/organization/{oid} | 删除组织|
|[**getOrganizationApiV1OrganizationOidGet**](#getorganizationapiv1organizationoidget) | **GET** /api/v1/organization/{oid} | 组织详情|
|[**getOrganizationApiV1OrganizationOidGet_0**](#getorganizationapiv1organizationoidget_0) | **GET** /api/v1/organization/{oid} | 组织详情|
|[**listMembersApiV1OrganizationOidMembersGet**](#listmembersapiv1organizationoidmembersget) | **GET** /api/v1/organization/{oid}/members | 组织成员|
|[**listMembersApiV1OrganizationOidMembersGet_0**](#listmembersapiv1organizationoidmembersget_0) | **GET** /api/v1/organization/{oid}/members | 组织成员|
|[**listOrganizationsApiV1OrganizationListGet**](#listorganizationsapiv1organizationlistget) | **GET** /api/v1/organization/list | 组织列表|
|[**listOrganizationsApiV1OrganizationListGet_0**](#listorganizationsapiv1organizationlistget_0) | **GET** /api/v1/organization/list | 组织列表|
|[**orgTreeApiV1OrganizationTreeGet**](#orgtreeapiv1organizationtreeget) | **GET** /api/v1/organization/tree | 组织树|
|[**orgTreeApiV1OrganizationTreeGet_0**](#orgtreeapiv1organizationtreeget_0) | **GET** /api/v1/organization/tree | 组织树|
|[**removeMemberApiV1OrganizationOidMemberUserIdDelete**](#removememberapiv1organizationoidmemberuseriddelete) | **DELETE** /api/v1/organization/{oid}/member/{user_id} | 移除成员|
|[**removeMemberApiV1OrganizationOidMemberUserIdDelete_0**](#removememberapiv1organizationoidmemberuseriddelete_0) | **DELETE** /api/v1/organization/{oid}/member/{user_id} | 移除成员|
|[**updateOrganizationApiV1OrganizationOidPut**](#updateorganizationapiv1organizationoidput) | **PUT** /api/v1/organization/{oid} | 修改组织|
|[**updateOrganizationApiV1OrganizationOidPut_0**](#updateorganizationapiv1organizationoidput_0) | **PUT** /api/v1/organization/{oid} | 修改组织|

# **addMemberApiV1OrganizationOidMemberPost**
> any addMemberApiV1OrganizationOidMemberPost()


### Example

```typescript
import {
    OrganizationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationApi(configuration);

let oid: number; // (default to undefined)
let userId: string; // (default to undefined)
let role: string; // (optional) (default to 'member')
let position: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.addMemberApiV1OrganizationOidMemberPost(
    oid,
    userId,
    role,
    position
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **oid** | [**number**] |  | defaults to undefined|
| **userId** | [**string**] |  | defaults to undefined|
| **role** | [**string**] |  | (optional) defaults to 'member'|
| **position** | [**string**] |  | (optional) defaults to undefined|


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

# **addMemberApiV1OrganizationOidMemberPost_0**
> any addMemberApiV1OrganizationOidMemberPost_0()


### Example

```typescript
import {
    OrganizationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationApi(configuration);

let oid: number; // (default to undefined)
let userId: string; // (default to undefined)
let role: string; // (optional) (default to 'member')
let position: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.addMemberApiV1OrganizationOidMemberPost_0(
    oid,
    userId,
    role,
    position
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **oid** | [**number**] |  | defaults to undefined|
| **userId** | [**string**] |  | defaults to undefined|
| **role** | [**string**] |  | (optional) defaults to 'member'|
| **position** | [**string**] |  | (optional) defaults to undefined|


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

# **createOrganizationApiV1OrganizationPost**
> any createOrganizationApiV1OrganizationPost()


### Example

```typescript
import {
    OrganizationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationApi(configuration);

let name: string; // (default to undefined)
let pid: number; // (optional) (default to 0)
let type: string; // (optional) (default to 'company')
let shortName: string; // (optional) (default to undefined)
let code: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)
let leader: string; // (optional) (default to undefined)
let leaderPhone: string; // (optional) (default to undefined)
let logo: string; // (optional) (default to undefined)
let address: string; // (optional) (default to undefined)
let sortOrder: number; // (optional) (default to 0)

const { status, data } = await apiInstance.createOrganizationApiV1OrganizationPost(
    name,
    pid,
    type,
    shortName,
    code,
    description,
    leader,
    leaderPhone,
    logo,
    address,
    sortOrder
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | defaults to undefined|
| **pid** | [**number**] |  | (optional) defaults to 0|
| **type** | [**string**] |  | (optional) defaults to 'company'|
| **shortName** | [**string**] |  | (optional) defaults to undefined|
| **code** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **leader** | [**string**] |  | (optional) defaults to undefined|
| **leaderPhone** | [**string**] |  | (optional) defaults to undefined|
| **logo** | [**string**] |  | (optional) defaults to undefined|
| **address** | [**string**] |  | (optional) defaults to undefined|
| **sortOrder** | [**number**] |  | (optional) defaults to 0|


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

# **createOrganizationApiV1OrganizationPost_0**
> any createOrganizationApiV1OrganizationPost_0()


### Example

```typescript
import {
    OrganizationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationApi(configuration);

let name: string; // (default to undefined)
let pid: number; // (optional) (default to 0)
let type: string; // (optional) (default to 'company')
let shortName: string; // (optional) (default to undefined)
let code: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)
let leader: string; // (optional) (default to undefined)
let leaderPhone: string; // (optional) (default to undefined)
let logo: string; // (optional) (default to undefined)
let address: string; // (optional) (default to undefined)
let sortOrder: number; // (optional) (default to 0)

const { status, data } = await apiInstance.createOrganizationApiV1OrganizationPost_0(
    name,
    pid,
    type,
    shortName,
    code,
    description,
    leader,
    leaderPhone,
    logo,
    address,
    sortOrder
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | defaults to undefined|
| **pid** | [**number**] |  | (optional) defaults to 0|
| **type** | [**string**] |  | (optional) defaults to 'company'|
| **shortName** | [**string**] |  | (optional) defaults to undefined|
| **code** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **leader** | [**string**] |  | (optional) defaults to undefined|
| **leaderPhone** | [**string**] |  | (optional) defaults to undefined|
| **logo** | [**string**] |  | (optional) defaults to undefined|
| **address** | [**string**] |  | (optional) defaults to undefined|
| **sortOrder** | [**number**] |  | (optional) defaults to 0|


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

# **deleteOrganizationApiV1OrganizationOidDelete**
> any deleteOrganizationApiV1OrganizationOidDelete()


### Example

```typescript
import {
    OrganizationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationApi(configuration);

let oid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteOrganizationApiV1OrganizationOidDelete(
    oid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **oid** | [**number**] |  | defaults to undefined|


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

# **deleteOrganizationApiV1OrganizationOidDelete_0**
> any deleteOrganizationApiV1OrganizationOidDelete_0()


### Example

```typescript
import {
    OrganizationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationApi(configuration);

let oid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteOrganizationApiV1OrganizationOidDelete_0(
    oid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **oid** | [**number**] |  | defaults to undefined|


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

# **getOrganizationApiV1OrganizationOidGet**
> any getOrganizationApiV1OrganizationOidGet()


### Example

```typescript
import {
    OrganizationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationApi(configuration);

let oid: number; // (default to undefined)

const { status, data } = await apiInstance.getOrganizationApiV1OrganizationOidGet(
    oid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **oid** | [**number**] |  | defaults to undefined|


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

# **getOrganizationApiV1OrganizationOidGet_0**
> any getOrganizationApiV1OrganizationOidGet_0()


### Example

```typescript
import {
    OrganizationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationApi(configuration);

let oid: number; // (default to undefined)

const { status, data } = await apiInstance.getOrganizationApiV1OrganizationOidGet_0(
    oid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **oid** | [**number**] |  | defaults to undefined|


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

# **listMembersApiV1OrganizationOidMembersGet**
> any listMembersApiV1OrganizationOidMembersGet()


### Example

```typescript
import {
    OrganizationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationApi(configuration);

let oid: number; // (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listMembersApiV1OrganizationOidMembersGet(
    oid,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **oid** | [**number**] |  | defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

# **listMembersApiV1OrganizationOidMembersGet_0**
> any listMembersApiV1OrganizationOidMembersGet_0()


### Example

```typescript
import {
    OrganizationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationApi(configuration);

let oid: number; // (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listMembersApiV1OrganizationOidMembersGet_0(
    oid,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **oid** | [**number**] |  | defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

# **listOrganizationsApiV1OrganizationListGet**
> any listOrganizationsApiV1OrganizationListGet()


### Example

```typescript
import {
    OrganizationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationApi(configuration);

let pid: number; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let keyword: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listOrganizationsApiV1OrganizationListGet(
    pid,
    status,
    keyword
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **keyword** | [**string**] |  | (optional) defaults to undefined|


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

# **listOrganizationsApiV1OrganizationListGet_0**
> any listOrganizationsApiV1OrganizationListGet_0()


### Example

```typescript
import {
    OrganizationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationApi(configuration);

let pid: number; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let keyword: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listOrganizationsApiV1OrganizationListGet_0(
    pid,
    status,
    keyword
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **keyword** | [**string**] |  | (optional) defaults to undefined|


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

# **orgTreeApiV1OrganizationTreeGet**
> any orgTreeApiV1OrganizationTreeGet()


### Example

```typescript
import {
    OrganizationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationApi(configuration);

const { status, data } = await apiInstance.orgTreeApiV1OrganizationTreeGet();
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

# **orgTreeApiV1OrganizationTreeGet_0**
> any orgTreeApiV1OrganizationTreeGet_0()


### Example

```typescript
import {
    OrganizationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationApi(configuration);

const { status, data } = await apiInstance.orgTreeApiV1OrganizationTreeGet_0();
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

# **removeMemberApiV1OrganizationOidMemberUserIdDelete**
> any removeMemberApiV1OrganizationOidMemberUserIdDelete()


### Example

```typescript
import {
    OrganizationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationApi(configuration);

let oid: number; // (default to undefined)
let userId: string; // (default to undefined)

const { status, data } = await apiInstance.removeMemberApiV1OrganizationOidMemberUserIdDelete(
    oid,
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **oid** | [**number**] |  | defaults to undefined|
| **userId** | [**string**] |  | defaults to undefined|


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

# **removeMemberApiV1OrganizationOidMemberUserIdDelete_0**
> any removeMemberApiV1OrganizationOidMemberUserIdDelete_0()


### Example

```typescript
import {
    OrganizationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationApi(configuration);

let oid: number; // (default to undefined)
let userId: string; // (default to undefined)

const { status, data } = await apiInstance.removeMemberApiV1OrganizationOidMemberUserIdDelete_0(
    oid,
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **oid** | [**number**] |  | defaults to undefined|
| **userId** | [**string**] |  | defaults to undefined|


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

# **updateOrganizationApiV1OrganizationOidPut**
> any updateOrganizationApiV1OrganizationOidPut()


### Example

```typescript
import {
    OrganizationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationApi(configuration);

let oid: number; // (default to undefined)
let name: string; // (optional) (default to undefined)
let shortName: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)
let leader: string; // (optional) (default to undefined)
let leaderPhone: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let sortOrder: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateOrganizationApiV1OrganizationOidPut(
    oid,
    name,
    shortName,
    description,
    leader,
    leaderPhone,
    status,
    sortOrder
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **oid** | [**number**] |  | defaults to undefined|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **shortName** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **leader** | [**string**] |  | (optional) defaults to undefined|
| **leaderPhone** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **sortOrder** | [**number**] |  | (optional) defaults to undefined|


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

# **updateOrganizationApiV1OrganizationOidPut_0**
> any updateOrganizationApiV1OrganizationOidPut_0()


### Example

```typescript
import {
    OrganizationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationApi(configuration);

let oid: number; // (default to undefined)
let name: string; // (optional) (default to undefined)
let shortName: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)
let leader: string; // (optional) (default to undefined)
let leaderPhone: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let sortOrder: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateOrganizationApiV1OrganizationOidPut_0(
    oid,
    name,
    shortName,
    description,
    leader,
    leaderPhone,
    status,
    sortOrder
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **oid** | [**number**] |  | defaults to undefined|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **shortName** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **leader** | [**string**] |  | (optional) defaults to undefined|
| **leaderPhone** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **sortOrder** | [**number**] |  | (optional) defaults to undefined|


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

