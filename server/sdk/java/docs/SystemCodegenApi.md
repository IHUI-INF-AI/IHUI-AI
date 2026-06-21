# SystemCodegenApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**genColumnListApiV1SystemGenColumnTableIdGet**](SystemCodegenApi.md#genColumnListApiV1SystemGenColumnTableIdGet) | **GET** /api/v1/system/gen/column/{table_id} | List columns for an imported table |
| [**genDbListApiV1SystemGenDbListGet**](SystemCodegenApi.md#genDbListApiV1SystemGenDbListGet) | **GET** /api/v1/system/gen/db/list | List database tables from information_schema |
| [**genDeleteApiV1SystemGenTableIdsDelete**](SystemCodegenApi.md#genDeleteApiV1SystemGenTableIdsDelete) | **DELETE** /api/v1/system/gen/{table_ids} | Delete imported codegen tables |
| [**genDownloadApiV1SystemGenDownloadTableNameGet**](SystemCodegenApi.md#genDownloadApiV1SystemGenDownloadTableNameGet) | **GET** /api/v1/system/gen/download/{table_name} | Download generated code as zip |
| [**genImportTableApiV1SystemGenImportTablePost**](SystemCodegenApi.md#genImportTableApiV1SystemGenImportTablePost) | **POST** /api/v1/system/gen/import_table | Import database tables into codegen |
| [**genListApiV1SystemGenListGet**](SystemCodegenApi.md#genListApiV1SystemGenListGet) | **GET** /api/v1/system/gen/list | List imported codegen tables |
| [**genPreviewApiV1SystemGenPreviewTableIdGet**](SystemCodegenApi.md#genPreviewApiV1SystemGenPreviewTableIdGet) | **GET** /api/v1/system/gen/preview/{table_id} | Preview generated code for a table |
| [**genUpdateApiV1SystemGenPut**](SystemCodegenApi.md#genUpdateApiV1SystemGenPut) | **PUT** /api/v1/system/gen | Update codegen table metadata |


<a id="genColumnListApiV1SystemGenColumnTableIdGet"></a>
# **genColumnListApiV1SystemGenColumnTableIdGet**
> Object genColumnListApiV1SystemGenColumnTableIdGet(tableId)

List columns for an imported table

查询已导入表的字段列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemCodegenApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemCodegenApi apiInstance = new SystemCodegenApi(defaultClient);
    Integer tableId = 56; // Integer | 
    try {
      Object result = apiInstance.genColumnListApiV1SystemGenColumnTableIdGet(tableId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemCodegenApi#genColumnListApiV1SystemGenColumnTableIdGet");
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
| **tableId** | **Integer**|  | |

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

<a id="genDbListApiV1SystemGenDbListGet"></a>
# **genDbListApiV1SystemGenDbListGet**
> Object genDbListApiV1SystemGenDbListGet(page, limit, tableName, tableComment)

List database tables from information_schema

从 information_schema 查询数据库表列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemCodegenApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemCodegenApi apiInstance = new SystemCodegenApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String tableName = "tableName_example"; // String | 
    String tableComment = "tableComment_example"; // String | 
    try {
      Object result = apiInstance.genDbListApiV1SystemGenDbListGet(page, limit, tableName, tableComment);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemCodegenApi#genDbListApiV1SystemGenDbListGet");
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
| **tableName** | **String**|  | [optional] |
| **tableComment** | **String**|  | [optional] |

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

<a id="genDeleteApiV1SystemGenTableIdsDelete"></a>
# **genDeleteApiV1SystemGenTableIdsDelete**
> Object genDeleteApiV1SystemGenTableIdsDelete(tableIds)

Delete imported codegen tables

删除代码生成记录

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemCodegenApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemCodegenApi apiInstance = new SystemCodegenApi(defaultClient);
    String tableIds = "tableIds_example"; // String | Comma-separated table IDs
    try {
      Object result = apiInstance.genDeleteApiV1SystemGenTableIdsDelete(tableIds);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemCodegenApi#genDeleteApiV1SystemGenTableIdsDelete");
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
| **tableIds** | **String**| Comma-separated table IDs | |

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

<a id="genDownloadApiV1SystemGenDownloadTableNameGet"></a>
# **genDownloadApiV1SystemGenDownloadTableNameGet**
> Object genDownloadApiV1SystemGenDownloadTableNameGet(tableName)

Download generated code as zip

下载生成的代码 zip 文件

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemCodegenApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemCodegenApi apiInstance = new SystemCodegenApi(defaultClient);
    String tableName = "tableName_example"; // String | 
    try {
      Object result = apiInstance.genDownloadApiV1SystemGenDownloadTableNameGet(tableName);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemCodegenApi#genDownloadApiV1SystemGenDownloadTableNameGet");
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
| **tableName** | **String**|  | |

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

<a id="genImportTableApiV1SystemGenImportTablePost"></a>
# **genImportTableApiV1SystemGenImportTablePost**
> Object genImportTableApiV1SystemGenImportTablePost(bodyGenImportTableApiV1SystemGenImportTablePost)

Import database tables into codegen

导入数据库表结构到代码生成

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemCodegenApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemCodegenApi apiInstance = new SystemCodegenApi(defaultClient);
    BodyGenImportTableApiV1SystemGenImportTablePost bodyGenImportTableApiV1SystemGenImportTablePost = new BodyGenImportTableApiV1SystemGenImportTablePost(); // BodyGenImportTableApiV1SystemGenImportTablePost | 
    try {
      Object result = apiInstance.genImportTableApiV1SystemGenImportTablePost(bodyGenImportTableApiV1SystemGenImportTablePost);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemCodegenApi#genImportTableApiV1SystemGenImportTablePost");
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
| **bodyGenImportTableApiV1SystemGenImportTablePost** | [**BodyGenImportTableApiV1SystemGenImportTablePost**](BodyGenImportTableApiV1SystemGenImportTablePost.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="genListApiV1SystemGenListGet"></a>
# **genListApiV1SystemGenListGet**
> Object genListApiV1SystemGenListGet(page, limit, tableName, tableComment)

List imported codegen tables

分页查询已导入的代码生成表列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemCodegenApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemCodegenApi apiInstance = new SystemCodegenApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String tableName = "tableName_example"; // String | 
    String tableComment = "tableComment_example"; // String | 
    try {
      Object result = apiInstance.genListApiV1SystemGenListGet(page, limit, tableName, tableComment);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemCodegenApi#genListApiV1SystemGenListGet");
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
| **tableName** | **String**|  | [optional] |
| **tableComment** | **String**|  | [optional] |

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

<a id="genPreviewApiV1SystemGenPreviewTableIdGet"></a>
# **genPreviewApiV1SystemGenPreviewTableIdGet**
> Object genPreviewApiV1SystemGenPreviewTableIdGet(tableId)

Preview generated code for a table

预览生成的代码

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemCodegenApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemCodegenApi apiInstance = new SystemCodegenApi(defaultClient);
    Integer tableId = 56; // Integer | 
    try {
      Object result = apiInstance.genPreviewApiV1SystemGenPreviewTableIdGet(tableId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemCodegenApi#genPreviewApiV1SystemGenPreviewTableIdGet");
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
| **tableId** | **Integer**|  | |

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

<a id="genUpdateApiV1SystemGenPut"></a>
# **genUpdateApiV1SystemGenPut**
> Object genUpdateApiV1SystemGenPut(requestBody)

Update codegen table metadata

修改代码生成业务配置

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.SystemCodegenApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    SystemCodegenApi apiInstance = new SystemCodegenApi(defaultClient);
    Map<String, Object> requestBody = null; // Map<String, Object> | 
    try {
      Object result = apiInstance.genUpdateApiV1SystemGenPut(requestBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling SystemCodegenApi#genUpdateApiV1SystemGenPut");
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
| **requestBody** | [**Map&lt;String, Object&gt;**](Object.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

