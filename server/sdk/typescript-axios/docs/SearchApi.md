# SearchApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**addHotKeywordApiV1SearchHotKeywordPost**](#addhotkeywordapiv1searchhotkeywordpost) | **POST** /api/v1/search/hot/keyword | 添加热搜词|
|[**addHotKeywordApiV1SearchHotKeywordPost_0**](#addhotkeywordapiv1searchhotkeywordpost_0) | **POST** /api/v1/search/hot/keyword | 添加热搜词|
|[**addIndexApiV1SearchIndexPost**](#addindexapiv1searchindexpost) | **POST** /api/v1/search/index | 添加/更新索引|
|[**addIndexApiV1SearchIndexPost_0**](#addindexapiv1searchindexpost_0) | **POST** /api/v1/search/index | 添加/更新索引|
|[**deleteByTargetApiV1SearchIndexByTargetDelete**](#deletebytargetapiv1searchindexbytargetdelete) | **DELETE** /api/v1/search/index/by-target | 按目标删除索引|
|[**deleteByTargetApiV1SearchIndexByTargetDelete_0**](#deletebytargetapiv1searchindexbytargetdelete_0) | **DELETE** /api/v1/search/index/by-target | 按目标删除索引|
|[**deleteHotKeywordApiV1SearchHotKeywordKidDelete**](#deletehotkeywordapiv1searchhotkeywordkiddelete) | **DELETE** /api/v1/search/hot/keyword/{kid} | 删除热搜词|
|[**deleteHotKeywordApiV1SearchHotKeywordKidDelete_0**](#deletehotkeywordapiv1searchhotkeywordkiddelete_0) | **DELETE** /api/v1/search/hot/keyword/{kid} | 删除热搜词|
|[**deleteIndexApiV1SearchIndexIdxIdDelete**](#deleteindexapiv1searchindexidxiddelete) | **DELETE** /api/v1/search/index/{idx_id} | 删除索引|
|[**deleteIndexApiV1SearchIndexIdxIdDelete_0**](#deleteindexapiv1searchindexidxiddelete_0) | **DELETE** /api/v1/search/index/{idx_id} | 删除索引|
|[**hotKeywordsApiV1SearchHotGet**](#hotkeywordsapiv1searchhotget) | **GET** /api/v1/search/hot | 热搜词|
|[**hotKeywordsApiV1SearchHotGet_0**](#hotkeywordsapiv1searchhotget_0) | **GET** /api/v1/search/hot | 热搜词|
|[**queryApiV1SearchQueryGet**](#queryapiv1searchqueryget) | **GET** /api/v1/search/query | 全文搜索|
|[**queryApiV1SearchQueryGet_0**](#queryapiv1searchqueryget_0) | **GET** /api/v1/search/query | 全文搜索|
|[**searchLogList**](#searchloglist) | **GET** /api/v1/search/log/list | 搜索日志|
|[**searchLogList_0**](#searchloglist_0) | **GET** /api/v1/search/log/list | 搜索日志|
|[**suggestApiV1SearchSuggestGet**](#suggestapiv1searchsuggestget) | **GET** /api/v1/search/suggest | 搜索建议|
|[**suggestApiV1SearchSuggestGet_0**](#suggestapiv1searchsuggestget_0) | **GET** /api/v1/search/suggest | 搜索建议|

# **addHotKeywordApiV1SearchHotKeywordPost**
> any addHotKeywordApiV1SearchHotKeywordPost()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let keyword: string; // (default to undefined)
let isHot: boolean; // (optional) (default to false)
let sortOrder: number; // (optional) (default to 0)

const { status, data } = await apiInstance.addHotKeywordApiV1SearchHotKeywordPost(
    keyword,
    isHot,
    sortOrder
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **keyword** | [**string**] |  | defaults to undefined|
| **isHot** | [**boolean**] |  | (optional) defaults to false|
| **sortOrder** | [**number**] |  | (optional) defaults to 0|


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

# **addHotKeywordApiV1SearchHotKeywordPost_0**
> any addHotKeywordApiV1SearchHotKeywordPost_0()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let keyword: string; // (default to undefined)
let isHot: boolean; // (optional) (default to false)
let sortOrder: number; // (optional) (default to 0)

const { status, data } = await apiInstance.addHotKeywordApiV1SearchHotKeywordPost_0(
    keyword,
    isHot,
    sortOrder
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **keyword** | [**string**] |  | defaults to undefined|
| **isHot** | [**boolean**] |  | (optional) defaults to false|
| **sortOrder** | [**number**] |  | (optional) defaults to 0|


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

# **addIndexApiV1SearchIndexPost**
> any addIndexApiV1SearchIndexPost()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)
let title: string; // (default to undefined)
let content: string; // (optional) (default to undefined)
let keywords: string; // (optional) (default to undefined)
let category: string; // (optional) (default to undefined)
let tags: string; // (optional) (default to undefined)
let cover: string; // (optional) (default to undefined)
let url: string; // (optional) (default to undefined)
let userId: string; // (optional) (default to undefined)
let userName: string; // (optional) (default to undefined)
let weight: number; // (optional) (default to 0)

const { status, data } = await apiInstance.addIndexApiV1SearchIndexPost(
    targetType,
    targetId,
    title,
    content,
    keywords,
    category,
    tags,
    cover,
    url,
    userId,
    userName,
    weight
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | defaults to undefined|
| **targetId** | [**number**] |  | defaults to undefined|
| **title** | [**string**] |  | defaults to undefined|
| **content** | [**string**] |  | (optional) defaults to undefined|
| **keywords** | [**string**] |  | (optional) defaults to undefined|
| **category** | [**string**] |  | (optional) defaults to undefined|
| **tags** | [**string**] |  | (optional) defaults to undefined|
| **cover** | [**string**] |  | (optional) defaults to undefined|
| **url** | [**string**] |  | (optional) defaults to undefined|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **userName** | [**string**] |  | (optional) defaults to undefined|
| **weight** | [**number**] |  | (optional) defaults to 0|


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

# **addIndexApiV1SearchIndexPost_0**
> any addIndexApiV1SearchIndexPost_0()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)
let title: string; // (default to undefined)
let content: string; // (optional) (default to undefined)
let keywords: string; // (optional) (default to undefined)
let category: string; // (optional) (default to undefined)
let tags: string; // (optional) (default to undefined)
let cover: string; // (optional) (default to undefined)
let url: string; // (optional) (default to undefined)
let userId: string; // (optional) (default to undefined)
let userName: string; // (optional) (default to undefined)
let weight: number; // (optional) (default to 0)

const { status, data } = await apiInstance.addIndexApiV1SearchIndexPost_0(
    targetType,
    targetId,
    title,
    content,
    keywords,
    category,
    tags,
    cover,
    url,
    userId,
    userName,
    weight
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | defaults to undefined|
| **targetId** | [**number**] |  | defaults to undefined|
| **title** | [**string**] |  | defaults to undefined|
| **content** | [**string**] |  | (optional) defaults to undefined|
| **keywords** | [**string**] |  | (optional) defaults to undefined|
| **category** | [**string**] |  | (optional) defaults to undefined|
| **tags** | [**string**] |  | (optional) defaults to undefined|
| **cover** | [**string**] |  | (optional) defaults to undefined|
| **url** | [**string**] |  | (optional) defaults to undefined|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **userName** | [**string**] |  | (optional) defaults to undefined|
| **weight** | [**number**] |  | (optional) defaults to 0|


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

# **deleteByTargetApiV1SearchIndexByTargetDelete**
> any deleteByTargetApiV1SearchIndexByTargetDelete()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteByTargetApiV1SearchIndexByTargetDelete(
    targetType,
    targetId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | defaults to undefined|
| **targetId** | [**number**] |  | defaults to undefined|


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

# **deleteByTargetApiV1SearchIndexByTargetDelete_0**
> any deleteByTargetApiV1SearchIndexByTargetDelete_0()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteByTargetApiV1SearchIndexByTargetDelete_0(
    targetType,
    targetId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **targetType** | [**string**] |  | defaults to undefined|
| **targetId** | [**number**] |  | defaults to undefined|


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

# **deleteHotKeywordApiV1SearchHotKeywordKidDelete**
> any deleteHotKeywordApiV1SearchHotKeywordKidDelete()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let kid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteHotKeywordApiV1SearchHotKeywordKidDelete(
    kid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **kid** | [**number**] |  | defaults to undefined|


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

# **deleteHotKeywordApiV1SearchHotKeywordKidDelete_0**
> any deleteHotKeywordApiV1SearchHotKeywordKidDelete_0()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let kid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteHotKeywordApiV1SearchHotKeywordKidDelete_0(
    kid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **kid** | [**number**] |  | defaults to undefined|


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

# **deleteIndexApiV1SearchIndexIdxIdDelete**
> any deleteIndexApiV1SearchIndexIdxIdDelete()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let idxId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteIndexApiV1SearchIndexIdxIdDelete(
    idxId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **idxId** | [**number**] |  | defaults to undefined|


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

# **deleteIndexApiV1SearchIndexIdxIdDelete_0**
> any deleteIndexApiV1SearchIndexIdxIdDelete_0()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let idxId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteIndexApiV1SearchIndexIdxIdDelete_0(
    idxId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **idxId** | [**number**] |  | defaults to undefined|


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

# **hotKeywordsApiV1SearchHotGet**
> any hotKeywordsApiV1SearchHotGet()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.hotKeywordsApiV1SearchHotGet(
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

# **hotKeywordsApiV1SearchHotGet_0**
> any hotKeywordsApiV1SearchHotGet_0()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.hotKeywordsApiV1SearchHotGet_0(
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

# **queryApiV1SearchQueryGet**
> any queryApiV1SearchQueryGet()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let keyword: string; // (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let targetType: string; // (optional) (default to undefined)
let category: string; // (optional) (default to undefined)
let orderBy: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.queryApiV1SearchQueryGet(
    keyword,
    page,
    limit,
    targetType,
    category,
    orderBy
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **keyword** | [**string**] |  | defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **targetType** | [**string**] |  | (optional) defaults to undefined|
| **category** | [**string**] |  | (optional) defaults to undefined|
| **orderBy** | [**string**] |  | (optional) defaults to undefined|


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

# **queryApiV1SearchQueryGet_0**
> any queryApiV1SearchQueryGet_0()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let keyword: string; // (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let targetType: string; // (optional) (default to undefined)
let category: string; // (optional) (default to undefined)
let orderBy: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.queryApiV1SearchQueryGet_0(
    keyword,
    page,
    limit,
    targetType,
    category,
    orderBy
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **keyword** | [**string**] |  | defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **targetType** | [**string**] |  | (optional) defaults to undefined|
| **category** | [**string**] |  | (optional) defaults to undefined|
| **orderBy** | [**string**] |  | (optional) defaults to undefined|


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

# **searchLogList**
> any searchLogList()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let userId: string; // (optional) (default to undefined)
let keyword: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.searchLogList(
    page,
    limit,
    userId,
    keyword
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **keyword** | [**string**] |  | (optional) defaults to undefined|


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

# **searchLogList_0**
> any searchLogList_0()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let userId: string; // (optional) (default to undefined)
let keyword: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.searchLogList_0(
    page,
    limit,
    userId,
    keyword
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **keyword** | [**string**] |  | (optional) defaults to undefined|


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

# **suggestApiV1SearchSuggestGet**
> any suggestApiV1SearchSuggestGet()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let keyword: string; // (default to undefined)
let limit: number; // (optional) (default to 10)

const { status, data } = await apiInstance.suggestApiV1SearchSuggestGet(
    keyword,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **keyword** | [**string**] |  | defaults to undefined|
| **limit** | [**number**] |  | (optional) defaults to 10|


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

# **suggestApiV1SearchSuggestGet_0**
> any suggestApiV1SearchSuggestGet_0()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let keyword: string; // (default to undefined)
let limit: number; // (optional) (default to 10)

const { status, data } = await apiInstance.suggestApiV1SearchSuggestGet_0(
    keyword,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **keyword** | [**string**] |  | defaults to undefined|
| **limit** | [**number**] |  | (optional) defaults to 10|


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

