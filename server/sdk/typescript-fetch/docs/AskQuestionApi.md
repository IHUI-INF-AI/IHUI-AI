# AskQuestionApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**askQuestionAddComment**](AskQuestionApi.md#askquestionaddcomment) | **POST** /api/v1/ask/question/comment | 发表评论 |
| [**askQuestionToggleFavorite**](AskQuestionApi.md#askquestiontogglefavorite) | **POST** /api/v1/ask/question/favorite | 收藏/取消收藏 |
| [**askQuestionToggleLike**](AskQuestionApi.md#askquestiontogglelike) | **POST** /api/v1/ask/question/like | 点赞/取消点赞 |
| [**createQuestionApiV1AskQuestionPost**](AskQuestionApi.md#createquestionapiv1askquestionpost) | **POST** /api/v1/ask/question | 提出问题 |
| [**deleteQuestionApiV1AskQuestionDelete**](AskQuestionApi.md#deletequestionapiv1askquestiondelete) | **DELETE** /api/v1/ask/question | 删除问题 |
| [**getQuestionApiV1AskQuestionPublicApiGet**](AskQuestionApi.md#getquestionapiv1askquestionpublicapiget) | **GET** /api/v1/ask/question/public-api | 问题详情 |
| [**listQuestionsApiV1AskQuestionListGet**](AskQuestionApi.md#listquestionsapiv1askquestionlistget) | **GET** /api/v1/ask/question/list | 问题列表(需权限) |
| [**memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet**](AskQuestionApi.md#memberquestioncountapiv1askquestionpublicapimembercountget) | **GET** /api/v1/ask/question/public-api/member/count | 会员问题数 |
| [**publicListQuestionsApiV1AskQuestionPublicApiListGet**](AskQuestionApi.md#publiclistquestionsapiv1askquestionpublicapilistget) | **GET** /api/v1/ask/question/public-api/list | 问题列表(公开) |
| [**updateQuestionApiV1AskQuestionPut**](AskQuestionApi.md#updatequestionapiv1askquestionput) | **PUT** /api/v1/ask/question | 修改问题 |



## askQuestionAddComment

> any askQuestionAddComment(appSchemasAskCommentCreate)

发表评论

### Example

```ts
import {
  Configuration,
  AskQuestionApi,
} from '';
import type { AskQuestionAddCommentRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskQuestionApi();

  const body = {
    // AppSchemasAskCommentCreate
    appSchemasAskCommentCreate: ...,
  } satisfies AskQuestionAddCommentRequest;

  try {
    const data = await api.askQuestionAddComment(body);
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
| **appSchemasAskCommentCreate** | [AppSchemasAskCommentCreate](AppSchemasAskCommentCreate.md) |  | |

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


## askQuestionToggleFavorite

> any askQuestionToggleFavorite(targetType, targetId)

收藏/取消收藏

### Example

```ts
import {
  Configuration,
  AskQuestionApi,
} from '';
import type { AskQuestionToggleFavoriteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskQuestionApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
  } satisfies AskQuestionToggleFavoriteRequest;

  try {
    const data = await api.askQuestionToggleFavorite(body);
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


## askQuestionToggleLike

> any askQuestionToggleLike(targetType, targetId)

点赞/取消点赞

### Example

```ts
import {
  Configuration,
  AskQuestionApi,
} from '';
import type { AskQuestionToggleLikeRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskQuestionApi();

  const body = {
    // string
    targetType: targetType_example,
    // number
    targetId: 56,
  } satisfies AskQuestionToggleLikeRequest;

  try {
    const data = await api.askQuestionToggleLike(body);
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


## createQuestionApiV1AskQuestionPost

> any createQuestionApiV1AskQuestionPost(questionCreate)

提出问题

### Example

```ts
import {
  Configuration,
  AskQuestionApi,
} from '';
import type { CreateQuestionApiV1AskQuestionPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskQuestionApi();

  const body = {
    // QuestionCreate
    questionCreate: ...,
  } satisfies CreateQuestionApiV1AskQuestionPostRequest;

  try {
    const data = await api.createQuestionApiV1AskQuestionPost(body);
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
| **questionCreate** | [QuestionCreate](QuestionCreate.md) |  | |

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


## deleteQuestionApiV1AskQuestionDelete

> any deleteQuestionApiV1AskQuestionDelete(id)

删除问题

### Example

```ts
import {
  Configuration,
  AskQuestionApi,
} from '';
import type { DeleteQuestionApiV1AskQuestionDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskQuestionApi();

  const body = {
    // number
    id: 56,
  } satisfies DeleteQuestionApiV1AskQuestionDeleteRequest;

  try {
    const data = await api.deleteQuestionApiV1AskQuestionDelete(body);
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


## getQuestionApiV1AskQuestionPublicApiGet

> any getQuestionApiV1AskQuestionPublicApiGet(id)

问题详情

### Example

```ts
import {
  Configuration,
  AskQuestionApi,
} from '';
import type { GetQuestionApiV1AskQuestionPublicApiGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskQuestionApi();

  const body = {
    // number
    id: 56,
  } satisfies GetQuestionApiV1AskQuestionPublicApiGetRequest;

  try {
    const data = await api.getQuestionApiV1AskQuestionPublicApiGet(body);
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


## listQuestionsApiV1AskQuestionListGet

> any listQuestionsApiV1AskQuestionListGet(page, limit, keyword, status, cid, memberId, orderColumn, orderDirection)

问题列表(需权限)

### Example

```ts
import {
  Configuration,
  AskQuestionApi,
} from '';
import type { ListQuestionsApiV1AskQuestionListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskQuestionApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    keyword: keyword_example,
    // string (optional)
    status: status_example,
    // number (optional)
    cid: 56,
    // string (optional)
    memberId: memberId_example,
    // string (optional)
    orderColumn: orderColumn_example,
    // string (optional)
    orderDirection: orderDirection_example,
  } satisfies ListQuestionsApiV1AskQuestionListGetRequest;

  try {
    const data = await api.listQuestionsApiV1AskQuestionListGet(body);
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
| **limit** | `number` |  | [Optional] [Defaults to `10`] |
| **keyword** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `string` |  | [Optional] [Defaults to `undefined`] |
| **cid** | `number` |  | [Optional] [Defaults to `undefined`] |
| **memberId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **orderColumn** | `string` |  | [Optional] [Defaults to `undefined`] |
| **orderDirection** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet

> any memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet(memberId)

会员问题数

### Example

```ts
import {
  Configuration,
  AskQuestionApi,
} from '';
import type { MemberQuestionCountApiV1AskQuestionPublicApiMemberCountGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskQuestionApi();

  const body = {
    // string (optional)
    memberId: memberId_example,
  } satisfies MemberQuestionCountApiV1AskQuestionPublicApiMemberCountGetRequest;

  try {
    const data = await api.memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet(body);
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
| **memberId** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## publicListQuestionsApiV1AskQuestionPublicApiListGet

> any publicListQuestionsApiV1AskQuestionPublicApiListGet(page, limit, keyword, cid, orderColumn, orderDirection)

问题列表(公开)

### Example

```ts
import {
  Configuration,
  AskQuestionApi,
} from '';
import type { PublicListQuestionsApiV1AskQuestionPublicApiListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskQuestionApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    keyword: keyword_example,
    // number (optional)
    cid: 56,
    // string (optional)
    orderColumn: orderColumn_example,
    // string (optional)
    orderDirection: orderDirection_example,
  } satisfies PublicListQuestionsApiV1AskQuestionPublicApiListGetRequest;

  try {
    const data = await api.publicListQuestionsApiV1AskQuestionPublicApiListGet(body);
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
| **limit** | `number` |  | [Optional] [Defaults to `10`] |
| **keyword** | `string` |  | [Optional] [Defaults to `undefined`] |
| **cid** | `number` |  | [Optional] [Defaults to `undefined`] |
| **orderColumn** | `string` |  | [Optional] [Defaults to `undefined`] |
| **orderDirection** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## updateQuestionApiV1AskQuestionPut

> any updateQuestionApiV1AskQuestionPut(questionUpdate)

修改问题

### Example

```ts
import {
  Configuration,
  AskQuestionApi,
} from '';
import type { UpdateQuestionApiV1AskQuestionPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskQuestionApi();

  const body = {
    // QuestionUpdate
    questionUpdate: ...,
  } satisfies UpdateQuestionApiV1AskQuestionPutRequest;

  try {
    const data = await api.updateQuestionApiV1AskQuestionPut(body);
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
| **questionUpdate** | [QuestionUpdate](QuestionUpdate.md) |  | |

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

