# FeedbackApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**deleteFeedbackApiV1FeedbackFidDelete**](FeedbackApi.md#deleteFeedbackApiV1FeedbackFidDelete) | **DELETE** /api/v1/feedback/{fid} | 删除反馈 |
| [**deleteFeedbackApiV1FeedbackFidDelete_0**](FeedbackApi.md#deleteFeedbackApiV1FeedbackFidDelete_0) | **DELETE** /api/v1/feedback/{fid} | 删除反馈 |
| [**feedbackAdminList**](FeedbackApi.md#feedbackAdminList) | **GET** /api/v1/feedback/admin/list | 反馈列表(管理员) |
| [**feedbackAdminList_0**](FeedbackApi.md#feedbackAdminList_0) | **GET** /api/v1/feedback/admin/list | 反馈列表(管理员) |
| [**getFeedbackApiV1FeedbackFidGet**](FeedbackApi.md#getFeedbackApiV1FeedbackFidGet) | **GET** /api/v1/feedback/{fid} | 反馈详情 |
| [**getFeedbackApiV1FeedbackFidGet_0**](FeedbackApi.md#getFeedbackApiV1FeedbackFidGet_0) | **GET** /api/v1/feedback/{fid} | 反馈详情 |
| [**handleFeedbackApiV1FeedbackFidHandlePut**](FeedbackApi.md#handleFeedbackApiV1FeedbackFidHandlePut) | **PUT** /api/v1/feedback/{fid}/handle | 处理反馈 |
| [**handleFeedbackApiV1FeedbackFidHandlePut_0**](FeedbackApi.md#handleFeedbackApiV1FeedbackFidHandlePut_0) | **PUT** /api/v1/feedback/{fid}/handle | 处理反馈 |
| [**listMyFeedbacksApiV1FeedbackListGet**](FeedbackApi.md#listMyFeedbacksApiV1FeedbackListGet) | **GET** /api/v1/feedback/list | 我的反馈 |
| [**listMyFeedbacksApiV1FeedbackListGet_0**](FeedbackApi.md#listMyFeedbacksApiV1FeedbackListGet_0) | **GET** /api/v1/feedback/list | 我的反馈 |
| [**rateFeedbackApiV1FeedbackFidRatePost**](FeedbackApi.md#rateFeedbackApiV1FeedbackFidRatePost) | **POST** /api/v1/feedback/{fid}/rate | 评价反馈 |
| [**rateFeedbackApiV1FeedbackFidRatePost_0**](FeedbackApi.md#rateFeedbackApiV1FeedbackFidRatePost_0) | **POST** /api/v1/feedback/{fid}/rate | 评价反馈 |
| [**submitFeedbackApiV1FeedbackPost**](FeedbackApi.md#submitFeedbackApiV1FeedbackPost) | **POST** /api/v1/feedback | 提交反馈 |
| [**submitFeedbackApiV1FeedbackPost_0**](FeedbackApi.md#submitFeedbackApiV1FeedbackPost_0) | **POST** /api/v1/feedback | 提交反馈 |


<a id="deleteFeedbackApiV1FeedbackFidDelete"></a>
# **deleteFeedbackApiV1FeedbackFidDelete**
> Object deleteFeedbackApiV1FeedbackFidDelete(fid)

删除反馈

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FeedbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FeedbackApi apiInstance = new FeedbackApi(defaultClient);
    Integer fid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteFeedbackApiV1FeedbackFidDelete(fid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FeedbackApi#deleteFeedbackApiV1FeedbackFidDelete");
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
| **fid** | **Integer**|  | |

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

<a id="deleteFeedbackApiV1FeedbackFidDelete_0"></a>
# **deleteFeedbackApiV1FeedbackFidDelete_0**
> Object deleteFeedbackApiV1FeedbackFidDelete_0(fid)

删除反馈

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FeedbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FeedbackApi apiInstance = new FeedbackApi(defaultClient);
    Integer fid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteFeedbackApiV1FeedbackFidDelete_0(fid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FeedbackApi#deleteFeedbackApiV1FeedbackFidDelete_0");
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
| **fid** | **Integer**|  | |

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

<a id="feedbackAdminList"></a>
# **feedbackAdminList**
> Object feedbackAdminList(page, limit, status, type, priority)

反馈列表(管理员)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FeedbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FeedbackApi apiInstance = new FeedbackApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer status = 56; // Integer | 
    String type = "type_example"; // String | 
    Integer priority = 56; // Integer | 
    try {
      Object result = apiInstance.feedbackAdminList(page, limit, status, type, priority);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FeedbackApi#feedbackAdminList");
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
| **status** | **Integer**|  | [optional] |
| **type** | **String**|  | [optional] |
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

<a id="feedbackAdminList_0"></a>
# **feedbackAdminList_0**
> Object feedbackAdminList_0(page, limit, status, type, priority)

反馈列表(管理员)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FeedbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FeedbackApi apiInstance = new FeedbackApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer status = 56; // Integer | 
    String type = "type_example"; // String | 
    Integer priority = 56; // Integer | 
    try {
      Object result = apiInstance.feedbackAdminList_0(page, limit, status, type, priority);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FeedbackApi#feedbackAdminList_0");
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
| **status** | **Integer**|  | [optional] |
| **type** | **String**|  | [optional] |
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

<a id="getFeedbackApiV1FeedbackFidGet"></a>
# **getFeedbackApiV1FeedbackFidGet**
> Object getFeedbackApiV1FeedbackFidGet(fid)

反馈详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FeedbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FeedbackApi apiInstance = new FeedbackApi(defaultClient);
    Integer fid = 56; // Integer | 
    try {
      Object result = apiInstance.getFeedbackApiV1FeedbackFidGet(fid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FeedbackApi#getFeedbackApiV1FeedbackFidGet");
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
| **fid** | **Integer**|  | |

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

<a id="getFeedbackApiV1FeedbackFidGet_0"></a>
# **getFeedbackApiV1FeedbackFidGet_0**
> Object getFeedbackApiV1FeedbackFidGet_0(fid)

反馈详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FeedbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FeedbackApi apiInstance = new FeedbackApi(defaultClient);
    Integer fid = 56; // Integer | 
    try {
      Object result = apiInstance.getFeedbackApiV1FeedbackFidGet_0(fid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FeedbackApi#getFeedbackApiV1FeedbackFidGet_0");
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
| **fid** | **Integer**|  | |

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

<a id="handleFeedbackApiV1FeedbackFidHandlePut"></a>
# **handleFeedbackApiV1FeedbackFidHandlePut**
> Object handleFeedbackApiV1FeedbackFidHandlePut(fid, status, remark, priority, reply)

处理反馈

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FeedbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FeedbackApi apiInstance = new FeedbackApi(defaultClient);
    Integer fid = 56; // Integer | 
    Integer status = 56; // Integer | 
    String remark = "remark_example"; // String | 
    Integer priority = 56; // Integer | 
    String reply = "reply_example"; // String | 
    try {
      Object result = apiInstance.handleFeedbackApiV1FeedbackFidHandlePut(fid, status, remark, priority, reply);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FeedbackApi#handleFeedbackApiV1FeedbackFidHandlePut");
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
| **fid** | **Integer**|  | |
| **status** | **Integer**|  | |
| **remark** | **String**|  | [optional] |
| **priority** | **Integer**|  | [optional] |
| **reply** | **String**|  | [optional] |

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

<a id="handleFeedbackApiV1FeedbackFidHandlePut_0"></a>
# **handleFeedbackApiV1FeedbackFidHandlePut_0**
> Object handleFeedbackApiV1FeedbackFidHandlePut_0(fid, status, remark, priority, reply)

处理反馈

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FeedbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FeedbackApi apiInstance = new FeedbackApi(defaultClient);
    Integer fid = 56; // Integer | 
    Integer status = 56; // Integer | 
    String remark = "remark_example"; // String | 
    Integer priority = 56; // Integer | 
    String reply = "reply_example"; // String | 
    try {
      Object result = apiInstance.handleFeedbackApiV1FeedbackFidHandlePut_0(fid, status, remark, priority, reply);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FeedbackApi#handleFeedbackApiV1FeedbackFidHandlePut_0");
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
| **fid** | **Integer**|  | |
| **status** | **Integer**|  | |
| **remark** | **String**|  | [optional] |
| **priority** | **Integer**|  | [optional] |
| **reply** | **String**|  | [optional] |

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

<a id="listMyFeedbacksApiV1FeedbackListGet"></a>
# **listMyFeedbacksApiV1FeedbackListGet**
> Object listMyFeedbacksApiV1FeedbackListGet(page, limit, type, status)

我的反馈

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FeedbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FeedbackApi apiInstance = new FeedbackApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String type = "type_example"; // String | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.listMyFeedbacksApiV1FeedbackListGet(page, limit, type, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FeedbackApi#listMyFeedbacksApiV1FeedbackListGet");
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

<a id="listMyFeedbacksApiV1FeedbackListGet_0"></a>
# **listMyFeedbacksApiV1FeedbackListGet_0**
> Object listMyFeedbacksApiV1FeedbackListGet_0(page, limit, type, status)

我的反馈

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FeedbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FeedbackApi apiInstance = new FeedbackApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String type = "type_example"; // String | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.listMyFeedbacksApiV1FeedbackListGet_0(page, limit, type, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FeedbackApi#listMyFeedbacksApiV1FeedbackListGet_0");
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

<a id="rateFeedbackApiV1FeedbackFidRatePost"></a>
# **rateFeedbackApiV1FeedbackFidRatePost**
> Object rateFeedbackApiV1FeedbackFidRatePost(fid, rating)

评价反馈

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FeedbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FeedbackApi apiInstance = new FeedbackApi(defaultClient);
    Integer fid = 56; // Integer | 
    Integer rating = 56; // Integer | 
    try {
      Object result = apiInstance.rateFeedbackApiV1FeedbackFidRatePost(fid, rating);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FeedbackApi#rateFeedbackApiV1FeedbackFidRatePost");
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
| **fid** | **Integer**|  | |
| **rating** | **Integer**|  | |

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

<a id="rateFeedbackApiV1FeedbackFidRatePost_0"></a>
# **rateFeedbackApiV1FeedbackFidRatePost_0**
> Object rateFeedbackApiV1FeedbackFidRatePost_0(fid, rating)

评价反馈

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FeedbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FeedbackApi apiInstance = new FeedbackApi(defaultClient);
    Integer fid = 56; // Integer | 
    Integer rating = 56; // Integer | 
    try {
      Object result = apiInstance.rateFeedbackApiV1FeedbackFidRatePost_0(fid, rating);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FeedbackApi#rateFeedbackApiV1FeedbackFidRatePost_0");
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
| **fid** | **Integer**|  | |
| **rating** | **Integer**|  | |

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

<a id="submitFeedbackApiV1FeedbackPost"></a>
# **submitFeedbackApiV1FeedbackPost**
> Object submitFeedbackApiV1FeedbackPost(title, content, type, images, contact, appVersion, deviceInfo)

提交反馈

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FeedbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FeedbackApi apiInstance = new FeedbackApi(defaultClient);
    String title = "title_example"; // String | 
    String content = "content_example"; // String | 
    String type = "bug"; // String | 
    String images = "images_example"; // String | 
    String contact = "contact_example"; // String | 
    String appVersion = "appVersion_example"; // String | 
    String deviceInfo = "deviceInfo_example"; // String | 
    try {
      Object result = apiInstance.submitFeedbackApiV1FeedbackPost(title, content, type, images, contact, appVersion, deviceInfo);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FeedbackApi#submitFeedbackApiV1FeedbackPost");
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
| **type** | **String**|  | [optional] [default to bug] |
| **images** | **String**|  | [optional] |
| **contact** | **String**|  | [optional] |
| **appVersion** | **String**|  | [optional] |
| **deviceInfo** | **String**|  | [optional] |

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

<a id="submitFeedbackApiV1FeedbackPost_0"></a>
# **submitFeedbackApiV1FeedbackPost_0**
> Object submitFeedbackApiV1FeedbackPost_0(title, content, type, images, contact, appVersion, deviceInfo)

提交反馈

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FeedbackApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FeedbackApi apiInstance = new FeedbackApi(defaultClient);
    String title = "title_example"; // String | 
    String content = "content_example"; // String | 
    String type = "bug"; // String | 
    String images = "images_example"; // String | 
    String contact = "contact_example"; // String | 
    String appVersion = "appVersion_example"; // String | 
    String deviceInfo = "deviceInfo_example"; // String | 
    try {
      Object result = apiInstance.submitFeedbackApiV1FeedbackPost_0(title, content, type, images, contact, appVersion, deviceInfo);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FeedbackApi#submitFeedbackApiV1FeedbackPost_0");
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
| **type** | **String**|  | [optional] [default to bug] |
| **images** | **String**|  | [optional] |
| **contact** | **String**|  | [optional] |
| **appVersion** | **String**|  | [optional] |
| **deviceInfo** | **String**|  | [optional] |

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

