# ToolsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**listCategoriesApiV1ToolsCategoriesGet**](#listcategoriesapiv1toolscategoriesget) | **GET** /api/v1/tools/categories | 获取工具分类列表|
|[**listToolsApiV1ToolsListGet**](#listtoolsapiv1toolslistget) | **GET** /api/v1/tools/list | 获取工具列表|
|[**uploadFileApiV1ToolsUploadPost**](#uploadfileapiv1toolsuploadpost) | **POST** /api/v1/tools/upload | Upload file to MinIO|

# **listCategoriesApiV1ToolsCategoriesGet**
> any listCategoriesApiV1ToolsCategoriesGet()

获取工具分类及每个分类的工具数量

### Example

```typescript
import {
    ToolsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ToolsApi(configuration);

const { status, data } = await apiInstance.listCategoriesApiV1ToolsCategoriesGet();
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

# **listToolsApiV1ToolsListGet**
> any listToolsApiV1ToolsListGet()

获取工具列表 (对接 Tools.vue 前端)

### Example

```typescript
import {
    ToolsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ToolsApi(configuration);

let category: string; //分类过滤 (optional) (default to undefined)
let keyword: string; //搜索关键词 (optional) (default to undefined)
let sort: string; //排序: default/name/hot (optional) (default to undefined)

const { status, data } = await apiInstance.listToolsApiV1ToolsListGet(
    category,
    keyword,
    sort
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **category** | [**string**] | 分类过滤 | (optional) defaults to undefined|
| **keyword** | [**string**] | 搜索关键词 | (optional) defaults to undefined|
| **sort** | [**string**] | 排序: default/name/hot | (optional) defaults to undefined|


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

# **uploadFileApiV1ToolsUploadPost**
> any uploadFileApiV1ToolsUploadPost()


### Example

```typescript
import {
    ToolsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ToolsApi(configuration);

let file: File; // (default to undefined)

const { status, data } = await apiInstance.uploadFileApiV1ToolsUploadPost(
    file
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **file** | [**File**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

