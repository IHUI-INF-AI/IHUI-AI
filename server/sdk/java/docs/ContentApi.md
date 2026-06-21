# ContentApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createVersionApiV1ContentVersionCreatePost**](ContentApi.md#createVersionApiV1ContentVersionCreatePost) | **POST** /api/v1/content/version/create | 创建 App 版本 |
| [**deleteFeedbackApiV1ContentFeedbackDeleteDelete**](ContentApi.md#deleteFeedbackApiV1ContentFeedbackDeleteDelete) | **DELETE** /api/v1/content/feedback/delete | 删除反馈 |
| [**deleteVersionApiV1ContentVersionDeleteDelete**](ContentApi.md#deleteVersionApiV1ContentVersionDeleteDelete) | **DELETE** /api/v1/content/version/delete | 删除 App 版本 |
| [**getAboutApiV1ContentAboutGet**](ContentApi.md#getAboutApiV1ContentAboutGet) | **GET** /api/v1/content/about | Get about us |
| [**getContactApiV1ContentContactGet**](ContentApi.md#getContactApiV1ContentContactGet) | **GET** /api/v1/content/contact | 获取联系信息 |
| [**getNewsApiV1ContentNewsNewsIdGet**](ContentApi.md#getNewsApiV1ContentNewsNewsIdGet) | **GET** /api/v1/content/news/{news_id} | Get news detail |
| [**getVersionApiV1ContentVersionGet**](ContentApi.md#getVersionApiV1ContentVersionGet) | **GET** /api/v1/content/version | Get latest app version |
| [**listBannersApiV1ContentBannersGet**](ContentApi.md#listBannersApiV1ContentBannersGet) | **GET** /api/v1/content/banners | List banners |
| [**listFeedbacksApiV1ContentFeedbackListGet**](ContentApi.md#listFeedbacksApiV1ContentFeedbackListGet) | **GET** /api/v1/content/feedback/list | 反馈列表 |
| [**listNewsApiV1ContentNewsGet**](ContentApi.md#listNewsApiV1ContentNewsGet) | **GET** /api/v1/content/news | List news |
| [**listVersionsApiV1ContentVersionListGet**](ContentApi.md#listVersionsApiV1ContentVersionListGet) | **GET** /api/v1/content/version/list | App 版本列表 |
| [**submitFeedbackApiV1ContentFeedbackPost**](ContentApi.md#submitFeedbackApiV1ContentFeedbackPost) | **POST** /api/v1/content/feedback | Submit feedback |
| [**updateFeedbackApiV1ContentFeedbackUpdatePut**](ContentApi.md#updateFeedbackApiV1ContentFeedbackUpdatePut) | **PUT** /api/v1/content/feedback/update | 更新/回复反馈 |
| [**updateVersionApiV1ContentVersionUpdatePut**](ContentApi.md#updateVersionApiV1ContentVersionUpdatePut) | **PUT** /api/v1/content/version/update | 更新 App 版本 |


<a id="createVersionApiV1ContentVersionCreatePost"></a>
# **createVersionApiV1ContentVersionCreatePost**
> Object createVersionApiV1ContentVersionCreatePost(versionCode, versionName, downloadUrl, description, platform, forceUpdate)

创建 App 版本

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ContentApi apiInstance = new ContentApi(defaultClient);
    String versionCode = "versionCode_example"; // String | 
    String versionName = "versionName_example"; // String | 
    String downloadUrl = "downloadUrl_example"; // String | 
    String description = ""; // String | 
    String platform = "android"; // String | 
    Integer forceUpdate = 0; // Integer | 0=否 1=是
    try {
      Object result = apiInstance.createVersionApiV1ContentVersionCreatePost(versionCode, versionName, downloadUrl, description, platform, forceUpdate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentApi#createVersionApiV1ContentVersionCreatePost");
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
| **versionCode** | **String**|  | |
| **versionName** | **String**|  | |
| **downloadUrl** | **String**|  | |
| **description** | **String**|  | [optional] [default to ] |
| **platform** | **String**|  | [optional] [default to android] |
| **forceUpdate** | **Integer**| 0&#x3D;否 1&#x3D;是 | [optional] [default to 0] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="deleteFeedbackApiV1ContentFeedbackDeleteDelete"></a>
# **deleteFeedbackApiV1ContentFeedbackDeleteDelete**
> Object deleteFeedbackApiV1ContentFeedbackDeleteDelete(feedbackId)

删除反馈

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ContentApi apiInstance = new ContentApi(defaultClient);
    Integer feedbackId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteFeedbackApiV1ContentFeedbackDeleteDelete(feedbackId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentApi#deleteFeedbackApiV1ContentFeedbackDeleteDelete");
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
| **feedbackId** | **Integer**|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="deleteVersionApiV1ContentVersionDeleteDelete"></a>
# **deleteVersionApiV1ContentVersionDeleteDelete**
> Object deleteVersionApiV1ContentVersionDeleteDelete(versionId)

删除 App 版本

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ContentApi apiInstance = new ContentApi(defaultClient);
    Integer versionId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteVersionApiV1ContentVersionDeleteDelete(versionId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentApi#deleteVersionApiV1ContentVersionDeleteDelete");
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
| **versionId** | **Integer**|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="getAboutApiV1ContentAboutGet"></a>
# **getAboutApiV1ContentAboutGet**
> Object getAboutApiV1ContentAboutGet()

Get about us

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentApi apiInstance = new ContentApi(defaultClient);
    try {
      Object result = apiInstance.getAboutApiV1ContentAboutGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentApi#getAboutApiV1ContentAboutGet");
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

<a id="getContactApiV1ContentContactGet"></a>
# **getContactApiV1ContentContactGet**
> Object getContactApiV1ContentContactGet()

获取联系信息

Return the active contact-us entry.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentApi apiInstance = new ContentApi(defaultClient);
    try {
      Object result = apiInstance.getContactApiV1ContentContactGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentApi#getContactApiV1ContentContactGet");
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

<a id="getNewsApiV1ContentNewsNewsIdGet"></a>
# **getNewsApiV1ContentNewsNewsIdGet**
> Object getNewsApiV1ContentNewsNewsIdGet(newsId)

Get news detail

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentApi apiInstance = new ContentApi(defaultClient);
    Integer newsId = 56; // Integer | 
    try {
      Object result = apiInstance.getNewsApiV1ContentNewsNewsIdGet(newsId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentApi#getNewsApiV1ContentNewsNewsIdGet");
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
| **newsId** | **Integer**|  | |

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

<a id="getVersionApiV1ContentVersionGet"></a>
# **getVersionApiV1ContentVersionGet**
> Object getVersionApiV1ContentVersionGet(platform)

Get latest app version

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentApi apiInstance = new ContentApi(defaultClient);
    String platform = "android"; // String | 
    try {
      Object result = apiInstance.getVersionApiV1ContentVersionGet(platform);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentApi#getVersionApiV1ContentVersionGet");
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
| **platform** | **String**|  | [optional] [default to android] |

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

<a id="listBannersApiV1ContentBannersGet"></a>
# **listBannersApiV1ContentBannersGet**
> Object listBannersApiV1ContentBannersGet(position)

List banners

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentApi apiInstance = new ContentApi(defaultClient);
    String position = "position_example"; // String | 
    try {
      Object result = apiInstance.listBannersApiV1ContentBannersGet(position);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentApi#listBannersApiV1ContentBannersGet");
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
| **position** | **String**|  | [optional] |

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

<a id="listFeedbacksApiV1ContentFeedbackListGet"></a>
# **listFeedbacksApiV1ContentFeedbackListGet**
> Object listFeedbacksApiV1ContentFeedbackListGet(page, limit, status)

反馈列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ContentApi apiInstance = new ContentApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer status = 56; // Integer | 筛选状态: 0=未处理 1=已处理
    try {
      Object result = apiInstance.listFeedbacksApiV1ContentFeedbackListGet(page, limit, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentApi#listFeedbacksApiV1ContentFeedbackListGet");
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
| **status** | **Integer**| 筛选状态: 0&#x3D;未处理 1&#x3D;已处理 | [optional] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listNewsApiV1ContentNewsGet"></a>
# **listNewsApiV1ContentNewsGet**
> Object listNewsApiV1ContentNewsGet(page, limit)

List news

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentApi apiInstance = new ContentApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listNewsApiV1ContentNewsGet(page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentApi#listNewsApiV1ContentNewsGet");
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

<a id="listVersionsApiV1ContentVersionListGet"></a>
# **listVersionsApiV1ContentVersionListGet**
> Object listVersionsApiV1ContentVersionListGet(page, limit, platform)

App 版本列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ContentApi apiInstance = new ContentApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String platform = "platform_example"; // String | 
    try {
      Object result = apiInstance.listVersionsApiV1ContentVersionListGet(page, limit, platform);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentApi#listVersionsApiV1ContentVersionListGet");
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
| **platform** | **String**|  | [optional] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="submitFeedbackApiV1ContentFeedbackPost"></a>
# **submitFeedbackApiV1ContentFeedbackPost**
> Object submitFeedbackApiV1ContentFeedbackPost(content, images, type)

Submit feedback

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ContentApi apiInstance = new ContentApi(defaultClient);
    String content = "content_example"; // String | 
    String images = "images_example"; // String | 
    String type = "type_example"; // String | 
    try {
      Object result = apiInstance.submitFeedbackApiV1ContentFeedbackPost(content, images, type);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentApi#submitFeedbackApiV1ContentFeedbackPost");
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
| **content** | **String**|  | |
| **images** | **String**|  | [optional] |
| **type** | **String**|  | [optional] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="updateFeedbackApiV1ContentFeedbackUpdatePut"></a>
# **updateFeedbackApiV1ContentFeedbackUpdatePut**
> Object updateFeedbackApiV1ContentFeedbackUpdatePut(feedbackId, status, reply)

更新/回复反馈

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ContentApi apiInstance = new ContentApi(defaultClient);
    Integer feedbackId = 56; // Integer | 
    Integer status = 56; // Integer | 
    String reply = "reply_example"; // String | 
    try {
      Object result = apiInstance.updateFeedbackApiV1ContentFeedbackUpdatePut(feedbackId, status, reply);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentApi#updateFeedbackApiV1ContentFeedbackUpdatePut");
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
| **feedbackId** | **Integer**|  | |
| **status** | **Integer**|  | [optional] |
| **reply** | **String**|  | [optional] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="updateVersionApiV1ContentVersionUpdatePut"></a>
# **updateVersionApiV1ContentVersionUpdatePut**
> Object updateVersionApiV1ContentVersionUpdatePut(versionId, versionCode, versionName, downloadUrl, description, platform, forceUpdate, status)

更新 App 版本

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ContentApi apiInstance = new ContentApi(defaultClient);
    Integer versionId = 56; // Integer | 
    String versionCode = "versionCode_example"; // String | 
    String versionName = "versionName_example"; // String | 
    String downloadUrl = "downloadUrl_example"; // String | 
    String description = "description_example"; // String | 
    String platform = "platform_example"; // String | 
    Integer forceUpdate = 56; // Integer | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.updateVersionApiV1ContentVersionUpdatePut(versionId, versionCode, versionName, downloadUrl, description, platform, forceUpdate, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentApi#updateVersionApiV1ContentVersionUpdatePut");
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
| **versionId** | **Integer**|  | |
| **versionCode** | **String**|  | [optional] |
| **versionName** | **String**|  | [optional] |
| **downloadUrl** | **String**|  | [optional] |
| **description** | **String**|  | [optional] |
| **platform** | **String**|  | [optional] |
| **forceUpdate** | **Integer**|  | [optional] |
| **status** | **Integer**|  | [optional] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

