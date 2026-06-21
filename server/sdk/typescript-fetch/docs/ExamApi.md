# ExamApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createPaperApiV1ExamPaperPost**](ExamApi.md#createpaperapiv1exampaperpost) | **POST** /api/v1/exam/paper | 创建试卷 |
| [**createPaperApiV1ExamPaperPost_0**](ExamApi.md#createpaperapiv1exampaperpost_0) | **POST** /api/v1/exam/paper | 创建试卷 |
| [**createQuestionApiV1ExamQuestionPost**](ExamApi.md#createquestionapiv1examquestionpost) | **POST** /api/v1/exam/question | 新增题目 |
| [**createQuestionApiV1ExamQuestionPost_0**](ExamApi.md#createquestionapiv1examquestionpost_0) | **POST** /api/v1/exam/question | 新增题目 |
| [**deletePaperApiV1ExamPaperPidDelete**](ExamApi.md#deletepaperapiv1exampaperpiddelete) | **DELETE** /api/v1/exam/paper/{pid} | 删除试卷 |
| [**deletePaperApiV1ExamPaperPidDelete_0**](ExamApi.md#deletepaperapiv1exampaperpiddelete_0) | **DELETE** /api/v1/exam/paper/{pid} | 删除试卷 |
| [**deleteQuestionApiV1ExamQuestionQidDelete**](ExamApi.md#deletequestionapiv1examquestionqiddelete) | **DELETE** /api/v1/exam/question/{qid} | 删除题目 |
| [**deleteQuestionApiV1ExamQuestionQidDelete_0**](ExamApi.md#deletequestionapiv1examquestionqiddelete_0) | **DELETE** /api/v1/exam/question/{qid} | 删除题目 |
| [**examPaperCategoryList**](ExamApi.md#exampapercategorylist) | **GET** /api/v1/exam/category/list | 考试分类列表 |
| [**examPaperCategoryList_0**](ExamApi.md#exampapercategorylist_0) | **GET** /api/v1/exam/category/list | 考试分类列表 |
| [**getPaperApiV1ExamPaperPidGet**](ExamApi.md#getpaperapiv1exampaperpidget) | **GET** /api/v1/exam/paper/{pid} | 试卷详情 |
| [**getPaperApiV1ExamPaperPidGet_0**](ExamApi.md#getpaperapiv1exampaperpidget_0) | **GET** /api/v1/exam/paper/{pid} | 试卷详情 |
| [**getRecordApiV1ExamRecordRidGet**](ExamApi.md#getrecordapiv1examrecordridget) | **GET** /api/v1/exam/record/{rid} | 考试记录详情 |
| [**getRecordApiV1ExamRecordRidGet_0**](ExamApi.md#getrecordapiv1examrecordridget_0) | **GET** /api/v1/exam/record/{rid} | 考试记录详情 |
| [**listPapersApiV1ExamPaperListGet**](ExamApi.md#listpapersapiv1exampaperlistget) | **GET** /api/v1/exam/paper/list | 试卷列表 |
| [**listPapersApiV1ExamPaperListGet_0**](ExamApi.md#listpapersapiv1exampaperlistget_0) | **GET** /api/v1/exam/paper/list | 试卷列表 |
| [**listQuestionsApiV1ExamQuestionListGet**](ExamApi.md#listquestionsapiv1examquestionlistget) | **GET** /api/v1/exam/question/list | 题目列表 |
| [**listQuestionsApiV1ExamQuestionListGet_0**](ExamApi.md#listquestionsapiv1examquestionlistget_0) | **GET** /api/v1/exam/question/list | 题目列表 |
| [**listRecordsApiV1ExamRecordListGet**](ExamApi.md#listrecordsapiv1examrecordlistget) | **GET** /api/v1/exam/record/list | 考试记录列表 |
| [**listRecordsApiV1ExamRecordListGet_0**](ExamApi.md#listrecordsapiv1examrecordlistget_0) | **GET** /api/v1/exam/record/list | 考试记录列表 |
| [**markMasteredApiV1ExamWrongWidMasterPut**](ExamApi.md#markmasteredapiv1examwrongwidmasterput) | **PUT** /api/v1/exam/wrong/{wid}/master | 标记错题为已掌握 |
| [**markMasteredApiV1ExamWrongWidMasterPut_0**](ExamApi.md#markmasteredapiv1examwrongwidmasterput_0) | **PUT** /api/v1/exam/wrong/{wid}/master | 标记错题为已掌握 |
| [**startExamApiV1ExamRecordStartPost**](ExamApi.md#startexamapiv1examrecordstartpost) | **POST** /api/v1/exam/record/start | 开始考试 |
| [**startExamApiV1ExamRecordStartPost_0**](ExamApi.md#startexamapiv1examrecordstartpost_0) | **POST** /api/v1/exam/record/start | 开始考试 |
| [**submitExamApiV1ExamRecordSubmitPost**](ExamApi.md#submitexamapiv1examrecordsubmitpost) | **POST** /api/v1/exam/record/submit | 提交答卷 |
| [**submitExamApiV1ExamRecordSubmitPost_0**](ExamApi.md#submitexamapiv1examrecordsubmitpost_0) | **POST** /api/v1/exam/record/submit | 提交答卷 |
| [**updatePaperApiV1ExamPaperPidPut**](ExamApi.md#updatepaperapiv1exampaperpidput) | **PUT** /api/v1/exam/paper/{pid} | 修改试卷 |
| [**updatePaperApiV1ExamPaperPidPut_0**](ExamApi.md#updatepaperapiv1exampaperpidput_0) | **PUT** /api/v1/exam/paper/{pid} | 修改试卷 |
| [**updateQuestionApiV1ExamQuestionQidPut**](ExamApi.md#updatequestionapiv1examquestionqidput) | **PUT** /api/v1/exam/question/{qid} | 修改题目 |
| [**updateQuestionApiV1ExamQuestionQidPut_0**](ExamApi.md#updatequestionapiv1examquestionqidput_0) | **PUT** /api/v1/exam/question/{qid} | 修改题目 |
| [**wrongListApiV1ExamWrongListGet**](ExamApi.md#wronglistapiv1examwronglistget) | **GET** /api/v1/exam/wrong/list | 错题本 |
| [**wrongListApiV1ExamWrongListGet_0**](ExamApi.md#wronglistapiv1examwronglistget_0) | **GET** /api/v1/exam/wrong/list | 错题本 |



## createPaperApiV1ExamPaperPost

> any createPaperApiV1ExamPaperPost(title, description, categoryId, courseId, cover, totalScore, passScore, duration, type, difficulty, isFree, price)

创建试卷

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { CreatePaperApiV1ExamPaperPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // string
    title: title_example,
    // string (optional)
    description: description_example,
    // number (optional)
    categoryId: 56,
    // number (optional)
    courseId: 56,
    // string (optional)
    cover: cover_example,
    // number (optional)
    totalScore: 8.14,
    // number (optional)
    passScore: 8.14,
    // number (optional)
    duration: 56,
    // number (optional)
    type: 56,
    // number (optional)
    difficulty: 56,
    // boolean (optional)
    isFree: true,
    // number (optional)
    price: 8.14,
  } satisfies CreatePaperApiV1ExamPaperPostRequest;

  try {
    const data = await api.createPaperApiV1ExamPaperPost(body);
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
| **title** | `string` |  | [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **categoryId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **courseId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **cover** | `string` |  | [Optional] [Defaults to `undefined`] |
| **totalScore** | `number` |  | [Optional] [Defaults to `100`] |
| **passScore** | `number` |  | [Optional] [Defaults to `60`] |
| **duration** | `number` |  | [Optional] [Defaults to `60`] |
| **type** | `number` |  | [Optional] [Defaults to `1`] |
| **difficulty** | `number` |  | [Optional] [Defaults to `1`] |
| **isFree** | `boolean` |  | [Optional] [Defaults to `true`] |
| **price** | `number` |  | [Optional] [Defaults to `0`] |

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


## createPaperApiV1ExamPaperPost_0

> any createPaperApiV1ExamPaperPost_0(title, description, categoryId, courseId, cover, totalScore, passScore, duration, type, difficulty, isFree, price)

创建试卷

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { CreatePaperApiV1ExamPaperPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // string
    title: title_example,
    // string (optional)
    description: description_example,
    // number (optional)
    categoryId: 56,
    // number (optional)
    courseId: 56,
    // string (optional)
    cover: cover_example,
    // number (optional)
    totalScore: 8.14,
    // number (optional)
    passScore: 8.14,
    // number (optional)
    duration: 56,
    // number (optional)
    type: 56,
    // number (optional)
    difficulty: 56,
    // boolean (optional)
    isFree: true,
    // number (optional)
    price: 8.14,
  } satisfies CreatePaperApiV1ExamPaperPost0Request;

  try {
    const data = await api.createPaperApiV1ExamPaperPost_0(body);
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
| **title** | `string` |  | [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **categoryId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **courseId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **cover** | `string` |  | [Optional] [Defaults to `undefined`] |
| **totalScore** | `number` |  | [Optional] [Defaults to `100`] |
| **passScore** | `number` |  | [Optional] [Defaults to `60`] |
| **duration** | `number` |  | [Optional] [Defaults to `60`] |
| **type** | `number` |  | [Optional] [Defaults to `1`] |
| **difficulty** | `number` |  | [Optional] [Defaults to `1`] |
| **isFree** | `boolean` |  | [Optional] [Defaults to `true`] |
| **price** | `number` |  | [Optional] [Defaults to `0`] |

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


## createQuestionApiV1ExamQuestionPost

> any createQuestionApiV1ExamQuestionPost(paperId, type, content, answer, options, analysis, score, difficulty, sortOrder)

新增题目

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { CreateQuestionApiV1ExamQuestionPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    paperId: 56,
    // number
    type: 56,
    // string
    content: content_example,
    // string
    answer: answer_example,
    // string (optional)
    options: options_example,
    // string (optional)
    analysis: analysis_example,
    // number (optional)
    score: 8.14,
    // number (optional)
    difficulty: 56,
    // number (optional)
    sortOrder: 56,
  } satisfies CreateQuestionApiV1ExamQuestionPostRequest;

  try {
    const data = await api.createQuestionApiV1ExamQuestionPost(body);
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
| **paperId** | `number` |  | [Defaults to `undefined`] |
| **type** | `number` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Defaults to `undefined`] |
| **answer** | `string` |  | [Defaults to `undefined`] |
| **options** | `string` |  | [Optional] [Defaults to `undefined`] |
| **analysis** | `string` |  | [Optional] [Defaults to `undefined`] |
| **score** | `number` |  | [Optional] [Defaults to `1`] |
| **difficulty** | `number` |  | [Optional] [Defaults to `1`] |
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


## createQuestionApiV1ExamQuestionPost_0

> any createQuestionApiV1ExamQuestionPost_0(paperId, type, content, answer, options, analysis, score, difficulty, sortOrder)

新增题目

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { CreateQuestionApiV1ExamQuestionPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    paperId: 56,
    // number
    type: 56,
    // string
    content: content_example,
    // string
    answer: answer_example,
    // string (optional)
    options: options_example,
    // string (optional)
    analysis: analysis_example,
    // number (optional)
    score: 8.14,
    // number (optional)
    difficulty: 56,
    // number (optional)
    sortOrder: 56,
  } satisfies CreateQuestionApiV1ExamQuestionPost0Request;

  try {
    const data = await api.createQuestionApiV1ExamQuestionPost_0(body);
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
| **paperId** | `number` |  | [Defaults to `undefined`] |
| **type** | `number` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Defaults to `undefined`] |
| **answer** | `string` |  | [Defaults to `undefined`] |
| **options** | `string` |  | [Optional] [Defaults to `undefined`] |
| **analysis** | `string` |  | [Optional] [Defaults to `undefined`] |
| **score** | `number` |  | [Optional] [Defaults to `1`] |
| **difficulty** | `number` |  | [Optional] [Defaults to `1`] |
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


## deletePaperApiV1ExamPaperPidDelete

> any deletePaperApiV1ExamPaperPidDelete(pid)

删除试卷

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { DeletePaperApiV1ExamPaperPidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    pid: 56,
  } satisfies DeletePaperApiV1ExamPaperPidDeleteRequest;

  try {
    const data = await api.deletePaperApiV1ExamPaperPidDelete(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |

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


## deletePaperApiV1ExamPaperPidDelete_0

> any deletePaperApiV1ExamPaperPidDelete_0(pid)

删除试卷

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { DeletePaperApiV1ExamPaperPidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    pid: 56,
  } satisfies DeletePaperApiV1ExamPaperPidDelete0Request;

  try {
    const data = await api.deletePaperApiV1ExamPaperPidDelete_0(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |

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


## deleteQuestionApiV1ExamQuestionQidDelete

> any deleteQuestionApiV1ExamQuestionQidDelete(qid)

删除题目

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { DeleteQuestionApiV1ExamQuestionQidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    qid: 56,
  } satisfies DeleteQuestionApiV1ExamQuestionQidDeleteRequest;

  try {
    const data = await api.deleteQuestionApiV1ExamQuestionQidDelete(body);
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
| **qid** | `number` |  | [Defaults to `undefined`] |

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


## deleteQuestionApiV1ExamQuestionQidDelete_0

> any deleteQuestionApiV1ExamQuestionQidDelete_0(qid)

删除题目

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { DeleteQuestionApiV1ExamQuestionQidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    qid: 56,
  } satisfies DeleteQuestionApiV1ExamQuestionQidDelete0Request;

  try {
    const data = await api.deleteQuestionApiV1ExamQuestionQidDelete_0(body);
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
| **qid** | `number` |  | [Defaults to `undefined`] |

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


## examPaperCategoryList

> any examPaperCategoryList()

考试分类列表

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { ExamPaperCategoryListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  try {
    const data = await api.examPaperCategoryList();
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


## examPaperCategoryList_0

> any examPaperCategoryList_0()

考试分类列表

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { ExamPaperCategoryList0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  try {
    const data = await api.examPaperCategoryList_0();
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


## getPaperApiV1ExamPaperPidGet

> any getPaperApiV1ExamPaperPidGet(pid)

试卷详情

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { GetPaperApiV1ExamPaperPidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    pid: 56,
  } satisfies GetPaperApiV1ExamPaperPidGetRequest;

  try {
    const data = await api.getPaperApiV1ExamPaperPidGet(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |

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


## getPaperApiV1ExamPaperPidGet_0

> any getPaperApiV1ExamPaperPidGet_0(pid)

试卷详情

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { GetPaperApiV1ExamPaperPidGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    pid: 56,
  } satisfies GetPaperApiV1ExamPaperPidGet0Request;

  try {
    const data = await api.getPaperApiV1ExamPaperPidGet_0(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |

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


## getRecordApiV1ExamRecordRidGet

> any getRecordApiV1ExamRecordRidGet(rid)

考试记录详情

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { GetRecordApiV1ExamRecordRidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    rid: 56,
  } satisfies GetRecordApiV1ExamRecordRidGetRequest;

  try {
    const data = await api.getRecordApiV1ExamRecordRidGet(body);
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
| **rid** | `number` |  | [Defaults to `undefined`] |

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


## getRecordApiV1ExamRecordRidGet_0

> any getRecordApiV1ExamRecordRidGet_0(rid)

考试记录详情

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { GetRecordApiV1ExamRecordRidGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    rid: 56,
  } satisfies GetRecordApiV1ExamRecordRidGet0Request;

  try {
    const data = await api.getRecordApiV1ExamRecordRidGet_0(body);
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
| **rid** | `number` |  | [Defaults to `undefined`] |

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


## listPapersApiV1ExamPaperListGet

> any listPapersApiV1ExamPaperListGet(page, limit, categoryId, keyword, difficulty, isFree)

试卷列表

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { ListPapersApiV1ExamPaperListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    categoryId: 56,
    // string (optional)
    keyword: keyword_example,
    // number (optional)
    difficulty: 56,
    // boolean (optional)
    isFree: true,
  } satisfies ListPapersApiV1ExamPaperListGetRequest;

  try {
    const data = await api.listPapersApiV1ExamPaperListGet(body);
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
| **difficulty** | `number` |  | [Optional] [Defaults to `undefined`] |
| **isFree** | `boolean` |  | [Optional] [Defaults to `undefined`] |

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


## listPapersApiV1ExamPaperListGet_0

> any listPapersApiV1ExamPaperListGet_0(page, limit, categoryId, keyword, difficulty, isFree)

试卷列表

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { ListPapersApiV1ExamPaperListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    categoryId: 56,
    // string (optional)
    keyword: keyword_example,
    // number (optional)
    difficulty: 56,
    // boolean (optional)
    isFree: true,
  } satisfies ListPapersApiV1ExamPaperListGet0Request;

  try {
    const data = await api.listPapersApiV1ExamPaperListGet_0(body);
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
| **difficulty** | `number` |  | [Optional] [Defaults to `undefined`] |
| **isFree** | `boolean` |  | [Optional] [Defaults to `undefined`] |

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


## listQuestionsApiV1ExamQuestionListGet

> any listQuestionsApiV1ExamQuestionListGet(paperId)

题目列表

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { ListQuestionsApiV1ExamQuestionListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    paperId: 56,
  } satisfies ListQuestionsApiV1ExamQuestionListGetRequest;

  try {
    const data = await api.listQuestionsApiV1ExamQuestionListGet(body);
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
| **paperId** | `number` |  | [Defaults to `undefined`] |

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


## listQuestionsApiV1ExamQuestionListGet_0

> any listQuestionsApiV1ExamQuestionListGet_0(paperId)

题目列表

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { ListQuestionsApiV1ExamQuestionListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    paperId: 56,
  } satisfies ListQuestionsApiV1ExamQuestionListGet0Request;

  try {
    const data = await api.listQuestionsApiV1ExamQuestionListGet_0(body);
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
| **paperId** | `number` |  | [Defaults to `undefined`] |

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


## listRecordsApiV1ExamRecordListGet

> any listRecordsApiV1ExamRecordListGet(page, limit, userId, paperId)

考试记录列表

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { ListRecordsApiV1ExamRecordListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    userId: userId_example,
    // number (optional)
    paperId: 56,
  } satisfies ListRecordsApiV1ExamRecordListGetRequest;

  try {
    const data = await api.listRecordsApiV1ExamRecordListGet(body);
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
| **paperId** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## listRecordsApiV1ExamRecordListGet_0

> any listRecordsApiV1ExamRecordListGet_0(page, limit, userId, paperId)

考试记录列表

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { ListRecordsApiV1ExamRecordListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    userId: userId_example,
    // number (optional)
    paperId: 56,
  } satisfies ListRecordsApiV1ExamRecordListGet0Request;

  try {
    const data = await api.listRecordsApiV1ExamRecordListGet_0(body);
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
| **paperId** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## markMasteredApiV1ExamWrongWidMasterPut

> any markMasteredApiV1ExamWrongWidMasterPut(wid)

标记错题为已掌握

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { MarkMasteredApiV1ExamWrongWidMasterPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    wid: 56,
  } satisfies MarkMasteredApiV1ExamWrongWidMasterPutRequest;

  try {
    const data = await api.markMasteredApiV1ExamWrongWidMasterPut(body);
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
| **wid** | `number` |  | [Defaults to `undefined`] |

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


## markMasteredApiV1ExamWrongWidMasterPut_0

> any markMasteredApiV1ExamWrongWidMasterPut_0(wid)

标记错题为已掌握

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { MarkMasteredApiV1ExamWrongWidMasterPut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    wid: 56,
  } satisfies MarkMasteredApiV1ExamWrongWidMasterPut0Request;

  try {
    const data = await api.markMasteredApiV1ExamWrongWidMasterPut_0(body);
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
| **wid** | `number` |  | [Defaults to `undefined`] |

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


## startExamApiV1ExamRecordStartPost

> any startExamApiV1ExamRecordStartPost(paperId)

开始考试

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { StartExamApiV1ExamRecordStartPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    paperId: 56,
  } satisfies StartExamApiV1ExamRecordStartPostRequest;

  try {
    const data = await api.startExamApiV1ExamRecordStartPost(body);
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
| **paperId** | `number` |  | [Defaults to `undefined`] |

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


## startExamApiV1ExamRecordStartPost_0

> any startExamApiV1ExamRecordStartPost_0(paperId)

开始考试

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { StartExamApiV1ExamRecordStartPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    paperId: 56,
  } satisfies StartExamApiV1ExamRecordStartPost0Request;

  try {
    const data = await api.startExamApiV1ExamRecordStartPost_0(body);
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
| **paperId** | `number` |  | [Defaults to `undefined`] |

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


## submitExamApiV1ExamRecordSubmitPost

> any submitExamApiV1ExamRecordSubmitPost(recordId, answers)

提交答卷

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { SubmitExamApiV1ExamRecordSubmitPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    recordId: 56,
    // string | 答案JSON
    answers: answers_example,
  } satisfies SubmitExamApiV1ExamRecordSubmitPostRequest;

  try {
    const data = await api.submitExamApiV1ExamRecordSubmitPost(body);
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
| **recordId** | `number` |  | [Defaults to `undefined`] |
| **answers** | `string` | 答案JSON | [Defaults to `undefined`] |

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


## submitExamApiV1ExamRecordSubmitPost_0

> any submitExamApiV1ExamRecordSubmitPost_0(recordId, answers)

提交答卷

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { SubmitExamApiV1ExamRecordSubmitPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    recordId: 56,
    // string | 答案JSON
    answers: answers_example,
  } satisfies SubmitExamApiV1ExamRecordSubmitPost0Request;

  try {
    const data = await api.submitExamApiV1ExamRecordSubmitPost_0(body);
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
| **recordId** | `number` |  | [Defaults to `undefined`] |
| **answers** | `string` | 答案JSON | [Defaults to `undefined`] |

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


## updatePaperApiV1ExamPaperPidPut

> any updatePaperApiV1ExamPaperPidPut(pid, title, description, totalScore, passScore, duration, difficulty, price, isFree, status)

修改试卷

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { UpdatePaperApiV1ExamPaperPidPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    pid: 56,
    // string (optional)
    title: title_example,
    // string (optional)
    description: description_example,
    // number (optional)
    totalScore: 8.14,
    // number (optional)
    passScore: 8.14,
    // number (optional)
    duration: 56,
    // number (optional)
    difficulty: 56,
    // number (optional)
    price: 8.14,
    // boolean (optional)
    isFree: true,
    // number (optional)
    status: 56,
  } satisfies UpdatePaperApiV1ExamPaperPidPutRequest;

  try {
    const data = await api.updatePaperApiV1ExamPaperPidPut(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **totalScore** | `number` |  | [Optional] [Defaults to `undefined`] |
| **passScore** | `number` |  | [Optional] [Defaults to `undefined`] |
| **duration** | `number` |  | [Optional] [Defaults to `undefined`] |
| **difficulty** | `number` |  | [Optional] [Defaults to `undefined`] |
| **price** | `number` |  | [Optional] [Defaults to `undefined`] |
| **isFree** | `boolean` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## updatePaperApiV1ExamPaperPidPut_0

> any updatePaperApiV1ExamPaperPidPut_0(pid, title, description, totalScore, passScore, duration, difficulty, price, isFree, status)

修改试卷

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { UpdatePaperApiV1ExamPaperPidPut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    pid: 56,
    // string (optional)
    title: title_example,
    // string (optional)
    description: description_example,
    // number (optional)
    totalScore: 8.14,
    // number (optional)
    passScore: 8.14,
    // number (optional)
    duration: 56,
    // number (optional)
    difficulty: 56,
    // number (optional)
    price: 8.14,
    // boolean (optional)
    isFree: true,
    // number (optional)
    status: 56,
  } satisfies UpdatePaperApiV1ExamPaperPidPut0Request;

  try {
    const data = await api.updatePaperApiV1ExamPaperPidPut_0(body);
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
| **pid** | `number` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |
| **totalScore** | `number` |  | [Optional] [Defaults to `undefined`] |
| **passScore** | `number` |  | [Optional] [Defaults to `undefined`] |
| **duration** | `number` |  | [Optional] [Defaults to `undefined`] |
| **difficulty** | `number` |  | [Optional] [Defaults to `undefined`] |
| **price** | `number` |  | [Optional] [Defaults to `undefined`] |
| **isFree** | `boolean` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## updateQuestionApiV1ExamQuestionQidPut

> any updateQuestionApiV1ExamQuestionQidPut(qid, content, options, answer, analysis, score, sortOrder)

修改题目

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { UpdateQuestionApiV1ExamQuestionQidPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    qid: 56,
    // string (optional)
    content: content_example,
    // string (optional)
    options: options_example,
    // string (optional)
    answer: answer_example,
    // string (optional)
    analysis: analysis_example,
    // number (optional)
    score: 8.14,
    // number (optional)
    sortOrder: 56,
  } satisfies UpdateQuestionApiV1ExamQuestionQidPutRequest;

  try {
    const data = await api.updateQuestionApiV1ExamQuestionQidPut(body);
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
| **qid** | `number` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Optional] [Defaults to `undefined`] |
| **options** | `string` |  | [Optional] [Defaults to `undefined`] |
| **answer** | `string` |  | [Optional] [Defaults to `undefined`] |
| **analysis** | `string` |  | [Optional] [Defaults to `undefined`] |
| **score** | `number` |  | [Optional] [Defaults to `undefined`] |
| **sortOrder** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## updateQuestionApiV1ExamQuestionQidPut_0

> any updateQuestionApiV1ExamQuestionQidPut_0(qid, content, options, answer, analysis, score, sortOrder)

修改题目

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { UpdateQuestionApiV1ExamQuestionQidPut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number
    qid: 56,
    // string (optional)
    content: content_example,
    // string (optional)
    options: options_example,
    // string (optional)
    answer: answer_example,
    // string (optional)
    analysis: analysis_example,
    // number (optional)
    score: 8.14,
    // number (optional)
    sortOrder: 56,
  } satisfies UpdateQuestionApiV1ExamQuestionQidPut0Request;

  try {
    const data = await api.updateQuestionApiV1ExamQuestionQidPut_0(body);
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
| **qid** | `number` |  | [Defaults to `undefined`] |
| **content** | `string` |  | [Optional] [Defaults to `undefined`] |
| **options** | `string` |  | [Optional] [Defaults to `undefined`] |
| **answer** | `string` |  | [Optional] [Defaults to `undefined`] |
| **analysis** | `string` |  | [Optional] [Defaults to `undefined`] |
| **score** | `number` |  | [Optional] [Defaults to `undefined`] |
| **sortOrder** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## wrongListApiV1ExamWrongListGet

> any wrongListApiV1ExamWrongListGet(page, limit, isMastered)

错题本

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { WrongListApiV1ExamWrongListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // boolean (optional)
    isMastered: true,
  } satisfies WrongListApiV1ExamWrongListGetRequest;

  try {
    const data = await api.wrongListApiV1ExamWrongListGet(body);
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
| **isMastered** | `boolean` |  | [Optional] [Defaults to `undefined`] |

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


## wrongListApiV1ExamWrongListGet_0

> any wrongListApiV1ExamWrongListGet_0(page, limit, isMastered)

错题本

### Example

```ts
import {
  Configuration,
  ExamApi,
} from '';
import type { WrongListApiV1ExamWrongListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExamApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // boolean (optional)
    isMastered: true,
  } satisfies WrongListApiV1ExamWrongListGet0Request;

  try {
    const data = await api.wrongListApiV1ExamWrongListGet_0(body);
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
| **isMastered** | `boolean` |  | [Optional] [Defaults to `undefined`] |

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

