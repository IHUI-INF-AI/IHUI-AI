# CozeWorkspacesApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost**](#createmembersapiv1cozeworkspacesworkspacesmemberscreatepost) | **POST** /api/v1/coze/workspaces/workspaces/members/create | Create Members|
|[**createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0**](#createmembersapiv1cozeworkspacesworkspacesmemberscreatepost_0) | **POST** /api/v1/coze/workspaces/workspaces/members/create | Create Members|
|[**deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost**](#deletemembersapiv1cozeworkspacesworkspacesmembersdeletepost) | **POST** /api/v1/coze/workspaces/workspaces/members/delete | Delete Members|
|[**deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0**](#deletemembersapiv1cozeworkspacesworkspacesmembersdeletepost_0) | **POST** /api/v1/coze/workspaces/workspaces/members/delete | Delete Members|
|[**listWorkspacesApiV1CozeWorkspacesWorkspacesListGet**](#listworkspacesapiv1cozeworkspacesworkspaceslistget) | **GET** /api/v1/coze/workspaces/workspaces/list | List Workspaces|
|[**listWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0**](#listworkspacesapiv1cozeworkspacesworkspaceslistget_0) | **GET** /api/v1/coze/workspaces/workspaces/list | List Workspaces|

# **createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost**
> any createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost(membersReq)


### Example

```typescript
import {
    CozeWorkspacesApi,
    Configuration,
    MembersReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkspacesApi(configuration);

let membersReq: MembersReq; //

const { status, data } = await apiInstance.createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost(
    membersReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **membersReq** | **MembersReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0**
> any createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0(membersReq)


### Example

```typescript
import {
    CozeWorkspacesApi,
    Configuration,
    MembersReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkspacesApi(configuration);

let membersReq: MembersReq; //

const { status, data } = await apiInstance.createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0(
    membersReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **membersReq** | **MembersReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost**
> any deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost(deleteMembersReq)


### Example

```typescript
import {
    CozeWorkspacesApi,
    Configuration,
    DeleteMembersReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkspacesApi(configuration);

let deleteMembersReq: DeleteMembersReq; //

const { status, data } = await apiInstance.deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost(
    deleteMembersReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **deleteMembersReq** | **DeleteMembersReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0**
> any deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0(deleteMembersReq)


### Example

```typescript
import {
    CozeWorkspacesApi,
    Configuration,
    DeleteMembersReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkspacesApi(configuration);

let deleteMembersReq: DeleteMembersReq; //

const { status, data } = await apiInstance.deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0(
    deleteMembersReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **deleteMembersReq** | **DeleteMembersReq**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listWorkspacesApiV1CozeWorkspacesWorkspacesListGet**
> any listWorkspacesApiV1CozeWorkspacesWorkspacesListGet()


### Example

```typescript
import {
    CozeWorkspacesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkspacesApi(configuration);

let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listWorkspacesApiV1CozeWorkspacesWorkspacesListGet(
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **size** | [**number**] |  | (optional) defaults to 20|


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

# **listWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0**
> any listWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0()


### Example

```typescript
import {
    CozeWorkspacesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkspacesApi(configuration);

let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0(
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **size** | [**number**] |  | (optional) defaults to 20|


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

