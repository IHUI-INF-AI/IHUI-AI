# RemoteDeviceApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**agentByCollectApiV1RemoteAgentByCollectUuidGet**](#agentbycollectapiv1remoteagentbycollectuuidget) | **GET** /api/v1/remote/agent/by/collect/{uuid} | Agent By Collect|
|[**agentByCollectApiV1RemoteAgentByCollectUuidGet_0**](#agentbycollectapiv1remoteagentbycollectuuidget_0) | **GET** /api/v1/remote/agent/by/collect/{uuid} | Agent By Collect|
|[**agentByPayApiV1RemoteAgentByPayGet**](#agentbypayapiv1remoteagentbypayget) | **GET** /api/v1/remote/agent/by/pay | Agent By Pay|
|[**agentByPayApiV1RemoteAgentByPayGet_0**](#agentbypayapiv1remoteagentbypayget_0) | **GET** /api/v1/remote/agent/by/pay | Agent By Pay|
|[**agentByTypeApiV1RemoteAgentByTypeGet**](#agentbytypeapiv1remoteagentbytypeget) | **GET** /api/v1/remote/agent/by/type | Agent By Type|
|[**agentByTypeApiV1RemoteAgentByTypeGet_0**](#agentbytypeapiv1remoteagentbytypeget_0) | **GET** /api/v1/remote/agent/by/type | Agent By Type|
|[**agentCategory2ApiV1RemoteAgentCategory2Get**](#agentcategory2apiv1remoteagentcategory2get) | **GET** /api/v1/remote/agent/category2 | Agent Category2|
|[**agentCategory2ApiV1RemoteAgentCategory2Get_0**](#agentcategory2apiv1remoteagentcategory2get_0) | **GET** /api/v1/remote/agent/category2 | Agent Category2|
|[**agentCategoryApiV1RemoteAgentCategoryGet**](#agentcategoryapiv1remoteagentcategoryget) | **GET** /api/v1/remote/agent/category | Agent Category|
|[**agentCategoryApiV1RemoteAgentCategoryGet_0**](#agentcategoryapiv1remoteagentcategoryget_0) | **GET** /api/v1/remote/agent/category | Agent Category|
|[**getInfoApiV1RemoteInfoUuidGet**](#getinfoapiv1remoteinfouuidget) | **GET** /api/v1/remote/info/{uuid} | Get Info|
|[**getInfoApiV1RemoteInfoUuidGet_0**](#getinfoapiv1remoteinfouuidget_0) | **GET** /api/v1/remote/info/{uuid} | Get Info|
|[**getRoleApiV1RemoteRoleGet**](#getroleapiv1remoteroleget) | **GET** /api/v1/remote/role | Get Role|
|[**getRoleApiV1RemoteRoleGet_0**](#getroleapiv1remoteroleget_0) | **GET** /api/v1/remote/role | Get Role|
|[**getWithdrawalOpenApiV1RemoteGetTrueGet**](#getwithdrawalopenapiv1remotegettrueget) | **GET** /api/v1/remote/get/true | Get Withdrawal Open|
|[**getWithdrawalOpenApiV1RemoteGetTrueGet_0**](#getwithdrawalopenapiv1remotegettrueget_0) | **GET** /api/v1/remote/get/true | Get Withdrawal Open|
|[**myTeamApiV1RemoteMyTeamUuidPost**](#myteamapiv1remotemyteamuuidpost) | **POST** /api/v1/remote/myTeam/{uuid} | My Team|
|[**myTeamApiV1RemoteMyTeamUuidPost_0**](#myteamapiv1remotemyteamuuidpost_0) | **POST** /api/v1/remote/myTeam/{uuid} | My Team|
|[**tencentAsrApiV1RemoteGetTencentSentencePost**](#tencentasrapiv1remotegettencentsentencepost) | **POST** /api/v1/remote/get/tencent/sentence | Tencent Asr|
|[**tencentAsrApiV1RemoteGetTencentSentencePost_0**](#tencentasrapiv1remotegettencentsentencepost_0) | **POST** /api/v1/remote/get/tencent/sentence | Tencent Asr|
|[**uploadBusinessCardApiV1RemoteUploadBusinessCardPost**](#uploadbusinesscardapiv1remoteuploadbusinesscardpost) | **POST** /api/v1/remote/uploadBusinessCard | Upload Business Card|
|[**uploadBusinessCardApiV1RemoteUploadBusinessCardPost_0**](#uploadbusinesscardapiv1remoteuploadbusinesscardpost_0) | **POST** /api/v1/remote/uploadBusinessCard | Upload Business Card|

# **agentByCollectApiV1RemoteAgentByCollectUuidGet**
> any agentByCollectApiV1RemoteAgentByCollectUuidGet()

对应 Java: GET /remote/agent/by/collect/{uuid}?search= (查收藏表, 此处简化).

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

let uuid: string; // (default to undefined)
let search: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.agentByCollectApiV1RemoteAgentByCollectUuidGet(
    uuid,
    search,
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **uuid** | [**string**] |  | defaults to undefined|
| **search** | [**string**] |  | (optional) defaults to undefined|
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

# **agentByCollectApiV1RemoteAgentByCollectUuidGet_0**
> any agentByCollectApiV1RemoteAgentByCollectUuidGet_0()

对应 Java: GET /remote/agent/by/collect/{uuid}?search= (查收藏表, 此处简化).

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

let uuid: string; // (default to undefined)
let search: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.agentByCollectApiV1RemoteAgentByCollectUuidGet_0(
    uuid,
    search,
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **uuid** | [**string**] |  | defaults to undefined|
| **search** | [**string**] |  | (optional) defaults to undefined|
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

# **agentByPayApiV1RemoteAgentByPayGet**
> any agentByPayApiV1RemoteAgentByPayGet()

对应 Java: GET /remote/agent/by/pay?uuid=&search=&type=&date=

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

let uuid: string; // (default to undefined)
let search: string; // (optional) (default to undefined)
let type: number; // (optional) (default to undefined)
let date: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.agentByPayApiV1RemoteAgentByPayGet(
    uuid,
    search,
    type,
    date,
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **uuid** | [**string**] |  | defaults to undefined|
| **search** | [**string**] |  | (optional) defaults to undefined|
| **type** | [**number**] |  | (optional) defaults to undefined|
| **date** | [**string**] |  | (optional) defaults to undefined|
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

# **agentByPayApiV1RemoteAgentByPayGet_0**
> any agentByPayApiV1RemoteAgentByPayGet_0()

对应 Java: GET /remote/agent/by/pay?uuid=&search=&type=&date=

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

let uuid: string; // (default to undefined)
let search: string; // (optional) (default to undefined)
let type: number; // (optional) (default to undefined)
let date: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.agentByPayApiV1RemoteAgentByPayGet_0(
    uuid,
    search,
    type,
    date,
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **uuid** | [**string**] |  | defaults to undefined|
| **search** | [**string**] |  | (optional) defaults to undefined|
| **type** | [**number**] |  | (optional) defaults to undefined|
| **date** | [**string**] |  | (optional) defaults to undefined|
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

# **agentByTypeApiV1RemoteAgentByTypeGet**
> any agentByTypeApiV1RemoteAgentByTypeGet()

对应 Java: GET /remote/agent/by/type?search=&code=

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

let search: string; // (optional) (default to undefined)
let code: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.agentByTypeApiV1RemoteAgentByTypeGet(
    search,
    code,
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **search** | [**string**] |  | (optional) defaults to undefined|
| **code** | [**string**] |  | (optional) defaults to undefined|
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

# **agentByTypeApiV1RemoteAgentByTypeGet_0**
> any agentByTypeApiV1RemoteAgentByTypeGet_0()

对应 Java: GET /remote/agent/by/type?search=&code=

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

let search: string; // (optional) (default to undefined)
let code: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.agentByTypeApiV1RemoteAgentByTypeGet_0(
    search,
    code,
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **search** | [**string**] |  | (optional) defaults to undefined|
| **code** | [**string**] |  | (optional) defaults to undefined|
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

# **agentCategory2ApiV1RemoteAgentCategory2Get**
> any agentCategory2ApiV1RemoteAgentCategory2Get()

对应 Java: GET /remote/agent/category2 — AjaxResult 包装 (与上同结构).

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

let type: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.agentCategory2ApiV1RemoteAgentCategory2Get(
    type
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **type** | [**string**] |  | (optional) defaults to undefined|


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

# **agentCategory2ApiV1RemoteAgentCategory2Get_0**
> any agentCategory2ApiV1RemoteAgentCategory2Get_0()

对应 Java: GET /remote/agent/category2 — AjaxResult 包装 (与上同结构).

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

let type: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.agentCategory2ApiV1RemoteAgentCategory2Get_0(
    type
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **type** | [**string**] |  | (optional) defaults to undefined|


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

# **agentCategoryApiV1RemoteAgentCategoryGet**
> any agentCategoryApiV1RemoteAgentCategoryGet()

对应 Java: GET /remote/agent/category?type=xxx — ResponseResultInfo 包装.

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

let type: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.agentCategoryApiV1RemoteAgentCategoryGet(
    type
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **type** | [**string**] |  | (optional) defaults to undefined|


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

# **agentCategoryApiV1RemoteAgentCategoryGet_0**
> any agentCategoryApiV1RemoteAgentCategoryGet_0()

对应 Java: GET /remote/agent/category?type=xxx — ResponseResultInfo 包装.

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

let type: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.agentCategoryApiV1RemoteAgentCategoryGet_0(
    type
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **type** | [**string**] |  | (optional) defaults to undefined|


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

# **getInfoApiV1RemoteInfoUuidGet**
> any getInfoApiV1RemoteInfoUuidGet()

对应 Java: GET /remote/info/{uuid} — 用户基本信息 + 第三方账号绑定.

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

let uuid: string; // (default to undefined)
let xDeviceType: string; // (optional) (default to 'unknown')

const { status, data } = await apiInstance.getInfoApiV1RemoteInfoUuidGet(
    uuid,
    xDeviceType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **uuid** | [**string**] |  | defaults to undefined|
| **xDeviceType** | [**string**] |  | (optional) defaults to 'unknown'|


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

# **getInfoApiV1RemoteInfoUuidGet_0**
> any getInfoApiV1RemoteInfoUuidGet_0()

对应 Java: GET /remote/info/{uuid} — 用户基本信息 + 第三方账号绑定.

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

let uuid: string; // (default to undefined)
let xDeviceType: string; // (optional) (default to 'unknown')

const { status, data } = await apiInstance.getInfoApiV1RemoteInfoUuidGet_0(
    uuid,
    xDeviceType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **uuid** | [**string**] |  | defaults to undefined|
| **xDeviceType** | [**string**] |  | (optional) defaults to 'unknown'|


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

# **getRoleApiV1RemoteRoleGet**
> any getRoleApiV1RemoteRoleGet()

对应 Java: GET /remote/role — 列出所有可购买的 ZhsProductIdentity.

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

const { status, data } = await apiInstance.getRoleApiV1RemoteRoleGet();
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

# **getRoleApiV1RemoteRoleGet_0**
> any getRoleApiV1RemoteRoleGet_0()

对应 Java: GET /remote/role — 列出所有可购买的 ZhsProductIdentity.

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

const { status, data } = await apiInstance.getRoleApiV1RemoteRoleGet_0();
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

# **getWithdrawalOpenApiV1RemoteGetTrueGet**
> any getWithdrawalOpenApiV1RemoteGetTrueGet()

对应 Java: GET /remote/get/true — 查 ZhsWithdrawalFlow id=1.status==1 → true.

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

const { status, data } = await apiInstance.getWithdrawalOpenApiV1RemoteGetTrueGet();
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

# **getWithdrawalOpenApiV1RemoteGetTrueGet_0**
> any getWithdrawalOpenApiV1RemoteGetTrueGet_0()

对应 Java: GET /remote/get/true — 查 ZhsWithdrawalFlow id=1.status==1 → true.

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

const { status, data } = await apiInstance.getWithdrawalOpenApiV1RemoteGetTrueGet_0();
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

# **myTeamApiV1RemoteMyTeamUuidPost**
> any myTeamApiV1RemoteMyTeamUuidPost()

对应 Java: POST /remote/myTeam/{uuid} — 查询我的团队 (邀请树子节点).

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration,
    MyTeamQuery
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

let uuid: string; // (default to undefined)
let xDeviceType: string; // (optional) (default to 'unknown')
let myTeamQuery: MyTeamQuery; // (optional)

const { status, data } = await apiInstance.myTeamApiV1RemoteMyTeamUuidPost(
    uuid,
    xDeviceType,
    myTeamQuery
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **myTeamQuery** | **MyTeamQuery**|  | |
| **uuid** | [**string**] |  | defaults to undefined|
| **xDeviceType** | [**string**] |  | (optional) defaults to 'unknown'|


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

# **myTeamApiV1RemoteMyTeamUuidPost_0**
> any myTeamApiV1RemoteMyTeamUuidPost_0()

对应 Java: POST /remote/myTeam/{uuid} — 查询我的团队 (邀请树子节点).

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration,
    MyTeamQuery
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

let uuid: string; // (default to undefined)
let xDeviceType: string; // (optional) (default to 'unknown')
let myTeamQuery: MyTeamQuery; // (optional)

const { status, data } = await apiInstance.myTeamApiV1RemoteMyTeamUuidPost_0(
    uuid,
    xDeviceType,
    myTeamQuery
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **myTeamQuery** | **MyTeamQuery**|  | |
| **uuid** | [**string**] |  | defaults to undefined|
| **xDeviceType** | [**string**] |  | (optional) defaults to 'unknown'|


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

# **tencentAsrApiV1RemoteGetTencentSentencePost**
> any tencentAsrApiV1RemoteGetTencentSentencePost(tencentAsrReq)

对应 Java: POST /remote/get/tencent/sentence — 调用腾讯云一句话识别.  Java 端直接用腾讯云 SDK. Python 这边如果想保真实现需安装 tencentcloud-sdk-python, 此处用占位实现 (返回模拟结果, 生产部署时配置 TENCENT_SECRET_ID/SECRET_KEY 后切换为真实 SDK).

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration,
    TencentAsrReq
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

let tencentAsrReq: TencentAsrReq; //

const { status, data } = await apiInstance.tencentAsrApiV1RemoteGetTencentSentencePost(
    tencentAsrReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tencentAsrReq** | **TencentAsrReq**|  | |


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

# **tencentAsrApiV1RemoteGetTencentSentencePost_0**
> any tencentAsrApiV1RemoteGetTencentSentencePost_0(tencentAsrReq)

对应 Java: POST /remote/get/tencent/sentence — 调用腾讯云一句话识别.  Java 端直接用腾讯云 SDK. Python 这边如果想保真实现需安装 tencentcloud-sdk-python, 此处用占位实现 (返回模拟结果, 生产部署时配置 TENCENT_SECRET_ID/SECRET_KEY 后切换为真实 SDK).

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration,
    TencentAsrReq
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

let tencentAsrReq: TencentAsrReq; //

const { status, data } = await apiInstance.tencentAsrApiV1RemoteGetTencentSentencePost_0(
    tencentAsrReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tencentAsrReq** | **TencentAsrReq**|  | |


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

# **uploadBusinessCardApiV1RemoteUploadBusinessCardPost**
> any uploadBusinessCardApiV1RemoteUploadBusinessCardPost(businessCardReq)

对应 Java: POST /remote/uploadBusinessCard — 上传 base64 名片到 MinIO.

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration,
    BusinessCardReq
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

let businessCardReq: BusinessCardReq; //
let xDeviceType: string; // (optional) (default to 'unknown')

const { status, data } = await apiInstance.uploadBusinessCardApiV1RemoteUploadBusinessCardPost(
    businessCardReq,
    xDeviceType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **businessCardReq** | **BusinessCardReq**|  | |
| **xDeviceType** | [**string**] |  | (optional) defaults to 'unknown'|


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

# **uploadBusinessCardApiV1RemoteUploadBusinessCardPost_0**
> any uploadBusinessCardApiV1RemoteUploadBusinessCardPost_0(businessCardReq)

对应 Java: POST /remote/uploadBusinessCard — 上传 base64 名片到 MinIO.

### Example

```typescript
import {
    RemoteDeviceApi,
    Configuration,
    BusinessCardReq
} from './api';

const configuration = new Configuration();
const apiInstance = new RemoteDeviceApi(configuration);

let businessCardReq: BusinessCardReq; //
let xDeviceType: string; // (optional) (default to 'unknown')

const { status, data } = await apiInstance.uploadBusinessCardApiV1RemoteUploadBusinessCardPost_0(
    businessCardReq,
    xDeviceType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **businessCardReq** | **BusinessCardReq**|  | |
| **xDeviceType** | [**string**] |  | (optional) defaults to 'unknown'|


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

