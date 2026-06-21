# CategoryDictionaryApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createDictApiV1CategoryDictionaryPost**](CategoryDictionaryApi.md#createdictapiv1categorydictionarypost) | **POST** /api/v1/category-dictionary | 新增字典 |
| [**createDictApiV1CategoryDictionaryPost_0**](CategoryDictionaryApi.md#createdictapiv1categorydictionarypost_0) | **POST** /api/v1/category-dictionary | 新增字典 |
| [**deleteDictApiV1CategoryDictionaryDidDelete**](CategoryDictionaryApi.md#deletedictapiv1categorydictionarydiddelete) | **DELETE** /api/v1/category-dictionary/{did} | 删除字典 |
| [**deleteDictApiV1CategoryDictionaryDidDelete_0**](CategoryDictionaryApi.md#deletedictapiv1categorydictionarydiddelete_0) | **DELETE** /api/v1/category-dictionary/{did} | 删除字典 |
| [**dictTypesApiV1CategoryDictionaryTypeGet**](CategoryDictionaryApi.md#dicttypesapiv1categorydictionarytypeget) | **GET** /api/v1/category-dictionary/type | 字典类型列表 |
| [**dictTypesApiV1CategoryDictionaryTypeGet_0**](CategoryDictionaryApi.md#dicttypesapiv1categorydictionarytypeget_0) | **GET** /api/v1/category-dictionary/type | 字典类型列表 |
| [**getDictApiV1CategoryDictionaryDidGet**](CategoryDictionaryApi.md#getdictapiv1categorydictionarydidget) | **GET** /api/v1/category-dictionary/{did} | 字典详情 |
| [**getDictApiV1CategoryDictionaryDidGet_0**](CategoryDictionaryApi.md#getdictapiv1categorydictionarydidget_0) | **GET** /api/v1/category-dictionary/{did} | 字典详情 |
| [**listDictApiV1CategoryDictionaryListGet**](CategoryDictionaryApi.md#listdictapiv1categorydictionarylistget) | **GET** /api/v1/category-dictionary/list | 字典列表 |
| [**listDictApiV1CategoryDictionaryListGet_0**](CategoryDictionaryApi.md#listdictapiv1categorydictionarylistget_0) | **GET** /api/v1/category-dictionary/list | 字典列表 |
| [**updateDictApiV1CategoryDictionaryDidPut**](CategoryDictionaryApi.md#updatedictapiv1categorydictionarydidput) | **PUT** /api/v1/category-dictionary/{did} | 修改字典 |
| [**updateDictApiV1CategoryDictionaryDidPut_0**](CategoryDictionaryApi.md#updatedictapiv1categorydictionarydidput_0) | **PUT** /api/v1/category-dictionary/{did} | 修改字典 |



## createDictApiV1CategoryDictionaryPost

> any createDictApiV1CategoryDictionaryPost(dictType, code, label, value, sortOrder, isShow, description, parentId, extra)

新增字典

### Example

```ts
import {
  Configuration,
  CategoryDictionaryApi,
} from '';
import type { CreateDictApiV1CategoryDictionaryPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CategoryDictionaryApi();

  const body = {
    // string
    dictType: dictType_example,
    // string
    code: code_example,
    // string
    label: label_example,
    // string (optional)
    value: value_example,
    // number (optional)
    sortOrder: 56,
    // boolean (optional)
    isShow: true,
    // string (optional)
    description: description_example,
    // number (optional)
    parentId: 56,
    // string (optional)
    extra: extra_example,
  } satisfies CreateDictApiV1CategoryDictionaryPostRequest;

  try {
    const data = await api.createDictApiV1CategoryDictionaryPost(body);
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
| **dictType** | `string` |  | [Defaults to `undefined`] |
| **code** | `string` |  | [Defaults to `undefined`] |
| **label** | `string` |  | [Defaults to `undefined`] |
| **value** | `string` |  | [Optional] [Defaults to `undefined`] |
| **sortOrder** | `number` |  | [Optional] [Defaults to `0`] |
| **isShow** | `boolean` |  | [Optional] [Defaults to `true`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **parentId** | `number` |  | [Optional] [Defaults to `0`] |
| **extra** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## createDictApiV1CategoryDictionaryPost_0

> any createDictApiV1CategoryDictionaryPost_0(dictType, code, label, value, sortOrder, isShow, description, parentId, extra)

新增字典

### Example

```ts
import {
  Configuration,
  CategoryDictionaryApi,
} from '';
import type { CreateDictApiV1CategoryDictionaryPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CategoryDictionaryApi();

  const body = {
    // string
    dictType: dictType_example,
    // string
    code: code_example,
    // string
    label: label_example,
    // string (optional)
    value: value_example,
    // number (optional)
    sortOrder: 56,
    // boolean (optional)
    isShow: true,
    // string (optional)
    description: description_example,
    // number (optional)
    parentId: 56,
    // string (optional)
    extra: extra_example,
  } satisfies CreateDictApiV1CategoryDictionaryPost0Request;

  try {
    const data = await api.createDictApiV1CategoryDictionaryPost_0(body);
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
| **dictType** | `string` |  | [Defaults to `undefined`] |
| **code** | `string` |  | [Defaults to `undefined`] |
| **label** | `string` |  | [Defaults to `undefined`] |
| **value** | `string` |  | [Optional] [Defaults to `undefined`] |
| **sortOrder** | `number` |  | [Optional] [Defaults to `0`] |
| **isShow** | `boolean` |  | [Optional] [Defaults to `true`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **parentId** | `number` |  | [Optional] [Defaults to `0`] |
| **extra** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## deleteDictApiV1CategoryDictionaryDidDelete

> any deleteDictApiV1CategoryDictionaryDidDelete(did)

删除字典

### Example

```ts
import {
  Configuration,
  CategoryDictionaryApi,
} from '';
import type { DeleteDictApiV1CategoryDictionaryDidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CategoryDictionaryApi();

  const body = {
    // number
    did: 56,
  } satisfies DeleteDictApiV1CategoryDictionaryDidDeleteRequest;

  try {
    const data = await api.deleteDictApiV1CategoryDictionaryDidDelete(body);
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
| **did** | `number` |  | [Defaults to `undefined`] |

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


## deleteDictApiV1CategoryDictionaryDidDelete_0

> any deleteDictApiV1CategoryDictionaryDidDelete_0(did)

删除字典

### Example

```ts
import {
  Configuration,
  CategoryDictionaryApi,
} from '';
import type { DeleteDictApiV1CategoryDictionaryDidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CategoryDictionaryApi();

  const body = {
    // number
    did: 56,
  } satisfies DeleteDictApiV1CategoryDictionaryDidDelete0Request;

  try {
    const data = await api.deleteDictApiV1CategoryDictionaryDidDelete_0(body);
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
| **did** | `number` |  | [Defaults to `undefined`] |

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


## dictTypesApiV1CategoryDictionaryTypeGet

> any dictTypesApiV1CategoryDictionaryTypeGet()

字典类型列表

### Example

```ts
import {
  Configuration,
  CategoryDictionaryApi,
} from '';
import type { DictTypesApiV1CategoryDictionaryTypeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CategoryDictionaryApi();

  try {
    const data = await api.dictTypesApiV1CategoryDictionaryTypeGet();
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


## dictTypesApiV1CategoryDictionaryTypeGet_0

> any dictTypesApiV1CategoryDictionaryTypeGet_0()

字典类型列表

### Example

```ts
import {
  Configuration,
  CategoryDictionaryApi,
} from '';
import type { DictTypesApiV1CategoryDictionaryTypeGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CategoryDictionaryApi();

  try {
    const data = await api.dictTypesApiV1CategoryDictionaryTypeGet_0();
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


## getDictApiV1CategoryDictionaryDidGet

> any getDictApiV1CategoryDictionaryDidGet(did)

字典详情

### Example

```ts
import {
  Configuration,
  CategoryDictionaryApi,
} from '';
import type { GetDictApiV1CategoryDictionaryDidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CategoryDictionaryApi();

  const body = {
    // number
    did: 56,
  } satisfies GetDictApiV1CategoryDictionaryDidGetRequest;

  try {
    const data = await api.getDictApiV1CategoryDictionaryDidGet(body);
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
| **did** | `number` |  | [Defaults to `undefined`] |

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


## getDictApiV1CategoryDictionaryDidGet_0

> any getDictApiV1CategoryDictionaryDidGet_0(did)

字典详情

### Example

```ts
import {
  Configuration,
  CategoryDictionaryApi,
} from '';
import type { GetDictApiV1CategoryDictionaryDidGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CategoryDictionaryApi();

  const body = {
    // number
    did: 56,
  } satisfies GetDictApiV1CategoryDictionaryDidGet0Request;

  try {
    const data = await api.getDictApiV1CategoryDictionaryDidGet_0(body);
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
| **did** | `number` |  | [Defaults to `undefined`] |

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


## listDictApiV1CategoryDictionaryListGet

> any listDictApiV1CategoryDictionaryListGet(dictType, page, limit)

字典列表

### Example

```ts
import {
  Configuration,
  CategoryDictionaryApi,
} from '';
import type { ListDictApiV1CategoryDictionaryListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CategoryDictionaryApi();

  const body = {
    // string (optional)
    dictType: dictType_example,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListDictApiV1CategoryDictionaryListGetRequest;

  try {
    const data = await api.listDictApiV1CategoryDictionaryListGet(body);
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
| **dictType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `100`] |

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


## listDictApiV1CategoryDictionaryListGet_0

> any listDictApiV1CategoryDictionaryListGet_0(dictType, page, limit)

字典列表

### Example

```ts
import {
  Configuration,
  CategoryDictionaryApi,
} from '';
import type { ListDictApiV1CategoryDictionaryListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CategoryDictionaryApi();

  const body = {
    // string (optional)
    dictType: dictType_example,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListDictApiV1CategoryDictionaryListGet0Request;

  try {
    const data = await api.listDictApiV1CategoryDictionaryListGet_0(body);
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
| **dictType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `100`] |

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


## updateDictApiV1CategoryDictionaryDidPut

> any updateDictApiV1CategoryDictionaryDidPut(did, label, value, sortOrder, isShow, description)

修改字典

### Example

```ts
import {
  Configuration,
  CategoryDictionaryApi,
} from '';
import type { UpdateDictApiV1CategoryDictionaryDidPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CategoryDictionaryApi();

  const body = {
    // number
    did: 56,
    // string (optional)
    label: label_example,
    // string (optional)
    value: value_example,
    // number (optional)
    sortOrder: 56,
    // boolean (optional)
    isShow: true,
    // string (optional)
    description: description_example,
  } satisfies UpdateDictApiV1CategoryDictionaryDidPutRequest;

  try {
    const data = await api.updateDictApiV1CategoryDictionaryDidPut(body);
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
| **did** | `number` |  | [Defaults to `undefined`] |
| **label** | `string` |  | [Optional] [Defaults to `undefined`] |
| **value** | `string` |  | [Optional] [Defaults to `undefined`] |
| **sortOrder** | `number` |  | [Optional] [Defaults to `undefined`] |
| **isShow** | `boolean` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## updateDictApiV1CategoryDictionaryDidPut_0

> any updateDictApiV1CategoryDictionaryDidPut_0(did, label, value, sortOrder, isShow, description)

修改字典

### Example

```ts
import {
  Configuration,
  CategoryDictionaryApi,
} from '';
import type { UpdateDictApiV1CategoryDictionaryDidPut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CategoryDictionaryApi();

  const body = {
    // number
    did: 56,
    // string (optional)
    label: label_example,
    // string (optional)
    value: value_example,
    // number (optional)
    sortOrder: 56,
    // boolean (optional)
    isShow: true,
    // string (optional)
    description: description_example,
  } satisfies UpdateDictApiV1CategoryDictionaryDidPut0Request;

  try {
    const data = await api.updateDictApiV1CategoryDictionaryDidPut_0(body);
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
| **did** | `number` |  | [Defaults to `undefined`] |
| **label** | `string` |  | [Optional] [Defaults to `undefined`] |
| **value** | `string` |  | [Optional] [Defaults to `undefined`] |
| **sortOrder** | `number` |  | [Optional] [Defaults to `undefined`] |
| **isShow** | `boolean` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |

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

