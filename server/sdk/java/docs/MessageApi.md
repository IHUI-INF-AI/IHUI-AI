# MessageApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**batchDeleteApiV1MessageBatchDeleteDelete**](MessageApi.md#batchDeleteApiV1MessageBatchDeleteDelete) | **DELETE** /api/v1/message/batch-delete | 批量删除 |
| [**batchDeleteApiV1MessageBatchDeleteDelete_0**](MessageApi.md#batchDeleteApiV1MessageBatchDeleteDelete_0) | **DELETE** /api/v1/message/batch-delete | 批量删除 |
| [**createAnnouncementApiV1MessageAnnouncementPost**](MessageApi.md#createAnnouncementApiV1MessageAnnouncementPost) | **POST** /api/v1/message/announcement | 发布公告 |
| [**createAnnouncementApiV1MessageAnnouncementPost_0**](MessageApi.md#createAnnouncementApiV1MessageAnnouncementPost_0) | **POST** /api/v1/message/announcement | 发布公告 |
| [**createTemplateApiV1MessageTemplatePost**](MessageApi.md#createTemplateApiV1MessageTemplatePost) | **POST** /api/v1/message/template | 新增模板 |
| [**createTemplateApiV1MessageTemplatePost_0**](MessageApi.md#createTemplateApiV1MessageTemplatePost_0) | **POST** /api/v1/message/template | 新增模板 |
| [**deleteAnnouncementApiV1MessageAnnouncementAidDelete**](MessageApi.md#deleteAnnouncementApiV1MessageAnnouncementAidDelete) | **DELETE** /api/v1/message/announcement/{aid} | 删除公告 |
| [**deleteAnnouncementApiV1MessageAnnouncementAidDelete_0**](MessageApi.md#deleteAnnouncementApiV1MessageAnnouncementAidDelete_0) | **DELETE** /api/v1/message/announcement/{aid} | 删除公告 |
| [**deleteMessageApiV1MessageMidDelete**](MessageApi.md#deleteMessageApiV1MessageMidDelete) | **DELETE** /api/v1/message/{mid} | 删除消息 |
| [**deleteMessageApiV1MessageMidDelete_0**](MessageApi.md#deleteMessageApiV1MessageMidDelete_0) | **DELETE** /api/v1/message/{mid} | 删除消息 |
| [**getAnnouncementApiV1MessageAnnouncementAidGet**](MessageApi.md#getAnnouncementApiV1MessageAnnouncementAidGet) | **GET** /api/v1/message/announcement/{aid} | 公告详情 |
| [**getAnnouncementApiV1MessageAnnouncementAidGet_0**](MessageApi.md#getAnnouncementApiV1MessageAnnouncementAidGet_0) | **GET** /api/v1/message/announcement/{aid} | 公告详情 |
| [**listAnnouncementsApiV1MessageAnnouncementListGet**](MessageApi.md#listAnnouncementsApiV1MessageAnnouncementListGet) | **GET** /api/v1/message/announcement/list | 公告列表 |
| [**listAnnouncementsApiV1MessageAnnouncementListGet_0**](MessageApi.md#listAnnouncementsApiV1MessageAnnouncementListGet_0) | **GET** /api/v1/message/announcement/list | 公告列表 |
| [**listMessagesApiV1MessageListGet**](MessageApi.md#listMessagesApiV1MessageListGet) | **GET** /api/v1/message/list | 我的消息列表 |
| [**listMessagesApiV1MessageListGet_0**](MessageApi.md#listMessagesApiV1MessageListGet_0) | **GET** /api/v1/message/list | 我的消息列表 |
| [**markReadApiV1MessageMidReadPost**](MessageApi.md#markReadApiV1MessageMidReadPost) | **POST** /api/v1/message/{mid}/read | 标记已读 |
| [**markReadApiV1MessageMidReadPost_0**](MessageApi.md#markReadApiV1MessageMidReadPost_0) | **POST** /api/v1/message/{mid}/read | 标记已读 |
| [**messageMarkAllRead**](MessageApi.md#messageMarkAllRead) | **POST** /api/v1/message/read-all | 全部标记已读 |
| [**messageMarkAllRead_0**](MessageApi.md#messageMarkAllRead_0) | **POST** /api/v1/message/read-all | 全部标记已读 |
| [**messageUnreadCount**](MessageApi.md#messageUnreadCount) | **GET** /api/v1/message/unread-count | 未读消息数 |
| [**messageUnreadCount_0**](MessageApi.md#messageUnreadCount_0) | **GET** /api/v1/message/unread-count | 未读消息数 |
| [**sendPrivateApiV1MessagePrivatePost**](MessageApi.md#sendPrivateApiV1MessagePrivatePost) | **POST** /api/v1/message/private | 发送私信 |
| [**sendPrivateApiV1MessagePrivatePost_0**](MessageApi.md#sendPrivateApiV1MessagePrivatePost_0) | **POST** /api/v1/message/private | 发送私信 |
| [**templateListApiV1MessageTemplateListGet**](MessageApi.md#templateListApiV1MessageTemplateListGet) | **GET** /api/v1/message/template/list | 消息模板列表 |
| [**templateListApiV1MessageTemplateListGet_0**](MessageApi.md#templateListApiV1MessageTemplateListGet_0) | **GET** /api/v1/message/template/list | 消息模板列表 |
| [**updateAnnouncementApiV1MessageAnnouncementAidPut**](MessageApi.md#updateAnnouncementApiV1MessageAnnouncementAidPut) | **PUT** /api/v1/message/announcement/{aid} | 修改公告 |
| [**updateAnnouncementApiV1MessageAnnouncementAidPut_0**](MessageApi.md#updateAnnouncementApiV1MessageAnnouncementAidPut_0) | **PUT** /api/v1/message/announcement/{aid} | 修改公告 |


<a id="batchDeleteApiV1MessageBatchDeleteDelete"></a>
# **batchDeleteApiV1MessageBatchDeleteDelete**
> Object batchDeleteApiV1MessageBatchDeleteDelete(ids)

批量删除

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    String ids = "ids_example"; // String | ID列表,逗号分隔
    try {
      Object result = apiInstance.batchDeleteApiV1MessageBatchDeleteDelete(ids);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#batchDeleteApiV1MessageBatchDeleteDelete");
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
| **ids** | **String**| ID列表,逗号分隔 | |

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

<a id="batchDeleteApiV1MessageBatchDeleteDelete_0"></a>
# **batchDeleteApiV1MessageBatchDeleteDelete_0**
> Object batchDeleteApiV1MessageBatchDeleteDelete_0(ids)

批量删除

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    String ids = "ids_example"; // String | ID列表,逗号分隔
    try {
      Object result = apiInstance.batchDeleteApiV1MessageBatchDeleteDelete_0(ids);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#batchDeleteApiV1MessageBatchDeleteDelete_0");
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
| **ids** | **String**| ID列表,逗号分隔 | |

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

<a id="createAnnouncementApiV1MessageAnnouncementPost"></a>
# **createAnnouncementApiV1MessageAnnouncementPost**
> Object createAnnouncementApiV1MessageAnnouncementPost(title, content, cover, type, priority, targetUser, targetUrl, publishTime, expireTime)

发布公告

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    String title = "title_example"; // String | 
    String content = "content_example"; // String | 
    String cover = "cover_example"; // String | 
    Integer type = 1; // Integer | 
    Integer priority = 1; // Integer | 
    String targetUser = "all"; // String | 
    String targetUrl = "targetUrl_example"; // String | 
    OffsetDateTime publishTime = OffsetDateTime.now(); // OffsetDateTime | 
    OffsetDateTime expireTime = OffsetDateTime.now(); // OffsetDateTime | 
    try {
      Object result = apiInstance.createAnnouncementApiV1MessageAnnouncementPost(title, content, cover, type, priority, targetUser, targetUrl, publishTime, expireTime);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#createAnnouncementApiV1MessageAnnouncementPost");
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
| **content** | **String**|  | |
| **cover** | **String**|  | [optional] |
| **type** | **Integer**|  | [optional] [default to 1] |
| **priority** | **Integer**|  | [optional] [default to 1] |
| **targetUser** | **String**|  | [optional] [default to all] |
| **targetUrl** | **String**|  | [optional] |
| **publishTime** | **OffsetDateTime**|  | [optional] |
| **expireTime** | **OffsetDateTime**|  | [optional] |

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

<a id="createAnnouncementApiV1MessageAnnouncementPost_0"></a>
# **createAnnouncementApiV1MessageAnnouncementPost_0**
> Object createAnnouncementApiV1MessageAnnouncementPost_0(title, content, cover, type, priority, targetUser, targetUrl, publishTime, expireTime)

发布公告

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    String title = "title_example"; // String | 
    String content = "content_example"; // String | 
    String cover = "cover_example"; // String | 
    Integer type = 1; // Integer | 
    Integer priority = 1; // Integer | 
    String targetUser = "all"; // String | 
    String targetUrl = "targetUrl_example"; // String | 
    OffsetDateTime publishTime = OffsetDateTime.now(); // OffsetDateTime | 
    OffsetDateTime expireTime = OffsetDateTime.now(); // OffsetDateTime | 
    try {
      Object result = apiInstance.createAnnouncementApiV1MessageAnnouncementPost_0(title, content, cover, type, priority, targetUser, targetUrl, publishTime, expireTime);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#createAnnouncementApiV1MessageAnnouncementPost_0");
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
| **content** | **String**|  | |
| **cover** | **String**|  | [optional] |
| **type** | **Integer**|  | [optional] [default to 1] |
| **priority** | **Integer**|  | [optional] [default to 1] |
| **targetUser** | **String**|  | [optional] [default to all] |
| **targetUrl** | **String**|  | [optional] |
| **publishTime** | **OffsetDateTime**|  | [optional] |
| **expireTime** | **OffsetDateTime**|  | [optional] |

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

<a id="createTemplateApiV1MessageTemplatePost"></a>
# **createTemplateApiV1MessageTemplatePost**
> Object createTemplateApiV1MessageTemplatePost(code, name, type, content, subject, variables)

新增模板

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    String code = "code_example"; // String | 
    String name = "name_example"; // String | 
    String type = "type_example"; // String | 
    String content = "content_example"; // String | 
    String subject = "subject_example"; // String | 
    String variables = "variables_example"; // String | 
    try {
      Object result = apiInstance.createTemplateApiV1MessageTemplatePost(code, name, type, content, subject, variables);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#createTemplateApiV1MessageTemplatePost");
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
| **code** | **String**|  | |
| **name** | **String**|  | |
| **type** | **String**|  | |
| **content** | **String**|  | |
| **subject** | **String**|  | [optional] |
| **variables** | **String**|  | [optional] |

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

<a id="createTemplateApiV1MessageTemplatePost_0"></a>
# **createTemplateApiV1MessageTemplatePost_0**
> Object createTemplateApiV1MessageTemplatePost_0(code, name, type, content, subject, variables)

新增模板

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    String code = "code_example"; // String | 
    String name = "name_example"; // String | 
    String type = "type_example"; // String | 
    String content = "content_example"; // String | 
    String subject = "subject_example"; // String | 
    String variables = "variables_example"; // String | 
    try {
      Object result = apiInstance.createTemplateApiV1MessageTemplatePost_0(code, name, type, content, subject, variables);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#createTemplateApiV1MessageTemplatePost_0");
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
| **code** | **String**|  | |
| **name** | **String**|  | |
| **type** | **String**|  | |
| **content** | **String**|  | |
| **subject** | **String**|  | [optional] |
| **variables** | **String**|  | [optional] |

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

<a id="deleteAnnouncementApiV1MessageAnnouncementAidDelete"></a>
# **deleteAnnouncementApiV1MessageAnnouncementAidDelete**
> Object deleteAnnouncementApiV1MessageAnnouncementAidDelete(aid)

删除公告

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    Integer aid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteAnnouncementApiV1MessageAnnouncementAidDelete(aid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#deleteAnnouncementApiV1MessageAnnouncementAidDelete");
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
| **aid** | **Integer**|  | |

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

<a id="deleteAnnouncementApiV1MessageAnnouncementAidDelete_0"></a>
# **deleteAnnouncementApiV1MessageAnnouncementAidDelete_0**
> Object deleteAnnouncementApiV1MessageAnnouncementAidDelete_0(aid)

删除公告

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    Integer aid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteAnnouncementApiV1MessageAnnouncementAidDelete_0(aid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#deleteAnnouncementApiV1MessageAnnouncementAidDelete_0");
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
| **aid** | **Integer**|  | |

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

<a id="deleteMessageApiV1MessageMidDelete"></a>
# **deleteMessageApiV1MessageMidDelete**
> Object deleteMessageApiV1MessageMidDelete(mid)

删除消息

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    Integer mid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteMessageApiV1MessageMidDelete(mid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#deleteMessageApiV1MessageMidDelete");
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
| **mid** | **Integer**|  | |

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

<a id="deleteMessageApiV1MessageMidDelete_0"></a>
# **deleteMessageApiV1MessageMidDelete_0**
> Object deleteMessageApiV1MessageMidDelete_0(mid)

删除消息

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    Integer mid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteMessageApiV1MessageMidDelete_0(mid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#deleteMessageApiV1MessageMidDelete_0");
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
| **mid** | **Integer**|  | |

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

<a id="getAnnouncementApiV1MessageAnnouncementAidGet"></a>
# **getAnnouncementApiV1MessageAnnouncementAidGet**
> Object getAnnouncementApiV1MessageAnnouncementAidGet(aid)

公告详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    Integer aid = 56; // Integer | 
    try {
      Object result = apiInstance.getAnnouncementApiV1MessageAnnouncementAidGet(aid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#getAnnouncementApiV1MessageAnnouncementAidGet");
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
| **aid** | **Integer**|  | |

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

<a id="getAnnouncementApiV1MessageAnnouncementAidGet_0"></a>
# **getAnnouncementApiV1MessageAnnouncementAidGet_0**
> Object getAnnouncementApiV1MessageAnnouncementAidGet_0(aid)

公告详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    Integer aid = 56; // Integer | 
    try {
      Object result = apiInstance.getAnnouncementApiV1MessageAnnouncementAidGet_0(aid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#getAnnouncementApiV1MessageAnnouncementAidGet_0");
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
| **aid** | **Integer**|  | |

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

<a id="listAnnouncementsApiV1MessageAnnouncementListGet"></a>
# **listAnnouncementsApiV1MessageAnnouncementListGet**
> Object listAnnouncementsApiV1MessageAnnouncementListGet(page, limit, type)

公告列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer type = 56; // Integer | 
    try {
      Object result = apiInstance.listAnnouncementsApiV1MessageAnnouncementListGet(page, limit, type);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#listAnnouncementsApiV1MessageAnnouncementListGet");
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
| **type** | **Integer**|  | [optional] |

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

<a id="listAnnouncementsApiV1MessageAnnouncementListGet_0"></a>
# **listAnnouncementsApiV1MessageAnnouncementListGet_0**
> Object listAnnouncementsApiV1MessageAnnouncementListGet_0(page, limit, type)

公告列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer type = 56; // Integer | 
    try {
      Object result = apiInstance.listAnnouncementsApiV1MessageAnnouncementListGet_0(page, limit, type);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#listAnnouncementsApiV1MessageAnnouncementListGet_0");
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
| **type** | **Integer**|  | [optional] |

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

<a id="listMessagesApiV1MessageListGet"></a>
# **listMessagesApiV1MessageListGet**
> Object listMessagesApiV1MessageListGet(page, limit, type, isRead)

我的消息列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String type = "type_example"; // String | 
    Boolean isRead = true; // Boolean | 
    try {
      Object result = apiInstance.listMessagesApiV1MessageListGet(page, limit, type, isRead);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#listMessagesApiV1MessageListGet");
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
| **type** | **String**|  | [optional] |
| **isRead** | **Boolean**|  | [optional] |

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

<a id="listMessagesApiV1MessageListGet_0"></a>
# **listMessagesApiV1MessageListGet_0**
> Object listMessagesApiV1MessageListGet_0(page, limit, type, isRead)

我的消息列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String type = "type_example"; // String | 
    Boolean isRead = true; // Boolean | 
    try {
      Object result = apiInstance.listMessagesApiV1MessageListGet_0(page, limit, type, isRead);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#listMessagesApiV1MessageListGet_0");
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
| **type** | **String**|  | [optional] |
| **isRead** | **Boolean**|  | [optional] |

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

<a id="markReadApiV1MessageMidReadPost"></a>
# **markReadApiV1MessageMidReadPost**
> Object markReadApiV1MessageMidReadPost(mid)

标记已读

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    Integer mid = 56; // Integer | 
    try {
      Object result = apiInstance.markReadApiV1MessageMidReadPost(mid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#markReadApiV1MessageMidReadPost");
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
| **mid** | **Integer**|  | |

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

<a id="markReadApiV1MessageMidReadPost_0"></a>
# **markReadApiV1MessageMidReadPost_0**
> Object markReadApiV1MessageMidReadPost_0(mid)

标记已读

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    Integer mid = 56; // Integer | 
    try {
      Object result = apiInstance.markReadApiV1MessageMidReadPost_0(mid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#markReadApiV1MessageMidReadPost_0");
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
| **mid** | **Integer**|  | |

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

<a id="messageMarkAllRead"></a>
# **messageMarkAllRead**
> Object messageMarkAllRead()

全部标记已读

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    try {
      Object result = apiInstance.messageMarkAllRead();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#messageMarkAllRead");
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

<a id="messageMarkAllRead_0"></a>
# **messageMarkAllRead_0**
> Object messageMarkAllRead_0()

全部标记已读

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    try {
      Object result = apiInstance.messageMarkAllRead_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#messageMarkAllRead_0");
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

<a id="messageUnreadCount"></a>
# **messageUnreadCount**
> Object messageUnreadCount()

未读消息数

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    try {
      Object result = apiInstance.messageUnreadCount();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#messageUnreadCount");
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

<a id="messageUnreadCount_0"></a>
# **messageUnreadCount_0**
> Object messageUnreadCount_0()

未读消息数

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    try {
      Object result = apiInstance.messageUnreadCount_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#messageUnreadCount_0");
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

<a id="sendPrivateApiV1MessagePrivatePost"></a>
# **sendPrivateApiV1MessagePrivatePost**
> Object sendPrivateApiV1MessagePrivatePost(toUserId, content, title)

发送私信

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    String toUserId = "toUserId_example"; // String | 
    String content = "content_example"; // String | 
    String title = "title_example"; // String | 
    try {
      Object result = apiInstance.sendPrivateApiV1MessagePrivatePost(toUserId, content, title);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#sendPrivateApiV1MessagePrivatePost");
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
| **toUserId** | **String**|  | |
| **content** | **String**|  | |
| **title** | **String**|  | [optional] |

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

<a id="sendPrivateApiV1MessagePrivatePost_0"></a>
# **sendPrivateApiV1MessagePrivatePost_0**
> Object sendPrivateApiV1MessagePrivatePost_0(toUserId, content, title)

发送私信

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    String toUserId = "toUserId_example"; // String | 
    String content = "content_example"; // String | 
    String title = "title_example"; // String | 
    try {
      Object result = apiInstance.sendPrivateApiV1MessagePrivatePost_0(toUserId, content, title);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#sendPrivateApiV1MessagePrivatePost_0");
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
| **toUserId** | **String**|  | |
| **content** | **String**|  | |
| **title** | **String**|  | [optional] |

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

<a id="templateListApiV1MessageTemplateListGet"></a>
# **templateListApiV1MessageTemplateListGet**
> Object templateListApiV1MessageTemplateListGet(type)

消息模板列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    String type = "type_example"; // String | 
    try {
      Object result = apiInstance.templateListApiV1MessageTemplateListGet(type);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#templateListApiV1MessageTemplateListGet");
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
| **type** | **String**|  | [optional] |

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

<a id="templateListApiV1MessageTemplateListGet_0"></a>
# **templateListApiV1MessageTemplateListGet_0**
> Object templateListApiV1MessageTemplateListGet_0(type)

消息模板列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    String type = "type_example"; // String | 
    try {
      Object result = apiInstance.templateListApiV1MessageTemplateListGet_0(type);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#templateListApiV1MessageTemplateListGet_0");
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
| **type** | **String**|  | [optional] |

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

<a id="updateAnnouncementApiV1MessageAnnouncementAidPut"></a>
# **updateAnnouncementApiV1MessageAnnouncementAidPut**
> Object updateAnnouncementApiV1MessageAnnouncementAidPut(aid, title, content, status, priority)

修改公告

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    Integer aid = 56; // Integer | 
    String title = "title_example"; // String | 
    String content = "content_example"; // String | 
    Integer status = 56; // Integer | 
    Integer priority = 56; // Integer | 
    try {
      Object result = apiInstance.updateAnnouncementApiV1MessageAnnouncementAidPut(aid, title, content, status, priority);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#updateAnnouncementApiV1MessageAnnouncementAidPut");
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
| **aid** | **Integer**|  | |
| **title** | **String**|  | [optional] |
| **content** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **priority** | **Integer**|  | [optional] |

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

<a id="updateAnnouncementApiV1MessageAnnouncementAidPut_0"></a>
# **updateAnnouncementApiV1MessageAnnouncementAidPut_0**
> Object updateAnnouncementApiV1MessageAnnouncementAidPut_0(aid, title, content, status, priority)

修改公告

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MessageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    MessageApi apiInstance = new MessageApi(defaultClient);
    Integer aid = 56; // Integer | 
    String title = "title_example"; // String | 
    String content = "content_example"; // String | 
    Integer status = 56; // Integer | 
    Integer priority = 56; // Integer | 
    try {
      Object result = apiInstance.updateAnnouncementApiV1MessageAnnouncementAidPut_0(aid, title, content, status, priority);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MessageApi#updateAnnouncementApiV1MessageAnnouncementAidPut_0");
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
| **aid** | **Integer**|  | |
| **title** | **String**|  | [optional] |
| **content** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **priority** | **Integer**|  | [optional] |

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

