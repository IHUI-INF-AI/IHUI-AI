# SystemAuditApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**cleanLoginInfoApiV1SystemAuditLogininforCleanPost**](SystemAuditApi.md#cleanlogininfoapiv1systemauditlogininforcleanpost) | **POST** /api/v1/system/audit/logininfor/clean | 清理登录日志 |
| [**cleanOperLogApiV1SystemAuditOperlogCleanPost**](SystemAuditApi.md#cleanoperlogapiv1systemauditoperlogcleanpost) | **POST** /api/v1/system/audit/operlog/clean | 清理 N 天前的操作日志 |
| [**createLoginInfoApiV1SystemAuditLogininforCreatePost**](SystemAuditApi.md#createlogininfoapiv1systemauditlogininforcreatepost) | **POST** /api/v1/system/audit/logininfor/create | 记录一条登录日志 |
| [**createOperLogApiV1SystemAuditOperlogCreatePost**](SystemAuditApi.md#createoperlogapiv1systemauditoperlogcreatepost) | **POST** /api/v1/system/audit/operlog/create | 写入一条操作日志（内部调用） |
| [**exportLoginInfoApiV1SystemAuditLogininforExportGet**](SystemAuditApi.md#exportlogininfoapiv1systemauditlogininforexportget) | **GET** /api/v1/system/audit/logininfor/export | 导出登录日志到Excel |
| [**exportOperLogsApiV1SystemAuditOperlogExportGet**](SystemAuditApi.md#exportoperlogsapiv1systemauditoperlogexportget) | **GET** /api/v1/system/audit/operlog/export | 导出操作日志到Excel |
| [**listLoginInfoApiV1SystemAuditLogininforListGet**](SystemAuditApi.md#listlogininfoapiv1systemauditlogininforlistget) | **GET** /api/v1/system/audit/logininfor/list | 登录日志列表 |
| [**listOperLogsApiV1SystemAuditOperlogListGet**](SystemAuditApi.md#listoperlogsapiv1systemauditoperloglistget) | **GET** /api/v1/system/audit/operlog/list | 操作日志列表 |



## cleanLoginInfoApiV1SystemAuditLogininforCleanPost

> any cleanLoginInfoApiV1SystemAuditLogininforCleanPost(days)

清理登录日志

### Example

```ts
import {
  Configuration,
  SystemAuditApi,
} from '';
import type { CleanLoginInfoApiV1SystemAuditLogininforCleanPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SystemAuditApi();

  const body = {
    // number (optional)
    days: 56,
  } satisfies CleanLoginInfoApiV1SystemAuditLogininforCleanPostRequest;

  try {
    const data = await api.cleanLoginInfoApiV1SystemAuditLogininforCleanPost(body);
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
| **days** | `number` |  | [Optional] [Defaults to `90`] |

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


## cleanOperLogApiV1SystemAuditOperlogCleanPost

> any cleanOperLogApiV1SystemAuditOperlogCleanPost(days)

清理 N 天前的操作日志

### Example

```ts
import {
  Configuration,
  SystemAuditApi,
} from '';
import type { CleanOperLogApiV1SystemAuditOperlogCleanPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SystemAuditApi();

  const body = {
    // number | 保留天数 (optional)
    days: 56,
  } satisfies CleanOperLogApiV1SystemAuditOperlogCleanPostRequest;

  try {
    const data = await api.cleanOperLogApiV1SystemAuditOperlogCleanPost(body);
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
| **days** | `number` | 保留天数 | [Optional] [Defaults to `90`] |

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


## createLoginInfoApiV1SystemAuditLogininforCreatePost

> any createLoginInfoApiV1SystemAuditLogininforCreatePost(userName, ipaddr, loginLocation, browser, os, status, msg)

记录一条登录日志

### Example

```ts
import {
  Configuration,
  SystemAuditApi,
} from '';
import type { CreateLoginInfoApiV1SystemAuditLogininforCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SystemAuditApi();

  const body = {
    // string
    userName: userName_example,
    // string (optional)
    ipaddr: ipaddr_example,
    // string (optional)
    loginLocation: loginLocation_example,
    // string (optional)
    browser: browser_example,
    // string (optional)
    os: os_example,
    // string (optional)
    status: status_example,
    // string (optional)
    msg: msg_example,
  } satisfies CreateLoginInfoApiV1SystemAuditLogininforCreatePostRequest;

  try {
    const data = await api.createLoginInfoApiV1SystemAuditLogininforCreatePost(body);
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
| **userName** | `string` |  | [Defaults to `undefined`] |
| **ipaddr** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **loginLocation** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **browser** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **os** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **status** | `string` |  | [Optional] [Defaults to `&#39;0&#39;`] |
| **msg** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |

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


## createOperLogApiV1SystemAuditOperlogCreatePost

> any createOperLogApiV1SystemAuditOperlogCreatePost(title, businessType, method, requestMethod, operUrl, operName, operIp, status, errorMsg)

写入一条操作日志（内部调用）

### Example

```ts
import {
  Configuration,
  SystemAuditApi,
} from '';
import type { CreateOperLogApiV1SystemAuditOperlogCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SystemAuditApi();

  const body = {
    // string
    title: title_example,
    // number | 0 其它 1 新增 2 修改 3 删除 4 查询 (optional)
    businessType: 56,
    // string (optional)
    method: method_example,
    // string (optional)
    requestMethod: requestMethod_example,
    // string (optional)
    operUrl: operUrl_example,
    // string (optional)
    operName: operName_example,
    // string (optional)
    operIp: operIp_example,
    // number | 0 成功 1 失败 (optional)
    status: 56,
    // string (optional)
    errorMsg: errorMsg_example,
  } satisfies CreateOperLogApiV1SystemAuditOperlogCreatePostRequest;

  try {
    const data = await api.createOperLogApiV1SystemAuditOperlogCreatePost(body);
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
| **title** | `string` |  | [Defaults to `undefined`] |
| **businessType** | `number` | 0 其它 1 新增 2 修改 3 删除 4 查询 | [Optional] [Defaults to `0`] |
| **method** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **requestMethod** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **operUrl** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **operName** | `string` |  | [Optional] [Defaults to `&#39;system&#39;`] |
| **operIp** | `string` |  | [Optional] [Defaults to `&#39;127.0.0.1&#39;`] |
| **status** | `number` | 0 成功 1 失败 | [Optional] [Defaults to `0`] |
| **errorMsg** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |

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


## exportLoginInfoApiV1SystemAuditLogininforExportGet

> any exportLoginInfoApiV1SystemAuditLogininforExportGet(userName, status)

导出登录日志到Excel

### Example

```ts
import {
  Configuration,
  SystemAuditApi,
} from '';
import type { ExportLoginInfoApiV1SystemAuditLogininforExportGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAuditApi(config);

  const body = {
    // string (optional)
    userName: userName_example,
    // string (optional)
    status: status_example,
  } satisfies ExportLoginInfoApiV1SystemAuditLogininforExportGetRequest;

  try {
    const data = await api.exportLoginInfoApiV1SystemAuditLogininforExportGet(body);
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
| **userName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## exportOperLogsApiV1SystemAuditOperlogExportGet

> any exportOperLogsApiV1SystemAuditOperlogExportGet(title, operName, businessType)

导出操作日志到Excel

### Example

```ts
import {
  Configuration,
  SystemAuditApi,
} from '';
import type { ExportOperLogsApiV1SystemAuditOperlogExportGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAuditApi(config);

  const body = {
    // string (optional)
    title: title_example,
    // string (optional)
    operName: operName_example,
    // number (optional)
    businessType: 56,
  } satisfies ExportOperLogsApiV1SystemAuditOperlogExportGetRequest;

  try {
    const data = await api.exportOperLogsApiV1SystemAuditOperlogExportGet(body);
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
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |
| **operName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **businessType** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## listLoginInfoApiV1SystemAuditLogininforListGet

> any listLoginInfoApiV1SystemAuditLogininforListGet(page, limit, userName, status)

登录日志列表

### Example

```ts
import {
  Configuration,
  SystemAuditApi,
} from '';
import type { ListLoginInfoApiV1SystemAuditLogininforListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAuditApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    userName: userName_example,
    // string | 0 成功 1 失败 (optional)
    status: status_example,
  } satisfies ListLoginInfoApiV1SystemAuditLogininforListGetRequest;

  try {
    const data = await api.listLoginInfoApiV1SystemAuditLogininforListGet(body);
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
| **userName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `string` | 0 成功 1 失败 | [Optional] [Defaults to `undefined`] |

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


## listOperLogsApiV1SystemAuditOperlogListGet

> any listOperLogsApiV1SystemAuditOperlogListGet(page, limit, title, operName, businessType)

操作日志列表

### Example

```ts
import {
  Configuration,
  SystemAuditApi,
} from '';
import type { ListOperLogsApiV1SystemAuditOperlogListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SystemAuditApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    title: title_example,
    // string (optional)
    operName: operName_example,
    // number (optional)
    businessType: 56,
  } satisfies ListOperLogsApiV1SystemAuditOperlogListGetRequest;

  try {
    const data = await api.listOperLogsApiV1SystemAuditOperlogListGet(body);
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
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |
| **operName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **businessType** | `number` |  | [Optional] [Defaults to `undefined`] |

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

