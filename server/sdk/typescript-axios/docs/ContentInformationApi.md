# ContentInformationApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createInformationApiV1ContentInformationCreatePost**](#createinformationapiv1contentinformationcreatepost) | **POST** /api/v1/content/information/create | 创建资讯|
|[**listDictionaryApiV1ContentInformationDictionaryGet**](#listdictionaryapiv1contentinformationdictionaryget) | **GET** /api/v1/content/information/dictionary | 资讯分类字典|
|[**listInformationApiV1ContentInformationListGet**](#listinformationapiv1contentinformationlistget) | **GET** /api/v1/content/information/list | 资讯列表|

# **createInformationApiV1ContentInformationCreatePost**
> any createInformationApiV1ContentInformationCreatePost()

管理端创建一条 AI 资讯。

### Example

```typescript
import {
    ContentInformationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentInformationApi(configuration);

let title: string; // (default to undefined)
let content: string; // (optional) (default to '')
let type: number; //资讯分类 type (optional) (default to undefined)
let sort: number; // (optional) (default to 0)

const { status, data } = await apiInstance.createInformationApiV1ContentInformationCreatePost(
    title,
    content,
    type,
    sort
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | defaults to undefined|
| **content** | [**string**] |  | (optional) defaults to ''|
| **type** | [**number**] | 资讯分类 type | (optional) defaults to undefined|
| **sort** | [**number**] |  | (optional) defaults to 0|


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

# **listDictionaryApiV1ContentInformationDictionaryGet**
> any listDictionaryApiV1ContentInformationDictionaryGet()

返回 zhs_category_dictionary 中的分类字典列表。

### Example

```typescript
import {
    ContentInformationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentInformationApi(configuration);

let type: string; //字典类型筛选 (optional) (default to undefined)

const { status, data } = await apiInstance.listDictionaryApiV1ContentInformationDictionaryGet(
    type
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **type** | [**string**] | 字典类型筛选 | (optional) defaults to undefined|


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

# **listInformationApiV1ContentInformationListGet**
> any listInformationApiV1ContentInformationListGet()

分页返回资讯列表。

### Example

```typescript
import {
    ContentInformationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentInformationApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let type: number; //按分类筛选 (optional) (default to undefined)
let status: number; //筛选状态: 0=禁用 1=启用 (optional) (default to undefined)

const { status, data } = await apiInstance.listInformationApiV1ContentInformationListGet(
    page,
    limit,
    type,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **type** | [**number**] | 按分类筛选 | (optional) defaults to undefined|
| **status** | [**number**] | 筛选状态: 0&#x3D;禁用 1&#x3D;启用 | (optional) defaults to undefined|


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

