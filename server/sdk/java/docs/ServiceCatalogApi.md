# ServiceCatalogApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**callLogListApiV1ServiceCatalogLogListGet**](ServiceCatalogApi.md#callLogListApiV1ServiceCatalogLogListGet) | **GET** /api/v1/service-catalog/log/list | 服务调用日志 |
| [**callLogListApiV1ServiceCatalogLogListGet_0**](ServiceCatalogApi.md#callLogListApiV1ServiceCatalogLogListGet_0) | **GET** /api/v1/service-catalog/log/list | 服务调用日志 |
| [**deleteServiceApiV1ServiceCatalogSidDelete**](ServiceCatalogApi.md#deleteServiceApiV1ServiceCatalogSidDelete) | **DELETE** /api/v1/service-catalog/{sid} | 下线服务 |
| [**deleteServiceApiV1ServiceCatalogSidDelete_0**](ServiceCatalogApi.md#deleteServiceApiV1ServiceCatalogSidDelete_0) | **DELETE** /api/v1/service-catalog/{sid} | 下线服务 |
| [**getServiceApiV1ServiceCatalogSidGet**](ServiceCatalogApi.md#getServiceApiV1ServiceCatalogSidGet) | **GET** /api/v1/service-catalog/{sid} | 服务详情 |
| [**getServiceApiV1ServiceCatalogSidGet_0**](ServiceCatalogApi.md#getServiceApiV1ServiceCatalogSidGet_0) | **GET** /api/v1/service-catalog/{sid} | 服务详情 |
| [**heartbeatApiV1ServiceCatalogSidHeartbeatPost**](ServiceCatalogApi.md#heartbeatApiV1ServiceCatalogSidHeartbeatPost) | **POST** /api/v1/service-catalog/{sid}/heartbeat | 心跳上报 |
| [**heartbeatApiV1ServiceCatalogSidHeartbeatPost_0**](ServiceCatalogApi.md#heartbeatApiV1ServiceCatalogSidHeartbeatPost_0) | **POST** /api/v1/service-catalog/{sid}/heartbeat | 心跳上报 |
| [**registerApiV1ServiceCatalogPost**](ServiceCatalogApi.md#registerApiV1ServiceCatalogPost) | **POST** /api/v1/service-catalog | 注册服务 |
| [**registerApiV1ServiceCatalogPost_0**](ServiceCatalogApi.md#registerApiV1ServiceCatalogPost_0) | **POST** /api/v1/service-catalog | 注册服务 |
| [**serviceListApiV1ServiceCatalogListGet**](ServiceCatalogApi.md#serviceListApiV1ServiceCatalogListGet) | **GET** /api/v1/service-catalog/list | 服务列表 |
| [**serviceListApiV1ServiceCatalogListGet_0**](ServiceCatalogApi.md#serviceListApiV1ServiceCatalogListGet_0) | **GET** /api/v1/service-catalog/list | 服务列表 |
| [**updateServiceApiV1ServiceCatalogSidPut**](ServiceCatalogApi.md#updateServiceApiV1ServiceCatalogSidPut) | **PUT** /api/v1/service-catalog/{sid} | 更新服务 |
| [**updateServiceApiV1ServiceCatalogSidPut_0**](ServiceCatalogApi.md#updateServiceApiV1ServiceCatalogSidPut_0) | **PUT** /api/v1/service-catalog/{sid} | 更新服务 |


<a id="callLogListApiV1ServiceCatalogLogListGet"></a>
# **callLogListApiV1ServiceCatalogLogListGet**
> Object callLogListApiV1ServiceCatalogLogListGet(page, limit, serviceCode, status)

服务调用日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ServiceCatalogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ServiceCatalogApi apiInstance = new ServiceCatalogApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String serviceCode = "serviceCode_example"; // String | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.callLogListApiV1ServiceCatalogLogListGet(page, limit, serviceCode, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ServiceCatalogApi#callLogListApiV1ServiceCatalogLogListGet");
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
| **serviceCode** | **String**|  | [optional] |
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

<a id="callLogListApiV1ServiceCatalogLogListGet_0"></a>
# **callLogListApiV1ServiceCatalogLogListGet_0**
> Object callLogListApiV1ServiceCatalogLogListGet_0(page, limit, serviceCode, status)

服务调用日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ServiceCatalogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ServiceCatalogApi apiInstance = new ServiceCatalogApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String serviceCode = "serviceCode_example"; // String | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.callLogListApiV1ServiceCatalogLogListGet_0(page, limit, serviceCode, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ServiceCatalogApi#callLogListApiV1ServiceCatalogLogListGet_0");
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
| **serviceCode** | **String**|  | [optional] |
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

<a id="deleteServiceApiV1ServiceCatalogSidDelete"></a>
# **deleteServiceApiV1ServiceCatalogSidDelete**
> Object deleteServiceApiV1ServiceCatalogSidDelete(sid)

下线服务

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ServiceCatalogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ServiceCatalogApi apiInstance = new ServiceCatalogApi(defaultClient);
    Integer sid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteServiceApiV1ServiceCatalogSidDelete(sid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ServiceCatalogApi#deleteServiceApiV1ServiceCatalogSidDelete");
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
| **sid** | **Integer**|  | |

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

<a id="deleteServiceApiV1ServiceCatalogSidDelete_0"></a>
# **deleteServiceApiV1ServiceCatalogSidDelete_0**
> Object deleteServiceApiV1ServiceCatalogSidDelete_0(sid)

下线服务

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ServiceCatalogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ServiceCatalogApi apiInstance = new ServiceCatalogApi(defaultClient);
    Integer sid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteServiceApiV1ServiceCatalogSidDelete_0(sid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ServiceCatalogApi#deleteServiceApiV1ServiceCatalogSidDelete_0");
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
| **sid** | **Integer**|  | |

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

<a id="getServiceApiV1ServiceCatalogSidGet"></a>
# **getServiceApiV1ServiceCatalogSidGet**
> Object getServiceApiV1ServiceCatalogSidGet(sid)

服务详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ServiceCatalogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ServiceCatalogApi apiInstance = new ServiceCatalogApi(defaultClient);
    Integer sid = 56; // Integer | 
    try {
      Object result = apiInstance.getServiceApiV1ServiceCatalogSidGet(sid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ServiceCatalogApi#getServiceApiV1ServiceCatalogSidGet");
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
| **sid** | **Integer**|  | |

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

<a id="getServiceApiV1ServiceCatalogSidGet_0"></a>
# **getServiceApiV1ServiceCatalogSidGet_0**
> Object getServiceApiV1ServiceCatalogSidGet_0(sid)

服务详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ServiceCatalogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ServiceCatalogApi apiInstance = new ServiceCatalogApi(defaultClient);
    Integer sid = 56; // Integer | 
    try {
      Object result = apiInstance.getServiceApiV1ServiceCatalogSidGet_0(sid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ServiceCatalogApi#getServiceApiV1ServiceCatalogSidGet_0");
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
| **sid** | **Integer**|  | |

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

<a id="heartbeatApiV1ServiceCatalogSidHeartbeatPost"></a>
# **heartbeatApiV1ServiceCatalogSidHeartbeatPost**
> Object heartbeatApiV1ServiceCatalogSidHeartbeatPost(sid, isHealthy, errorMsg)

心跳上报

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ServiceCatalogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ServiceCatalogApi apiInstance = new ServiceCatalogApi(defaultClient);
    Integer sid = 56; // Integer | 
    Boolean isHealthy = true; // Boolean | 
    String errorMsg = "errorMsg_example"; // String | 
    try {
      Object result = apiInstance.heartbeatApiV1ServiceCatalogSidHeartbeatPost(sid, isHealthy, errorMsg);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ServiceCatalogApi#heartbeatApiV1ServiceCatalogSidHeartbeatPost");
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
| **sid** | **Integer**|  | |
| **isHealthy** | **Boolean**|  | [optional] [default to true] |
| **errorMsg** | **String**|  | [optional] |

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

<a id="heartbeatApiV1ServiceCatalogSidHeartbeatPost_0"></a>
# **heartbeatApiV1ServiceCatalogSidHeartbeatPost_0**
> Object heartbeatApiV1ServiceCatalogSidHeartbeatPost_0(sid, isHealthy, errorMsg)

心跳上报

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ServiceCatalogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ServiceCatalogApi apiInstance = new ServiceCatalogApi(defaultClient);
    Integer sid = 56; // Integer | 
    Boolean isHealthy = true; // Boolean | 
    String errorMsg = "errorMsg_example"; // String | 
    try {
      Object result = apiInstance.heartbeatApiV1ServiceCatalogSidHeartbeatPost_0(sid, isHealthy, errorMsg);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ServiceCatalogApi#heartbeatApiV1ServiceCatalogSidHeartbeatPost_0");
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
| **sid** | **Integer**|  | |
| **isHealthy** | **Boolean**|  | [optional] [default to true] |
| **errorMsg** | **String**|  | [optional] |

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

<a id="registerApiV1ServiceCatalogPost"></a>
# **registerApiV1ServiceCatalogPost**
> Object registerApiV1ServiceCatalogPost(code, name, type, host, port, path, version, description, group, tags, healthUrl, weight, config)

注册服务

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ServiceCatalogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ServiceCatalogApi apiInstance = new ServiceCatalogApi(defaultClient);
    String code = "code_example"; // String | 
    String name = "name_example"; // String | 
    String type = "api"; // String | 
    String host = "host_example"; // String | 
    Integer port = 0; // Integer | 
    String path = "/"; // String | 
    String version = "1.0.0"; // String | 
    String description = "description_example"; // String | 
    String group = "default"; // String | 
    String tags = "tags_example"; // String | 
    String healthUrl = "healthUrl_example"; // String | 
    Integer weight = 1; // Integer | 
    String config = "config_example"; // String | 
    try {
      Object result = apiInstance.registerApiV1ServiceCatalogPost(code, name, type, host, port, path, version, description, group, tags, healthUrl, weight, config);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ServiceCatalogApi#registerApiV1ServiceCatalogPost");
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
| **type** | **String**|  | [optional] [default to api] |
| **host** | **String**|  | [optional] |
| **port** | **Integer**|  | [optional] [default to 0] |
| **path** | **String**|  | [optional] [default to /] |
| **version** | **String**|  | [optional] [default to 1.0.0] |
| **description** | **String**|  | [optional] |
| **group** | **String**|  | [optional] [default to default] |
| **tags** | **String**|  | [optional] |
| **healthUrl** | **String**|  | [optional] |
| **weight** | **Integer**|  | [optional] [default to 1] |
| **config** | **String**|  | [optional] |

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

<a id="registerApiV1ServiceCatalogPost_0"></a>
# **registerApiV1ServiceCatalogPost_0**
> Object registerApiV1ServiceCatalogPost_0(code, name, type, host, port, path, version, description, group, tags, healthUrl, weight, config)

注册服务

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ServiceCatalogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ServiceCatalogApi apiInstance = new ServiceCatalogApi(defaultClient);
    String code = "code_example"; // String | 
    String name = "name_example"; // String | 
    String type = "api"; // String | 
    String host = "host_example"; // String | 
    Integer port = 0; // Integer | 
    String path = "/"; // String | 
    String version = "1.0.0"; // String | 
    String description = "description_example"; // String | 
    String group = "default"; // String | 
    String tags = "tags_example"; // String | 
    String healthUrl = "healthUrl_example"; // String | 
    Integer weight = 1; // Integer | 
    String config = "config_example"; // String | 
    try {
      Object result = apiInstance.registerApiV1ServiceCatalogPost_0(code, name, type, host, port, path, version, description, group, tags, healthUrl, weight, config);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ServiceCatalogApi#registerApiV1ServiceCatalogPost_0");
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
| **type** | **String**|  | [optional] [default to api] |
| **host** | **String**|  | [optional] |
| **port** | **Integer**|  | [optional] [default to 0] |
| **path** | **String**|  | [optional] [default to /] |
| **version** | **String**|  | [optional] [default to 1.0.0] |
| **description** | **String**|  | [optional] |
| **group** | **String**|  | [optional] [default to default] |
| **tags** | **String**|  | [optional] |
| **healthUrl** | **String**|  | [optional] |
| **weight** | **Integer**|  | [optional] [default to 1] |
| **config** | **String**|  | [optional] |

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

<a id="serviceListApiV1ServiceCatalogListGet"></a>
# **serviceListApiV1ServiceCatalogListGet**
> Object serviceListApiV1ServiceCatalogListGet(group, type, status, keyword)

服务列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ServiceCatalogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ServiceCatalogApi apiInstance = new ServiceCatalogApi(defaultClient);
    String group = "group_example"; // String | 
    String type = "type_example"; // String | 
    Integer status = 56; // Integer | 
    String keyword = "keyword_example"; // String | 
    try {
      Object result = apiInstance.serviceListApiV1ServiceCatalogListGet(group, type, status, keyword);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ServiceCatalogApi#serviceListApiV1ServiceCatalogListGet");
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
| **group** | **String**|  | [optional] |
| **type** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |
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

<a id="serviceListApiV1ServiceCatalogListGet_0"></a>
# **serviceListApiV1ServiceCatalogListGet_0**
> Object serviceListApiV1ServiceCatalogListGet_0(group, type, status, keyword)

服务列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ServiceCatalogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ServiceCatalogApi apiInstance = new ServiceCatalogApi(defaultClient);
    String group = "group_example"; // String | 
    String type = "type_example"; // String | 
    Integer status = 56; // Integer | 
    String keyword = "keyword_example"; // String | 
    try {
      Object result = apiInstance.serviceListApiV1ServiceCatalogListGet_0(group, type, status, keyword);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ServiceCatalogApi#serviceListApiV1ServiceCatalogListGet_0");
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
| **group** | **String**|  | [optional] |
| **type** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |
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

<a id="updateServiceApiV1ServiceCatalogSidPut"></a>
# **updateServiceApiV1ServiceCatalogSidPut**
> Object updateServiceApiV1ServiceCatalogSidPut(sid, name, host, port, status, weight, config)

更新服务

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ServiceCatalogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ServiceCatalogApi apiInstance = new ServiceCatalogApi(defaultClient);
    Integer sid = 56; // Integer | 
    String name = "name_example"; // String | 
    String host = "host_example"; // String | 
    Integer port = 56; // Integer | 
    Integer status = 56; // Integer | 
    Integer weight = 56; // Integer | 
    String config = "config_example"; // String | 
    try {
      Object result = apiInstance.updateServiceApiV1ServiceCatalogSidPut(sid, name, host, port, status, weight, config);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ServiceCatalogApi#updateServiceApiV1ServiceCatalogSidPut");
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
| **sid** | **Integer**|  | |
| **name** | **String**|  | [optional] |
| **host** | **String**|  | [optional] |
| **port** | **Integer**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **weight** | **Integer**|  | [optional] |
| **config** | **String**|  | [optional] |

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

<a id="updateServiceApiV1ServiceCatalogSidPut_0"></a>
# **updateServiceApiV1ServiceCatalogSidPut_0**
> Object updateServiceApiV1ServiceCatalogSidPut_0(sid, name, host, port, status, weight, config)

更新服务

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ServiceCatalogApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ServiceCatalogApi apiInstance = new ServiceCatalogApi(defaultClient);
    Integer sid = 56; // Integer | 
    String name = "name_example"; // String | 
    String host = "host_example"; // String | 
    Integer port = 56; // Integer | 
    Integer status = 56; // Integer | 
    Integer weight = 56; // Integer | 
    String config = "config_example"; // String | 
    try {
      Object result = apiInstance.updateServiceApiV1ServiceCatalogSidPut_0(sid, name, host, port, status, weight, config);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ServiceCatalogApi#updateServiceApiV1ServiceCatalogSidPut_0");
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
| **sid** | **Integer**|  | |
| **name** | **String**|  | [optional] |
| **host** | **String**|  | [optional] |
| **port** | **Integer**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **weight** | **Integer**|  | [optional] |
| **config** | **String**|  | [optional] |

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

