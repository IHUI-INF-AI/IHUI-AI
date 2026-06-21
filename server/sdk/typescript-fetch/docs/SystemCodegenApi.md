# SystemCodegenApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**genColumnListApiV1SystemGenColumnTableIdGet**](SystemCodegenApi.md#gencolumnlistapiv1systemgencolumntableidget) | **GET** /api/v1/system/gen/column/{table_id} | List columns for an imported table |
| [**genDbListApiV1SystemGenDbListGet**](SystemCodegenApi.md#gendblistapiv1systemgendblistget) | **GET** /api/v1/system/gen/db/list | List database tables from information_schema |
| [**genDeleteApiV1SystemGenTableIdsDelete**](SystemCodegenApi.md#gendeleteapiv1systemgentableidsdelete) | **DELETE** /api/v1/system/gen/{table_ids} | Delete imported codegen tables |
| [**genDownloadApiV1SystemGenDownloadTableNameGet**](SystemCodegenApi.md#gendownloadapiv1systemgendownloadtablenameget) | **GET** /api/v1/system/gen/download/{table_name} | Download generated code as zip |
| [**genImportTableApiV1SystemGenImportTablePost**](SystemCodegenApi.md#genimporttableapiv1systemgenimporttablepost) | **POST** /api/v1/system/gen/import_table | Import database tables into codegen |
| [**genListApiV1SystemGenListGet**](SystemCodegenApi.md#genlistapiv1systemgenlistget) | **GET** /api/v1/system/gen/list | List imported codegen tables |
| [**genPreviewApiV1SystemGenPreviewTableIdGet**](SystemCodegenApi.md#genpreviewapiv1systemgenpreviewtableidget) | **GET** /api/v1/system/gen/preview/{table_id} | Preview generated code for a table |
| [**genUpdateApiV1SystemGenPut**](SystemCodegenApi.md#genupdateapiv1systemgenput) | **PUT** /api/v1/system/gen | Update codegen table metadata |



## genColumnListApiV1SystemGenColumnTableIdGet

> any genColumnListApiV1SystemGenColumnTableIdGet(tableId)

List columns for an imported table

查询已导入表的字段列表

### Example

```ts
import {
  Configuration,
  SystemCodegenApi,
} from '';
import type { GenColumnListApiV1SystemGenColumnTableIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemCodegenApi(config);

  const body = {
    // number
    tableId: 56,
  } satisfies GenColumnListApiV1SystemGenColumnTableIdGetRequest;

  try {
    const data = await api.genColumnListApiV1SystemGenColumnTableIdGet(body);
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
| **tableId** | `number` |  | [Defaults to `undefined`] |

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


## genDbListApiV1SystemGenDbListGet

> any genDbListApiV1SystemGenDbListGet(page, limit, tableName, tableComment)

List database tables from information_schema

从 information_schema 查询数据库表列表

### Example

```ts
import {
  Configuration,
  SystemCodegenApi,
} from '';
import type { GenDbListApiV1SystemGenDbListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemCodegenApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    tableName: tableName_example,
    // string (optional)
    tableComment: tableComment_example,
  } satisfies GenDbListApiV1SystemGenDbListGetRequest;

  try {
    const data = await api.genDbListApiV1SystemGenDbListGet(body);
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
| **tableName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **tableComment** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## genDeleteApiV1SystemGenTableIdsDelete

> any genDeleteApiV1SystemGenTableIdsDelete(tableIds)

Delete imported codegen tables

删除代码生成记录

### Example

```ts
import {
  Configuration,
  SystemCodegenApi,
} from '';
import type { GenDeleteApiV1SystemGenTableIdsDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemCodegenApi(config);

  const body = {
    // string | Comma-separated table IDs
    tableIds: tableIds_example,
  } satisfies GenDeleteApiV1SystemGenTableIdsDeleteRequest;

  try {
    const data = await api.genDeleteApiV1SystemGenTableIdsDelete(body);
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
| **tableIds** | `string` | Comma-separated table IDs | [Defaults to `undefined`] |

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


## genDownloadApiV1SystemGenDownloadTableNameGet

> any genDownloadApiV1SystemGenDownloadTableNameGet(tableName)

Download generated code as zip

下载生成的代码 zip 文件

### Example

```ts
import {
  Configuration,
  SystemCodegenApi,
} from '';
import type { GenDownloadApiV1SystemGenDownloadTableNameGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemCodegenApi(config);

  const body = {
    // string
    tableName: tableName_example,
  } satisfies GenDownloadApiV1SystemGenDownloadTableNameGetRequest;

  try {
    const data = await api.genDownloadApiV1SystemGenDownloadTableNameGet(body);
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
| **tableName** | `string` |  | [Defaults to `undefined`] |

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


## genImportTableApiV1SystemGenImportTablePost

> any genImportTableApiV1SystemGenImportTablePost(bodyGenImportTableApiV1SystemGenImportTablePost)

Import database tables into codegen

导入数据库表结构到代码生成

### Example

```ts
import {
  Configuration,
  SystemCodegenApi,
} from '';
import type { GenImportTableApiV1SystemGenImportTablePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemCodegenApi(config);

  const body = {
    // BodyGenImportTableApiV1SystemGenImportTablePost
    bodyGenImportTableApiV1SystemGenImportTablePost: ...,
  } satisfies GenImportTableApiV1SystemGenImportTablePostRequest;

  try {
    const data = await api.genImportTableApiV1SystemGenImportTablePost(body);
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
| **bodyGenImportTableApiV1SystemGenImportTablePost** | [BodyGenImportTableApiV1SystemGenImportTablePost](BodyGenImportTableApiV1SystemGenImportTablePost.md) |  | |

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


## genListApiV1SystemGenListGet

> any genListApiV1SystemGenListGet(page, limit, tableName, tableComment)

List imported codegen tables

分页查询已导入的代码生成表列表

### Example

```ts
import {
  Configuration,
  SystemCodegenApi,
} from '';
import type { GenListApiV1SystemGenListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemCodegenApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    tableName: tableName_example,
    // string (optional)
    tableComment: tableComment_example,
  } satisfies GenListApiV1SystemGenListGetRequest;

  try {
    const data = await api.genListApiV1SystemGenListGet(body);
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
| **tableName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **tableComment** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## genPreviewApiV1SystemGenPreviewTableIdGet

> any genPreviewApiV1SystemGenPreviewTableIdGet(tableId)

Preview generated code for a table

预览生成的代码

### Example

```ts
import {
  Configuration,
  SystemCodegenApi,
} from '';
import type { GenPreviewApiV1SystemGenPreviewTableIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemCodegenApi(config);

  const body = {
    // number
    tableId: 56,
  } satisfies GenPreviewApiV1SystemGenPreviewTableIdGetRequest;

  try {
    const data = await api.genPreviewApiV1SystemGenPreviewTableIdGet(body);
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
| **tableId** | `number` |  | [Defaults to `undefined`] |

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


## genUpdateApiV1SystemGenPut

> any genUpdateApiV1SystemGenPut(requestBody)

Update codegen table metadata

修改代码生成业务配置

### Example

```ts
import {
  Configuration,
  SystemCodegenApi,
} from '';
import type { GenUpdateApiV1SystemGenPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemCodegenApi(config);

  const body = {
    // { [key: string]: any; }
    requestBody: Object,
  } satisfies GenUpdateApiV1SystemGenPutRequest;

  try {
    const data = await api.genUpdateApiV1SystemGenPut(body);
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
| **requestBody** | `{ [key: string]: any; }` |  | |

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

