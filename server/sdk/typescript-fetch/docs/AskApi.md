# AskApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addCategoryApiV1AskCategoryPost**](AskApi.md#addcategoryapiv1askcategorypost) | **POST** /api/v1/ask/category | 添加分类 |
| [**adoptAnswerApiV1AskAnswerAdoptPut**](AskApi.md#adoptanswerapiv1askansweradoptput) | **PUT** /api/v1/ask/answer/adopt | 采纳回答 |
| [**askCategoryAdminList**](AskApi.md#askcategoryadminlist) | **GET** /api/v1/ask/category/admin/list | 分类列表(管理员) |
| [**askQuestionAddComment**](AskApi.md#askquestionaddcomment) | **POST** /api/v1/ask/question/comment | 发表评论 |
| [**askQuestionToggleFavorite**](AskApi.md#askquestiontogglefavorite) | **POST** /api/v1/ask/question/favorite | 收藏/取消收藏 |
| [**askQuestionToggleLike**](AskApi.md#askquestiontogglelike) | **POST** /api/v1/ask/question/like | 点赞/取消点赞 |
| [**changeShowApiV1AskCategoryIsShowPut**](AskApi.md#changeshowapiv1askcategoryisshowput) | **PUT** /api/v1/ask/category/is-show | 修改显示状态 |
| [**changeShowIndexApiV1AskCategoryIsShowIndexPut**](AskApi.md#changeshowindexapiv1askcategoryisshowindexput) | **PUT** /api/v1/ask/category/is-show-index | 修改首页显示状态 |
| [**createAnswerApiV1AskAnswerPost**](AskApi.md#createanswerapiv1askanswerpost) | **POST** /api/v1/ask/answer | 提出回答 |
| [**createQuestionApiV1AskQuestionPost**](AskApi.md#createquestionapiv1askquestionpost) | **POST** /api/v1/ask/question | 提出问题 |
| [**deleteAnswerApiV1AskAnswerDelete**](AskApi.md#deleteanswerapiv1askanswerdelete) | **DELETE** /api/v1/ask/answer | 删除回答 |
| [**deleteCategoryApiV1AskCategoryCatIdDelete**](AskApi.md#deletecategoryapiv1askcategorycatiddelete) | **DELETE** /api/v1/ask/category/{cat_id} | 删除分类 |
| [**deleteQuestionApiV1AskQuestionDelete**](AskApi.md#deletequestionapiv1askquestiondelete) | **DELETE** /api/v1/ask/question | 删除问题 |
| [**getAnswerApiV1AskAnswerPublicApiGet**](AskApi.md#getanswerapiv1askanswerpublicapiget) | **GET** /api/v1/ask/answer/public-api | 回答详情 |
| [**getCategoryApiV1AskCategoryCatIdGet**](AskApi.md#getcategoryapiv1askcategorycatidget) | **GET** /api/v1/ask/category/{cat_id} | 分类详情 |
| [**getQuestionApiV1AskQuestionPublicApiGet**](AskApi.md#getquestionapiv1askquestionpublicapiget) | **GET** /api/v1/ask/question/public-api | 问题详情 |
| [**listAnswersApiV1AskAnswerListGet**](AskApi.md#listanswersapiv1askanswerlistget) | **GET** /api/v1/ask/answer/list | 回答列表(需权限) |
| [**listQuestionsApiV1AskQuestionListGet**](AskApi.md#listquestionsapiv1askquestionlistget) | **GET** /api/v1/ask/question/list | 问题列表(需权限) |
| [**memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet**](AskApi.md#memberanswercountapiv1askanswerpublicapimembercountget) | **GET** /api/v1/ask/answer/public-api/member/count | 会员回答数 |
| [**memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet**](AskApi.md#memberquestioncountapiv1askquestionpublicapimembercountget) | **GET** /api/v1/ask/question/public-api/member/count | 会员问题数 |
| [**publicListAnswersApiV1AskAnswerPublicApiListGet**](AskApi.md#publiclistanswersapiv1askanswerpublicapilistget) | **GET** /api/v1/ask/answer/public-api/list | 回答列表(公开) |
| [**publicListApiV1AskCategoryPublicApiListGet**](AskApi.md#publiclistapiv1askcategorypublicapilistget) | **GET** /api/v1/ask/category/public-api/list | 分类列表(公开) |
| [**publicListQuestionsApiV1AskQuestionPublicApiListGet**](AskApi.md#publiclistquestionsapiv1askquestionpublicapilistget) | **GET** /api/v1/ask/question/public-api/list | 问题列表(公开) |
| [**updateAnswerApiV1AskAnswerPut**](AskApi.md#updateanswerapiv1askanswerput) | **PUT** /api/v1/ask/answer | 修改回答 |
| [**updateCategoryApiV1AskCategoryPut**](AskApi.md#updatecategoryapiv1askcategoryput) | **PUT** /api/v1/ask/category | 修改分类 |
| [**updateQuestionApiV1AskQuestionPut**](AskApi.md#updatequestionapiv1askquestionput) | **PUT** /api/v1/ask/question | 修改问题 |



## addCategoryApiV1AskCategoryPost

> any addCategoryApiV1AskCategoryPost(categoryCreate)

添加分类

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { AddCategoryApiV1AskCategoryPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

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


## adoptAnswerApiV1AskAnswerAdoptPut

> any adoptAnswerApiV1AskAnswerAdoptPut(id)

采纳回答

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { AdoptAnswerApiV1AskAnswerAdoptPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

  const body = {
    // number
    id: 56,
  } satisfies AdoptAnswerApiV1AskAnswerAdoptPutRequest;

  try {
    const data = await api.adoptAnswerApiV1AskAnswerAdoptPut(body);
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


## askCategoryAdminList

> any askCategoryAdminList(isShow, isShowIndex)

分类列表(管理员)

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { AskCategoryAdminListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

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


## askQuestionAddComment

> any askQuestionAddComment(appSchemasAskCommentCreate)

发表评论

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { AskQuestionAddCommentRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

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
  AskApi,
} from '';
import type { AskQuestionToggleFavoriteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

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
  AskApi,
} from '';
import type { AskQuestionToggleLikeRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

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


## changeShowApiV1AskCategoryIsShowPut

> any changeShowApiV1AskCategoryIsShowPut(id, isShow)

修改显示状态

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { ChangeShowApiV1AskCategoryIsShowPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

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
  AskApi,
} from '';
import type { ChangeShowIndexApiV1AskCategoryIsShowIndexPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

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


## createAnswerApiV1AskAnswerPost

> any createAnswerApiV1AskAnswerPost(answerCreate)

提出回答

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { CreateAnswerApiV1AskAnswerPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

  const body = {
    // AnswerCreate
    answerCreate: ...,
  } satisfies CreateAnswerApiV1AskAnswerPostRequest;

  try {
    const data = await api.createAnswerApiV1AskAnswerPost(body);
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
| **answerCreate** | [AnswerCreate](AnswerCreate.md) |  | |

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


## createQuestionApiV1AskQuestionPost

> any createQuestionApiV1AskQuestionPost(questionCreate)

提出问题

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { CreateQuestionApiV1AskQuestionPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

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


## deleteAnswerApiV1AskAnswerDelete

> any deleteAnswerApiV1AskAnswerDelete(id)

删除回答

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { DeleteAnswerApiV1AskAnswerDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

  const body = {
    // number
    id: 56,
  } satisfies DeleteAnswerApiV1AskAnswerDeleteRequest;

  try {
    const data = await api.deleteAnswerApiV1AskAnswerDelete(body);
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


## deleteCategoryApiV1AskCategoryCatIdDelete

> any deleteCategoryApiV1AskCategoryCatIdDelete(catId)

删除分类

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { DeleteCategoryApiV1AskCategoryCatIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

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


## deleteQuestionApiV1AskQuestionDelete

> any deleteQuestionApiV1AskQuestionDelete(id)

删除问题

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { DeleteQuestionApiV1AskQuestionDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

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


## getAnswerApiV1AskAnswerPublicApiGet

> any getAnswerApiV1AskAnswerPublicApiGet(id)

回答详情

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { GetAnswerApiV1AskAnswerPublicApiGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

  const body = {
    // number
    id: 56,
  } satisfies GetAnswerApiV1AskAnswerPublicApiGetRequest;

  try {
    const data = await api.getAnswerApiV1AskAnswerPublicApiGet(body);
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


## getCategoryApiV1AskCategoryCatIdGet

> any getCategoryApiV1AskCategoryCatIdGet(catId)

分类详情

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { GetCategoryApiV1AskCategoryCatIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

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


## getQuestionApiV1AskQuestionPublicApiGet

> any getQuestionApiV1AskQuestionPublicApiGet(id)

问题详情

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { GetQuestionApiV1AskQuestionPublicApiGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

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


## listAnswersApiV1AskAnswerListGet

> any listAnswersApiV1AskAnswerListGet(page, limit, questionId, memberId)

回答列表(需权限)

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { ListAnswersApiV1AskAnswerListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    questionId: 56,
    // string (optional)
    memberId: memberId_example,
  } satisfies ListAnswersApiV1AskAnswerListGetRequest;

  try {
    const data = await api.listAnswersApiV1AskAnswerListGet(body);
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
| **questionId** | `number` |  | [Optional] [Defaults to `undefined`] |
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


## listQuestionsApiV1AskQuestionListGet

> any listQuestionsApiV1AskQuestionListGet(page, limit, keyword, status, cid, memberId, orderColumn, orderDirection)

问题列表(需权限)

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { ListQuestionsApiV1AskQuestionListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

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


## memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet

> any memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet(memberId)

会员回答数

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { MemberAnswerCountApiV1AskAnswerPublicApiMemberCountGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

  const body = {
    // string (optional)
    memberId: memberId_example,
  } satisfies MemberAnswerCountApiV1AskAnswerPublicApiMemberCountGetRequest;

  try {
    const data = await api.memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet(body);
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


## memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet

> any memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet(memberId)

会员问题数

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { MemberQuestionCountApiV1AskQuestionPublicApiMemberCountGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

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


## publicListAnswersApiV1AskAnswerPublicApiListGet

> any publicListAnswersApiV1AskAnswerPublicApiListGet(page, limit, questionId)

回答列表(公开)

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { PublicListAnswersApiV1AskAnswerPublicApiListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    questionId: 56,
  } satisfies PublicListAnswersApiV1AskAnswerPublicApiListGetRequest;

  try {
    const data = await api.publicListAnswersApiV1AskAnswerPublicApiListGet(body);
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
| **questionId** | `number` |  | [Optional] [Defaults to `undefined`] |

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
  AskApi,
} from '';
import type { PublicListApiV1AskCategoryPublicApiListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

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


## publicListQuestionsApiV1AskQuestionPublicApiListGet

> any publicListQuestionsApiV1AskQuestionPublicApiListGet(page, limit, keyword, cid, orderColumn, orderDirection)

问题列表(公开)

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { PublicListQuestionsApiV1AskQuestionPublicApiListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

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


## updateAnswerApiV1AskAnswerPut

> any updateAnswerApiV1AskAnswerPut(answerUpdate)

修改回答

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { UpdateAnswerApiV1AskAnswerPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

  const body = {
    // AnswerUpdate
    answerUpdate: ...,
  } satisfies UpdateAnswerApiV1AskAnswerPutRequest;

  try {
    const data = await api.updateAnswerApiV1AskAnswerPut(body);
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
| **answerUpdate** | [AnswerUpdate](AnswerUpdate.md) |  | |

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


## updateCategoryApiV1AskCategoryPut

> any updateCategoryApiV1AskCategoryPut(categoryUpdate)

修改分类

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { UpdateCategoryApiV1AskCategoryPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

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


## updateQuestionApiV1AskQuestionPut

> any updateQuestionApiV1AskQuestionPut(questionUpdate)

修改问题

### Example

```ts
import {
  Configuration,
  AskApi,
} from '';
import type { UpdateQuestionApiV1AskQuestionPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskApi();

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

