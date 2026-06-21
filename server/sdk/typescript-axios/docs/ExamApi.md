# ExamApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createPaperApiV1ExamPaperPost**](#createpaperapiv1exampaperpost) | **POST** /api/v1/exam/paper | 创建试卷|
|[**createPaperApiV1ExamPaperPost_0**](#createpaperapiv1exampaperpost_0) | **POST** /api/v1/exam/paper | 创建试卷|
|[**createQuestionApiV1ExamQuestionPost**](#createquestionapiv1examquestionpost) | **POST** /api/v1/exam/question | 新增题目|
|[**createQuestionApiV1ExamQuestionPost_0**](#createquestionapiv1examquestionpost_0) | **POST** /api/v1/exam/question | 新增题目|
|[**deletePaperApiV1ExamPaperPidDelete**](#deletepaperapiv1exampaperpiddelete) | **DELETE** /api/v1/exam/paper/{pid} | 删除试卷|
|[**deletePaperApiV1ExamPaperPidDelete_0**](#deletepaperapiv1exampaperpiddelete_0) | **DELETE** /api/v1/exam/paper/{pid} | 删除试卷|
|[**deleteQuestionApiV1ExamQuestionQidDelete**](#deletequestionapiv1examquestionqiddelete) | **DELETE** /api/v1/exam/question/{qid} | 删除题目|
|[**deleteQuestionApiV1ExamQuestionQidDelete_0**](#deletequestionapiv1examquestionqiddelete_0) | **DELETE** /api/v1/exam/question/{qid} | 删除题目|
|[**examPaperCategoryList**](#exampapercategorylist) | **GET** /api/v1/exam/category/list | 考试分类列表|
|[**examPaperCategoryList_0**](#exampapercategorylist_0) | **GET** /api/v1/exam/category/list | 考试分类列表|
|[**getPaperApiV1ExamPaperPidGet**](#getpaperapiv1exampaperpidget) | **GET** /api/v1/exam/paper/{pid} | 试卷详情|
|[**getPaperApiV1ExamPaperPidGet_0**](#getpaperapiv1exampaperpidget_0) | **GET** /api/v1/exam/paper/{pid} | 试卷详情|
|[**getRecordApiV1ExamRecordRidGet**](#getrecordapiv1examrecordridget) | **GET** /api/v1/exam/record/{rid} | 考试记录详情|
|[**getRecordApiV1ExamRecordRidGet_0**](#getrecordapiv1examrecordridget_0) | **GET** /api/v1/exam/record/{rid} | 考试记录详情|
|[**listPapersApiV1ExamPaperListGet**](#listpapersapiv1exampaperlistget) | **GET** /api/v1/exam/paper/list | 试卷列表|
|[**listPapersApiV1ExamPaperListGet_0**](#listpapersapiv1exampaperlistget_0) | **GET** /api/v1/exam/paper/list | 试卷列表|
|[**listQuestionsApiV1ExamQuestionListGet**](#listquestionsapiv1examquestionlistget) | **GET** /api/v1/exam/question/list | 题目列表|
|[**listQuestionsApiV1ExamQuestionListGet_0**](#listquestionsapiv1examquestionlistget_0) | **GET** /api/v1/exam/question/list | 题目列表|
|[**listRecordsApiV1ExamRecordListGet**](#listrecordsapiv1examrecordlistget) | **GET** /api/v1/exam/record/list | 考试记录列表|
|[**listRecordsApiV1ExamRecordListGet_0**](#listrecordsapiv1examrecordlistget_0) | **GET** /api/v1/exam/record/list | 考试记录列表|
|[**markMasteredApiV1ExamWrongWidMasterPut**](#markmasteredapiv1examwrongwidmasterput) | **PUT** /api/v1/exam/wrong/{wid}/master | 标记错题为已掌握|
|[**markMasteredApiV1ExamWrongWidMasterPut_0**](#markmasteredapiv1examwrongwidmasterput_0) | **PUT** /api/v1/exam/wrong/{wid}/master | 标记错题为已掌握|
|[**startExamApiV1ExamRecordStartPost**](#startexamapiv1examrecordstartpost) | **POST** /api/v1/exam/record/start | 开始考试|
|[**startExamApiV1ExamRecordStartPost_0**](#startexamapiv1examrecordstartpost_0) | **POST** /api/v1/exam/record/start | 开始考试|
|[**submitExamApiV1ExamRecordSubmitPost**](#submitexamapiv1examrecordsubmitpost) | **POST** /api/v1/exam/record/submit | 提交答卷|
|[**submitExamApiV1ExamRecordSubmitPost_0**](#submitexamapiv1examrecordsubmitpost_0) | **POST** /api/v1/exam/record/submit | 提交答卷|
|[**updatePaperApiV1ExamPaperPidPut**](#updatepaperapiv1exampaperpidput) | **PUT** /api/v1/exam/paper/{pid} | 修改试卷|
|[**updatePaperApiV1ExamPaperPidPut_0**](#updatepaperapiv1exampaperpidput_0) | **PUT** /api/v1/exam/paper/{pid} | 修改试卷|
|[**updateQuestionApiV1ExamQuestionQidPut**](#updatequestionapiv1examquestionqidput) | **PUT** /api/v1/exam/question/{qid} | 修改题目|
|[**updateQuestionApiV1ExamQuestionQidPut_0**](#updatequestionapiv1examquestionqidput_0) | **PUT** /api/v1/exam/question/{qid} | 修改题目|
|[**wrongListApiV1ExamWrongListGet**](#wronglistapiv1examwronglistget) | **GET** /api/v1/exam/wrong/list | 错题本|
|[**wrongListApiV1ExamWrongListGet_0**](#wronglistapiv1examwronglistget_0) | **GET** /api/v1/exam/wrong/list | 错题本|

# **createPaperApiV1ExamPaperPost**
> any createPaperApiV1ExamPaperPost()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let title: string; // (default to undefined)
let description: string; // (optional) (default to undefined)
let categoryId: number; // (optional) (default to undefined)
let courseId: number; // (optional) (default to undefined)
let cover: string; // (optional) (default to undefined)
let totalScore: number; // (optional) (default to 100)
let passScore: number; // (optional) (default to 60)
let duration: number; // (optional) (default to 60)
let type: number; // (optional) (default to 1)
let difficulty: number; // (optional) (default to 1)
let isFree: boolean; // (optional) (default to true)
let price: number; // (optional) (default to 0)

const { status, data } = await apiInstance.createPaperApiV1ExamPaperPost(
    title,
    description,
    categoryId,
    courseId,
    cover,
    totalScore,
    passScore,
    duration,
    type,
    difficulty,
    isFree,
    price
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **categoryId** | [**number**] |  | (optional) defaults to undefined|
| **courseId** | [**number**] |  | (optional) defaults to undefined|
| **cover** | [**string**] |  | (optional) defaults to undefined|
| **totalScore** | [**number**] |  | (optional) defaults to 100|
| **passScore** | [**number**] |  | (optional) defaults to 60|
| **duration** | [**number**] |  | (optional) defaults to 60|
| **type** | [**number**] |  | (optional) defaults to 1|
| **difficulty** | [**number**] |  | (optional) defaults to 1|
| **isFree** | [**boolean**] |  | (optional) defaults to true|
| **price** | [**number**] |  | (optional) defaults to 0|


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

# **createPaperApiV1ExamPaperPost_0**
> any createPaperApiV1ExamPaperPost_0()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let title: string; // (default to undefined)
let description: string; // (optional) (default to undefined)
let categoryId: number; // (optional) (default to undefined)
let courseId: number; // (optional) (default to undefined)
let cover: string; // (optional) (default to undefined)
let totalScore: number; // (optional) (default to 100)
let passScore: number; // (optional) (default to 60)
let duration: number; // (optional) (default to 60)
let type: number; // (optional) (default to 1)
let difficulty: number; // (optional) (default to 1)
let isFree: boolean; // (optional) (default to true)
let price: number; // (optional) (default to 0)

const { status, data } = await apiInstance.createPaperApiV1ExamPaperPost_0(
    title,
    description,
    categoryId,
    courseId,
    cover,
    totalScore,
    passScore,
    duration,
    type,
    difficulty,
    isFree,
    price
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **categoryId** | [**number**] |  | (optional) defaults to undefined|
| **courseId** | [**number**] |  | (optional) defaults to undefined|
| **cover** | [**string**] |  | (optional) defaults to undefined|
| **totalScore** | [**number**] |  | (optional) defaults to 100|
| **passScore** | [**number**] |  | (optional) defaults to 60|
| **duration** | [**number**] |  | (optional) defaults to 60|
| **type** | [**number**] |  | (optional) defaults to 1|
| **difficulty** | [**number**] |  | (optional) defaults to 1|
| **isFree** | [**boolean**] |  | (optional) defaults to true|
| **price** | [**number**] |  | (optional) defaults to 0|


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

# **createQuestionApiV1ExamQuestionPost**
> any createQuestionApiV1ExamQuestionPost()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let paperId: number; // (default to undefined)
let type: number; // (default to undefined)
let content: string; // (default to undefined)
let answer: string; // (default to undefined)
let _options: string; // (optional) (default to undefined)
let analysis: string; // (optional) (default to undefined)
let score: number; // (optional) (default to 1)
let difficulty: number; // (optional) (default to 1)
let sortOrder: number; // (optional) (default to 0)

const { status, data } = await apiInstance.createQuestionApiV1ExamQuestionPost(
    paperId,
    type,
    content,
    answer,
    _options,
    analysis,
    score,
    difficulty,
    sortOrder
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **paperId** | [**number**] |  | defaults to undefined|
| **type** | [**number**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **answer** | [**string**] |  | defaults to undefined|
| **_options** | [**string**] |  | (optional) defaults to undefined|
| **analysis** | [**string**] |  | (optional) defaults to undefined|
| **score** | [**number**] |  | (optional) defaults to 1|
| **difficulty** | [**number**] |  | (optional) defaults to 1|
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

# **createQuestionApiV1ExamQuestionPost_0**
> any createQuestionApiV1ExamQuestionPost_0()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let paperId: number; // (default to undefined)
let type: number; // (default to undefined)
let content: string; // (default to undefined)
let answer: string; // (default to undefined)
let _options: string; // (optional) (default to undefined)
let analysis: string; // (optional) (default to undefined)
let score: number; // (optional) (default to 1)
let difficulty: number; // (optional) (default to 1)
let sortOrder: number; // (optional) (default to 0)

const { status, data } = await apiInstance.createQuestionApiV1ExamQuestionPost_0(
    paperId,
    type,
    content,
    answer,
    _options,
    analysis,
    score,
    difficulty,
    sortOrder
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **paperId** | [**number**] |  | defaults to undefined|
| **type** | [**number**] |  | defaults to undefined|
| **content** | [**string**] |  | defaults to undefined|
| **answer** | [**string**] |  | defaults to undefined|
| **_options** | [**string**] |  | (optional) defaults to undefined|
| **analysis** | [**string**] |  | (optional) defaults to undefined|
| **score** | [**number**] |  | (optional) defaults to 1|
| **difficulty** | [**number**] |  | (optional) defaults to 1|
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

# **deletePaperApiV1ExamPaperPidDelete**
> any deletePaperApiV1ExamPaperPidDelete()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let pid: number; // (default to undefined)

const { status, data } = await apiInstance.deletePaperApiV1ExamPaperPidDelete(
    pid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|


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

# **deletePaperApiV1ExamPaperPidDelete_0**
> any deletePaperApiV1ExamPaperPidDelete_0()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let pid: number; // (default to undefined)

const { status, data } = await apiInstance.deletePaperApiV1ExamPaperPidDelete_0(
    pid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|


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

# **deleteQuestionApiV1ExamQuestionQidDelete**
> any deleteQuestionApiV1ExamQuestionQidDelete()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let qid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteQuestionApiV1ExamQuestionQidDelete(
    qid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **qid** | [**number**] |  | defaults to undefined|


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

# **deleteQuestionApiV1ExamQuestionQidDelete_0**
> any deleteQuestionApiV1ExamQuestionQidDelete_0()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let qid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteQuestionApiV1ExamQuestionQidDelete_0(
    qid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **qid** | [**number**] |  | defaults to undefined|


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

# **examPaperCategoryList**
> any examPaperCategoryList()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

const { status, data } = await apiInstance.examPaperCategoryList();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **examPaperCategoryList_0**
> any examPaperCategoryList_0()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

const { status, data } = await apiInstance.examPaperCategoryList_0();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getPaperApiV1ExamPaperPidGet**
> any getPaperApiV1ExamPaperPidGet()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let pid: number; // (default to undefined)

const { status, data } = await apiInstance.getPaperApiV1ExamPaperPidGet(
    pid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|


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

# **getPaperApiV1ExamPaperPidGet_0**
> any getPaperApiV1ExamPaperPidGet_0()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let pid: number; // (default to undefined)

const { status, data } = await apiInstance.getPaperApiV1ExamPaperPidGet_0(
    pid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|


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

# **getRecordApiV1ExamRecordRidGet**
> any getRecordApiV1ExamRecordRidGet()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let rid: number; // (default to undefined)

const { status, data } = await apiInstance.getRecordApiV1ExamRecordRidGet(
    rid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **rid** | [**number**] |  | defaults to undefined|


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

# **getRecordApiV1ExamRecordRidGet_0**
> any getRecordApiV1ExamRecordRidGet_0()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let rid: number; // (default to undefined)

const { status, data } = await apiInstance.getRecordApiV1ExamRecordRidGet_0(
    rid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **rid** | [**number**] |  | defaults to undefined|


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

# **listPapersApiV1ExamPaperListGet**
> any listPapersApiV1ExamPaperListGet()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let categoryId: number; // (optional) (default to undefined)
let keyword: string; // (optional) (default to undefined)
let difficulty: number; // (optional) (default to undefined)
let isFree: boolean; // (optional) (default to undefined)

const { status, data } = await apiInstance.listPapersApiV1ExamPaperListGet(
    page,
    limit,
    categoryId,
    keyword,
    difficulty,
    isFree
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **categoryId** | [**number**] |  | (optional) defaults to undefined|
| **keyword** | [**string**] |  | (optional) defaults to undefined|
| **difficulty** | [**number**] |  | (optional) defaults to undefined|
| **isFree** | [**boolean**] |  | (optional) defaults to undefined|


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

# **listPapersApiV1ExamPaperListGet_0**
> any listPapersApiV1ExamPaperListGet_0()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let categoryId: number; // (optional) (default to undefined)
let keyword: string; // (optional) (default to undefined)
let difficulty: number; // (optional) (default to undefined)
let isFree: boolean; // (optional) (default to undefined)

const { status, data } = await apiInstance.listPapersApiV1ExamPaperListGet_0(
    page,
    limit,
    categoryId,
    keyword,
    difficulty,
    isFree
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **categoryId** | [**number**] |  | (optional) defaults to undefined|
| **keyword** | [**string**] |  | (optional) defaults to undefined|
| **difficulty** | [**number**] |  | (optional) defaults to undefined|
| **isFree** | [**boolean**] |  | (optional) defaults to undefined|


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

# **listQuestionsApiV1ExamQuestionListGet**
> any listQuestionsApiV1ExamQuestionListGet()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let paperId: number; // (default to undefined)

const { status, data } = await apiInstance.listQuestionsApiV1ExamQuestionListGet(
    paperId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **paperId** | [**number**] |  | defaults to undefined|


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

# **listQuestionsApiV1ExamQuestionListGet_0**
> any listQuestionsApiV1ExamQuestionListGet_0()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let paperId: number; // (default to undefined)

const { status, data } = await apiInstance.listQuestionsApiV1ExamQuestionListGet_0(
    paperId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **paperId** | [**number**] |  | defaults to undefined|


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

# **listRecordsApiV1ExamRecordListGet**
> any listRecordsApiV1ExamRecordListGet()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let userId: string; // (optional) (default to undefined)
let paperId: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listRecordsApiV1ExamRecordListGet(
    page,
    limit,
    userId,
    paperId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **paperId** | [**number**] |  | (optional) defaults to undefined|


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

# **listRecordsApiV1ExamRecordListGet_0**
> any listRecordsApiV1ExamRecordListGet_0()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let userId: string; // (optional) (default to undefined)
let paperId: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listRecordsApiV1ExamRecordListGet_0(
    page,
    limit,
    userId,
    paperId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **paperId** | [**number**] |  | (optional) defaults to undefined|


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

# **markMasteredApiV1ExamWrongWidMasterPut**
> any markMasteredApiV1ExamWrongWidMasterPut()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let wid: number; // (default to undefined)

const { status, data } = await apiInstance.markMasteredApiV1ExamWrongWidMasterPut(
    wid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **wid** | [**number**] |  | defaults to undefined|


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

# **markMasteredApiV1ExamWrongWidMasterPut_0**
> any markMasteredApiV1ExamWrongWidMasterPut_0()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let wid: number; // (default to undefined)

const { status, data } = await apiInstance.markMasteredApiV1ExamWrongWidMasterPut_0(
    wid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **wid** | [**number**] |  | defaults to undefined|


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

# **startExamApiV1ExamRecordStartPost**
> any startExamApiV1ExamRecordStartPost()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let paperId: number; // (default to undefined)

const { status, data } = await apiInstance.startExamApiV1ExamRecordStartPost(
    paperId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **paperId** | [**number**] |  | defaults to undefined|


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

# **startExamApiV1ExamRecordStartPost_0**
> any startExamApiV1ExamRecordStartPost_0()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let paperId: number; // (default to undefined)

const { status, data } = await apiInstance.startExamApiV1ExamRecordStartPost_0(
    paperId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **paperId** | [**number**] |  | defaults to undefined|


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

# **submitExamApiV1ExamRecordSubmitPost**
> any submitExamApiV1ExamRecordSubmitPost()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let recordId: number; // (default to undefined)
let answers: string; //答案JSON (default to undefined)

const { status, data } = await apiInstance.submitExamApiV1ExamRecordSubmitPost(
    recordId,
    answers
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **recordId** | [**number**] |  | defaults to undefined|
| **answers** | [**string**] | 答案JSON | defaults to undefined|


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

# **submitExamApiV1ExamRecordSubmitPost_0**
> any submitExamApiV1ExamRecordSubmitPost_0()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let recordId: number; // (default to undefined)
let answers: string; //答案JSON (default to undefined)

const { status, data } = await apiInstance.submitExamApiV1ExamRecordSubmitPost_0(
    recordId,
    answers
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **recordId** | [**number**] |  | defaults to undefined|
| **answers** | [**string**] | 答案JSON | defaults to undefined|


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

# **updatePaperApiV1ExamPaperPidPut**
> any updatePaperApiV1ExamPaperPidPut()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let pid: number; // (default to undefined)
let title: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)
let totalScore: number; // (optional) (default to undefined)
let passScore: number; // (optional) (default to undefined)
let duration: number; // (optional) (default to undefined)
let difficulty: number; // (optional) (default to undefined)
let price: number; // (optional) (default to undefined)
let isFree: boolean; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updatePaperApiV1ExamPaperPidPut(
    pid,
    title,
    description,
    totalScore,
    passScore,
    duration,
    difficulty,
    price,
    isFree,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|
| **title** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **totalScore** | [**number**] |  | (optional) defaults to undefined|
| **passScore** | [**number**] |  | (optional) defaults to undefined|
| **duration** | [**number**] |  | (optional) defaults to undefined|
| **difficulty** | [**number**] |  | (optional) defaults to undefined|
| **price** | [**number**] |  | (optional) defaults to undefined|
| **isFree** | [**boolean**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|


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

# **updatePaperApiV1ExamPaperPidPut_0**
> any updatePaperApiV1ExamPaperPidPut_0()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let pid: number; // (default to undefined)
let title: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)
let totalScore: number; // (optional) (default to undefined)
let passScore: number; // (optional) (default to undefined)
let duration: number; // (optional) (default to undefined)
let difficulty: number; // (optional) (default to undefined)
let price: number; // (optional) (default to undefined)
let isFree: boolean; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updatePaperApiV1ExamPaperPidPut_0(
    pid,
    title,
    description,
    totalScore,
    passScore,
    duration,
    difficulty,
    price,
    isFree,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pid** | [**number**] |  | defaults to undefined|
| **title** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **totalScore** | [**number**] |  | (optional) defaults to undefined|
| **passScore** | [**number**] |  | (optional) defaults to undefined|
| **duration** | [**number**] |  | (optional) defaults to undefined|
| **difficulty** | [**number**] |  | (optional) defaults to undefined|
| **price** | [**number**] |  | (optional) defaults to undefined|
| **isFree** | [**boolean**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|


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

# **updateQuestionApiV1ExamQuestionQidPut**
> any updateQuestionApiV1ExamQuestionQidPut()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let qid: number; // (default to undefined)
let content: string; // (optional) (default to undefined)
let _options: string; // (optional) (default to undefined)
let answer: string; // (optional) (default to undefined)
let analysis: string; // (optional) (default to undefined)
let score: number; // (optional) (default to undefined)
let sortOrder: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateQuestionApiV1ExamQuestionQidPut(
    qid,
    content,
    _options,
    answer,
    analysis,
    score,
    sortOrder
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **qid** | [**number**] |  | defaults to undefined|
| **content** | [**string**] |  | (optional) defaults to undefined|
| **_options** | [**string**] |  | (optional) defaults to undefined|
| **answer** | [**string**] |  | (optional) defaults to undefined|
| **analysis** | [**string**] |  | (optional) defaults to undefined|
| **score** | [**number**] |  | (optional) defaults to undefined|
| **sortOrder** | [**number**] |  | (optional) defaults to undefined|


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

# **updateQuestionApiV1ExamQuestionQidPut_0**
> any updateQuestionApiV1ExamQuestionQidPut_0()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let qid: number; // (default to undefined)
let content: string; // (optional) (default to undefined)
let _options: string; // (optional) (default to undefined)
let answer: string; // (optional) (default to undefined)
let analysis: string; // (optional) (default to undefined)
let score: number; // (optional) (default to undefined)
let sortOrder: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateQuestionApiV1ExamQuestionQidPut_0(
    qid,
    content,
    _options,
    answer,
    analysis,
    score,
    sortOrder
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **qid** | [**number**] |  | defaults to undefined|
| **content** | [**string**] |  | (optional) defaults to undefined|
| **_options** | [**string**] |  | (optional) defaults to undefined|
| **answer** | [**string**] |  | (optional) defaults to undefined|
| **analysis** | [**string**] |  | (optional) defaults to undefined|
| **score** | [**number**] |  | (optional) defaults to undefined|
| **sortOrder** | [**number**] |  | (optional) defaults to undefined|


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

# **wrongListApiV1ExamWrongListGet**
> any wrongListApiV1ExamWrongListGet()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let isMastered: boolean; // (optional) (default to undefined)

const { status, data } = await apiInstance.wrongListApiV1ExamWrongListGet(
    page,
    limit,
    isMastered
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **isMastered** | [**boolean**] |  | (optional) defaults to undefined|


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

# **wrongListApiV1ExamWrongListGet_0**
> any wrongListApiV1ExamWrongListGet_0()


### Example

```typescript
import {
    ExamApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExamApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let isMastered: boolean; // (optional) (default to undefined)

const { status, data } = await apiInstance.wrongListApiV1ExamWrongListGet_0(
    page,
    limit,
    isMastered
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **isMastered** | [**boolean**] |  | (optional) defaults to undefined|


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

