# LiveApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addCommentApiV1LiveChannelCidCommentPost**](LiveApi.md#addCommentApiV1LiveChannelCidCommentPost) | **POST** /api/v1/live/channel/{cid}/comment | 发表评论 |
| [**addCommentApiV1LiveChannelCidCommentPost_0**](LiveApi.md#addCommentApiV1LiveChannelCidCommentPost_0) | **POST** /api/v1/live/channel/{cid}/comment | 发表评论 |
| [**getChannelApiV1LiveChannelCidGet**](LiveApi.md#getChannelApiV1LiveChannelCidGet) | **GET** /api/v1/live/channel/{cid} | 直播详情 |
| [**getChannelApiV1LiveChannelCidGet_0**](LiveApi.md#getChannelApiV1LiveChannelCidGet_0) | **GET** /api/v1/live/channel/{cid} | 直播详情 |
| [**listChannelsApiV1LiveChannelListGet**](LiveApi.md#listChannelsApiV1LiveChannelListGet) | **GET** /api/v1/live/channel/list | 直播列表 |
| [**listChannelsApiV1LiveChannelListGet_0**](LiveApi.md#listChannelsApiV1LiveChannelListGet_0) | **GET** /api/v1/live/channel/list | 直播列表 |
| [**listCommentsApiV1LiveChannelCidCommentsGet**](LiveApi.md#listCommentsApiV1LiveChannelCidCommentsGet) | **GET** /api/v1/live/channel/{cid}/comments | 评论列表 |
| [**listCommentsApiV1LiveChannelCidCommentsGet_0**](LiveApi.md#listCommentsApiV1LiveChannelCidCommentsGet_0) | **GET** /api/v1/live/channel/{cid}/comments | 评论列表 |
| [**liveChannelCategoryList**](LiveApi.md#liveChannelCategoryList) | **GET** /api/v1/live/category/list | 直播分类 |
| [**liveChannelCategoryList_0**](LiveApi.md#liveChannelCategoryList_0) | **GET** /api/v1/live/category/list | 直播分类 |
| [**liveCreateChannel**](LiveApi.md#liveCreateChannel) | **POST** /api/v1/live/channel | 创建直播 |
| [**liveCreateChannel_0**](LiveApi.md#liveCreateChannel_0) | **POST** /api/v1/live/channel | 创建直播 |
| [**liveDeleteChannel**](LiveApi.md#liveDeleteChannel) | **DELETE** /api/v1/live/channel/{cid} | 删除直播 |
| [**liveDeleteChannel_0**](LiveApi.md#liveDeleteChannel_0) | **DELETE** /api/v1/live/channel/{cid} | 删除直播 |
| [**liveUpdateChannel**](LiveApi.md#liveUpdateChannel) | **PUT** /api/v1/live/channel/{cid} | 修改直播 |
| [**liveUpdateChannel_0**](LiveApi.md#liveUpdateChannel_0) | **PUT** /api/v1/live/channel/{cid} | 修改直播 |
| [**startLiveApiV1LiveChannelCidStartPost**](LiveApi.md#startLiveApiV1LiveChannelCidStartPost) | **POST** /api/v1/live/channel/{cid}/start | 开始直播 |
| [**startLiveApiV1LiveChannelCidStartPost_0**](LiveApi.md#startLiveApiV1LiveChannelCidStartPost_0) | **POST** /api/v1/live/channel/{cid}/start | 开始直播 |
| [**stopLiveApiV1LiveChannelCidStopPost**](LiveApi.md#stopLiveApiV1LiveChannelCidStopPost) | **POST** /api/v1/live/channel/{cid}/stop | 结束直播 |
| [**stopLiveApiV1LiveChannelCidStopPost_0**](LiveApi.md#stopLiveApiV1LiveChannelCidStopPost_0) | **POST** /api/v1/live/channel/{cid}/stop | 结束直播 |
| [**toggleSubscribeApiV1LiveChannelCidSubscribePost**](LiveApi.md#toggleSubscribeApiV1LiveChannelCidSubscribePost) | **POST** /api/v1/live/channel/{cid}/subscribe | 订阅/取消订阅 |
| [**toggleSubscribeApiV1LiveChannelCidSubscribePost_0**](LiveApi.md#toggleSubscribeApiV1LiveChannelCidSubscribePost_0) | **POST** /api/v1/live/channel/{cid}/subscribe | 订阅/取消订阅 |


<a id="addCommentApiV1LiveChannelCidCommentPost"></a>
# **addCommentApiV1LiveChannelCidCommentPost**
> Object addCommentApiV1LiveChannelCidCommentPost(cid, content, type)

发表评论

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    Integer cid = 56; // Integer | 
    String content = "content_example"; // String | 
    Integer type = 1; // Integer | 
    try {
      Object result = apiInstance.addCommentApiV1LiveChannelCidCommentPost(cid, content, type);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#addCommentApiV1LiveChannelCidCommentPost");
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
| **cid** | **Integer**|  | |
| **content** | **String**|  | |
| **type** | **Integer**|  | [optional] [default to 1] |

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

<a id="addCommentApiV1LiveChannelCidCommentPost_0"></a>
# **addCommentApiV1LiveChannelCidCommentPost_0**
> Object addCommentApiV1LiveChannelCidCommentPost_0(cid, content, type)

发表评论

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    Integer cid = 56; // Integer | 
    String content = "content_example"; // String | 
    Integer type = 1; // Integer | 
    try {
      Object result = apiInstance.addCommentApiV1LiveChannelCidCommentPost_0(cid, content, type);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#addCommentApiV1LiveChannelCidCommentPost_0");
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
| **cid** | **Integer**|  | |
| **content** | **String**|  | |
| **type** | **Integer**|  | [optional] [default to 1] |

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

<a id="getChannelApiV1LiveChannelCidGet"></a>
# **getChannelApiV1LiveChannelCidGet**
> Object getChannelApiV1LiveChannelCidGet(cid)

直播详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.getChannelApiV1LiveChannelCidGet(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#getChannelApiV1LiveChannelCidGet");
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
| **cid** | **Integer**|  | |

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

<a id="getChannelApiV1LiveChannelCidGet_0"></a>
# **getChannelApiV1LiveChannelCidGet_0**
> Object getChannelApiV1LiveChannelCidGet_0(cid)

直播详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.getChannelApiV1LiveChannelCidGet_0(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#getChannelApiV1LiveChannelCidGet_0");
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
| **cid** | **Integer**|  | |

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

<a id="listChannelsApiV1LiveChannelListGet"></a>
# **listChannelsApiV1LiveChannelListGet**
> Object listChannelsApiV1LiveChannelListGet(page, limit, status, categoryId, hostId, keyword)

直播列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer status = 56; // Integer | 
    Integer categoryId = 56; // Integer | 
    String hostId = "hostId_example"; // String | 
    String keyword = "keyword_example"; // String | 
    try {
      Object result = apiInstance.listChannelsApiV1LiveChannelListGet(page, limit, status, categoryId, hostId, keyword);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#listChannelsApiV1LiveChannelListGet");
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
| **categoryId** | **Integer**|  | [optional] |
| **hostId** | **String**|  | [optional] |
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

<a id="listChannelsApiV1LiveChannelListGet_0"></a>
# **listChannelsApiV1LiveChannelListGet_0**
> Object listChannelsApiV1LiveChannelListGet_0(page, limit, status, categoryId, hostId, keyword)

直播列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer status = 56; // Integer | 
    Integer categoryId = 56; // Integer | 
    String hostId = "hostId_example"; // String | 
    String keyword = "keyword_example"; // String | 
    try {
      Object result = apiInstance.listChannelsApiV1LiveChannelListGet_0(page, limit, status, categoryId, hostId, keyword);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#listChannelsApiV1LiveChannelListGet_0");
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
| **categoryId** | **Integer**|  | [optional] |
| **hostId** | **String**|  | [optional] |
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

<a id="listCommentsApiV1LiveChannelCidCommentsGet"></a>
# **listCommentsApiV1LiveChannelCidCommentsGet**
> Object listCommentsApiV1LiveChannelCidCommentsGet(cid, page, limit)

评论列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    Integer cid = 56; // Integer | 
    Integer page = 1; // Integer | 
    Integer limit = 50; // Integer | 
    try {
      Object result = apiInstance.listCommentsApiV1LiveChannelCidCommentsGet(cid, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#listCommentsApiV1LiveChannelCidCommentsGet");
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
| **cid** | **Integer**|  | |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 50] |

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

<a id="listCommentsApiV1LiveChannelCidCommentsGet_0"></a>
# **listCommentsApiV1LiveChannelCidCommentsGet_0**
> Object listCommentsApiV1LiveChannelCidCommentsGet_0(cid, page, limit)

评论列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    Integer cid = 56; // Integer | 
    Integer page = 1; // Integer | 
    Integer limit = 50; // Integer | 
    try {
      Object result = apiInstance.listCommentsApiV1LiveChannelCidCommentsGet_0(cid, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#listCommentsApiV1LiveChannelCidCommentsGet_0");
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
| **cid** | **Integer**|  | |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 50] |

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

<a id="liveChannelCategoryList"></a>
# **liveChannelCategoryList**
> Object liveChannelCategoryList()

直播分类

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    try {
      Object result = apiInstance.liveChannelCategoryList();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#liveChannelCategoryList");
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

<a id="liveChannelCategoryList_0"></a>
# **liveChannelCategoryList_0**
> Object liveChannelCategoryList_0()

直播分类

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    try {
      Object result = apiInstance.liveChannelCategoryList_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#liveChannelCategoryList_0");
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

<a id="liveCreateChannel"></a>
# **liveCreateChannel**
> Object liveCreateChannel(title, description, cover, categoryId, type, price, planStartTime, planDuration)

创建直播

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    String title = "title_example"; // String | 
    String description = "description_example"; // String | 
    String cover = "cover_example"; // String | 
    Integer categoryId = 56; // Integer | 
    Integer type = 1; // Integer | 
    Integer price = 0; // Integer | 
    OffsetDateTime planStartTime = OffsetDateTime.now(); // OffsetDateTime | 
    Integer planDuration = 60; // Integer | 
    try {
      Object result = apiInstance.liveCreateChannel(title, description, cover, categoryId, type, price, planStartTime, planDuration);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#liveCreateChannel");
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
| **cover** | **String**|  | [optional] |
| **categoryId** | **Integer**|  | [optional] |
| **type** | **Integer**|  | [optional] [default to 1] |
| **price** | **Integer**|  | [optional] [default to 0] |
| **planStartTime** | **OffsetDateTime**|  | [optional] |
| **planDuration** | **Integer**|  | [optional] [default to 60] |

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

<a id="liveCreateChannel_0"></a>
# **liveCreateChannel_0**
> Object liveCreateChannel_0(title, description, cover, categoryId, type, price, planStartTime, planDuration)

创建直播

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    String title = "title_example"; // String | 
    String description = "description_example"; // String | 
    String cover = "cover_example"; // String | 
    Integer categoryId = 56; // Integer | 
    Integer type = 1; // Integer | 
    Integer price = 0; // Integer | 
    OffsetDateTime planStartTime = OffsetDateTime.now(); // OffsetDateTime | 
    Integer planDuration = 60; // Integer | 
    try {
      Object result = apiInstance.liveCreateChannel_0(title, description, cover, categoryId, type, price, planStartTime, planDuration);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#liveCreateChannel_0");
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
| **cover** | **String**|  | [optional] |
| **categoryId** | **Integer**|  | [optional] |
| **type** | **Integer**|  | [optional] [default to 1] |
| **price** | **Integer**|  | [optional] [default to 0] |
| **planStartTime** | **OffsetDateTime**|  | [optional] |
| **planDuration** | **Integer**|  | [optional] [default to 60] |

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

<a id="liveDeleteChannel"></a>
# **liveDeleteChannel**
> Object liveDeleteChannel(cid)

删除直播

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.liveDeleteChannel(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#liveDeleteChannel");
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
| **cid** | **Integer**|  | |

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

<a id="liveDeleteChannel_0"></a>
# **liveDeleteChannel_0**
> Object liveDeleteChannel_0(cid)

删除直播

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.liveDeleteChannel_0(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#liveDeleteChannel_0");
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
| **cid** | **Integer**|  | |

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

<a id="liveUpdateChannel"></a>
# **liveUpdateChannel**
> Object liveUpdateChannel(cid, title, description, cover, planStartTime)

修改直播

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    Integer cid = 56; // Integer | 
    String title = "title_example"; // String | 
    String description = "description_example"; // String | 
    String cover = "cover_example"; // String | 
    OffsetDateTime planStartTime = OffsetDateTime.now(); // OffsetDateTime | 
    try {
      Object result = apiInstance.liveUpdateChannel(cid, title, description, cover, planStartTime);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#liveUpdateChannel");
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
| **cid** | **Integer**|  | |
| **title** | **String**|  | [optional] |
| **description** | **String**|  | [optional] |
| **cover** | **String**|  | [optional] |
| **planStartTime** | **OffsetDateTime**|  | [optional] |

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

<a id="liveUpdateChannel_0"></a>
# **liveUpdateChannel_0**
> Object liveUpdateChannel_0(cid, title, description, cover, planStartTime)

修改直播

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    Integer cid = 56; // Integer | 
    String title = "title_example"; // String | 
    String description = "description_example"; // String | 
    String cover = "cover_example"; // String | 
    OffsetDateTime planStartTime = OffsetDateTime.now(); // OffsetDateTime | 
    try {
      Object result = apiInstance.liveUpdateChannel_0(cid, title, description, cover, planStartTime);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#liveUpdateChannel_0");
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
| **cid** | **Integer**|  | |
| **title** | **String**|  | [optional] |
| **description** | **String**|  | [optional] |
| **cover** | **String**|  | [optional] |
| **planStartTime** | **OffsetDateTime**|  | [optional] |

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

<a id="startLiveApiV1LiveChannelCidStartPost"></a>
# **startLiveApiV1LiveChannelCidStartPost**
> Object startLiveApiV1LiveChannelCidStartPost(cid)

开始直播

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.startLiveApiV1LiveChannelCidStartPost(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#startLiveApiV1LiveChannelCidStartPost");
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
| **cid** | **Integer**|  | |

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

<a id="startLiveApiV1LiveChannelCidStartPost_0"></a>
# **startLiveApiV1LiveChannelCidStartPost_0**
> Object startLiveApiV1LiveChannelCidStartPost_0(cid)

开始直播

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.startLiveApiV1LiveChannelCidStartPost_0(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#startLiveApiV1LiveChannelCidStartPost_0");
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
| **cid** | **Integer**|  | |

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

<a id="stopLiveApiV1LiveChannelCidStopPost"></a>
# **stopLiveApiV1LiveChannelCidStopPost**
> Object stopLiveApiV1LiveChannelCidStopPost(cid)

结束直播

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.stopLiveApiV1LiveChannelCidStopPost(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#stopLiveApiV1LiveChannelCidStopPost");
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
| **cid** | **Integer**|  | |

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

<a id="stopLiveApiV1LiveChannelCidStopPost_0"></a>
# **stopLiveApiV1LiveChannelCidStopPost_0**
> Object stopLiveApiV1LiveChannelCidStopPost_0(cid)

结束直播

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.stopLiveApiV1LiveChannelCidStopPost_0(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#stopLiveApiV1LiveChannelCidStopPost_0");
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
| **cid** | **Integer**|  | |

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

<a id="toggleSubscribeApiV1LiveChannelCidSubscribePost"></a>
# **toggleSubscribeApiV1LiveChannelCidSubscribePost**
> Object toggleSubscribeApiV1LiveChannelCidSubscribePost(cid)

订阅/取消订阅

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.toggleSubscribeApiV1LiveChannelCidSubscribePost(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#toggleSubscribeApiV1LiveChannelCidSubscribePost");
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
| **cid** | **Integer**|  | |

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

<a id="toggleSubscribeApiV1LiveChannelCidSubscribePost_0"></a>
# **toggleSubscribeApiV1LiveChannelCidSubscribePost_0**
> Object toggleSubscribeApiV1LiveChannelCidSubscribePost_0(cid)

订阅/取消订阅

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LiveApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    LiveApi apiInstance = new LiveApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.toggleSubscribeApiV1LiveChannelCidSubscribePost_0(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LiveApi#toggleSubscribeApiV1LiveChannelCidSubscribePost_0");
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
| **cid** | **Integer**|  | |

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

