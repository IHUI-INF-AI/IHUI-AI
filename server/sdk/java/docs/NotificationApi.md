# NotificationApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**channelListApiV1NotificationChannelListGet**](NotificationApi.md#channelListApiV1NotificationChannelListGet) | **GET** /api/v1/notification/channel/list | 通知渠道列表 |
| [**channelListApiV1NotificationChannelListGet_0**](NotificationApi.md#channelListApiV1NotificationChannelListGet_0) | **GET** /api/v1/notification/channel/list | 通知渠道列表 |
| [**deleteNotificationApiV1NotificationNidDelete**](NotificationApi.md#deleteNotificationApiV1NotificationNidDelete) | **DELETE** /api/v1/notification/{nid} | 删除通知 |
| [**deleteNotificationApiV1NotificationNidDelete_0**](NotificationApi.md#deleteNotificationApiV1NotificationNidDelete_0) | **DELETE** /api/v1/notification/{nid} | 删除通知 |
| [**listNotificationsApiV1NotificationListGet**](NotificationApi.md#listNotificationsApiV1NotificationListGet) | **GET** /api/v1/notification/list | 我的通知列表 |
| [**listNotificationsApiV1NotificationListGet_0**](NotificationApi.md#listNotificationsApiV1NotificationListGet_0) | **GET** /api/v1/notification/list | 我的通知列表 |
| [**markReadApiV1NotificationNidReadPost**](NotificationApi.md#markReadApiV1NotificationNidReadPost) | **POST** /api/v1/notification/{nid}/read | 标记已读 |
| [**markReadApiV1NotificationNidReadPost_0**](NotificationApi.md#markReadApiV1NotificationNidReadPost_0) | **POST** /api/v1/notification/{nid}/read | 标记已读 |
| [**notificationCreateChannel**](NotificationApi.md#notificationCreateChannel) | **POST** /api/v1/notification/channel | 添加渠道 |
| [**notificationCreateChannel_0**](NotificationApi.md#notificationCreateChannel_0) | **POST** /api/v1/notification/channel | 添加渠道 |
| [**notificationDeleteChannel**](NotificationApi.md#notificationDeleteChannel) | **DELETE** /api/v1/notification/channel/{cid} | 删除渠道 |
| [**notificationDeleteChannel_0**](NotificationApi.md#notificationDeleteChannel_0) | **DELETE** /api/v1/notification/channel/{cid} | 删除渠道 |
| [**notificationLogList**](NotificationApi.md#notificationLogList) | **GET** /api/v1/notification/log/list | 通知发送日志 |
| [**notificationLogList_0**](NotificationApi.md#notificationLogList_0) | **GET** /api/v1/notification/log/list | 通知发送日志 |
| [**notificationMarkAllRead**](NotificationApi.md#notificationMarkAllRead) | **POST** /api/v1/notification/read-all | 全部标记已读 |
| [**notificationMarkAllRead_0**](NotificationApi.md#notificationMarkAllRead_0) | **POST** /api/v1/notification/read-all | 全部标记已读 |
| [**notificationUnreadCount**](NotificationApi.md#notificationUnreadCount) | **GET** /api/v1/notification/unread-count | 未读通知数 |
| [**notificationUnreadCount_0**](NotificationApi.md#notificationUnreadCount_0) | **GET** /api/v1/notification/unread-count | 未读通知数 |
| [**notificationUpdateChannel**](NotificationApi.md#notificationUpdateChannel) | **PUT** /api/v1/notification/channel/{cid} | 修改渠道 |
| [**notificationUpdateChannel_0**](NotificationApi.md#notificationUpdateChannel_0) | **PUT** /api/v1/notification/channel/{cid} | 修改渠道 |
| [**sendNotificationApiV1NotificationSendPost**](NotificationApi.md#sendNotificationApiV1NotificationSendPost) | **POST** /api/v1/notification/send | 发送通知 |
| [**sendNotificationApiV1NotificationSendPost_0**](NotificationApi.md#sendNotificationApiV1NotificationSendPost_0) | **POST** /api/v1/notification/send | 发送通知 |
| [**setSubscriptionApiV1NotificationSubscriptionPost**](NotificationApi.md#setSubscriptionApiV1NotificationSubscriptionPost) | **POST** /api/v1/notification/subscription | 设置订阅 |
| [**setSubscriptionApiV1NotificationSubscriptionPost_0**](NotificationApi.md#setSubscriptionApiV1NotificationSubscriptionPost_0) | **POST** /api/v1/notification/subscription | 设置订阅 |
| [**subscriptionListApiV1NotificationSubscriptionListGet**](NotificationApi.md#subscriptionListApiV1NotificationSubscriptionListGet) | **GET** /api/v1/notification/subscription/list | 我的订阅偏好 |
| [**subscriptionListApiV1NotificationSubscriptionListGet_0**](NotificationApi.md#subscriptionListApiV1NotificationSubscriptionListGet_0) | **GET** /api/v1/notification/subscription/list | 我的订阅偏好 |


<a id="channelListApiV1NotificationChannelListGet"></a>
# **channelListApiV1NotificationChannelListGet**
> Object channelListApiV1NotificationChannelListGet(type)

通知渠道列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    String type = "type_example"; // String | 
    try {
      Object result = apiInstance.channelListApiV1NotificationChannelListGet(type);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#channelListApiV1NotificationChannelListGet");
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

<a id="channelListApiV1NotificationChannelListGet_0"></a>
# **channelListApiV1NotificationChannelListGet_0**
> Object channelListApiV1NotificationChannelListGet_0(type)

通知渠道列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    String type = "type_example"; // String | 
    try {
      Object result = apiInstance.channelListApiV1NotificationChannelListGet_0(type);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#channelListApiV1NotificationChannelListGet_0");
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

<a id="deleteNotificationApiV1NotificationNidDelete"></a>
# **deleteNotificationApiV1NotificationNidDelete**
> Object deleteNotificationApiV1NotificationNidDelete(nid)

删除通知

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    Integer nid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteNotificationApiV1NotificationNidDelete(nid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#deleteNotificationApiV1NotificationNidDelete");
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
| **nid** | **Integer**|  | |

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

<a id="deleteNotificationApiV1NotificationNidDelete_0"></a>
# **deleteNotificationApiV1NotificationNidDelete_0**
> Object deleteNotificationApiV1NotificationNidDelete_0(nid)

删除通知

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    Integer nid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteNotificationApiV1NotificationNidDelete_0(nid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#deleteNotificationApiV1NotificationNidDelete_0");
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
| **nid** | **Integer**|  | |

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

<a id="listNotificationsApiV1NotificationListGet"></a>
# **listNotificationsApiV1NotificationListGet**
> Object listNotificationsApiV1NotificationListGet(page, limit, type, status)

我的通知列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String type = "type_example"; // String | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.listNotificationsApiV1NotificationListGet(page, limit, type, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#listNotificationsApiV1NotificationListGet");
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

<a id="listNotificationsApiV1NotificationListGet_0"></a>
# **listNotificationsApiV1NotificationListGet_0**
> Object listNotificationsApiV1NotificationListGet_0(page, limit, type, status)

我的通知列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String type = "type_example"; // String | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.listNotificationsApiV1NotificationListGet_0(page, limit, type, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#listNotificationsApiV1NotificationListGet_0");
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

<a id="markReadApiV1NotificationNidReadPost"></a>
# **markReadApiV1NotificationNidReadPost**
> Object markReadApiV1NotificationNidReadPost(nid)

标记已读

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    Integer nid = 56; // Integer | 
    try {
      Object result = apiInstance.markReadApiV1NotificationNidReadPost(nid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#markReadApiV1NotificationNidReadPost");
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
| **nid** | **Integer**|  | |

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

<a id="markReadApiV1NotificationNidReadPost_0"></a>
# **markReadApiV1NotificationNidReadPost_0**
> Object markReadApiV1NotificationNidReadPost_0(nid)

标记已读

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    Integer nid = 56; // Integer | 
    try {
      Object result = apiInstance.markReadApiV1NotificationNidReadPost_0(nid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#markReadApiV1NotificationNidReadPost_0");
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
| **nid** | **Integer**|  | |

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

<a id="notificationCreateChannel"></a>
# **notificationCreateChannel**
> Object notificationCreateChannel(name, type, config, isDefault)

添加渠道

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    String name = "name_example"; // String | 
    String type = "type_example"; // String | 
    String config = "config_example"; // String | 
    Boolean isDefault = false; // Boolean | 
    try {
      Object result = apiInstance.notificationCreateChannel(name, type, config, isDefault);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#notificationCreateChannel");
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
| **name** | **String**|  | |
| **type** | **String**|  | |
| **config** | **String**|  | [optional] |
| **isDefault** | **Boolean**|  | [optional] [default to false] |

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

<a id="notificationCreateChannel_0"></a>
# **notificationCreateChannel_0**
> Object notificationCreateChannel_0(name, type, config, isDefault)

添加渠道

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    String name = "name_example"; // String | 
    String type = "type_example"; // String | 
    String config = "config_example"; // String | 
    Boolean isDefault = false; // Boolean | 
    try {
      Object result = apiInstance.notificationCreateChannel_0(name, type, config, isDefault);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#notificationCreateChannel_0");
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
| **name** | **String**|  | |
| **type** | **String**|  | |
| **config** | **String**|  | [optional] |
| **isDefault** | **Boolean**|  | [optional] [default to false] |

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

<a id="notificationDeleteChannel"></a>
# **notificationDeleteChannel**
> Object notificationDeleteChannel(cid)

删除渠道

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.notificationDeleteChannel(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#notificationDeleteChannel");
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

<a id="notificationDeleteChannel_0"></a>
# **notificationDeleteChannel_0**
> Object notificationDeleteChannel_0(cid)

删除渠道

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.notificationDeleteChannel_0(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#notificationDeleteChannel_0");
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

<a id="notificationLogList"></a>
# **notificationLogList**
> Object notificationLogList(page, limit, successFlag)

通知发送日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Boolean successFlag = true; // Boolean | 
    try {
      Object result = apiInstance.notificationLogList(page, limit, successFlag);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#notificationLogList");
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
| **successFlag** | **Boolean**|  | [optional] |

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

<a id="notificationLogList_0"></a>
# **notificationLogList_0**
> Object notificationLogList_0(page, limit, successFlag)

通知发送日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Boolean successFlag = true; // Boolean | 
    try {
      Object result = apiInstance.notificationLogList_0(page, limit, successFlag);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#notificationLogList_0");
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
| **successFlag** | **Boolean**|  | [optional] |

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

<a id="notificationMarkAllRead"></a>
# **notificationMarkAllRead**
> Object notificationMarkAllRead()

全部标记已读

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    try {
      Object result = apiInstance.notificationMarkAllRead();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#notificationMarkAllRead");
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

<a id="notificationMarkAllRead_0"></a>
# **notificationMarkAllRead_0**
> Object notificationMarkAllRead_0()

全部标记已读

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    try {
      Object result = apiInstance.notificationMarkAllRead_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#notificationMarkAllRead_0");
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

<a id="notificationUnreadCount"></a>
# **notificationUnreadCount**
> Object notificationUnreadCount()

未读通知数

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    try {
      Object result = apiInstance.notificationUnreadCount();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#notificationUnreadCount");
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

<a id="notificationUnreadCount_0"></a>
# **notificationUnreadCount_0**
> Object notificationUnreadCount_0()

未读通知数

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    try {
      Object result = apiInstance.notificationUnreadCount_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#notificationUnreadCount_0");
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

<a id="notificationUpdateChannel"></a>
# **notificationUpdateChannel**
> Object notificationUpdateChannel(cid, name, config, isDefault, status)

修改渠道

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    Integer cid = 56; // Integer | 
    String name = "name_example"; // String | 
    String config = "config_example"; // String | 
    Boolean isDefault = true; // Boolean | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.notificationUpdateChannel(cid, name, config, isDefault, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#notificationUpdateChannel");
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
| **name** | **String**|  | [optional] |
| **config** | **String**|  | [optional] |
| **isDefault** | **Boolean**|  | [optional] |
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

<a id="notificationUpdateChannel_0"></a>
# **notificationUpdateChannel_0**
> Object notificationUpdateChannel_0(cid, name, config, isDefault, status)

修改渠道

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    Integer cid = 56; // Integer | 
    String name = "name_example"; // String | 
    String config = "config_example"; // String | 
    Boolean isDefault = true; // Boolean | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.notificationUpdateChannel_0(cid, name, config, isDefault, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#notificationUpdateChannel_0");
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
| **name** | **String**|  | [optional] |
| **config** | **String**|  | [optional] |
| **isDefault** | **Boolean**|  | [optional] |
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

<a id="sendNotificationApiV1NotificationSendPost"></a>
# **sendNotificationApiV1NotificationSendPost**
> Object sendNotificationApiV1NotificationSendPost(title, content, userId, type, channel, targetType, targetId, targetUrl, userIds)

发送通知

发送通知: user_id(单用户) 或 user_ids(逗号分隔多用户)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    String title = "title_example"; // String | 
    String content = "content_example"; // String | 
    String userId = "userId_example"; // String | 
    String type = "site"; // String | 
    String channel = "channel_example"; // String | 
    String targetType = "targetType_example"; // String | 
    String targetId = "targetId_example"; // String | 
    String targetUrl = "targetUrl_example"; // String | 
    String userIds = "userIds_example"; // String | 
    try {
      Object result = apiInstance.sendNotificationApiV1NotificationSendPost(title, content, userId, type, channel, targetType, targetId, targetUrl, userIds);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#sendNotificationApiV1NotificationSendPost");
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
| **userId** | **String**|  | [optional] |
| **type** | **String**|  | [optional] [default to site] |
| **channel** | **String**|  | [optional] |
| **targetType** | **String**|  | [optional] |
| **targetId** | **String**|  | [optional] |
| **targetUrl** | **String**|  | [optional] |
| **userIds** | **String**|  | [optional] |

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

<a id="sendNotificationApiV1NotificationSendPost_0"></a>
# **sendNotificationApiV1NotificationSendPost_0**
> Object sendNotificationApiV1NotificationSendPost_0(title, content, userId, type, channel, targetType, targetId, targetUrl, userIds)

发送通知

发送通知: user_id(单用户) 或 user_ids(逗号分隔多用户)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    String title = "title_example"; // String | 
    String content = "content_example"; // String | 
    String userId = "userId_example"; // String | 
    String type = "site"; // String | 
    String channel = "channel_example"; // String | 
    String targetType = "targetType_example"; // String | 
    String targetId = "targetId_example"; // String | 
    String targetUrl = "targetUrl_example"; // String | 
    String userIds = "userIds_example"; // String | 
    try {
      Object result = apiInstance.sendNotificationApiV1NotificationSendPost_0(title, content, userId, type, channel, targetType, targetId, targetUrl, userIds);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#sendNotificationApiV1NotificationSendPost_0");
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
| **userId** | **String**|  | [optional] |
| **type** | **String**|  | [optional] [default to site] |
| **channel** | **String**|  | [optional] |
| **targetType** | **String**|  | [optional] |
| **targetId** | **String**|  | [optional] |
| **targetUrl** | **String**|  | [optional] |
| **userIds** | **String**|  | [optional] |

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

<a id="setSubscriptionApiV1NotificationSubscriptionPost"></a>
# **setSubscriptionApiV1NotificationSubscriptionPost**
> Object setSubscriptionApiV1NotificationSubscriptionPost(type, category, enabled)

设置订阅

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    String type = "type_example"; // String | 
    String category = "category_example"; // String | 
    Boolean enabled = true; // Boolean | 
    try {
      Object result = apiInstance.setSubscriptionApiV1NotificationSubscriptionPost(type, category, enabled);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#setSubscriptionApiV1NotificationSubscriptionPost");
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
| **type** | **String**|  | |
| **category** | **String**|  | |
| **enabled** | **Boolean**|  | [optional] [default to true] |

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

<a id="setSubscriptionApiV1NotificationSubscriptionPost_0"></a>
# **setSubscriptionApiV1NotificationSubscriptionPost_0**
> Object setSubscriptionApiV1NotificationSubscriptionPost_0(type, category, enabled)

设置订阅

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    String type = "type_example"; // String | 
    String category = "category_example"; // String | 
    Boolean enabled = true; // Boolean | 
    try {
      Object result = apiInstance.setSubscriptionApiV1NotificationSubscriptionPost_0(type, category, enabled);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#setSubscriptionApiV1NotificationSubscriptionPost_0");
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
| **type** | **String**|  | |
| **category** | **String**|  | |
| **enabled** | **Boolean**|  | [optional] [default to true] |

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

<a id="subscriptionListApiV1NotificationSubscriptionListGet"></a>
# **subscriptionListApiV1NotificationSubscriptionListGet**
> Object subscriptionListApiV1NotificationSubscriptionListGet()

我的订阅偏好

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    try {
      Object result = apiInstance.subscriptionListApiV1NotificationSubscriptionListGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#subscriptionListApiV1NotificationSubscriptionListGet");
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

<a id="subscriptionListApiV1NotificationSubscriptionListGet_0"></a>
# **subscriptionListApiV1NotificationSubscriptionListGet_0**
> Object subscriptionListApiV1NotificationSubscriptionListGet_0()

我的订阅偏好

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.NotificationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    NotificationApi apiInstance = new NotificationApi(defaultClient);
    try {
      Object result = apiInstance.subscriptionListApiV1NotificationSubscriptionListGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling NotificationApi#subscriptionListApiV1NotificationSubscriptionListGet_0");
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

