# SystemAuditApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**cleanLoginInfoApiV1SystemAuditLogininforCleanPost**](#cleanlogininfoapiv1systemauditlogininforcleanpost) | **POST** /api/v1/system/audit/logininfor/clean | 清理登录日志|
|[**cleanOperLogApiV1SystemAuditOperlogCleanPost**](#cleanoperlogapiv1systemauditoperlogcleanpost) | **POST** /api/v1/system/audit/operlog/clean | 清理 N 天前的操作日志|
|[**createLoginInfoApiV1SystemAuditLogininforCreatePost**](#createlogininfoapiv1systemauditlogininforcreatepost) | **POST** /api/v1/system/audit/logininfor/create | 记录一条登录日志|
|[**createOperLogApiV1SystemAuditOperlogCreatePost**](#createoperlogapiv1systemauditoperlogcreatepost) | **POST** /api/v1/system/audit/operlog/create | 写入一条操作日志（内部调用）|
|[**exportLoginInfoApiV1SystemAuditLogininforExportGet**](#exportlogininfoapiv1systemauditlogininforexportget) | **GET** /api/v1/system/audit/logininfor/export | 导出登录日志到Excel|
|[**exportOperLogsApiV1SystemAuditOperlogExportGet**](#exportoperlogsapiv1systemauditoperlogexportget) | **GET** /api/v1/system/audit/operlog/export | 导出操作日志到Excel|
|[**listLoginInfoApiV1SystemAuditLogininforListGet**](#listlogininfoapiv1systemauditlogininforlistget) | **GET** /api/v1/system/audit/logininfor/list | 登录日志列表|
|[**listOperLogsApiV1SystemAuditOperlogListGet**](#listoperlogsapiv1systemauditoperloglistget) | **GET** /api/v1/system/audit/operlog/list | 操作日志列表|

# **cleanLoginInfoApiV1SystemAuditLogininforCleanPost**
> any cleanLoginInfoApiV1SystemAuditLogininforCleanPost()


### Example

```typescript
import {
    SystemAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAuditApi(configuration);

let days: number; // (optional) (default to 90)

const { status, data } = await apiInstance.cleanLoginInfoApiV1SystemAuditLogininforCleanPost(
    days
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **days** | [**number**] |  | (optional) defaults to 90|


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

# **cleanOperLogApiV1SystemAuditOperlogCleanPost**
> any cleanOperLogApiV1SystemAuditOperlogCleanPost()


### Example

```typescript
import {
    SystemAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAuditApi(configuration);

let days: number; //保留天数 (optional) (default to 90)

const { status, data } = await apiInstance.cleanOperLogApiV1SystemAuditOperlogCleanPost(
    days
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **days** | [**number**] | 保留天数 | (optional) defaults to 90|


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

# **createLoginInfoApiV1SystemAuditLogininforCreatePost**
> any createLoginInfoApiV1SystemAuditLogininforCreatePost()


### Example

```typescript
import {
    SystemAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAuditApi(configuration);

let userName: string; // (default to undefined)
let ipaddr: string; // (optional) (default to '')
let loginLocation: string; // (optional) (default to '')
let browser: string; // (optional) (default to '')
let os: string; // (optional) (default to '')
let status: string; // (optional) (default to '0')
let msg: string; // (optional) (default to '')

const { status, data } = await apiInstance.createLoginInfoApiV1SystemAuditLogininforCreatePost(
    userName,
    ipaddr,
    loginLocation,
    browser,
    os,
    status,
    msg
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userName** | [**string**] |  | defaults to undefined|
| **ipaddr** | [**string**] |  | (optional) defaults to ''|
| **loginLocation** | [**string**] |  | (optional) defaults to ''|
| **browser** | [**string**] |  | (optional) defaults to ''|
| **os** | [**string**] |  | (optional) defaults to ''|
| **status** | [**string**] |  | (optional) defaults to '0'|
| **msg** | [**string**] |  | (optional) defaults to ''|


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

# **createOperLogApiV1SystemAuditOperlogCreatePost**
> any createOperLogApiV1SystemAuditOperlogCreatePost()


### Example

```typescript
import {
    SystemAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAuditApi(configuration);

let title: string; // (default to undefined)
let businessType: number; //0 其它 1 新增 2 修改 3 删除 4 查询 (optional) (default to 0)
let method: string; // (optional) (default to '')
let requestMethod: string; // (optional) (default to '')
let operUrl: string; // (optional) (default to '')
let operName: string; // (optional) (default to 'system')
let operIp: string; // (optional) (default to '127.0.0.1')
let status: number; //0 成功 1 失败 (optional) (default to 0)
let errorMsg: string; // (optional) (default to '')

const { status, data } = await apiInstance.createOperLogApiV1SystemAuditOperlogCreatePost(
    title,
    businessType,
    method,
    requestMethod,
    operUrl,
    operName,
    operIp,
    status,
    errorMsg
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | defaults to undefined|
| **businessType** | [**number**] | 0 其它 1 新增 2 修改 3 删除 4 查询 | (optional) defaults to 0|
| **method** | [**string**] |  | (optional) defaults to ''|
| **requestMethod** | [**string**] |  | (optional) defaults to ''|
| **operUrl** | [**string**] |  | (optional) defaults to ''|
| **operName** | [**string**] |  | (optional) defaults to 'system'|
| **operIp** | [**string**] |  | (optional) defaults to '127.0.0.1'|
| **status** | [**number**] | 0 成功 1 失败 | (optional) defaults to 0|
| **errorMsg** | [**string**] |  | (optional) defaults to ''|


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

# **exportLoginInfoApiV1SystemAuditLogininforExportGet**
> any exportLoginInfoApiV1SystemAuditLogininforExportGet()


### Example

```typescript
import {
    SystemAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAuditApi(configuration);

let userName: string; // (optional) (default to undefined)
let status: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.exportLoginInfoApiV1SystemAuditLogininforExportGet(
    userName,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userName** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**string**] |  | (optional) defaults to undefined|


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

# **exportOperLogsApiV1SystemAuditOperlogExportGet**
> any exportOperLogsApiV1SystemAuditOperlogExportGet()


### Example

```typescript
import {
    SystemAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAuditApi(configuration);

let title: string; // (optional) (default to undefined)
let operName: string; // (optional) (default to undefined)
let businessType: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.exportOperLogsApiV1SystemAuditOperlogExportGet(
    title,
    operName,
    businessType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | (optional) defaults to undefined|
| **operName** | [**string**] |  | (optional) defaults to undefined|
| **businessType** | [**number**] |  | (optional) defaults to undefined|


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

# **listLoginInfoApiV1SystemAuditLogininforListGet**
> any listLoginInfoApiV1SystemAuditLogininforListGet()


### Example

```typescript
import {
    SystemAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAuditApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let userName: string; // (optional) (default to undefined)
let status: string; //0 成功 1 失败 (optional) (default to undefined)

const { status, data } = await apiInstance.listLoginInfoApiV1SystemAuditLogininforListGet(
    page,
    limit,
    userName,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **userName** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**string**] | 0 成功 1 失败 | (optional) defaults to undefined|


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

# **listOperLogsApiV1SystemAuditOperlogListGet**
> any listOperLogsApiV1SystemAuditOperlogListGet()


### Example

```typescript
import {
    SystemAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemAuditApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let title: string; // (optional) (default to undefined)
let operName: string; // (optional) (default to undefined)
let businessType: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listOperLogsApiV1SystemAuditOperlogListGet(
    page,
    limit,
    title,
    operName,
    businessType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **title** | [**string**] |  | (optional) defaults to undefined|
| **operName** | [**string**] |  | (optional) defaults to undefined|
| **businessType** | [**number**] |  | (optional) defaults to undefined|


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

