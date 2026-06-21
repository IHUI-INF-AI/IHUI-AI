# ContentInformationApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createInformationApiV1ContentInformationCreatePost**](ContentInformationApi.md#createinformationapiv1contentinformationcreatepost) | **POST** /api/v1/content/information/create | 创建资讯 |
| [**listDictionaryApiV1ContentInformationDictionaryGet**](ContentInformationApi.md#listdictionaryapiv1contentinformationdictionaryget) | **GET** /api/v1/content/information/dictionary | 资讯分类字典 |
| [**listInformationApiV1ContentInformationListGet**](ContentInformationApi.md#listinformationapiv1contentinformationlistget) | **GET** /api/v1/content/information/list | 资讯列表 |



## createInformationApiV1ContentInformationCreatePost

> any createInformationApiV1ContentInformationCreatePost(title, content, type, sort)

创建资讯

管理端创建一条 AI 资讯。

### Example

```ts
import {
  Configuration,
  ContentInformationApi,
} from '';
import type { CreateInformationApiV1ContentInformationCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContentInformationApi(config);

  const body = {
    // string
    title: title_example,
    // string (optional)
    content: content_example,
    // number | 资讯分类 type (optional)
    type: 56,
    // number (optional)
    sort: 56,
  } satisfies CreateInformationApiV1ContentInformationCreatePostRequest;

  try {
    const data = await api.createInformationApiV1ContentInformationCreatePost(body);
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
| **content** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **type** | `number` | 资讯分类 type | [Optional] [Defaults to `undefined`] |
| **sort** | `number` |  | [Optional] [Defaults to `0`] |

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


## listDictionaryApiV1ContentInformationDictionaryGet

> any listDictionaryApiV1ContentInformationDictionaryGet(type)

资讯分类字典

返回 zhs_category_dictionary 中的分类字典列表。

### Example

```ts
import {
  Configuration,
  ContentInformationApi,
} from '';
import type { ListDictionaryApiV1ContentInformationDictionaryGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentInformationApi();

  const body = {
    // string | 字典类型筛选 (optional)
    type: type_example,
  } satisfies ListDictionaryApiV1ContentInformationDictionaryGetRequest;

  try {
    const data = await api.listDictionaryApiV1ContentInformationDictionaryGet(body);
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
| **type** | `string` | 字典类型筛选 | [Optional] [Defaults to `undefined`] |

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


## listInformationApiV1ContentInformationListGet

> any listInformationApiV1ContentInformationListGet(page, limit, type, status)

资讯列表

分页返回资讯列表。

### Example

```ts
import {
  Configuration,
  ContentInformationApi,
} from '';
import type { ListInformationApiV1ContentInformationListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentInformationApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number | 按分类筛选 (optional)
    type: 56,
    // number | 筛选状态: 0=禁用 1=启用 (optional)
    status: 56,
  } satisfies ListInformationApiV1ContentInformationListGetRequest;

  try {
    const data = await api.listInformationApiV1ContentInformationListGet(body);
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
| **type** | `number` | 按分类筛选 | [Optional] [Defaults to `undefined`] |
| **status** | `number` | 筛选状态: 0&#x3D;禁用 1&#x3D;启用 | [Optional] [Defaults to `undefined`] |

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

