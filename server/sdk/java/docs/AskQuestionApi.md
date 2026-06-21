# AskQuestionApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**askQuestionAddComment**](AskQuestionApi.md#askQuestionAddComment) | **POST** /api/v1/ask/question/comment | 发表评论 |
| [**askQuestionToggleFavorite**](AskQuestionApi.md#askQuestionToggleFavorite) | **POST** /api/v1/ask/question/favorite | 收藏/取消收藏 |
| [**askQuestionToggleLike**](AskQuestionApi.md#askQuestionToggleLike) | **POST** /api/v1/ask/question/like | 点赞/取消点赞 |
| [**createQuestionApiV1AskQuestionPost**](AskQuestionApi.md#createQuestionApiV1AskQuestionPost) | **POST** /api/v1/ask/question | 提出问题 |
| [**deleteQuestionApiV1AskQuestionDelete**](AskQuestionApi.md#deleteQuestionApiV1AskQuestionDelete) | **DELETE** /api/v1/ask/question | 删除问题 |
| [**getQuestionApiV1AskQuestionPublicApiGet**](AskQuestionApi.md#getQuestionApiV1AskQuestionPublicApiGet) | **GET** /api/v1/ask/question/public-api | 问题详情 |
| [**listQuestionsApiV1AskQuestionListGet**](AskQuestionApi.md#listQuestionsApiV1AskQuestionListGet) | **GET** /api/v1/ask/question/list | 问题列表(需权限) |
| [**memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet**](AskQuestionApi.md#memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet) | **GET** /api/v1/ask/question/public-api/member/count | 会员问题数 |
| [**publicListQuestionsApiV1AskQuestionPublicApiListGet**](AskQuestionApi.md#publicListQuestionsApiV1AskQuestionPublicApiListGet) | **GET** /api/v1/ask/question/public-api/list | 问题列表(公开) |
| [**updateQuestionApiV1AskQuestionPut**](AskQuestionApi.md#updateQuestionApiV1AskQuestionPut) | **PUT** /api/v1/ask/question | 修改问题 |


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
import org.openapitools.client.api.AskQuestionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskQuestionApi apiInstance = new AskQuestionApi(defaultClient);
    AppSchemasAskCommentCreate appSchemasAskCommentCreate = new AppSchemasAskCommentCreate(); // AppSchemasAskCommentCreate | 
    try {
      Object result = apiInstance.askQuestionAddComment(appSchemasAskCommentCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskQuestionApi#askQuestionAddComment");
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
import org.openapitools.client.api.AskQuestionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskQuestionApi apiInstance = new AskQuestionApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    try {
      Object result = apiInstance.askQuestionToggleFavorite(targetType, targetId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskQuestionApi#askQuestionToggleFavorite");
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
import org.openapitools.client.api.AskQuestionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskQuestionApi apiInstance = new AskQuestionApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    try {
      Object result = apiInstance.askQuestionToggleLike(targetType, targetId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskQuestionApi#askQuestionToggleLike");
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
import org.openapitools.client.api.AskQuestionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskQuestionApi apiInstance = new AskQuestionApi(defaultClient);
    QuestionCreate questionCreate = new QuestionCreate(); // QuestionCreate | 
    try {
      Object result = apiInstance.createQuestionApiV1AskQuestionPost(questionCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskQuestionApi#createQuestionApiV1AskQuestionPost");
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
import org.openapitools.client.api.AskQuestionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskQuestionApi apiInstance = new AskQuestionApi(defaultClient);
    Integer id = 56; // Integer | 
    try {
      Object result = apiInstance.deleteQuestionApiV1AskQuestionDelete(id);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskQuestionApi#deleteQuestionApiV1AskQuestionDelete");
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
import org.openapitools.client.api.AskQuestionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskQuestionApi apiInstance = new AskQuestionApi(defaultClient);
    Integer id = 56; // Integer | 
    try {
      Object result = apiInstance.getQuestionApiV1AskQuestionPublicApiGet(id);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskQuestionApi#getQuestionApiV1AskQuestionPublicApiGet");
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
import org.openapitools.client.api.AskQuestionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskQuestionApi apiInstance = new AskQuestionApi(defaultClient);
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
      System.err.println("Exception when calling AskQuestionApi#listQuestionsApiV1AskQuestionListGet");
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
import org.openapitools.client.api.AskQuestionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskQuestionApi apiInstance = new AskQuestionApi(defaultClient);
    String memberId = "memberId_example"; // String | 
    try {
      Object result = apiInstance.memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet(memberId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskQuestionApi#memberQuestionCountApiV1AskQuestionPublicApiMemberCountGet");
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
import org.openapitools.client.api.AskQuestionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskQuestionApi apiInstance = new AskQuestionApi(defaultClient);
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
      System.err.println("Exception when calling AskQuestionApi#publicListQuestionsApiV1AskQuestionPublicApiListGet");
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
import org.openapitools.client.api.AskQuestionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskQuestionApi apiInstance = new AskQuestionApi(defaultClient);
    QuestionUpdate questionUpdate = new QuestionUpdate(); // QuestionUpdate | 
    try {
      Object result = apiInstance.updateQuestionApiV1AskQuestionPut(questionUpdate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskQuestionApi#updateQuestionApiV1AskQuestionPut");
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

