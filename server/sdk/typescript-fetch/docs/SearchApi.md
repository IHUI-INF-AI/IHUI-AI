# SearchApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addHotKeywordApiV1SearchHotKeywordPost**](SearchApi.md#addhotkeywordapiv1searchhotkeywordpost) | **POST** /api/v1/search/hot/keyword | 添加热搜词 |
| [**addHotKeywordApiV1SearchHotKeywordPost_0**](SearchApi.md#addhotkeywordapiv1searchhotkeywordpost_0) | **POST** /api/v1/search/hot/keyword | 添加热搜词 |
| [**addIndexApiV1SearchIndexPost**](SearchApi.md#addindexapiv1searchindexpost) | **POST** /api/v1/search/index | 添加/更新索引 |
| [**addIndexApiV1SearchIndexPost_0**](SearchApi.md#addindexapiv1searchindexpost_0) | **POST** /api/v1/search/index | 添加/更新索引 |
| [**deleteByTargetApiV1SearchIndexByTargetDelete**](SearchApi.md#deletebytargetapiv1searchindexbytargetdelete) | **DELETE** /api/v1/search/index/by-target | 按目标删除索引 |
| [**deleteByTargetApiV1SearchIndexByTargetDelete_0**](SearchApi.md#deletebytargetapiv1searchindexbytargetdelete_0) | **DELETE** /api/v1/search/index/by-target | 按目标删除索引 |
| [**deleteHotKeywordApiV1SearchHotKeywordKidDelete**](SearchApi.md#deletehotkeywordapiv1searchhotkeywordkiddelete) | **DELETE** /api/v1/search/hot/keyword/{kid} | 删除热搜词 |
| [**deleteHotKeywordApiV1SearchHotKeywordKidDelete_0**](SearchApi.md#deletehotkeywordapiv1searchhotkeywordkiddelete_0) | **DELETE** /api/v1/search/hot/keyword/{kid} | 删除热搜词 |
| [**deleteIndexApiV1SearchIndexIdxIdDelete**](SearchApi.md#deleteindexapiv1searchindexidxiddelete) | **DELETE** /api/v1/search/index/{idx_id} | 删除索引 |
| [**deleteIndexApiV1SearchIndexIdxIdDelete_0**](SearchApi.md#deleteindexapiv1searchindexidxiddelete_0) | **DELETE** /api/v1/search/index/{idx_id} | 删除索引 |
| [**hotKeywordsApiV1SearchHotGet**](SearchApi.md#hotkeywordsapiv1searchhotget) | **GET** /api/v1/search/hot | 热搜词 |
| [**hotKeywordsApiV1SearchHotGet_0**](SearchApi.md#hotkeywordsapiv1searchhotget_0) | **GET** /api/v1/search/hot | 热搜词 |
| [**queryApiV1SearchQueryGet**](SearchApi.md#queryapiv1searchqueryget) | **GET** /api/v1/search/query | 全文搜索 |
| [**queryApiV1SearchQueryGet_0**](SearchApi.md#queryapiv1searchqueryget_0) | **GET** /api/v1/search/query | 全文搜索 |
| [**searchLogList**](SearchApi.md#searchloglist) | **GET** /api/v1/search/log/list | 搜索日志 |
| [**searchLogList_0**](SearchApi.md#searchloglist_0) | **GET** /api/v1/search/log/list | 搜索日志 |
| [**suggestApiV1SearchSuggestGet**](SearchApi.md#suggestapiv1searchsuggestget) | **GET** /api/v1/search/suggest | 搜索建议 |
| [**suggestApiV1SearchSuggestGet_0**](SearchApi.md#suggestapiv1searchsuggestget_0) | **GET** /api/v1/search/suggest | 搜索建议 |



## addHotKeywordApiV1SearchHotKeywordPost

> any addHotKeywordApiV1SearchHotKeywordPost(keyword, isHot, sortOrder)

添加热搜词

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '';
import type { AddHotKeywordApiV1SearchHotKeywordPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SearchApi();

  const body = {
    // string
    keyword: keyword_example,
    // boolean (optional)
    isHot: true,
    // number (optional)
    sortOrder: 56,
  } satisfies AddHotKeywordApiV1SearchHotKeywordPostRequest;

  try {
    const data = await api.addHotKeywordApiV1SearchHotKeywordPost(body);
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
| **keyword** | `string` |  | [Defaults to `undefined`] |
| **isHot** | `boolean` |  | [Optional] [Defaults to `false`] |
| **sortOrder** | `number` |  | [Optional] [Defaults to `0`] |

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


## addHotKeywordApiV1SearchHotKeywordPost_0

> any addHotKeywordApiV1SearchHotKeywordPost_0(keyword, isHot, sortOrder)

添加热搜词

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '';
import type { AddHotKeywordApiV1SearchHotKeywordPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SearchApi();

  const body = {
    // string
    keyword: keyword_example,
    // boolean (optional)
    isHot: true,
    // number (optional)
    sortOrder: 56,
  } satisfies AddHotKeywordApiV1SearchHotKeywordPost0Request;

  try {
    const data = await api.addHotKeywordApiV1SearchHotKeywordPost_0(body);
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
| **keyword** | `string` |  | [Defaults to `undefined`] |
| **isHot** | `boolean` |  | [Optional] [Defaults to `false`] |
| **sortOrder** | `number` |  | [Optional] [Defaults to `0`] |

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


## addIndexApiV1SearchIndexPost

> any addIndexApiV1SearchIndexPost(targetType, targetId, title, content, keywords, category, tags, cover, url, userId, userName, weight)

添加/更新索引

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '';
import type { AddIndexApiV1SearchIndexPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SearchApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
    // string
    title: title_example,
    // string (optional)
    content: content_example,
    // string (optional)
    keywords: keywords_example,
    // string (optional)
    category: category_example,
    // string (optional)
    tags: tags_example,
    // string (optional)
    cover: cover_example,
    // string (optional)
    url: url_example,
    // string (optional)
    userId: userId_example,
    // string (optional)
    userName: userName_example,
    // number (optional)
    weight: 56,
  } satisfies AddIndexApiV1SearchIndexPostRequest;

  try {
    const data = await api.addIndexApiV1SearchIndexPost(body);
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
| **targetType** | `string` |  | [Defaults to `undefined`] |
| **targetId** | `number` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Optional] [Defaults to `undefined`] |
| **keywords** | `string` |  | [Optional] [Defaults to `undefined`] |
| **category** | `string` |  | [Optional] [Defaults to `undefined`] |
| **tags** | `string` |  | [Optional] [Defaults to `undefined`] |
| **cover** | `string` |  | [Optional] [Defaults to `undefined`] |
| **url** | `string` |  | [Optional] [Defaults to `undefined`] |
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **userName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **weight** | `number` |  | [Optional] [Defaults to `0`] |

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


## addIndexApiV1SearchIndexPost_0

> any addIndexApiV1SearchIndexPost_0(targetType, targetId, title, content, keywords, category, tags, cover, url, userId, userName, weight)

添加/更新索引

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '';
import type { AddIndexApiV1SearchIndexPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SearchApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
    // string
    title: title_example,
    // string (optional)
    content: content_example,
    // string (optional)
    keywords: keywords_example,
    // string (optional)
    category: category_example,
    // string (optional)
    tags: tags_example,
    // string (optional)
    cover: cover_example,
    // string (optional)
    url: url_example,
    // string (optional)
    userId: userId_example,
    // string (optional)
    userName: userName_example,
    // number (optional)
    weight: 56,
  } satisfies AddIndexApiV1SearchIndexPost0Request;

  try {
    const data = await api.addIndexApiV1SearchIndexPost_0(body);
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
| **targetType** | `string` |  | [Defaults to `undefined`] |
| **targetId** | `number` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Optional] [Defaults to `undefined`] |
| **keywords** | `string` |  | [Optional] [Defaults to `undefined`] |
| **category** | `string` |  | [Optional] [Defaults to `undefined`] |
| **tags** | `string` |  | [Optional] [Defaults to `undefined`] |
| **cover** | `string` |  | [Optional] [Defaults to `undefined`] |
| **url** | `string` |  | [Optional] [Defaults to `undefined`] |
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **userName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **weight** | `number` |  | [Optional] [Defaults to `0`] |

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


## deleteByTargetApiV1SearchIndexByTargetDelete

> any deleteByTargetApiV1SearchIndexByTargetDelete(targetType, targetId)

按目标删除索引

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '';
import type { DeleteByTargetApiV1SearchIndexByTargetDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SearchApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
  } satisfies DeleteByTargetApiV1SearchIndexByTargetDeleteRequest;

  try {
    const data = await api.deleteByTargetApiV1SearchIndexByTargetDelete(body);
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
| **targetType** | `string` |  | [Defaults to `undefined`] |
| **targetId** | `number` |  | [Defaults to `undefined`] |

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


## deleteByTargetApiV1SearchIndexByTargetDelete_0

> any deleteByTargetApiV1SearchIndexByTargetDelete_0(targetType, targetId)

按目标删除索引

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '';
import type { DeleteByTargetApiV1SearchIndexByTargetDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SearchApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
  } satisfies DeleteByTargetApiV1SearchIndexByTargetDelete0Request;

  try {
    const data = await api.deleteByTargetApiV1SearchIndexByTargetDelete_0(body);
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
| **targetType** | `string` |  | [Defaults to `undefined`] |
| **targetId** | `number` |  | [Defaults to `undefined`] |

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


## deleteHotKeywordApiV1SearchHotKeywordKidDelete

> any deleteHotKeywordApiV1SearchHotKeywordKidDelete(kid)

删除热搜词

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '';
import type { DeleteHotKeywordApiV1SearchHotKeywordKidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SearchApi();

  const body = {
    // number
    kid: 56,
  } satisfies DeleteHotKeywordApiV1SearchHotKeywordKidDeleteRequest;

  try {
    const data = await api.deleteHotKeywordApiV1SearchHotKeywordKidDelete(body);
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
| **kid** | `number` |  | [Defaults to `undefined`] |

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


## deleteHotKeywordApiV1SearchHotKeywordKidDelete_0

> any deleteHotKeywordApiV1SearchHotKeywordKidDelete_0(kid)

删除热搜词

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '';
import type { DeleteHotKeywordApiV1SearchHotKeywordKidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SearchApi();

  const body = {
    // number
    kid: 56,
  } satisfies DeleteHotKeywordApiV1SearchHotKeywordKidDelete0Request;

  try {
    const data = await api.deleteHotKeywordApiV1SearchHotKeywordKidDelete_0(body);
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
| **kid** | `number` |  | [Defaults to `undefined`] |

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


## deleteIndexApiV1SearchIndexIdxIdDelete

> any deleteIndexApiV1SearchIndexIdxIdDelete(idxId)

删除索引

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '';
import type { DeleteIndexApiV1SearchIndexIdxIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SearchApi();

  const body = {
    // number
    idxId: 56,
  } satisfies DeleteIndexApiV1SearchIndexIdxIdDeleteRequest;

  try {
    const data = await api.deleteIndexApiV1SearchIndexIdxIdDelete(body);
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
| **idxId** | `number` |  | [Defaults to `undefined`] |

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


## deleteIndexApiV1SearchIndexIdxIdDelete_0

> any deleteIndexApiV1SearchIndexIdxIdDelete_0(idxId)

删除索引

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '';
import type { DeleteIndexApiV1SearchIndexIdxIdDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SearchApi();

  const body = {
    // number
    idxId: 56,
  } satisfies DeleteIndexApiV1SearchIndexIdxIdDelete0Request;

  try {
    const data = await api.deleteIndexApiV1SearchIndexIdxIdDelete_0(body);
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
| **idxId** | `number` |  | [Defaults to `undefined`] |

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


## hotKeywordsApiV1SearchHotGet

> any hotKeywordsApiV1SearchHotGet(limit)

热搜词

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '';
import type { HotKeywordsApiV1SearchHotGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SearchApi();

  const body = {
    // number (optional)
    limit: 56,
  } satisfies HotKeywordsApiV1SearchHotGetRequest;

  try {
    const data = await api.hotKeywordsApiV1SearchHotGet(body);
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
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

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


## hotKeywordsApiV1SearchHotGet_0

> any hotKeywordsApiV1SearchHotGet_0(limit)

热搜词

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '';
import type { HotKeywordsApiV1SearchHotGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SearchApi();

  const body = {
    // number (optional)
    limit: 56,
  } satisfies HotKeywordsApiV1SearchHotGet0Request;

  try {
    const data = await api.hotKeywordsApiV1SearchHotGet_0(body);
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
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

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


## queryApiV1SearchQueryGet

> any queryApiV1SearchQueryGet(keyword, page, limit, targetType, category, orderBy)

全文搜索

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '';
import type { QueryApiV1SearchQueryGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SearchApi();

  const body = {
    // string
    keyword: keyword_example,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    targetType: targetType_example,
    // string (optional)
    category: category_example,
    // string (optional)
    orderBy: orderBy_example,
  } satisfies QueryApiV1SearchQueryGetRequest;

  try {
    const data = await api.queryApiV1SearchQueryGet(body);
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
| **keyword** | `string` |  | [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **targetType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **category** | `string` |  | [Optional] [Defaults to `undefined`] |
| **orderBy** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## queryApiV1SearchQueryGet_0

> any queryApiV1SearchQueryGet_0(keyword, page, limit, targetType, category, orderBy)

全文搜索

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '';
import type { QueryApiV1SearchQueryGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SearchApi();

  const body = {
    // string
    keyword: keyword_example,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    targetType: targetType_example,
    // string (optional)
    category: category_example,
    // string (optional)
    orderBy: orderBy_example,
  } satisfies QueryApiV1SearchQueryGet0Request;

  try {
    const data = await api.queryApiV1SearchQueryGet_0(body);
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
| **keyword** | `string` |  | [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **targetType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **category** | `string` |  | [Optional] [Defaults to `undefined`] |
| **orderBy** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## searchLogList

> any searchLogList(page, limit, userId, keyword)

搜索日志

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '';
import type { SearchLogListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SearchApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    userId: userId_example,
    // string (optional)
    keyword: keyword_example,
  } satisfies SearchLogListRequest;

  try {
    const data = await api.searchLogList(body);
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
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **keyword** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## searchLogList_0

> any searchLogList_0(page, limit, userId, keyword)

搜索日志

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '';
import type { SearchLogList0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SearchApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    userId: userId_example,
    // string (optional)
    keyword: keyword_example,
  } satisfies SearchLogList0Request;

  try {
    const data = await api.searchLogList_0(body);
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
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **keyword** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## suggestApiV1SearchSuggestGet

> any suggestApiV1SearchSuggestGet(keyword, limit)

搜索建议

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '';
import type { SuggestApiV1SearchSuggestGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SearchApi();

  const body = {
    // string
    keyword: keyword_example,
    // number (optional)
    limit: 56,
  } satisfies SuggestApiV1SearchSuggestGetRequest;

  try {
    const data = await api.suggestApiV1SearchSuggestGet(body);
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
| **keyword** | `string` |  | [Defaults to `undefined`] |
| **limit** | `number` |  | [Optional] [Defaults to `10`] |

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


## suggestApiV1SearchSuggestGet_0

> any suggestApiV1SearchSuggestGet_0(keyword, limit)

搜索建议

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '';
import type { SuggestApiV1SearchSuggestGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SearchApi();

  const body = {
    // string
    keyword: keyword_example,
    // number (optional)
    limit: 56,
  } satisfies SuggestApiV1SearchSuggestGet0Request;

  try {
    const data = await api.suggestApiV1SearchSuggestGet_0(body);
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
| **keyword** | `string` |  | [Defaults to `undefined`] |
| **limit** | `number` |  | [Optional] [Defaults to `10`] |

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

