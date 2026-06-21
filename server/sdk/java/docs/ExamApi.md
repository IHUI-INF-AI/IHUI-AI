# ExamApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createPaperApiV1ExamPaperPost**](ExamApi.md#createPaperApiV1ExamPaperPost) | **POST** /api/v1/exam/paper | 创建试卷 |
| [**createPaperApiV1ExamPaperPost_0**](ExamApi.md#createPaperApiV1ExamPaperPost_0) | **POST** /api/v1/exam/paper | 创建试卷 |
| [**createQuestionApiV1ExamQuestionPost**](ExamApi.md#createQuestionApiV1ExamQuestionPost) | **POST** /api/v1/exam/question | 新增题目 |
| [**createQuestionApiV1ExamQuestionPost_0**](ExamApi.md#createQuestionApiV1ExamQuestionPost_0) | **POST** /api/v1/exam/question | 新增题目 |
| [**deletePaperApiV1ExamPaperPidDelete**](ExamApi.md#deletePaperApiV1ExamPaperPidDelete) | **DELETE** /api/v1/exam/paper/{pid} | 删除试卷 |
| [**deletePaperApiV1ExamPaperPidDelete_0**](ExamApi.md#deletePaperApiV1ExamPaperPidDelete_0) | **DELETE** /api/v1/exam/paper/{pid} | 删除试卷 |
| [**deleteQuestionApiV1ExamQuestionQidDelete**](ExamApi.md#deleteQuestionApiV1ExamQuestionQidDelete) | **DELETE** /api/v1/exam/question/{qid} | 删除题目 |
| [**deleteQuestionApiV1ExamQuestionQidDelete_0**](ExamApi.md#deleteQuestionApiV1ExamQuestionQidDelete_0) | **DELETE** /api/v1/exam/question/{qid} | 删除题目 |
| [**examPaperCategoryList**](ExamApi.md#examPaperCategoryList) | **GET** /api/v1/exam/category/list | 考试分类列表 |
| [**examPaperCategoryList_0**](ExamApi.md#examPaperCategoryList_0) | **GET** /api/v1/exam/category/list | 考试分类列表 |
| [**getPaperApiV1ExamPaperPidGet**](ExamApi.md#getPaperApiV1ExamPaperPidGet) | **GET** /api/v1/exam/paper/{pid} | 试卷详情 |
| [**getPaperApiV1ExamPaperPidGet_0**](ExamApi.md#getPaperApiV1ExamPaperPidGet_0) | **GET** /api/v1/exam/paper/{pid} | 试卷详情 |
| [**getRecordApiV1ExamRecordRidGet**](ExamApi.md#getRecordApiV1ExamRecordRidGet) | **GET** /api/v1/exam/record/{rid} | 考试记录详情 |
| [**getRecordApiV1ExamRecordRidGet_0**](ExamApi.md#getRecordApiV1ExamRecordRidGet_0) | **GET** /api/v1/exam/record/{rid} | 考试记录详情 |
| [**listPapersApiV1ExamPaperListGet**](ExamApi.md#listPapersApiV1ExamPaperListGet) | **GET** /api/v1/exam/paper/list | 试卷列表 |
| [**listPapersApiV1ExamPaperListGet_0**](ExamApi.md#listPapersApiV1ExamPaperListGet_0) | **GET** /api/v1/exam/paper/list | 试卷列表 |
| [**listQuestionsApiV1ExamQuestionListGet**](ExamApi.md#listQuestionsApiV1ExamQuestionListGet) | **GET** /api/v1/exam/question/list | 题目列表 |
| [**listQuestionsApiV1ExamQuestionListGet_0**](ExamApi.md#listQuestionsApiV1ExamQuestionListGet_0) | **GET** /api/v1/exam/question/list | 题目列表 |
| [**listRecordsApiV1ExamRecordListGet**](ExamApi.md#listRecordsApiV1ExamRecordListGet) | **GET** /api/v1/exam/record/list | 考试记录列表 |
| [**listRecordsApiV1ExamRecordListGet_0**](ExamApi.md#listRecordsApiV1ExamRecordListGet_0) | **GET** /api/v1/exam/record/list | 考试记录列表 |
| [**markMasteredApiV1ExamWrongWidMasterPut**](ExamApi.md#markMasteredApiV1ExamWrongWidMasterPut) | **PUT** /api/v1/exam/wrong/{wid}/master | 标记错题为已掌握 |
| [**markMasteredApiV1ExamWrongWidMasterPut_0**](ExamApi.md#markMasteredApiV1ExamWrongWidMasterPut_0) | **PUT** /api/v1/exam/wrong/{wid}/master | 标记错题为已掌握 |
| [**startExamApiV1ExamRecordStartPost**](ExamApi.md#startExamApiV1ExamRecordStartPost) | **POST** /api/v1/exam/record/start | 开始考试 |
| [**startExamApiV1ExamRecordStartPost_0**](ExamApi.md#startExamApiV1ExamRecordStartPost_0) | **POST** /api/v1/exam/record/start | 开始考试 |
| [**submitExamApiV1ExamRecordSubmitPost**](ExamApi.md#submitExamApiV1ExamRecordSubmitPost) | **POST** /api/v1/exam/record/submit | 提交答卷 |
| [**submitExamApiV1ExamRecordSubmitPost_0**](ExamApi.md#submitExamApiV1ExamRecordSubmitPost_0) | **POST** /api/v1/exam/record/submit | 提交答卷 |
| [**updatePaperApiV1ExamPaperPidPut**](ExamApi.md#updatePaperApiV1ExamPaperPidPut) | **PUT** /api/v1/exam/paper/{pid} | 修改试卷 |
| [**updatePaperApiV1ExamPaperPidPut_0**](ExamApi.md#updatePaperApiV1ExamPaperPidPut_0) | **PUT** /api/v1/exam/paper/{pid} | 修改试卷 |
| [**updateQuestionApiV1ExamQuestionQidPut**](ExamApi.md#updateQuestionApiV1ExamQuestionQidPut) | **PUT** /api/v1/exam/question/{qid} | 修改题目 |
| [**updateQuestionApiV1ExamQuestionQidPut_0**](ExamApi.md#updateQuestionApiV1ExamQuestionQidPut_0) | **PUT** /api/v1/exam/question/{qid} | 修改题目 |
| [**wrongListApiV1ExamWrongListGet**](ExamApi.md#wrongListApiV1ExamWrongListGet) | **GET** /api/v1/exam/wrong/list | 错题本 |
| [**wrongListApiV1ExamWrongListGet_0**](ExamApi.md#wrongListApiV1ExamWrongListGet_0) | **GET** /api/v1/exam/wrong/list | 错题本 |


<a id="createPaperApiV1ExamPaperPost"></a>
# **createPaperApiV1ExamPaperPost**
> Object createPaperApiV1ExamPaperPost(title, description, categoryId, courseId, cover, totalScore, passScore, duration, type, difficulty, isFree, price)

创建试卷

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    String title = "title_example"; // String | 
    String description = "description_example"; // String | 
    Integer categoryId = 56; // Integer | 
    Integer courseId = 56; // Integer | 
    String cover = "cover_example"; // String | 
    BigDecimal totalScore = new BigDecimal("100"); // BigDecimal | 
    BigDecimal passScore = new BigDecimal("60"); // BigDecimal | 
    Integer duration = 60; // Integer | 
    Integer type = 1; // Integer | 
    Integer difficulty = 1; // Integer | 
    Boolean isFree = true; // Boolean | 
    BigDecimal price = new BigDecimal("0"); // BigDecimal | 
    try {
      Object result = apiInstance.createPaperApiV1ExamPaperPost(title, description, categoryId, courseId, cover, totalScore, passScore, duration, type, difficulty, isFree, price);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#createPaperApiV1ExamPaperPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **title** | **String**|  | |
| **description** | **String**|  | [optional] |
| **categoryId** | **Integer**|  | [optional] |
| **courseId** | **Integer**|  | [optional] |
| **cover** | **String**|  | [optional] |
| **totalScore** | **BigDecimal**|  | [optional] [default to 100] |
| **passScore** | **BigDecimal**|  | [optional] [default to 60] |
| **duration** | **Integer**|  | [optional] [default to 60] |
| **type** | **Integer**|  | [optional] [default to 1] |
| **difficulty** | **Integer**|  | [optional] [default to 1] |
| **isFree** | **Boolean**|  | [optional] [default to true] |
| **price** | **BigDecimal**|  | [optional] [default to 0] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createPaperApiV1ExamPaperPost_0"></a>
# **createPaperApiV1ExamPaperPost_0**
> Object createPaperApiV1ExamPaperPost_0(title, description, categoryId, courseId, cover, totalScore, passScore, duration, type, difficulty, isFree, price)

创建试卷

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    String title = "title_example"; // String | 
    String description = "description_example"; // String | 
    Integer categoryId = 56; // Integer | 
    Integer courseId = 56; // Integer | 
    String cover = "cover_example"; // String | 
    BigDecimal totalScore = new BigDecimal("100"); // BigDecimal | 
    BigDecimal passScore = new BigDecimal("60"); // BigDecimal | 
    Integer duration = 60; // Integer | 
    Integer type = 1; // Integer | 
    Integer difficulty = 1; // Integer | 
    Boolean isFree = true; // Boolean | 
    BigDecimal price = new BigDecimal("0"); // BigDecimal | 
    try {
      Object result = apiInstance.createPaperApiV1ExamPaperPost_0(title, description, categoryId, courseId, cover, totalScore, passScore, duration, type, difficulty, isFree, price);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#createPaperApiV1ExamPaperPost_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **title** | **String**|  | |
| **description** | **String**|  | [optional] |
| **categoryId** | **Integer**|  | [optional] |
| **courseId** | **Integer**|  | [optional] |
| **cover** | **String**|  | [optional] |
| **totalScore** | **BigDecimal**|  | [optional] [default to 100] |
| **passScore** | **BigDecimal**|  | [optional] [default to 60] |
| **duration** | **Integer**|  | [optional] [default to 60] |
| **type** | **Integer**|  | [optional] [default to 1] |
| **difficulty** | **Integer**|  | [optional] [default to 1] |
| **isFree** | **Boolean**|  | [optional] [default to true] |
| **price** | **BigDecimal**|  | [optional] [default to 0] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createQuestionApiV1ExamQuestionPost"></a>
# **createQuestionApiV1ExamQuestionPost**
> Object createQuestionApiV1ExamQuestionPost(paperId, type, content, answer, options, analysis, score, difficulty, sortOrder)

新增题目

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer paperId = 56; // Integer | 
    Integer type = 56; // Integer | 
    String content = "content_example"; // String | 
    String answer = "answer_example"; // String | 
    String options = "options_example"; // String | 
    String analysis = "analysis_example"; // String | 
    BigDecimal score = new BigDecimal("1"); // BigDecimal | 
    Integer difficulty = 1; // Integer | 
    Integer sortOrder = 0; // Integer | 
    try {
      Object result = apiInstance.createQuestionApiV1ExamQuestionPost(paperId, type, content, answer, options, analysis, score, difficulty, sortOrder);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#createQuestionApiV1ExamQuestionPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **paperId** | **Integer**|  | |
| **type** | **Integer**|  | |
| **content** | **String**|  | |
| **answer** | **String**|  | |
| **options** | **String**|  | [optional] |
| **analysis** | **String**|  | [optional] |
| **score** | **BigDecimal**|  | [optional] [default to 1] |
| **difficulty** | **Integer**|  | [optional] [default to 1] |
| **sortOrder** | **Integer**|  | [optional] [default to 0] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createQuestionApiV1ExamQuestionPost_0"></a>
# **createQuestionApiV1ExamQuestionPost_0**
> Object createQuestionApiV1ExamQuestionPost_0(paperId, type, content, answer, options, analysis, score, difficulty, sortOrder)

新增题目

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer paperId = 56; // Integer | 
    Integer type = 56; // Integer | 
    String content = "content_example"; // String | 
    String answer = "answer_example"; // String | 
    String options = "options_example"; // String | 
    String analysis = "analysis_example"; // String | 
    BigDecimal score = new BigDecimal("1"); // BigDecimal | 
    Integer difficulty = 1; // Integer | 
    Integer sortOrder = 0; // Integer | 
    try {
      Object result = apiInstance.createQuestionApiV1ExamQuestionPost_0(paperId, type, content, answer, options, analysis, score, difficulty, sortOrder);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#createQuestionApiV1ExamQuestionPost_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **paperId** | **Integer**|  | |
| **type** | **Integer**|  | |
| **content** | **String**|  | |
| **answer** | **String**|  | |
| **options** | **String**|  | [optional] |
| **analysis** | **String**|  | [optional] |
| **score** | **BigDecimal**|  | [optional] [default to 1] |
| **difficulty** | **Integer**|  | [optional] [default to 1] |
| **sortOrder** | **Integer**|  | [optional] [default to 0] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="deletePaperApiV1ExamPaperPidDelete"></a>
# **deletePaperApiV1ExamPaperPidDelete**
> Object deletePaperApiV1ExamPaperPidDelete(pid)

删除试卷

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer pid = 56; // Integer | 
    try {
      Object result = apiInstance.deletePaperApiV1ExamPaperPidDelete(pid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#deletePaperApiV1ExamPaperPidDelete");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **pid** | **Integer**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="deletePaperApiV1ExamPaperPidDelete_0"></a>
# **deletePaperApiV1ExamPaperPidDelete_0**
> Object deletePaperApiV1ExamPaperPidDelete_0(pid)

删除试卷

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer pid = 56; // Integer | 
    try {
      Object result = apiInstance.deletePaperApiV1ExamPaperPidDelete_0(pid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#deletePaperApiV1ExamPaperPidDelete_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **pid** | **Integer**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="deleteQuestionApiV1ExamQuestionQidDelete"></a>
# **deleteQuestionApiV1ExamQuestionQidDelete**
> Object deleteQuestionApiV1ExamQuestionQidDelete(qid)

删除题目

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer qid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteQuestionApiV1ExamQuestionQidDelete(qid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#deleteQuestionApiV1ExamQuestionQidDelete");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **qid** | **Integer**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="deleteQuestionApiV1ExamQuestionQidDelete_0"></a>
# **deleteQuestionApiV1ExamQuestionQidDelete_0**
> Object deleteQuestionApiV1ExamQuestionQidDelete_0(qid)

删除题目

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer qid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteQuestionApiV1ExamQuestionQidDelete_0(qid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#deleteQuestionApiV1ExamQuestionQidDelete_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **qid** | **Integer**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="examPaperCategoryList"></a>
# **examPaperCategoryList**
> Object examPaperCategoryList()

考试分类列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    try {
      Object result = apiInstance.examPaperCategoryList();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#examPaperCategoryList");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="examPaperCategoryList_0"></a>
# **examPaperCategoryList_0**
> Object examPaperCategoryList_0()

考试分类列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    try {
      Object result = apiInstance.examPaperCategoryList_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#examPaperCategoryList_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="getPaperApiV1ExamPaperPidGet"></a>
# **getPaperApiV1ExamPaperPidGet**
> Object getPaperApiV1ExamPaperPidGet(pid)

试卷详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer pid = 56; // Integer | 
    try {
      Object result = apiInstance.getPaperApiV1ExamPaperPidGet(pid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#getPaperApiV1ExamPaperPidGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **pid** | **Integer**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="getPaperApiV1ExamPaperPidGet_0"></a>
# **getPaperApiV1ExamPaperPidGet_0**
> Object getPaperApiV1ExamPaperPidGet_0(pid)

试卷详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer pid = 56; // Integer | 
    try {
      Object result = apiInstance.getPaperApiV1ExamPaperPidGet_0(pid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#getPaperApiV1ExamPaperPidGet_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **pid** | **Integer**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="getRecordApiV1ExamRecordRidGet"></a>
# **getRecordApiV1ExamRecordRidGet**
> Object getRecordApiV1ExamRecordRidGet(rid)

考试记录详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer rid = 56; // Integer | 
    try {
      Object result = apiInstance.getRecordApiV1ExamRecordRidGet(rid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#getRecordApiV1ExamRecordRidGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **rid** | **Integer**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="getRecordApiV1ExamRecordRidGet_0"></a>
# **getRecordApiV1ExamRecordRidGet_0**
> Object getRecordApiV1ExamRecordRidGet_0(rid)

考试记录详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer rid = 56; // Integer | 
    try {
      Object result = apiInstance.getRecordApiV1ExamRecordRidGet_0(rid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#getRecordApiV1ExamRecordRidGet_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **rid** | **Integer**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listPapersApiV1ExamPaperListGet"></a>
# **listPapersApiV1ExamPaperListGet**
> Object listPapersApiV1ExamPaperListGet(page, limit, categoryId, keyword, difficulty, isFree)

试卷列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer categoryId = 56; // Integer | 
    String keyword = "keyword_example"; // String | 
    Integer difficulty = 56; // Integer | 
    Boolean isFree = true; // Boolean | 
    try {
      Object result = apiInstance.listPapersApiV1ExamPaperListGet(page, limit, categoryId, keyword, difficulty, isFree);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#listPapersApiV1ExamPaperListGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **categoryId** | **Integer**|  | [optional] |
| **keyword** | **String**|  | [optional] |
| **difficulty** | **Integer**|  | [optional] |
| **isFree** | **Boolean**|  | [optional] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listPapersApiV1ExamPaperListGet_0"></a>
# **listPapersApiV1ExamPaperListGet_0**
> Object listPapersApiV1ExamPaperListGet_0(page, limit, categoryId, keyword, difficulty, isFree)

试卷列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer categoryId = 56; // Integer | 
    String keyword = "keyword_example"; // String | 
    Integer difficulty = 56; // Integer | 
    Boolean isFree = true; // Boolean | 
    try {
      Object result = apiInstance.listPapersApiV1ExamPaperListGet_0(page, limit, categoryId, keyword, difficulty, isFree);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#listPapersApiV1ExamPaperListGet_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **categoryId** | **Integer**|  | [optional] |
| **keyword** | **String**|  | [optional] |
| **difficulty** | **Integer**|  | [optional] |
| **isFree** | **Boolean**|  | [optional] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listQuestionsApiV1ExamQuestionListGet"></a>
# **listQuestionsApiV1ExamQuestionListGet**
> Object listQuestionsApiV1ExamQuestionListGet(paperId)

题目列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer paperId = 56; // Integer | 
    try {
      Object result = apiInstance.listQuestionsApiV1ExamQuestionListGet(paperId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#listQuestionsApiV1ExamQuestionListGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **paperId** | **Integer**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listQuestionsApiV1ExamQuestionListGet_0"></a>
# **listQuestionsApiV1ExamQuestionListGet_0**
> Object listQuestionsApiV1ExamQuestionListGet_0(paperId)

题目列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer paperId = 56; // Integer | 
    try {
      Object result = apiInstance.listQuestionsApiV1ExamQuestionListGet_0(paperId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#listQuestionsApiV1ExamQuestionListGet_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **paperId** | **Integer**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listRecordsApiV1ExamRecordListGet"></a>
# **listRecordsApiV1ExamRecordListGet**
> Object listRecordsApiV1ExamRecordListGet(page, limit, userId, paperId)

考试记录列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String userId = "userId_example"; // String | 
    Integer paperId = 56; // Integer | 
    try {
      Object result = apiInstance.listRecordsApiV1ExamRecordListGet(page, limit, userId, paperId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#listRecordsApiV1ExamRecordListGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **userId** | **String**|  | [optional] |
| **paperId** | **Integer**|  | [optional] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listRecordsApiV1ExamRecordListGet_0"></a>
# **listRecordsApiV1ExamRecordListGet_0**
> Object listRecordsApiV1ExamRecordListGet_0(page, limit, userId, paperId)

考试记录列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String userId = "userId_example"; // String | 
    Integer paperId = 56; // Integer | 
    try {
      Object result = apiInstance.listRecordsApiV1ExamRecordListGet_0(page, limit, userId, paperId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#listRecordsApiV1ExamRecordListGet_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **userId** | **String**|  | [optional] |
| **paperId** | **Integer**|  | [optional] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="markMasteredApiV1ExamWrongWidMasterPut"></a>
# **markMasteredApiV1ExamWrongWidMasterPut**
> Object markMasteredApiV1ExamWrongWidMasterPut(wid)

标记错题为已掌握

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer wid = 56; // Integer | 
    try {
      Object result = apiInstance.markMasteredApiV1ExamWrongWidMasterPut(wid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#markMasteredApiV1ExamWrongWidMasterPut");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **wid** | **Integer**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="markMasteredApiV1ExamWrongWidMasterPut_0"></a>
# **markMasteredApiV1ExamWrongWidMasterPut_0**
> Object markMasteredApiV1ExamWrongWidMasterPut_0(wid)

标记错题为已掌握

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer wid = 56; // Integer | 
    try {
      Object result = apiInstance.markMasteredApiV1ExamWrongWidMasterPut_0(wid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#markMasteredApiV1ExamWrongWidMasterPut_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **wid** | **Integer**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="startExamApiV1ExamRecordStartPost"></a>
# **startExamApiV1ExamRecordStartPost**
> Object startExamApiV1ExamRecordStartPost(paperId)

开始考试

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer paperId = 56; // Integer | 
    try {
      Object result = apiInstance.startExamApiV1ExamRecordStartPost(paperId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#startExamApiV1ExamRecordStartPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **paperId** | **Integer**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="startExamApiV1ExamRecordStartPost_0"></a>
# **startExamApiV1ExamRecordStartPost_0**
> Object startExamApiV1ExamRecordStartPost_0(paperId)

开始考试

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer paperId = 56; // Integer | 
    try {
      Object result = apiInstance.startExamApiV1ExamRecordStartPost_0(paperId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#startExamApiV1ExamRecordStartPost_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **paperId** | **Integer**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="submitExamApiV1ExamRecordSubmitPost"></a>
# **submitExamApiV1ExamRecordSubmitPost**
> Object submitExamApiV1ExamRecordSubmitPost(recordId, answers)

提交答卷

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer recordId = 56; // Integer | 
    String answers = "answers_example"; // String | 答案JSON
    try {
      Object result = apiInstance.submitExamApiV1ExamRecordSubmitPost(recordId, answers);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#submitExamApiV1ExamRecordSubmitPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **recordId** | **Integer**|  | |
| **answers** | **String**| 答案JSON | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="submitExamApiV1ExamRecordSubmitPost_0"></a>
# **submitExamApiV1ExamRecordSubmitPost_0**
> Object submitExamApiV1ExamRecordSubmitPost_0(recordId, answers)

提交答卷

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer recordId = 56; // Integer | 
    String answers = "answers_example"; // String | 答案JSON
    try {
      Object result = apiInstance.submitExamApiV1ExamRecordSubmitPost_0(recordId, answers);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#submitExamApiV1ExamRecordSubmitPost_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **recordId** | **Integer**|  | |
| **answers** | **String**| 答案JSON | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="updatePaperApiV1ExamPaperPidPut"></a>
# **updatePaperApiV1ExamPaperPidPut**
> Object updatePaperApiV1ExamPaperPidPut(pid, title, description, totalScore, passScore, duration, difficulty, price, isFree, status)

修改试卷

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer pid = 56; // Integer | 
    String title = "title_example"; // String | 
    String description = "description_example"; // String | 
    BigDecimal totalScore = new BigDecimal(78); // BigDecimal | 
    BigDecimal passScore = new BigDecimal(78); // BigDecimal | 
    Integer duration = 56; // Integer | 
    Integer difficulty = 56; // Integer | 
    BigDecimal price = new BigDecimal(78); // BigDecimal | 
    Boolean isFree = true; // Boolean | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.updatePaperApiV1ExamPaperPidPut(pid, title, description, totalScore, passScore, duration, difficulty, price, isFree, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#updatePaperApiV1ExamPaperPidPut");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **pid** | **Integer**|  | |
| **title** | **String**|  | [optional] |
| **description** | **String**|  | [optional] |
| **totalScore** | **BigDecimal**|  | [optional] |
| **passScore** | **BigDecimal**|  | [optional] |
| **duration** | **Integer**|  | [optional] |
| **difficulty** | **Integer**|  | [optional] |
| **price** | **BigDecimal**|  | [optional] |
| **isFree** | **Boolean**|  | [optional] |
| **status** | **Integer**|  | [optional] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="updatePaperApiV1ExamPaperPidPut_0"></a>
# **updatePaperApiV1ExamPaperPidPut_0**
> Object updatePaperApiV1ExamPaperPidPut_0(pid, title, description, totalScore, passScore, duration, difficulty, price, isFree, status)

修改试卷

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer pid = 56; // Integer | 
    String title = "title_example"; // String | 
    String description = "description_example"; // String | 
    BigDecimal totalScore = new BigDecimal(78); // BigDecimal | 
    BigDecimal passScore = new BigDecimal(78); // BigDecimal | 
    Integer duration = 56; // Integer | 
    Integer difficulty = 56; // Integer | 
    BigDecimal price = new BigDecimal(78); // BigDecimal | 
    Boolean isFree = true; // Boolean | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.updatePaperApiV1ExamPaperPidPut_0(pid, title, description, totalScore, passScore, duration, difficulty, price, isFree, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#updatePaperApiV1ExamPaperPidPut_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **pid** | **Integer**|  | |
| **title** | **String**|  | [optional] |
| **description** | **String**|  | [optional] |
| **totalScore** | **BigDecimal**|  | [optional] |
| **passScore** | **BigDecimal**|  | [optional] |
| **duration** | **Integer**|  | [optional] |
| **difficulty** | **Integer**|  | [optional] |
| **price** | **BigDecimal**|  | [optional] |
| **isFree** | **Boolean**|  | [optional] |
| **status** | **Integer**|  | [optional] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="updateQuestionApiV1ExamQuestionQidPut"></a>
# **updateQuestionApiV1ExamQuestionQidPut**
> Object updateQuestionApiV1ExamQuestionQidPut(qid, content, options, answer, analysis, score, sortOrder)

修改题目

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer qid = 56; // Integer | 
    String content = "content_example"; // String | 
    String options = "options_example"; // String | 
    String answer = "answer_example"; // String | 
    String analysis = "analysis_example"; // String | 
    BigDecimal score = new BigDecimal(78); // BigDecimal | 
    Integer sortOrder = 56; // Integer | 
    try {
      Object result = apiInstance.updateQuestionApiV1ExamQuestionQidPut(qid, content, options, answer, analysis, score, sortOrder);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#updateQuestionApiV1ExamQuestionQidPut");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **qid** | **Integer**|  | |
| **content** | **String**|  | [optional] |
| **options** | **String**|  | [optional] |
| **answer** | **String**|  | [optional] |
| **analysis** | **String**|  | [optional] |
| **score** | **BigDecimal**|  | [optional] |
| **sortOrder** | **Integer**|  | [optional] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="updateQuestionApiV1ExamQuestionQidPut_0"></a>
# **updateQuestionApiV1ExamQuestionQidPut_0**
> Object updateQuestionApiV1ExamQuestionQidPut_0(qid, content, options, answer, analysis, score, sortOrder)

修改题目

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer qid = 56; // Integer | 
    String content = "content_example"; // String | 
    String options = "options_example"; // String | 
    String answer = "answer_example"; // String | 
    String analysis = "analysis_example"; // String | 
    BigDecimal score = new BigDecimal(78); // BigDecimal | 
    Integer sortOrder = 56; // Integer | 
    try {
      Object result = apiInstance.updateQuestionApiV1ExamQuestionQidPut_0(qid, content, options, answer, analysis, score, sortOrder);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#updateQuestionApiV1ExamQuestionQidPut_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **qid** | **Integer**|  | |
| **content** | **String**|  | [optional] |
| **options** | **String**|  | [optional] |
| **answer** | **String**|  | [optional] |
| **analysis** | **String**|  | [optional] |
| **score** | **BigDecimal**|  | [optional] |
| **sortOrder** | **Integer**|  | [optional] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="wrongListApiV1ExamWrongListGet"></a>
# **wrongListApiV1ExamWrongListGet**
> Object wrongListApiV1ExamWrongListGet(page, limit, isMastered)

错题本

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Boolean isMastered = true; // Boolean | 
    try {
      Object result = apiInstance.wrongListApiV1ExamWrongListGet(page, limit, isMastered);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#wrongListApiV1ExamWrongListGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **isMastered** | **Boolean**|  | [optional] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="wrongListApiV1ExamWrongListGet_0"></a>
# **wrongListApiV1ExamWrongListGet_0**
> Object wrongListApiV1ExamWrongListGet_0(page, limit, isMastered)

错题本

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ExamApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ExamApi apiInstance = new ExamApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Boolean isMastered = true; // Boolean | 
    try {
      Object result = apiInstance.wrongListApiV1ExamWrongListGet_0(page, limit, isMastered);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ExamApi#wrongListApiV1ExamWrongListGet_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **isMastered** | **Boolean**|  | [optional] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

