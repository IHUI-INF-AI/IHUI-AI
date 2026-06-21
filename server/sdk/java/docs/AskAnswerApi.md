# AskAnswerApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**adoptAnswerApiV1AskAnswerAdoptPut**](AskAnswerApi.md#adoptAnswerApiV1AskAnswerAdoptPut) | **PUT** /api/v1/ask/answer/adopt | 采纳回答 |
| [**createAnswerApiV1AskAnswerPost**](AskAnswerApi.md#createAnswerApiV1AskAnswerPost) | **POST** /api/v1/ask/answer | 提出回答 |
| [**deleteAnswerApiV1AskAnswerDelete**](AskAnswerApi.md#deleteAnswerApiV1AskAnswerDelete) | **DELETE** /api/v1/ask/answer | 删除回答 |
| [**getAnswerApiV1AskAnswerPublicApiGet**](AskAnswerApi.md#getAnswerApiV1AskAnswerPublicApiGet) | **GET** /api/v1/ask/answer/public-api | 回答详情 |
| [**listAnswersApiV1AskAnswerListGet**](AskAnswerApi.md#listAnswersApiV1AskAnswerListGet) | **GET** /api/v1/ask/answer/list | 回答列表(需权限) |
| [**memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet**](AskAnswerApi.md#memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet) | **GET** /api/v1/ask/answer/public-api/member/count | 会员回答数 |
| [**publicListAnswersApiV1AskAnswerPublicApiListGet**](AskAnswerApi.md#publicListAnswersApiV1AskAnswerPublicApiListGet) | **GET** /api/v1/ask/answer/public-api/list | 回答列表(公开) |
| [**updateAnswerApiV1AskAnswerPut**](AskAnswerApi.md#updateAnswerApiV1AskAnswerPut) | **PUT** /api/v1/ask/answer | 修改回答 |


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
import org.openapitools.client.api.AskAnswerApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskAnswerApi apiInstance = new AskAnswerApi(defaultClient);
    Integer id = 56; // Integer | 
    try {
      Object result = apiInstance.adoptAnswerApiV1AskAnswerAdoptPut(id);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskAnswerApi#adoptAnswerApiV1AskAnswerAdoptPut");
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
import org.openapitools.client.api.AskAnswerApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskAnswerApi apiInstance = new AskAnswerApi(defaultClient);
    AnswerCreate answerCreate = new AnswerCreate(); // AnswerCreate | 
    try {
      Object result = apiInstance.createAnswerApiV1AskAnswerPost(answerCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskAnswerApi#createAnswerApiV1AskAnswerPost");
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
import org.openapitools.client.api.AskAnswerApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskAnswerApi apiInstance = new AskAnswerApi(defaultClient);
    Integer id = 56; // Integer | 
    try {
      Object result = apiInstance.deleteAnswerApiV1AskAnswerDelete(id);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskAnswerApi#deleteAnswerApiV1AskAnswerDelete");
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
import org.openapitools.client.api.AskAnswerApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskAnswerApi apiInstance = new AskAnswerApi(defaultClient);
    Integer id = 56; // Integer | 
    try {
      Object result = apiInstance.getAnswerApiV1AskAnswerPublicApiGet(id);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskAnswerApi#getAnswerApiV1AskAnswerPublicApiGet");
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
import org.openapitools.client.api.AskAnswerApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskAnswerApi apiInstance = new AskAnswerApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 10; // Integer | 
    Integer questionId = 56; // Integer | 
    String memberId = "memberId_example"; // String | 
    try {
      Object result = apiInstance.listAnswersApiV1AskAnswerListGet(page, limit, questionId, memberId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskAnswerApi#listAnswersApiV1AskAnswerListGet");
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
import org.openapitools.client.api.AskAnswerApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskAnswerApi apiInstance = new AskAnswerApi(defaultClient);
    String memberId = "memberId_example"; // String | 
    try {
      Object result = apiInstance.memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet(memberId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskAnswerApi#memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet");
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
import org.openapitools.client.api.AskAnswerApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskAnswerApi apiInstance = new AskAnswerApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 10; // Integer | 
    Integer questionId = 56; // Integer | 
    try {
      Object result = apiInstance.publicListAnswersApiV1AskAnswerPublicApiListGet(page, limit, questionId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskAnswerApi#publicListAnswersApiV1AskAnswerPublicApiListGet");
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
import org.openapitools.client.api.AskAnswerApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskAnswerApi apiInstance = new AskAnswerApi(defaultClient);
    AnswerUpdate answerUpdate = new AnswerUpdate(); // AnswerUpdate | 
    try {
      Object result = apiInstance.updateAnswerApiV1AskAnswerPut(answerUpdate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskAnswerApi#updateAnswerApiV1AskAnswerPut");
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

