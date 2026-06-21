# SearchApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addHotKeywordApiV1SearchHotKeywordPost**](SearchApi.md#addHotKeywordApiV1SearchHotKeywordPost) | **POST** /api/v1/search/hot/keyword | 添加热搜词 |
| [**addHotKeywordApiV1SearchHotKeywordPost_0**](SearchApi.md#addHotKeywordApiV1SearchHotKeywordPost_0) | **POST** /api/v1/search/hot/keyword | 添加热搜词 |
| [**addIndexApiV1SearchIndexPost**](SearchApi.md#addIndexApiV1SearchIndexPost) | **POST** /api/v1/search/index | 添加/更新索引 |
| [**addIndexApiV1SearchIndexPost_0**](SearchApi.md#addIndexApiV1SearchIndexPost_0) | **POST** /api/v1/search/index | 添加/更新索引 |
| [**deleteByTargetApiV1SearchIndexByTargetDelete**](SearchApi.md#deleteByTargetApiV1SearchIndexByTargetDelete) | **DELETE** /api/v1/search/index/by-target | 按目标删除索引 |
| [**deleteByTargetApiV1SearchIndexByTargetDelete_0**](SearchApi.md#deleteByTargetApiV1SearchIndexByTargetDelete_0) | **DELETE** /api/v1/search/index/by-target | 按目标删除索引 |
| [**deleteHotKeywordApiV1SearchHotKeywordKidDelete**](SearchApi.md#deleteHotKeywordApiV1SearchHotKeywordKidDelete) | **DELETE** /api/v1/search/hot/keyword/{kid} | 删除热搜词 |
| [**deleteHotKeywordApiV1SearchHotKeywordKidDelete_0**](SearchApi.md#deleteHotKeywordApiV1SearchHotKeywordKidDelete_0) | **DELETE** /api/v1/search/hot/keyword/{kid} | 删除热搜词 |
| [**deleteIndexApiV1SearchIndexIdxIdDelete**](SearchApi.md#deleteIndexApiV1SearchIndexIdxIdDelete) | **DELETE** /api/v1/search/index/{idx_id} | 删除索引 |
| [**deleteIndexApiV1SearchIndexIdxIdDelete_0**](SearchApi.md#deleteIndexApiV1SearchIndexIdxIdDelete_0) | **DELETE** /api/v1/search/index/{idx_id} | 删除索引 |
| [**hotKeywordsApiV1SearchHotGet**](SearchApi.md#hotKeywordsApiV1SearchHotGet) | **GET** /api/v1/search/hot | 热搜词 |
| [**hotKeywordsApiV1SearchHotGet_0**](SearchApi.md#hotKeywordsApiV1SearchHotGet_0) | **GET** /api/v1/search/hot | 热搜词 |
| [**queryApiV1SearchQueryGet**](SearchApi.md#queryApiV1SearchQueryGet) | **GET** /api/v1/search/query | 全文搜索 |
| [**queryApiV1SearchQueryGet_0**](SearchApi.md#queryApiV1SearchQueryGet_0) | **GET** /api/v1/search/query | 全文搜索 |
| [**searchLogList**](SearchApi.md#searchLogList) | **GET** /api/v1/search/log/list | 搜索日志 |
| [**searchLogList_0**](SearchApi.md#searchLogList_0) | **GET** /api/v1/search/log/list | 搜索日志 |
| [**suggestApiV1SearchSuggestGet**](SearchApi.md#suggestApiV1SearchSuggestGet) | **GET** /api/v1/search/suggest | 搜索建议 |
| [**suggestApiV1SearchSuggestGet_0**](SearchApi.md#suggestApiV1SearchSuggestGet_0) | **GET** /api/v1/search/suggest | 搜索建议 |


<a id="addHotKeywordApiV1SearchHotKeywordPost"></a>
# **addHotKeywordApiV1SearchHotKeywordPost**
> Object addHotKeywordApiV1SearchHotKeywordPost(keyword, isHot, sortOrder)

添加热搜词

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SearchApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SearchApi apiInstance = new SearchApi(defaultClient);
    String keyword = "keyword_example"; // String | 
    Boolean isHot = false; // Boolean | 
    Integer sortOrder = 0; // Integer | 
    try {
      Object result = apiInstance.addHotKeywordApiV1SearchHotKeywordPost(keyword, isHot, sortOrder);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SearchApi#addHotKeywordApiV1SearchHotKeywordPost");
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
| **keyword** | **String**|  | |
| **isHot** | **Boolean**|  | [optional] [default to false] |
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

<a id="addHotKeywordApiV1SearchHotKeywordPost_0"></a>
# **addHotKeywordApiV1SearchHotKeywordPost_0**
> Object addHotKeywordApiV1SearchHotKeywordPost_0(keyword, isHot, sortOrder)

添加热搜词

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SearchApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SearchApi apiInstance = new SearchApi(defaultClient);
    String keyword = "keyword_example"; // String | 
    Boolean isHot = false; // Boolean | 
    Integer sortOrder = 0; // Integer | 
    try {
      Object result = apiInstance.addHotKeywordApiV1SearchHotKeywordPost_0(keyword, isHot, sortOrder);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SearchApi#addHotKeywordApiV1SearchHotKeywordPost_0");
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
| **keyword** | **String**|  | |
| **isHot** | **Boolean**|  | [optional] [default to false] |
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

<a id="addIndexApiV1SearchIndexPost"></a>
# **addIndexApiV1SearchIndexPost**
> Object addIndexApiV1SearchIndexPost(targetType, targetId, title, content, keywords, category, tags, cover, url, userId, userName, weight)

添加/更新索引

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SearchApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SearchApi apiInstance = new SearchApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    String title = "title_example"; // String | 
    String content = "content_example"; // String | 
    String keywords = "keywords_example"; // String | 
    String category = "category_example"; // String | 
    String tags = "tags_example"; // String | 
    String cover = "cover_example"; // String | 
    String url = "url_example"; // String | 
    String userId = "userId_example"; // String | 
    String userName = "userName_example"; // String | 
    Integer weight = 0; // Integer | 
    try {
      Object result = apiInstance.addIndexApiV1SearchIndexPost(targetType, targetId, title, content, keywords, category, tags, cover, url, userId, userName, weight);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SearchApi#addIndexApiV1SearchIndexPost");
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
| **title** | **String**|  | |
| **content** | **String**|  | [optional] |
| **keywords** | **String**|  | [optional] |
| **category** | **String**|  | [optional] |
| **tags** | **String**|  | [optional] |
| **cover** | **String**|  | [optional] |
| **url** | **String**|  | [optional] |
| **userId** | **String**|  | [optional] |
| **userName** | **String**|  | [optional] |
| **weight** | **Integer**|  | [optional] [default to 0] |

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

<a id="addIndexApiV1SearchIndexPost_0"></a>
# **addIndexApiV1SearchIndexPost_0**
> Object addIndexApiV1SearchIndexPost_0(targetType, targetId, title, content, keywords, category, tags, cover, url, userId, userName, weight)

添加/更新索引

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SearchApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SearchApi apiInstance = new SearchApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    String title = "title_example"; // String | 
    String content = "content_example"; // String | 
    String keywords = "keywords_example"; // String | 
    String category = "category_example"; // String | 
    String tags = "tags_example"; // String | 
    String cover = "cover_example"; // String | 
    String url = "url_example"; // String | 
    String userId = "userId_example"; // String | 
    String userName = "userName_example"; // String | 
    Integer weight = 0; // Integer | 
    try {
      Object result = apiInstance.addIndexApiV1SearchIndexPost_0(targetType, targetId, title, content, keywords, category, tags, cover, url, userId, userName, weight);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SearchApi#addIndexApiV1SearchIndexPost_0");
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
| **title** | **String**|  | |
| **content** | **String**|  | [optional] |
| **keywords** | **String**|  | [optional] |
| **category** | **String**|  | [optional] |
| **tags** | **String**|  | [optional] |
| **cover** | **String**|  | [optional] |
| **url** | **String**|  | [optional] |
| **userId** | **String**|  | [optional] |
| **userName** | **String**|  | [optional] |
| **weight** | **Integer**|  | [optional] [default to 0] |

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

<a id="deleteByTargetApiV1SearchIndexByTargetDelete"></a>
# **deleteByTargetApiV1SearchIndexByTargetDelete**
> Object deleteByTargetApiV1SearchIndexByTargetDelete(targetType, targetId)

按目标删除索引

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SearchApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SearchApi apiInstance = new SearchApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteByTargetApiV1SearchIndexByTargetDelete(targetType, targetId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SearchApi#deleteByTargetApiV1SearchIndexByTargetDelete");
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

<a id="deleteByTargetApiV1SearchIndexByTargetDelete_0"></a>
# **deleteByTargetApiV1SearchIndexByTargetDelete_0**
> Object deleteByTargetApiV1SearchIndexByTargetDelete_0(targetType, targetId)

按目标删除索引

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SearchApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SearchApi apiInstance = new SearchApi(defaultClient);
    String targetType = "targetType_example"; // String | 
    Integer targetId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteByTargetApiV1SearchIndexByTargetDelete_0(targetType, targetId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SearchApi#deleteByTargetApiV1SearchIndexByTargetDelete_0");
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

<a id="deleteHotKeywordApiV1SearchHotKeywordKidDelete"></a>
# **deleteHotKeywordApiV1SearchHotKeywordKidDelete**
> Object deleteHotKeywordApiV1SearchHotKeywordKidDelete(kid)

删除热搜词

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SearchApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SearchApi apiInstance = new SearchApi(defaultClient);
    Integer kid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteHotKeywordApiV1SearchHotKeywordKidDelete(kid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SearchApi#deleteHotKeywordApiV1SearchHotKeywordKidDelete");
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
| **kid** | **Integer**|  | |

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

<a id="deleteHotKeywordApiV1SearchHotKeywordKidDelete_0"></a>
# **deleteHotKeywordApiV1SearchHotKeywordKidDelete_0**
> Object deleteHotKeywordApiV1SearchHotKeywordKidDelete_0(kid)

删除热搜词

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SearchApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SearchApi apiInstance = new SearchApi(defaultClient);
    Integer kid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteHotKeywordApiV1SearchHotKeywordKidDelete_0(kid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SearchApi#deleteHotKeywordApiV1SearchHotKeywordKidDelete_0");
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
| **kid** | **Integer**|  | |

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

<a id="deleteIndexApiV1SearchIndexIdxIdDelete"></a>
# **deleteIndexApiV1SearchIndexIdxIdDelete**
> Object deleteIndexApiV1SearchIndexIdxIdDelete(idxId)

删除索引

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SearchApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SearchApi apiInstance = new SearchApi(defaultClient);
    Integer idxId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteIndexApiV1SearchIndexIdxIdDelete(idxId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SearchApi#deleteIndexApiV1SearchIndexIdxIdDelete");
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
| **idxId** | **Integer**|  | |

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

<a id="deleteIndexApiV1SearchIndexIdxIdDelete_0"></a>
# **deleteIndexApiV1SearchIndexIdxIdDelete_0**
> Object deleteIndexApiV1SearchIndexIdxIdDelete_0(idxId)

删除索引

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SearchApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SearchApi apiInstance = new SearchApi(defaultClient);
    Integer idxId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteIndexApiV1SearchIndexIdxIdDelete_0(idxId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SearchApi#deleteIndexApiV1SearchIndexIdxIdDelete_0");
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
| **idxId** | **Integer**|  | |

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

<a id="hotKeywordsApiV1SearchHotGet"></a>
# **hotKeywordsApiV1SearchHotGet**
> Object hotKeywordsApiV1SearchHotGet(limit)

热搜词

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SearchApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SearchApi apiInstance = new SearchApi(defaultClient);
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.hotKeywordsApiV1SearchHotGet(limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SearchApi#hotKeywordsApiV1SearchHotGet");
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
| **limit** | **Integer**|  | [optional] [default to 20] |

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

<a id="hotKeywordsApiV1SearchHotGet_0"></a>
# **hotKeywordsApiV1SearchHotGet_0**
> Object hotKeywordsApiV1SearchHotGet_0(limit)

热搜词

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SearchApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SearchApi apiInstance = new SearchApi(defaultClient);
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.hotKeywordsApiV1SearchHotGet_0(limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SearchApi#hotKeywordsApiV1SearchHotGet_0");
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
| **limit** | **Integer**|  | [optional] [default to 20] |

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

<a id="queryApiV1SearchQueryGet"></a>
# **queryApiV1SearchQueryGet**
> Object queryApiV1SearchQueryGet(keyword, page, limit, targetType, category, orderBy)

全文搜索

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SearchApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SearchApi apiInstance = new SearchApi(defaultClient);
    String keyword = "keyword_example"; // String | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String targetType = "targetType_example"; // String | 
    String category = "category_example"; // String | 
    String orderBy = "orderBy_example"; // String | 
    try {
      Object result = apiInstance.queryApiV1SearchQueryGet(keyword, page, limit, targetType, category, orderBy);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SearchApi#queryApiV1SearchQueryGet");
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
| **keyword** | **String**|  | |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **targetType** | **String**|  | [optional] |
| **category** | **String**|  | [optional] |
| **orderBy** | **String**|  | [optional] |

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

<a id="queryApiV1SearchQueryGet_0"></a>
# **queryApiV1SearchQueryGet_0**
> Object queryApiV1SearchQueryGet_0(keyword, page, limit, targetType, category, orderBy)

全文搜索

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SearchApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SearchApi apiInstance = new SearchApi(defaultClient);
    String keyword = "keyword_example"; // String | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String targetType = "targetType_example"; // String | 
    String category = "category_example"; // String | 
    String orderBy = "orderBy_example"; // String | 
    try {
      Object result = apiInstance.queryApiV1SearchQueryGet_0(keyword, page, limit, targetType, category, orderBy);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SearchApi#queryApiV1SearchQueryGet_0");
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
| **keyword** | **String**|  | |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **targetType** | **String**|  | [optional] |
| **category** | **String**|  | [optional] |
| **orderBy** | **String**|  | [optional] |

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

<a id="searchLogList"></a>
# **searchLogList**
> Object searchLogList(page, limit, userId, keyword)

搜索日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SearchApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SearchApi apiInstance = new SearchApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String userId = "userId_example"; // String | 
    String keyword = "keyword_example"; // String | 
    try {
      Object result = apiInstance.searchLogList(page, limit, userId, keyword);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SearchApi#searchLogList");
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
| **keyword** | **String**|  | [optional] |

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

<a id="searchLogList_0"></a>
# **searchLogList_0**
> Object searchLogList_0(page, limit, userId, keyword)

搜索日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SearchApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SearchApi apiInstance = new SearchApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String userId = "userId_example"; // String | 
    String keyword = "keyword_example"; // String | 
    try {
      Object result = apiInstance.searchLogList_0(page, limit, userId, keyword);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SearchApi#searchLogList_0");
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
| **keyword** | **String**|  | [optional] |

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

<a id="suggestApiV1SearchSuggestGet"></a>
# **suggestApiV1SearchSuggestGet**
> Object suggestApiV1SearchSuggestGet(keyword, limit)

搜索建议

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SearchApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SearchApi apiInstance = new SearchApi(defaultClient);
    String keyword = "keyword_example"; // String | 
    Integer limit = 10; // Integer | 
    try {
      Object result = apiInstance.suggestApiV1SearchSuggestGet(keyword, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SearchApi#suggestApiV1SearchSuggestGet");
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
| **keyword** | **String**|  | |
| **limit** | **Integer**|  | [optional] [default to 10] |

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

<a id="suggestApiV1SearchSuggestGet_0"></a>
# **suggestApiV1SearchSuggestGet_0**
> Object suggestApiV1SearchSuggestGet_0(keyword, limit)

搜索建议

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SearchApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SearchApi apiInstance = new SearchApi(defaultClient);
    String keyword = "keyword_example"; // String | 
    Integer limit = 10; // Integer | 
    try {
      Object result = apiInstance.suggestApiV1SearchSuggestGet_0(keyword, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SearchApi#suggestApiV1SearchSuggestGet_0");
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
| **keyword** | **String**|  | |
| **limit** | **Integer**|  | [optional] [default to 10] |

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

