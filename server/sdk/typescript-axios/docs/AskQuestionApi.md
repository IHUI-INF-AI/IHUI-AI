# AskQuestionApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**askQuestionAddComment**](#askquestionaddcomment) | **POST** /api/v1/ask/question/comment | 发表评论|
|[**askQuestionToggleFavorite**](#askquestiontogglefavorite) | **POST** /api/v1/ask/question/favorite | 收藏/取消收藏|
|[**askQuestionToggleLike**](#askquestiontogglelike) | **POST** /api/v1/ask/question/like | 点赞/取消点赞|
|[**createQuestionApiV1AskQuestionPost**](#createquestionapiv1askquestionpost) | **POST** /api/v1/ask/question | 提出问题|
|[**deleteQuestionApiV1AskQuestionDelete**](#deletequestionapiv1askquestiondelete) | **DELETE** /api/v1/ask/question | 删除问题|
|[**getQuestionApiV1AskQuestionPublicApiGet**](#getquestionapiv1askquestionpublicapiget) | **GET** /api/v1/ask/question/public-api | 问题详情|
|[**listQuestionsApiV1AskQuestionListGet**](#listquestionsapiv1askquestionlistget) | **GET** /api/v1/ask/question/list | 问题列表(需权限)|
|[**memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet**](#memberquestioncountapiv1askquestionpublicapimembercountget) | **GET** /api/v1/ask/question/public-api/member/count | 会员问题数|
|[**publicListQuestionsApiV1AskQuestionPublicApiListGet**](#publiclistquestionsapiv1askquestionpublicapilistget) | **GET** /api/v1/ask/question/public-api/list | 问题列表(公开)|
|[**updateQuestionApiV1AskQuestionPut**](#updatequestionapiv1askquestionput) | **PUT** /api/v1/ask/question | 修改问题|

# **askQuestionAddComment**
> any askQuestionAddComment(appSchemasAskCommentCreate)


### Example

```typescript
import {
    AskQuestionApi,
    Configuration,
    AppSchemasAskCommentCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new AskQuestionApi(configuration);

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
    AskQuestionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskQuestionApi(configuration);

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
    AskQuestionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskQuestionApi(configuration);

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

# **createQuestionApiV1AskQuestionPost**
> any createQuestionApiV1AskQuestionPost(questionCreate)


### Example

```typescript
import {
    AskQuestionApi,
    Configuration,
    QuestionCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new AskQuestionApi(configuration);

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

# **deleteQuestionApiV1AskQuestionDelete**
> any deleteQuestionApiV1AskQuestionDelete()


### Example

```typescript
import {
    AskQuestionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskQuestionApi(configuration);

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

# **getQuestionApiV1AskQuestionPublicApiGet**
> any getQuestionApiV1AskQuestionPublicApiGet()


### Example

```typescript
import {
    AskQuestionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskQuestionApi(configuration);

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

# **listQuestionsApiV1AskQuestionListGet**
> any listQuestionsApiV1AskQuestionListGet()


### Example

```typescript
import {
    AskQuestionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskQuestionApi(configuration);

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

# **memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet**
> any memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet()


### Example

```typescript
import {
    AskQuestionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskQuestionApi(configuration);

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

# **publicListQuestionsApiV1AskQuestionPublicApiListGet**
> any publicListQuestionsApiV1AskQuestionPublicApiListGet()


### Example

```typescript
import {
    AskQuestionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskQuestionApi(configuration);

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

# **updateQuestionApiV1AskQuestionPut**
> any updateQuestionApiV1AskQuestionPut(questionUpdate)


### Example

```typescript
import {
    AskQuestionApi,
    Configuration,
    QuestionUpdate
} from './api';

const configuration = new Configuration();
const apiInstance = new AskQuestionApi(configuration);

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

