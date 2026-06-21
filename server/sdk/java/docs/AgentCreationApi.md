# AgentCreationApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getCreationByShareCodeApiV1AgentsShareThirdCodeGet**](AgentCreationApi.md#getCreationByShareCodeApiV1AgentsShareThirdCodeGet) | **GET** /api/v1/agents/share/third/{code} | 通过分享码获取创作 |
| [**myCreationsApiV1AgentsMyTypePost**](AgentCreationApi.md#myCreationsApiV1AgentsMyTypePost) | **POST** /api/v1/agents/my/{type} | 我的创作列表 |
| [**operateCreationApiV1AgentsOperateGcIdTypeGet**](AgentCreationApi.md#operateCreationApiV1AgentsOperateGcIdTypeGet) | **GET** /api/v1/agents/operate/{gc_id}/{type} | 点赞/收藏操作 |
| [**shareCreationApiV1AgentsSharePost**](AgentCreationApi.md#shareCreationApiV1AgentsSharePost) | **POST** /api/v1/agents/share | 分享创作（生成分享码） |
| [**shareGenerateImageApiV1AgentsShareImagePost**](AgentCreationApi.md#shareGenerateImageApiV1AgentsShareImagePost) | **POST** /api/v1/agents/share/image | 分享生成图片 |
| [**shareToCodeApiV1AgentsShareCodePost**](AgentCreationApi.md#shareToCodeApiV1AgentsShareCodePost) | **POST** /api/v1/agents/share/code | 分享转CODE |


<a id="getCreationByShareCodeApiV1AgentsShareThirdCodeGet"></a>
# **getCreationByShareCodeApiV1AgentsShareThirdCodeGet**
> Object getCreationByShareCodeApiV1AgentsShareThirdCodeGet(code)

通过分享码获取创作

Public endpoint — retrieve a creation by its share code.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentCreationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentCreationApi apiInstance = new AgentCreationApi(defaultClient);
    String code = "code_example"; // String | 
    try {
      Object result = apiInstance.getCreationByShareCodeApiV1AgentsShareThirdCodeGet(code);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentCreationApi#getCreationByShareCodeApiV1AgentsShareThirdCodeGet");
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

<a id="myCreationsApiV1AgentsMyTypePost"></a>
# **myCreationsApiV1AgentsMyTypePost**
> Object myCreationsApiV1AgentsMyTypePost(type, page, limit)

我的创作列表

Return the current user&#39;s creations filtered by type.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentCreationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentCreationApi apiInstance = new AgentCreationApi(defaultClient);
    String type = "type_example"; // String | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.myCreationsApiV1AgentsMyTypePost(type, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentCreationApi#myCreationsApiV1AgentsMyTypePost");
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
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |

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

<a id="operateCreationApiV1AgentsOperateGcIdTypeGet"></a>
# **operateCreationApiV1AgentsOperateGcIdTypeGet**
> Object operateCreationApiV1AgentsOperateGcIdTypeGet(gcId, type)

点赞/收藏操作

Toggle like or collect on a creation. Returns new state.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentCreationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentCreationApi apiInstance = new AgentCreationApi(defaultClient);
    String gcId = "gcId_example"; // String | 
    String type = "type_example"; // String | 
    try {
      Object result = apiInstance.operateCreationApiV1AgentsOperateGcIdTypeGet(gcId, type);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentCreationApi#operateCreationApiV1AgentsOperateGcIdTypeGet");
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
| **gcId** | **String**|  | |
| **type** | **String**|  | |

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

<a id="shareCreationApiV1AgentsSharePost"></a>
# **shareCreationApiV1AgentsSharePost**
> Object shareCreationApiV1AgentsSharePost(gcId)

分享创作（生成分享码）

Generate a share code for a creation.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentCreationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentCreationApi apiInstance = new AgentCreationApi(defaultClient);
    String gcId = "gcId_example"; // String | 创作ID
    try {
      Object result = apiInstance.shareCreationApiV1AgentsSharePost(gcId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentCreationApi#shareCreationApiV1AgentsSharePost");
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
| **gcId** | **String**| 创作ID | |

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

<a id="shareGenerateImageApiV1AgentsShareImagePost"></a>
# **shareGenerateImageApiV1AgentsShareImagePost**
> Object shareGenerateImageApiV1AgentsShareImagePost(gcId, width, height)

分享生成图片

Generate a shareable image card for a creation.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentCreationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentCreationApi apiInstance = new AgentCreationApi(defaultClient);
    String gcId = "gcId_example"; // String | 创作ID
    Integer width = 800; // Integer | 图片宽度
    Integer height = 600; // Integer | 图片高度
    try {
      Object result = apiInstance.shareGenerateImageApiV1AgentsShareImagePost(gcId, width, height);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentCreationApi#shareGenerateImageApiV1AgentsShareImagePost");
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
| **gcId** | **String**| 创作ID | |
| **width** | **Integer**| 图片宽度 | [optional] [default to 800] |
| **height** | **Integer**| 图片高度 | [optional] [default to 600] |

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

<a id="shareToCodeApiV1AgentsShareCodePost"></a>
# **shareToCodeApiV1AgentsShareCodePost**
> Object shareToCodeApiV1AgentsShareCodePost(gcId)

分享转CODE

Convert a share reference to a code (alias for share creation).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentCreationApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentCreationApi apiInstance = new AgentCreationApi(defaultClient);
    String gcId = "gcId_example"; // String | 创作ID
    try {
      Object result = apiInstance.shareToCodeApiV1AgentsShareCodePost(gcId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentCreationApi#shareToCodeApiV1AgentsShareCodePost");
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
| **gcId** | **String**| 创作ID | |

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

