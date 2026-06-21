# RemoteDeviceApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**agentByCollectApiV1RemoteAgentByCollectUuidGet**](RemoteDeviceApi.md#agentByCollectApiV1RemoteAgentByCollectUuidGet) | **GET** /api/v1/remote/agent/by/collect/{uuid} | Agent By Collect |
| [**agentByCollectApiV1RemoteAgentByCollectUuidGet_0**](RemoteDeviceApi.md#agentByCollectApiV1RemoteAgentByCollectUuidGet_0) | **GET** /api/v1/remote/agent/by/collect/{uuid} | Agent By Collect |
| [**agentByPayApiV1RemoteAgentByPayGet**](RemoteDeviceApi.md#agentByPayApiV1RemoteAgentByPayGet) | **GET** /api/v1/remote/agent/by/pay | Agent By Pay |
| [**agentByPayApiV1RemoteAgentByPayGet_0**](RemoteDeviceApi.md#agentByPayApiV1RemoteAgentByPayGet_0) | **GET** /api/v1/remote/agent/by/pay | Agent By Pay |
| [**agentByTypeApiV1RemoteAgentByTypeGet**](RemoteDeviceApi.md#agentByTypeApiV1RemoteAgentByTypeGet) | **GET** /api/v1/remote/agent/by/type | Agent By Type |
| [**agentByTypeApiV1RemoteAgentByTypeGet_0**](RemoteDeviceApi.md#agentByTypeApiV1RemoteAgentByTypeGet_0) | **GET** /api/v1/remote/agent/by/type | Agent By Type |
| [**agentCategory2ApiV1RemoteAgentCategory2Get**](RemoteDeviceApi.md#agentCategory2ApiV1RemoteAgentCategory2Get) | **GET** /api/v1/remote/agent/category2 | Agent Category2 |
| [**agentCategory2ApiV1RemoteAgentCategory2Get_0**](RemoteDeviceApi.md#agentCategory2ApiV1RemoteAgentCategory2Get_0) | **GET** /api/v1/remote/agent/category2 | Agent Category2 |
| [**agentCategoryApiV1RemoteAgentCategoryGet**](RemoteDeviceApi.md#agentCategoryApiV1RemoteAgentCategoryGet) | **GET** /api/v1/remote/agent/category | Agent Category |
| [**agentCategoryApiV1RemoteAgentCategoryGet_0**](RemoteDeviceApi.md#agentCategoryApiV1RemoteAgentCategoryGet_0) | **GET** /api/v1/remote/agent/category | Agent Category |
| [**getInfoApiV1RemoteInfoUuidGet**](RemoteDeviceApi.md#getInfoApiV1RemoteInfoUuidGet) | **GET** /api/v1/remote/info/{uuid} | Get Info |
| [**getInfoApiV1RemoteInfoUuidGet_0**](RemoteDeviceApi.md#getInfoApiV1RemoteInfoUuidGet_0) | **GET** /api/v1/remote/info/{uuid} | Get Info |
| [**getRoleApiV1RemoteRoleGet**](RemoteDeviceApi.md#getRoleApiV1RemoteRoleGet) | **GET** /api/v1/remote/role | Get Role |
| [**getRoleApiV1RemoteRoleGet_0**](RemoteDeviceApi.md#getRoleApiV1RemoteRoleGet_0) | **GET** /api/v1/remote/role | Get Role |
| [**getWithdrawalOpenApiV1RemoteGetTrueGet**](RemoteDeviceApi.md#getWithdrawalOpenApiV1RemoteGetTrueGet) | **GET** /api/v1/remote/get/true | Get Withdrawal Open |
| [**getWithdrawalOpenApiV1RemoteGetTrueGet_0**](RemoteDeviceApi.md#getWithdrawalOpenApiV1RemoteGetTrueGet_0) | **GET** /api/v1/remote/get/true | Get Withdrawal Open |
| [**myTeamApiV1RemoteMyTeamUuidPost**](RemoteDeviceApi.md#myTeamApiV1RemoteMyTeamUuidPost) | **POST** /api/v1/remote/myTeam/{uuid} | My Team |
| [**myTeamApiV1RemoteMyTeamUuidPost_0**](RemoteDeviceApi.md#myTeamApiV1RemoteMyTeamUuidPost_0) | **POST** /api/v1/remote/myTeam/{uuid} | My Team |
| [**tencentAsrApiV1RemoteGetTencentSentencePost**](RemoteDeviceApi.md#tencentAsrApiV1RemoteGetTencentSentencePost) | **POST** /api/v1/remote/get/tencent/sentence | Tencent Asr |
| [**tencentAsrApiV1RemoteGetTencentSentencePost_0**](RemoteDeviceApi.md#tencentAsrApiV1RemoteGetTencentSentencePost_0) | **POST** /api/v1/remote/get/tencent/sentence | Tencent Asr |
| [**uploadBusinessCardApiV1RemoteUploadBusinessCardPost**](RemoteDeviceApi.md#uploadBusinessCardApiV1RemoteUploadBusinessCardPost) | **POST** /api/v1/remote/uploadBusinessCard | Upload Business Card |
| [**uploadBusinessCardApiV1RemoteUploadBusinessCardPost_0**](RemoteDeviceApi.md#uploadBusinessCardApiV1RemoteUploadBusinessCardPost_0) | **POST** /api/v1/remote/uploadBusinessCard | Upload Business Card |


<a id="agentByCollectApiV1RemoteAgentByCollectUuidGet"></a>
# **agentByCollectApiV1RemoteAgentByCollectUuidGet**
> Object agentByCollectApiV1RemoteAgentByCollectUuidGet(uuid, search, page, size)

Agent By Collect

对应 Java: GET /remote/agent/by/collect/{uuid}?search&#x3D; (查收藏表, 此处简化).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    String uuid = "uuid_example"; // String | 
    String search = "search_example"; // String | 
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.agentByCollectApiV1RemoteAgentByCollectUuidGet(uuid, search, page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#agentByCollectApiV1RemoteAgentByCollectUuidGet");
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
| **uuid** | **String**|  | |
| **search** | **String**|  | [optional] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **size** | **Integer**|  | [optional] [default to 20] |

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

<a id="agentByCollectApiV1RemoteAgentByCollectUuidGet_0"></a>
# **agentByCollectApiV1RemoteAgentByCollectUuidGet_0**
> Object agentByCollectApiV1RemoteAgentByCollectUuidGet_0(uuid, search, page, size)

Agent By Collect

对应 Java: GET /remote/agent/by/collect/{uuid}?search&#x3D; (查收藏表, 此处简化).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    String uuid = "uuid_example"; // String | 
    String search = "search_example"; // String | 
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.agentByCollectApiV1RemoteAgentByCollectUuidGet_0(uuid, search, page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#agentByCollectApiV1RemoteAgentByCollectUuidGet_0");
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
| **uuid** | **String**|  | |
| **search** | **String**|  | [optional] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **size** | **Integer**|  | [optional] [default to 20] |

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

<a id="agentByPayApiV1RemoteAgentByPayGet"></a>
# **agentByPayApiV1RemoteAgentByPayGet**
> Object agentByPayApiV1RemoteAgentByPayGet(uuid, search, type, date, page, size)

Agent By Pay

对应 Java: GET /remote/agent/by/pay?uuid&#x3D;&amp;search&#x3D;&amp;type&#x3D;&amp;date&#x3D;

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    String uuid = "uuid_example"; // String | 
    String search = "search_example"; // String | 
    Integer type = 56; // Integer | 
    String date = "date_example"; // String | 
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.agentByPayApiV1RemoteAgentByPayGet(uuid, search, type, date, page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#agentByPayApiV1RemoteAgentByPayGet");
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
| **uuid** | **String**|  | |
| **search** | **String**|  | [optional] |
| **type** | **Integer**|  | [optional] |
| **date** | **String**|  | [optional] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **size** | **Integer**|  | [optional] [default to 20] |

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

<a id="agentByPayApiV1RemoteAgentByPayGet_0"></a>
# **agentByPayApiV1RemoteAgentByPayGet_0**
> Object agentByPayApiV1RemoteAgentByPayGet_0(uuid, search, type, date, page, size)

Agent By Pay

对应 Java: GET /remote/agent/by/pay?uuid&#x3D;&amp;search&#x3D;&amp;type&#x3D;&amp;date&#x3D;

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    String uuid = "uuid_example"; // String | 
    String search = "search_example"; // String | 
    Integer type = 56; // Integer | 
    String date = "date_example"; // String | 
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.agentByPayApiV1RemoteAgentByPayGet_0(uuid, search, type, date, page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#agentByPayApiV1RemoteAgentByPayGet_0");
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
| **uuid** | **String**|  | |
| **search** | **String**|  | [optional] |
| **type** | **Integer**|  | [optional] |
| **date** | **String**|  | [optional] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **size** | **Integer**|  | [optional] [default to 20] |

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

<a id="agentByTypeApiV1RemoteAgentByTypeGet"></a>
# **agentByTypeApiV1RemoteAgentByTypeGet**
> Object agentByTypeApiV1RemoteAgentByTypeGet(search, code, page, size)

Agent By Type

对应 Java: GET /remote/agent/by/type?search&#x3D;&amp;code&#x3D;

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    String search = "search_example"; // String | 
    String code = "code_example"; // String | 
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.agentByTypeApiV1RemoteAgentByTypeGet(search, code, page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#agentByTypeApiV1RemoteAgentByTypeGet");
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
| **search** | **String**|  | [optional] |
| **code** | **String**|  | [optional] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **size** | **Integer**|  | [optional] [default to 20] |

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

<a id="agentByTypeApiV1RemoteAgentByTypeGet_0"></a>
# **agentByTypeApiV1RemoteAgentByTypeGet_0**
> Object agentByTypeApiV1RemoteAgentByTypeGet_0(search, code, page, size)

Agent By Type

对应 Java: GET /remote/agent/by/type?search&#x3D;&amp;code&#x3D;

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    String search = "search_example"; // String | 
    String code = "code_example"; // String | 
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.agentByTypeApiV1RemoteAgentByTypeGet_0(search, code, page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#agentByTypeApiV1RemoteAgentByTypeGet_0");
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
| **search** | **String**|  | [optional] |
| **code** | **String**|  | [optional] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **size** | **Integer**|  | [optional] [default to 20] |

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

<a id="agentCategory2ApiV1RemoteAgentCategory2Get"></a>
# **agentCategory2ApiV1RemoteAgentCategory2Get**
> Object agentCategory2ApiV1RemoteAgentCategory2Get(type)

Agent Category2

对应 Java: GET /remote/agent/category2 — AjaxResult 包装 (与上同结构).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    String type = "type_example"; // String | 
    try {
      Object result = apiInstance.agentCategory2ApiV1RemoteAgentCategory2Get(type);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#agentCategory2ApiV1RemoteAgentCategory2Get");
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

<a id="agentCategory2ApiV1RemoteAgentCategory2Get_0"></a>
# **agentCategory2ApiV1RemoteAgentCategory2Get_0**
> Object agentCategory2ApiV1RemoteAgentCategory2Get_0(type)

Agent Category2

对应 Java: GET /remote/agent/category2 — AjaxResult 包装 (与上同结构).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    String type = "type_example"; // String | 
    try {
      Object result = apiInstance.agentCategory2ApiV1RemoteAgentCategory2Get_0(type);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#agentCategory2ApiV1RemoteAgentCategory2Get_0");
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

<a id="agentCategoryApiV1RemoteAgentCategoryGet"></a>
# **agentCategoryApiV1RemoteAgentCategoryGet**
> Object agentCategoryApiV1RemoteAgentCategoryGet(type)

Agent Category

对应 Java: GET /remote/agent/category?type&#x3D;xxx — ResponseResultInfo 包装.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    String type = "type_example"; // String | 
    try {
      Object result = apiInstance.agentCategoryApiV1RemoteAgentCategoryGet(type);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#agentCategoryApiV1RemoteAgentCategoryGet");
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

<a id="agentCategoryApiV1RemoteAgentCategoryGet_0"></a>
# **agentCategoryApiV1RemoteAgentCategoryGet_0**
> Object agentCategoryApiV1RemoteAgentCategoryGet_0(type)

Agent Category

对应 Java: GET /remote/agent/category?type&#x3D;xxx — ResponseResultInfo 包装.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    String type = "type_example"; // String | 
    try {
      Object result = apiInstance.agentCategoryApiV1RemoteAgentCategoryGet_0(type);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#agentCategoryApiV1RemoteAgentCategoryGet_0");
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

<a id="getInfoApiV1RemoteInfoUuidGet"></a>
# **getInfoApiV1RemoteInfoUuidGet**
> Object getInfoApiV1RemoteInfoUuidGet(uuid, xDeviceType)

Get Info

对应 Java: GET /remote/info/{uuid} — 用户基本信息 + 第三方账号绑定.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    String uuid = "uuid_example"; // String | 
    String xDeviceType = "unknown"; // String | 
    try {
      Object result = apiInstance.getInfoApiV1RemoteInfoUuidGet(uuid, xDeviceType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#getInfoApiV1RemoteInfoUuidGet");
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
| **uuid** | **String**|  | |
| **xDeviceType** | **String**|  | [optional] [default to unknown] |

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

<a id="getInfoApiV1RemoteInfoUuidGet_0"></a>
# **getInfoApiV1RemoteInfoUuidGet_0**
> Object getInfoApiV1RemoteInfoUuidGet_0(uuid, xDeviceType)

Get Info

对应 Java: GET /remote/info/{uuid} — 用户基本信息 + 第三方账号绑定.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    String uuid = "uuid_example"; // String | 
    String xDeviceType = "unknown"; // String | 
    try {
      Object result = apiInstance.getInfoApiV1RemoteInfoUuidGet_0(uuid, xDeviceType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#getInfoApiV1RemoteInfoUuidGet_0");
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
| **uuid** | **String**|  | |
| **xDeviceType** | **String**|  | [optional] [default to unknown] |

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

<a id="getRoleApiV1RemoteRoleGet"></a>
# **getRoleApiV1RemoteRoleGet**
> Object getRoleApiV1RemoteRoleGet()

Get Role

对应 Java: GET /remote/role — 列出所有可购买的 ZhsProductIdentity.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    try {
      Object result = apiInstance.getRoleApiV1RemoteRoleGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#getRoleApiV1RemoteRoleGet");
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

<a id="getRoleApiV1RemoteRoleGet_0"></a>
# **getRoleApiV1RemoteRoleGet_0**
> Object getRoleApiV1RemoteRoleGet_0()

Get Role

对应 Java: GET /remote/role — 列出所有可购买的 ZhsProductIdentity.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    try {
      Object result = apiInstance.getRoleApiV1RemoteRoleGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#getRoleApiV1RemoteRoleGet_0");
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

<a id="getWithdrawalOpenApiV1RemoteGetTrueGet"></a>
# **getWithdrawalOpenApiV1RemoteGetTrueGet**
> Object getWithdrawalOpenApiV1RemoteGetTrueGet()

Get Withdrawal Open

对应 Java: GET /remote/get/true — 查 ZhsWithdrawalFlow id&#x3D;1.status&#x3D;&#x3D;1 → true.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    try {
      Object result = apiInstance.getWithdrawalOpenApiV1RemoteGetTrueGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#getWithdrawalOpenApiV1RemoteGetTrueGet");
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

<a id="getWithdrawalOpenApiV1RemoteGetTrueGet_0"></a>
# **getWithdrawalOpenApiV1RemoteGetTrueGet_0**
> Object getWithdrawalOpenApiV1RemoteGetTrueGet_0()

Get Withdrawal Open

对应 Java: GET /remote/get/true — 查 ZhsWithdrawalFlow id&#x3D;1.status&#x3D;&#x3D;1 → true.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    try {
      Object result = apiInstance.getWithdrawalOpenApiV1RemoteGetTrueGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#getWithdrawalOpenApiV1RemoteGetTrueGet_0");
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

<a id="myTeamApiV1RemoteMyTeamUuidPost"></a>
# **myTeamApiV1RemoteMyTeamUuidPost**
> Object myTeamApiV1RemoteMyTeamUuidPost(uuid, xDeviceType, myTeamQuery)

My Team

对应 Java: POST /remote/myTeam/{uuid} — 查询我的团队 (邀请树子节点).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    String uuid = "uuid_example"; // String | 
    String xDeviceType = "unknown"; // String | 
    MyTeamQuery myTeamQuery = new MyTeamQuery(); // MyTeamQuery | 
    try {
      Object result = apiInstance.myTeamApiV1RemoteMyTeamUuidPost(uuid, xDeviceType, myTeamQuery);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#myTeamApiV1RemoteMyTeamUuidPost");
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
| **uuid** | **String**|  | |
| **xDeviceType** | **String**|  | [optional] [default to unknown] |
| **myTeamQuery** | [**MyTeamQuery**](MyTeamQuery.md)|  | [optional] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="myTeamApiV1RemoteMyTeamUuidPost_0"></a>
# **myTeamApiV1RemoteMyTeamUuidPost_0**
> Object myTeamApiV1RemoteMyTeamUuidPost_0(uuid, xDeviceType, myTeamQuery)

My Team

对应 Java: POST /remote/myTeam/{uuid} — 查询我的团队 (邀请树子节点).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    String uuid = "uuid_example"; // String | 
    String xDeviceType = "unknown"; // String | 
    MyTeamQuery myTeamQuery = new MyTeamQuery(); // MyTeamQuery | 
    try {
      Object result = apiInstance.myTeamApiV1RemoteMyTeamUuidPost_0(uuid, xDeviceType, myTeamQuery);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#myTeamApiV1RemoteMyTeamUuidPost_0");
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
| **uuid** | **String**|  | |
| **xDeviceType** | **String**|  | [optional] [default to unknown] |
| **myTeamQuery** | [**MyTeamQuery**](MyTeamQuery.md)|  | [optional] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="tencentAsrApiV1RemoteGetTencentSentencePost"></a>
# **tencentAsrApiV1RemoteGetTencentSentencePost**
> Object tencentAsrApiV1RemoteGetTencentSentencePost(tencentAsrReq)

Tencent Asr

对应 Java: POST /remote/get/tencent/sentence — 调用腾讯云一句话识别.  Java 端直接用腾讯云 SDK. Python 这边如果想保真实现需安装 tencentcloud-sdk-python, 此处用占位实现 (返回模拟结果, 生产部署时配置 TENCENT_SECRET_ID/SECRET_KEY 后切换为真实 SDK).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    TencentAsrReq tencentAsrReq = new TencentAsrReq(); // TencentAsrReq | 
    try {
      Object result = apiInstance.tencentAsrApiV1RemoteGetTencentSentencePost(tencentAsrReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#tencentAsrApiV1RemoteGetTencentSentencePost");
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
| **tencentAsrReq** | [**TencentAsrReq**](TencentAsrReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="tencentAsrApiV1RemoteGetTencentSentencePost_0"></a>
# **tencentAsrApiV1RemoteGetTencentSentencePost_0**
> Object tencentAsrApiV1RemoteGetTencentSentencePost_0(tencentAsrReq)

Tencent Asr

对应 Java: POST /remote/get/tencent/sentence — 调用腾讯云一句话识别.  Java 端直接用腾讯云 SDK. Python 这边如果想保真实现需安装 tencentcloud-sdk-python, 此处用占位实现 (返回模拟结果, 生产部署时配置 TENCENT_SECRET_ID/SECRET_KEY 后切换为真实 SDK).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    TencentAsrReq tencentAsrReq = new TencentAsrReq(); // TencentAsrReq | 
    try {
      Object result = apiInstance.tencentAsrApiV1RemoteGetTencentSentencePost_0(tencentAsrReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#tencentAsrApiV1RemoteGetTencentSentencePost_0");
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
| **tencentAsrReq** | [**TencentAsrReq**](TencentAsrReq.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="uploadBusinessCardApiV1RemoteUploadBusinessCardPost"></a>
# **uploadBusinessCardApiV1RemoteUploadBusinessCardPost**
> Object uploadBusinessCardApiV1RemoteUploadBusinessCardPost(businessCardReq, xDeviceType)

Upload Business Card

对应 Java: POST /remote/uploadBusinessCard — 上传 base64 名片到 MinIO.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    BusinessCardReq businessCardReq = new BusinessCardReq(); // BusinessCardReq | 
    String xDeviceType = "unknown"; // String | 
    try {
      Object result = apiInstance.uploadBusinessCardApiV1RemoteUploadBusinessCardPost(businessCardReq, xDeviceType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#uploadBusinessCardApiV1RemoteUploadBusinessCardPost");
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
| **businessCardReq** | [**BusinessCardReq**](BusinessCardReq.md)|  | |
| **xDeviceType** | **String**|  | [optional] [default to unknown] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="uploadBusinessCardApiV1RemoteUploadBusinessCardPost_0"></a>
# **uploadBusinessCardApiV1RemoteUploadBusinessCardPost_0**
> Object uploadBusinessCardApiV1RemoteUploadBusinessCardPost_0(businessCardReq, xDeviceType)

Upload Business Card

对应 Java: POST /remote/uploadBusinessCard — 上传 base64 名片到 MinIO.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteDeviceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteDeviceApi apiInstance = new RemoteDeviceApi(defaultClient);
    BusinessCardReq businessCardReq = new BusinessCardReq(); // BusinessCardReq | 
    String xDeviceType = "unknown"; // String | 
    try {
      Object result = apiInstance.uploadBusinessCardApiV1RemoteUploadBusinessCardPost_0(businessCardReq, xDeviceType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteDeviceApi#uploadBusinessCardApiV1RemoteUploadBusinessCardPost_0");
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
| **businessCardReq** | [**BusinessCardReq**](BusinessCardReq.md)|  | |
| **xDeviceType** | **String**|  | [optional] [default to unknown] |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

