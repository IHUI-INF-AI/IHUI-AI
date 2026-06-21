# AskCategoryApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addCategoryApiV1AskCategoryPost**](AskCategoryApi.md#addcategoryapiv1askcategorypost) | **POST** /api/v1/ask/category | 添加分类 |
| [**askCategoryAdminList**](AskCategoryApi.md#askcategoryadminlist) | **GET** /api/v1/ask/category/admin/list | 分类列表(管理员) |
| [**changeShowApiV1AskCategoryIsShowPut**](AskCategoryApi.md#changeshowapiv1askcategoryisshowput) | **PUT** /api/v1/ask/category/is-show | 修改显示状态 |
| [**changeShowIndexApiV1AskCategoryIsShowIndexPut**](AskCategoryApi.md#changeshowindexapiv1askcategoryisshowindexput) | **PUT** /api/v1/ask/category/is-show-index | 修改首页显示状态 |
| [**deleteCategoryApiV1AskCategoryCatIdDelete**](AskCategoryApi.md#deletecategoryapiv1askcategorycatiddelete) | **DELETE** /api/v1/ask/category/{cat_id} | 删除分类 |
| [**getCategoryApiV1AskCategoryCatIdGet**](AskCategoryApi.md#getcategoryapiv1askcategorycatidget) | **GET** /api/v1/ask/category/{cat_id} | 分类详情 |
| [**publicListApiV1AskCategoryPublicApiListGet**](AskCategoryApi.md#publiclistapiv1askcategorypublicapilistget) | **GET** /api/v1/ask/category/public-api/list | 分类列表(公开) |
| [**updateCategoryApiV1AskCategoryPut**](AskCategoryApi.md#updatecategoryapiv1askcategoryput) | **PUT** /api/v1/ask/category | 修改分类 |



## addCategoryApiV1AskCategoryPost

> any addCategoryApiV1AskCategoryPost(categoryCreate)

添加分类

### Example

```ts
import {
  Configuration,
  AskCategoryApi,
} from '';
import type { AddCategoryApiV1AskCategoryPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskCategoryApi();

  const body = {
    // CategoryCreate
    categoryCreate: ...,
  } satisfies AddCategoryApiV1AskCategoryPostRequest;

  try {
    const data = await api.addCategoryApiV1AskCategoryPost(body);
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
| **categoryCreate** | [CategoryCreate](CategoryCreate.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## askCategoryAdminList

> any askCategoryAdminList(isShow, isShowIndex)

分类列表(管理员)

### Example

```ts
import {
  Configuration,
  AskCategoryApi,
} from '';
import type { AskCategoryAdminListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskCategoryApi();

  const body = {
    // boolean (optional)
    isShow: true,
    // boolean (optional)
    isShowIndex: true,
  } satisfies AskCategoryAdminListRequest;

  try {
    const data = await api.askCategoryAdminList(body);
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
| **isShow** | `boolean` |  | [Optional] [Defaults to `undefined`] |
| **isShowIndex** | `boolean` |  | [Optional] [Defaults to `undefined`] |

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


## changeShowApiV1AskCategoryIsShowPut

> any changeShowApiV1AskCategoryIsShowPut(id, isShow)

修改显示状态

### Example

```ts
import {
  Configuration,
  AskCategoryApi,
} from '';
import type { ChangeShowApiV1AskCategoryIsShowPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskCategoryApi();

  const body = {
    // number
    id: 56,
    // boolean
    isShow: true,
  } satisfies ChangeShowApiV1AskCategoryIsShowPutRequest;

  try {
    const data = await api.changeShowApiV1AskCategoryIsShowPut(body);
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
| **id** | `number` |  | [Defaults to `undefined`] |
| **isShow** | `boolean` |  | [Defaults to `undefined`] |

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


## changeShowIndexApiV1AskCategoryIsShowIndexPut

> any changeShowIndexApiV1AskCategoryIsShowIndexPut(id, isShowIndex)

修改首页显示状态

### Example

```ts
import {
  Configuration,
  AskCategoryApi,
} from '';
import type { ChangeShowIndexApiV1AskCategoryIsShowIndexPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskCategoryApi();

  const body = {
    // number
    id: 56,
    // boolean
    isShowIndex: true,
  } satisfies ChangeShowIndexApiV1AskCategoryIsShowIndexPutRequest;

  try {
    const data = await api.changeShowIndexApiV1AskCategoryIsShowIndexPut(body);
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
| **id** | `number` |  | [Defaults to `undefined`] |
| **isShowIndex** | `boolean` |  | [Defaults to `undefined`] |

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


## deleteCategoryApiV1AskCategoryCatIdDelete

> any deleteCategoryApiV1AskCategoryCatIdDelete(catId)

删除分类

### Example

```ts
import {
  Configuration,
  AskCategoryApi,
} from '';
import type { DeleteCategoryApiV1AskCategoryCatIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskCategoryApi();

  const body = {
    // number
    catId: 56,
  } satisfies DeleteCategoryApiV1AskCategoryCatIdDeleteRequest;

  try {
    const data = await api.deleteCategoryApiV1AskCategoryCatIdDelete(body);
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
| **catId** | `number` |  | [Defaults to `undefined`] |

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


## getCategoryApiV1AskCategoryCatIdGet

> any getCategoryApiV1AskCategoryCatIdGet(catId)

分类详情

### Example

```ts
import {
  Configuration,
  AskCategoryApi,
} from '';
import type { GetCategoryApiV1AskCategoryCatIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskCategoryApi();

  const body = {
    // number
    catId: 56,
  } satisfies GetCategoryApiV1AskCategoryCatIdGetRequest;

  try {
    const data = await api.getCategoryApiV1AskCategoryCatIdGet(body);
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
| **catId** | `number` |  | [Defaults to `undefined`] |

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


## publicListApiV1AskCategoryPublicApiListGet

> any publicListApiV1AskCategoryPublicApiListGet(isShow, isShowIndex)

分类列表(公开)

### Example

```ts
import {
  Configuration,
  AskCategoryApi,
} from '';
import type { PublicListApiV1AskCategoryPublicApiListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskCategoryApi();

  const body = {
    // boolean (optional)
    isShow: true,
    // boolean (optional)
    isShowIndex: true,
  } satisfies PublicListApiV1AskCategoryPublicApiListGetRequest;

  try {
    const data = await api.publicListApiV1AskCategoryPublicApiListGet(body);
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
| **isShow** | `boolean` |  | [Optional] [Defaults to `undefined`] |
| **isShowIndex** | `boolean` |  | [Optional] [Defaults to `undefined`] |

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


## updateCategoryApiV1AskCategoryPut

> any updateCategoryApiV1AskCategoryPut(categoryUpdate)

修改分类

### Example

```ts
import {
  Configuration,
  AskCategoryApi,
} from '';
import type { UpdateCategoryApiV1AskCategoryPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskCategoryApi();

  const body = {
    // CategoryUpdate
    categoryUpdate: ...,
  } satisfies UpdateCategoryApiV1AskCategoryPutRequest;

  try {
    const data = await api.updateCategoryApiV1AskCategoryPut(body);
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
| **categoryUpdate** | [CategoryUpdate](CategoryUpdate.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

