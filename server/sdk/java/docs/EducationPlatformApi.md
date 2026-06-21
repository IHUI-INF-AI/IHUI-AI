# EducationPlatformApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createPlatformApiV1EducationPlatformPost**](EducationPlatformApi.md#createPlatformApiV1EducationPlatformPost) | **POST** /api/v1/education-platform | 新增教育平台 |
| [**createPlatformApiV1EducationPlatformPost_0**](EducationPlatformApi.md#createPlatformApiV1EducationPlatformPost_0) | **POST** /api/v1/education-platform | 新增教育平台 |
| [**deletePlatformApiV1EducationPlatformPidDelete**](EducationPlatformApi.md#deletePlatformApiV1EducationPlatformPidDelete) | **DELETE** /api/v1/education-platform/{pid} | 删除教育平台 |
| [**deletePlatformApiV1EducationPlatformPidDelete_0**](EducationPlatformApi.md#deletePlatformApiV1EducationPlatformPidDelete_0) | **DELETE** /api/v1/education-platform/{pid} | 删除教育平台 |
| [**listPlatformsApiV1EducationPlatformListGet**](EducationPlatformApi.md#listPlatformsApiV1EducationPlatformListGet) | **GET** /api/v1/education-platform/list | 教育平台列表 |
| [**listPlatformsApiV1EducationPlatformListGet_0**](EducationPlatformApi.md#listPlatformsApiV1EducationPlatformListGet_0) | **GET** /api/v1/education-platform/list | 教育平台列表 |
| [**syncLogApiV1EducationPlatformSyncLogGet**](EducationPlatformApi.md#syncLogApiV1EducationPlatformSyncLogGet) | **GET** /api/v1/education-platform/sync/log | 同步日志 |
| [**syncLogApiV1EducationPlatformSyncLogGet_0**](EducationPlatformApi.md#syncLogApiV1EducationPlatformSyncLogGet_0) | **GET** /api/v1/education-platform/sync/log | 同步日志 |
| [**syncPlatformApiV1EducationPlatformPidSyncPost**](EducationPlatformApi.md#syncPlatformApiV1EducationPlatformPidSyncPost) | **POST** /api/v1/education-platform/{pid}/sync | 同步数据 |
| [**syncPlatformApiV1EducationPlatformPidSyncPost_0**](EducationPlatformApi.md#syncPlatformApiV1EducationPlatformPidSyncPost_0) | **POST** /api/v1/education-platform/{pid}/sync | 同步数据 |
| [**updatePlatformApiV1EducationPlatformPidPut**](EducationPlatformApi.md#updatePlatformApiV1EducationPlatformPidPut) | **PUT** /api/v1/education-platform/{pid} | 修改教育平台 |
| [**updatePlatformApiV1EducationPlatformPidPut_0**](EducationPlatformApi.md#updatePlatformApiV1EducationPlatformPidPut_0) | **PUT** /api/v1/education-platform/{pid} | 修改教育平台 |


<a id="createPlatformApiV1EducationPlatformPost"></a>
# **createPlatformApiV1EducationPlatformPost**
> Object createPlatformApiV1EducationPlatformPost(name, code, type, apiUrl, apiKey, apiSecret, config, syncUrl, description)

新增教育平台

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.EducationPlatformApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    EducationPlatformApi apiInstance = new EducationPlatformApi(defaultClient);
    String name = "name_example"; // String | 
    String code = "code_example"; // String | 
    String type = "mooc"; // String | 
    String apiUrl = "apiUrl_example"; // String | 
    String apiKey = "apiKey_example"; // String | 
    String apiSecret = "apiSecret_example"; // String | 
    String config = "config_example"; // String | 
    String syncUrl = "syncUrl_example"; // String | 
    String description = "description_example"; // String | 
    try {
      Object result = apiInstance.createPlatformApiV1EducationPlatformPost(name, code, type, apiUrl, apiKey, apiSecret, config, syncUrl, description);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling EducationPlatformApi#createPlatformApiV1EducationPlatformPost");
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
| **code** | **String**|  | |
| **type** | **String**|  | [optional] [default to mooc] |
| **apiUrl** | **String**|  | [optional] |
| **apiKey** | **String**|  | [optional] |
| **apiSecret** | **String**|  | [optional] |
| **config** | **String**|  | [optional] |
| **syncUrl** | **String**|  | [optional] |
| **description** | **String**|  | [optional] |

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

<a id="createPlatformApiV1EducationPlatformPost_0"></a>
# **createPlatformApiV1EducationPlatformPost_0**
> Object createPlatformApiV1EducationPlatformPost_0(name, code, type, apiUrl, apiKey, apiSecret, config, syncUrl, description)

新增教育平台

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.EducationPlatformApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    EducationPlatformApi apiInstance = new EducationPlatformApi(defaultClient);
    String name = "name_example"; // String | 
    String code = "code_example"; // String | 
    String type = "mooc"; // String | 
    String apiUrl = "apiUrl_example"; // String | 
    String apiKey = "apiKey_example"; // String | 
    String apiSecret = "apiSecret_example"; // String | 
    String config = "config_example"; // String | 
    String syncUrl = "syncUrl_example"; // String | 
    String description = "description_example"; // String | 
    try {
      Object result = apiInstance.createPlatformApiV1EducationPlatformPost_0(name, code, type, apiUrl, apiKey, apiSecret, config, syncUrl, description);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling EducationPlatformApi#createPlatformApiV1EducationPlatformPost_0");
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
| **code** | **String**|  | |
| **type** | **String**|  | [optional] [default to mooc] |
| **apiUrl** | **String**|  | [optional] |
| **apiKey** | **String**|  | [optional] |
| **apiSecret** | **String**|  | [optional] |
| **config** | **String**|  | [optional] |
| **syncUrl** | **String**|  | [optional] |
| **description** | **String**|  | [optional] |

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

<a id="deletePlatformApiV1EducationPlatformPidDelete"></a>
# **deletePlatformApiV1EducationPlatformPidDelete**
> Object deletePlatformApiV1EducationPlatformPidDelete(pid)

删除教育平台

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.EducationPlatformApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    EducationPlatformApi apiInstance = new EducationPlatformApi(defaultClient);
    Integer pid = 56; // Integer | 
    try {
      Object result = apiInstance.deletePlatformApiV1EducationPlatformPidDelete(pid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling EducationPlatformApi#deletePlatformApiV1EducationPlatformPidDelete");
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
| **pid** | **Integer**|  | |

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

<a id="deletePlatformApiV1EducationPlatformPidDelete_0"></a>
# **deletePlatformApiV1EducationPlatformPidDelete_0**
> Object deletePlatformApiV1EducationPlatformPidDelete_0(pid)

删除教育平台

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.EducationPlatformApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    EducationPlatformApi apiInstance = new EducationPlatformApi(defaultClient);
    Integer pid = 56; // Integer | 
    try {
      Object result = apiInstance.deletePlatformApiV1EducationPlatformPidDelete_0(pid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling EducationPlatformApi#deletePlatformApiV1EducationPlatformPidDelete_0");
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
| **pid** | **Integer**|  | |

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

<a id="listPlatformsApiV1EducationPlatformListGet"></a>
# **listPlatformsApiV1EducationPlatformListGet**
> Object listPlatformsApiV1EducationPlatformListGet(status)

教育平台列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.EducationPlatformApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    EducationPlatformApi apiInstance = new EducationPlatformApi(defaultClient);
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.listPlatformsApiV1EducationPlatformListGet(status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling EducationPlatformApi#listPlatformsApiV1EducationPlatformListGet");
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

<a id="listPlatformsApiV1EducationPlatformListGet_0"></a>
# **listPlatformsApiV1EducationPlatformListGet_0**
> Object listPlatformsApiV1EducationPlatformListGet_0(status)

教育平台列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.EducationPlatformApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    EducationPlatformApi apiInstance = new EducationPlatformApi(defaultClient);
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.listPlatformsApiV1EducationPlatformListGet_0(status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling EducationPlatformApi#listPlatformsApiV1EducationPlatformListGet_0");
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

<a id="syncLogApiV1EducationPlatformSyncLogGet"></a>
# **syncLogApiV1EducationPlatformSyncLogGet**
> Object syncLogApiV1EducationPlatformSyncLogGet(page, limit, platformCode)

同步日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.EducationPlatformApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    EducationPlatformApi apiInstance = new EducationPlatformApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String platformCode = "platformCode_example"; // String | 
    try {
      Object result = apiInstance.syncLogApiV1EducationPlatformSyncLogGet(page, limit, platformCode);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling EducationPlatformApi#syncLogApiV1EducationPlatformSyncLogGet");
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
| **platformCode** | **String**|  | [optional] |

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

<a id="syncLogApiV1EducationPlatformSyncLogGet_0"></a>
# **syncLogApiV1EducationPlatformSyncLogGet_0**
> Object syncLogApiV1EducationPlatformSyncLogGet_0(page, limit, platformCode)

同步日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.EducationPlatformApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    EducationPlatformApi apiInstance = new EducationPlatformApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String platformCode = "platformCode_example"; // String | 
    try {
      Object result = apiInstance.syncLogApiV1EducationPlatformSyncLogGet_0(page, limit, platformCode);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling EducationPlatformApi#syncLogApiV1EducationPlatformSyncLogGet_0");
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
| **platformCode** | **String**|  | [optional] |

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

<a id="syncPlatformApiV1EducationPlatformPidSyncPost"></a>
# **syncPlatformApiV1EducationPlatformPidSyncPost**
> Object syncPlatformApiV1EducationPlatformPidSyncPost(pid, type, syncType)

同步数据

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.EducationPlatformApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    EducationPlatformApi apiInstance = new EducationPlatformApi(defaultClient);
    Integer pid = 56; // Integer | 
    String type = "course"; // String | 
    String syncType = "pull"; // String | 
    try {
      Object result = apiInstance.syncPlatformApiV1EducationPlatformPidSyncPost(pid, type, syncType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling EducationPlatformApi#syncPlatformApiV1EducationPlatformPidSyncPost");
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
| **pid** | **Integer**|  | |
| **type** | **String**|  | [optional] [default to course] |
| **syncType** | **String**|  | [optional] [default to pull] |

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

<a id="syncPlatformApiV1EducationPlatformPidSyncPost_0"></a>
# **syncPlatformApiV1EducationPlatformPidSyncPost_0**
> Object syncPlatformApiV1EducationPlatformPidSyncPost_0(pid, type, syncType)

同步数据

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.EducationPlatformApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    EducationPlatformApi apiInstance = new EducationPlatformApi(defaultClient);
    Integer pid = 56; // Integer | 
    String type = "course"; // String | 
    String syncType = "pull"; // String | 
    try {
      Object result = apiInstance.syncPlatformApiV1EducationPlatformPidSyncPost_0(pid, type, syncType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling EducationPlatformApi#syncPlatformApiV1EducationPlatformPidSyncPost_0");
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
| **pid** | **Integer**|  | |
| **type** | **String**|  | [optional] [default to course] |
| **syncType** | **String**|  | [optional] [default to pull] |

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

<a id="updatePlatformApiV1EducationPlatformPidPut"></a>
# **updatePlatformApiV1EducationPlatformPidPut**
> Object updatePlatformApiV1EducationPlatformPidPut(pid, name, apiUrl, apiKey, apiSecret, status, config)

修改教育平台

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.EducationPlatformApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    EducationPlatformApi apiInstance = new EducationPlatformApi(defaultClient);
    Integer pid = 56; // Integer | 
    String name = "name_example"; // String | 
    String apiUrl = "apiUrl_example"; // String | 
    String apiKey = "apiKey_example"; // String | 
    String apiSecret = "apiSecret_example"; // String | 
    Integer status = 56; // Integer | 
    String config = "config_example"; // String | 
    try {
      Object result = apiInstance.updatePlatformApiV1EducationPlatformPidPut(pid, name, apiUrl, apiKey, apiSecret, status, config);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling EducationPlatformApi#updatePlatformApiV1EducationPlatformPidPut");
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
| **pid** | **Integer**|  | |
| **name** | **String**|  | [optional] |
| **apiUrl** | **String**|  | [optional] |
| **apiKey** | **String**|  | [optional] |
| **apiSecret** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |
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

<a id="updatePlatformApiV1EducationPlatformPidPut_0"></a>
# **updatePlatformApiV1EducationPlatformPidPut_0**
> Object updatePlatformApiV1EducationPlatformPidPut_0(pid, name, apiUrl, apiKey, apiSecret, status, config)

修改教育平台

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.EducationPlatformApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    EducationPlatformApi apiInstance = new EducationPlatformApi(defaultClient);
    Integer pid = 56; // Integer | 
    String name = "name_example"; // String | 
    String apiUrl = "apiUrl_example"; // String | 
    String apiKey = "apiKey_example"; // String | 
    String apiSecret = "apiSecret_example"; // String | 
    Integer status = 56; // Integer | 
    String config = "config_example"; // String | 
    try {
      Object result = apiInstance.updatePlatformApiV1EducationPlatformPidPut_0(pid, name, apiUrl, apiKey, apiSecret, status, config);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling EducationPlatformApi#updatePlatformApiV1EducationPlatformPidPut_0");
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
| **pid** | **Integer**|  | |
| **name** | **String**|  | [optional] |
| **apiUrl** | **String**|  | [optional] |
| **apiKey** | **String**|  | [optional] |
| **apiSecret** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |
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

