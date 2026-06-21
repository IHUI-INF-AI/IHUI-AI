# CircleCircleApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**circleCategoryList**](CircleCircleApi.md#circlecategorylist) | **GET** /api/v1/circle/category/list | 圈子分类列表 |
| [**createCircleApiV1CirclePost**](CircleCircleApi.md#createcircleapiv1circlepost) | **POST** /api/v1/circle | 创建圈子 |
| [**deleteCircleApiV1CircleCidDelete**](CircleCircleApi.md#deletecircleapiv1circleciddelete) | **DELETE** /api/v1/circle/{cid} | 删除圈子 |
| [**getCircleApiV1CircleCidGet**](CircleCircleApi.md#getcircleapiv1circlecidget) | **GET** /api/v1/circle/{cid} | 圈子详情 |
| [**joinCircleApiV1CircleCidJoinPost**](CircleCircleApi.md#joincircleapiv1circlecidjoinpost) | **POST** /api/v1/circle/{cid}/join | 加入圈子 |
| [**listCirclesApiV1CircleListGet**](CircleCircleApi.md#listcirclesapiv1circlelistget) | **GET** /api/v1/circle/list | 圈子列表 |
| [**listMembersApiV1CircleCidMembersGet**](CircleCircleApi.md#listmembersapiv1circlecidmembersget) | **GET** /api/v1/circle/{cid}/members | 成员列表 |
| [**quitCircleApiV1CircleCidQuitPost**](CircleCircleApi.md#quitcircleapiv1circlecidquitpost) | **POST** /api/v1/circle/{cid}/quit | 退出圈子 |
| [**updateCircleApiV1CircleCidPut**](CircleCircleApi.md#updatecircleapiv1circlecidput) | **PUT** /api/v1/circle/{cid} | 修改圈子 |



## circleCategoryList

> any circleCategoryList()

圈子分类列表

### Example

```ts
import {
  Configuration,
  CircleCircleApi,
} from '';
import type { CircleCategoryListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleCircleApi();

  try {
    const data = await api.circleCategoryList();
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


## createCircleApiV1CirclePost

> any createCircleApiV1CirclePost(name, description, categoryId, avatar, cover)

创建圈子

### Example

```ts
import {
  Configuration,
  CircleCircleApi,
} from '';
import type { CreateCircleApiV1CirclePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleCircleApi();

  const body = {
    // string
    name: name_example,
    // string (optional)
    description: description_example,
    // number (optional)
    categoryId: 56,
    // string (optional)
    avatar: avatar_example,
    // string (optional)
    cover: cover_example,
  } satisfies CreateCircleApiV1CirclePostRequest;

  try {
    const data = await api.createCircleApiV1CirclePost(body);
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
| **name** | `string` |  | [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **categoryId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **avatar** | `string` |  | [Optional] [Defaults to `undefined`] |
| **cover** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## deleteCircleApiV1CircleCidDelete

> any deleteCircleApiV1CircleCidDelete(cid)

删除圈子

### Example

```ts
import {
  Configuration,
  CircleCircleApi,
} from '';
import type { DeleteCircleApiV1CircleCidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleCircleApi();

  const body = {
    // number
    cid: 56,
  } satisfies DeleteCircleApiV1CircleCidDeleteRequest;

  try {
    const data = await api.deleteCircleApiV1CircleCidDelete(body);
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
| **cid** | `number` |  | [Defaults to `undefined`] |

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


## getCircleApiV1CircleCidGet

> any getCircleApiV1CircleCidGet(cid)

圈子详情

### Example

```ts
import {
  Configuration,
  CircleCircleApi,
} from '';
import type { GetCircleApiV1CircleCidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleCircleApi();

  const body = {
    // number
    cid: 56,
  } satisfies GetCircleApiV1CircleCidGetRequest;

  try {
    const data = await api.getCircleApiV1CircleCidGet(body);
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
| **cid** | `number` |  | [Defaults to `undefined`] |

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


## joinCircleApiV1CircleCidJoinPost

> any joinCircleApiV1CircleCidJoinPost(cid)

加入圈子

### Example

```ts
import {
  Configuration,
  CircleCircleApi,
} from '';
import type { JoinCircleApiV1CircleCidJoinPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleCircleApi();

  const body = {
    // number
    cid: 56,
  } satisfies JoinCircleApiV1CircleCidJoinPostRequest;

  try {
    const data = await api.joinCircleApiV1CircleCidJoinPost(body);
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
| **cid** | `number` |  | [Defaults to `undefined`] |

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


## listCirclesApiV1CircleListGet

> any listCirclesApiV1CircleListGet(page, limit, categoryId, keyword, isOfficial)

圈子列表

### Example

```ts
import {
  Configuration,
  CircleCircleApi,
} from '';
import type { ListCirclesApiV1CircleListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleCircleApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    categoryId: 56,
    // string (optional)
    keyword: keyword_example,
    // boolean (optional)
    isOfficial: true,
  } satisfies ListCirclesApiV1CircleListGetRequest;

  try {
    const data = await api.listCirclesApiV1CircleListGet(body);
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
| **categoryId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **keyword** | `string` |  | [Optional] [Defaults to `undefined`] |
| **isOfficial** | `boolean` |  | [Optional] [Defaults to `undefined`] |

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


## listMembersApiV1CircleCidMembersGet

> any listMembersApiV1CircleCidMembersGet(cid, page, limit)

成员列表

### Example

```ts
import {
  Configuration,
  CircleCircleApi,
} from '';
import type { ListMembersApiV1CircleCidMembersGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleCircleApi();

  const body = {
    // number
    cid: 56,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListMembersApiV1CircleCidMembersGetRequest;

  try {
    const data = await api.listMembersApiV1CircleCidMembersGet(body);
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
| **cid** | `number` |  | [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
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


## quitCircleApiV1CircleCidQuitPost

> any quitCircleApiV1CircleCidQuitPost(cid)

退出圈子

### Example

```ts
import {
  Configuration,
  CircleCircleApi,
} from '';
import type { QuitCircleApiV1CircleCidQuitPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleCircleApi();

  const body = {
    // number
    cid: 56,
  } satisfies QuitCircleApiV1CircleCidQuitPostRequest;

  try {
    const data = await api.quitCircleApiV1CircleCidQuitPost(body);
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
| **cid** | `number` |  | [Defaults to `undefined`] |

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


## updateCircleApiV1CircleCidPut

> any updateCircleApiV1CircleCidPut(cid, name, description, avatar, cover)

修改圈子

### Example

```ts
import {
  Configuration,
  CircleCircleApi,
} from '';
import type { UpdateCircleApiV1CircleCidPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CircleCircleApi();

  const body = {
    // number
    cid: 56,
    // string (optional)
    name: name_example,
    // string (optional)
    description: description_example,
    // string (optional)
    avatar: avatar_example,
    // string (optional)
    cover: cover_example,
  } satisfies UpdateCircleApiV1CircleCidPutRequest;

  try {
    const data = await api.updateCircleApiV1CircleCidPut(body);
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
| **cid** | `number` |  | [Defaults to `undefined`] |
| **name** | `string` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **avatar** | `string` |  | [Optional] [Defaults to `undefined`] |
| **cover** | `string` |  | [Optional] [Defaults to `undefined`] |

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

