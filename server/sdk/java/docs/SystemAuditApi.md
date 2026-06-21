# SystemAuditApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**cleanLoginInfoApiV1SystemAuditLogininforCleanPost**](SystemAuditApi.md#cleanLoginInfoApiV1SystemAuditLogininforCleanPost) | **POST** /api/v1/system/audit/logininfor/clean | 清理登录日志 |
| [**cleanOperLogApiV1SystemAuditOperlogCleanPost**](SystemAuditApi.md#cleanOperLogApiV1SystemAuditOperlogCleanPost) | **POST** /api/v1/system/audit/operlog/clean | 清理 N 天前的操作日志 |
| [**createLoginInfoApiV1SystemAuditLogininforCreatePost**](SystemAuditApi.md#createLoginInfoApiV1SystemAuditLogininforCreatePost) | **POST** /api/v1/system/audit/logininfor/create | 记录一条登录日志 |
| [**createOperLogApiV1SystemAuditOperlogCreatePost**](SystemAuditApi.md#createOperLogApiV1SystemAuditOperlogCreatePost) | **POST** /api/v1/system/audit/operlog/create | 写入一条操作日志（内部调用） |
| [**exportLoginInfoApiV1SystemAuditLogininforExportGet**](SystemAuditApi.md#exportLoginInfoApiV1SystemAuditLogininforExportGet) | **GET** /api/v1/system/audit/logininfor/export | 导出登录日志到Excel |
| [**exportOperLogsApiV1SystemAuditOperlogExportGet**](SystemAuditApi.md#exportOperLogsApiV1SystemAuditOperlogExportGet) | **GET** /api/v1/system/audit/operlog/export | 导出操作日志到Excel |
| [**listLoginInfoApiV1SystemAuditLogininforListGet**](SystemAuditApi.md#listLoginInfoApiV1SystemAuditLogininforListGet) | **GET** /api/v1/system/audit/logininfor/list | 登录日志列表 |
| [**listOperLogsApiV1SystemAuditOperlogListGet**](SystemAuditApi.md#listOperLogsApiV1SystemAuditOperlogListGet) | **GET** /api/v1/system/audit/operlog/list | 操作日志列表 |


<a id="cleanLoginInfoApiV1SystemAuditLogininforCleanPost"></a>
# **cleanLoginInfoApiV1SystemAuditLogininforCleanPost**
> Object cleanLoginInfoApiV1SystemAuditLogininforCleanPost(days)

清理登录日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SystemAuditApi apiInstance = new SystemAuditApi(defaultClient);
    Integer days = 90; // Integer | 
    try {
      Object result = apiInstance.cleanLoginInfoApiV1SystemAuditLogininforCleanPost(days);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAuditApi#cleanLoginInfoApiV1SystemAuditLogininforCleanPost");
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
| **days** | **Integer**|  | [optional] [default to 90] |

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

<a id="cleanOperLogApiV1SystemAuditOperlogCleanPost"></a>
# **cleanOperLogApiV1SystemAuditOperlogCleanPost**
> Object cleanOperLogApiV1SystemAuditOperlogCleanPost(days)

清理 N 天前的操作日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SystemAuditApi apiInstance = new SystemAuditApi(defaultClient);
    Integer days = 90; // Integer | 保留天数
    try {
      Object result = apiInstance.cleanOperLogApiV1SystemAuditOperlogCleanPost(days);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAuditApi#cleanOperLogApiV1SystemAuditOperlogCleanPost");
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
| **days** | **Integer**| 保留天数 | [optional] [default to 90] |

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

<a id="createLoginInfoApiV1SystemAuditLogininforCreatePost"></a>
# **createLoginInfoApiV1SystemAuditLogininforCreatePost**
> Object createLoginInfoApiV1SystemAuditLogininforCreatePost(userName, ipaddr, loginLocation, browser, os, status, msg)

记录一条登录日志

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SystemAuditApi apiInstance = new SystemAuditApi(defaultClient);
    String userName = "userName_example"; // String | 
    String ipaddr = ""; // String | 
    String loginLocation = ""; // String | 
    String browser = ""; // String | 
    String os = ""; // String | 
    String status = "0"; // String | 
    String msg = ""; // String | 
    try {
      Object result = apiInstance.createLoginInfoApiV1SystemAuditLogininforCreatePost(userName, ipaddr, loginLocation, browser, os, status, msg);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAuditApi#createLoginInfoApiV1SystemAuditLogininforCreatePost");
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
| **userName** | **String**|  | |
| **ipaddr** | **String**|  | [optional] [default to ] |
| **loginLocation** | **String**|  | [optional] [default to ] |
| **browser** | **String**|  | [optional] [default to ] |
| **os** | **String**|  | [optional] [default to ] |
| **status** | **String**|  | [optional] [default to 0] |
| **msg** | **String**|  | [optional] [default to ] |

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

<a id="createOperLogApiV1SystemAuditOperlogCreatePost"></a>
# **createOperLogApiV1SystemAuditOperlogCreatePost**
> Object createOperLogApiV1SystemAuditOperlogCreatePost(title, businessType, method, requestMethod, operUrl, operName, operIp, status, errorMsg)

写入一条操作日志（内部调用）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    SystemAuditApi apiInstance = new SystemAuditApi(defaultClient);
    String title = "title_example"; // String | 
    Integer businessType = 0; // Integer | 0 其它 1 新增 2 修改 3 删除 4 查询
    String method = ""; // String | 
    String requestMethod = ""; // String | 
    String operUrl = ""; // String | 
    String operName = "system"; // String | 
    String operIp = "127.0.0.1"; // String | 
    Integer status = 0; // Integer | 0 成功 1 失败
    String errorMsg = ""; // String | 
    try {
      Object result = apiInstance.createOperLogApiV1SystemAuditOperlogCreatePost(title, businessType, method, requestMethod, operUrl, operName, operIp, status, errorMsg);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAuditApi#createOperLogApiV1SystemAuditOperlogCreatePost");
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
| **businessType** | **Integer**| 0 其它 1 新增 2 修改 3 删除 4 查询 | [optional] [default to 0] |
| **method** | **String**|  | [optional] [default to ] |
| **requestMethod** | **String**|  | [optional] [default to ] |
| **operUrl** | **String**|  | [optional] [default to ] |
| **operName** | **String**|  | [optional] [default to system] |
| **operIp** | **String**|  | [optional] [default to 127.0.0.1] |
| **status** | **Integer**| 0 成功 1 失败 | [optional] [default to 0] |
| **errorMsg** | **String**|  | [optional] [default to ] |

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

<a id="exportLoginInfoApiV1SystemAuditLogininforExportGet"></a>
# **exportLoginInfoApiV1SystemAuditLogininforExportGet**
> Object exportLoginInfoApiV1SystemAuditLogininforExportGet(userName, status)

导出登录日志到Excel

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAuditApi apiInstance = new SystemAuditApi(defaultClient);
    String userName = "userName_example"; // String | 
    String status = "status_example"; // String | 
    try {
      Object result = apiInstance.exportLoginInfoApiV1SystemAuditLogininforExportGet(userName, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAuditApi#exportLoginInfoApiV1SystemAuditLogininforExportGet");
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
| **userName** | **String**|  | [optional] |
| **status** | **String**|  | [optional] |

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

<a id="exportOperLogsApiV1SystemAuditOperlogExportGet"></a>
# **exportOperLogsApiV1SystemAuditOperlogExportGet**
> Object exportOperLogsApiV1SystemAuditOperlogExportGet(title, operName, businessType)

导出操作日志到Excel

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAuditApi apiInstance = new SystemAuditApi(defaultClient);
    String title = "title_example"; // String | 
    String operName = "operName_example"; // String | 
    Integer businessType = 56; // Integer | 
    try {
      Object result = apiInstance.exportOperLogsApiV1SystemAuditOperlogExportGet(title, operName, businessType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAuditApi#exportOperLogsApiV1SystemAuditOperlogExportGet");
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
| **title** | **String**|  | [optional] |
| **operName** | **String**|  | [optional] |
| **businessType** | **Integer**|  | [optional] |

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

<a id="listLoginInfoApiV1SystemAuditLogininforListGet"></a>
# **listLoginInfoApiV1SystemAuditLogininforListGet**
> Object listLoginInfoApiV1SystemAuditLogininforListGet(page, limit, userName, status)

登录日志列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAuditApi apiInstance = new SystemAuditApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String userName = "userName_example"; // String | 
    String status = "status_example"; // String | 0 成功 1 失败
    try {
      Object result = apiInstance.listLoginInfoApiV1SystemAuditLogininforListGet(page, limit, userName, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAuditApi#listLoginInfoApiV1SystemAuditLogininforListGet");
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
| **userName** | **String**|  | [optional] |
| **status** | **String**| 0 成功 1 失败 | [optional] |

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

<a id="listOperLogsApiV1SystemAuditOperlogListGet"></a>
# **listOperLogsApiV1SystemAuditOperlogListGet**
> Object listOperLogsApiV1SystemAuditOperlogListGet(page, limit, title, operName, businessType)

操作日志列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemAuditApi apiInstance = new SystemAuditApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String title = "title_example"; // String | 
    String operName = "operName_example"; // String | 
    Integer businessType = 56; // Integer | 
    try {
      Object result = apiInstance.listOperLogsApiV1SystemAuditOperlogListGet(page, limit, title, operName, businessType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemAuditApi#listOperLogsApiV1SystemAuditOperlogListGet");
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
| **title** | **String**|  | [optional] |
| **operName** | **String**|  | [optional] |
| **businessType** | **Integer**|  | [optional] |

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

