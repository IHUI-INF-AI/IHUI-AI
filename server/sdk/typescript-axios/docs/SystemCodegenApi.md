# SystemCodegenApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**genColumnListApiV1SystemGenColumnTableIdGet**](#gencolumnlistapiv1systemgencolumntableidget) | **GET** /api/v1/system/gen/column/{table_id} | List columns for an imported table|
|[**genDbListApiV1SystemGenDbListGet**](#gendblistapiv1systemgendblistget) | **GET** /api/v1/system/gen/db/list | List database tables from information_schema|
|[**genDeleteApiV1SystemGenTableIdsDelete**](#gendeleteapiv1systemgentableidsdelete) | **DELETE** /api/v1/system/gen/{table_ids} | Delete imported codegen tables|
|[**genDownloadApiV1SystemGenDownloadTableNameGet**](#gendownloadapiv1systemgendownloadtablenameget) | **GET** /api/v1/system/gen/download/{table_name} | Download generated code as zip|
|[**genImportTableApiV1SystemGenImportTablePost**](#genimporttableapiv1systemgenimporttablepost) | **POST** /api/v1/system/gen/import_table | Import database tables into codegen|
|[**genListApiV1SystemGenListGet**](#genlistapiv1systemgenlistget) | **GET** /api/v1/system/gen/list | List imported codegen tables|
|[**genPreviewApiV1SystemGenPreviewTableIdGet**](#genpreviewapiv1systemgenpreviewtableidget) | **GET** /api/v1/system/gen/preview/{table_id} | Preview generated code for a table|
|[**genUpdateApiV1SystemGenPut**](#genupdateapiv1systemgenput) | **PUT** /api/v1/system/gen | Update codegen table metadata|

# **genColumnListApiV1SystemGenColumnTableIdGet**
> any genColumnListApiV1SystemGenColumnTableIdGet()

查询已导入表的字段列表

### Example

```typescript
import {
    SystemCodegenApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemCodegenApi(configuration);

let tableId: number; // (default to undefined)

const { status, data } = await apiInstance.genColumnListApiV1SystemGenColumnTableIdGet(
    tableId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tableId** | [**number**] |  | defaults to undefined|


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

# **genDbListApiV1SystemGenDbListGet**
> any genDbListApiV1SystemGenDbListGet()

从 information_schema 查询数据库表列表

### Example

```typescript
import {
    SystemCodegenApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemCodegenApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let tableName: string; // (optional) (default to undefined)
let tableComment: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.genDbListApiV1SystemGenDbListGet(
    page,
    limit,
    tableName,
    tableComment
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **tableName** | [**string**] |  | (optional) defaults to undefined|
| **tableComment** | [**string**] |  | (optional) defaults to undefined|


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

# **genDeleteApiV1SystemGenTableIdsDelete**
> any genDeleteApiV1SystemGenTableIdsDelete()

删除代码生成记录

### Example

```typescript
import {
    SystemCodegenApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemCodegenApi(configuration);

let tableIds: string; //Comma-separated table IDs (default to undefined)

const { status, data } = await apiInstance.genDeleteApiV1SystemGenTableIdsDelete(
    tableIds
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tableIds** | [**string**] | Comma-separated table IDs | defaults to undefined|


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

# **genDownloadApiV1SystemGenDownloadTableNameGet**
> any genDownloadApiV1SystemGenDownloadTableNameGet()

下载生成的代码 zip 文件

### Example

```typescript
import {
    SystemCodegenApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemCodegenApi(configuration);

let tableName: string; // (default to undefined)

const { status, data } = await apiInstance.genDownloadApiV1SystemGenDownloadTableNameGet(
    tableName
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tableName** | [**string**] |  | defaults to undefined|


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

# **genImportTableApiV1SystemGenImportTablePost**
> any genImportTableApiV1SystemGenImportTablePost(bodyGenImportTableApiV1SystemGenImportTablePost)

导入数据库表结构到代码生成

### Example

```typescript
import {
    SystemCodegenApi,
    Configuration,
    BodyGenImportTableApiV1SystemGenImportTablePost
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemCodegenApi(configuration);

let bodyGenImportTableApiV1SystemGenImportTablePost: BodyGenImportTableApiV1SystemGenImportTablePost; //

const { status, data } = await apiInstance.genImportTableApiV1SystemGenImportTablePost(
    bodyGenImportTableApiV1SystemGenImportTablePost
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyGenImportTableApiV1SystemGenImportTablePost** | **BodyGenImportTableApiV1SystemGenImportTablePost**|  | |


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

# **genListApiV1SystemGenListGet**
> any genListApiV1SystemGenListGet()

分页查询已导入的代码生成表列表

### Example

```typescript
import {
    SystemCodegenApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemCodegenApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let tableName: string; // (optional) (default to undefined)
let tableComment: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.genListApiV1SystemGenListGet(
    page,
    limit,
    tableName,
    tableComment
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **tableName** | [**string**] |  | (optional) defaults to undefined|
| **tableComment** | [**string**] |  | (optional) defaults to undefined|


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

# **genPreviewApiV1SystemGenPreviewTableIdGet**
> any genPreviewApiV1SystemGenPreviewTableIdGet()

预览生成的代码

### Example

```typescript
import {
    SystemCodegenApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemCodegenApi(configuration);

let tableId: number; // (default to undefined)

const { status, data } = await apiInstance.genPreviewApiV1SystemGenPreviewTableIdGet(
    tableId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **tableId** | [**number**] |  | defaults to undefined|


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

# **genUpdateApiV1SystemGenPut**
> any genUpdateApiV1SystemGenPut(requestBody)

修改代码生成业务配置

### Example

```typescript
import {
    SystemCodegenApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemCodegenApi(configuration);

let requestBody: { [key: string]: any; }; //

const { status, data } = await apiInstance.genUpdateApiV1SystemGenPut(
    requestBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **requestBody** | **{ [key: string]: any; }**|  | |


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

