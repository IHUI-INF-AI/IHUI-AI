# AskApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**addCategoryApiV1AskCategoryPost**](#addcategoryapiv1askcategorypost) | **POST** /api/v1/ask/category | 添加分类|
|[**adoptAnswerApiV1AskAnswerAdoptPut**](#adoptanswerapiv1askansweradoptput) | **PUT** /api/v1/ask/answer/adopt | 采纳回答|
|[**askCategoryAdminList**](#askcategoryadminlist) | **GET** /api/v1/ask/category/admin/list | 分类列表(管理员)|
|[**askQuestionAddComment**](#askquestionaddcomment) | **POST** /api/v1/ask/question/comment | 发表评论|
|[**askQuestionToggleFavorite**](#askquestiontogglefavorite) | **POST** /api/v1/ask/question/favorite | 收藏/取消收藏|
|[**askQuestionToggleLike**](#askquestiontogglelike) | **POST** /api/v1/ask/question/like | 点赞/取消点赞|
|[**changeShowApiV1AskCategoryIsShowPut**](#changeshowapiv1askcategoryisshowput) | **PUT** /api/v1/ask/category/is-show | 修改显示状态|
|[**changeShowIndexApiV1AskCategoryIsShowIndexPut**](#changeshowindexapiv1askcategoryisshowindexput) | **PUT** /api/v1/ask/category/is-show-index | 修改首页显示状态|
|[**createAnswerApiV1AskAnswerPost**](#createanswerapiv1askanswerpost) | **POST** /api/v1/ask/answer | 提出回答|
|[**createQuestionApiV1AskQuestionPost**](#createquestionapiv1askquestionpost) | **POST** /api/v1/ask/question | 提出问题|
|[**deleteAnswerApiV1AskAnswerDelete**](#deleteanswerapiv1askanswerdelete) | **DELETE** /api/v1/ask/answer | 删除回答|
|[**deleteCategoryApiV1AskCategoryCatIdDelete**](#deletecategoryapiv1askcategorycatiddelete) | **DELETE** /api/v1/ask/category/{cat_id} | 删除分类|
|[**deleteQuestionApiV1AskQuestionDelete**](#deletequestionapiv1askquestiondelete) | **DELETE** /api/v1/ask/question | 删除问题|
|[**getAnswerApiV1AskAnswerPublicApiGet**](#getanswerapiv1askanswerpublicapiget) | **GET** /api/v1/ask/answer/public-api | 回答详情|
|[**getCategoryApiV1AskCategoryCatIdGet**](#getcategoryapiv1askcategorycatidget) | **GET** /api/v1/ask/category/{cat_id} | 分类详情|
|[**getQuestionApiV1AskQuestionPublicApiGet**](#getquestionapiv1askquestionpublicapiget) | **GET** /api/v1/ask/question/public-api | 问题详情|
|[**listAnswersApiV1AskAnswerListGet**](#listanswersapiv1askanswerlistget) | **GET** /api/v1/ask/answer/list | 回答列表(需权限)|
|[**listQuestionsApiV1AskQuestionListGet**](#listquestionsapiv1askquestionlistget) | **GET** /api/v1/ask/question/list | 问题列表(需权限)|
|[**memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet**](#memberanswercountapiv1askanswerpublicapimembercountget) | **GET** /api/v1/ask/answer/public-api/member/count | 会员回答数|
|[**memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet**](#memberquestioncountapiv1askquestionpublicapimembercountget) | **GET** /api/v1/ask/question/public-api/member/count | 会员问题数|
|[**publicListAnswersApiV1AskAnswerPublicApiListGet**](#publiclistanswersapiv1askanswerpublicapilistget) | **GET** /api/v1/ask/answer/public-api/list | 回答列表(公开)|
|[**publicListApiV1AskCategoryPublicApiListGet**](#publiclistapiv1askcategorypublicapilistget) | **GET** /api/v1/ask/category/public-api/list | 分类列表(公开)|
|[**publicListQuestionsApiV1AskQuestionPublicApiListGet**](#publiclistquestionsapiv1askquestionpublicapilistget) | **GET** /api/v1/ask/question/public-api/list | 问题列表(公开)|
|[**updateAnswerApiV1AskAnswerPut**](#updateanswerapiv1askanswerput) | **PUT** /api/v1/ask/answer | 修改回答|
|[**updateCategoryApiV1AskCategoryPut**](#updatecategoryapiv1askcategoryput) | **PUT** /api/v1/ask/category | 修改分类|
|[**updateQuestionApiV1AskQuestionPut**](#updatequestionapiv1askquestionput) | **PUT** /api/v1/ask/question | 修改问题|

# **addCategoryApiV1AskCategoryPost**
> any addCategoryApiV1AskCategoryPost(categoryCreate)


### Example

```typescript
import {
    AskApi,
    Configuration,
    CategoryCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let categoryCreate: CategoryCreate; //

const { status, data } = await apiInstance.addCategoryApiV1AskCategoryPost(
    categoryCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **categoryCreate** | **CategoryCreate**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adoptAnswerApiV1AskAnswerAdoptPut**
> any adoptAnswerApiV1AskAnswerAdoptPut()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adoptAnswerApiV1AskAnswerAdoptPut(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


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

# **askCategoryAdminList**
> any askCategoryAdminList()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let isShow: boolean; // (optional) (default to undefined)
let isShowIndex: boolean; // (optional) (default to undefined)

const { status, data } = await apiInstance.askCategoryAdminList(
    isShow,
    isShowIndex
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **isShow** | [**boolean**] |  | (optional) defaults to undefined|
| **isShowIndex** | [**boolean**] |  | (optional) defaults to undefined|


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

# **askQuestionAddComment**
> any askQuestionAddComment(appSchemasAskCommentCreate)


### Example

```typescript
import {
    AskApi,
    Configuration,
    AppSchemasAskCommentCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let appSchemasAskCommentCreate: AppSchemasAskCommentCreate; //

const { status, data } = await apiInstance.askQuestionAddComment(
    appSchemasAskCommentCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **appSchemasAskCommentCreate** | **AppSchemasAskCommentCreate**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **askQuestionToggleFavorite**
> any askQuestionToggleFavorite()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)

const { status, data } = await apiInstance.askQuestionToggleFavorite(
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

# **askQuestionToggleLike**
> any askQuestionToggleLike()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let targetType: string; // (default to undefined)
let targetId: number; // (default to undefined)

const { status, data } = await apiInstance.askQuestionToggleLike(
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

# **changeShowApiV1AskCategoryIsShowPut**
> any changeShowApiV1AskCategoryIsShowPut()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let id: number; // (default to undefined)
let isShow: boolean; // (default to undefined)

const { status, data } = await apiInstance.changeShowApiV1AskCategoryIsShowPut(
    id,
    isShow
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|
| **isShow** | [**boolean**] |  | defaults to undefined|


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

# **changeShowIndexApiV1AskCategoryIsShowIndexPut**
> any changeShowIndexApiV1AskCategoryIsShowIndexPut()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let id: number; // (default to undefined)
let isShowIndex: boolean; // (default to undefined)

const { status, data } = await apiInstance.changeShowIndexApiV1AskCategoryIsShowIndexPut(
    id,
    isShowIndex
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|
| **isShowIndex** | [**boolean**] |  | defaults to undefined|


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

# **createAnswerApiV1AskAnswerPost**
> any createAnswerApiV1AskAnswerPost(answerCreate)


### Example

```typescript
import {
    AskApi,
    Configuration,
    AnswerCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let answerCreate: AnswerCreate; //

const { status, data } = await apiInstance.createAnswerApiV1AskAnswerPost(
    answerCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **answerCreate** | **AnswerCreate**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createQuestionApiV1AskQuestionPost**
> any createQuestionApiV1AskQuestionPost(questionCreate)


### Example

```typescript
import {
    AskApi,
    Configuration,
    QuestionCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let questionCreate: QuestionCreate; //

const { status, data } = await apiInstance.createQuestionApiV1AskQuestionPost(
    questionCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **questionCreate** | **QuestionCreate**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteAnswerApiV1AskAnswerDelete**
> any deleteAnswerApiV1AskAnswerDelete()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.deleteAnswerApiV1AskAnswerDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


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

# **deleteCategoryApiV1AskCategoryCatIdDelete**
> any deleteCategoryApiV1AskCategoryCatIdDelete()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let catId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteCategoryApiV1AskCategoryCatIdDelete(
    catId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **catId** | [**number**] |  | defaults to undefined|


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

# **deleteQuestionApiV1AskQuestionDelete**
> any deleteQuestionApiV1AskQuestionDelete()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.deleteQuestionApiV1AskQuestionDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


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

# **getAnswerApiV1AskAnswerPublicApiGet**
> any getAnswerApiV1AskAnswerPublicApiGet()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.getAnswerApiV1AskAnswerPublicApiGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


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

# **getCategoryApiV1AskCategoryCatIdGet**
> any getCategoryApiV1AskCategoryCatIdGet()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let catId: number; // (default to undefined)

const { status, data } = await apiInstance.getCategoryApiV1AskCategoryCatIdGet(
    catId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **catId** | [**number**] |  | defaults to undefined|


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

# **getQuestionApiV1AskQuestionPublicApiGet**
> any getQuestionApiV1AskQuestionPublicApiGet()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.getQuestionApiV1AskQuestionPublicApiGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


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

# **listAnswersApiV1AskAnswerListGet**
> any listAnswersApiV1AskAnswerListGet()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 10)
let questionId: number; // (optional) (default to undefined)
let memberId: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listAnswersApiV1AskAnswerListGet(
    page,
    limit,
    questionId,
    memberId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 10|
| **questionId** | [**number**] |  | (optional) defaults to undefined|
| **memberId** | [**string**] |  | (optional) defaults to undefined|


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

# **listQuestionsApiV1AskQuestionListGet**
> any listQuestionsApiV1AskQuestionListGet()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 10)
let keyword: string; // (optional) (default to undefined)
let status: string; // (optional) (default to undefined)
let cid: number; // (optional) (default to undefined)
let memberId: string; // (optional) (default to undefined)
let orderColumn: string; // (optional) (default to undefined)
let orderDirection: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listQuestionsApiV1AskQuestionListGet(
    page,
    limit,
    keyword,
    status,
    cid,
    memberId,
    orderColumn,
    orderDirection
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 10|
| **keyword** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**string**] |  | (optional) defaults to undefined|
| **cid** | [**number**] |  | (optional) defaults to undefined|
| **memberId** | [**string**] |  | (optional) defaults to undefined|
| **orderColumn** | [**string**] |  | (optional) defaults to undefined|
| **orderDirection** | [**string**] |  | (optional) defaults to undefined|


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

# **memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet**
> any memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let memberId: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet(
    memberId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **memberId** | [**string**] |  | (optional) defaults to undefined|


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

# **memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet**
> any memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let memberId: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet(
    memberId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **memberId** | [**string**] |  | (optional) defaults to undefined|


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

# **publicListAnswersApiV1AskAnswerPublicApiListGet**
> any publicListAnswersApiV1AskAnswerPublicApiListGet()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 10)
let questionId: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.publicListAnswersApiV1AskAnswerPublicApiListGet(
    page,
    limit,
    questionId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 10|
| **questionId** | [**number**] |  | (optional) defaults to undefined|


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

# **publicListApiV1AskCategoryPublicApiListGet**
> any publicListApiV1AskCategoryPublicApiListGet()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let isShow: boolean; // (optional) (default to undefined)
let isShowIndex: boolean; // (optional) (default to undefined)

const { status, data } = await apiInstance.publicListApiV1AskCategoryPublicApiListGet(
    isShow,
    isShowIndex
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **isShow** | [**boolean**] |  | (optional) defaults to undefined|
| **isShowIndex** | [**boolean**] |  | (optional) defaults to undefined|


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

# **publicListQuestionsApiV1AskQuestionPublicApiListGet**
> any publicListQuestionsApiV1AskQuestionPublicApiListGet()


### Example

```typescript
import {
    AskApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 10)
let keyword: string; // (optional) (default to undefined)
let cid: number; // (optional) (default to undefined)
let orderColumn: string; // (optional) (default to undefined)
let orderDirection: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.publicListQuestionsApiV1AskQuestionPublicApiListGet(
    page,
    limit,
    keyword,
    cid,
    orderColumn,
    orderDirection
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 10|
| **keyword** | [**string**] |  | (optional) defaults to undefined|
| **cid** | [**number**] |  | (optional) defaults to undefined|
| **orderColumn** | [**string**] |  | (optional) defaults to undefined|
| **orderDirection** | [**string**] |  | (optional) defaults to undefined|


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

# **updateAnswerApiV1AskAnswerPut**
> any updateAnswerApiV1AskAnswerPut(answerUpdate)


### Example

```typescript
import {
    AskApi,
    Configuration,
    AnswerUpdate
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let answerUpdate: AnswerUpdate; //

const { status, data } = await apiInstance.updateAnswerApiV1AskAnswerPut(
    answerUpdate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **answerUpdate** | **AnswerUpdate**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateCategoryApiV1AskCategoryPut**
> any updateCategoryApiV1AskCategoryPut(categoryUpdate)


### Example

```typescript
import {
    AskApi,
    Configuration,
    CategoryUpdate
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let categoryUpdate: CategoryUpdate; //

const { status, data } = await apiInstance.updateCategoryApiV1AskCategoryPut(
    categoryUpdate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **categoryUpdate** | **CategoryUpdate**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateQuestionApiV1AskQuestionPut**
> any updateQuestionApiV1AskQuestionPut(questionUpdate)


### Example

```typescript
import {
    AskApi,
    Configuration,
    QuestionUpdate
} from './api';

const configuration = new Configuration();
const apiInstance = new AskApi(configuration);

let questionUpdate: QuestionUpdate; //

const { status, data } = await apiInstance.updateQuestionApiV1AskQuestionPut(
    questionUpdate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **questionUpdate** | **QuestionUpdate**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

