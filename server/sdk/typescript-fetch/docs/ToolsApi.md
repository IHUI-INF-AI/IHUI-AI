# ToolsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**listCategoriesApiV1ToolsCategoriesGet**](ToolsApi.md#listcategoriesapiv1toolscategoriesget) | **GET** /api/v1/tools/categories | 获取工具分类列表 |
| [**listToolsApiV1ToolsListGet**](ToolsApi.md#listtoolsapiv1toolslistget) | **GET** /api/v1/tools/list | 获取工具列表 |
| [**uploadFileApiV1ToolsUploadPost**](ToolsApi.md#uploadfileapiv1toolsuploadpost) | **POST** /api/v1/tools/upload | Upload file to MinIO |



## listCategoriesApiV1ToolsCategoriesGet

> any listCategoriesApiV1ToolsCategoriesGet()

获取工具分类列表

获取工具分类及每个分类的工具数量

### Example

```ts
import {
  Configuration,
  ToolsApi,
} from '';
import type { ListCategoriesApiV1ToolsCategoriesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ToolsApi();

  try {
    const data = await api.listCategoriesApiV1ToolsCategoriesGet();
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


## listToolsApiV1ToolsListGet

> any listToolsApiV1ToolsListGet(category, keyword, sort)

获取工具列表

获取工具列表 (对接 Tools.vue 前端)

### Example

```ts
import {
  Configuration,
  ToolsApi,
} from '';
import type { ListToolsApiV1ToolsListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ToolsApi();

  const body = {
    // string | 分类过滤 (optional)
    category: category_example,
    // string | 搜索关键词 (optional)
    keyword: keyword_example,
    // string | 排序: default/name/hot (optional)
    sort: sort_example,
  } satisfies ListToolsApiV1ToolsListGetRequest;

  try {
    const data = await api.listToolsApiV1ToolsListGet(body);
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
| **category** | `string` | 分类过滤 | [Optional] [Defaults to `undefined`] |
| **keyword** | `string` | 搜索关键词 | [Optional] [Defaults to `undefined`] |
| **sort** | `string` | 排序: default/name/hot | [Optional] [Defaults to `undefined`] |

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


## uploadFileApiV1ToolsUploadPost

> any uploadFileApiV1ToolsUploadPost(file)

Upload file to MinIO

### Example

```ts
import {
  Configuration,
  ToolsApi,
} from '';
import type { UploadFileApiV1ToolsUploadPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ToolsApi(config);

  const body = {
    // Blob
    file: BINARY_DATA_HERE,
  } satisfies UploadFileApiV1ToolsUploadPostRequest;

  try {
    const data = await api.uploadFileApiV1ToolsUploadPost(body);
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
| **file** | `Blob` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

