# AskApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addCategoryApiV1AskCategoryPost**](AskApi.md#addCategoryApiV1AskCategoryPost) | **POST** /api/v1/ask/category | 添加分类 |
| [**adoptAnswerApiV1AskAnswerAdoptPut**](AskApi.md#adoptAnswerApiV1AskAnswerAdoptPut) | **PUT** /api/v1/ask/answer/adopt | 采纳回答 |
| [**askCategoryAdminList**](AskApi.md#askCategoryAdminList) | **GET** /api/v1/ask/category/admin/list | 分类列表(管理员) |
| [**askQuestionAddComment**](AskApi.md#askQuestionAddComment) | **POST** /api/v1/ask/question/comment | 发表评论 |
| [**askQuestionToggleFavorite**](AskApi.md#askQuestionToggleFavorite) | **POST** /api/v1/ask/question/favorite | 收藏/取消收藏 |
| [**askQuestionToggleLike**](AskApi.md#askQuestionToggleLike) | **POST** /api/v1/ask/question/like | 点赞/取消点赞 |
| [**changeShowApiV1AskCategoryIsShowPut**](AskApi.md#changeShowApiV1AskCategoryIsShowPut) | **PUT** /api/v1/ask/category/is-show | 修改显示状态 |
| [**changeShowIndexApiV1AskCategoryIsShowIndexPut**](AskApi.md#changeShowIndexApiV1AskCategoryIsShowIndexPut) | **PUT** /api/v1/ask/category/is-show-index | 修改首页显示状态 |
| [**createAnswerApiV1AskAnswerPost**](AskApi.md#createAnswerApiV1AskAnswerPost) | **POST** /api/v1/ask/answer | 提出回答 |
| [**createQuestionApiV1AskQuestionPost**](AskApi.md#createQuestionApiV1AskQuestionPost) | **POST** /api/v1/ask/question | 提出问题 |
| [**deleteAnswerApiV1AskAnswerDelete**](AskApi.md#deleteAnswerApiV1AskAnswerDelete) | **DELETE** /api/v1/ask/answer | 删除回答 |
| [**deleteCategoryApiV1AskCategoryCatIdDelete**](AskApi.md#deleteCategoryApiV1AskCategoryCatIdDelete) | **DELETE** /api/v1/ask/category/{cat_id} | 删除分类 |
| [**deleteQuestionApiV1AskQuestionDelete**](AskApi.md#deleteQuestionApiV1AskQuestionDelete) | **DELETE** /api/v1/ask/question | 删除问题 |
| [**getAnswerApiV1AskAnswerPublicApiGet**](AskApi.md#getAnswerApiV1AskAnswerPublicApiGet) | **GET** /api/v1/ask/answer/public-api | 回答详情 |
| [**getCategoryApiV1AskCategoryCatIdGet**](AskApi.md#getCategoryApiV1AskCategoryCatIdGet) | **GET** /api/v1/ask/category/{cat_id} | 分类详情 |
| [**getQuestionApiV1AskQuestionPublicApiGet**](AskApi.md#getQuestionApiV1AskQuestionPublicApiGet) | **GET** /api/v1/ask/question/public-api | 问题详情 |
| [**listAnswersApiV1AskAnswerListGet**](AskApi.md#listAnswersApiV1AskAnswerListGet) | **GET** /api/v1/ask/answer/list | 回答列表(需权限) |
| [**listQuestionsApiV1AskQuestionListGet**](AskApi.md#listQuestionsApiV1AskQuestionListGet) | **GET** /api/v1/ask/question/list | 问题列表(需权限) |
| [**memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet**](AskApi.md#memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet) | **GET** /api/v1/ask/answer/public-api/member/count | 会员回答数 |
| [**memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet**](AskApi.md#memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet) | **GET** /api/v1/ask/question/public-api/member/count | 会员问题数 |
| [**publicListAnswersApiV1AskAnswerPublicApiListGet**](AskApi.md#publicListAnswersApiV1AskAnswerPublicApiListGet) | **GET** /api/v1/ask/answer/public-api/list | 回答列表(公开) |
| [**publicListApiV1AskCategoryPublicApiListGet**](AskApi.md#publicListApiV1AskCategoryPublicApiListGet) | **GET** /api/v1/ask/category/public-api/list | 分类列表(公开) |
| [**publicListQuestionsApiV1AskQuestionPublicApiListGet**](AskApi.md#publicListQuestionsApiV1AskQuestionPublicApiListGet) | **GET** /api/v1/ask/question/public-api/list | 问题列表(公开) |
| [**updateAnswerApiV1AskAnswerPut**](AskApi.md#updateAnswerApiV1AskAnswerPut) | **PUT** /api/v1/ask/answer | 修改回答 |
| [**updateCategoryApiV1AskCategoryPut**](AskApi.md#updateCategoryApiV1AskCategoryPut) | **PUT** /api/v1/ask/category | 修改分类 |
| [**updateQuestionApiV1AskQuestionPut**](AskApi.md#updateQuestionApiV1AskQuestionPut) | **PUT** /api/v1/ask/question | 修改问题 |


<a id="addCategoryApiV1AskCategoryPost"></a>
# **addCategoryApiV1AskCategoryPost**
> Object addCategoryApiV1AskCategoryPost(categoryCreate)

添加分类

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    CategoryCreate categoryCreate = new CategoryCreate(); // CategoryCreate | 
    try {
      Object result = apiInstance.addCategoryApiV1AskCategoryPost(categoryCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#addCategoryApiV1AskCategoryPost");
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
| **categoryCreate** | [**CategoryCreate**](CategoryCreate.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="adoptAnswerApiV1AskAnswerAdoptPut"></a>
# **adoptAnswerApiV1AskAnswerAdoptPut**
> Object adoptAnswerApiV1AskAnswerAdoptPut(id)

采纳回答

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    Integer id = 56; // Integer | 
    try {
      Object result = apiInstance.adoptAnswerApiV1AskAnswerAdoptPut(id);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#adoptAnswerApiV1AskAnswerAdoptPut");
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
| **id** | **Integer**|  | |

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

<a id="askCategoryAdminList"></a>
# **askCategoryAdminList**
> Object askCategoryAdminList(isShow, isShowIndex)

分类列表(管理员)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    Boolean isShow = true; // Boolean | 
    Boolean isShowIndex = true; // Boolean | 
    try {
      Object result = apiInstance.askCategoryAdminList(isShow, isShowIndex);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#askCategoryAdminList");
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
| **isShow** | **Boolean**|  | [optional] |
| **isShowIndex** | **Boolean**|  | [optional] |

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

<a id="askQuestionAddComment"></a>
# **askQuestionAddComment**
> Object askQuestionAddComment(appSchemasAskCommentCreate)

发表评论

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    AppSchemasAskCommentCreate appSchemasAskCommentCreate = new AppSchemasAskCommentCreate(); // AppSchemasAskCommentCreate | 
    try {
      Object result = apiInstance.askQuestionAddComment(appSchemasAskCommentCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#askQuestionAddComment");
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
| **appSchemasAskCommentCreate** | [**AppSchemasAskCommentCreate**](AppSchemasAskCommentCreate.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="askQuestionToggleFavorite"></a>
# **askQuestionToggleFavorite**
> Object askQuestionToggleFavorite(targetType, targetId)

收藏/取消收藏

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    try {
      Object result = apiInstance.askQuestionToggleFavorite(targetType, targetId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#askQuestionToggleFavorite");
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
| **targetType** | **String**|  | |
| **targetId** | **Integer**|  | |

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

<a id="askQuestionToggleLike"></a>
# **askQuestionToggleLike**
> Object askQuestionToggleLike(targetType, targetId)

点赞/取消点赞

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    try {
      Object result = apiInstance.askQuestionToggleLike(targetType, targetId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#askQuestionToggleLike");
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
| **targetType** | **String**|  | |
| **targetId** | **Integer**|  | |

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

<a id="changeShowApiV1AskCategoryIsShowPut"></a>
# **changeShowApiV1AskCategoryIsShowPut**
> Object changeShowApiV1AskCategoryIsShowPut(id, isShow)

修改显示状态

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    Integer id = 56; // Integer | 
    Boolean isShow = true; // Boolean | 
    try {
      Object result = apiInstance.changeShowApiV1AskCategoryIsShowPut(id, isShow);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#changeShowApiV1AskCategoryIsShowPut");
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
| **id** | **Integer**|  | |
| **isShow** | **Boolean**|  | |

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

<a id="changeShowIndexApiV1AskCategoryIsShowIndexPut"></a>
# **changeShowIndexApiV1AskCategoryIsShowIndexPut**
> Object changeShowIndexApiV1AskCategoryIsShowIndexPut(id, isShowIndex)

修改首页显示状态

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    Integer id = 56; // Integer | 
    Boolean isShowIndex = true; // Boolean | 
    try {
      Object result = apiInstance.changeShowIndexApiV1AskCategoryIsShowIndexPut(id, isShowIndex);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#changeShowIndexApiV1AskCategoryIsShowIndexPut");
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
| **id** | **Integer**|  | |
| **isShowIndex** | **Boolean**|  | |

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

<a id="createAnswerApiV1AskAnswerPost"></a>
# **createAnswerApiV1AskAnswerPost**
> Object createAnswerApiV1AskAnswerPost(answerCreate)

提出回答

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    AnswerCreate answerCreate = new AnswerCreate(); // AnswerCreate | 
    try {
      Object result = apiInstance.createAnswerApiV1AskAnswerPost(answerCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#createAnswerApiV1AskAnswerPost");
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
| **answerCreate** | [**AnswerCreate**](AnswerCreate.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createQuestionApiV1AskQuestionPost"></a>
# **createQuestionApiV1AskQuestionPost**
> Object createQuestionApiV1AskQuestionPost(questionCreate)

提出问题

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    QuestionCreate questionCreate = new QuestionCreate(); // QuestionCreate | 
    try {
      Object result = apiInstance.createQuestionApiV1AskQuestionPost(questionCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#createQuestionApiV1AskQuestionPost");
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
| **questionCreate** | [**QuestionCreate**](QuestionCreate.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="deleteAnswerApiV1AskAnswerDelete"></a>
# **deleteAnswerApiV1AskAnswerDelete**
> Object deleteAnswerApiV1AskAnswerDelete(id)

删除回答

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    Integer id = 56; // Integer | 
    try {
      Object result = apiInstance.deleteAnswerApiV1AskAnswerDelete(id);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#deleteAnswerApiV1AskAnswerDelete");
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
| **id** | **Integer**|  | |

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

<a id="deleteCategoryApiV1AskCategoryCatIdDelete"></a>
# **deleteCategoryApiV1AskCategoryCatIdDelete**
> Object deleteCategoryApiV1AskCategoryCatIdDelete(catId)

删除分类

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    Integer catId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteCategoryApiV1AskCategoryCatIdDelete(catId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#deleteCategoryApiV1AskCategoryCatIdDelete");
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
| **catId** | **Integer**|  | |

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

<a id="deleteQuestionApiV1AskQuestionDelete"></a>
# **deleteQuestionApiV1AskQuestionDelete**
> Object deleteQuestionApiV1AskQuestionDelete(id)

删除问题

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    Integer id = 56; // Integer | 
    try {
      Object result = apiInstance.deleteQuestionApiV1AskQuestionDelete(id);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#deleteQuestionApiV1AskQuestionDelete");
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
| **id** | **Integer**|  | |

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

<a id="getAnswerApiV1AskAnswerPublicApiGet"></a>
# **getAnswerApiV1AskAnswerPublicApiGet**
> Object getAnswerApiV1AskAnswerPublicApiGet(id)

回答详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    Integer id = 56; // Integer | 
    try {
      Object result = apiInstance.getAnswerApiV1AskAnswerPublicApiGet(id);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#getAnswerApiV1AskAnswerPublicApiGet");
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
| **id** | **Integer**|  | |

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

<a id="getCategoryApiV1AskCategoryCatIdGet"></a>
# **getCategoryApiV1AskCategoryCatIdGet**
> Object getCategoryApiV1AskCategoryCatIdGet(catId)

分类详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    Integer catId = 56; // Integer | 
    try {
      Object result = apiInstance.getCategoryApiV1AskCategoryCatIdGet(catId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#getCategoryApiV1AskCategoryCatIdGet");
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
| **catId** | **Integer**|  | |

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

<a id="getQuestionApiV1AskQuestionPublicApiGet"></a>
# **getQuestionApiV1AskQuestionPublicApiGet**
> Object getQuestionApiV1AskQuestionPublicApiGet(id)

问题详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    Integer id = 56; // Integer | 
    try {
      Object result = apiInstance.getQuestionApiV1AskQuestionPublicApiGet(id);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#getQuestionApiV1AskQuestionPublicApiGet");
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
| **id** | **Integer**|  | |

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

<a id="listAnswersApiV1AskAnswerListGet"></a>
# **listAnswersApiV1AskAnswerListGet**
> Object listAnswersApiV1AskAnswerListGet(page, limit, questionId, memberId)

回答列表(需权限)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 10; // Integer | 
    Integer questionId = 56; // Integer | 
    String memberId = "memberId_example"; // String | 
    try {
      Object result = apiInstance.listAnswersApiV1AskAnswerListGet(page, limit, questionId, memberId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#listAnswersApiV1AskAnswerListGet");
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
| **limit** | **Integer**|  | [optional] [default to 10] |
| **questionId** | **Integer**|  | [optional] |
| **memberId** | **String**|  | [optional] |

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

<a id="listQuestionsApiV1AskQuestionListGet"></a>
# **listQuestionsApiV1AskQuestionListGet**
> Object listQuestionsApiV1AskQuestionListGet(page, limit, keyword, status, cid, memberId, orderColumn, orderDirection)

问题列表(需权限)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 10; // Integer | 
    String keyword = "keyword_example"; // String | 
    String status = "status_example"; // String | 
    Integer cid = 56; // Integer | 
    String memberId = "memberId_example"; // String | 
    String orderColumn = "orderColumn_example"; // String | 
    String orderDirection = "orderDirection_example"; // String | 
    try {
      Object result = apiInstance.listQuestionsApiV1AskQuestionListGet(page, limit, keyword, status, cid, memberId, orderColumn, orderDirection);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#listQuestionsApiV1AskQuestionListGet");
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
| **limit** | **Integer**|  | [optional] [default to 10] |
| **keyword** | **String**|  | [optional] |
| **status** | **String**|  | [optional] |
| **cid** | **Integer**|  | [optional] |
| **memberId** | **String**|  | [optional] |
| **orderColumn** | **String**|  | [optional] |
| **orderDirection** | **String**|  | [optional] |

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

<a id="memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet"></a>
# **memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet**
> Object memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet(memberId)

会员回答数

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    String memberId = "memberId_example"; // String | 
    try {
      Object result = apiInstance.memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet(memberId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet");
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
| **memberId** | **String**|  | [optional] |

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

<a id="memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet"></a>
# **memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet**
> Object memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet(memberId)

会员问题数

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    String memberId = "memberId_example"; // String | 
    try {
      Object result = apiInstance.memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet(memberId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet");
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
| **memberId** | **String**|  | [optional] |

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

<a id="publicListAnswersApiV1AskAnswerPublicApiListGet"></a>
# **publicListAnswersApiV1AskAnswerPublicApiListGet**
> Object publicListAnswersApiV1AskAnswerPublicApiListGet(page, limit, questionId)

回答列表(公开)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 10; // Integer | 
    Integer questionId = 56; // Integer | 
    try {
      Object result = apiInstance.publicListAnswersApiV1AskAnswerPublicApiListGet(page, limit, questionId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#publicListAnswersApiV1AskAnswerPublicApiListGet");
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
| **limit** | **Integer**|  | [optional] [default to 10] |
| **questionId** | **Integer**|  | [optional] |

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

<a id="publicListApiV1AskCategoryPublicApiListGet"></a>
# **publicListApiV1AskCategoryPublicApiListGet**
> Object publicListApiV1AskCategoryPublicApiListGet(isShow, isShowIndex)

分类列表(公开)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    Boolean isShow = true; // Boolean | 
    Boolean isShowIndex = true; // Boolean | 
    try {
      Object result = apiInstance.publicListApiV1AskCategoryPublicApiListGet(isShow, isShowIndex);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#publicListApiV1AskCategoryPublicApiListGet");
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
| **isShow** | **Boolean**|  | [optional] |
| **isShowIndex** | **Boolean**|  | [optional] |

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

<a id="publicListQuestionsApiV1AskQuestionPublicApiListGet"></a>
# **publicListQuestionsApiV1AskQuestionPublicApiListGet**
> Object publicListQuestionsApiV1AskQuestionPublicApiListGet(page, limit, keyword, cid, orderColumn, orderDirection)

问题列表(公开)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 10; // Integer | 
    String keyword = "keyword_example"; // String | 
    Integer cid = 56; // Integer | 
    String orderColumn = "orderColumn_example"; // String | 
    String orderDirection = "orderDirection_example"; // String | 
    try {
      Object result = apiInstance.publicListQuestionsApiV1AskQuestionPublicApiListGet(page, limit, keyword, cid, orderColumn, orderDirection);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#publicListQuestionsApiV1AskQuestionPublicApiListGet");
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
| **limit** | **Integer**|  | [optional] [default to 10] |
| **keyword** | **String**|  | [optional] |
| **cid** | **Integer**|  | [optional] |
| **orderColumn** | **String**|  | [optional] |
| **orderDirection** | **String**|  | [optional] |

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

<a id="updateAnswerApiV1AskAnswerPut"></a>
# **updateAnswerApiV1AskAnswerPut**
> Object updateAnswerApiV1AskAnswerPut(answerUpdate)

修改回答

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    AnswerUpdate answerUpdate = new AnswerUpdate(); // AnswerUpdate | 
    try {
      Object result = apiInstance.updateAnswerApiV1AskAnswerPut(answerUpdate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#updateAnswerApiV1AskAnswerPut");
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
| **answerUpdate** | [**AnswerUpdate**](AnswerUpdate.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="updateCategoryApiV1AskCategoryPut"></a>
# **updateCategoryApiV1AskCategoryPut**
> Object updateCategoryApiV1AskCategoryPut(categoryUpdate)

修改分类

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    CategoryUpdate categoryUpdate = new CategoryUpdate(); // CategoryUpdate | 
    try {
      Object result = apiInstance.updateCategoryApiV1AskCategoryPut(categoryUpdate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#updateCategoryApiV1AskCategoryPut");
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
| **categoryUpdate** | [**CategoryUpdate**](CategoryUpdate.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="updateQuestionApiV1AskQuestionPut"></a>
# **updateQuestionApiV1AskQuestionPut**
> Object updateQuestionApiV1AskQuestionPut(questionUpdate)

修改问题

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskApi apiInstance = new AskApi(defaultClient);
    QuestionUpdate questionUpdate = new QuestionUpdate(); // QuestionUpdate | 
    try {
      Object result = apiInstance.updateQuestionApiV1AskQuestionPut(questionUpdate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskApi#updateQuestionApiV1AskQuestionPut");
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
| **questionUpdate** | [**QuestionUpdate**](QuestionUpdate.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

